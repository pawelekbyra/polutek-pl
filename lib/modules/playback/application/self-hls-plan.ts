import type { VideoAsset } from '@prisma/client';
import type { AppContext } from '@/lib/modules/shared/app-context';
import { SelfHlsTokenService } from '../infrastructure/self-hls-token.service';
import type { PlaybackAssetContract, PlaybackPlan } from '../domain/playback.dto';
import { captionDeliveryPath, parseCaptionRef } from '@/lib/modules/media';
import { isAdultVideo, PLAYBACK_HEARTBEAT_INTERVAL_SECONDS, PLAYBACK_SESSION_MAX_AGE_MS } from '@/lib/modules/video';

/**
 * Own HLS playback (provider SELF_HLS), the only video source we have. Only
 * called after the access decision and the premiere gate in PlaybackService, so
 * a signed delivery URL exists only for an allowed viewer (CLAUDE.md 4.3).
 */

const OBJECT_KEY_RE = /^videos\/([A-Za-z0-9-]{8,64})\/v\/([A-Za-z0-9_-]{1,32})$/;

/** Version segment of "videos/<videoId>/v/<version>", only when it belongs to this video. */
export function parseSelfHlsObjectKey(objectKey: string, videoId: string): string | null {
  const m = OBJECT_KEY_RE.exec(objectKey);
  return m && m[1] === videoId ? m[2] : null;
}

/**
 * Only a plain public, published, non-adult video outside the patron zone gets the long-lived public
 * delivery token; everything else is protected (short token, private cache headers at the edge).
 * Reads the raw tier on purpose: an unknown value is never public.
 */
export function isPublicDelivery(v: {
  tier?: string | null;
  premiumPassGated?: boolean;
  isAdminPreview?: boolean;
  status?: string | null;
  moderationStatus?: string | null;
  isAdult?: boolean | null;
}): boolean {
  return (
    (v.tier ?? 'PUBLIC') === 'PUBLIC' &&
    !v.premiumPassGated &&
    !v.isAdminPreview &&
    v.status === 'PUBLISHED' &&
    !isAdultVideo({ moderationStatus: v.moderationStatus ?? undefined, isAdult: v.isAdult ?? undefined })
  );
}

export type SelfHlsPlanArgs = {
  ctx: AppContext;
  videoId: string;
  asset: VideoAsset;
  tier: string;
  /** See isPublicDelivery(); false = protected delivery. */
  publicDelivery: boolean;
  /** End of the viewer's grant (patron pass): the token never outlives it. */
  accessEndsAt?: Date | null;
  thumbnailUrl: string;
  isAdminPreview: boolean;
  ipHash?: string;
  userAgentHash?: string;
  safeAsset: PlaybackAssetContract | undefined;
  player: PlaybackPlan['player'];
  warnings: string[];
  /** Playback session of the open player asking for a fresh token (kept when it is the viewer's). */
  reuseSessionId?: string;
};

/**
 * Caption tracks of a plan: a stored reference (`hlscap:...`, a private file) becomes a delivery URL under the
 * SAME token as the video; anything else was already filtered to https URLs / same-site paths and stays.
 * A reference that cannot be resolved is dropped, so a plan never carries a raw reference.
 */
export function withDeliveryCaptions(player: PlaybackPlan['player'], deliveryPrefix: string): PlaybackPlan['player'] {
  if (!player.textTracks?.length) return player;
  const textTracks = player.textTracks.flatMap((track) => {
    const ref = parseCaptionRef(track.src);
    if (ref) return [{ ...track, src: `${deliveryPrefix}/${captionDeliveryPath(ref.file)}` }];
    return track.src.startsWith('hlscap:') ? [] : [track];
  });
  const { textTracks: _dropped, ...withoutTracks } = player;
  void _dropped;
  return textTracks.length > 0 ? { ...withoutTracks, textTracks } : withoutTracks;
}

/** Returns a READY plan, or null when our HLS cannot be served (caller answers with an ERROR plan). */
export async function buildSelfHlsPlan(args: SelfHlsPlanArgs): Promise<PlaybackPlan | null> {
  const { videoId, asset } = args;
  const secret = SelfHlsTokenService.secret();
  const version = parseSelfHlsObjectKey(asset.objectKey, videoId);
  if (!secret || !version) {
    console.error('[PLAYBACK_SERVICE] SELF_HLS asset unusable (secret or object key)', { videoId, hasSecret: Boolean(secret), keyOk: Boolean(version) });
    return null;
  }

  const ttlSeconds = SelfHlsTokenService.ttlSeconds({ isPublic: args.publicDelivery, accessEndsAt: args.accessEndsAt });
  const signed = SelfHlsTokenService.sign(
    { videoId, version, secret, ttlSeconds, isPublic: args.publicDelivery && SelfHlsTokenService.publicMarkerEnabled() },
    SelfHlsTokenService.baseUrl(),
  );
  const sessionId = await reuseOrCreateSession(args);

  return {
    videoId,
    status: 'READY',
    canPlay: true,
    access: { allowed: true },
    source: {
      provider: 'SELF_HLS',
      kind: 'self_hls',
      playbackUrl: signed.masterUrl,
      posterUrl: args.thumbnailUrl,
      mimeType: 'application/x-mpegURL',
      isSignedUrl: true,
      expiresAt: signed.expiresAt.toISOString(),
      asset: args.safeAsset,
    },
    // Captions ride on the same token as the video: issued only here, after the access decision and the premiere gate.
    player: withDeliveryCaptions(args.player, signed.deliveryPrefix),
    diagnostics: {
      warnings: args.warnings,
      sourceConfidence: 'HIGH',
      providerResolutionAllowed: true,
      providerResolutionAttempted: true,
      sourceMode: 'PROVIDER_ASSET',
      asset: args.safeAsset,
    },
    tracking: { playbackSessionId: sessionId, heartbeatIntervalSeconds: PLAYBACK_HEARTBEAT_INTERVAL_SECONDS },
  };
}

/**
 * A token renewal of an open player (`reuseSessionId`) keeps its playback session, so one watch
 * stays one session. The session is reused only when it is this viewer's (same user, or the same
 * guest fingerprint), for this video, with the same preview flag, and still young enough for the
 * event endpoint to accept it; otherwise a new one is created.
 */
async function reuseOrCreateSession(args: SelfHlsPlanArgs): Promise<string> {
  const { ctx, videoId } = args;
  const { actor, prisma } = ctx;
  const userId = actor.type === 'user' || actor.type === 'admin' ? actor.userId : null;

  if (args.reuseSessionId) {
    const existing = await prisma.videoPlaybackSession.findUnique({
      where: { id: args.reuseSessionId },
      select: { id: true, videoId: true, userId: true, ipHash: true, userAgentHash: true, isAdminPreview: true, createdAt: true },
    });
    const now = ctx.now ? ctx.now() : new Date();
    const ownedByViewer = userId
      ? existing?.userId === userId
      : existing?.userId === null && existing.ipHash === (args.ipHash ?? null) && existing.userAgentHash === (args.userAgentHash ?? null);
    if (
      existing &&
      ownedByViewer &&
      existing.videoId === videoId &&
      existing.isAdminPreview === args.isAdminPreview &&
      now.getTime() - existing.createdAt.getTime() < PLAYBACK_SESSION_MAX_AGE_MS
    ) {
      return existing.id;
    }
  }

  const session = await prisma.videoPlaybackSession.create({
    data: {
      videoId,
      userId,
      ipHash: args.ipHash,
      userAgentHash: args.userAgentHash,
      sourceKind: 'self_hls',
      accessTier: args.tier as never,
      isAdminPreview: args.isAdminPreview,
    },
  });
  return session.id;
}

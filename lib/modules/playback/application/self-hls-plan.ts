import type { VideoAsset } from '@prisma/client';
import type { AppContext } from '@/lib/modules/shared/app-context';
import { SelfHlsTokenService } from '../infrastructure/self-hls-token.service';
import type { PlaybackAssetContract, PlaybackPlan } from '../domain/playback.dto';

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

export type SelfHlsPlanArgs = {
  ctx: AppContext;
  videoId: string;
  asset: VideoAsset;
  tier: string;
  thumbnailUrl: string;
  isAdminPreview: boolean;
  ipHash?: string;
  userAgentHash?: string;
  safeAsset: PlaybackAssetContract | undefined;
  player: PlaybackPlan['player'];
  warnings: string[];
};

/** Returns a READY plan, or null when our HLS cannot be served (caller answers with an ERROR plan). */
export async function buildSelfHlsPlan(args: SelfHlsPlanArgs): Promise<PlaybackPlan | null> {
  const { ctx, videoId, asset } = args;
  const secret = SelfHlsTokenService.secret();
  const version = parseSelfHlsObjectKey(asset.objectKey, videoId);
  if (!secret || !version) {
    console.error('[PLAYBACK_SERVICE] SELF_HLS asset unusable (secret or object key)', { videoId, hasSecret: Boolean(secret), keyOk: Boolean(version) });
    return null;
  }

  const signed = SelfHlsTokenService.sign({ videoId, version, secret }, SelfHlsTokenService.baseUrl());
  const { actor, prisma } = ctx;

  const session = await prisma.videoPlaybackSession.create({
    data: {
      videoId,
      userId: actor.type === 'user' || actor.type === 'admin' ? actor.userId : null,
      ipHash: args.ipHash,
      userAgentHash: args.userAgentHash,
      sourceKind: 'self_hls',
      accessTier: args.tier as never,
      isAdminPreview: args.isAdminPreview,
    },
  });

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
    player: args.player,
    diagnostics: {
      warnings: args.warnings,
      sourceConfidence: 'HIGH',
      providerResolutionAllowed: true,
      providerResolutionAttempted: true,
      sourceMode: 'PROVIDER_ASSET',
      asset: args.safeAsset,
    },
    tracking: { playbackSessionId: session.id, heartbeatIntervalSeconds: 60 },
  };
}

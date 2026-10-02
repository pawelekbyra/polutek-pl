import type { VideoAsset } from '@prisma/client';
import type { AppContext } from '@/lib/modules/shared/app-context';
import { MuxClient } from '@/lib/modules/video';
import { CloudflareSignedPlaybackTokenService } from '../infrastructure/cloudflare-signed-playback-token.service';
import { SelfHlsTokenService } from '../infrastructure/self-hls-token.service';
import type { PlaybackAssetContract, PlaybackPlan, PlaybackSourceContract } from '../domain/playback.dto';

/**
 * Own HLS playback (provider SELF_HLS). Only called after the access decision
 * and the premiere gate in PlaybackService, so a signed delivery URL exists
 * only for an allowed viewer (CLAUDE.md 4.3). The previous provider stays
 * available as `source.fallback`: the player switches to it once if our HLS
 * fails (Worker quota, outage, bad token), which is the instant rollback path.
 */

type Fallback = NonNullable<PlaybackSourceContract['fallback']>;

const OBJECT_KEY_RE = /^videos\/([A-Za-z0-9-]{8,64})\/v\/([A-Za-z0-9_-]{1,32})$/;

/** Version segment of "videos/<videoId>/v/<version>", only when it belongs to this video. */
export function parseSelfHlsObjectKey(objectKey: string, videoId: string): string | null {
  const m = OBJECT_KEY_RE.exec(objectKey);
  return m && m[1] === videoId ? m[2] : null;
}

/** Another READY, playable provider asset to fall back to (never SELF_HLS itself). */
export function pickFallbackAsset<T extends Pick<VideoAsset, 'provider' | 'processingState' | 'updatedAt'>>(assets: T[] | null | undefined): T | null {
  const candidates = (assets ?? []).filter(
    (a) => a.processingState === 'READY' && (a.provider === 'CLOUDFLARE_STREAM' || a.provider === 'MUX'),
  );
  candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return candidates[0] ?? null;
}

/** Signed HLS manifest of the fallback provider, or null when it cannot be signed safely. */
export function resolveFallbackSource(asset: VideoAsset | null, tier: string): Fallback | null {
  if (!asset) return null;
  try {
    if (asset.provider === 'CLOUDFLARE_STREAM') {
      const uid = asset.providerPlaybackId || asset.providerAssetId;
      if (!uid || !CloudflareSignedPlaybackTokenService.isConfigured()) return null;
      const signed = CloudflareSignedPlaybackTokenService.createSignedPlaybackToken({ videoUid: uid });
      return {
        provider: 'CLOUDFLARE_STREAM',
        kind: 'cloudflare_stream',
        playbackUrl: `https://videodelivery.net/${encodeURIComponent(signed.token.trim())}/manifest/video.m3u8`,
        expiresAt: signed.expiresAt.toISOString(),
      };
    }
    if (asset.provider === 'MUX') {
      const id = asset.providerPlaybackId || asset.providerAssetId;
      if (!id) return null;
      if (MuxClient.isSigningConfigured()) {
        const token = new MuxClient().createSignedPlaybackToken(id);
        return { provider: 'MUX', kind: 'mux', playbackUrl: `https://stream.mux.com/${id}.m3u8?token=${token}` };
      }
      // An unsigned Mux URL never expires: only acceptable for PUBLIC videos.
      return tier === 'PUBLIC' ? { provider: 'MUX', kind: 'mux', playbackUrl: `https://stream.mux.com/${id}.m3u8` } : null;
    }
  } catch (e) {
    console.error('[PLAYBACK_SERVICE] fallback source resolution failed', e);
  }
  return null;
}

export type SelfHlsPlanArgs = {
  ctx: AppContext;
  videoId: string;
  asset: VideoAsset;
  assets: VideoAsset[] | null | undefined;
  tier: string;
  thumbnailUrl: string;
  isAdminPreview: boolean;
  ipHash?: string;
  userAgentHash?: string;
  safeAsset: PlaybackAssetContract | undefined;
  player: PlaybackPlan['player'];
  warnings: string[];
};

/** Returns a READY plan, or null when our HLS cannot be served (caller falls back to the provider asset). */
export async function buildSelfHlsPlan(args: SelfHlsPlanArgs): Promise<PlaybackPlan | null> {
  const { ctx, videoId, asset } = args;
  const secret = SelfHlsTokenService.secret();
  const version = parseSelfHlsObjectKey(asset.objectKey, videoId);
  if (!secret || !version) {
    console.error('[PLAYBACK_SERVICE] SELF_HLS asset unusable (secret or object key)', { videoId, hasSecret: Boolean(secret), keyOk: Boolean(version) });
    return null;
  }

  const signed = SelfHlsTokenService.sign({ videoId, version, secret }, SelfHlsTokenService.baseUrl());
  const fallbackAsset = pickFallbackAsset((args.assets ?? []).filter((a) => a.id !== asset.id));
  const fallback = resolveFallbackSource(fallbackAsset, args.tier);
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
      needsProxy: false,
      isExternalEmbed: false,
      isSignedUrl: true,
      expiresAt: signed.expiresAt.toISOString(),
      asset: args.safeAsset,
      ...(fallback ? { fallback } : {}),
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

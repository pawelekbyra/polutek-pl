import { CloudflareSignedPlaybackTokenService } from './cloudflare-signed-playback-token.service';

export type CloudflarePlaybackResolution =
  | { ok: true; playbackUrl: string; embedUrl: string; expiresAt: string }
  | { ok: false; reason: string };

function encodeToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Cloudflare signed playback token missing');
  return encodeURIComponent(trimmed);
}

export function resolveCloudflareStreamPlayback(providerId: string): CloudflarePlaybackResolution {
  if (!providerId) return { ok: false, reason: 'Cloudflare asset missing provider identifiers' };

  if (!CloudflareSignedPlaybackTokenService.isConfigured()) {
    return { ok: false, reason: 'Cloudflare Stream signing is not configured' };
  }

  const signedPlayback = CloudflareSignedPlaybackTokenService.createSignedPlaybackToken({ videoUid: providerId });
  const encoded = encodeToken(signedPlayback.token);

  return {
    ok: true,
    playbackUrl: `https://videodelivery.net/${encoded}/manifest/video.m3u8`,
    embedUrl: `https://iframe.videodelivery.net/${encoded}`,
    expiresAt: signedPlayback.expiresAt.toISOString(),
  };
}

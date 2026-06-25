import { resolvePlaybackSource } from './playback-source';

export type CloudflarePlaybackMode = 'iframe' | 'hls' | 'dash';

export type CloudflarePlaybackSource = {
    mode: CloudflarePlaybackMode;
    src: string;
    reason?: string;
};

type CloudflarePlaybackInput = {
    playbackUrl?: string | null;
    embedUrl?: string | null;
};

export function resolveCloudflarePlaybackSource(input: CloudflarePlaybackInput): CloudflarePlaybackSource | null {
    const resolved = resolvePlaybackSource({
        kind: 'cloudflare_stream',
        playbackUrl: input.playbackUrl,
        embedUrl: input.embedUrl,
    });

    if (resolved.mode === 'custom-player') {
        const mode = resolved.src.toLowerCase().includes('.mpd') ? 'dash' : 'hls';
        return { mode, src: resolved.src };
    }

    if (resolved.mode === 'cloudflare-iframe-fallback') {
        return {
            mode: 'iframe',
            src: resolved.src,
            reason: resolved.reason === 'missing-playback-url'
                ? 'Cloudflare playback URL is not present; keep iframe fallback.'
                : 'Cloudflare playback URL is not a supported manifest; keep iframe fallback.',
        };
    }

    return null;
}

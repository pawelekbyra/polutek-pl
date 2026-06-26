import { resolvePlaybackSource } from './playback-source';

export type CloudflarePlaybackMode = 'hls' | 'dash';

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

    return null;
}

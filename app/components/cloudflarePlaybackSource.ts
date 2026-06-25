export type CloudflarePlaybackMode = 'iframe' | 'hls';

export type CloudflarePlaybackSource = {
    mode: CloudflarePlaybackMode;
    src: string;
    reason?: string;
};

type CloudflarePlaybackInput = {
    playbackUrl?: string | null;
    embedUrl?: string | null;
};

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function isHlsManifestUrl(value: string | null | undefined): value is string {
    if (!value || !isHttpUrl(value)) return false;

    try {
        const url = new URL(value);
        return url.pathname.toLowerCase().endsWith('.m3u8');
    } catch {
        return false;
    }
}

function firstPresentUrl(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) return trimmed;
    }

    return null;
}

export function resolveCloudflarePlaybackSource(input: CloudflarePlaybackInput): CloudflarePlaybackSource | null {
    const playbackUrl = input.playbackUrl?.trim() || null;
    const embedUrl = input.embedUrl?.trim() || null;

    if (isHlsManifestUrl(playbackUrl)) {
        return { mode: 'hls', src: playbackUrl };
    }

    if (isHlsManifestUrl(embedUrl)) {
        return { mode: 'hls', src: embedUrl };
    }

    // TODO(#1103): when backend playback plans expose a Cloudflare HLS manifest or another
    // owner-approved safe derivation input, resolve that here instead of using iframe fallback.
    const fallbackSrc = firstPresentUrl(embedUrl, playbackUrl);
    if (!fallbackSrc) return null;

    return {
        mode: 'iframe',
        src: fallbackSrc,
        reason: 'Cloudflare HLS manifest is not present; keep existing iframe fallback until backend exposes a safe manifest source.',
    };
}

export type PlaybackSourceInput = {
    kind?: string | null;
    playbackUrl?: string | null;
    embedUrl?: string | null;
};

export type ResolvedPlaybackSource =
    | {
        mode: 'custom-player';
        kind: string;
        src: string;
        embedFallbackUrl?: string;
    }
    | {
        mode: 'embed';
        provider: 'youtube' | 'vimeo';
        src: string;
    }
    | {
        mode: 'cloudflare-iframe-fallback';
        src: string;
        reason: 'missing-playback-url' | 'unsupported-manifest';
    }
    | {
        mode: 'unavailable';
        reason: string;
    };

const CUSTOM_PLAYER_KINDS = new Set(['hls', 'dash', 'mp4', 'direct', 'vercel_blob', 'blob']);
const EMBED_PROVIDER_KINDS = new Set(['youtube', 'vimeo']);

function normalizeKind(kind: string | null | undefined): string {
    return String(kind || '').trim().toLowerCase();
}

function firstPresentUrl(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) return trimmed;
    }

    return null;
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function hasManifestExtension(value: string, extensions: string[]): boolean {
    if (!isHttpUrl(value)) return false;

    try {
        const url = new URL(value);
        const pathname = url.pathname.toLowerCase();
        return extensions.some((extension) => pathname.endsWith(extension));
    } catch {
        return false;
    }
}

export function isHlsManifestUrl(value: string | null | undefined): value is string {
    return Boolean(value && hasManifestExtension(value, ['.m3u8']));
}

export function isDashManifestUrl(value: string | null | undefined): value is string {
    return Boolean(value && hasManifestExtension(value, ['.mpd']));
}

function isSupportedManifestUrl(value: string | null | undefined): value is string {
    return isHlsManifestUrl(value) || isDashManifestUrl(value);
}

export function resolvePlaybackSource(input: PlaybackSourceInput): ResolvedPlaybackSource {
    const kind = normalizeKind(input.kind);
    const playbackUrl = input.playbackUrl?.trim() || null;
    const embedUrl = input.embedUrl?.trim() || null;

    if (EMBED_PROVIDER_KINDS.has(kind)) {
        const src = firstPresentUrl(embedUrl, playbackUrl);
        if (!src) return { mode: 'unavailable', reason: 'missing-embed-url' };

        return { mode: 'embed', provider: kind as 'youtube' | 'vimeo', src };
    }

    if (kind === 'cloudflare_stream') {
        if (isSupportedManifestUrl(playbackUrl)) {
            return {
                mode: 'custom-player',
                kind,
                src: playbackUrl,
                embedFallbackUrl: embedUrl || undefined,
            };
        }

        if (playbackUrl && isSupportedManifestUrl(embedUrl)) {
            return {
                mode: 'custom-player',
                kind,
                src: embedUrl,
                embedFallbackUrl: playbackUrl,
            };
        }

        const fallbackSrc = firstPresentUrl(embedUrl, playbackUrl);
        if (!fallbackSrc) return { mode: 'unavailable', reason: 'missing-cloudflare-source' };

        return {
            mode: 'cloudflare-iframe-fallback',
            src: fallbackSrc,
            reason: playbackUrl ? 'unsupported-manifest' : 'missing-playback-url',
        };
    }

    if (CUSTOM_PLAYER_KINDS.has(kind)) {
        if (!playbackUrl) return { mode: 'unavailable', reason: 'missing-playback-url' };

        return { mode: 'custom-player', kind, src: playbackUrl };
    }

    return { mode: 'unavailable', reason: kind ? 'unsupported-source-kind' : 'missing-source-kind' };
}

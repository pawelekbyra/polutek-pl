export type PlaybackSourceInput = {
    kind?: string | null;
    playbackUrl?: string | null;
};

export type ResolvedPlaybackSource =
    | {
        mode: 'custom-player';
        kind: string;
        src: string;
    }
    | {
        mode: 'unavailable';
        reason: string;
    };

/**
 * The only video source is our own HLS (kind "self_hls", CLAUDE.md 4.17): an https
 * .m3u8 master playlist. Anything else (embeds, other providers, raw files) is
 * never played, even if a plan carried it.
 */
const SELF_HLS_KIND = 'self_hls';

function normalizeKind(kind: string | null | undefined): string {
    return String(kind || '').trim().toLowerCase();
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

export function isHlsManifestUrl(value: string | null | undefined): value is string {
    if (!value || !isHttpUrl(value)) return false;
    try {
        return new URL(value).pathname.toLowerCase().endsWith('.m3u8');
    } catch {
        return false;
    }
}

export function resolvePlaybackSource(input: PlaybackSourceInput): ResolvedPlaybackSource {
    const kind = normalizeKind(input.kind);
    const playbackUrl = input.playbackUrl?.trim() || null;

    if (!kind) return { mode: 'unavailable', reason: 'missing-source-kind' };
    if (kind !== SELF_HLS_KIND) return { mode: 'unavailable', reason: 'unsupported-source-kind' };
    if (!playbackUrl) return { mode: 'unavailable', reason: 'missing-playback-url' };
    if (!isHlsManifestUrl(playbackUrl)) return { mode: 'unavailable', reason: 'unsupported-manifest' };

    return { mode: 'custom-player', kind, src: playbackUrl };
}

import { describe, expect, it } from 'vitest';
import { resolvePlaybackSource } from '@/app/components/playback-source';

describe('resolvePlaybackSource', () => {
    const masterUrl = 'https://video.pawelperfect.com/h/1790000000.sig/video-id-0001/v1/master.m3u8';

    it('plays only our own HLS master playlist through the custom player', () => {
        expect(resolvePlaybackSource({ kind: 'self_hls', playbackUrl: masterUrl })).toEqual({
            mode: 'custom-player',
            kind: 'self_hls',
            src: masterUrl,
        });
        expect(resolvePlaybackSource({ kind: 'SELF_HLS', playbackUrl: ` ${masterUrl} ` }).mode).toBe('custom-player');
    });

    it('refuses every other source kind, even with a playable-looking URL', () => {
        for (const kind of ['youtube', 'vimeo', 'cloudflare_stream', 'mux', 'hls', 'dash', 'mp4', 'direct', 'vercel_blob', 'blob']) {
            expect(resolvePlaybackSource({ kind, playbackUrl: masterUrl })).toEqual({
                mode: 'unavailable',
                reason: 'unsupported-source-kind',
            });
        }
        expect(resolvePlaybackSource({ kind: null, playbackUrl: masterUrl })).toEqual({ mode: 'unavailable', reason: 'missing-source-kind' });
    });

    it('is unavailable without a URL or with something that is not an HLS manifest', () => {
        expect(resolvePlaybackSource({ kind: 'self_hls', playbackUrl: '' })).toEqual({ mode: 'unavailable', reason: 'missing-playback-url' });
        expect(resolvePlaybackSource({ kind: 'self_hls', playbackUrl: 'https://video.pawelperfect.com/clip.mp4' })).toEqual({ mode: 'unavailable', reason: 'unsupported-manifest' });
        expect(resolvePlaybackSource({ kind: 'self_hls', playbackUrl: 'javascript:alert(1)//master.m3u8' }).mode).toBe('unavailable');
    });
});

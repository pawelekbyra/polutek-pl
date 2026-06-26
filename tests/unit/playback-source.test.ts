import { describe, expect, it } from 'vitest';
import { resolvePlaybackSource } from '@/app/components/playback-source';

describe('resolvePlaybackSource', () => {
    it('keeps YouTube and Vimeo on the embed path', () => {
        expect(resolvePlaybackSource({
            kind: 'youtube',
            playbackUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        })).toEqual({
            mode: 'embed',
            provider: 'youtube',
            src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        });

        expect(resolvePlaybackSource({
            kind: 'vimeo',
            playbackUrl: 'https://vimeo.com/123',
            embedUrl: 'https://player.vimeo.com/video/123',
        })).toEqual({
            mode: 'embed',
            provider: 'vimeo',
            src: 'https://player.vimeo.com/video/123',
        });
    });

    it('routes Cloudflare Stream HLS and DASH manifests through the custom player', () => {
        expect(resolvePlaybackSource({
            kind: 'cloudflare_stream',
            playbackUrl: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        })).toEqual({
            mode: 'custom-player',
            kind: 'cloudflare_stream',
            src: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
        });

        expect(resolvePlaybackSource({
            kind: 'cloudflare_stream',
            playbackUrl: 'https://videodelivery.net/playback-id/manifest/video.mpd',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        })?.mode).toBe('custom-player');

        expect(resolvePlaybackSource({
            kind: 'cloudflare_stream',
            playbackUrl: 'https://iframe.videodelivery.net/signed-token',
            embedUrl: 'https://videodelivery.net/backend-safe-manifest/manifest/video.m3u8',
        })).toEqual({
            mode: 'custom-player',
            kind: 'cloudflare_stream',
            src: 'https://videodelivery.net/backend-safe-manifest/manifest/video.m3u8',
        });
    });

    it('treats Cloudflare iframe URLs as unavailable when no safe manifest exists', () => {
        expect(resolvePlaybackSource({
            kind: 'cloudflare_stream',
            playbackUrl: 'https://iframe.videodelivery.net/signed-token',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        })).toEqual({
            mode: 'unavailable',
            reason: 'unsupported-cloudflare-manifest',
        });

        expect(resolvePlaybackSource({
            kind: 'cloudflare_stream',
            playbackUrl: '',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        })).toEqual({
            mode: 'unavailable',
            reason: 'missing-cloudflare-manifest',
        });
    });

    it('preserves existing custom-player handling for direct source kinds', () => {
        for (const kind of ['hls', 'dash', 'mp4', 'direct', 'vercel_blob', 'blob']) {
            expect(resolvePlaybackSource({ kind, playbackUrl: `/api/media/${kind}` })).toEqual({
                mode: 'custom-player',
                kind,
                src: `/api/media/${kind}`,
            });
        }
    });
});

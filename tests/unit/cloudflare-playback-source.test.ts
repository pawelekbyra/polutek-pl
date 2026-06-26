import { describe, expect, it } from 'vitest';
import { resolveCloudflarePlaybackSource } from '@/app/components/cloudflarePlaybackSource';

describe('resolveCloudflarePlaybackSource', () => {
    it('rejects Cloudflare iframe playback instead of returning a playable fallback', () => {
        const result = resolveCloudflarePlaybackSource({
            playbackUrl: 'https://iframe.videodelivery.net/signed-token',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(result).toBeNull();
    });

    it('selects manifest/custom-player mode only for a valid Cloudflare manifest source', () => {
        const result = resolveCloudflarePlaybackSource({
            playbackUrl: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(result).toEqual({
            mode: 'hls',
            src: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
        });
    });

    it('returns null when Cloudflare playback data is missing or unknown', () => {
        expect(resolveCloudflarePlaybackSource({ playbackUrl: '', embedUrl: '' })).toBeNull();

        const unknown = resolveCloudflarePlaybackSource({
            playbackUrl: 'not-a-safe-hls-manifest',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(unknown).toBeNull();
    });
});

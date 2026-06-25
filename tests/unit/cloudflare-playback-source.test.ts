import { describe, expect, it } from 'vitest';
import { resolveCloudflarePlaybackSource } from '@/app/components/cloudflarePlaybackSource';

describe('resolveCloudflarePlaybackSource', () => {
    it('keeps existing Cloudflare iframe playback supported as fallback', () => {
        const result = resolveCloudflarePlaybackSource({
            playbackUrl: 'https://iframe.videodelivery.net/signed-token',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(result).toEqual({
            mode: 'iframe',
            src: 'https://iframe.videodelivery.net/signed-token',
            reason: expect.stringContaining('Cloudflare HLS manifest is not present'),
        });
    });

    it('selects HLS/custom-player mode only for a valid HLS manifest source', () => {
        const result = resolveCloudflarePlaybackSource({
            playbackUrl: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(result).toEqual({
            mode: 'hls',
            src: 'https://videodelivery.net/playback-id/manifest/video.m3u8',
        });
    });

    it('falls back safely to iframe when Cloudflare playback data is missing or unknown', () => {
        expect(resolveCloudflarePlaybackSource({ playbackUrl: '', embedUrl: '' })).toBeNull();

        const unknown = resolveCloudflarePlaybackSource({
            playbackUrl: 'not-a-safe-hls-manifest',
            embedUrl: 'https://iframe.videodelivery.net/signed-token',
        });

        expect(unknown?.mode).toBe('iframe');
        expect(unknown?.src).toBe('https://iframe.videodelivery.net/signed-token');
    });
});

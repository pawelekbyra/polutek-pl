import { describe, it, expect } from 'vitest';
import {
    isAllowedVideoSourceUrl,
    isAllowedThumbnailUrl,
    isBlockedPrivateHostname,
    isHlsManifest,
    isDashManifest
} from '@/lib/modules/media';

describe('Media Module Validation', () => {
    const mockEnv = {
        ALLOWED_MEDIA_HOSTS: 'cdn.example.com,media.polutek.pl'
    };

    describe('isAllowedVideoSourceUrl', () => {
        it('allows YouTube and Vimeo', () => {
            expect(isAllowedVideoSourceUrl('https://www.youtube.com/watch?v=123')).toBe(true);
            expect(isAllowedVideoSourceUrl('https://vimeo.com/123456')).toBe(true);
        });

        it('allows configured media hosts', () => {
            expect(isAllowedVideoSourceUrl('https://cdn.example.com/video.mp4', mockEnv)).toBe(true);
        });

        it('blocks unconfigured hosts', () => {
            expect(isAllowedVideoSourceUrl('https://evil.com/video.mp4', mockEnv)).toBe(false);
        });

        it('blocks private IP hostnames', () => {
            expect(isAllowedVideoSourceUrl('https://192.168.1.1/video.mp4')).toBe(false);
            expect(isAllowedVideoSourceUrl('https://localhost/video.mp4')).toBe(false);
        });
    });

    describe('isBlockedPrivateHostname', () => {
        it('detects private IPv4', () => {
            expect(isBlockedPrivateHostname('127.0.0.1')).toBe(true);
            expect(isBlockedPrivateHostname('10.0.0.1')).toBe(true);
            expect(isBlockedPrivateHostname('172.16.0.1')).toBe(true);
            expect(isBlockedPrivateHostname('192.168.0.1')).toBe(true);
        });

        it('detects localhost', () => {
            expect(isBlockedPrivateHostname('localhost')).toBe(true);
            expect(isBlockedPrivateHostname('my.localhost')).toBe(true);
        });
    });

    describe('Detection helpers', () => {
        it('identifies manifests', () => {
            expect(isHlsManifest('https://example.com/playlist.m3u8')).toBe(true);
            expect(isDashManifest('https://example.com/stream.mpd')).toBe(true);
        });
    });
});

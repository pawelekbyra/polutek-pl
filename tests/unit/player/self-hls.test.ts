import { describe, expect, it, vi } from 'vitest';
import Hls from 'hls.js';
import {
  HLS_AUTH_RETRIES,
  buildSelfHlsConfig,
  connectionStartEstimate,
  streamIdentity,
  withCurrentToken,
} from '@/app/components/player/self-hls';

const ORIGIN = 'https://video.pawelperfect.com';
const VIDEO = 'c52f0407-b0e8-4b5c-b6d3-a9f152653002';
const OLD = `${ORIGIN}/h/1800000000.${'a'.repeat(43)}/${VIDEO}/v1/master.m3u8`;
const NEW = `${ORIGIN}/h/1800021600.${'b'.repeat(43)}/${VIDEO}/v1/master.m3u8`;

describe('own HLS player helpers', () => {
  it('identifies a stream without its token', () => {
    expect(streamIdentity(OLD)).toBe(`${ORIGIN}/${VIDEO}/v1`);
    expect(streamIdentity(OLD)).toBe(streamIdentity(NEW));
    expect(streamIdentity(NEW.replace('/v1/', '/v2/'))).not.toBe(streamIdentity(OLD));
    expect(streamIdentity(undefined)).toBeNull();
  });

  it('rewrites every request of the same stream to the newest token, and nothing else', () => {
    const seg = OLD.replace('master.m3u8', '720p/seg_00003.m4s');
    expect(withCurrentToken(seg, NEW)).toBe(NEW.replace('master.m3u8', '720p/seg_00003.m4s'));
    // another version, another video, another host: untouched
    expect(withCurrentToken(seg, NEW.replace('/v1/', '/v2/'))).toBe(seg);
    expect(withCurrentToken(seg, NEW.replace(VIDEO, 'other-video-id-1234'))).toBe(seg);
    expect(withCurrentToken(seg, NEW.replace(ORIGIN, 'https://evil.example'))).toBe(seg);
    expect(withCurrentToken('https://subs.example/pl.vtt', NEW)).toBe('https://subs.example/pl.vtt');
    expect(withCurrentToken(seg, null)).toBe(seg);
  });

  it('starts from the browser bandwidth estimate when there is one', () => {
    expect(connectionStartEstimate(undefined)).toBeUndefined();
    expect(connectionStartEstimate({ downlink: 5 })).toBe(4_000_000);
    expect(connectionStartEstimate({ downlink: 50 })).toBe(8_000_000);
    expect(connectionStartEstimate({ saveData: true, downlink: 10 })).toBe(250_000);
    expect(connectionStartEstimate({ effectiveType: '2g' })).toBe(250_000);
    expect(connectionStartEstimate({ downlink: 0 })).toBeUndefined();
  });

  const config = (over: Partial<Parameters<typeof buildSelfHlsConfig>[0]> = {}) => {
    const onAuthError = vi.fn();
    const ensureFreshToken = vi.fn(async () => undefined);
    const cfg = buildSelfHlsConfig({
      defaults: Hls.DefaultConfig,
      currentMasterUrl: () => NEW,
      ensureFreshToken,
      onAuthError,
      ...over,
    });
    return { cfg, onAuthError, ensureFreshToken };
  };

  it('does no bandwidth test download; starts at the first variant without an estimate', () => {
    const { cfg } = config();
    expect(cfg.testBandwidth).toBe(false);
    expect(cfg.startLevel).toBeUndefined(); // hls.js then starts with the master's first variant
    expect(cfg.startFragPrefetch).toBe(true);
    const withEstimate = config({ connection: { downlink: 2 } }).cfg;
    expect(withEstimate).toMatchObject({ startLevel: -1, abrEwmaDefaultEstimate: 1_600_000 });
  });

  it('opens each request with the newest token, after making sure the token is fresh', async () => {
    const { cfg, ensureFreshToken } = config();
    const xhr = { open: vi.fn() } as unknown as XMLHttpRequest;
    await cfg.xhrSetup!(xhr, OLD.replace('master.m3u8', '540p/index.m3u8'), {} as never);
    expect(ensureFreshToken).toHaveBeenCalled();
    expect(xhr.open).toHaveBeenCalledWith('GET', NEW.replace('master.m3u8', '540p/index.m3u8'), true);
  });

  it('renews and retries a request the edge refused (403), a few times only', () => {
    const { cfg, onAuthError } = config();
    const retry = cfg.fragLoadPolicy!.default.errorRetry!.shouldRetry!;
    const policy = cfg.fragLoadPolicy!.default.errorRetry!;
    expect(retry(policy, 0, false, { code: 403, text: '' } as never, false)).toBe(true);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(retry(policy, HLS_AUTH_RETRIES, false, { code: 403, text: '' } as never, false)).toBe(false);
    // other errors keep hls.js's own decision and limit
    const normalMax = Hls.DefaultConfig.fragLoadPolicy.default.errorRetry!.maxNumRetry;
    expect(retry(policy, 0, false, { code: 500, text: '' } as never, true)).toBe(true);
    expect(retry(policy, normalMax, false, { code: 500, text: '' } as never, true)).toBe(false);
    expect(retry(policy, 0, false, { code: 404, text: '' } as never, false)).toBe(false);
    // the manifest and playlists are covered too
    expect(cfg.manifestLoadPolicy!.default.errorRetry!.shouldRetry).toBeTypeOf('function');
    expect(cfg.playlistLoadPolicy!.default.errorRetry!.shouldRetry).toBeTypeOf('function');
  });
});

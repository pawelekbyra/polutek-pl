import { describe, expect, it } from 'vitest';
import {
  avcCodecString,
  buildMasterPlaylist,
  buildRungArgs,
  chooseFrameRate,
  DEFAULTS,
  measureBitrates,
  parseLoudnormJson,
  parseMediaPlaylist,
  planLadder,
} from '@/scripts/hls/encode-hls.mjs';

describe('encode-hls', () => {
  it('never upscales and keeps even sizes', () => {
    expect(planLadder(1280, 720).map((r: { name: string }) => r.name)).toEqual(['720p', '540p', '360p']);
    expect(planLadder(1920, 1080).map((r: { name: string }) => r.name)).toEqual(['1080p', '720p', '540p', '360p']);
    const tiny = planLadder(320, 240);
    expect(tiny).toHaveLength(1);
    expect(tiny[0].height).toBe(240);
    expect(planLadder(1000, 563)[0].width % 2).toBe(0);
  });

  it('keeps 24 fps at 24 and NTSC rates exact', () => {
    expect(chooseFrameRate('24/1')).toBe(24);
    expect(chooseFrameRate('24000/1001')).toBe(23.976);
    expect(chooseFrameRate('30000/1001')).toBe(29.97);
    expect(chooseFrameRate('120/1')).toBe(60);
    expect(chooseFrameRate('0/0')).toBe(30);
    expect(chooseFrameRate('29.4/1')).toBe(29.97);
  });

  it('builds the avc1 CODECS string', () => {
    expect(avcCodecString('High', 40)).toBe('avc1.640028');
    expect(avcCodecString('Main', 31)).toBe('avc1.4d001f');
    expect(() => avcCodecString('Weird', 31)).toThrow();
  });

  it('measures peak and average bitrate', () => {
    const r = measureBitrates([
      { duration: 6, bytes: 600000 },
      { duration: 4, bytes: 200000 },
    ]);
    expect(r.peak).toBeCloseTo(800000);
    expect(r.average).toBeCloseTo(640000);
  });

  it('writes a master with the default variant first and FRAME-RATE', () => {
    const variants = [
      { uri: '360p/index.m3u8', bandwidth: 800000, averageBandwidth: 700000, width: 640, height: 360, frameRate: 24, codecs: 'avc1.64001e,mp4a.40.2' },
      { uri: '720p/index.m3u8', bandwidth: 4000000, averageBandwidth: 3000000, width: 1280, height: 720, frameRate: 24, codecs: 'avc1.640028,mp4a.40.2' },
      { uri: '540p/index.m3u8', bandwidth: 2200000, averageBandwidth: 2000000, width: 960, height: 540, frameRate: 24, codecs: 'avc1.64001f,mp4a.40.2' },
    ];
    const text = buildMasterPlaylist(variants, 2000);
    const uris = text.split('\n').filter((l: string) => l.endsWith('.m3u8'));
    expect(uris).toEqual(['540p/index.m3u8', '720p/index.m3u8', '360p/index.m3u8']);
    expect(text).toContain('FRAME-RATE=24.000');
    expect(text).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    expect(() => buildMasterPlaylist([])).toThrow();
  });

  it('parses a media playlist', () => {
    const p = parseMediaPlaylist('#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\na.m4s\n#EXTINF:4.0,\nb.m4s\n#EXT-X-ENDLIST\n');
    expect(p.initUri).toBe('init.mp4');
    expect(p.isVod && p.ended).toBe(true);
    expect(p.segments).toEqual([{ uri: 'a.m4s', duration: 6 }, { uri: 'b.m4s', duration: 4 }]);
  });

  it('parses loudnorm output and rejects garbage', () => {
    const j = parseLoudnormJson('noise\n{"input_i":"-19.8","input_tp":"-3.4","input_lra":"4.9","input_thresh":"-30.8","target_offset":"-1.4"}');
    expect(j.input_i).toBe(-19.8);
    expect(() => parseLoudnormJson('nothing')).toThrow();
  });

  it('puts keyframes every 2 s with closed GOP and fMP4 output', () => {
    const [rung] = planLadder(1280, 720);
    const args = buildRungArgs({ input: 'in.mp4', rung, frameRate: 24, interlaced: false, hasAudio: true, loudness: null, opts: DEFAULTS, outDir: 'o' }) as string[];
    const joined = args.join(' ');
    expect(joined).toContain('-g 48');
    expect(joined).toContain('open-gop=0');
    expect(joined).toContain('-hls_segment_type fmp4');
    expect(joined).toContain('-sc_threshold 0');
  });
});

import { describe, expect, it } from 'vitest';
import {
  avcCodecString,
  buildEncodeArgs,
  buildMasterPlaylist,
  chooseFrameRate,
  DEFAULTS,
  durationMatches,
  h264Level,
  measureBitrates,
  parseLoudnormJson,
  parseMediaPlaylist,
  planLadder,
  posterTimeSeconds,
  rungFrameRate,
  toneMapFilter,
} from '@/scripts/hls/encode-hls.mjs';

describe('encode-hls', () => {
  type Rung = { name: string; width: number; height: number; crf: number; maxFps?: number };
  const sizes = (ladder: Rung[]) => ladder.map((r) => `${r.width}x${r.height}`);

  it('never upscales, keeps even sizes and adds a low rung for weak links', () => {
    expect(planLadder(1280, 720).map((r: Rung) => r.name)).toEqual(['720p', '540p', '360p', '234p']);
    expect(sizes(planLadder(1920, 1080))).toEqual(['1920x1080', '1280x720', '960x540', '640x360', '416x234']);
    // A 720p source uses the 720p settings for its top rung, not the 1080p ones.
    expect(planLadder(1280, 720)[0].crf).toBe(22);
    const tiny = planLadder(320, 240);
    expect(sizes(tiny)).toEqual(['320x240']);
    const odd = planLadder(1000, 563)[0];
    expect(odd.width % 2 + odd.height % 2).toBe(0);
    expect(odd.height).toBeLessThanOrEqual(563);
  });

  it('fits portrait and ultrawide sources into the rung boxes (no lost resolution)', () => {
    const portrait = planLadder(1080, 1920);
    expect(sizes(portrait)).toEqual(['1080x1920', '720x1280', '540x960', '360x640', '234x416']);
    expect(portrait[0].name).toBe('1080p');
    expect(sizes(planLadder(1920, 804))[0]).toBe('1920x804');
    // A rung barely smaller than the one above is skipped (1366x768 -> no separate 1280x720).
    expect(sizes(planLadder(1366, 768)).slice(0, 2)).toEqual(['1366x768', '960x538']);
  });

  it('keeps small rungs at <= 30 fps and picks the H.264 level the frame rate needs', () => {
    expect(rungFrameRate(60, 30)).toBe(30);
    expect(rungFrameRate(59.94, 30)).toBe(29.97);
    expect(rungFrameRate(50, 30)).toBe(25);
    expect(rungFrameRate(25, 30)).toBe(25);
    expect(rungFrameRate(60, undefined)).toBe(60);
    expect(h264Level(1920, 1080, 30)).toBe('4.0');
    expect(h264Level(1920, 1080, 60)).toBe('4.2');
    expect(h264Level(1080, 1920, 30)).toBe('4.0');
    expect(h264Level(640, 360, 30)).toBe('3.0');
    expect(h264Level(3840, 2160, 30)).toBe('5.1');
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
    expect(j?.input_i).toBe(-19.8);
    expect(() => parseLoudnormJson('nothing')).toThrow();
  });

  it('treats a digitally silent audio track as "nothing to normalise" instead of failing', () => {
    const silent = parseLoudnormJson('{"input_i":"-inf","input_tp":"-inf","input_lra":"0.00","input_thresh":"-70.00","target_offset":"inf"}');
    expect(silent).toBeNull();
  });

  const encodeArgs = (over: Record<string, unknown> = {}) =>
    buildEncodeArgs({
      input: 'in.mp4', ladder: planLadder(1920, 1080), frameRate: 60, interlaced: false,
      color: { transfer: 'bt709', primaries: 'bt709', matrix: 'bt709' }, hasAudio: true, loudness: null,
      opts: DEFAULTS, outDir: 'o', ...over,
    }) as string[];

  it('decodes once and splits into every rung in one ffmpeg process', () => {
    const args = encodeArgs();
    expect(args.filter((a) => a === '-i')).toHaveLength(1);
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[0:v:0]fps=60,split=5[s0][s1][s2][s3][s4]');
    expect(graph).toContain('asplit=5[a0][a1][a2][a3][a4]');
    expect(graph).toContain('[s4]fps=30,scale=416:234:flags=lanczos,setsar=1,format=yuv420p[v4]');
    expect(graph).not.toContain('zscale');
    expect(args.filter((a) => a.endsWith('index.m3u8'))).toHaveLength(5);
    expect(args.filter((a) => a === '-hls_segment_type')).toHaveLength(5);
  });

  it('puts an IDR every 2 s in every rung (GOP in frames of that rung), closed GOP, fMP4', () => {
    const joined = encodeArgs().join(' ');
    expect(joined).toContain('-level 4.2 -crf 21 -maxrate 7800k -bufsize 15600k -g 120 -keyint_min 120');
    expect(joined).toContain('-g 60 -keyint_min 60'); // 30 fps small rungs: still 2 s
    expect(joined.match(/-force_key_frames expr:gte\(t,n_forced\*2\)/g)).toHaveLength(5);
    expect(joined).toContain('open-gop=0:scenecut=0');
    expect(joined).toContain('-sc_threshold 0');
    expect(joined).toContain('-hls_segment_type fmp4');
  });

  it('tone-maps HLG / PQ sources to BT.709 SDR once, at the top rung size, and tags the output', () => {
    const hlg = encodeArgs({ color: { transfer: 'arib-std-b67', primaries: 'bt2020', matrix: 'bt2020nc' } });
    const graph = hlg[hlg.indexOf('-filter_complex') + 1];
    expect(graph.match(/tonemap=tonemap=/g)).toHaveLength(1);
    expect(graph).toContain('zscale=w=1920:h=1080:f=lanczos:tin=arib-std-b67:pin=2020:min=2020_ncl:t=linear:npl=100');
    expect(graph).toContain('tonemap=tonemap=hable:desat=0,zscale=t=709:m=709:r=limited,format=yuv420p');
    expect(hlg.join(' ')).toContain('-color_primaries bt709 -color_trc bt709 -colorspace bt709');
    expect(toneMapFilter({ transfer: 'smpte2084', primaries: null, matrix: null }, 1280, 720)).toContain('zscale=w=1280:h=720:f=lanczos:tin=smpte2084:t=linear');
    expect(encodeArgs().join(' ')).not.toContain('-color_trc');
  });

  it('works without audio (no audio graph, no audio maps)', () => {
    const args = encodeArgs({ hasAudio: false });
    expect(args[args.indexOf('-filter_complex') + 1]).not.toContain('asplit');
    expect(args).not.toContain('-c:a');
  });

  it('declares CLOSED-CAPTIONS=NONE on every variant', () => {
    const text = buildMasterPlaylist([
      { uri: '360p/index.m3u8', bandwidth: 800000, averageBandwidth: 700000, width: 640, height: 360, frameRate: 30, codecs: 'avc1.64001e' },
    ]);
    expect(text).toContain('CLOSED-CAPTIONS=NONE');
  });

  it('accepts the encoded length when it matches the video stream or the container', () => {
    expect(durationMatches(30.0, [30.02, 31.5])).toBe(true);
    expect(durationMatches(31.4, [30.02, 31.5])).toBe(true);
    expect(durationMatches(29.0, [30.02, 31.5])).toBe(false);
  });

  it('takes the poster 10 % in, never past the end', () => {
    expect(posterTimeSeconds(100)).toBe(10);
    expect(posterTimeSeconds(2)).toBeCloseTo(0.2);
    expect(posterTimeSeconds(0.3)).toBe(0);
    expect(posterTimeSeconds(Number.NaN)).toBe(0);
  });
});

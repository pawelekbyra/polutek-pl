/**
 * Real encodes with ffmpeg on short synthetic clips (lavfi): landscape with audio, portrait
 * 60 fps without audio, and an HLG-tagged (HDR) clip that must be tone-mapped, not rejected.
 *
 * Runs when ffmpeg/ffprobe are on PATH; the CI job "encode-smoke" installs them and sets
 * ENCODE_SMOKE=1, which turns a missing ffmpeg into a failure instead of a skip.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { encodeHls, probeSource } from '@/scripts/hls/encode-hls.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const required = process.env.ENCODE_SMOKE === '1';

if (required && !hasFfmpeg) throw new Error('ENCODE_SMOKE=1 but ffmpeg/ffprobe are not on PATH');

// HDR tone mapping needs zimg's zscale and ffmpeg's tonemap filter; distro/minimal ffmpeg builds may lack them.
const hasToneMapFilters =
  hasFfmpeg &&
  (() => {
    const filters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout ?? '';
    return /\bzscale\b/.test(filters) && /\btonemap\b/.test(filters);
  })();

if (required && hasFfmpeg && !hasToneMapFilters) {
  throw new Error('ENCODE_SMOKE=1 but this ffmpeg has no zscale/tonemap filters (needed for HDR tone mapping)');
}
if (hasFfmpeg && !hasToneMapFilters) {
  console.warn('[encode-hls.ffmpeg] skipping the HLG tone-mapping test: this ffmpeg build has no zscale/tonemap filters');
}

const work = hasFfmpeg ? mkdtempSync(path.join(tmpdir(), 'encode-hls-')) : '';
afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

function makeClip(name: string, args: string[]): string {
  const file = path.join(work, name);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, file]);
  return file;
}

function probeStream(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', file], { encoding: 'utf8' });
  return JSON.parse(out).streams.find((s: { codec_type: string }) => s.codec_type === 'video');
}

const FAST = { preset: 'ultrafast', nice: 0 };

describe.skipIf(!hasFfmpeg)('encode-hls with real ffmpeg', () => {
  it('encodes a landscape clip with audio into a valid, aligned ladder with a poster', async () => {
    const src = makeClip('landscape.mp4', [
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=7',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=7',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    ]);
    const out = path.join(work, 'landscape');
    const { meta, issues } = await encodeHls({ input: src, out, opts: FAST });
    expect(issues).toEqual([]);
    const master = readFileSync(path.join(out, 'master.m3u8'), 'utf8');
    for (const rung of ['720p', '540p', '360p', '234p']) expect(master).toContain(`${rung}/index.m3u8`);
    expect(master).toContain('CLOSED-CAPTIONS=NONE');
    expect(master).toContain('mp4a.40.2');
    expect(statSync(path.join(out, 'poster.jpg')).size).toBeGreaterThan(1000);
    expect((meta as { rungs: unknown[] }).rungs).toHaveLength(4);
  }, 180_000);

  it('keeps the full width of a portrait 60 fps clip and halves the frame rate of small rungs', async () => {
    const src = makeClip('portrait.mp4', [
      '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=60:duration=7',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    ]);
    const out = path.join(work, 'portrait');
    const { issues } = await encodeHls({ input: src, out, opts: FAST });
    expect(issues).toEqual([]);
    const top = probeStream(path.join(out, '720p', 'index.m3u8'));
    expect([top.width, top.height]).toEqual([720, 1280]);
    const master = readFileSync(path.join(out, 'master.m3u8'), 'utf8');
    expect(master).toMatch(/RESOLUTION=720x1280,FRAME-RATE=60\.000/);
    expect(master).toMatch(/RESOLUTION=234x416,FRAME-RATE=30\.000/);
    expect(master).not.toContain('mp4a');
  }, 180_000);

  it.skipIf(!hasToneMapFilters)('tone-maps an HLG (HDR) source to BT.709 SDR instead of rejecting it', async () => {
    const src = makeClip('hlg.mp4', [
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25:duration=3',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc',
    ]);
    expect((await probeSource(src)).hdr).toBe(true);
    const out = path.join(work, 'hlg');
    const { issues } = await encodeHls({ input: src, out, opts: FAST });
    expect(issues).toEqual([]);
    const top = probeStream(path.join(out, '720p', 'index.m3u8'));
    expect(top.color_transfer).toBe('bt709');
    expect(top.color_primaries).toBe('bt709');
  }, 180_000);
});

/**
 * Own HLS encoder: one source file -> CMAF/fMP4 HLS ladder + master playlist + poster.
 *
 *   node scripts/hls/encode-hls.mjs --input src.mp4 --out ./out/v1 [options]
 *
 * Zero npm dependencies: only Node >= 18 and ffmpeg/ffprobe (>= 6) on PATH.
 * Designed to run on the serwerek VPS (2 vCPU) under `nice`; see
 * docs/operations/HLS-SELF-HOSTED.md and docs/research/serwerek/01-hls-encoding.md.
 *
 * Output layout (all playlist URIs are relative, so the player/CDN can serve
 * the folder from any prefix):
 *   master.m3u8
 *   540p/index.m3u8, 540p/init.mp4, 540p/seg_00001.m4s, ...
 *   poster.jpg
 *   meta.json            (what was encoded, timings, sizes, validation result)
 *
 * Choices (validated on the pilot, see the operations doc):
 *   - H.264 High, capped CRF per rung (maxrate/bufsize), 8-bit 4:2:0, SDR only.
 *   - IDR every 2 s (closed GOP, no scenecut), 6 s segments => every rung is cut
 *     at exactly the same timestamps (required for clean ABR switching).
 *   - Audio muxed into each rung (one language): AAC-LC 128k stereo 48 kHz,
 *     loudness normalised to -16 LUFS / -1 dBTP (two-pass loudnorm).
 *   - The ladder never upscales: only rungs <= the source height.
 *   - Master playlist is written by us from measured segment sizes (BANDWIDTH =
 *     peak segment bitrate, AVERAGE-BANDWIDTH, RESOLUTION, FRAME-RATE, CODECS read
 *     from the real SPS), because ffmpeg's own master omits FRAME-RATE.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Reference rungs (Apple HLS authoring table, capped CRF). */
export const LADDER_RUNGS = [
  { height: 1080, crf: 21, maxrateK: 7500, bufsizeK: 15000, level: '4.1' },
  { height: 720, crf: 22, maxrateK: 4500, bufsizeK: 9000, level: '4.0' },
  { height: 540, crf: 23, maxrateK: 3000, bufsizeK: 6000, level: '3.1' },
  { height: 360, crf: 23, maxrateK: 1100, bufsizeK: 2200, level: '3.0' },
];

export const DEFAULTS = {
  preset: 'slow',
  segmentSeconds: 6,
  keyframeSeconds: 2,
  targetLufs: -16,
  truePeak: -1,
  audioBitrateK: 128,
  nice: 10,
  defaultVariantKbps: 2000,
};

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/** Parses "24000/1001" or "30/1" or "25". Returns 0 when unusable. */
export function parseRational(value) {
  if (!value || typeof value !== 'string') return 0;
  const [a, b] = value.split('/');
  const num = Number(a);
  const den = b === undefined ? 1 : Number(b);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

/**
 * Constant frame rate used for every rung. VFR phone video is snapped to its
 * average rate; anything above 60 is halved; absurd values fall back to 30.
 */
export function chooseFrameRate(avgFrameRate) {
  let fps = parseRational(avgFrameRate);
  if (!fps || fps < 5) return 30;
  while (fps > 60) fps /= 2;
  const known = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  // An exact standard rate stays as is (24 must not become 23.976); VFR averages
  // that land near a standard rate are snapped to the nearest one.
  const exact = known.find((k) => Math.abs(k - fps) < 0.002);
  if (exact) return exact;
  const nearest = [...known].sort((a, b) => Math.abs(a - fps) - Math.abs(b - fps))[0];
  const hit = Math.abs(nearest - fps) / nearest < 0.02 ? nearest : undefined;
  return hit ?? Math.round(fps * 1000) / 1000;
}

/** Which rungs to encode for a source of the given size (never upscales). */
export function planLadder(sourceWidth, sourceHeight, rungs = LADDER_RUNGS) {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error('Source has no usable video size');
  let chosen = rungs.filter((r) => r.height <= sourceHeight + 2);
  if (chosen.length === 0) {
    // Tiny source: one rung at its own size, lowest rung settings.
    const lowest = rungs[rungs.length - 1];
    chosen = [{ ...lowest, height: even(sourceHeight) }];
  }
  return chosen.map((r) => ({
    ...r,
    name: `${r.height}p`,
    width: even((sourceWidth * r.height) / sourceHeight),
  }));
}

/** CODECS value for H.264 from ffprobe's profile name + numeric level (e.g. 41). */
export function avcCodecString(profileName, level) {
  const profileIdc = { Baseline: 66, 'Constrained Baseline': 66, Main: 77, Extended: 88, High: 100 }[profileName];
  if (!profileIdc) throw new Error(`Unsupported H.264 profile for CODECS: ${profileName}`);
  const constraint = profileName === 'Constrained Baseline' ? 0x40 : 0x00;
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `avc1.${hex(profileIdc)}${hex(constraint)}${hex(Number(level))}`;
}

/** Parses a media playlist into segment entries (EXTINF durations + URIs). */
export function parseMediaPlaylist(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const segments = [];
  let pendingDuration = null;
  let initUri = null;
  let targetDuration = null;
  let isVod = false;
  let ended = false;
  for (const line of lines) {
    if (line.startsWith('#EXT-X-TARGETDURATION:')) targetDuration = Number(line.split(':')[1]);
    else if (line.startsWith('#EXT-X-PLAYLIST-TYPE:VOD')) isVod = true;
    else if (line === '#EXT-X-ENDLIST') ended = true;
    else if (line.startsWith('#EXT-X-MAP:')) {
      const m = /URI="([^"]+)"/.exec(line);
      if (m) initUri = m[1];
    } else if (line.startsWith('#EXTINF:')) pendingDuration = Number(line.slice(8).split(',')[0]);
    else if (!line.startsWith('#') && pendingDuration !== null) {
      segments.push({ uri: line, duration: pendingDuration });
      pendingDuration = null;
    }
  }
  return { segments, initUri, targetDuration, isVod, ended };
}

/** Peak / average bitrate (bits per second) from segment sizes and durations. */
export function measureBitrates(segments) {
  let bytes = 0;
  let seconds = 0;
  let peak = 0;
  for (const s of segments) {
    if (!(s.duration > 0)) continue;
    bytes += s.bytes;
    seconds += s.duration;
    peak = Math.max(peak, (s.bytes * 8) / s.duration);
  }
  return { average: seconds > 0 ? (bytes * 8) / seconds : 0, peak };
}

/**
 * Master playlist. The variant closest to `defaultVariantKbps` is listed first
 * (Apple: the first variant is the default start), the others by descending
 * bandwidth.
 */
export function buildMasterPlaylist(variants, defaultVariantKbps = DEFAULTS.defaultVariantKbps) {
  if (variants.length === 0) throw new Error('No variants to list');
  const target = defaultVariantKbps * 1000;
  const first = [...variants].sort((a, b) => Math.abs(a.bandwidth - target) - Math.abs(b.bandwidth - target))[0];
  const rest = variants.filter((v) => v !== first).sort((a, b) => b.bandwidth - a.bandwidth);
  const out = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
  for (const v of [first, ...rest]) {
    out.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${Math.ceil(v.bandwidth)},AVERAGE-BANDWIDTH=${Math.ceil(v.averageBandwidth)},RESOLUTION=${v.width}x${v.height},FRAME-RATE=${v.frameRate.toFixed(3)},CODECS="${v.codecs}"`,
      v.uri,
    );
  }
  return out.join('\n') + '\n';
}

/** Extracts the loudnorm measurement JSON ffmpeg prints on stderr. */
export function parseLoudnormJson(stderr) {
  const start = stderr.lastIndexOf('{');
  const end = stderr.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('loudnorm did not print measurements');
  const raw = JSON.parse(stderr.slice(start, end + 1));
  // Digital silence (e.g. a silent audio track) measures as "-inf" LUFS: there is nothing to
  // normalise, so report "no measurement" instead of failing the whole encode.
  if (/^\s*-inf/i.test(String(raw.input_i))) return null;
  const num = (k) => {
    const v = Number(raw[k]);
    if (!Number.isFinite(v)) throw new Error(`loudnorm measurement ${k} is not finite`);
    return v;
  };
  return {
    input_i: num('input_i'),
    input_tp: num('input_tp'),
    input_lra: num('input_lra'),
    input_thresh: num('input_thresh'),
    target_offset: num('target_offset'),
  };
}

export function loudnormFilter(measured, opts) {
  const base = `loudnorm=I=${opts.targetLufs}:TP=${opts.truePeak}:LRA=11`;
  if (!measured) return `${base}:print_format=json`;
  return `${base}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`;
}

/** ffmpeg arguments for one rung (pure; tested). */
export function buildRungArgs({ input, rung, frameRate, interlaced, hasAudio, loudness, opts, outDir }) {
  const gop = Math.round(frameRate * opts.keyframeSeconds);
  const vf = [
    interlaced ? 'bwdif=mode=send_frame' : null,
    `fps=${frameRate}`,
    `scale=${rung.width}:${rung.height}:flags=lanczos`,
    'format=yuv420p',
  ].filter(Boolean).join(',');
  const args = ['-hide_banner', '-nostdin', '-y', '-i', input, '-map', '0:v:0'];
  if (hasAudio) args.push('-map', '0:a:0');
  args.push(
    '-vf', vf,
    '-c:v', 'libx264', '-preset', opts.preset, '-profile:v', 'high', '-level', rung.level,
    '-crf', String(rung.crf), '-maxrate', `${rung.maxrateK}k`, '-bufsize', `${rung.bufsizeK}k`,
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
    '-x264-params', 'open-gop=0:scenecut=0',
    '-force_key_frames', `expr:gte(t,n_forced*${opts.keyframeSeconds})`,
  );
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', `${opts.audioBitrateK}k`, '-ac', '2', '-ar', '48000');
    if (loudness) args.push('-af', loudnormFilter(loudness, opts));
  }
  args.push(
    '-f', 'hls', '-hls_time', String(opts.segmentSeconds), '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments',
    '-hls_fmp4_init_filename', 'init.mp4', '-hls_segment_filename', path.join(outDir, 'seg_%05d.m4s'),
    path.join(outDir, 'index.m3u8'),
  );
  return args;
}

/**
 * Runs a child process. Options: `niceLevel` (not on Windows), `signal` (AbortSignal: kills the
 * child and rejects with name "AbortError"), `onProgressSeconds` (ffmpeg only: called with the
 * encoded media seconds parsed from `-progress pipe:1`; stdout is then not buffered).
 */
function run(cmd, args, { niceLevel, signal, onProgressSeconds } = {}) {
  return new Promise((resolve, reject) => {
    const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
    if (signal?.aborted) return reject(abortError());
    const finalArgs = onProgressSeconds ? ['-progress', 'pipe:1', '-nostats', ...args] : args;
    const useNice = niceLevel && process.platform !== 'win32';
    const child = useNice ? spawn('nice', ['-n', String(niceLevel), cmd, ...finalArgs]) : spawn(cmd, finalArgs);
    let stdout = '';
    let stderr = '';
    let pending = '';
    let aborted = false;
    const onAbort = () => { aborted = true; child.kill('SIGKILL'); };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      if (!onProgressSeconds) { stdout += d; return; }
      pending += d;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const m = /^out_time_us=(\d+)$/.exec(line.trim());
        if (m) onProgressSeconds(Number(m[1]) / 1e6);
      }
    });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000); });
    child.on('error', (err) => { signal?.removeEventListener('abort', onAbort); reject(err); });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (aborted) reject(abortError());
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

export async function probeSource(input) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input]);
  const data = JSON.parse(stdout);
  const video = data.streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  if (!video) throw new Error('Source has no video stream');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const rotation = Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const rotated = Math.abs(rotation) % 180 === 90;
  const hdr = ['smpte2084', 'arib-std-b67'].includes(video.color_transfer);
  return {
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    avgFrameRate: video.avg_frame_rate,
    duration: Number(data.format.duration),
    interlaced: !['progressive', 'unknown', undefined].includes(video.field_order),
    hdr,
    hasAudio: Boolean(audio),
    pixFmt: video.pix_fmt,
    videoCodec: video.codec_name,
    sizeBytes: Number(data.format.size),
  };
}

async function measureLoudness(input, opts, runOpts = {}) {
  const { stderr } = await run('ffmpeg', [
    '-hide_banner', '-nostdin', '-i', input, '-map', '0:a:0', '-af', loudnormFilter(null, opts), '-f', 'null', '-',
  ], { niceLevel: opts.nice, ...runOpts });
  return parseLoudnormJson(stderr);
}

async function probeRung(rungDir) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', path.join(rungDir, 'index.m3u8')]);
  const v = JSON.parse(stdout).streams.find((s) => s.codec_type === 'video');
  return { profile: v.profile, level: v.level, width: v.width, height: v.height };
}

async function describeRung(rungDir) {
  const text = await readFile(path.join(rungDir, 'index.m3u8'), 'utf8');
  const parsed = parseMediaPlaylist(text);
  const segments = [];
  for (const s of parsed.segments) {
    const st = await stat(path.join(rungDir, s.uri));
    segments.push({ ...s, bytes: st.size });
  }
  return { ...parsed, segments };
}

/** First video frame of every segment must be a keyframe; returns offending files. */
async function checkSegmentsStartWithKeyframe(rungDir, parsed) {
  const bad = [];
  const init = await readFile(path.join(rungDir, parsed.initUri));
  for (const s of parsed.segments) {
    const data = await readFile(path.join(rungDir, s.uri));
    const tmp = path.join(rungDir, '.probe.mp4');
    await writeFile(tmp, Buffer.concat([init, data]));
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=flags', '-read_intervals', '%+#1', '-of', 'csv=p=0', tmp]);
    if (!stdout.trim().startsWith('K')) bad.push(s.uri);
    await rm(tmp, { force: true });
  }
  return bad;
}

/** Validates a finished output directory; returns a list of human readable issues. */
export async function validateOutput(outDir, sourceDuration) {
  const issues = [];
  const master = await readFile(path.join(outDir, 'master.m3u8'), 'utf8').catch(() => null);
  if (!master) return ['master.m3u8 is missing'];
  const refs = master.split('\n').filter((l) => l && !l.startsWith('#'));
  if (refs.length === 0) issues.push('master.m3u8 lists no variants');
  const segmentDurations = [];
  for (const ref of refs) {
    const rungDir = path.join(outDir, path.dirname(ref));
    let parsed;
    try {
      parsed = await describeRung(rungDir);
    } catch (err) {
      issues.push(`${ref}: cannot read (${err.message})`);
      continue;
    }
    if (!parsed.isVod || !parsed.ended) issues.push(`${ref}: not a closed VOD playlist`);
    if (!parsed.initUri) issues.push(`${ref}: no EXT-X-MAP init segment`);
    const total = parsed.segments.reduce((a, s) => a + s.duration, 0);
    if (Math.abs(total - sourceDuration) > 0.6) issues.push(`${ref}: duration ${total.toFixed(2)}s differs from source ${sourceDuration.toFixed(2)}s`);
    segmentDurations.push({ ref, durations: parsed.segments.map((s) => s.duration) });
    const bad = await checkSegmentsStartWithKeyframe(rungDir, parsed);
    if (bad.length) issues.push(`${ref}: segments not starting with a keyframe: ${bad.join(', ')}`);
  }
  const [head, ...others] = segmentDurations;
  for (const o of others) {
    const same = head.durations.length === o.durations.length && head.durations.every((d, i) => Math.abs(d - o.durations[i]) < 0.05);
    if (!same) issues.push(`segment boundaries differ between ${head.ref} and ${o.ref}`);
  }
  return issues;
}

export function parseArgs(argv) {
  const out = { opts: { ...DEFAULTS } };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--input') out.input = next();
    else if (a === '--out') out.out = next();
    else if (a === '--preset') out.opts.preset = next();
    else if (a === '--segment') out.opts.segmentSeconds = Number(next());
    else if (a === '--keyframe') out.opts.keyframeSeconds = Number(next());
    else if (a === '--lufs') out.opts.targetLufs = Number(next());
    else if (a === '--nice') out.opts.nice = Number(next());
    else if (a === '--max-height') out.maxHeight = Number(next());
    else if (a === '--no-loudnorm') out.noLoudnorm = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

const HELP = `Usage: node encode-hls.mjs --input <file> --out <dir> [--preset slow] [--segment 6] [--keyframe 2]
       [--lufs -16] [--no-loudnorm] [--max-height 1080] [--nice 10] [--dry-run]`;

/** Relative CPU cost of each step, used to turn per-step progress into one 0..1 fraction. */
export function stepWeights(ladder, hasLoudness) {
  const rungWeights = ladder.map((r) => r.height * r.height);
  return hasLoudness ? [rungWeights[0] * 0.1, ...rungWeights] : rungWeights;
}

/**
 * Encodes `input` into `out` (see the header). Library entry point used by the CLI below and by
 * the video worker (lib/modules/video-pipeline). Throws on bad input (HDR, no video); returns
 * `{ meta, issues }` where non-empty `issues` means the output failed validation and must not
 * be published. `meta` is null for a dry run.
 *
 * options: { input, out, opts?, maxHeight?, noLoudnorm?, dryRun?, signal?, log?,
 *   onProgress?: ({ step: 'loudness'|'rung', name, stepIndex, stepCount, fraction, overall }) }
 */
export async function encodeHls(options) {
  const { input, out, maxHeight, noLoudnorm, dryRun, signal, onProgress } = options;
  const log = options.log ?? (() => {});
  const opts = { ...DEFAULTS, ...(options.opts ?? {}) };
  const t0 = Date.now();
  const info = await probeSource(input);
  if (info.hdr) throw new Error('HDR sources are not supported yet (SDR output only); tone-map first.');
  const frameRate = chooseFrameRate(info.avgFrameRate);
  let ladder = planLadder(info.width, info.height);
  if (maxHeight) ladder = ladder.filter((r) => r.height <= maxHeight);
  if (ladder.length === 0) throw new Error('No rung fits --max-height');
  log(`source ${info.width}x${info.height} ${frameRate}fps ${info.duration.toFixed(1)}s audio=${info.hasAudio} interlaced=${info.interlaced}`);
  log(`ladder ${ladder.map((r) => r.name).join(', ')}, preset ${opts.preset}, segments ${opts.segmentSeconds}s, IDR ${opts.keyframeSeconds}s`);
  if (dryRun) {
    for (const rung of ladder) log(['ffmpeg', ...buildRungArgs({ input, rung, frameRate, interlaced: info.interlaced, hasAudio: info.hasAudio, loudness: null, opts, outDir: path.join(out, rung.name) })].join(' '));
    return { meta: null, issues: [] };
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const useLoudness = info.hasAudio && !noLoudnorm;
  const weights = stepWeights(ladder, useLoudness);
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const report = (stepIndex, step, name, fraction) => {
    if (!onProgress) return;
    const f = Math.min(1, Math.max(0, fraction));
    const done = weights.slice(0, stepIndex).reduce((a, b) => a + b, 0) + weights[stepIndex] * f;
    onProgress({ step, name, stepIndex, stepCount: weights.length, fraction: f, overall: done / weightTotal });
  };
  const secondsToFraction = (seconds) => (info.duration > 0 ? Math.min(1, seconds / info.duration) : 0);

  const timings = {};
  let loudness = null;
  let stepIndex = 0;
  if (useLoudness) {
    const t = Date.now();
    report(0, 'loudness', 'loudness', 0);
    loudness = await measureLoudness(input, opts, { signal, onProgressSeconds: (sec) => report(0, 'loudness', 'loudness', secondsToFraction(sec)) });
    timings.loudnessPassSeconds = (Date.now() - t) / 1000;
    if (loudness) log(`loudness measured: ${loudness.input_i} LUFS, TP ${loudness.input_tp} dBTP -> ${opts.targetLufs} LUFS`);
    else log('audio is digital silence: loudness normalisation skipped, audio encoded as is');
    stepIndex = 1;
  }

  const variants = [];
  const rungSummaries = [];
  for (const rung of ladder) {
    const outDir = path.join(out, rung.name);
    await mkdir(outDir, { recursive: true });
    const t = Date.now();
    const idx = stepIndex;
    report(idx, 'rung', rung.name, 0);
    await run('ffmpeg', buildRungArgs({ input, rung, frameRate, interlaced: info.interlaced, hasAudio: info.hasAudio, loudness, opts, outDir }), {
      niceLevel: opts.nice,
      signal,
      onProgressSeconds: (sec) => report(idx, 'rung', rung.name, secondsToFraction(sec)),
    });
    stepIndex += 1;
    report(idx, 'rung', rung.name, 1);
    const seconds = (Date.now() - t) / 1000;
    timings[`encode_${rung.name}_seconds`] = seconds;
    const parsed = await describeRung(outDir);
    const probed = await probeRung(outDir);
    const rates = measureBitrates(parsed.segments);
    const codecs = [avcCodecString(probed.profile, probed.level), info.hasAudio ? 'mp4a.40.2' : null].filter(Boolean).join(',');
    variants.push({
      uri: `${rung.name}/index.m3u8`,
      bandwidth: rates.peak,
      averageBandwidth: rates.average,
      width: probed.width,
      height: probed.height,
      frameRate,
      codecs,
    });
    rungSummaries.push({ name: rung.name, width: probed.width, height: probed.height, codecs, segments: parsed.segments.length, averageKbps: Math.round(rates.average / 1000), peakKbps: Math.round(rates.peak / 1000), encodeSeconds: seconds });
    log(`  ${rung.name}: ${seconds.toFixed(1)}s, avg ${Math.round(rates.average / 1000)} kbps, peak ${Math.round(rates.peak / 1000)} kbps, ${parsed.segments.length} segments`);
  }

  await writeFile(path.join(out, 'master.m3u8'), buildMasterPlaylist(variants, opts.defaultVariantKbps));

  const posterAt = Math.min(1, info.duration / 2).toFixed(2);
  await run('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-ss', posterAt, '-i', input, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', path.join(out, 'poster.jpg')], { niceLevel: opts.nice, signal });

  const issues = await validateOutput(out, info.duration);
  let totalBytes = 0;
  for (const f of await readdir(out, { recursive: true })) {
    const st = await stat(path.join(out, f));
    if (st.isFile()) totalBytes += st.size;
  }
  const meta = {
    createdAt: new Date().toISOString(),
    tool: 'scripts/hls/encode-hls.mjs',
    source: { width: info.width, height: info.height, frameRate, durationSeconds: info.duration, sizeBytes: info.sizeBytes, codec: info.videoCodec, hasAudio: info.hasAudio },
    options: opts,
    loudness,
    rungs: rungSummaries,
    timings,
    totalEncodeSeconds: (Date.now() - t0) / 1000,
    totalBytes,
    validationIssues: issues,
  };
  await writeFile(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  return { meta, issues };
}

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.input || !args.out) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }
  const { meta, issues } = await encodeHls({
    input: args.input,
    out: args.out,
    opts: args.opts,
    maxHeight: args.maxHeight,
    noLoudnorm: args.noLoudnorm,
    dryRun: args.dryRun,
    log: (line) => console.log(line),
  });
  if (!meta) return 0;
  console.log(`done in ${meta.totalEncodeSeconds.toFixed(1)}s, ${(meta.totalBytes / 1e6).toFixed(2)} MB total`);
  if (issues.length) {
    console.error('VALIDATION FAILED:\n - ' + issues.join('\n - '));
    return 1;
  }
  console.log('validation OK');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => { console.error(err.message); process.exitCode = 1; });
}

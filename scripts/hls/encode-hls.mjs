/**
 * Own HLS encoder: one source file -> CMAF/fMP4 HLS ladder + master playlist + poster.
 *
 *   node scripts/hls/encode-hls.mjs --input src.mp4 --out ./out/v1 [options]
 *
 * Zero npm dependencies: only Node >= 18 and ffmpeg/ffprobe (>= 6) on PATH.
 * Designed to run on the serwerek VPS (2 vCPU) under `nice`; see
 * docs/operations/HLS-SELF-HOSTED.md.
 *
 * Output layout (all playlist URIs are relative, so the player/CDN can serve
 * the folder from any prefix):
 *   master.m3u8
 *   540p/index.m3u8, 540p/init.mp4, 540p/seg_00001.m4s, ...
 *   poster.jpg
 *   meta.json            (what was encoded, timings, sizes, validation result)
 *
 * Choices (Apple HLS authoring specification; validated on the pilot, see the operations doc):
 *   - H.264 High, capped CRF per rung (maxrate/bufsize), 8-bit 4:2:0, SDR BT.709 output.
 *     HDR sources (HLG/PQ, e.g. iPhone HDR / Dolby Vision 8.4) are tone-mapped to SDR.
 *   - ONE ffmpeg process: the source is decoded (and de-interlaced / tone-mapped) once and
 *     split into every rung; audio is loudness-normalised once and split too.
 *   - IDR every 2 s (closed GOP, no scenecut), 6 s segments => every rung is cut
 *     at exactly the same timestamps (required for clean ABR switching).
 *   - Audio muxed into each rung (one language): AAC-LC 128k stereo 48 kHz,
 *     loudness normalised to -16 LUFS / -1 dBTP (two-pass loudnorm).
 *   - Ladder of bounding boxes (16:9 boxes, turned for portrait sources): each rung is the
 *     source fitted into the box, never upscaled, square pixels. A portrait 1080x1920 gets a
 *     full 1080x1920 top rung, a 1920x804 film a 1920x804 one. The lowest rung (234p, ~0.3
 *     Mb/s video) is for weak mobile links; rungs <= 432p never exceed 30 fps.
 *   - Master playlist is written by us from measured segment sizes (BANDWIDTH =
 *     peak segment bitrate, AVERAGE-BANDWIDTH, RESOLUTION, FRAME-RATE, CODECS read
 *     from the real SPS, CLOSED-CAPTIONS=NONE), because ffmpeg's own master omits FRAME-RATE.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Reference rungs as 16:9 bounding boxes (long x short side), largest first, capped CRF.
 * Bitrate caps follow the Apple HLS authoring table (top 7.8 Mb/s at 1080p, 145-365 kb/s
 * at the bottom); `maxFps` keeps the small rungs at <= 30 fps as Apple recommends.
 */
export const LADDER_RUNGS = [
  { long: 1920, short: 1080, crf: 21, maxrateK: 7800, bufsizeK: 15600 },
  { long: 1280, short: 720, crf: 22, maxrateK: 4500, bufsizeK: 9000 },
  { long: 960, short: 540, crf: 23, maxrateK: 3000, bufsizeK: 6000 },
  { long: 640, short: 360, crf: 23, maxrateK: 1100, bufsizeK: 2200, maxFps: 30 },
  { long: 416, short: 234, crf: 24, maxrateK: 350, bufsizeK: 700, maxFps: 30 },
];

/** A smaller rung is only worth encoding when it has at most this share of the pixels of the one above. */
const MIN_RUNG_STEP = 0.8;

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

/** Largest even number <= n (4:2:0 needs even sizes; rounding down never upscales). */
const even = (n) => Math.max(2, Math.floor(n / 2) * 2);

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

/**
 * Which rungs to encode for a source of the given (display, i.e. already rotated) size.
 * Each rung box is turned to the source orientation and the source is fitted inside it
 * (never upscaled). A rung is skipped when it would be barely smaller than the one above
 * (> MIN_RUNG_STEP of its pixels). Encoder settings come from the smallest box that holds
 * the rung, so a 1280x720 source encodes its top rung with the 720p settings.
 * Returns rungs largest first: { name, width, height, crf, maxrateK, bufsizeK, maxFps? }.
 */
export function planLadder(sourceWidth, sourceHeight, rungs = LADDER_RUNGS) {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error('Source has no usable video size');
  const portrait = sourceHeight > sourceWidth;
  const box = (r) => (portrait ? { w: r.short, h: r.long } : { w: r.long, h: r.short });
  const chosen = [];
  for (const r of rungs) {
    const { w, h } = box(r);
    const scale = Math.min(1, w / sourceWidth, h / sourceHeight);
    const width = even(sourceWidth * scale);
    const height = even(sourceHeight * scale);
    const above = chosen[chosen.length - 1];
    if (above && width * height > above.width * above.height * MIN_RUNG_STEP) continue;
    const settings = [...rungs].reverse().find((s) => box(s).w >= width && box(s).h >= height) ?? r;
    const { long: _long, short: _short, ...encode } = settings;
    chosen.push({ ...encode, name: `${Math.min(width, height)}p`, width, height });
  }
  return chosen;
}

/** Frame rate of one rung: halved (60 -> 30, 50 -> 25) until it fits the rung's maxFps. */
export function rungFrameRate(frameRate, maxFps) {
  let fps = frameRate;
  while (maxFps && fps > maxFps + 0.01) fps /= 2;
  return Math.round(fps * 1000) / 1000;
}

/** [level, MaxMBPS, MaxFS] from the H.264 spec (Table A-1); levels used by HLS players. */
const H264_LEVELS = [
  ['3.0', 40500, 1620],
  ['3.1', 108000, 3600],
  ['3.2', 216000, 5120],
  ['4.0', 245760, 8192],
  ['4.2', 522240, 8704],
  ['5.0', 589824, 22080],
  ['5.1', 983040, 36864],
  ['5.2', 2073600, 36864],
];

/** Lowest H.264 level whose frame size and macroblock rate fit (1080p60 needs 4.2, not 4.1). */
export function h264Level(width, height, fps) {
  const frameMbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const longSideMbs = Math.ceil(Math.max(width, height) / 16);
  const hit = H264_LEVELS.find(
    ([, maxMbps, maxFs]) => frameMbs <= maxFs && frameMbs * fps <= maxMbps && longSideMbs <= Math.sqrt(8 * maxFs),
  );
  return hit ? hit[0] : '5.2';
}

/** ffprobe color_transfer values of HDR video (PQ / HDR10 / Dolby Vision, and HLG). */
const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67']);

/**
 * HDR -> SDR BT.709 tone mapping (zimg's zscale + ffmpeg's tonemap, both in the static ffmpeg
 * build of the worker image): linearise at the top rung size, convert BT.2020 -> BT.709
 * primaries in float, Hable curve, back to BT.709 limited-range 4:2:0. Doing it once at the top
 * rung size keeps the float frames small even for 4K sources.
 */
export function toneMapFilter({ transfer, primaries, matrix }, width, height) {
  const input = [
    `tin=${transfer}`,
    primaries === 'bt2020' ? 'pin=2020' : null,
    matrix === 'bt2020nc' ? 'min=2020_ncl' : matrix === 'bt2020c' ? 'min=2020_cl' : null,
  ].filter(Boolean).join(':');
  return [
    `zscale=w=${width}:h=${height}:f=lanczos:${input}:t=linear:npl=100`,
    'format=gbrpf32le',
    'zscale=p=709',
    'tonemap=tonemap=hable:desat=0',
    'zscale=t=709:m=709:r=limited',
    'format=yuv420p',
  ].join(',');
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
      `#EXT-X-STREAM-INF:BANDWIDTH=${Math.ceil(v.bandwidth)},AVERAGE-BANDWIDTH=${Math.ceil(v.averageBandwidth)},RESOLUTION=${v.width}x${v.height},FRAME-RATE=${v.frameRate.toFixed(3)},CODECS="${v.codecs}",CLOSED-CAPTIONS=NONE`,
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

/**
 * The filter graph: the source is decoded once, de-interlaced / tone-mapped once, then split
 * into one branch per rung ([v0], [v1], ...); audio is normalised once and split ([a0], ...).
 * `ladder` is planLadder() output, largest first (pure; tested).
 */
export function buildFilterGraph({ ladder, frameRate, interlaced, color, hasAudio, loudness, opts }) {
  const n = ladder.length;
  const top = ladder[0];
  const pre = [
    interlaced ? 'bwdif=mode=send_frame' : null,
    color && HDR_TRANSFERS.has(color.transfer) ? toneMapFilter(color, top.width, top.height) : null,
    `fps=${frameRate}`,
  ].filter(Boolean).join(',');
  const parts = [`[0:v:0]${pre},split=${n}${ladder.map((_, i) => `[s${i}]`).join('')}`];
  ladder.forEach((rung, i) => {
    const fps = rungFrameRate(frameRate, rung.maxFps);
    const rate = fps !== frameRate ? `fps=${fps},` : '';
    parts.push(`[s${i}]${rate}scale=${rung.width}:${rung.height}:flags=lanczos,setsar=1,format=yuv420p[v${i}]`);
  });
  if (hasAudio) {
    const norm = loudness ? `${loudnormFilter(loudness, opts)},` : '';
    parts.push(`[0:a:0]${norm}aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,asplit=${n}${ladder.map((_, i) => `[a${i}]`).join('')}`);
  }
  return parts.join(';');
}

/**
 * ffmpeg arguments for the whole ladder in one process (pure; tested). Every rung gets an IDR
 * exactly every `keyframeSeconds` (closed GOP, no scene cuts), so all rungs are cut at the same
 * timestamps even when a small rung runs at half the frame rate.
 */
export function buildEncodeArgs({ input, ladder, frameRate, interlaced, color, hasAudio, loudness, opts, outDir }) {
  const hdr = Boolean(color && HDR_TRANSFERS.has(color.transfer));
  const args = [
    '-hide_banner', '-nostdin', '-y', '-i', input,
    '-filter_complex', buildFilterGraph({ ladder, frameRate, interlaced, color, hasAudio, loudness, opts }),
  ];
  ladder.forEach((rung, i) => {
    const fps = rungFrameRate(frameRate, rung.maxFps);
    const gop = Math.round(fps * opts.keyframeSeconds);
    const dir = path.join(outDir, rung.name);
    args.push('-map', `[v${i}]`);
    if (hasAudio) args.push('-map', `[a${i}]`);
    args.push(
      '-c:v', 'libx264', '-preset', opts.preset, '-profile:v', 'high', '-level', h264Level(rung.width, rung.height, fps),
      '-crf', String(rung.crf), '-maxrate', `${rung.maxrateK}k`, '-bufsize', `${rung.bufsizeK}k`,
      '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
      '-x264-params', 'open-gop=0:scenecut=0',
      '-force_key_frames', `expr:gte(t,n_forced*${opts.keyframeSeconds})`,
    );
    // Tone-mapped output is BT.709 SDR: say so, or players keep treating it as BT.2020.
    if (hdr) args.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv');
    if (hasAudio) args.push('-c:a', 'aac', '-b:a', `${opts.audioBitrateK}k`);
    args.push(
      '-f', 'hls', '-hls_time', String(opts.segmentSeconds), '-hls_playlist_type', 'vod',
      '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments',
      '-hls_fmp4_init_filename', 'init.mp4', '-hls_segment_filename', path.join(dir, 'seg_%05d.m4s'),
      path.join(dir, 'index.m3u8'),
    );
  });
  return args;
}

/**
 * Runs a child process. Options: `niceLevel` (not on Windows), `signal` (AbortSignal: kills the
 * child and rejects with name "AbortError"), `onProgressSeconds` (ffmpeg only: called with the
 * encoded media seconds parsed from `-progress pipe:1`; stdout is then not buffered), `timeoutMs` (kills the
 * child and rejects with name "TimeoutError") and `maxStdoutBytes` (kills the child when buffered stdout grows
 * past it; rejects with name "OutputLimitError"). Both exist so a hostile or broken source cannot hold the single
 * encoder forever or fill its memory through ffprobe.
 */
export function run(cmd, args, { niceLevel, signal, onProgressSeconds, timeoutMs, maxStdoutBytes } = {}) {
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
    let failure = null;
    const onAbort = () => { aborted = true; child.kill('SIGKILL'); };
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = timeoutMs
      ? setTimeout(() => {
          failure = Object.assign(new Error(`${cmd} timed out after ${timeoutMs} ms`), { name: 'TimeoutError' });
          child.kill('SIGKILL');
        }, timeoutMs)
      : null;
    child.stdout.on('data', (d) => {
      if (!onProgressSeconds) {
        stdout += d;
        if (maxStdoutBytes && stdout.length > maxStdoutBytes && !failure) {
          failure = Object.assign(new Error(`${cmd} output exceeded ${maxStdoutBytes} bytes`), { name: 'OutputLimitError' });
          child.kill('SIGKILL');
        }
        return;
      }
      pending += d;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const m = /^out_time_us=(\d+)$/.exec(line.trim());
        if (m) onProgressSeconds(Number(m[1]) / 1e6);
      }
    });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000); });
    child.on('error', (err) => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (aborted) reject(abortError());
      else if (failure) reject(failure);
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with ${code}\n${stderr.slice(-2000)}`));
    });
  });
}

/** ffprobe on an untrusted source: bounded in time and output, and cancellable (audit S04). */
export const PROBE_TIMEOUT_MS = 60_000;
export const PROBE_MAX_STDOUT_BYTES = 4_000_000;

/** @param {string} input @param {{ signal?: AbortSignal, timeoutMs?: number }} [options] */
export async function probeSource(input, { signal, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input], {
    signal,
    timeoutMs,
    maxStdoutBytes: PROBE_MAX_STDOUT_BYTES,
  });
  const data = JSON.parse(stdout);
  const video = data.streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  if (!video) throw new Error('Source has no video stream');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const rotation = Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0);
  const rotated = Math.abs(rotation) % 180 === 90;
  const hdr = HDR_TRANSFERS.has(video.color_transfer);
  const containerDuration = Number(data.format.duration);
  const streamDuration = Number(video.duration);
  return {
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    avgFrameRate: video.avg_frame_rate,
    duration: containerDuration,
    /** Duration of the video stream itself (the container's can include a longer audio track). */
    videoDuration: Number.isFinite(streamDuration) && streamDuration > 0 ? streamDuration : containerDuration,
    color: { transfer: video.color_transfer ?? null, primaries: video.color_primaries ?? null, matrix: video.color_space ?? null },
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
  const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', path.join(rungDir, 'index.m3u8')], {
    timeoutMs: PROBE_TIMEOUT_MS,
    maxStdoutBytes: PROBE_MAX_STDOUT_BYTES,
  });
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
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=flags', '-read_intervals', '%+#1', '-of', 'csv=p=0', tmp], {
      timeoutMs: PROBE_TIMEOUT_MS,
      maxStdoutBytes: PROBE_MAX_STDOUT_BYTES,
    });
    if (!stdout.trim().startsWith('K')) bad.push(s.uri);
    await rm(tmp, { force: true });
  }
  return bad;
}

/**
 * True when the encoded length matches the source: the video stream's duration, or the
 * container's (which also covers a longer audio track), within 0.6 s.
 */
export function durationMatches(total, sourceDurations) {
  return sourceDurations.some((d) => Number.isFinite(d) && Math.abs(total - d) <= 0.6);
}

/**
 * Validates a finished output directory; returns a list of human readable issues.
 * `sourceDurations`: acceptable source lengths in seconds (number or array).
 */
export async function validateOutput(outDir, sourceDurations) {
  const durations = Array.isArray(sourceDurations) ? sourceDurations : [sourceDurations];
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
    if (!durationMatches(total, durations)) issues.push(`${ref}: duration ${total.toFixed(2)}s differs from source ${durations.map((d) => d.toFixed(2)).join('/')}s`);
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
       [--lufs -16] [--no-loudnorm] [--max-height 1080 (short side of the top rung)] [--nice 10] [--dry-run]`;

/**
 * Relative CPU cost of each step (the optional loudness pass, then the one encode of all rungs),
 * used to turn per-step progress into one 0..1 fraction.
 */
export function stepWeights(ladder, hasLoudness) {
  const encode = ladder.reduce((sum, r) => sum + r.width * r.height, 0);
  const decodeOnly = (ladder[0]?.width ?? 0) * (ladder[0]?.height ?? 0) * 0.1;
  return hasLoudness ? [decodeOnly, encode] : [encode];
}

/** Poster time: 10 % into the video (the first second is often black or a fade), never past the end. */
export function posterTimeSeconds(durationSeconds) {
  if (!(durationSeconds > 0)) return 0;
  return Math.max(0, Math.min(durationSeconds * 0.1, durationSeconds - 0.5));
}

/**
 * Encodes `input` into `out` (see the header). Library entry point used by the CLI below and by
 * the video worker (lib/modules/video-pipeline). Throws on bad input (no video); returns
 * `{ meta, issues }` where non-empty `issues` means the output failed validation and must not
 * be published. `meta` is null for a dry run.
 *
 * options: { input, out, opts?, maxHeight? (short side), noLoudnorm?, dryRun?, signal?, log?,
 *   onProgress?: ({ step: 'loudness'|'encode', name, stepIndex, stepCount, fraction, overall }) }
 */
export async function encodeHls(options) {
  const { input, out, maxHeight, noLoudnorm, dryRun, signal, onProgress } = options;
  const log = options.log ?? (() => {});
  const opts = { ...DEFAULTS, ...(options.opts ?? {}) };
  const t0 = Date.now();
  const info = await probeSource(input, { signal });
  const frameRate = chooseFrameRate(info.avgFrameRate);
  let ladder = planLadder(info.width, info.height);
  if (maxHeight) ladder = ladder.filter((r) => Math.min(r.width, r.height) <= maxHeight);
  if (ladder.length === 0) throw new Error('No rung fits --max-height');
  const encodeInput = { input, ladder, frameRate, interlaced: info.interlaced, color: info.color, hasAudio: info.hasAudio, opts, outDir: out };
  log(`source ${info.width}x${info.height} ${frameRate}fps ${info.duration.toFixed(1)}s audio=${info.hasAudio} interlaced=${info.interlaced} hdr=${info.hdr ? info.color.transfer : 'no'}`);
  log(`ladder ${ladder.map((r) => `${r.name} ${r.width}x${r.height}`).join(', ')}, preset ${opts.preset}, segments ${opts.segmentSeconds}s, IDR ${opts.keyframeSeconds}s`);
  if (dryRun) {
    log(['ffmpeg', ...buildEncodeArgs({ ...encodeInput, loudness: null })].join(' '));
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

  for (const rung of ladder) await mkdir(path.join(out, rung.name), { recursive: true });
  const t = Date.now();
  report(stepIndex, 'encode', 'ladder', 0);
  await run('ffmpeg', buildEncodeArgs({ ...encodeInput, loudness }), {
    niceLevel: opts.nice,
    signal,
    onProgressSeconds: (sec) => report(stepIndex, 'encode', 'ladder', secondsToFraction(sec)),
  });
  report(stepIndex, 'encode', 'ladder', 1);
  timings.encodeSeconds = (Date.now() - t) / 1000;
  log(`  encoded all rungs in ${timings.encodeSeconds.toFixed(1)}s`);

  const variants = [];
  const rungSummaries = [];
  for (const rung of ladder) {
    const rungDir = path.join(out, rung.name);
    const parsed = await describeRung(rungDir);
    const probed = await probeRung(rungDir);
    const rates = measureBitrates(parsed.segments);
    const fps = rungFrameRate(frameRate, rung.maxFps);
    const codecs = [avcCodecString(probed.profile, probed.level), info.hasAudio ? 'mp4a.40.2' : null].filter(Boolean).join(',');
    variants.push({
      uri: `${rung.name}/index.m3u8`,
      bandwidth: rates.peak,
      averageBandwidth: rates.average,
      width: probed.width,
      height: probed.height,
      frameRate: fps,
      codecs,
    });
    rungSummaries.push({ name: rung.name, width: probed.width, height: probed.height, frameRate: fps, codecs, segments: parsed.segments.length, averageKbps: Math.round(rates.average / 1000), peakKbps: Math.round(rates.peak / 1000) });
    log(`  ${rung.name}: ${probed.width}x${probed.height}@${fps}, avg ${Math.round(rates.average / 1000)} kbps, peak ${Math.round(rates.peak / 1000)} kbps, ${parsed.segments.length} segments`);
  }

  await writeFile(path.join(out, 'master.m3u8'), buildMasterPlaylist(variants, opts.defaultVariantKbps));

  // Poster from our own top rung: already SDR (tone-mapped), de-interlaced and upright.
  await run('ffmpeg', [
    '-hide_banner', '-nostdin', '-y', '-ss', posterTimeSeconds(info.videoDuration).toFixed(2), '-i', path.join(out, ladder[0].name, 'index.m3u8'),
    '-frames:v', '1', '-vf', "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2", '-q:v', '3', path.join(out, 'poster.jpg'),
  ], { niceLevel: opts.nice, signal });

  const issues = await validateOutput(out, [info.videoDuration, info.duration]);
  let totalBytes = 0;
  for (const f of await readdir(out, { recursive: true })) {
    const st = await stat(path.join(out, f));
    if (st.isFile()) totalBytes += st.size;
  }
  const meta = {
    createdAt: new Date().toISOString(),
    tool: 'scripts/hls/encode-hls.mjs',
    source: { width: info.width, height: info.height, frameRate, durationSeconds: info.duration, sizeBytes: info.sizeBytes, codec: info.videoCodec, hasAudio: info.hasAudio, hdr: info.hdr, color: info.color },
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

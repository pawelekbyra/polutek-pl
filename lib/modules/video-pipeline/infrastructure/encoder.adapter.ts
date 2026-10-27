import { encodeHls, probeSource } from "@/scripts/hls/encode-hls.mjs";
import type { EncodeOutcome, ProcessorPorts, SourceProbe } from "../application/process-encode-job";

export interface EncoderSettings {
  preset: string;
  nice: number;
}

const ALLOWED_PRESETS = new Set(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower"]);

export function readEncoderSettings(env: NodeJS.ProcessEnv = process.env): EncoderSettings {
  const preset = env.HLS_PRESET && ALLOWED_PRESETS.has(env.HLS_PRESET) ? env.HLS_PRESET : "slow";
  const nice = Number.isFinite(Number(env.HLS_NICE)) ? Math.min(19, Math.max(0, Number(env.HLS_NICE))) : 10;
  return { preset, nice };
}

/** Real encoder: scripts/hls/encode-hls.mjs run as a library (no shell, no temp scripts). */
export function createEncoder(settings: EncoderSettings = readEncoderSettings()): ProcessorPorts["encoder"] {
  return {
    async probe(file: string, signal?: AbortSignal): Promise<SourceProbe> {
      const info = await probeSource(file, { signal });
      return {
        width: info.width,
        height: info.height,
        duration: info.duration,
        hdr: info.hdr,
        hasAudio: info.hasAudio,
        videoCodec: info.videoCodec,
        sizeBytes: info.sizeBytes,
      };
    },
    async encode({ input, out, signal, onProgress }): Promise<EncodeOutcome> {
      const result = await encodeHls({
        input,
        out,
        opts: { preset: settings.preset, nice: settings.nice },
        signal,
        onProgress: (p: { overall: number; step: string; name: string }) => onProgress(p),
      });
      return { meta: result.meta, issues: result.issues };
    },
  };
}

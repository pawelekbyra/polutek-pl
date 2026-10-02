import type { EncodeStage, PipelineSummary } from "@/lib/modules/video-pipeline";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : i >= 3 ? 2 : 1)} ${units[i]}`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return "liczę…";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s % 60} s`;
  return `${s} s`;
}

export const STAGE_LABEL: Record<EncodeStage, string> = {
  QUEUED: "W kolejce",
  DOWNLOADING: "Pobieranie oryginału",
  PROBING: "Analiza pliku",
  ENCODING: "Kodowanie",
  UPLOADING: "Wysyłanie wyniku",
  FINALIZING: "Kończenie",
  DONE: "Gotowe",
};

export const SUMMARY_LABEL: Record<PipelineSummary, { text: string; tone: "neutral" | "busy" | "ok" | "bad" }> = {
  NO_ORIGINAL: { text: "Brak pliku", tone: "neutral" },
  UPLOADING: { text: "Wysyłanie pliku", tone: "busy" },
  UPLOAD_FAILED: { text: "Upload nieudany", tone: "bad" },
  QUEUED: { text: "W kolejce do kodowania", tone: "busy" },
  ENCODING: { text: "Kodowanie", tone: "busy" },
  READY: { text: "Gotowe do odtwarzania", tone: "ok" },
  FAILED: { text: "Kodowanie nieudane", tone: "bad" },
  CANCELLED: { text: "Anulowano", tone: "neutral" },
};

/** Whether the panel should poll quickly. */
export function isPipelineActive(summary: PipelineSummary | undefined): boolean {
  return summary === "QUEUED" || summary === "ENCODING" || summary === "UPLOADING";
}

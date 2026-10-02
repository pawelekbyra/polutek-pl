"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineStateDto } from "@/lib/modules/video-pipeline";
import { isPipelineActive } from "./pipeline-format";

const FAST_MS = 3_000;
const SLOW_MS = 15_000;

function readError(payload: unknown): string | null {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string" ? (payload as { error: string }).error : null;
}

/** Polls the pipeline state (3 s while something is happening, 15 s otherwise) and exposes the admin actions. */
export function useVideoPipeline(videoId: string, onChanged?: () => void) {
  const [state, setState] = useState<PipelineStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSummary = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async (): Promise<PipelineStateDto | null> => {
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/pipeline`, { cache: "no-store" });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(readError(payload) ?? "Nie udało się pobrać stanu przetwarzania.");
      const next = payload as PipelineStateDto;
      if (!alive.current) return next;
      setState(next);
      setError(null);
      if (lastSummary.current && lastSummary.current !== next.summary && !isPipelineActive(next.summary)) onChanged?.();
      lastSummary.current = next.summary;
      return next;
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "Nieznany błąd.");
      return null;
    }
  }, [videoId, onChanged]);

  useEffect(() => {
    alive.current = true;
    const loop = async () => {
      const next = await refresh();
      if (!alive.current) return;
      timer.current = setTimeout(loop, isPipelineActive(next?.summary) ? FAST_MS : SLOW_MS);
    };
    void loop();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const act = useCallback(
    async (url: string, method: "POST" | "DELETE", fallback: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(url, { method });
        const payload: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(readError(payload) ?? fallback);
        await refresh();
        onChanged?.();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, onChanged],
  );

  const base = `/api/admin/videos/${videoId}/pipeline`;
  return {
    state,
    error,
    busy,
    refresh,
    reencode: () => act(`${base}/encode`, "POST", "Nie udało się uruchomić kodowania."),
    cancel: (jobId: string) => act(`${base}/jobs/${jobId}`, "DELETE", "Nie udało się anulować kodowania."),
    deleteAsset: (assetId: string) => act(`${base}/assets/${assetId}`, "DELETE", "Nie udało się usunąć wersji."),
  };
}

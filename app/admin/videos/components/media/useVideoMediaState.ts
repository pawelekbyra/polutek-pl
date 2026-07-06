"use client";

import { useCallback, useEffect, useState } from "react";
import type { VideoMediaState } from "./types";

function readError(payload: unknown): string | null {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string" ? (payload as { error: string }).error : null;
}

export function useVideoMediaState(videoId: string) {
  const [mediaState, setMediaState] = useState<VideoMediaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/videos/${videoId}/media`, { cache: "no-store" });
      const payload = await response.json().catch((): unknown => null);
      if (!response.ok) throw new Error(readError(payload) ?? "Nie udało się pobrać stanu mediów.");
      setMediaState(payload as VideoMediaState);
      return payload as VideoMediaState;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nieznany błąd.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { mediaState, setMediaState, loading, error, refresh };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoMediaState } from "./types";

const PENDING_SUMMARY_STATES = new Set(["CREATING_SOURCES", "PARTIALLY_READY"]);
const PENDING_POLL_INTERVAL_MS = 15_000;

function readError(payload: unknown): string | null {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string" ? (payload as { error: string }).error : null;
}

export function useVideoMediaState(videoId: string) {
  const [mediaState, setMediaState] = useState<VideoMediaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncInFlight = useRef(false);

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

  // Unlike refresh(), this asks the server to sync stuck provider jobs against the real
  // provider state (missed webhooks, imports that never started) before returning state.
  const syncWithProviders = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (syncInFlight.current) return null;
    syncInFlight.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/admin/videos/${videoId}/reconcile`, { method: "POST" });
      const payload = await response.json().catch((): unknown => null);
      if (!response.ok) throw new Error(readError(payload) ?? "Nie udało się zsynchronizować stanu źródeł.");
      setMediaState(payload as VideoMediaState);
      return payload as VideoMediaState;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nieznany błąd.";
      if (!silent) setError(message);
      throw err;
    } finally {
      syncInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const pipelinePending = mediaState ? PENDING_SUMMARY_STATES.has(mediaState.summary.state) : false;
  useEffect(() => {
    if (!pipelinePending) return;
    const interval = setInterval(() => { void syncWithProviders({ silent: true }).catch(() => undefined); }, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pipelinePending, syncWithProviders]);

  return { mediaState, setMediaState, loading, error, refresh, syncWithProviders };
}

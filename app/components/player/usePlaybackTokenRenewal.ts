"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { logger } from "@/lib/logger";
import type { PlaybackPlan } from "@/lib/modules/playback";
import { isPlayablePlaybackPlan } from "../playback-plan-state";

/** Renew this long before the delivery token expires. */
export const RENEW_BEFORE_EXPIRY_MS = 120 * 1000;
/** Never schedule a renewal sooner than this from now (a token cut short by the end of a grant must not cause a request storm). */
export const MIN_RENEW_DELAY_MS = 5 * 1000;

/**
 * How long before expiry to renew a token that has `remainingMs` left now: the normal lead, but at
 * most half of what is left (a short token, e.g. cut at the end of a patron pass, is renewed
 * halfway instead of immediately and again and again).
 */
export function renewLeadMs(remainingMs: number): number {
  return Math.min(RENEW_BEFORE_EXPIRY_MS, Math.max(0, remainingMs) / 2);
}

/**
 * Silent renewal of the open player's playback plan (fresh delivery token): the same endpoint and
 * the same full access check on the server, but the plan is swapped in place, so the player keeps
 * playing. `?session=` lets the server keep this watch's playback session. Renews 2 minutes before
 * expiry (protected videos: 30 min tokens, so about every 28 min; the server re-checks access each time), and at once when a tab that slept past that point becomes visible again (timers in
 * background tabs are throttled or frozen). Concurrent calls share one request.
 */
export function usePlaybackTokenRenewal(args: {
  videoId: string;
  plan: PlaybackPlan | null;
  /** Bumped by every full re-check; a renewal started before it is discarded. */
  generationRef: MutableRefObject<number>;
  setPlan: (plan: PlaybackPlan) => void;
  invalidatePreloaded?: (videoId: string) => void;
  /** Full re-check (loading state, lock overlays) when the viewer can no longer play. */
  refresh: () => Promise<void>;
}): () => Promise<PlaybackPlan | null> {
  const { videoId, plan, generationRef, setPlan, invalidatePreloaded, refresh } = args;
  const sessionId = plan?.tracking?.playbackSessionId || "";
  const inFlightRef = useRef<Promise<PlaybackPlan | null> | null>(null);

  const renew = useCallback((): Promise<PlaybackPlan | null> => {
    if (inFlightRef.current) return inFlightRef.current;
    const generation = generationRef.current;
    const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
    const request = (async () => {
      let response: Response;
      try {
        response = await fetch(`/api/media-source/${encodeURIComponent(videoId)}${query}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
      } catch (error) {
        logger.warn("Playback token renewal failed (network)", error);
        return null;
      }
      if (generationRef.current !== generation) return null;
      // Rate limit / server trouble: keep the current plan, the player retries later.
      if (response.status === 429 || response.status >= 500) return null;
      const data = (await response.json().catch(() => null)) as PlaybackPlan | null;
      if (generationRef.current !== generation) return null;
      if (data && isPlayablePlaybackPlan(data, videoId)) {
        invalidatePreloaded?.(videoId);
        setPlan(data);
        return data;
      }
      // The viewer can no longer play this (signed out, access changed): show the right state.
      void refresh();
      return null;
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = request;
    return request;
  }, [generationRef, invalidatePreloaded, refresh, sessionId, setPlan, videoId]);

  const expiresAt = plan?.source?.expiresAt ? new Date(plan.source.expiresAt).getTime() : null;
  useEffect(() => {
    if (!expiresAt) return;
    const lead = renewLeadMs(expiresAt - Date.now());
    const renewIfDue = () => {
      if (expiresAt - Date.now() <= lead) void renew();
    };
    const timer = setTimeout(renewIfDue, Math.max(MIN_RENEW_DELAY_MS, expiresAt - Date.now() - lead));
    const onVisible = () => {
      if (document.visibilityState === "visible") renewIfDue();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [renew, expiresAt]);

  return renew;
}

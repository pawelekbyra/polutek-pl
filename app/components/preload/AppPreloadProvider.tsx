"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicVideoDTO } from "@/app/types/video";
import type { PlaybackPlan } from "@/lib/modules/playback";
import { resolvePlaybackViewerKey } from "./playback-viewer-key";
import type { InitialPlaybackPlan } from "./initial-playback-plan";
import { isUpcomingPremiere } from "@/lib/premiere";
import { isPlayablePlaybackPlan } from "../playback-plan-state";

export { resolvePlaybackViewerKey };

type PreloadStatus = "idle" | "loading" | "ready" | "error";

type WarmVideoOptions = {
  includeComments?: boolean;
  includePoster?: boolean;
  priority?: "critical" | "nearby" | "intent" | "idle";
};

type PlaybackRecord = {
  status: PreloadStatus;
  plan: PlaybackPlan | null;
  viewerKey: string;
  requestId: number;
  promise?: Promise<PlaybackPlan | null>;
  controller?: AbortController;
  error?: unknown;
};

type AppPreloadContextValue = {
  viewerKey: string | null;
  getPlaybackPlan: (videoId: string) => PlaybackPlan | null;
  invalidatePlaybackPlan: (videoId: string) => void;
  warmVideo: (videoId: string, options?: WarmVideoOptions) => Promise<PlaybackPlan | null>;
  warmComments: (videoId: string, sortBy?: "newest" | "top") => Promise<void>;
  markVideoActive: (videoId: string) => void;
  initialProgress: number;
  initialReady: boolean;
};

const AppPreloadContext = createContext<AppPreloadContextValue | null>(null);

export function useAppPreload() {
  return useContext(AppPreloadContext);
}

function emitSplashProgress(progress: number, ready: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("polutek:app-preload-progress", { detail: { progress, ready } }));
}

function loadImage(src: string | null | undefined) {
  if (!src || typeof window === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });
}

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return;
  const requestIdle = window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 250));
  requestIdle(() => callback(), { timeout: 1800 });
}

/**
 * Low-priority fetch of a playable plan's manifest, so a click on that video finds it in the HTTP
 * cache (the manifest is `public, max-age=300`). Anonymous CORS without credentials, like hls.js.
 */
function prefetchManifest(url: string) {
  try {
    void fetch(url, { mode: "cors", credentials: "omit", priority: "low" } as RequestInit).catch(() => undefined);
  } catch {
    // A warm-up only.
  }
}

export function AppPreloadProvider({
  children,
  selectedVideo,
  allVideos,
  initialPlayback,
}: {
  children: React.ReactNode;
  selectedVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  /** The selected video's plan, made by the server for this viewer while rendering the page. */
  initialPlayback?: InitialPlaybackPlan | null;
}) {
  const { isLoaded, userId, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const [initialProgress, setInitialProgress] = useState(0);
  const [initialReady, setInitialReady] = useState(false);
  const viewerKey = resolvePlaybackViewerKey({ isLoaded, userId, sessionId });
  // The server's plan is the first entry of the cache, for exactly the viewer it was made for:
  // the player then mounts from the first render, without asking /api/media-source. A plan for
  // any other viewer key is never used (and is dropped with the other viewers' entries below).
  const [initialRecords] = useState(() => {
    const records = new Map<string, PlaybackRecord>();
    if (initialPlayback && viewerKey && initialPlayback.viewerKey === viewerKey) {
      records.set(`${viewerKey}\u0000${initialPlayback.videoId}`, {
        status: "ready",
        plan: initialPlayback.plan,
        viewerKey,
        requestId: 0,
      });
    }
    return records;
  });
  const playbackRecords = useRef<Map<string, PlaybackRecord>>(initialRecords);
  const requestIdRef = useRef(0);
  const activeVideoIdRef = useRef<string | null>(selectedVideo?.id ?? null);
  const videosById = useMemo(() => new Map(allVideos.map((video) => [video.id, video])), [allVideos]);
  const prefetchedManifestsRef = useRef<Set<string>>(new Set());

  const updateProgress = useCallback((progress: number, ready = false) => {
    const next = Math.max(0, Math.min(100, Math.round(progress)));
    setInitialProgress((current) => Math.max(current, next));
    if (ready) setInitialReady(true);
    emitSplashProgress(next, ready);
  }, []);

  const warmComments = useCallback(async (videoId: string, sortBy: "newest" | "top" = "newest") => {
    if (!videoId || typeof window === "undefined") return;
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["comments", videoId, sortBy],
      queryFn: async ({ pageParam }) => {
        const url = new URL("/api/comments", window.location.origin);
        url.searchParams.set("videoId", videoId);
        url.searchParams.set("sortBy", sortBy);
        if (pageParam) url.searchParams.set("cursor", String(pageParam));
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Comments preload failed: ${res.status}`);
        return res.json();
      },
      initialPageParam: "",
    });
  }, [queryClient]);

  const warmPlaybackPlan = useCallback((videoId: string) => {
    const requestViewerKey = viewerKey;
    if (!requestViewerKey) return Promise.resolve(null);

    const cacheKey = `${requestViewerKey}\u0000${videoId}`;
    const existing = playbackRecords.current.get(cacheKey);
    if (existing?.status === "ready") return Promise.resolve(existing.plan);
    if (existing?.promise) return existing.promise;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const isCurrentRequest = () => {
      const currentRecord = playbackRecords.current.get(cacheKey);
      return currentRecord?.requestId === requestId;
    };

    const promise = fetch(`/api/media-source/${encodeURIComponent(videoId)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!isCurrentRequest()) return null;

        const plan = data && typeof data === "object"
          ? data as PlaybackPlan
          : null;
        playbackRecords.current.set(cacheKey, {
          status: plan ? "ready" : "error",
          plan,
          viewerKey: requestViewerKey,
          requestId,
        });
        return plan;
      })
      .catch((error) => {
        if (!isCurrentRequest()) return null;
        playbackRecords.current.set(cacheKey, {
          status: "error",
          plan: null,
          viewerKey: requestViewerKey,
          requestId,
          error,
        });
        return null;
      });

    playbackRecords.current.set(cacheKey, {
      status: "loading",
      plan: null,
      viewerKey: requestViewerKey,
      requestId,
      promise,
      controller,
    });
    return promise;
  }, [viewerKey]);

  /**
   * A plan is only warmed when the player will really need it: always when the player asks
   * ("critical"), on intent (hover, focus, touch) only for a video this viewer can play, and never
   * in the background ("nearby"/"idle"): a plan opens a playback session, which should mean
   * someone is about to watch. A guest is never sent for a sign-in-only video or a premiere
   * (the answer would be a 403/lock the page already shows).
   */
  const shouldWarmPlan = useCallback((videoId: string, priority: WarmVideoOptions["priority"]) => {
    if (priority === "critical") return true;
    if (priority === "nearby" || priority === "idle") return false;
    const video = videosById.get(videoId);
    if (!video) return false;
    if (isUpcomingPremiere(video)) return false;
    return Boolean(userId) || video.tier === "PUBLIC";
  }, [userId, videosById]);

  const warmVideo = useCallback(async (videoId: string, options: WarmVideoOptions = {}) => {
    if (!videoId || !viewerKey) return null;
    const video = videosById.get(videoId);
    const planTask = shouldWarmPlan(videoId, options.priority)
      ? warmPlaybackPlan(videoId).then((plan) => {
          // On intent, also pull the manifest into the HTTP cache: the switch then starts with it.
          const url = plan?.source?.playbackUrl;
          if (options.priority === "intent" && url && plan && isPlayablePlaybackPlan(plan, videoId) && !prefetchedManifestsRef.current.has(url)) {
            prefetchedManifestsRef.current.add(url);
            prefetchManifest(url);
          }
          return plan;
        })
      : Promise.resolve(null);
    const tasks: Promise<unknown>[] = [planTask];

    if (options.includePoster !== false) {
      tasks.push(loadImage(video?.thumbnailUrl));
    }

    if (options.includeComments) {
      tasks.push(warmComments(videoId).catch(() => undefined));
    }

    const [plan] = await Promise.all(tasks);
    return (plan as PlaybackPlan | null) ?? null;
  }, [shouldWarmPlan, videosById, viewerKey, warmComments, warmPlaybackPlan]);

  const getPlaybackPlan = useCallback((videoId: string) => {
    if (!viewerKey) return null;
    const record = playbackRecords.current.get(`${viewerKey}\u0000${videoId}`);
    if (record?.viewerKey !== viewerKey || record.status !== "ready") return null;
    return record.plan;
  }, [viewerKey]);

  const invalidatePlaybackPlan = useCallback((videoId: string) => {
    if (!viewerKey) return;
    const cacheKey = `${viewerKey}\u0000${videoId}`;
    playbackRecords.current.get(cacheKey)?.controller?.abort();
    playbackRecords.current.delete(cacheKey);
  }, [viewerKey]);

  const markVideoActive = useCallback((videoId: string) => {
    activeVideoIdRef.current = videoId;
    void warmVideo(videoId, { includeComments: false, includePoster: true, priority: "critical" });
  }, [warmVideo]);

  useEffect(() => {
    for (const [cacheKey, record] of playbackRecords.current) {
      if (record.viewerKey === viewerKey) continue;
      record.controller?.abort();
      playbackRecords.current.delete(cacheKey);
    }
  }, [viewerKey]);

  useEffect(() => () => {
    for (const record of playbackRecords.current.values()) {
      record.controller?.abort();
    }
    playbackRecords.current.clear();
  }, []);

  useEffect(() => {
    activeVideoIdRef.current = selectedVideo?.id ?? null;
    setInitialReady(false);
    setInitialProgress(0);
    emitSplashProgress(0, false);

    let cancelled = false;
    async function boot() {
      const bootViewerKey = viewerKey;
      if (!bootViewerKey) return;

      if (!selectedVideo?.id) {
        updateProgress(100, true);
        return;
      }

      updateProgress(18);
      await Promise.resolve(document.fonts?.ready).catch(() => undefined);
      if (cancelled) return;
      updateProgress(34);

      await loadImage(selectedVideo.thumbnailUrl);
      if (cancelled) return;
      updateProgress(58);

      await warmVideo(selectedVideo.id, { includeComments: false, includePoster: false, priority: "critical" });
      if (cancelled) return;
      updateProgress(82);

      const nearby = allVideos.filter((video) => video.id !== selectedVideo.id).slice(0, 3);
      await Promise.all(nearby.map((video) => loadImage(video.thumbnailUrl)));
      if (cancelled) return;
      updateProgress(100, true);

      scheduleIdle(() => {
        if (cancelled) return;
        const next = allVideos.filter((video) => video.id !== selectedVideo.id).slice(0, 3);
        // Comments too: on touch devices there is no hover intent, so the idle warm-up
        // is what makes a tap on a nearby video land on ready comments.
        next.forEach((video) => void warmVideo(video.id, { includePoster: true, includeComments: true, priority: "nearby" }));
      });
    }

    void boot();
    return () => { cancelled = true; };
  }, [allVideos, selectedVideo?.id, selectedVideo?.thumbnailUrl, updateProgress, viewerKey, warmVideo]);

  const value = useMemo<AppPreloadContextValue>(() => ({
    viewerKey,
    getPlaybackPlan,
    invalidatePlaybackPlan,
    warmVideo,
    warmComments,
    markVideoActive,
    initialProgress,
    initialReady,
  }), [getPlaybackPlan, initialProgress, initialReady, invalidatePlaybackPlan, markVideoActive, viewerKey, warmComments, warmVideo]);

  return <AppPreloadContext.Provider value={value}>{children}</AppPreloadContext.Provider>;
}

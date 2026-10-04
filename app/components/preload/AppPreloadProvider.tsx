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
import { MediaWarmup, isConstrainedConnection, type ConnectionLike, type WarmupInput } from "./media-warmup";

export { resolvePlaybackViewerKey };

type PreloadStatus = "idle" | "loading" | "ready" | "error";

type WarmVideoOptions = {
  includeComments?: boolean;
  priority?: "critical" | "nearby" | "intent" | "idle";
  /** What showed the intent (only for "intent"): touch warms media only on a fast connection. */
  input?: WarmupInput;
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
  /** The intent shown with warmVideo ended before anything was picked (pointer left). */
  releaseVideoIntent: (videoId: string) => void;
  /** The viewer picked this video: stop warming the others. */
  selectVideo: (videoId: string) => void;
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

function scheduleIdle(callback: () => void) {
  if (typeof window === "undefined") return;
  const requestIdle = window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 250));
  requestIdle(() => callback(), { timeout: 1800 });
}

function currentConnection(): ConnectionLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: ConnectionLike }).connection;
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
  const videosById = useMemo(() => new Map(allVideos.map((video) => [video.id, video])), [allVideos]);
  // First seconds of hovered/focused videos (see media-warmup.ts). Created on first use, so the
  // server render never builds one.
  const mediaWarmupRef = useRef<MediaWarmup | null>(null);
  const getMediaWarmup = useCallback(() => (mediaWarmupRef.current ??= new MediaWarmup()), []);

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
    const warmsPlan = shouldWarmPlan(videoId, options.priority);
    // On intent, also warm the first seconds of the stream: the click then starts at once. Only
    // with a READY plan of exactly this video (a denied or premiere plan carries no URL).
    const warmsMedia = warmsPlan && options.priority === "intent";
    if (warmsMedia) getMediaWarmup().intend(videoId, options.input ?? "mouse");
    const planTask = warmsPlan
      ? warmPlaybackPlan(videoId).then((plan) => {
          const url = plan?.source?.playbackUrl;
          if (warmsMedia && url && plan && isPlayablePlaybackPlan(plan, videoId)) {
            getMediaWarmup().provide(videoId, url);
          }
          return plan;
        })
      : Promise.resolve(null);
    const tasks: Promise<unknown>[] = [planTask];

    if (options.includeComments) {
      tasks.push(warmComments(videoId).catch(() => undefined));
    }

    const [plan] = await Promise.all(tasks);
    return (plan as PlaybackPlan | null) ?? null;
  }, [getMediaWarmup, shouldWarmPlan, viewerKey, warmComments, warmPlaybackPlan]);

  const releaseVideoIntent = useCallback((videoId: string) => {
    mediaWarmupRef.current?.release(videoId);
  }, []);

  const selectVideo = useCallback((videoId: string) => {
    mediaWarmupRef.current?.select(videoId);
  }, []);

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
    mediaWarmupRef.current?.dispose();
    mediaWarmupRef.current = null;
  }, []);

  useEffect(() => {
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
      updateProgress(45);

      await warmVideo(selectedVideo.id, { includeComments: false, priority: "critical" });
      if (cancelled) return;
      updateProgress(100, true);

      // Comments of nearby videos: on touch devices there is no hover intent, so the idle
      // warm-up is what makes a tap on a nearby video land on ready comments. Skipped on Data
      // Saver and slow networks. It never warms plans or media ("nearby" opens no session).
      if (isConstrainedConnection(currentConnection())) return;
      scheduleIdle(() => {
        if (cancelled) return;
        const next = allVideos.filter((video) => video.id !== selectedVideo.id).slice(0, 3);
        next.forEach((video) => void warmVideo(video.id, { includeComments: true, priority: "nearby" }));
      });
    }

    void boot();
    return () => { cancelled = true; };
  }, [allVideos, selectedVideo?.id, updateProgress, viewerKey, warmVideo]);

  const value = useMemo<AppPreloadContextValue>(() => ({
    viewerKey,
    getPlaybackPlan,
    invalidatePlaybackPlan,
    warmVideo,
    warmComments,
    releaseVideoIntent,
    selectVideo,
    initialProgress,
    initialReady,
  }), [getPlaybackPlan, initialProgress, initialReady, invalidatePlaybackPlan, releaseVideoIntent, selectVideo, viewerKey, warmComments, warmVideo]);

  return <AppPreloadContext.Provider value={value}>{children}</AppPreloadContext.Provider>;
}

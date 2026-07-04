"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicVideoDTO } from "@/app/types/video";
import type { PlaybackPlan } from "@/lib/modules/playback";

type PreloadStatus = "idle" | "loading" | "ready" | "error";

type WarmVideoOptions = {
  includeComments?: boolean;
  includePoster?: boolean;
  priority?: "critical" | "nearby" | "intent" | "idle";
};

type PlaybackRecord = {
  status: PreloadStatus;
  plan: PlaybackPlan | null;
  promise?: Promise<PlaybackPlan | null>;
  error?: unknown;
};

type AppPreloadContextValue = {
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

export function AppPreloadProvider({
  children,
  selectedVideo,
  allVideos,
}: {
  children: React.ReactNode;
  selectedVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
}) {
  const queryClient = useQueryClient();
  const [initialProgress, setInitialProgress] = useState(0);
  const [initialReady, setInitialReady] = useState(false);
  const playbackRecords = useRef<Map<string, PlaybackRecord>>(new Map());
  const activeVideoIdRef = useRef<string | null>(selectedVideo?.id ?? null);
  const videosById = useMemo(() => new Map(allVideos.map((video) => [video.id, video])), [allVideos]);

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
    const existing = playbackRecords.current.get(videoId);
    if (existing?.status === "ready") return Promise.resolve(existing.plan);
    if (existing?.promise) return existing.promise;

    const promise = fetch(`/api/media-source/${encodeURIComponent(videoId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        playbackRecords.current.set(videoId, { status: "ready", plan: data });
        return data as PlaybackPlan | null;
      })
      .catch((error) => {
        playbackRecords.current.set(videoId, { status: "error", plan: null, error });
        return null;
      });

    playbackRecords.current.set(videoId, { status: "loading", plan: null, promise });
    return promise;
  }, []);

  const warmVideo = useCallback(async (videoId: string, options: WarmVideoOptions = {}) => {
    if (!videoId) return null;
    const video = videosById.get(videoId);
    const tasks: Promise<unknown>[] = [warmPlaybackPlan(videoId)];

    if (options.includePoster !== false) {
      tasks.push(loadImage(video?.thumbnailUrl));
    }

    if (options.includeComments) {
      tasks.push(warmComments(videoId).catch(() => undefined));
    }

    const [plan] = await Promise.all(tasks);
    return (plan as PlaybackPlan | null) ?? null;
  }, [videosById, warmComments, warmPlaybackPlan]);

  const getPlaybackPlan = useCallback((videoId: string) => {
    return playbackRecords.current.get(videoId)?.plan ?? null;
  }, []);

  const invalidatePlaybackPlan = useCallback((videoId: string) => {
    playbackRecords.current.delete(videoId);
  }, []);

  const markVideoActive = useCallback((videoId: string) => {
    activeVideoIdRef.current = videoId;
    void warmVideo(videoId, { includeComments: true, includePoster: true, priority: "critical" });
  }, [warmVideo]);

  useEffect(() => {
    activeVideoIdRef.current = selectedVideo?.id ?? null;
    setInitialReady(false);
    setInitialProgress(0);
    emitSplashProgress(0, false);

    let cancelled = false;
    async function boot() {
      if (!selectedVideo?.id) {
        updateProgress(100, true);
        return;
      }

      updateProgress(12);
      await Promise.resolve(document.fonts?.ready).catch(() => undefined);
      if (cancelled) return;
      updateProgress(25);

      await loadImage(selectedVideo.thumbnailUrl);
      if (cancelled) return;
      updateProgress(42);

      await warmVideo(selectedVideo.id, { includeComments: false, includePoster: false, priority: "critical" });
      if (cancelled) return;
      updateProgress(68);

      await warmComments(selectedVideo.id).catch(() => undefined);
      if (cancelled) return;
      updateProgress(82);

      const nearby = allVideos.filter((video) => video.id !== selectedVideo.id).slice(0, 3);
      await Promise.all(nearby.map((video) => loadImage(video.thumbnailUrl)));
      if (cancelled) return;
      updateProgress(100, true);

      scheduleIdle(() => {
        const next = allVideos.filter((video) => video.id !== selectedVideo.id).slice(0, 3);
        next.forEach((video) => void warmVideo(video.id, { includePoster: true, priority: "nearby" }));
      });
    }

    void boot();
    return () => { cancelled = true; };
  }, [allVideos, selectedVideo?.id, selectedVideo?.thumbnailUrl, updateProgress, warmComments, warmVideo]);

  const value = useMemo<AppPreloadContextValue>(() => ({
    getPlaybackPlan,
    invalidatePlaybackPlan,
    warmVideo,
    warmComments,
    markVideoActive,
    initialProgress,
    initialReady,
  }), [getPlaybackPlan, initialProgress, initialReady, invalidatePlaybackPlan, markVideoActive, warmComments, warmVideo]);

  return <AppPreloadContext.Provider value={value}>{children}</AppPreloadContext.Provider>;
}

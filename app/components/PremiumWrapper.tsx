"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@clerk/nextjs";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { RefreshCcw, AlertCircle } from "./icons";
import type {
  PlaybackPlan,
  PlaybackPlanStatus,
} from "@/lib/modules/playback";
import { AccessTierDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { PlayerLoadingState } from "./PlayerLoadingState";
import { PlayerStateFrame } from "./PlayerStateFrame";
import AccessLockOverlay from "./AccessLockOverlay";
import {
  resolvePlaybackViewerKey,
  useAppPreload,
} from "./preload/AppPreloadProvider";
import { VideoAccessContext, useVideoAccess } from "./VideoAccessContext";
import { useOptionalLanguage } from "./LanguageContext";
import {
  BLOCKED_PLAYBACK_STATES,
  PLAYBACK_PLAN_STATE_MESSAGES,
  PLAYBACK_PLAN_STATE_MESSAGES_EN,
  getSafePlaybackState,
  isPlayablePlaybackPlan,
} from "./playback-plan-state";

export { useVideoAccess };
export {
  PLAYBACK_PLAN_STATE_MESSAGES,
  getSafePlaybackState,
  isPlayablePlaybackPlan,
} from "./playback-plan-state";

function isAccessTierDto(value: unknown): value is AccessTierDto {
  return value === "PUBLIC" || value === "LOGGED_IN" || value === "PATRON";
}

interface PremiumWrapperProps {
  children: React.ReactNode;
  videoId: string;
  requiredTier?: AccessTierDto;
  isMainFeatured?: boolean;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
  onAccessLoad?: (hasAccess: boolean) => void;
}

export default function PremiumWrapper({
  children,
  videoId,
  requiredTier: initialTier,
  variant = "default",
  onAccessLoad,
}: PremiumWrapperProps) {
  const { userId, isLoaded, sessionId } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [playbackPlan, setPlaybackPlan] = useState<PlaybackPlan | null>(null);
  const [resolvedViewerKey, setResolvedViewerKey] = useState<string | null>(null);
  const [dbTier, setDbTier] = useState<AccessTierDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackPlanStatus | null>(
    null,
  );
  const preloader = useAppPreload();
  const authViewerKey = resolvePlaybackViewerKey({ isLoaded, userId, sessionId });
  const viewerKey = preloader
    ? preloader.viewerKey === authViewerKey
      ? authViewerKey
      : null
    : authViewerKey;
  const requestGenerationRef = useRef(0);
  const directRequestControllerRef = useRef<AbortController | null>(null);

  const effectiveTier = (initialTier || dbTier || "PUBLIC") as AccessTierDto;
  const isPublic = effectiveTier === "PUBLIC";

  const deniedState =
    effectiveTier === "PATRON" ? "PATRON_REQUIRED" : "LOGIN_REQUIRED";

  const getPreloadedPlaybackPlan = preloader?.getPlaybackPlan;
  const warmPreloadedVideo = preloader?.warmVideo;
  const invalidatePreloadedPlaybackPlan = preloader?.invalidatePlaybackPlan;

  const checkAccess = useCallback(async () => {
    const requestViewerKey = viewerKey;
    const requestGeneration = ++requestGenerationRef.current;
    directRequestControllerRef.current?.abort();
    directRequestControllerRef.current = null;

    setHasAccess(false);
    setPlaybackPlan(null);
    setResolvedViewerKey(null);
    setFetchError(null);
    setIsLoading(true);

    const isCurrentRequest = () =>
      requestGenerationRef.current === requestGeneration;

    if (!requestViewerKey) return;

    if (!userId && !isPublic) {
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState(deniedState);
      setFetchError(null);
      setResolvedViewerKey(requestViewerKey);
      setIsLoading(false);
      onAccessLoad?.(false);
      return;
    }

    try {
      let rawData: unknown = getPreloadedPlaybackPlan?.(videoId) ?? null;

      if (!rawData && warmPreloadedVideo) {
        rawData = await warmPreloadedVideo(videoId, {
          includePoster: true,
          priority: "critical",
        });
      } else if (!rawData) {
        const controller = new AbortController();
        directRequestControllerRef.current = controller;
        const response = await fetch(`/api/media-source/${encodeURIComponent(videoId)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        rawData = await response.json().catch(() => null);
      }

      if (!isCurrentRequest()) return;
      if (!rawData || typeof rawData !== "object") {
        throw new Error("Invalid playback plan response");
      }

      const data = rawData as Partial<PlaybackPlan> & {
        access?: {
          allowed?: unknown;
          reason?: unknown;
          requiredTier?: string;
        };
        hasAccess?: unknown;
        requiredTier?: string;
      };

      const nextState = getSafePlaybackState(
        data,
        !userId ? deniedState : false,
      );
      const nextHasAccess = isPlayablePlaybackPlan(data as PlaybackPlan, videoId);
      const requiredTier = data.requiredTier ?? data.access?.requiredTier;

      setHasAccess(nextHasAccess);
      onAccessLoad?.(nextHasAccess);
      setPlaybackState(nextState);
      setPlaybackPlan(nextHasAccess ? data as PlaybackPlan : null);
      if (isAccessTierDto(requiredTier)) setDbTier(requiredTier);
      setFetchError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      logger.error("Error checking video access:", error);
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState("ERROR");
      setFetchError("SOURCE_ERROR");
    } finally {
      if (isCurrentRequest()) {
        setResolvedViewerKey(requestViewerKey);
        setIsLoading(false);
      }
    }
  }, [deniedState, getPreloadedPlaybackPlan, isPublic, onAccessLoad, userId, videoId, viewerKey, warmPreloadedVideo]);

  useEffect(() => {
    void checkAccess();
    return () => {
      requestGenerationRef.current += 1;
      directRequestControllerRef.current?.abort();
      directRequestControllerRef.current = null;
    };
  }, [checkAccess]);

  const isCurrentViewerResolution =
    viewerKey !== null && resolvedViewerKey === viewerKey;
  const currentPlaybackPlan =
    isCurrentViewerResolution && isPlayablePlaybackPlan(playbackPlan, videoId)
      ? playbackPlan
      : null;

  const refreshPlaybackPlan = useCallback(async () => {
    invalidatePreloadedPlaybackPlan?.(videoId);
    await checkAccess();
  }, [checkAccess, invalidatePreloadedPlaybackPlan, videoId]);

  useEffect(() => {
    if (!currentPlaybackPlan?.source?.expiresAt) return;

    const expiresAt = new Date(currentPlaybackPlan.source.expiresAt).getTime();
    const refreshThresholdMs = 120 * 1000; // 2 minutes
    const now = Date.now();
    const msToRefresh = expiresAt - now - refreshThresholdMs;

    if (msToRefresh <= 0) {
      void refreshPlaybackPlan();
      return;
    }

    const timer = setTimeout(() => {
      void refreshPlaybackPlan();
    }, msToRefresh);

    return () => clearTimeout(timer);
  }, [currentPlaybackPlan, refreshPlaybackPlan]);

  const safePlaybackState = isCurrentViewerResolution ? playbackState : null;
  const safeFetchError = isCurrentViewerResolution ? fetchError : null;
  const safeIsLoading = !viewerKey || !isCurrentViewerResolution || isLoading;
  const safeHasAccess = Boolean(currentPlaybackPlan && hasAccess);

  const contextValue = {
    hasAccess: safeHasAccess,
    playbackPlan: currentPlaybackPlan,
    isLoading: safeIsLoading,
    effectiveTier,
    refreshPlaybackPlan,
  };

  if (safeIsLoading) {
    if (isLoaded && !userId && !isPublic) {
      return (
        <PlaybackPlanStateOverlay
          state={deniedState}
          onRetry={refreshPlaybackPlan}
          variant={variant}
        />
      );
    }
    return <PlayerLoadingState variant={variant} />;
  }

  if (safeHasAccess) {
    if (safeFetchError) {
      return (
        <PlaybackPlanStateOverlay
          state="ERROR"
          onRetry={refreshPlaybackPlan}
          variant={variant}
        />
      );
    }

    if (!playbackPlan || resolvedViewerKey !== viewerKey) {
      return (
        <PlaybackPlanStateOverlay
          state={safePlaybackState || "ERROR"}
          onRetry={refreshPlaybackPlan}
          variant={variant}
        />
      );
    }

    if (!isPlayablePlaybackPlan(playbackPlan)) {
      return (
        <PlaybackPlanStateOverlay
          state={safePlaybackState || playbackPlan.status || "ERROR"}
          onRetry={refreshPlaybackPlan}
          variant={variant}
        />
      );
    }

    return (
      <VideoAccessContext.Provider value={contextValue}>
        <div className="h-full w-full">{children}</div>
      </VideoAccessContext.Provider>
    );
  }

  return (
    <VideoAccessContext.Provider value={contextValue}>
      <PlaybackPlanStateOverlay
        state={
          safePlaybackState ||
          (effectiveTier === "PATRON" ? "PATRON_REQUIRED" : "LOGIN_REQUIRED")
        }
        onRetry={refreshPlaybackPlan}
        variant={variant}
      />
    </VideoAccessContext.Provider>
  );
}

interface PlaybackPlanStateOverlayProps {
  state: PlaybackPlanStatus;
  onRetry?: () => void;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

function PlaybackPlanStateOverlay({
  state,
  onRetry,
  variant,
}: PlaybackPlanStateOverlayProps) {
  const language = useOptionalLanguage();
  const safeState = BLOCKED_PLAYBACK_STATES.has(state) ? state : "ERROR";
  const content =
    (language === "pl" ? PLAYBACK_PLAN_STATE_MESSAGES : PLAYBACK_PLAN_STATE_MESSAGES_EN)[
      safeState as Exclude<PlaybackPlanStatus, "READY">
    ];
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  if (safeState === "LOGIN_REQUIRED" || safeState === "PATRON_REQUIRED") {
    return <AccessLockOverlay state={safeState} variant={variant} />;
  }

  return (
    <PlayerStateFrame className={isThumbnail ? "rounded-lg" : undefined}>
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--chan-nav)] p-6 text-center text-[var(--chan-ink)] [container-type:inline-size]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_srgb,var(--chan-blue)_10%,transparent),transparent_34%),radial-gradient(circle_at_84%_82%,color-mix(in_srgb,var(--chan-amber)_8%,transparent),transparent_30%)]"
        />

        <div className="relative z-10 flex max-w-md flex-col items-center gap-[clamp(12px,2cqi,20px)] rounded-[22px] border border-[color-mix(in_srgb,var(--chan-line)_82%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_90%,white)] px-[clamp(22px,5cqi,42px)] py-[clamp(24px,5cqi,38px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_54px_-28px_rgba(15,23,42,0.34)]">
          <div className="flex h-[clamp(56px,11cqi,72px)] w-[clamp(56px,11cqi,72px)] items-center justify-center rounded-[18px] border border-[color-mix(in_srgb,var(--chan-blue)_18%,var(--chan-line))] bg-[var(--chan-blue-soft)] text-[var(--chan-blue)] shadow-[0_14px_30px_-18px_color-mix(in_srgb,var(--chan-blue)_58%,transparent)]">
            <AlertCircle className="h-[clamp(28px,6cqi,36px)] w-[clamp(28px,6cqi,36px)]" />
          </div>

          <div className="flex flex-col gap-[clamp(8px,1.5cqi,12px)]">
            <h3 className="text-[clamp(18px,5cqi,28px)] font-bold leading-tight tracking-tight">
              {content.title}
            </h3>

            <p className="text-[clamp(12px,2.2cqi,15px)] leading-relaxed text-[var(--chan-muted)]">
              {content.description}
            </p>
          </div>

          {content.action === "support" && (
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ''}?subject=Problem%20z%20dost%C4%99pem%20do%20wideo`}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--chan-amber)] px-[clamp(20px,5cqi,32px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-[var(--chan-amber-ink)] shadow-[0_12px_26px_-14px_color-mix(in_srgb,var(--chan-amber)_70%,transparent)] transition-[transform,filter] duration-160 hover:-translate-y-px hover:brightness-[1.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-amber-strong)] focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {content.actionLabel}
            </a>
          )}

          {content.action === "retry" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[var(--chan-blue)] px-[clamp(20px,5cqi,32px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-white shadow-[0_12px_26px_-14px_color-mix(in_srgb,var(--chan-blue)_70%,transparent)] transition-[transform,background-color] duration-160 hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--chan-blue)_88%,black)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <RefreshCcw size={16} className="flex-shrink-0" aria-hidden="true" />
              <span>{content.actionLabel}</span>
            </button>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

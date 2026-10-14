"use client";

import { parseVideoAccessTier, toVideoAccessTier } from "@/lib/access-tier";
import { logger } from "@/lib/logger";
import { useAuth } from "@/lib/auth/react";
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
import { isUpcomingPremiere, toPremiereDate } from "@/lib/premiere";
import { usePremiereClock } from "@/lib/hooks/usePremiereClock";
import {
  resolvePlaybackViewerKey,
  useAppPreload,
} from "./preload/AppPreloadProvider";
import { VideoAccessContext, useVideoAccess } from "./VideoAccessContext";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { usePageRevealReady } from "./preload/PageRevealGate";
import { usePlaybackTokenRenewal } from "./player/usePlaybackTokenRenewal";
import {
  BLOCKED_PLAYBACK_STATES,
  getSafePlaybackState,
  playbackPlanStateMessages,
  isPlayablePlaybackPlan,
} from "./playback-plan-state";

export { useVideoAccess };
export {
  playbackPlanStateMessages,
  getSafePlaybackState,
  isPlayablePlaybackPlan,
} from "./playback-plan-state";

type PlanView = {
  hasAccess: boolean;
  playbackPlan: PlaybackPlan | null;
  playbackState: PlaybackPlanStatus | null;
  planPremiereAt: string | null;
  requiredTier: AccessTierDto | null;
};

/**
 * What the wrapper shows for a plan response. One place for both paths: a plan answered by
 * `/api/media-source` and a plan the server already rendered into the page. A plan that is not
 * playable for exactly this video is never handed to the player.
 */
function viewForPlan(rawData: unknown, videoId: string, isGuest: boolean): PlanView {
  const data = rawData as Partial<PlaybackPlan> & {
    access?: {
      allowed?: unknown;
      reason?: unknown;
      requiredTier?: string;
    };
    hasAccess?: unknown;
    requiredTier?: string;
  };
  const playbackState = getSafePlaybackState(data, isGuest ? "LOGIN_REQUIRED" : false);
  const hasAccess = isPlayablePlaybackPlan(data as PlaybackPlan, videoId);
  const requiredTier = data.requiredTier ?? data.access?.requiredTier;
  return {
    hasAccess,
    playbackPlan: hasAccess ? (data as PlaybackPlan) : null,
    playbackState,
    planPremiereAt: playbackState === "COMING_SOON" && typeof data.premiereAt === "string" ? data.premiereAt : null,
    requiredTier: parseVideoAccessTier(requiredTier),
  };
}

interface PremiumWrapperProps {
  children: React.ReactNode;
  videoId: string;
  /** The video's stored tier; anything but PUBLIC needs sign-in (lib/access-tier.ts). */
  requiredTier?: string;
  variant?: "default" | "thumbnail" | "thumbnailCompact";
  onAccessLoad?: (hasAccess: boolean) => void;
  /**
   * The video's scheduled premiere (PublicVideoDTO.premiereAt). While it is in the
   * future no playback plan is requested: signed-in viewers see the premiere
   * countdown, guests the sign-in lock (CLAUDE.md "Premieres"). At the premiere
   * the plan is requested and the video plays without a reload. Admin previews
   * omit it and rely on the server plan, which lets admins through.
   */
  premiereAt?: string | Date | null;
  /**
   * Reports to an enclosing PageRevealGate under this key once the player area
   * has settled into its final first state (player, lock, error or coming soon).
   */
  revealKey?: string;
}

export default function PremiumWrapper({
  children,
  videoId,
  requiredTier: initialTier,
  variant = "default",
  premiereAt,
  revealKey,
  onAccessLoad,
}: PremiumWrapperProps) {
  const { userId, isLoaded, sessionId } = useAuth();
  const premiereNow = usePremiereClock([premiereAt]);
  const isUpcoming = isUpcomingPremiere({ premiereAt }, premiereNow);
  const preloader = useAppPreload();
  const authViewerKey = resolvePlaybackViewerKey({ isLoaded, userId, sessionId });
  const viewerKey = preloader
    ? preloader.viewerKey === authViewerKey
      ? authViewerKey
      : null
    : authViewerKey;

  // A plan already in the preload cache for this viewer (the server renders the hero's plan into
  // the page) is the starting state: the player is in the first HTML instead of a loading frame
  // that waits for /api/media-source. The effect below still runs and confirms the same plan.
  const [initialView] = useState<{ viewerKey: string; view: PlanView } | null>(() => {
    if (!viewerKey || isUpcoming || !preloader) return null;
    const cached = preloader.getPlaybackPlan(videoId);
    if (!cached || cached.status === "COMING_SOON") return null;
    return { viewerKey, view: viewForPlan(cached, videoId, !userId) };
  });

  const [hasAccess, setHasAccess] = useState<boolean>(initialView?.view.hasAccess ?? false);
  const [playbackPlan, setPlaybackPlan] = useState<PlaybackPlan | null>(initialView?.view.playbackPlan ?? null);
  const [resolvedViewerKey, setResolvedViewerKey] = useState<string | null>(initialView?.viewerKey ?? null);
  const [dbTier, setDbTier] = useState<AccessTierDto | null>(initialView?.view.requiredTier ?? null);
  const [isLoading, setIsLoading] = useState(!initialView);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackPlanStatus | null>(
    initialView?.view.playbackState ?? null,
  );
  // Premiere time the server reported on a COMING_SOON plan (defensive: the DTO
  // is the primary signal, but the server clock has the last word).
  const [planPremiereAt, setPlanPremiereAt] = useState<string | null>(initialView?.view.planPremiereAt ?? null);
  const requestGenerationRef = useRef(0);
  const directRequestControllerRef = useRef<AbortController | null>(null);

  const effectiveTier = toVideoAccessTier(initialTier || dbTier || "PUBLIC");
  const isPublic = effectiveTier === "PUBLIC";

  // Signing in is the only gate (CLAUDE.md §4.4).
  const deniedState = "LOGIN_REQUIRED";

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
    setPlanPremiereAt(null);
    setIsLoading(true);

    const isCurrentRequest = () =>
      requestGenerationRef.current === requestGeneration;

    if (!requestViewerKey) return;

    // Upcoming premiere: nothing to request yet. This callback is re-created
    // (and the effect below re-runs) when the premiere is reached.
    if (isUpcoming) {
      setResolvedViewerKey(requestViewerKey);
      setIsLoading(false);
      onAccessLoad?.(false);
      return;
    }

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
      // A plan warmed before the premiere is stale once the page thinks it has
      // passed; ask again instead of showing the countdown forever.
      if ((rawData as Partial<PlaybackPlan> | null)?.status === "COMING_SOON") {
        invalidatePreloadedPlaybackPlan?.(videoId);
        rawData = null;
      }

      if (!rawData && warmPreloadedVideo) {
        rawData = await warmPreloadedVideo(videoId, { priority: "critical" });
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

      const view = viewForPlan(rawData, videoId, !userId);

      setHasAccess(view.hasAccess);
      onAccessLoad?.(view.hasAccess);
      setPlaybackState(view.playbackState);
      setPlanPremiereAt(view.planPremiereAt);
      setPlaybackPlan(view.playbackPlan);
      if (view.requiredTier) setDbTier(view.requiredTier);
      setFetchError(null);
    } catch (error) {
      if (!isCurrentRequest()) return;
      logger.error("Error checking video access:", error);
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState("ERROR");
      setFetchError("SOURCE_ERROR");
      onAccessLoad?.(false);
    } finally {
      if (isCurrentRequest()) {
        setResolvedViewerKey(requestViewerKey);
        setIsLoading(false);
      }
    }
  }, [deniedState, getPreloadedPlaybackPlan, invalidatePreloadedPlaybackPlan, isPublic, isUpcoming, onAccessLoad, userId, videoId, viewerKey, warmPreloadedVideo]);

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

  const renewPlaybackPlan = usePlaybackTokenRenewal({
    videoId,
    plan: currentPlaybackPlan,
    generationRef: requestGenerationRef,
    setPlan: setPlaybackPlan,
    invalidatePreloaded: invalidatePreloadedPlaybackPlan,
    refresh: refreshPlaybackPlan,
  });

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
    renewPlaybackPlan,
  };

  // Upcoming premiere, decided from the DTO before any plan fetch: signed-in
  // viewers get the countdown, guests the sign-in lock (whatever the tier).
  const showsComingSoon = isUpcoming && isLoaded && Boolean(userId);
  const showsGuestLock = isLoaded && !userId && (!isPublic || isUpcoming);

  // Server says COMING_SOON although our clock says the premiere passed (clock
  // skew): ask again at the server's premiere time, at most every 5 s.
  useEffect(() => {
    if (isUpcoming || safePlaybackState !== "COMING_SOON") return;
    const target = toPremiereDate(planPremiereAt)?.getTime() ?? 0;
    const timer = setTimeout(() => {
      void refreshPlaybackPlan();
    }, Math.max(target - Date.now(), 5_000));
    return () => clearTimeout(timer);
  }, [isUpcoming, planPremiereAt, refreshPlaybackPlan, safePlaybackState]);
  // Mirrors the branch below that mounts the player. When it does, the player itself
  // reports readiness (first frames buffered); every other settled state is final here.
  const rendersPlayer =
    safeHasAccess &&
    !safeFetchError &&
    resolvedViewerKey === viewerKey &&
    isPlayablePlaybackPlan(playbackPlan, videoId);
  usePageRevealReady(
    revealKey,
    showsComingSoon || showsGuestLock || (!safeIsLoading && !rendersPlayer),
  );

  if (showsComingSoon) {
    return <AccessLockOverlay state="COMING_SOON" variant={variant} premiereAt={premiereAt} />;
  }

  if (isUpcoming) {
    return showsGuestLock ? (
      <AccessLockOverlay state="LOGIN_REQUIRED" variant={variant} />
    ) : (
      <PlayerLoadingState variant={variant} />
    );
  }

  if (safeIsLoading) {
    if (showsGuestLock) {
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

    if (!isPlayablePlaybackPlan(playbackPlan, videoId)) {
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
        state={safePlaybackState || "LOGIN_REQUIRED"}
        onRetry={refreshPlaybackPlan}
        variant={variant}
        premiereAt={planPremiereAt}
      />
    </VideoAccessContext.Provider>
  );
}

interface PlaybackPlanStateOverlayProps {
  state: PlaybackPlanStatus;
  onRetry?: () => void;
  variant: "default" | "thumbnail" | "thumbnailCompact";
  /** Only for COMING_SOON: the premiere time the server reported. */
  premiereAt?: string | null;
}

function PlaybackPlanStateOverlay({
  state,
  onRetry,
  variant,
  premiereAt,
}: PlaybackPlanStateOverlayProps) {
  const tx = useOptionalTx();
  const safeState = BLOCKED_PLAYBACK_STATES.has(state) ? state : "ERROR";
  const content =
    playbackPlanStateMessages(tx)[
      safeState as Exclude<PlaybackPlanStatus, "READY">
    ];
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  if (safeState === "COMING_SOON") {
    return <AccessLockOverlay state="COMING_SOON" variant={variant} premiereAt={premiereAt} />;
  }

  if (safeState === "LOGIN_REQUIRED") {
    return <AccessLockOverlay state={safeState} variant={variant} />;
  }

  return (
    <PlayerStateFrame className={isThumbnail ? "rounded-lg" : undefined}>
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--chan-nav)] p-6 text-center text-[var(--chan-ink)] [container-type:inline-size]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,var(--cm-blue-10),transparent_34%),radial-gradient(circle_at_84%_82%,var(--cm-amber-8),transparent_30%)]"
        />

        <div className="relative z-10 flex max-w-md flex-col items-center gap-[clamp(12px,2cqi,20px)] rounded-[22px] border border-[var(--cm-line-82)] bg-[var(--cm-card-90-white-2)] px-[clamp(22px,5cqi,42px)] py-[clamp(24px,5cqi,38px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_54px_-28px_rgba(15,23,42,0.34)]">
          <div className="flex h-[clamp(56px,11cqi,72px)] w-[clamp(56px,11cqi,72px)] items-center justify-center rounded-[18px] border border-[var(--cm-blue-18-line)] bg-[var(--chan-blue-soft)] text-[var(--chan-blue)] shadow-[0_14px_30px_-18px_var(--cm-blue-58)]">
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
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[var(--chan-amber)] px-[clamp(20px,5cqi,32px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-[var(--chan-amber-ink)] shadow-[0_12px_26px_-14px_var(--cm-amber-70)] transition-[transform,filter] duration-160 hover:-translate-y-px hover:brightness-[1.04] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-amber-strong)] focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {content.actionLabel}
            </a>
          )}

          {content.action === "retry" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-[var(--chan-blue)] px-[clamp(20px,5cqi,32px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-white shadow-[0_12px_26px_-14px_var(--cm-blue-70)] transition-[transform,background-color] duration-160 hover:-translate-y-px hover:bg-[var(--cm-blue-88-black)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 motion-reduce:transition-none"
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

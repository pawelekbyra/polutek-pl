"use client";

import { logger } from "@/lib/logger";
import { useAuth } from "@clerk/nextjs";
import React, {
  createContext,
  useContext,
  useEffect,
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
import { useAppPreload } from "./preload/AppPreloadProvider";

interface VideoAccessContextType {
  hasAccess: boolean;
  playbackPlan: PlaybackPlan | null;
  isLoading: boolean;
  effectiveTier: AccessTierDto;
  refreshPlaybackPlan: () => Promise<void>;
}

const VideoAccessContext = createContext<VideoAccessContextType>({
  hasAccess: false,
  playbackPlan: null,
  isLoading: true,
  effectiveTier: "PUBLIC" as AccessTierDto,
  refreshPlaybackPlan: async () => {},
});

export const useVideoAccess = () => useContext(VideoAccessContext);

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
  const { userId, isLoaded } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [playbackPlan, setPlaybackPlan] = useState<PlaybackPlan | null>(null);
  const [dbTier, setDbTier] = useState<AccessTierDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackPlanStatus | null>(
    null,
  );
  const preloader = useAppPreload();
  const effectiveTier = (initialTier || dbTier || "PUBLIC") as AccessTierDto;
  const isPublic = effectiveTier === "PUBLIC";
  const isUnlockedByAuth = !!userId && effectiveTier === "LOGGED_IN";

  const deniedState =
    effectiveTier === "PATRON" ? "PATRON_REQUIRED" : "LOGIN_REQUIRED";

  const checkAccess = useCallback(async () => {
    if (isLoaded && !userId && !isPublic) {
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState(deniedState);
      setFetchError(null);
      setIsLoading(false);
      return;
    }

    if (!isLoaded && !isPublic) return;

    try {
      const warmedPlan = preloader?.getPlaybackPlan(videoId);
      const data = warmedPlan ?? await preloader?.warmVideo(videoId, { includePoster: true, priority: "critical" });

      if (data) {
        const warmedData: Partial<PlaybackPlan> & { access?: { allowed?: unknown; reason?: unknown; requiredTier?: string }; hasAccess?: unknown; requiredTier?: string } = data;
        const nextState = getSafePlaybackState(
          warmedData,
          !userId ? deniedState : false,
        );
        const nextHasAccess = Boolean(warmedData.hasAccess || warmedData.access?.allowed);
        setHasAccess(nextHasAccess);
        onAccessLoad?.(nextHasAccess);
        setPlaybackState(nextState);
        setPlaybackPlan(nextHasAccess ? (warmedData as PlaybackPlan) : null);
        const requiredTier = warmedData.requiredTier ?? warmedData.access?.requiredTier;
        if (isAccessTierDto(requiredTier)) setDbTier(requiredTier);
        setFetchError(null);
        return;
      }

      const response = await fetch(`/api/media-source/${videoId}`, { cache: "no-store" });
      const fetchedData = await response.json();

      const nextState = getSafePlaybackState(
        fetchedData,
        !userId ? deniedState : false,
      );

      if (!response.ok) {
        setHasAccess(false);
        setPlaybackPlan(null);
        setPlaybackState(nextState);
        if (fetchedData.requiredTier || fetchedData.access?.requiredTier)
          setDbTier(fetchedData.requiredTier || fetchedData.access.requiredTier);
        setFetchError(null);
        return;
      }

      const nextHasAccess = Boolean(fetchedData.hasAccess || fetchedData.access?.allowed);
      setHasAccess(nextHasAccess);
      onAccessLoad?.(nextHasAccess);
      setPlaybackState(nextState);
      if (nextHasAccess) {
        setPlaybackPlan(fetchedData);
      } else {
        setPlaybackPlan(null);
      }
      if (fetchedData.requiredTier || fetchedData.access?.requiredTier)
        setDbTier(fetchedData.requiredTier || fetchedData.access.requiredTier);
      setFetchError(null);
    } catch (error) {
      logger.error("Error checking video access:", error);
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState("ERROR");
      setFetchError("SOURCE_ERROR");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, userId, isPublic, videoId, onAccessLoad, deniedState, preloader]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!playbackPlan?.source?.expiresAt) return;

    const expiresAt = new Date(playbackPlan.source.expiresAt).getTime();
    const refreshThresholdMs = 120 * 1000; // 2 minutes
    const now = Date.now();
    const msToRefresh = expiresAt - now - refreshThresholdMs;

    if (msToRefresh <= 0) {
      preloader?.invalidatePlaybackPlan(videoId);
      checkAccess();
      return;
    }

    const timer = setTimeout(() => {
      preloader?.invalidatePlaybackPlan(videoId);
      checkAccess();
    }, msToRefresh);

    return () => clearTimeout(timer);
  }, [playbackPlan, checkAccess, preloader, videoId]);

  const contextValue = {
    hasAccess: isPublic || isUnlockedByAuth || hasAccess,
    playbackPlan,
    isLoading,
    effectiveTier,
    refreshPlaybackPlan: checkAccess,
  };

  if (isLoading) {
    if (isLoaded && !userId && !isPublic) {
      return (
        <PlaybackPlanStateOverlay
          state={deniedState}
          onRetry={checkAccess}
          variant={variant}
        />
      );
    }
    return <PlayerLoadingState variant={variant} />;
  }

  if (contextValue.hasAccess) {
    if (fetchError) {
      return (
        <PlaybackPlanStateOverlay
          state="ERROR"
          onRetry={checkAccess}
          variant={variant}
        />
      );
    }

    if (!playbackPlan) {
      return (
        <PlaybackPlanStateOverlay
          state={playbackState || "ERROR"}
          onRetry={checkAccess}
          variant={variant}
        />
      );
    }

    if (!isPlayablePlaybackPlan(playbackPlan)) {
      return (
        <PlaybackPlanStateOverlay
          state={playbackState || playbackPlan.status || "ERROR"}
          onRetry={checkAccess}
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
          playbackState ||
          (effectiveTier === "PATRON" ? "PATRON_REQUIRED" : "LOGIN_REQUIRED")
        }
        onRetry={checkAccess}
        variant={variant}
      />
    </VideoAccessContext.Provider>
  );
}

const SAFE_PLAYBACK_STATES: PlaybackPlanStatus[] = [
  "READY",
  "LOGIN_REQUIRED",
  "PATRON_REQUIRED",
  "VIDEO_NOT_READY",
  "NO_PRIMARY_ASSET",
  "PROCESSING",
  "UNAVAILABLE",
  "ERROR",
];

const BLOCKED_PLAYBACK_STATES = new Set<PlaybackPlanStatus>([
  "LOGIN_REQUIRED",
  "PATRON_REQUIRED",
  "VIDEO_NOT_READY",
  "NO_PRIMARY_ASSET",
  "PROCESSING",
  "UNAVAILABLE",
  "ERROR",
]);

export type PlaybackPlanStateAction = "login" | "support" | "retry";

export type PlaybackPlanStateMessage = {
  title: string;
  description: string;
  action: PlaybackPlanStateAction;
  actionLabel: string;
};

export const PLAYBACK_PLAN_STATE_MESSAGES: Record<
  Exclude<PlaybackPlanStatus, "READY">,
  PlaybackPlanStateMessage
> = {
  LOGIN_REQUIRED: {
    title: "Zaloguj się, aby obejrzeć materiał.",
    description:
      "Ten film jest dostępny po zalogowaniu. Samo logowanie nie nadaje patronatu ani zgody mailingowej.",
    action: "login",
    actionLabel: "Zaloguj się",
  },
  PATRON_REQUIRED: {
    title: "Materiał dla Patronów.",
    description:
      "Dostęp patrona jest nagrodą za kwalifikujące jednorazowe wsparcie. To nie jest subskrypcja cykliczna.",
    action: "support",
    actionLabel: "Wesprzyj jednorazowo",
  },
  VIDEO_NOT_READY: {
    title: "Materiał jest przygotowywany.",
    description:
      "Film został zapisany, ale nie jest jeszcze gotowy do bezpiecznego odtworzenia. Spróbuj odświeżyć za chwilę.",
    action: "retry",
    actionLabel: "Sprawdź ponownie",
  },
  PROCESSING: {
    title: "Trwa przetwarzanie wideo.",
    description:
      "Plik wideo jest przetwarzany przez system. Odtwarzacz pojawi się automatycznie, gdy materiał będzie gotowy.",
    action: "retry",
    actionLabel: "Odśwież stan",
  },
  NO_PRIMARY_ASSET: {
    title: "Materiał nie ma jeszcze aktywnego pliku wideo.",
    description:
      "Nie możemy teraz uruchomić odtwarzania. Spróbuj ponownie później albo skontaktuj się w sprawie dostępu.",
    action: "support",
    actionLabel: "Napisz w sprawie dostępu",
  },
  UNAVAILABLE: {
    title: "Materiał jest chwilowo niedostępny.",
    description:
      "Nie możemy teraz bezpiecznie przygotować odtwarzania. Spróbuj ponownie albo skontaktuj się w sprawie dostępu.",
    action: "support",
    actionLabel: "Napisz w sprawie dostępu",
  },
  ERROR: {
    title: "Nie udało się przygotować odtwarzania.",
    description:
      "Spróbuj ponownie. Jeśli problem wraca, napisz w sprawie dostępu i podaj tytuł filmu.",
    action: "retry",
    actionLabel: "Spróbuj ponownie",
  },
};

export function getSafePlaybackState(
  data:
    | (Partial<PlaybackPlan> & {
        status?: unknown;
        access?: { reason?: unknown };
        error?: unknown;
        hasAccess?: unknown;
      })
    | null
    | undefined,
  anonymousDenied: PlaybackPlanStatus | boolean = false,
): PlaybackPlanStatus {
  const candidates = [data?.status, data?.access?.reason, data?.error];
  const state = candidates.find(
    (candidate): candidate is PlaybackPlanStatus =>
      typeof candidate === "string" &&
      SAFE_PLAYBACK_STATES.includes(candidate as PlaybackPlanStatus),
  );

  if (state) return state;

  if (data?.hasAccess === true || data?.access?.allowed === true)
    return "READY";

  if (anonymousDenied) {
    return typeof anonymousDenied === "string"
      ? anonymousDenied
      : "LOGIN_REQUIRED";
  }

  return "ERROR";
}

export function isPlayablePlaybackPlan(
  plan: PlaybackPlan | null,
): plan is PlaybackPlan & { status: "READY" } {
  return Boolean(
    plan && (plan.status === "READY" || !plan.status) && plan.canPlay !== false,
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
  const safeState = BLOCKED_PLAYBACK_STATES.has(state) ? state : "ERROR";
  const content =
    PLAYBACK_PLAN_STATE_MESSAGES[
      safeState as Exclude<PlaybackPlanStatus, "READY">
    ];
  const isThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";

  if (safeState === "LOGIN_REQUIRED" || safeState === "PATRON_REQUIRED") {
    return <AccessLockOverlay state={safeState} variant={variant} />;
  }

  return (
    <PlayerStateFrame className={isThumbnail ? "rounded-lg" : undefined}>
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-center text-white [container-type:inline-size]">
        {/* Subtle accent gradient accent in background */}
        <div className="absolute inset-0 z-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 flex max-w-md flex-col items-center gap-[clamp(12px,2cqi,20px)]">
          {/* Icon Circle */}
          <div className="flex h-[clamp(56px,11cqi,72px)] w-[clamp(56px,11cqi,72px)] items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm shadow-lg">
            <AlertCircle className="h-[clamp(28px,6cqi,36px)] w-[clamp(28px,6cqi,36px)] text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-[clamp(8px,1.5cqi,12px)]">
            <h3 className="text-[clamp(18px,5cqi,28px)] font-bold tracking-tight leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
              {content.title}
            </h3>

            <p className="text-[clamp(12px,2.2cqi,15px)] leading-relaxed text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
              {content.description}
            </p>
          </div>

          {/* Action Button */}
          {content.action === "support" && (
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ''}?subject=Problem%20z%20dost%C4%99pem%20do%20wideo`}
              className="mt-2 inline-flex items-center justify-center rounded-[14px] border border-white/30 bg-white/10 hover:bg-white/20 px-[clamp(20px,5cqi,32px)] py-[clamp(10px,2cqi,14px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-all duration-200 active:scale-95 hover:shadow-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
            >
              {content.actionLabel}
            </a>
          )}

          {content.action === "retry" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center justify-center rounded-[14px] border border-white/30 bg-white/10 hover:bg-white/20 px-[clamp(20px,5cqi,32px)] py-[clamp(10px,2cqi,14px)] text-[clamp(11px,2.4cqi,14px)] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition-all duration-200 active:scale-95 hover:shadow-lg gap-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
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

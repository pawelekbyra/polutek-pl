"use client";

import { logger } from "@/lib/logger";
import { useAuth, SignInButton } from "@clerk/nextjs";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { Gem, Lock, RefreshCcw, AlertCircle } from "./icons";
import type {
  PlaybackPlan,
  PlaybackPlanStatus,
} from "@/lib/services/playback/playback.dto";
import { AccessTierDto } from "@/lib/services/comments/comment.dto";
import { PlayerSkeleton } from "@/components/skeletons";
import { PlayerStateFrame } from "./PlayerStateFrame";

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

interface PremiumWrapperProps {
  children: React.ReactNode;
  videoId: string;
  requiredTier?: AccessTierDto;
  isMainFeatured?: boolean;
  variant?: "default" | "thumbnail";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTier = (initialTier || dbTier || "PUBLIC") as AccessTierDto;
  const isPublic = effectiveTier === "PUBLIC";
  const isUnlockedByAuth = !!userId && effectiveTier === "LOGGED_IN";

  const checkAccess = useCallback(async () => {
    if (isLoaded && !userId && !isPublic) {
      setHasAccess(false);
      setPlaybackPlan(null);
      setPlaybackState("LOGIN_REQUIRED");
      setFetchError(null);
      setIsLoading(false);
      return;
    }

    if (!isLoaded && !isPublic) return;

    try {
      const response = await fetch(`/api/media-source/${videoId}`);
      const data = await response.json();

      const nextState = getSafePlaybackState(data, !userId);

      if (!response.ok) {
        setHasAccess(false);
        setPlaybackPlan(null);
        setPlaybackState(nextState);
        if (data.requiredTier || data.access?.requiredTier)
          setDbTier(data.requiredTier || data.access.requiredTier);
        setFetchError(null);
        return;
      }

      const nextHasAccess = Boolean(data.hasAccess || data.access?.allowed);
      setHasAccess(nextHasAccess);
      onAccessLoad?.(nextHasAccess);
      setPlaybackState(nextState);
      if (nextHasAccess) {
        setPlaybackPlan(data);
      } else {
        setPlaybackPlan(null);
      }
      if (data.requiredTier || data.access?.requiredTier)
        setDbTier(data.requiredTier || data.access.requiredTier);
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
  }, [isLoaded, userId, isPublic, videoId, onAccessLoad]);

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
      checkAccess();
      return;
    }

    const timer = setTimeout(() => {
      checkAccess();
    }, msToRefresh);

    return () => clearTimeout(timer);
  }, [playbackPlan, checkAccess]);

  if (!mounted) {
    return (
      <PlayerStateFrame>
        <PlayerSkeleton />
      </PlayerStateFrame>
    );
  }

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
          state="LOGIN_REQUIRED"
          onRetry={checkAccess}
          variant={variant}
        />
      );
    }
    return (
      <PlayerStateFrame>
        <PlayerSkeleton />
      </PlayerStateFrame>
    );
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
        <div className="animate-in fade-in duration-500 h-full w-full">
          {children}
        </div>
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
      "Film został zapisany, ale nie jest jeszcze gotowy do bezpiecznego odtworzenia. Wróć za chwilę.",
    action: "retry",
    actionLabel: "Sprawdź ponownie",
  },
  PROCESSING: {
    title: "Trwa przygotowanie materiału.",
    description:
      "Plik wideo jest przetwarzany. Odtwarzacz pojawi się dopiero, gdy materiał będzie gotowy.",
    action: "retry",
    actionLabel: "Sprawdź ponownie",
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
  anonymousDenied = false,
): PlaybackPlanStatus {
  if (anonymousDenied) return "LOGIN_REQUIRED";

  const candidates = [data?.status, data?.access?.reason, data?.error];
  const state = candidates.find(
    (candidate): candidate is PlaybackPlanStatus =>
      typeof candidate === "string" &&
      SAFE_PLAYBACK_STATES.includes(candidate as PlaybackPlanStatus),
  );

  if (state) return state;

  if (data?.hasAccess === true || data?.access?.allowed === true)
    return "READY";

  return "ERROR";
}

export function isPlayablePlaybackPlan(
  plan: PlaybackPlan | null,
): plan is PlaybackPlan & { status: "READY" } {
  return Boolean(
    plan && (plan.status === "READY" || !plan.status) && plan.canPlay !== false,
  );
}

function PlaybackPlanStateOverlay({
  state,
  onRetry,
  variant,
}: {
  state: PlaybackPlanStatus;
  onRetry?: () => void;
  variant: "default" | "thumbnail";
}) {
  const safeState = BLOCKED_PLAYBACK_STATES.has(state) ? state : "ERROR";
  const content =
    PLAYBACK_PLAN_STATE_MESSAGES[
      safeState as Exclude<PlaybackPlanStatus, "READY">
    ];
  const isPatronState = safeState === "PATRON_REQUIRED";
  const isThumbnail = variant === "thumbnail";

  return (
    <PlayerStateFrame className={isThumbnail ? "rounded-lg" : undefined}>
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 text-center animate-in fade-in duration-500 [container-type:inline-size]">
        <div
          className={cn(
            "absolute inset-0 z-0 opacity-60",
            isPatronState
              ? "bg-gradient-to-br from-amber-900 via-black to-amber-950"
              : "bg-gradient-to-br from-blue-950 via-black to-neutral-950",
          )}
        />

        <div className="relative z-10 flex max-w-md flex-col items-center">
          <div
            className={cn(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-full border",
              isPatronState
                ? "border-amber-500/20 bg-amber-500/10"
                : "border-white/10 bg-white/5",
            )}
          >
            {isPatronState ? (
              <Gem className="h-8 w-8 text-amber-500" />
            ) : safeState === "LOGIN_REQUIRED" ? (
              <Lock className="h-8 w-8 text-blue-400" />
            ) : (
              <AlertCircle className="h-8 w-8 text-neutral-200" />
            )}
          </div>

          <h3 className="text-[min(1.2rem,6cqi)] font-black uppercase tracking-tight mb-2">
            {content.title}
          </h3>

          <p className="text-[min(0.875rem,4cqi)] text-neutral-300 max-w-sm mb-6 leading-relaxed">
            {content.description}
          </p>

          {content.action === "login" && (
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-[min(11px,3cqi)] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
              >
                {content.actionLabel}
              </button>
            </SignInButton>
          )}

          {content.action === "support" && (
            <a
              href={
                safeState === "PATRON_REQUIRED"
                  ? "#donations"
                  : "mailto:pawel.perfect@gmail.com?subject=Problem%20z%20dost%C4%99pem%20do%20wideo"
              }
              className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-[min(11px,3cqi)] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
            >
              {content.actionLabel}
            </a>
          )}

          {content.action === "retry" && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-8 py-3 text-[min(11px,3cqi)] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
            >
              <RefreshCcw size={14} className="mr-2" aria-hidden="true" />
              {content.actionLabel}
            </button>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

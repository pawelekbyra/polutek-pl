import type {
  PlaybackPlan,
  PlaybackPlanStatus,
} from "@/lib/modules/playback";

const SAFE_PLAYBACK_STATES: PlaybackPlanStatus[] = [
  "READY",
  "LOGIN_REQUIRED",
  "COMING_SOON",
  "VIDEO_NOT_READY",
  "NO_PRIMARY_ASSET",
  "PROCESSING",
  "UNAVAILABLE",
  "ERROR",
];

export const BLOCKED_PLAYBACK_STATES = new Set<PlaybackPlanStatus>([
  "LOGIN_REQUIRED",
  "COMING_SOON",
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
      "Ten film jest dostępny po zalogowaniu. Konto jest bezpłatne.",
    action: "login",
    actionLabel: "Zaloguj się",
  },
  // Rendered as the premiere countdown (AccessLockOverlay); this copy is only the fallback text.
  COMING_SOON: {
    title: "Premiera już wkrótce.",
    description:
      "Ten film ma zaplanowaną premierę. Odtwarzanie ruszy automatycznie w chwili premiery.",
    action: "retry",
    actionLabel: "Sprawdź ponownie",
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

export const PLAYBACK_PLAN_STATE_MESSAGES_EN: typeof PLAYBACK_PLAN_STATE_MESSAGES = {
  LOGIN_REQUIRED: {
    title: "Sign in to watch this video.",
    description:
      "This video is available after signing in. An account is free.",
    action: "login",
    actionLabel: "Sign in",
  },
  COMING_SOON: {
    title: "Premiere coming soon.",
    description:
      "This video has a scheduled premiere. Playback starts automatically at the premiere.",
    action: "retry",
    actionLabel: "Check again",
  },
  VIDEO_NOT_READY: {
    title: "This video is being prepared.",
    description:
      "The video is saved but is not ready for secure playback yet. Please check again shortly.",
    action: "retry",
    actionLabel: "Check again",
  },
  PROCESSING: {
    title: "The video is processing.",
    description:
      "The player will appear automatically when processing is complete.",
    action: "retry",
    actionLabel: "Refresh status",
  },
  NO_PRIMARY_ASSET: {
    title: "This video does not have an active media file yet.",
    description:
      "Playback cannot start right now. Please try again later or contact us about access.",
    action: "support",
    actionLabel: "Contact support",
  },
  UNAVAILABLE: {
    title: "This video is temporarily unavailable.",
    description:
      "We cannot prepare secure playback right now. Please try again or contact us about access.",
    action: "support",
    actionLabel: "Contact support",
  },
  ERROR: {
    title: "Playback could not be prepared.",
    description:
      "Try again. If the problem continues, contact us and include the video title.",
    action: "retry",
    actionLabel: "Try again",
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
  expectedVideoId?: string,
): plan is PlaybackPlan & {
  status: "READY";
  canPlay: true;
  access: PlaybackPlan["access"] & { allowed: true };
  source: NonNullable<PlaybackPlan["source"]>;
} {
  return Boolean(
    plan &&
      plan.status === "READY" &&
      plan.canPlay === true &&
      plan.access?.allowed === true &&
      plan.source &&
      plan.source.playbackUrl &&
      (!expectedVideoId || plan.videoId === expectedVideoId),
  );
}

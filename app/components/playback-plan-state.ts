import type { Tx } from "@/lib/i18n/ui";
import type {
  PlaybackPlan,
  PlaybackPlanStatus,
} from "@/lib/modules/playback";

const SAFE_PLAYBACK_STATES: PlaybackPlanStatus[] = [
  "READY",
  "LOGIN_REQUIRED",
  "COMING_SOON",
  "PASS_REQUIRED", // patron zone (docs/architecture/patron-zone.md)
  "VIDEO_NOT_READY",
  "NO_PRIMARY_ASSET",
  "PROCESSING",
  "UNAVAILABLE",
  "ERROR",
];

export const BLOCKED_PLAYBACK_STATES = new Set<PlaybackPlanStatus>([
  "LOGIN_REQUIRED",
  "COMING_SOON",
  "PASS_REQUIRED", // patron zone (docs/architecture/patron-zone.md)
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

/**
 * Fallback texts for a video that cannot play yet. Built per language by `tx`
 * (lib/i18n/ui.ts), so every language has the same states.
 */
export function playbackPlanStateMessages(
  tx: Tx,
): Record<Exclude<PlaybackPlanStatus, "READY">, PlaybackPlanStateMessage> {
  return {
    LOGIN_REQUIRED: {
      title: tx("Zaloguj się, aby obejrzeć materiał.", "Sign in to watch this video."),
      description: tx(
        "Ten film jest dostępny po zalogowaniu. Konto jest bezpłatne.",
        "This video is available after signing in. An account is free.",
      ),
      action: "login",
      actionLabel: tx("Zaloguj się", "Sign in"),
    },
    // Rendered as the premiere countdown (AccessLockOverlay); this copy is only the fallback text.
    COMING_SOON: {
      title: tx("Premiera już wkrótce.", "Premiere coming soon."),
      description: tx(
        "Ten film ma zaplanowaną premierę. Odtwarzanie ruszy automatycznie w chwili premiery.",
        "This video has a scheduled premiere. Playback starts automatically at the premiere.",
      ),
      action: "retry",
      actionLabel: tx("Sprawdź ponownie", "Check again"),
    },
    // patron zone: rendered as PremiumPassOverlay; this copy is only the fallback text.
    PASS_REQUIRED: {
      title: tx("Ten film jest w strefie patrona.", "This video is in the patron zone."),
      description: tx(
        "Zostań patronem projektu, aby go obejrzeć.",
        "Become a patron of the project to watch it.",
      ),
      action: "retry",
      actionLabel: tx("Sprawdź ponownie", "Check again"),
    },
    VIDEO_NOT_READY: {
      title: tx("Materiał jest przygotowywany.", "This video is being prepared."),
      description: tx(
        "Film został zapisany, ale nie jest jeszcze gotowy do bezpiecznego odtworzenia. Spróbuj odświeżyć za chwilę.",
        "The video is saved but is not ready for secure playback yet. Please check again shortly.",
      ),
      action: "retry",
      actionLabel: tx("Sprawdź ponownie", "Check again"),
    },
    PROCESSING: {
      title: tx("Trwa przetwarzanie wideo.", "The video is processing."),
      description: tx(
        "Plik wideo jest przetwarzany przez system. Odtwarzacz pojawi się automatycznie, gdy materiał będzie gotowy.",
        "The player will appear automatically when processing is complete.",
      ),
      action: "retry",
      actionLabel: tx("Odśwież stan", "Refresh status"),
    },
    NO_PRIMARY_ASSET: {
      title: tx("Materiał nie ma jeszcze aktywnego pliku wideo.", "This video does not have an active media file yet."),
      description: tx(
        "Nie możemy teraz uruchomić odtwarzania. Spróbuj ponownie później albo skontaktuj się w sprawie dostępu.",
        "Playback cannot start right now. Please try again later or contact us about access.",
      ),
      action: "support",
      actionLabel: tx("Napisz w sprawie dostępu", "Contact support"),
    },
    UNAVAILABLE: {
      title: tx("Materiał jest chwilowo niedostępny.", "This video is temporarily unavailable."),
      description: tx(
        "Nie możemy teraz bezpiecznie przygotować odtwarzania. Spróbuj ponownie albo skontaktuj się w sprawie dostępu.",
        "We cannot prepare secure playback right now. Please try again or contact us about access.",
      ),
      action: "support",
      actionLabel: tx("Napisz w sprawie dostępu", "Contact support"),
    },
    ERROR: {
      title: tx("Nie udało się przygotować odtwarzania.", "Playback could not be prepared."),
      description: tx(
        "Spróbuj ponownie. Jeśli problem wraca, napisz w sprawie dostępu i podaj tytuł filmu.",
        "Try again. If the problem continues, contact us and include the video title.",
      ),
      action: "retry",
      actionLabel: tx("Spróbuj ponownie", "Try again"),
    },
  };
}

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

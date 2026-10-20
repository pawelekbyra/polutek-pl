import type { Chapter } from "@/lib/video-chapters";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass"; // experiment: premium-pass

export type PlaybackPlanStatus =
  | "READY"
  | "LOGIN_REQUIRED"
  // Scheduled premiere not reached yet (signed-in viewer). Guests get LOGIN_REQUIRED instead.
  | "COMING_SOON"
  // experiment: premium-pass (docs/experiments/premium-pass.md): video behind the demo pass; the plan carries `access.offer`.
  | "PASS_REQUIRED"
  | "VIDEO_NOT_READY"
  | "NO_PRIMARY_ASSET"
  | "PROCESSING"
  | "UNAVAILABLE"
  | "ERROR";

export type PlaybackAssetProvider = "SELF_HLS" | string;

export type PlaybackAssetContract = {
  provider: PlaybackAssetProvider;
  processingState?: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | string;
  isPrimary: boolean;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type VideoTextTrackContract = {
  src: string;
  label: string;
  language: string;
  kind: 'subtitles' | 'captions';
  default?: boolean;
};

export type PlaybackSourceContract = {
  provider: string;
  kind: string;
  /**
   * Signed own-HLS master playlist URL (token in the path, CLAUDE.md 4.17). Never a raw
   * object-storage URL.
   */
  playbackUrl?: string;
  posterUrl?: string;
  mimeType?: string;
  isSignedUrl: boolean;
  expiresAt?: string;
  asset?: PlaybackAssetContract;
};

export type PlaybackPlan = {
  videoId: string;
  status: PlaybackPlanStatus;
  canPlay: boolean;
  /** ISO premiere time; only set on a COMING_SOON plan. */
  premiereAt?: string;
  access: {
    allowed: boolean;
    reason?: string;
    requiredTier?: string;
    /** experiment: premium-pass: only on a PASS_REQUIRED plan (prices of the demo passes, never access data). */
    offer?: PremiumPassOffer;
    /** experiment: premium-pass: only on a playable plan of a pass video, ISO end of the viewer's pass. */
    premiumPassUntil?: string;
  };
  source?: PlaybackSourceContract;
  player: {
    autoplayAllowed: boolean;
    mutedAutoplay: boolean;
    controls: boolean;
    poster: string;
    title: string;
    textTracks?: VideoTextTrackContract[];
    /** Chapters of the video; only a plan that can play carries them (like subtitles), absent without chapters. */
    chapters?: Chapter[];
  };
  diagnostics: {
    warnings: string[];
    sourceConfidence: "HIGH" | "MEDIUM" | "LOW";
    providerResolutionAllowed: boolean;
    providerResolutionAttempted: boolean;
    sourceMode?: "PROVIDER_ASSET" | "LEGACY_URL" | "NONE";
    asset?: PlaybackAssetContract;
  };
  tracking: {
    playbackSessionId: string;
    heartbeatIntervalSeconds: number;
  };
};

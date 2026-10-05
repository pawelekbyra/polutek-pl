export type PlaybackPlanStatus =
  | "READY"
  | "LOGIN_REQUIRED"
  // Scheduled premiere not reached yet (signed-in viewer). Guests get LOGIN_REQUIRED instead.
  | "COMING_SOON"
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
  };
  source?: PlaybackSourceContract;
  player: {
    autoplayAllowed: boolean;
    mutedAutoplay: boolean;
    controls: boolean;
    poster: string;
    title: string;
    textTracks?: VideoTextTrackContract[];
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

export type PlaybackPlanStatus =
  | "READY"
  | "LOGIN_REQUIRED"
  | "PATRON_REQUIRED"
  | "VIDEO_NOT_READY"
  | "NO_PRIMARY_ASSET"
  | "PROCESSING"
  | "UNAVAILABLE"
  | "ERROR";

export type PlaybackAssetProvider =
  | "CLOUDFLARE_STREAM"
  | "MUX"
  | "R2"
  | "S3"
  | "VERCEL_BLOB"
  | "LEGACY_URL"
  | string;

export type PlaybackAssetContract = {
  provider: PlaybackAssetProvider;
  processingState?: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | string;
  isPrimary: boolean;
  providerAssetId?: string | null;
  providerPlaybackId?: string | null;
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
   * Public playback endpoint or safe external embed URL only. Never a raw object-storage,
   * provider-origin, or signed provider URL for private patron playback.
   */
  playbackUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  mimeType?: string;
  needsProxy: boolean;
  isExternalEmbed: boolean;
  isSignedUrl: boolean;
  expiresAt?: string;
  asset?: PlaybackAssetContract;
};

export type PlaybackPlan = {
  videoId: string;
  status: PlaybackPlanStatus;
  canPlay: boolean;
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

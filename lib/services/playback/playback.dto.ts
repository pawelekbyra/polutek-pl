export type PlaybackPlan = {
  videoId: string;
  canPlay: boolean;
  access: {
    allowed: boolean;
    reason?: string;
    requiredTier?: string;
  };
  source?: {
    provider: string;
    kind: string;
    playbackUrl: string;
    embedUrl?: string;
    posterUrl?: string;
    mimeType?: string;
    needsProxy: boolean;
    isExternalEmbed: boolean;
    isSignedUrl: boolean;
    expiresAt?: string;
  };
  player: {
    autoplayAllowed: boolean;
    mutedAutoplay: boolean;
    controls: boolean;
    poster: string;
    title: string;
  };
  diagnostics: {
    warnings: string[];
    sourceConfidence: "HIGH" | "MEDIUM" | "LOW";
  };
  tracking: {
    playbackSessionId: string;
    heartbeatIntervalSeconds: number;
  };
};

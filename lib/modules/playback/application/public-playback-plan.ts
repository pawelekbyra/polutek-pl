import { MediaPolicy } from '@/lib/modules/media';
import type { PlaybackPlan } from '../domain/playback.dto';

/** What a plan looks like when it leaves the server (API response or server-rendered page). */
export type PublicPlaybackPlan = PlaybackPlan & {
  /** Legacy compatibility fields, derived from the plan; set only for a playable plan. */
  hasAccess: boolean;
  kind?: string;
  playbackUrl?: string;
};

/**
 * The one sanitizer every playback plan passes before it reaches a browser, whether through
 * `GET /api/media-source/[videoId]` or inside the server-rendered home page (CLAUDE.md 4.3):
 *  - a raw storage/provider URL is never sent: the plan becomes not playable (`onRawUrlBlocked`);
 *  - a warning that looks like a media URL is redacted;
 *  - a plan that cannot play carries no source, no playback session and no heartbeat.
 */
export function toPublicPlaybackPlan(
  plan: PlaybackPlan,
  options: { onRawUrlBlocked?: () => void } = {},
): PublicPlaybackPlan {
  let playbackPlan = plan;

  if (playbackPlan.source?.playbackUrl && MediaPolicy.isProbablyRawMediaUrl(playbackPlan.source.playbackUrl)) {
    options.onRawUrlBlocked?.();
    playbackPlan = { ...playbackPlan, status: 'ERROR', canPlay: false, source: undefined };
  }

  if (playbackPlan.diagnostics?.warnings) {
    playbackPlan = {
      ...playbackPlan,
      diagnostics: {
        ...playbackPlan.diagnostics,
        warnings: playbackPlan.diagnostics.warnings.map((w) => (MediaPolicy.isProbablyRawMediaUrl(w) ? '[REDACTED]' : w)),
      },
    };
  }

  const hasPlayableSource = isPlayableServerPlan(playbackPlan);

  const safePlaybackPlan: PlaybackPlan = hasPlayableSource
    ? playbackPlan
    : {
        ...playbackPlan,
        source: undefined,
        tracking: {
          ...playbackPlan.tracking,
          playbackSessionId: '',
          heartbeatIntervalSeconds: 0,
        },
      };

  return {
    ...safePlaybackPlan,
    hasAccess: safePlaybackPlan.access.allowed,
    kind: hasPlayableSource ? safePlaybackPlan.source?.kind : undefined,
    playbackUrl: hasPlayableSource ? safePlaybackPlan.source?.playbackUrl : undefined,
  };
}

/** Allowed, READY and carrying a delivery URL: the only plan a player may mount. */
export function isPlayableServerPlan(plan: PlaybackPlan): boolean {
  return Boolean(
    plan.access.allowed
      && plan.canPlay
      && plan.status === 'READY'
      && plan.source?.playbackUrl,
  );
}

import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { PlaybackService } from "@/lib/modules/playback";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildMediaRateLimitKey,
  getMediaClientIp,
} from "@/lib/media/rate-limit";
import { recordAlert } from "@/lib/observability";
import { handleApiError } from "@/lib/errors";
import crypto from "crypto";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { MediaPolicy } from "@/lib/modules/media";

export const dynamic = "force-dynamic";

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function GET(req: NextRequest, props: { params: Promise<{ videoId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const videoId = params.videoId;

  if (!videoId) {
    return NextResponse.json(
      { error: "Video ID is required" },
      { status: 400 },
    );
  }

  try {
    const actor = await getActorFromAuth();
    const rateLimitResult = await rateLimit({
      key: `media-source:${buildMediaRateLimitKey({ userId: actor.type === "user" ? actor.userId : null, ip: getMediaClientIp(req), mediaId: videoId })}`,
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.success) {
      recordAlert("media_source.rate_limited", { videoId });
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Zbyt wiele zapytań o źródło wideo. Spróbuj za chwilę.",
        },
        { status: 429 },
      );
    }

    const ip = getMediaClientIp(req) || "unknown";
    const ua = req.headers.get("user-agent") || "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    const uaHash = crypto.createHash("sha256").update(ua).digest("hex");

    // `?session=<id>`: an open player renewing its delivery token keeps its playback session
    // (PlaybackService still runs the full access check and decides whether the id may be kept).
    const sessionParam = req.nextUrl.searchParams.get("session");
    const reuseSessionId = sessionParam && SESSION_ID_RE.test(sessionParam) ? sessionParam : undefined;

    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    let playbackPlan = await PlaybackService.createPlaybackPlanWithContext(
      videoId,
      ctx,
      ipHash,
      uaHash,
      { reuseSessionId },
    );

    // Safety net: a raw storage/provider URL must never reach the browser. Own HLS plans carry
    // only the token-checked delivery URL; anything else is dropped, the plan is not playable.
    if (playbackPlan.source?.playbackUrl && MediaPolicy.isProbablyRawMediaUrl(playbackPlan.source.playbackUrl)) {
      scopedLogger.error("[MEDIA_SOURCE_RAW_URL_BLOCKED]", { videoId });
      playbackPlan = { ...playbackPlan, status: "ERROR", canPlay: false, source: undefined };
    }

    // Ensure diagnostics don't leak anything sensitive
    if (playbackPlan.diagnostics.warnings) {
      playbackPlan.diagnostics.warnings = playbackPlan.diagnostics.warnings.map(
        (w) => (MediaPolicy.isProbablyRawMediaUrl(w) ? "[REDACTED]" : w),
      );
    }

    const hasPlayableSource = Boolean(
      playbackPlan.access.allowed
        && playbackPlan.canPlay
        && playbackPlan.status === "READY"
        && playbackPlan.source?.playbackUrl,
    );

    const safePlaybackPlan = hasPlayableSource
      ? playbackPlan
      : {
          ...playbackPlan,
          source: undefined,
          tracking: {
            ...playbackPlan.tracking,
            playbackSessionId: "",
            heartbeatIntervalSeconds: 0,
          },
        };

    // Legacy compatibility fields are now derived from the canonical playback
    // plan and are populated only for a READY, allowed, playable plan.
    const response = {
      ...safePlaybackPlan,
      hasAccess: safePlaybackPlan.access.allowed,
      kind: hasPlayableSource ? safePlaybackPlan.source?.kind : undefined,
      playbackUrl: hasPlayableSource ? safePlaybackPlan.source?.playbackUrl : undefined,
    };

    if (!safePlaybackPlan.access.allowed) {
      return NextResponse.json(response, { status: 403 });
    }

    // Never CDN-cache this response: it carries a per-viewer playbackSessionId
    // bound to the requester's IP/UA fingerprint. A shared cached copy hands
    // one viewer's session to everyone else, whose playback events then fail
    // fingerprint validation with 403 for the whole watch session.
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    scopedLogger.error("[MEDIA_SOURCE_GET_ERROR]", error);
    return handleApiError(error);
  }
}

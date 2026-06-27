import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { PlaybackService } from "@/lib/services/playback/playback.service";
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

    const ctx = createAppContext({ actor, requestId: requestId || undefined });
    const playbackPlan = await PlaybackService.createPlaybackPlanWithContext(
      videoId,
      ctx,
      ipHash,
      uaHash,
    );

    // Safety: ensure no raw URLs leak in the public response
    if (playbackPlan.source?.playbackUrl) {
      if (MediaPolicy.isProbablyRawMediaUrl(playbackPlan.source.playbackUrl)) {
        // If it's a raw URL that wasn't proxied or handled, redact it for public safety
        // We expect PlaybackService to already use /api/media proxy for most cases.
        if (!playbackPlan.source.playbackUrl.startsWith("/api/media/")) {
          playbackPlan.source.playbackUrl = `/api/media/${videoId}`;
        }
      }
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
        && (playbackPlan.source?.playbackUrl || playbackPlan.source?.embedUrl),
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
      embedUrl: hasPlayableSource ? safePlaybackPlan.source?.embedUrl : undefined,
    };

    if (!safePlaybackPlan.access.allowed) {
      return NextResponse.json(response, { status: 403 });
    }

    const headers: Record<string, string> = {};
    if (actor.type === "anonymous") {
      headers["Cache-Control"] = "public, s-maxage=60, stale-while-revalidate=300";
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    scopedLogger.error("[MEDIA_SOURCE_GET_ERROR]", error);
    return handleApiError(error);
  }
}

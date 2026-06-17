import { NextRequest, NextResponse } from "next/server";
import { createScopedLogger } from "@/lib/logger";
import { handleApiError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { recordPlaybackEventUseCase } from "@/lib/modules/video";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const videoId = params.id;
  const requestId = req.headers.get("x-request-id");
  const scopedLogger = createScopedLogger(requestId);

  try {
    const actor = await getActorFromAuth();
    const userId =
      actor.type === "user"
        ? actor.userId
        : actor.type === "admin"
          ? actor.userId
          : null;
    const ip = getMediaClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Secure fingerprinting
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    const uaHash = crypto.createHash("sha256").update(userAgent).digest("hex");
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${ip}:${userAgent}`)
      .digest("hex");

    const rl = await rateLimit({
      key: `playback-event:${userId || ipHash}`,
      limit: 150, // Slightly higher limit to accommodate heartbeats
      windowMs: 60 * 1000,
    });

    if (!rl.success) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const body = await req.json();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    const result = await recordPlaybackEventUseCase(
      {
        ...body,
        videoId,
        ipHash,
        uaHash,
        fingerprint,
      },
      ctx,
    );

    if (!result.ok) {
      return handleApiError(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    scopedLogger.error("[PLAYBACK_EVENT_POST_ERROR]", error);
    return handleApiError(error);
  }
}

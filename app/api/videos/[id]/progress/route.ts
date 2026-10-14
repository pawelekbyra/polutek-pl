import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { checkAdminCsrf } from "@/lib/api/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { PROGRESS_MAX_SECONDS, saveVideoProgress } from "@/lib/modules/watch-progress";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** The player reports every ~10 s plus pause/close: a few per minute per viewer, with room for switching videos. */
const PROGRESS_WRITES_PER_MINUTE = 60;

const bodySchema = z.object({
  positionSeconds: z.number().finite().min(0).max(PROGRESS_MAX_SECONDS),
  durationSeconds: z.number().finite().min(0).max(PROGRESS_MAX_SECONDS).nullish(),
});

/**
 * Saves the signed-in viewer's position in a video (resume watching). Sent by the player every ~10 s,
 * on pause and when the tab closes (`sendBeacon`/`keepalive`, hence the plain POST). Guests are not
 * stored (their position stays in the browser). Positions under 5 s are ignored and past 95 % the row is
 * removed; the viewer must be allowed to watch the video (`checkVideoAccess`), else 404.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const scopedLogger = createScopedLogger(getCorrelationId());
  try {
    // The route sits outside /api/user, so the cross-origin guard of the proxy does not cover it.
    const csrf = checkAdminCsrf(request);
    if (csrf) return NextResponse.json(csrf.body, { status: csrf.status, headers: NO_STORE });

    const { id: videoId } = await props.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "Invalid progress." }, { status: 400, headers: NO_STORE });
    }

    const actor = await getActorFromAuth();
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Sign in to save progress." }, { status: 401, headers: NO_STORE });
    }

    const limited = await rateLimit({
      key: `video-progress:${actor.userId}`,
      limit: PROGRESS_WRITES_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!limited.success) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: NO_STORE });
    }

    const result = await saveVideoProgress(
      { videoId, positionSeconds: parsed.data.positionSeconds, durationSeconds: parsed.data.durationSeconds ?? null },
      createAppContext({ actor }),
    );
    if (!result.ok) return handleApiError(result.error);
    return NextResponse.json(result.data, { headers: NO_STORE });
  } catch (error: unknown) {
    scopedLogger.error("[VIDEO_PROGRESS_POST_ERROR]", error);
    return handleApiError(error);
  }
}

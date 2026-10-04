import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { setVideoReaction } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Generous for real clicking (several toggles a second), tight enough to stop scripted loops. */
const REACTIONS_PER_MINUTE = 120;

const bodySchema = z.object({ type: z.enum(["LIKE", "DISLIKE"]).nullable() });

/**
 * PUT sets the viewer's like/dislike of the video to `type` (null clears it). Idempotent: the
 * client sends the state it wants, so a repeated or retried request changes nothing. This is a
 * plain route, not a server action, so a page left open across a deploy keeps working.
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const scopedLogger = createScopedLogger(getCorrelationId());
  try {
    const { id: videoId } = await props.params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "VALIDATION_ERROR", message: "Nieprawidłowe dane." }, { status: 400 });
    }

    const actor = await getActorFromAuth();
    if (actor.type === "guest" || !("userId" in actor)) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Musisz być zalogowany, aby ocenić film." }, { status: 401 });
    }

    const limited = await rateLimit({ key: `video-reactions:${actor.userId}`, limit: REACTIONS_PER_MINUTE, windowMs: 60_000 });
    if (!limited.success) {
      return NextResponse.json(
        { success: false, error: "RATE_LIMITED", message: "Zbyt wiele reakcji. Spróbuj za chwilę." },
        { status: 429 },
      );
    }

    const result = await setVideoReaction({ videoId, reaction: parsed.data.type }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);
    return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    scopedLogger.error("[VIDEO_REACTION_PUT_ERROR]", error);
    return handleApiError(error);
  }
}

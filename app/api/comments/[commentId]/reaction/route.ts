import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { setCommentReaction, type ReactionTarget } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Generous for real clicking, tight enough to stop scripted like/unlike loops. */
const REACTIONS_PER_MINUTE = 60;

/**
 * PUT sets the viewer's reaction to the `type` in the body (LIKE by default, DISLIKE),
 * DELETE clears it. Both are idempotent: repeating a request changes nothing.
 */
async function handle(request: NextRequest, commentId: string, reaction: ReactionTarget, tag: string) {
  const scopedLogger = createScopedLogger(getCorrelationId());
  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest" || !("userId" in actor)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit({ key: `comment-reactions:${actor.userId}`, limit: REACTIONS_PER_MINUTE, windowMs: 60_000 });
    if (!limited.success) {
      return NextResponse.json(
        { success: false, error: "RATE_LIMITED", message: "Zbyt wiele reakcji. Spróbuj za chwilę." },
        { status: 429 },
      );
    }

    const result = await setCommentReaction({ commentId, reaction }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({
      success: true,
      liked: result.data.viewerReaction === "LIKE",
      viewerReaction: result.data.viewerReaction,
      likesCount: result.data.likesCount,
      ...(result.data.isHearted === undefined ? {} : { isHearted: result.data.isHearted }),
    });
  } catch (error: unknown) {
    scopedLogger.error(tag, error);
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await props.params;
  const body = (await request.json().catch(() => null)) as { type?: unknown } | null;
  const reaction: ReactionTarget = body?.type === "DISLIKE" ? "DISLIKE" : "LIKE";
  return handle(request, commentId, reaction, "[COMMENT_REACTION_PUT_ERROR]");
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await props.params;
  return handle(request, commentId, null, "[COMMENT_REACTION_DELETE_ERROR]");
}

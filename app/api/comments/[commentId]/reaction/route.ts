import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { toggleCommentLike } from "@/lib/modules/comments";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { commentId } = params;

  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const ctx = createAppContext({ actor });
    const result = await toggleCommentLike({ commentId, action: "LIKE" }, ctx);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: result.error.type === "UNAUTHORIZED" ? 401 : 403 },
      );
    }

    return NextResponse.json({ success: true, liked: result.data.liked });
  } catch (error: unknown) {
    scopedLogger.error("[COMMENT_REACTION_PUT_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { commentId } = params;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await toggleCommentLike(
      { commentId, action: "UNLIKE" },
      ctx,
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: result.error.type === "UNAUTHORIZED" ? 401 : 403 },
      );
    }

    return NextResponse.json({ success: true, liked: result.data.liked });
  } catch (error: unknown) {
    scopedLogger.error("[COMMENT_REACTION_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { pinComment, unpinComment } from "@/lib/modules/comments";

export const dynamic = "force-dynamic";

function statusForCommentError(type: string) {
  return type === "UNAUTHORIZED"
    ? 401
    : type === "FORBIDDEN"
      ? 403
      : type === "NOT_FOUND"
        ? 404
        : 400;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await pinComment({ commentId: params.commentId }, ctx);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: statusForCommentError(result.error.type) },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[PIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await unpinComment({ commentId: params.commentId }, ctx);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status: statusForCommentError(result.error.type) },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[UNPIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

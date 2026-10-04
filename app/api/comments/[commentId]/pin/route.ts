import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { pinComment, unpinComment } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await pinComment({ commentId: params.commentId }, ctx);

    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[PIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await unpinComment({ commentId: params.commentId }, ctx);

    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[UNPIN_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

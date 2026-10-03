import { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { holdCommentForReview } from "@/lib/modules/comments";
import { handleApiError } from "@/lib/api/api-response";
import { commentResultResponse } from "@/lib/api/comment-response";
import { createAppContext } from "@/lib/modules/shared/app-context";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi("HOLD_COMMENT");
  if (response) return response;
  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await holdCommentForReview(params.commentId, createAppContext({ actor }));
    return commentResultResponse(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

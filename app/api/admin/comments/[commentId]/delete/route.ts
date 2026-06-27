import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { deleteAdminComment } from "@/lib/modules/comments";
import { handleApiError, fromUseCaseResult } from "@/lib/api/api-response";
import { CommentDeletedReason } from "@prisma/client";
import { createAppContext } from "@/lib/modules/shared/app-context";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const { adminUserId, response } = await requireAdminForApi(
    "DELETE_COMMENT_ADMIN",
  );
  if (response) return response;
  try {
    const { reason } = await request
      .json()
      .catch(() => ({ reason: "MODERATOR_DELETED" }));
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await deleteAdminComment(
      {
        commentId: params.commentId,
        reason: (reason as CommentDeletedReason) || "MODERATOR_DELETED",
      },
      createAppContext({ actor }),
    );
    return fromUseCaseResult(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

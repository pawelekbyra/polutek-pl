import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { toggleAdminCommentHeart } from "@/lib/modules/comments";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } },
) {
  const { adminUserId, response } = await requireAdminForApi(
    "HEART_COMMENT_ADMIN",
  );
  if (response) return response;
  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const result = await toggleAdminCommentHeart(
      params.commentId,
      createAppContext({ actor }),
    );
    if (result.ok)
      return NextResponse.json({
        success: true,
        isHearted: result.data.isHearted,
      });
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

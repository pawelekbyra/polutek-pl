import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCommentContext } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await props.params;
  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const result = await getCommentContext({ commentId }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({ success: true, ...result.data });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

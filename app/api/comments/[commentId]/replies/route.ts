import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listCommentReplies } from "@/lib/modules/comments";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const ctx = createAppContext({ actor });
    const result = await listCommentReplies(
      { commentId: params.commentId, cursor, limit },
      ctx,
    );

    if (!result.ok) {
      const status = result.error.type === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json(
        { success: false, message: result.error.message },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      replies: result.data.replies,
      nextCursor: result.data.nextCursor,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

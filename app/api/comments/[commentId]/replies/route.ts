import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listCommentReplies, MAX_REPLIES_PAGE_SIZE } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  cursor: z.string().min(1).max(64).optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(MAX_REPLIES_PAGE_SIZE).catch(20),
});

/** Replies of a thread, oldest first. Public: guests read replies like they read comments. */
export async function GET(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await props.params;
  const { searchParams } = new URL(request.url);
  const { cursor, limit } = querySchema.parse({
    cursor: searchParams.get("cursor") || undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  try {
    const actor = await getActorFromAuth();
    const result = await listCommentReplies({ commentId, cursor, limit }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({
      success: true,
      replies: result.data.replies,
      nextCursor: result.data.nextCursor,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

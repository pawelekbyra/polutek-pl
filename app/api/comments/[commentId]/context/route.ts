import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getCommentContext } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api/client-ip";

export const dynamic = "force-dynamic";

/** Per-viewer DTOs include reactions and moderation permissions and must never enter a shared cache. */
function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await props.params;
    if (!commentId || commentId.length > 64) return privateResponse(NextResponse.json({ success: false, message: "Invalid comment id." }, { status: 400 }));
    const actor = await getActorFromAuth();
    const key = actor.type === "user" || actor.type === "admin" ? `user:${actor.userId}` : `ip:${getClientIp(request.headers)}`;
    const limit = await rateLimit({ key: `comment-context:${key}`, limit: 120, windowMs: 60_000 });
    if (!limit.success) return privateResponse(NextResponse.json({ success: false, message: "Too many requests." }, { status: 429, headers: { "Retry-After": "60" } }));

    // middleware.ts keeps this endpoint closed to guests (401); the use case still applies the video's read policy, so opening it later is a one-line product decision.
    const result = await getCommentContext({ commentId }, createAppContext({ actor }));
    if (!result.ok) return privateResponse(commentErrorResponse(result.error));
    return privateResponse(NextResponse.json({ success: true, ...result.data }));
  } catch (error: unknown) {
    return privateResponse(handleApiError(error));
  }
}

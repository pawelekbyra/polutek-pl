import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateComment, deleteComment } from "@/lib/modules/comments";
import { commentErrorResponse } from "@/lib/api/comment-response";
import {
  MalformedJsonBodyError,
  RequestBodyTooLargeError,
  readRequestJsonWithLimit,
} from "@/lib/utils/request-body";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_EDIT_REQUEST_BODY_BYTES = 10_000;
/** Edits per account and minute: the same pace the other comment writes (reactions, reports) are held to. */
const EDITS_PER_MINUTE = 10;
const editSchema = z.object({ text: z.string().trim().min(1).max(5000) });

const unauthorized = () =>
  NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
const invalidBody = () =>
  NextResponse.json({ success: false, message: "Nieprawidłowe dane." }, { status: 400 });

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await props.params;
  const scopedLogger = createScopedLogger(getCorrelationId());

  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest") return unauthorized();

    if ("userId" in actor) {
      const limited = await rateLimit({ key: `comment-edits:${actor.userId}`, limit: EDITS_PER_MINUTE, windowMs: 60_000 });
      if (!limited.success) {
        return NextResponse.json(
          { success: false, error: "RATE_LIMITED", message: "Zbyt wiele edycji. Spróbuj za chwilę." },
          { status: 429 },
        );
      }
    }

    let body: unknown;
    try {
      body = await readRequestJsonWithLimit(request, MAX_EDIT_REQUEST_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ success: false, message: "Komentarz jest za duży." }, { status: 413 });
      }
      if (error instanceof MalformedJsonBodyError) return invalidBody();
      throw error;
    }

    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return invalidBody();

    const result = await updateComment({ commentId, text: parsed.data.text }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({ success: true, comment: result.data });
  } catch (error: unknown) {
    scopedLogger.error("[COMMENT_PATCH_ERROR]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await props.params;
  const scopedLogger = createScopedLogger(getCorrelationId());

  try {
    const actor = await getActorFromAuth();
    if (actor.type === "guest") return unauthorized();

    const result = await deleteComment({ commentId }, createAppContext({ actor }));
    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    scopedLogger.error("[COMMENT_DELETE_ERROR]", error);
    return handleApiError(error);
  }
}

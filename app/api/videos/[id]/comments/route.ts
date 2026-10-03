import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { createScopedLogger } from "@/lib/logger";
import { getCorrelationId } from "@/lib/utils/correlation";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { listVideoComments, createVideoComment, commentErrorStatus } from "@/lib/modules/comments";
import { rateLimit } from "@/lib/rate-limit";
import { commentErrorResponse, commentSortSchema } from "@/lib/api/comment-response";
import { z } from "zod";
import {
  MalformedJsonBodyError,
  RequestBodyTooLargeError,
  readRequestJsonWithLimit,
} from "@/lib/utils/request-body";

export const dynamic = "force-dynamic";

const MAX_COMMENT_REQUEST_BODY_BYTES = 10_000;

const postCommentSchema = z.object({
  text: z.string().trim().min(1, "Komentarz nie może być pusty.").max(5000, "Komentarz jest za długi."),
  parentId: z.string().max(64).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const { searchParams } = new URL(request.url);
  const videoId = params.id;
  const sortBy = commentSortSchema.parse(searchParams.get("sortBy") ?? undefined);
  const cursor = searchParams.get("cursor") || undefined;
  const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(
    Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1),
    50,
  );

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const result = await listVideoComments(
      { videoId, sortBy, cursor, limit },
      ctx,
    );

    if (!result.ok) return commentErrorResponse(result.error);

    return NextResponse.json({
      success: true,
      ...result.data,
    });
  } catch (error: unknown) {
    scopedLogger.error("[GET_COMMENTS_ERROR]", error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  const videoId = params.id;

  try {
    const actor = await getActorFromAuth();

    if (actor.type === "guest" || !("userId" in actor)) {
      return NextResponse.json(
        { success: false, message: "Musisz być zalogowany.", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    const userId = actor.userId;
    const rateLimitResult = await rateLimit({
      key: `comments:${userId}`,
      limit: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: "Zbyt dużo komentarzy. Spróbuj za chwilę.", code: "COMMENT_RATE_LIMITED" },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await readRequestJsonWithLimit(request, MAX_COMMENT_REQUEST_BODY_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json(
          { success: false, message: "Komentarz jest za duży.", code: "COMMENT_PAYLOAD_TOO_LARGE" },
          { status: 413 },
        );
      }

      if (error instanceof MalformedJsonBodyError) {
        return NextResponse.json(
          { success: false, message: "Nieprawidłowe dane.", code: "COMMENT_VALIDATION_ERROR" },
          { status: 400 },
        );
      }

      throw error;
    }

    const resultJson = postCommentSchema.safeParse(body);
    if (!resultJson.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Nieprawidłowe dane.",
          code: "COMMENT_VALIDATION_ERROR",
          errors: resultJson.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { text, parentId } = resultJson.data;

    const ctx = createAppContext({ actor });
    const result = await createVideoComment(
      { videoId, text, parentId },
      ctx,
    );

    if (!result.ok) {
      const status = commentErrorStatus(result.error);
      const code =
        result.error.type === "UNAUTHORIZED"
          ? "AUTH_REQUIRED"
          : result.error.type === "FORBIDDEN"
            ? "COMMENT_FORBIDDEN"
            : "COMMENT_ERROR";
      return NextResponse.json(
        { success: false, message: result.error.message, code },
        { status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        comment: result.data,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    scopedLogger.error("[POST_COMMENT_ERROR]", error);
    return handleApiError(error);
  }
}

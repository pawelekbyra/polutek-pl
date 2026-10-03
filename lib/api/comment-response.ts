import { NextResponse } from "next/server";
import { z } from "zod";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { CommentError, commentErrorStatus } from "@/lib/modules/comments";

/** JSON error for a comments route: `error` is the CommentError type, `message` is safe to show. */
export function commentErrorResponse(error: CommentError) {
  return NextResponse.json(
    { success: false, error: error.type, message: error.message },
    { status: commentErrorStatus(error) },
  );
}

/** Success body (the use case's data, or `{ success: true }` for void results) or the mapped error. */
export function commentResultResponse<T>(result: UseCaseResult<T, CommentError>) {
  if (!result.ok) return commentErrorResponse(result.error);
  return NextResponse.json(result.data === undefined ? { success: true } : result.data);
}

/** `sortBy` of public and admin comment lists. */
export const commentSortSchema = z.enum(["newest", "top"]).catch("newest");

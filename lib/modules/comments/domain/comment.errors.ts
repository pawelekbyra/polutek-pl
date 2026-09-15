import { AppError } from "@/lib/modules/shared/app-error";

export type CommentError =
  | { type: "NOT_FOUND"; message: string }
  | { type: "FORBIDDEN"; message: string }
  | { type: "UNAUTHORIZED"; message: string }
  | { type: "VALIDATION_ERROR"; message: string; errors?: any }
  | { type: "DATABASE_ERROR"; message: string };

export class CommentDomainError extends AppError {
    constructor(public error: CommentError) {
        super(error.message);
    }
}

const COMMENT_ERROR_STATUS: Record<CommentError["type"], number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  DATABASE_ERROR: 500,
};

/**
 * Maps a CommentError's discriminated `type` to the HTTP status code admin
 * API routes should respond with. CommentError is a plain `{ type, message }`
 * union (not an AppError instance), so it can't flow through
 * `fromUseCaseResult`/`handleApiError`'s `instanceof AppError` check -
 * every admin comments route derives its status from this instead so the
 * NOT_FOUND/FORBIDDEN/UNAUTHORIZED distinction is never lost.
 */
export function commentErrorStatus(error: CommentError): number {
  return COMMENT_ERROR_STATUS[error.type] ?? 400;
}

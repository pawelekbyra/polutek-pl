import { logger } from "@/lib/logger";

export type CommentError =
  | { type: "NOT_FOUND"; message: string }
  /** `code: ONBOARDING_REQUIRED`: no nickname yet (see Actor.onboardingPending). `COMMENTS_DISABLED`: the creator turned comments off for the video. `CHANNEL_BANNED`: the channel blocked this viewer from commenting. */
  | { type: "FORBIDDEN"; message: string; code?: "ONBOARDING_REQUIRED" | "COMMENTS_DISABLED" | "CHANNEL_BANNED" | "PASS_REQUIRED" /* experiment: premium-pass */ }
  | { type: "UNAUTHORIZED"; message: string }
  | { type: "VALIDATION_ERROR"; message: string }
  /** The comment is in a state that does not allow the action (e.g. restoring a deleted comment). */
  | { type: "CONFLICT"; message: string }
  | { type: "DATABASE_ERROR"; message: string };

const COMMENT_ERROR_STATUS: Record<CommentError["type"], number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  DATABASE_ERROR: 500,
};

/**
 * HTTP status for a CommentError. Every comments route (public and admin) maps errors through
 * this one function so NOT_FOUND/CONFLICT/VALIDATION never collapse into 403 or 500.
 */
export function commentErrorStatus(error: CommentError): number {
  return COMMENT_ERROR_STATUS[error.type] ?? 500;
}

/**
 * Logs an unexpected (database) failure and returns a generic error. The database message
 * (table and constraint names, query details) never reaches the client.
 */
export function commentDatabaseError(tag: string, error: unknown): CommentError {
  logger.error(`[${tag}]`, error);
  return { type: "DATABASE_ERROR", message: "Coś poszło nie tak. Spróbuj ponownie." };
}

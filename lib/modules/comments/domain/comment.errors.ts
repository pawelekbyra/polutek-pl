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

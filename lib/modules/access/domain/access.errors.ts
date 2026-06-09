import { AppError } from "@/lib/modules/shared/app-error";

export class AccessDeniedError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, "ACCESS_DENIED");
  }
}

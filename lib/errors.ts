import { createScopedLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getCorrelationId } from "./utils/correlation";
import { AppError } from "@/lib/modules/shared/app-error";

export { AppError };

export function handleApiError(error: unknown) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);
  scopedLogger.error('[API_ERROR]', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code || 'BAD_REQUEST', message: error.message },
      { status: error.statusCode }
    );
  }

  const isDev = process.env.NODE_ENV === 'development';
  const message = (isDev && error instanceof Error)
    ? error.message
    : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';

  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message },
    { status: 500 }
  );
}

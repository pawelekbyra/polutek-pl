import { logger, createScopedLogger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getCorrelationId } from "./utils/correlation";

import { AppError } from "@/lib/modules/shared/app-error";

export { AppError };

const SENSITIVE_ERROR_TOKEN_PATTERN = /(sk_(live|test)_[A-Za-z0-9_\-]+|whsec_[A-Za-z0-9_\-]+|Bearer\s+[A-Za-z0-9._\-]+)/g;

export function safeErrorMessage(error: unknown, fallback = 'Unknown error') {
  const message = error instanceof Error ? error.message : String(error ?? fallback);
  return message.replace(SENSITIVE_ERROR_TOKEN_PATTERN, '[redacted]').slice(0, 1000);
}

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
  const message = isDev ? safeErrorMessage(error) : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';

  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message },
    { status: 500 }
  );
}
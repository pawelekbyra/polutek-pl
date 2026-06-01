import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown) {
  console.error('[API_ERROR]', error);

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

export function getSafeErrorInfo(error: unknown) {
  const isError = error instanceof Error;
  const name = isError ? error.name : "UnknownError";
  const rawMessage = isError ? error.message : String(error);

  // Basic sanitization: strip potentially sensitive connection details if they look like URLs
  const safeMessage = rawMessage.replace(/postgresql:\/\/[^@]+@/, "postgresql://****@");

  return {
    name,
    message: safeMessage,
    prismaCode: typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : undefined,
  };
}

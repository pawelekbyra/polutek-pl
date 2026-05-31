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

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message },
    { status: 500 }
  );
}

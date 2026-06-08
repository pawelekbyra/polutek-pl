import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';

export function handleApiResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export { handleApiError };

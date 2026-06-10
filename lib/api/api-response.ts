import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { UseCaseResult } from '@/lib/modules/shared/result';

export function handleApiResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function fromUseCaseResult<T>(
  result: UseCaseResult<T>,
  mapper?: (data: T) => NextResponse
) {
  if (result.ok) {
    return mapper ? mapper(result.data) : handleApiResponse(result.data);
  } else {
    return handleApiError(result.error);
  }
}

export { handleApiError };

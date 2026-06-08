import { AppError } from '@/lib/errors';

export function parseJson<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new AppError('Invalid JSON input', 400, 'INVALID_JSON');
  }
}

import { AppError } from '@/lib/errors';
import { z } from 'zod';

export function parseJson<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new AppError('Invalid JSON input', 400, 'INVALID_JSON');
  }
}

export async function parseRequestJson<T>(req: Request, schema?: z.ZodSchema<T>): Promise<T> {
  try {
    const body = await req.json();
    if (schema) {
      const result = schema.safeParse(body);
      if (!result.success) {
        throw new AppError('Validation failed', 400, 'VALIDATION_FAILED');
      }
      return result.data;
    }
    return body as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid JSON input', 400, 'INVALID_JSON');
  }
}

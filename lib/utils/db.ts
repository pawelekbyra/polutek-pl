import { Prisma } from '@prisma/client';

/**
 * Checks if an error is a specific Prisma error code.
 */
export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' && error !== null && 'code' in error)
  )
    ? (error as { code?: unknown }).code === code
    : false;
}

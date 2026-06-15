/**
 * Safely extracts non-sensitive error information for logging.
 */
export function getSafeErrorInfo(error: unknown) {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return {
      name: typeof err.name === 'string' ? err.name : 'UnknownError',
      code: typeof err.code === 'string' ? err.code : undefined,
    };
  }
  return { name: 'UnknownError', code: undefined };
}

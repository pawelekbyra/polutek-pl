import { describe, it, expect } from 'vitest';
import { ok, fail } from '@/lib/modules/shared/result';
import { AppError } from '@/lib/modules/shared/app-error';

describe('UseCaseResult', () => {
  it('ok() should return successful result', () => {
    const result = ok({ foo: 'bar' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.foo).toBe('bar');
    }
  });

  it('fail() should return failed result', () => {
    const error = new AppError('test error', 400, 'TEST_CODE');
    const result = fail(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe('TEST_CODE');
    }
  });
});

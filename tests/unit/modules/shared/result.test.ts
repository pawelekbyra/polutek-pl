import { describe, it, expect } from 'vitest';
import { ok, fail } from '@/lib/modules/shared/result';
import { AppError } from '@/lib/modules/shared/app-error';

describe('Result Pattern', () => {
    it('creates ok result', () => {
        const result = ok({ foo: 'bar' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.foo).toBe('bar');
        }
    });

    it('creates fail result', () => {
        const error = new AppError('test error');
        const result = fail(error);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('test error');
        }
    });
});

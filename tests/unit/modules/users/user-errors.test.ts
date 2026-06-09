import { describe, it, expect } from 'vitest';
import {
  UserNotFoundError,
  UserDeletedError,
  UserUnauthorizedError,
  UserHasNoEmailError
} from '@/lib/modules/users/domain/user.errors';
import { AppError } from '@/lib/modules/shared/app-error';

describe('UserErrors', () => {
  it('UserNotFoundError should be AppError 404', () => {
    const err = new UserNotFoundError('u1');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('USER_NOT_FOUND');
  });

  it('UserDeletedError should be AppError 410', () => {
    const err = new UserDeletedError('u1');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(410);
    expect(err.code).toBe('USER_DELETED');
  });

  it('UserUnauthorizedError should be AppError 401', () => {
    const err = new UserUnauthorizedError('reason');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('USER_UNAUTHORIZED');
  });

  it('UserHasNoEmailError should be AppError 422', () => {
    const err = new UserHasNoEmailError('u1');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('USER_HAS_NO_EMAIL');
  });
});

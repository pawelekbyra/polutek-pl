import { AppError } from '@/lib/modules/shared/app-error';

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} not found`, 404, 'USER_NOT_FOUND');
  }
}

export class UserDeletedError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} is deleted`, 410, 'USER_DELETED');
  }
}

export class UserUnauthorizedError extends AppError {
  constructor(reason: string) {
    super(reason, 401, 'USER_UNAUTHORIZED');
  }
}

export class UserHasNoEmailError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} has no email address`, 422, 'USER_HAS_NO_EMAIL');
  }
}

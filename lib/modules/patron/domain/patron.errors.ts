import { AppError } from "@/lib/modules/shared/app-error";

export class PatronError extends AppError {
  constructor(message: string, code = 'PATRON_ERROR', status = 400) {
    super(message, status, code);
    this.name = 'PatronError';
  }
}

export class PatronNotFoundError extends PatronError {
  constructor(userId: string) {
    super(`Patron status for user ${userId} not found.`, 'PATRON_NOT_FOUND', 404);
    this.name = 'PatronNotFoundError';
  }
}

export class UserNotFoundError extends PatronError {
  constructor(userId: string) {
    super(`User ${userId} was not found.`, 'USER_NOT_FOUND', 404);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidPatronActionError extends PatronError {
  constructor(message: string) {
    super(message, 'INVALID_PATRON_ACTION', 400);
    this.name = 'InvalidPatronActionError';
  }
}

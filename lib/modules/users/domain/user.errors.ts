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

/* Admin account management (/admin/users/[userId]): delete a user, change a role. Messages are shown to the admin. */

export class AdminSelfActionError extends AppError {
  constructor(action: 'delete' | 'role') {
    super(
      action === 'delete' ? 'Nie możesz usunąć własnego konta z panelu admina.' : 'Nie możesz zmienić własnej roli.',
      403,
      'SELF_ACTION_FORBIDDEN',
    );
  }
}

export class AdminActorNotAdminError extends AppError {
  constructor() {
    super('Twoje konto nie ma już roli administratora.', 403, 'FORBIDDEN');
  }
}

export class UserAlreadyDeletedError extends AppError {
  constructor() {
    super('To konto jest już usunięte.', 409, 'USER_ALREADY_DELETED');
  }
}

export class TargetIsAdminError extends AppError {
  constructor() {
    super('Nie można usunąć administratora. Najpierw odbierz mu rolę ADMIN.', 409, 'TARGET_IS_ADMIN');
  }
}

export class LastAdminError extends AppError {
  constructor() {
    super('To ostatni administrator. Najpierw nadaj rolę ADMIN innemu kontu.', 409, 'LAST_ADMIN');
  }
}

export class AdminRequiresVerifiedEmailError extends AppError {
  constructor() {
    super('Rolę ADMIN może dostać tylko konto z potwierdzonym adresem e-mail.', 409, 'EMAIL_NOT_VERIFIED');
  }
}

export class ConfirmEmailMismatchError extends AppError {
  constructor() {
    super('Wpisany adres e-mail nie zgadza się z adresem tego użytkownika.', 400, 'CONFIRM_EMAIL_MISMATCH');
  }
}

/* Moderation of one account (admin panel, Społeczność): mute commenting, sign out everywhere. */

export class InvalidModerationInputError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INVALID_MODERATION_INPUT');
  }
}

export class CannotMuteAdminError extends AppError {
  constructor() {
    super('Administratora strony nie da się wyciszyć.', 409, 'TARGET_IS_ADMIN');
  }
}

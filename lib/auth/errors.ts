/**
 * Maps Better Auth / our own error codes to user-facing PL/EN messages. Codes come from the
 * auth API (`error.code`) or from `status` for rate limiting; unknown errors get a generic text
 * and never echo server internals.
 */

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const MESSAGES: Record<string, { pl: string; en: string }> = {
  INVALID_EMAIL_OR_PASSWORD: { pl: "Nieprawidłowy e-mail lub hasło.", en: "Incorrect email or password." },
  INVALID_PASSWORD: { pl: "Nieprawidłowe hasło.", en: "Incorrect password." },
  EMAIL_NOT_VERIFIED: { pl: "Potwierdź adres e-mail. Wysłaliśmy nowy link.", en: "Please verify your email. We sent a new link." },
  PASSWORD_TOO_SHORT: { pl: "Hasło jest za krótkie (minimum 10 znaków).", en: "The password is too short (at least 10 characters)." },
  PASSWORD_TOO_LONG: { pl: "Hasło jest za długie.", en: "The password is too long." },
  PASSWORD_COMPROMISED: {
    pl: "To hasło wyciekło w znanych włamaniach. Wybierz inne.",
    en: "This password appeared in known data breaches. Choose a different one.",
  },
  EMAIL_TAKEN: { pl: "Ten e-mail jest już zajęty. Masz tu już konto.", en: "This email already has an account." },
  EMAIL_TAKEN_GOOGLE: {
    pl: "Ten e-mail jest już zajęty. Możliwe, że konto założono przez Google.",
    en: "This email already has an account. You may have registered with Google.",
  },
  INVALID_NICKNAME: { pl: "Nieprawidłowy pseudonim.", en: "Invalid nickname." },
  NICKNAME_TAKEN: { pl: "Ten pseudonim jest już zajęty. Wybierz inny.", en: "This nickname is already taken. Choose another one." },
  TOO_MANY_ATTEMPTS: { pl: "Za dużo prób. Spróbuj ponownie za kilkanaście minut.", en: "Too many attempts. Try again in a few minutes." },
  ACCOUNT_DELETED: { pl: "To konto zostało usunięte.", en: "This account has been deleted." },
  INVALID_TOKEN: { pl: "Link wygasł lub jest nieprawidłowy. Poproś o nowy.", en: "The link expired or is invalid. Request a new one." },
  TOKEN_EXPIRED: {
    pl: "Link potwierdzający wygasł. Poproś o nowy.",
    en: "The confirmation link has expired. Request a new one.",
  },
  INVALID_CODE: { pl: "Nieprawidłowy kod.", en: "Invalid code." },
  INVALID_BACKUP_CODE: { pl: "Nieprawidłowy kod zapasowy.", en: "Invalid backup code." },
  MISSING_RESPONSE: { pl: "Potwierdź, że nie jesteś robotem.", en: "Please confirm you are not a robot." },
  VERIFICATION_FAILED: { pl: "Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", en: "The bot check failed. Please try again." },
  UNKNOWN_ERROR: { pl: "Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", en: "The bot check failed. Please try again." },
  FAILED_TO_UNLINK_LAST_ACCOUNT: {
    pl: "Nie możesz odłączyć ostatniego sposobu logowania.",
    en: "You cannot unlink your last sign-in method.",
  },
};

export function authErrorMessage(error: AuthErrorLike, isPl: boolean): string {
  if (error?.status === 429) {
    return isPl ? "Za dużo prób. Spróbuj ponownie za chwilę." : "Too many requests. Please try again shortly.";
  }
  const known = error?.code ? MESSAGES[error.code] : undefined;
  if (known) return isPl ? known.pl : known.en;
  return isPl ? "Coś poszło nie tak. Spróbuj ponownie." : "Something went wrong. Please try again.";
}

export function authErrorCode(error: AuthErrorLike): string | null {
  return error?.code ?? null;
}

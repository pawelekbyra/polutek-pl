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
  SESSION_NOT_FRESH: {
    pl: "Ze względów bezpieczeństwa zaloguj się ponownie, aby to zrobić.",
    en: "For security, sign in again to do this.",
  },
  PASSWORD_REQUIRED: { pl: "Wpisz swoje hasło.", en: "Enter your password." },
  REAUTH_REQUIRED: {
    pl: "Ze względów bezpieczeństwa potwierdź się ponownie przez Google, a potem wróć tutaj.",
    en: "For security, confirm with Google again, then come back here.",
  },
  LAST_ADMIN: {
    pl: "Jesteś ostatnim administratorem. Najpierw nadaj te uprawnienia komuś innemu.",
    en: "You are the last administrator. Give someone else admin rights first.",
  },
  ONBOARDING_DONE: { pl: "Ten krok jest już ukończony.", en: "This step is already done." },
  INVALID_CODE: { pl: "Nieprawidłowy kod.", en: "Invalid code." },
  INVALID_BACKUP_CODE: { pl: "Nieprawidłowy kod zapasowy.", en: "Invalid backup code." },
  MISSING_RESPONSE: { pl: "Potwierdź, że nie jesteś robotem.", en: "Please confirm you are not a robot." },
  VERIFICATION_FAILED: { pl: "Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", en: "The bot check failed. Please try again." },
  UNKNOWN_ERROR: { pl: "Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", en: "The bot check failed. Please try again." },
  NETWORK_ERROR: {
    pl: "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    en: "Can't reach the server. Check your connection and try again.",
  },
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

/** Codes the passkey client returns when the person closed the browser prompt (or it timed out). */
const PASSKEY_CANCEL_CODES = new Set([
  "AUTH_CANCELLED",
  "REGISTRATION_CANCELLED",
  "ERROR_CEREMONY_ABORTED",
  "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
]);

const PASSKEY_MESSAGES: Record<string, { pl: string; en: string }> = {
  PASSKEY_SIGNUP_EXPIRED: {
    pl: "Minęło za dużo czasu. Podaj e-mail jeszcze raz.",
    en: "This took too long. Please enter your email again.",
  },
  INVALID_EMAIL: { pl: "Podaj poprawny adres e-mail.", en: "Enter a valid email address." },
  PASSKEY_USER_VERIFICATION_REQUIRED: {
    pl: "Urządzenie nie potwierdziło, że to Ty (odcisk palca, twarz lub PIN). Spróbuj ponownie.",
    en: "Your device did not confirm it is you (fingerprint, face or PIN). Please try again.",
  },
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: {
    pl: "Ten klucz dostępu jest już dodany do Twojego konta.",
    en: "This passkey is already added to your account.",
  },
  ERROR_INVALID_DOMAIN: {
    pl: "Klucze dostępu działają tylko na stronie www.pawelperfect.com.",
    en: "Passkeys only work on www.pawelperfect.com.",
  },
  AUTHENTICATION_FAILED: { pl: "Nie udało się zalogować kluczem dostępu. Spróbuj ponownie.", en: "Passkey sign-in failed. Please try again." },
  CHALLENGE_NOT_FOUND: { pl: "Prośba wygasła. Spróbuj ponownie.", en: "The request expired. Please try again." },
  FAILED_TO_VERIFY_REGISTRATION: { pl: "Nie udało się dodać klucza dostępu. Spróbuj ponownie.", en: "Could not add the passkey. Please try again." },
};

/** True when the person dismissed the passkey prompt: not an error worth showing. */
export function isPasskeyCancelled(error: AuthErrorLike): boolean {
  return Boolean(error?.code && PASSKEY_CANCEL_CODES.has(error.code));
}

/**
 * "Use a passkey" found no passkey of ours: the browser had none to offer, the person closed
 * the list (WebAuthn does not tell these apart, on purpose), or the chosen key belongs to no account
 * (e.g. a deleted one). All of these lead to "create an account with a passkey", never to a dead end.
 */
export function passkeyNeedsAccount(error: AuthErrorLike): boolean {
  return isPasskeyCancelled(error) || error?.code === "PASSKEY_NOT_FOUND";
}

/** Message for a failed passkey sign-in / add / remove (the plugin's own codes first, then the shared ones). */
export function passkeyErrorMessage(error: AuthErrorLike, isPl: boolean): string {
  const known = error?.code ? PASSKEY_MESSAGES[error.code] : undefined;
  if (known && error?.status !== 429) return isPl ? known.pl : known.en;
  // The plugin reuses UNKNOWN_ERROR, which in MESSAGES means a failed bot check.
  if (error?.code === "UNKNOWN_ERROR") return authErrorMessage(null, isPl);
  return authErrorMessage(error, isPl);
}

/** Better Auth refuses sensitive actions on a session older than `freshAge` (1 day): the user must sign in again. */
export function isSessionNotFresh(error: AuthErrorLike): boolean {
  return error?.code === "SESSION_NOT_FRESH";
}

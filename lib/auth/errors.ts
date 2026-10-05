import type { Tx } from "@/lib/i18n/ui";
/**
 * Maps Better Auth / our own error codes to user-facing messages (`tx`, lib/i18n/ui.ts). Codes come from the
 * auth API (`error.code`) or from `status` for rate limiting; unknown errors get a generic text
 * and never echo server internals.
 */

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const MESSAGES: Record<string, (tx: Tx) => string> = {
  INVALID_EMAIL_OR_PASSWORD: (tx) => tx("Nieprawidłowy e-mail lub hasło.", "Incorrect email or password."),
  INVALID_PASSWORD: (tx) => tx("Nieprawidłowe hasło.", "Incorrect password."),
  EMAIL_NOT_VERIFIED: (tx) => tx("Potwierdź adres e-mail. Wysłaliśmy nowy link.", "Please verify your email. We sent a new link."),
  PASSWORD_TOO_SHORT: (tx) => tx("Hasło jest za krótkie (minimum 10 znaków).", "The password is too short (at least 10 characters)."),
  PASSWORD_TOO_LONG: (tx) => tx("Hasło jest za długie.", "The password is too long."),
  PASSWORD_COMPROMISED: (tx) => tx("To hasło wyciekło w znanych włamaniach. Wybierz inne.", "This password appeared in known data breaches. Choose a different one."),
  EMAIL_TAKEN: (tx) => tx("Ten e-mail jest już zajęty. Masz tu już konto.", "This email already has an account."),
  EMAIL_TAKEN_GOOGLE: (tx) => tx("Ten e-mail jest już zajęty. Możliwe, że konto założono przez Google.", "This email already has an account. You may have registered with Google."),
  INVALID_NICKNAME: (tx) => tx("Nieprawidłowy pseudonim.", "Invalid nickname."),
  NICKNAME_TAKEN: (tx) => tx("Ten pseudonim jest już zajęty. Wybierz inny.", "This nickname is already taken. Choose another one."),
  TOO_MANY_ATTEMPTS: (tx) => tx("Za dużo prób. Spróbuj ponownie za kilkanaście minut.", "Too many attempts. Try again in a few minutes."),
  ACCOUNT_DELETED: (tx) => tx("To konto zostało usunięte.", "This account has been deleted."),
  INVALID_TOKEN: (tx) => tx("Link wygasł lub jest nieprawidłowy. Poproś o nowy.", "The link expired or is invalid. Request a new one."),
  TOKEN_EXPIRED: (tx) => tx("Link potwierdzający wygasł. Poproś o nowy.", "The confirmation link has expired. Request a new one."),
  SESSION_NOT_FRESH: (tx) => tx("Ze względów bezpieczeństwa zaloguj się ponownie, aby to zrobić.", "For security, sign in again to do this."),
  PASSWORD_REQUIRED: (tx) => tx("Wpisz swoje hasło.", "Enter your password."),
  REAUTH_REQUIRED: (tx) => tx("Ze względów bezpieczeństwa potwierdź się ponownie przez Google, a potem wróć tutaj.", "For security, confirm with Google again, then come back here."),
  LAST_ADMIN: (tx) => tx("Jesteś ostatnim administratorem. Najpierw nadaj te uprawnienia komuś innemu.", "You are the last administrator. Give someone else admin rights first."),
  ONBOARDING_DONE: (tx) => tx("Ten krok jest już ukończony.", "This step is already done."),
  INVALID_CODE: (tx) => tx("Nieprawidłowy kod.", "Invalid code."),
  INVALID_BACKUP_CODE: (tx) => tx("Nieprawidłowy kod zapasowy.", "Invalid backup code."),
  MISSING_RESPONSE: (tx) => tx("Potwierdź, że nie jesteś robotem.", "Please confirm you are not a robot."),
  VERIFICATION_FAILED: (tx) => tx("Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", "The bot check failed. Please try again."),
  UNKNOWN_ERROR: (tx) => tx("Weryfikacja anty-botowa nie powiodła się. Spróbuj ponownie.", "The bot check failed. Please try again."),
  NETWORK_ERROR: (tx) => tx("Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.", "Can't reach the server. Check your connection and try again."),
  FAILED_TO_UNLINK_LAST_ACCOUNT: (tx) => tx("Nie możesz odłączyć ostatniego sposobu logowania.", "You cannot unlink your last sign-in method."),
};

export function authErrorMessage(error: AuthErrorLike, tx: Tx): string {
  if (error?.status === 429) {
    return tx("Za dużo prób. Spróbuj ponownie za chwilę.", "Too many requests. Please try again shortly.");
  }
  const known = error?.code ? MESSAGES[error.code] : undefined;
  if (known) return known(tx);
  return tx("Coś poszło nie tak. Spróbuj ponownie.", "Something went wrong. Please try again.");
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

const PASSKEY_MESSAGES: Record<string, (tx: Tx) => string> = {
  PASSKEY_SIGNUP_EXPIRED: (tx) => tx("Minęło za dużo czasu. Podaj e-mail jeszcze raz.", "This took too long. Please enter your email again."),
  INVALID_EMAIL: (tx) => tx("Podaj poprawny adres e-mail.", "Enter a valid email address."),
  PASSKEY_USER_VERIFICATION_REQUIRED: (tx) => tx("Urządzenie nie potwierdziło, że to Ty (odcisk palca, twarz lub PIN). Spróbuj ponownie.", "Your device did not confirm it is you (fingerprint, face or PIN). Please try again."),
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: (tx) => tx("Ten klucz dostępu jest już dodany do Twojego konta.", "This passkey is already added to your account."),
  ERROR_INVALID_DOMAIN: (tx) => tx("Klucze dostępu działają tylko na stronie www.pawelperfect.com.", "Passkeys only work on www.pawelperfect.com."),
  AUTHENTICATION_FAILED: (tx) => tx("Nie udało się zalogować kluczem dostępu. Spróbuj ponownie.", "Passkey sign-in failed. Please try again."),
  CHALLENGE_NOT_FOUND: (tx) => tx("Prośba wygasła. Spróbuj ponownie.", "The request expired. Please try again."),
  FAILED_TO_VERIFY_REGISTRATION: (tx) => tx("Nie udało się dodać klucza dostępu. Spróbuj ponownie.", "Could not add the passkey. Please try again."),
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
export function passkeyErrorMessage(error: AuthErrorLike, tx: Tx): string {
  const known = error?.code ? PASSKEY_MESSAGES[error.code] : undefined;
  if (known && error?.status !== 429) return known(tx);
  // The plugin reuses UNKNOWN_ERROR, which in MESSAGES means a failed bot check.
  if (error?.code === "UNKNOWN_ERROR") return authErrorMessage(null, tx);
  return authErrorMessage(error, tx);
}

/** Better Auth refuses sensitive actions on a session older than `freshAge` (1 day): the user must sign in again. */
export function isSessionNotFresh(error: AuthErrorLike): boolean {
  return error?.code === "SESSION_NOT_FRESH";
}

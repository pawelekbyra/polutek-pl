import { signOutCompletely } from "@/lib/auth/sign-out";

/** Polish reasons for the refusals of DELETE /api/admin/users/[userId] and PATCH .../role (the admin sees these, not codes). */
const MESSAGES: Record<string, string> = {
  REAUTH_REQUIRED:
    "Ta operacja wymaga świeżego logowania (w ciągu ostatnich 10 minut). Wyloguj się, zaloguj ponownie i powtórz operację.",
  SELF_ACTION_FORBIDDEN: "Nie możesz wykonać tej operacji na własnym koncie.",
  USER_NOT_FOUND: "Nie znaleziono tego użytkownika. Odśwież stronę.",
  USER_ALREADY_DELETED: "To konto jest już usunięte.",
  TARGET_IS_ADMIN: "Nie można usunąć administratora. Najpierw odbierz mu rolę ADMIN.",
  LAST_ADMIN: "To ostatni administrator. Najpierw nadaj rolę ADMIN innemu kontu.",
  EMAIL_NOT_VERIFIED: "Rolę ADMIN może dostać tylko konto z potwierdzonym adresem e-mail.",
  CONFIRM_EMAIL_MISMATCH: "Wpisany adres e-mail nie zgadza się z adresem tego użytkownika.",
  FORBIDDEN: "Brak uprawnień administratora.",
  Forbidden: "Brak uprawnień administratora.",
  Unauthorized: "Sesja wygasła. Zaloguj się ponownie.",
};

export type AdminActionError = { code: string; message: string };

export async function readAdminActionError(response: Response): Promise<AdminActionError> {
  const body = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
  const code = typeof body.error === "string" ? body.error : "";
  if (response.status === 429) {
    return { code: "RATE_LIMITED", message: "Za dużo prób w krótkim czasie. Odczekaj minutę i spróbuj ponownie." };
  }
  const message = MESSAGES[code] ?? (typeof body.message === "string" && body.message ? body.message : null);
  return { code, message: message ?? `Operacja się nie udała (HTTP ${response.status}). Spróbuj ponownie.` };
}

/** Signs the admin out and reloads this page: the proxy then opens the sign-in modal and returns here afterwards. */
export async function signOutAndReturnHere() {
  const here = window.location.pathname + window.location.search;
  try {
    await signOutCompletely();
  } finally {
    window.location.assign(here);
  }
}

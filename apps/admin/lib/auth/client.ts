"use client";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/** Browser client of the panel's own auth (same origin, /api/auth). */
export const adminAuthClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [passkeyClient(), twoFactorClient()],
});

type Json = Record<string, unknown>;

/** Calls one of our panel endpoints (enrollment, TOTP step-up) and returns the JSON or a Polish error. */
export async function panelAuthPost<T = Json>(path: string, body?: Json): Promise<{ ok: true; data: T } | { ok: false; code: string }> {
  try {
    const res = await fetch(`/api/auth${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) return { ok: false, code: String(data.code ?? data.message ?? res.status) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, code: "NETWORK" };
  }
}

export async function panelAuthGet<T = Json>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/auth${path}`, { credentials: "same-origin", cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const MESSAGES: Record<string, string> = {
  ENROLLMENT_LINK_INVALID: "Link wygasł albo został już użyty. Wygeneruj nowy na serwerze: admin-enroll --email … --reset.",
  ENROLLMENT_INCOMPLETE: "Brakuje kroku: potrzebny jest zweryfikowany TOTP i co najmniej jeden klucz dostępu.",
  INVALID_CODE: "Kod się nie zgadza. Sprawdź godzinę w telefonie i spróbuj z nowym kodem.",
  TOTP_LOCKED: "Za dużo błędnych kodów. TOTP jest zablokowany na 15 minut; użyj klucza dostępu.",
  STEP_UP_REQUIRED: "Najpierw potwierdź tożsamość.",
  PASSKEY_USER_VERIFICATION_REQUIRED: "Klucz musi potwierdzić Ciebie (odcisk, twarz albo PIN urządzenia).",
  NETWORK: "Brak połączenia z panelem. Sprawdź sieć i spróbuj ponownie.",
  "429": "Za dużo prób. Odczekaj chwilę.",
};

export function polishAuthError(code: string | undefined | null): string {
  if (!code) return "Nie udało się. Spróbuj ponownie.";
  return MESSAGES[code] ?? "Nie udało się. Spróbuj ponownie.";
}

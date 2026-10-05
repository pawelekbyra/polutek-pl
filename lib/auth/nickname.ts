import type { Tx } from "@/lib/i18n/ui";
/**
 * Nickname ("Pseudonim") rules for new accounts. The nickname is the only name a new user gives:
 * it is stored as `User.name` (the Better Auth user name), so every public surface * shows it: the (user menu, comments) show it. Shared by the client forms and the
 * availability endpoint so both apply the same rules.
 */

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 30;

export type NicknameProblem = "too_short" | "too_long" | "invalid_chars" | "taken";

export type NicknameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: Exclude<NicknameProblem, "taken"> };

// Letters of any alphabet (incl. Polish diacritics), digits, spaces and - _ .
const NICKNAME_PATTERN = /^[\p{L}\p{N} _.-]+$/u;

/** Trim, collapse inner whitespace to single spaces and use one Unicode form. */
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Same nickname for the taken check: compared after normalizing, ignoring letter case. */
export function isSameNickname(a: string, b: string): boolean {
  return normalizeNickname(a).toLocaleLowerCase() === normalizeNickname(b).toLocaleLowerCase();
}

export function validateNickname(raw: string): NicknameValidation {
  const value = normalizeNickname(raw);
  const length = Array.from(value).length;
  if (length < NICKNAME_MIN_LENGTH) return { ok: false, reason: "too_short" };
  if (length > NICKNAME_MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (!NICKNAME_PATTERN.test(value)) return { ok: false, reason: "invalid_chars" };
  return { ok: true, value };
}

export function nicknameProblemMessage(reason: NicknameProblem, tx: Tx): string {
  switch (reason) {
    case "too_short":
      return tx("Pseudonim musi mieć co najmniej {0} znaki.", "Nickname must be at least {0} characters.", NICKNAME_MIN_LENGTH);
    case "too_long":
      return tx("Pseudonim może mieć najwyżej {0} znaków.", "Nickname can be at most {0} characters.", NICKNAME_MAX_LENGTH);
    case "invalid_chars":
      return tx("Pseudonim może zawierać tylko litery, cyfry, spacje oraz znaki - _ .", "Nickname can only contain letters, digits, spaces and - _ .");
    case "taken":
      return tx("Ten pseudonim jest już zajęty. Wybierz inny.", "This nickname is already taken. Choose another one.");
  }
}

export type NicknameCheck = { available: true } | { available: false; reason: NicknameProblem | "rate_limited" };

/**
 * Asks the server whether the nickname is free. Fails open on network/server errors so a broken
 * check never locks people out of signing up; a rate limit blocks with its own message.
 */
export async function checkNicknameAvailability(nickname: string): Promise<NicknameCheck> {
  try {
    const res = await fetch(`/api/users/nickname-available?name=${encodeURIComponent(nickname)}`, { cache: "no-store" });
    if (res.status === 429) return { available: false, reason: "rate_limited" };
    if (!res.ok) return { available: true };
    const body = (await res.json()) as { available?: boolean; reason?: NicknameProblem };
    if (body.available === false) return { available: false, reason: body.reason ?? "taken" };
    return { available: true };
  } catch {
    return { available: true };
  }
}

export function nicknameCheckMessage(reason: NicknameProblem | "rate_limited", tx: Tx): string {
  if (reason === "rate_limited") {
    return tx("Za dużo prób. Odczekaj chwilę i spróbuj ponownie.", "Too many attempts. Wait a moment and try again.");
  }
  return nicknameProblemMessage(reason, tx);
}

/**
 * Clerk is configured with "username" as a required sign-up field. Users never see it: they pick a
 * nickname (see `lib/auth/nickname.ts`) and we derive a valid, hidden username from it: lowercase
 * ASCII, diacritics stripped, anything else turned into `_`, at most 20 characters, plus a short
 * random suffix so two similar nicknames don't collide.
 */
export function usernameFromNickname(nickname?: string | null): string {
  const base = (nickname ?? "")
    .toLowerCase()
    .replace(/ł/g, "l") // NFD doesn't decompose ł
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20)
    .replace(/_$/, "");
  const suffix = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "0").padEnd(6, "0");
  return `${base || "user"}_${suffix}`;
}

/** Clerk's username rule as configured for this instance: 4-64 of a-z, 0-9, _. */
export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_]{4,64}$/.test(value);
}

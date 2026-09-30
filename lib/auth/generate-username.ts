/**
 * Clerk is configured with "username" as a required sign-up field, but our sign-up UI (email + code
 * and Google) never asks for one. Without it the sign-up stays in `missing_requirements` and never
 * completes, so we derive a valid username (lowercase letters, digits, underscore; 4-64 chars).
 */
export function generateUsername(seed?: string | null): string {
  const base = (seed ?? "")
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const suffix = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "0").padEnd(6, "0");
  return `${base || "user"}_${suffix}`;
}

/** Clerk's username rule as configured for this instance: 4-64 of a-z, 0-9, _. */
export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_]{4,64}$/.test(value);
}

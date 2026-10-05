import { timingSafeEqual } from "node:crypto";

/** Bearer token of a scheduler (ADMIN_JOBS_TOKEN, >= 32 characters), compared in constant time. */
export function tokenAuthorised(header: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

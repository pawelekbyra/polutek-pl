import { prisma } from "@/lib/prisma";

/**
 * Roles of panel accounts. OWNER = the whole panel. TRANSLATOR = only the translation screens and only the
 * languages granted in AdminLanguageGrant. Everything not explicitly opened to TRANSLATOR is OWNER-only
 * (requireAdmin's default), and the proxy enforces the same on every request (soft navigations included).
 */
export const ADMIN_ROLES = ["OWNER", "TRANSLATOR"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Anything unknown is treated as the least privileged role, never as OWNER. */
export function normalizeRole(raw: unknown): AdminRole {
  return raw === "OWNER" ? "OWNER" : "TRANSLATOR";
}

export async function loadLanguageGrants(adminUserId: string): Promise<string[]> {
  const rows = await prisma.adminLanguageGrant.findMany({ where: { adminUserId }, select: { language: true }, orderBy: { language: "asc" } });
  return rows.map((r) => r.language);
}

/** Paths a TRANSLATOR may reach (pages and the auth/step-up plumbing). Everything else is refused by the proxy. */
export const TRANSLATOR_PATHS = ["/tlumaczenia", "/api/auth", "/logowanie", "/rejestracja", "/potwierdz", "/flags", "/icon.svg", "/api/health"] as const;

export function isTranslatorPath(pathname: string): boolean {
  return TRANSLATOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The role behind a session cookie value (`<token>.<signature>`), or null when there is no such session. Read-only. */
export async function lookupSessionRole(cookieValue: string | undefined): Promise<AdminRole | null> {
  if (!cookieValue) return null;
  const token = decodeURIComponent(cookieValue).split(".")[0];
  if (!token) return null;
  const row = await prisma.adminSession.findUnique({ where: { token }, select: { user: { select: { role: true } } } });
  return row ? normalizeRole(row.user.role) : null;
}

/** Fallback when the session payload carries no role (never guess OWNER). */
export async function loadRole(adminUserId: string): Promise<AdminRole> {
  const row = await prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { role: true } });
  return normalizeRole(row?.role);
}

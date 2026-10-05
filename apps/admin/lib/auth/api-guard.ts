import { getAdminAuthMode, isDevAuthBypassEnabled } from "@admin/lib/config";
import { resolveAccessSession } from "./access-session";
import { adminAuth } from "./auth";
import { loadRole, normalizeRole, type AdminRole } from "./roles";
import { isAbsoluteExpired } from "./session-rules";

/** Route handlers: a JSON 401 instead of a redirect. Same rules as requireAdmin() for pages. */
export async function adminFromRequest(request: Request, roles: readonly AdminRole[] = ["OWNER"]): Promise<{ userId: string } | null> {
  if (isDevAuthBypassEnabled()) return { userId: "dev" };
  if (getAdminAuthMode() === "access") {
    const result = await resolveAccessSession(request.headers);
    return result.ok && roles.includes(result.session.user.role) ? { userId: result.session.user.id } : null;
  }
  const current = (await adminAuth.api.getSession({ headers: request.headers }).catch(() => null)) as
    | { session: { createdAt: Date }; user: { id: string; role?: string | null; enrolledAt?: Date | null } }
    | null;
  if (!current || !current.user.enrolledAt || isAbsoluteExpired(current.session)) return null;
  const role = current.user.role ? normalizeRole(current.user.role) : await loadRole(current.user.id);
  if (!roles.includes(role)) return null;
  return { userId: current.user.id };
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });

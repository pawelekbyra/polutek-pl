import { isDevAuthBypassEnabled } from "@admin/lib/config";
import { adminAuth } from "./auth";
import { isAbsoluteExpired } from "./session-rules";

/** Route handlers: a JSON 401 instead of a redirect. Same rules as requireAdmin() for pages. */
export async function adminFromRequest(request: Request): Promise<{ userId: string } | null> {
  if (isDevAuthBypassEnabled()) return { userId: "dev" };
  const current = (await adminAuth.api.getSession({ headers: request.headers }).catch(() => null)) as
    | { session: { createdAt: Date }; user: { id: string; enrolledAt?: Date | null } }
    | null;
  if (!current || !current.user.enrolledAt || isAbsoluteExpired(current.session)) return null;
  return { userId: current.user.id };
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });

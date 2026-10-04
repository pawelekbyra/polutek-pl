import { searchAdminObjects } from "@/lib/modules/admin-overview";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { adminFromRequest, unauthorized } from "@admin/lib/auth/api-guard";
import { isDevFixturesEnabled } from "@admin/lib/config";

export const dynamic = "force-dynamic";

const publicBase = () => (process.env.NEXT_PUBLIC_APP_URL || "https://www.pawelperfect.com").replace(/\/+$/, "");

/** Object search of the command palette. Read only, signed-in admin only, never cached. */
export async function GET(request: Request) {
  if (!(await adminFromRequest(request))) return unauthorized();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (isDevFixturesEnabled()) return Response.json({ hits: [] }, { headers: { "cache-control": "no-store" } });
  const hits = await searchAdminObjects(createAppContext({ type: "system", reason: "admin_panel_search" }).prisma, q, (path) => `${publicBase()}${path}`);
  return Response.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}

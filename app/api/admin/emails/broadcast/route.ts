import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminBroadcastCreateSchema } from "@/lib/api/admin-schemas";
import { createBroadcast, listAdminBroadcastEmails } from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

/**
 * Creates (queues) a broadcast and answers at once with 202; the send-broadcasts cron sends it.
 * Repeating the same request (same requestKey) returns the same broadcast, never a second one.
 */
export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST");
  if (response) return response;

  const parsed = await parseAdminBody(req, adminBroadcastCreateSchema);
  if (!parsed.ok) return parsed.response;

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await createBroadcast(ctx, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode });
  }
  return NextResponse.json(result.data, { status: result.data.duplicate ? 200 : 202 });
}

export async function GET() {
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_EMAILS_BROADCAST_HISTORY");
  if (response) return response;

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await listAdminBroadcastEmails(ctx);
  return NextResponse.json(result.ok ? result.data : []);
}

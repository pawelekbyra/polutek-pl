import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminBroadcastTestSchema } from "@/lib/api/admin-schemas";
import { sendBroadcastTest } from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

/**
 * Sends a test copy of a broadcast to the signed-in admin's own account address only (the use case
 * reads it from the account, never from the request), so the panel cannot mail arbitrary people.
 */
export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST_TEST");
  if (response) return response;

  const parsed = await parseAdminBody(req, adminBroadcastTestSchema);
  if (!parsed.ok) return parsed.response;

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await sendBroadcastTest(ctx, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode });
  }
  return NextResponse.json({ ok: true, to: result.data.to });
}

import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { countBroadcastAudience } from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

/** How many people a broadcast would reach right now (shown in the wizard before sending). */
export async function GET() {
  const { adminUserId, response } = await requireAdminForApi("GET_ADMIN_EMAILS_BROADCAST_AUDIENCE");
  if (response) return response;

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await countBroadcastAudience(ctx);
  return NextResponse.json(result.ok ? result.data : { recipientCount: 0 });
}

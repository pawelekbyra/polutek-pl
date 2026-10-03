import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { cancelBroadcast } from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Stops a queued or running broadcast; recipients not reached yet are skipped. No request body. */
export async function POST(_req: NextRequest, props: Context) {
  const { id } = await props.params;
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST_CANCEL");
  if (response) return response;

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await cancelBroadcast(ctx, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode });
  }
  return NextResponse.json(result.data);
}

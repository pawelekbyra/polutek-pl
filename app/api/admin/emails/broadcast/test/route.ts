import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminBroadcastTestSchema } from "@/lib/api/admin-schemas";
import { sendBroadcastTest } from "@/lib/modules/email";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Sends a test copy of a broadcast to the signed-in admin's own address only (taken from the
 * account, never from the request), so the panel cannot be used to mail arbitrary people.
 */
export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("POST_ADMIN_EMAILS_BROADCAST_TEST");
  if (response) return response;

  const parsed = await parseAdminBody(req, adminBroadcastTestSchema);
  if (!parsed.ok) return parsed.response;

  const admin = await prisma.user.findUnique({ where: { id: adminUserId }, select: { email: true } });
  if (!admin?.email) {
    return NextResponse.json({ error: "Konto admina nie ma adresu e-mail." }, { status: 400 });
  }

  const ctx = createAppContext({ actor: { type: "admin", userId: adminUserId } });
  const result = await sendBroadcastTest(ctx, { ...parsed.data, to: admin.email });
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: result.error.statusCode });
  }
  return NextResponse.json({ ok: true, to: admin.email });
}

import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { MainChannelMaintenance } from "@/lib/channel/main-channel.maintenance";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";
import { writeAuditLog } from "@/lib/services/audit.service";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  confirm: z.boolean().refine(val => val === true, "Explicit confirmation is required."),
});

export async function POST(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("APPLY_MAINTENANCE");
  if (response) return response;

  try {
    const body = await req.json();
    const result = applySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Confirmation required", details: result.error.flatten() }, { status: 400 });
    }

    const report = await MainChannelMaintenance.applyMainChannelSetup(adminUserId!, true);

    await writeAuditLog({
        actorUserId: adminUserId,
        action: "MAIN_CHANNEL_MAINTENANCE_APPLIED",
        targetType: "System",
        metadata: report
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return handleApiError(error);
  }
}

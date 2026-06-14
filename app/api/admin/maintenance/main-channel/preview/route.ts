import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { MainChannelMaintenance } from "@/lib/modules/channel";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi(
    "PREVIEW_MAINTENANCE",
  );
  if (response) return response;

  try {
    const actor = { type: "admin" as const, userId: adminUserId! };
    const ctx = createAppContext({ actor });
    const preview = await MainChannelMaintenance.previewMainChannelSetup(ctx);
    return NextResponse.json(preview);
  } catch (error) {
    return handleApiError(error);
  }
}

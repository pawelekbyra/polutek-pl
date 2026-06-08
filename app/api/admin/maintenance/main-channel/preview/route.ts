import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { MainChannelMaintenance } from "@/lib/modules/channel";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminForApi("PREVIEW_MAINTENANCE");
  if (response) return response;

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });
    const preview = await MainChannelMaintenance.previewMainChannelSetup(ctx);
    return NextResponse.json(preview);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { MainChannelMaintenance } from "@/lib/channel/main-channel.maintenance";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminForApi("PREVIEW_MAINTENANCE");
  if (response) return response;

  try {
    const preview = await MainChannelMaintenance.previewMainChannelSetup();
    return NextResponse.json(preview);
  } catch (error) {
    return handleApiError(error);
  }
}

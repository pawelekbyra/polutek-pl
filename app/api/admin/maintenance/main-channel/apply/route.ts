import { NextResponse, NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { MainChannelMaintenance } from "@/lib/modules/channel";
import { handleApiError } from "@/lib/errors";
import { z } from "zod";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getActorFromAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

const applySchema = z.object({
  confirmationPhrase: z.string().min(1, "Confirmation phrase is required."),
});

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi("APPLY_MAINTENANCE");
  if (response) return response;

  try {
    const body = await req.json();
    const result = applySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Confirmation phrase required", details: result.error.flatten() }, { status: 400 });
    }

    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor });

    const report = await MainChannelMaintenance.applyMainChannelSetup(ctx, result.data.confirmationPhrase);

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return handleApiError(error);
  }
}

// experiment: premium-pass (docs/experiments/premium-pass.md)
// Demo panel: expire or delete the caller's OWN demo pass (any signed-in viewer who sees the experiment).
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { demoControlInputSchema, runPassDemoControl } from "@/lib/modules/experiment-premium-pass";
import { passErrorResponse, passInvalidRequest, PASS_NO_STORE } from "../responses";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const parsed = demoControlInputSchema.safeParse(await req.json().catch(() => null));
    const ctx = createAppContext({ actor: await getActorFromAuth() });
    if (!parsed.success) return passInvalidRequest();
    const result = await runPassDemoControl(ctx, parsed.data);
    if (!result.ok) return passErrorResponse(result);
    return NextResponse.json({ pass: result.data }, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

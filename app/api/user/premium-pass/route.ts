// experiment: premium-pass (docs/experiments/premium-pass.md)
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getPremiumPassStatus, notePassFunnelEvent } from "@/lib/modules/experiment-premium-pass";
import { passErrorResponse, PASS_NO_STORE } from "./responses";

export const dynamic = "force-dynamic";

/**
 * The demo pass offer and the viewer's OWN pass state. 404 when the experiment is invisible to the viewer.
 * `?intent=checkout` is sent when the checkout opens (anonymous funnel counter, no account id).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = createAppContext({ actor: await getActorFromAuth() });
    const result = await getPremiumPassStatus(ctx);
    if (!result.ok) return passErrorResponse(result);
    if (req.nextUrl.searchParams.get("intent") === "checkout") await notePassFunnelEvent(ctx, "checkout_open");
    return NextResponse.json(result.data, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

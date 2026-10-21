// experiment: premium-pass (docs/experiments/premium-pass.md)
// SIMULATED checkout (PREMIUM_PASS_PAYMENTS=demo). Never takes money: no payment provider, no card/BLIK data (strict
// schema); in `stripe` mode it answers WRONG_MODE. The real flow is ../intent + the Stripe webhook.
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { checkoutDemoInputSchema, checkoutDemoPass, passUserId, premiumPassFor } from "@/lib/modules/experiment-premium-pass";
import { passErrorResponse, passInvalidRequest, PASS_NO_STORE } from "../responses";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (!premiumPassFor(actor)) return passErrorResponse({ code: "NOT_VISIBLE" });
    const userId = passUserId(actor);
    if (!userId) return passErrorResponse({ code: "UNAUTHORIZED" });

    const limit = await rateLimit({ key: `premium-pass:checkout:${userId}`, limit: 10, windowMs: 60_000 });
    if (!limit.success) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: PASS_NO_STORE });

    const parsed = checkoutDemoInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return passInvalidRequest();

    const result = await checkoutDemoPass(createAppContext({ actor }), parsed.data);
    if (!result.ok) return passErrorResponse(result);
    return NextResponse.json({ pass: result.data }, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

// experiment: premium-pass (docs/experiments/premium-pass.md)
// Step 2 of the checkout: the two boxes (Terms + Privacy Policy, immediate access) were ticked; the browser records
// that on its own unpaid patron payment right before it confirms the payment with Stripe.
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { passUserId, patronConsentInputSchema, premiumPassFor, recordPatronConsent } from "@/lib/modules/experiment-premium-pass";
import { passErrorResponse, passInvalidRequest, PASS_NO_STORE } from "../responses";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (!premiumPassFor(actor)) return passErrorResponse({ code: "NOT_VISIBLE" });
    const userId = passUserId(actor);
    if (!userId) return passErrorResponse({ code: "UNAUTHORIZED" });

    const limit = await rateLimit({ key: `premium-pass:consent:${userId}`, limit: 20, windowMs: 10 * 60_000 });
    if (!limit.success) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: PASS_NO_STORE });

    const parsed = patronConsentInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return passInvalidRequest();

    const result = await recordPatronConsent(createAppContext({ actor }), parsed.data);
    if (!result.ok) return passErrorResponse(result);
    return NextResponse.json(result.data, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

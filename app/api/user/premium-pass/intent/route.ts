// patron zone (docs/architecture/patron-zone.md)
// Starts (or updates the amount of) the REAL payment of the patron zone: one Payment row + one PaymentIntent per
// attempt, through the tip gateway's own createCheckoutIntent. Only in `PREMIUM_PASS_PAYMENTS=stripe` mode and only
// when the payments are fully configured (see domain/payments-mode.ts). It never grants access.
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { passUserId, patronIntentInputSchema, premiumPassFor, startPatronPayment } from "@/lib/modules/patron-zone";
import { passErrorResponse, passInvalidRequest, PASS_NO_STORE } from "../responses";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (!premiumPassFor(actor)) return passErrorResponse({ code: "NOT_VISIBLE" });
    const userId = passUserId(actor);
    if (!userId) return passErrorResponse({ code: "UNAUTHORIZED" });

    const limit = await rateLimit({ key: `premium-pass:intent:${userId}`, limit: 10, windowMs: 10 * 60_000 });
    if (!limit.success) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: PASS_NO_STORE });

    const parsed = patronIntentInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return passInvalidRequest();

    const result = await startPatronPayment(createAppContext({ actor }), parsed.data);
    if (!result.ok) return passErrorResponse(result);
    return NextResponse.json(result.data, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

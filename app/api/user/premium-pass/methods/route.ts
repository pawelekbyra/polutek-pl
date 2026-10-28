// patron zone (docs/architecture/patron-zone.md)
// The payment methods Stripe offers for a product and a currency, for the tiles of step 2 (before "Dalej"). POST, not
// GET, so the same-origin guard of /api/user/* covers it (a probe is a Stripe call). Creates nothing in our database
// and returns method NAMES only, never a client secret. Any Stripe problem is a 200 with `paymentMethodTypes: null`
// (the browser keeps its default tiles); only the gates answer with errors.
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { passUserId, patronMethodsInputSchema, premiumPassFor, previewPatronMethods } from "@/lib/modules/patron-zone";
import { passErrorResponse, passInvalidRequest, PASS_NO_STORE } from "../responses";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth();
    if (!premiumPassFor(actor)) return passErrorResponse({ code: "NOT_VISIBLE" });
    const userId = passUserId(actor);
    if (!userId) return passErrorResponse({ code: "UNAUTHORIZED" });

    const limit = await rateLimit({ key: `premium-pass:methods:${userId}`, limit: 40, windowMs: 10 * 60_000 });
    if (!limit.success) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: PASS_NO_STORE });

    const parsed = patronMethodsInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return passInvalidRequest();

    const result = await previewPatronMethods(createAppContext({ actor }), parsed.data);
    if (!result.ok) return passErrorResponse(result);
    return NextResponse.json(result.data, { headers: PASS_NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

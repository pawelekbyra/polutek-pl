import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { CheckNicknameAvailabilityUseCase } from "@/lib/modules/users";

export const dynamic = "force-dynamic";

// Public on purpose (middleware.ts): the first-sign-in form on /sso-callback runs before the
// sign-up is finalized, so there is no session yet. Strict per-IP limit, and the answer is only
// a boolean plus a reason: it never reveals who holds a nickname.
const NICKNAME_CHECK_LIMIT = 20;
const NICKNAME_CHECK_WINDOW_MS = 60 * 1000;
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit({
      key: `nickname-available:${getMediaClientIp(req)}`,
      limit: NICKNAME_CHECK_LIMIT,
      windowMs: NICKNAME_CHECK_WINDOW_MS,
    });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
    }

    const name = req.nextUrl.searchParams.get("name") ?? "";
    if (name.length > 200) {
      return NextResponse.json({ available: false, reason: "too_long" }, { headers: NO_STORE });
    }

    const result = await CheckNicknameAvailabilityUseCase.execute(createAppContext({ type: "guest" }), name);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

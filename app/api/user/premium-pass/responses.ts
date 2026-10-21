// experiment: premium-pass (docs/experiments/premium-pass.md)
import { NextResponse } from "next/server";
import type { PassErrorCode } from "@/lib/modules/experiment-premium-pass";

export const PASS_NO_STORE = { "Cache-Control": "private, no-store" } as const;

const STATUS: Record<PassErrorCode, number> = {
  NOT_VISIBLE: 404,
  UNAUTHORIZED: 401,
  CONSENT_REQUIRED: 400,
  WRONG_MODE: 409,
  PAYMENTS_UNAVAILABLE: 503,
  AMOUNT_INVALID: 400,
  MAX_AHEAD: 409,
  DEMO_DECLINED: 402,
  NO_PASS: 404,
  PAYMENT_IN_PROGRESS: 409,
  PAYMENT_FAILED: 502,
  PAYMENT_NOT_FOUND: 404,
};

/** NOT_VISIBLE looks exactly like a missing route: nothing reveals that the experiment exists. */
export function passErrorResponse(result: { code: PassErrorCode; expiresAt?: string }) {
  const body = result.code === "NOT_VISIBLE"
    ? { error: "Not found" }
    : { code: result.code, ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}) };
  return NextResponse.json(body, { status: STATUS[result.code], headers: PASS_NO_STORE });
}

export function passInvalidRequest() {
  return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400, headers: PASS_NO_STORE });
}

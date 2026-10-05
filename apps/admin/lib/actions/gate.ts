/**
 * The one door of a sensitive panel write (phase 3). Order, the same for every action:
 *   requireAdmin (session, 12 h ceiling) -> sample-data refusal -> rate limit -> [step-up] -> context.
 * Input validation (zod .strict) comes after the gate in each action, authorization is the gate itself.
 * An action that fails the gate returns the ActionResult the client shows; step-up asks the browser to go
 * to /potwierdz first (`code: "STEP_UP_REQUIRED"`).
 */
import type { AppContext } from "@/lib/modules/shared/app-context";
import { hasFreshStepUp, requireAdmin, type AdminViewer } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { panelContext, sampleDataRefusal, type ActionResult } from "./panel";
import { allowAction, retryAfterSeconds, type RateRule } from "./rate-limit";

export type GateOptions = {
  /** Where requireAdmin sends an unauthenticated browser after sign-in. */
  path: string;
  rate: RateRule;
  /** Money, mail, personal data, ownership: the owner proved who he is in the last 5 minutes. */
  stepUp?: boolean;
};

export type Gate = { ok: true; viewer: AdminViewer; ctx: AppContext } | { ok: false; result: Extract<ActionResult, { ok: false }> };

export async function openGate(opts: GateOptions): Promise<Gate> {
  const viewer = await requireAdmin(opts.path);
  if (isDevFixturesEnabled()) return { ok: false, result: sampleDataRefusal() };
  if (!allowAction(viewer.userId, opts.rate)) {
    const wait = retryAfterSeconds(viewer.userId, opts.rate);
    return { ok: false, result: { ok: false, code: "RATE_LIMITED", message: `Za dużo prób. Spróbuj ponownie za ${wait} s.` } };
  }
  if (opts.stepUp && !(await hasFreshStepUp())) {
    return { ok: false, result: { ok: false, code: "STEP_UP_REQUIRED", message: "Najpierw potwierdź tożsamość (klucz dostępu albo kod TOTP z ostatnich 5 minut)." } };
  }
  return { ok: true, viewer, ctx: await panelContext(viewer) };
}

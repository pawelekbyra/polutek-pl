"use server";
/**
 * Money writes of "Przychody": refund and dispute sync. Refund = gate (session, 10 per 10 min, step-up) ->
 * zod .strict -> the payment is re-read and the amount re-checked against what is left -> adminRefund
 * (Stripe with an idempotency key, DB, audit with reason and before/after). Stripe is never called in tests.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminDisputeSync, adminRefund } from "@/lib/modules/payments";
import { getPaymentBrief, parseMoneyToMinor } from "@/lib/modules/admin-revenue";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import { errorMessage, zodFieldErrors, type ActionResult } from "@admin/lib/actions/panel";

const refundSchema = z
  .object({
    paymentId: z.string().min(1).max(100),
    mode: z.enum(["full", "partial"]),
    amount: z.string().max(20).optional(),
    stripeReason: z.enum(["requested_by_customer", "duplicate", "fraudulent"]),
    note: z.string().trim().min(3, "Podaj powód (co najmniej 3 znaki).").max(500, "Najwyżej 500 znaków."),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/, "Niepoprawny klucz żądania."),
  })
  .strict();

export type RefundInput = z.infer<typeof refundSchema>;

export async function refundAction(input: RefundInput): Promise<ActionResult<{ amountMinor: number }>> {
  const gate = await openGate({ path: "/przychody?tab=wplaty", rate: RATE.money, stepUp: true });
  if (!gate.ok) return gate.result;
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Popraw zaznaczone pola.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const f = parsed.data;
  const brief = await getPaymentBrief(gate.ctx, f.paymentId);
  if (!brief) return { ok: false, ...errorMessage({ code: "PAYMENT_NOT_FOUND" }) };
  if (brief.status === "DISPUTED") return { ok: false, code: "DISPUTED", message: "Wpłata jest w sporze: odpowiedz na spór w Stripe zamiast zwracać pieniądze (zwrot i przegrany spór oznaczają dwie straty)." };
  const left = brief.amountMinor - brief.refundedAmountMinor;
  let amountMinor = left;
  if (f.mode === "partial") {
    const minor = parseMoneyToMinor(f.amount ?? "");
    if (minor === null) return { ok: false, message: "Popraw kwotę.", fieldErrors: { amount: "Podaj kwotę, np. 12,50 (najwyżej dwa miejsca po przecinku)." } };
    if (minor > left) return { ok: false, message: "Kwota jest większa niż to, co zostało do zwrotu.", fieldErrors: { amount: `Do zwrotu zostało ${(left / 100).toFixed(2).replace(".", ",")} ${brief.currency}.` } };
    amountMinor = minor;
  }
  const res = await adminRefund({ paymentId: f.paymentId, amountMinor, reason: f.note, stripeReason: f.stripeReason, idempotencyKey: f.idempotencyKey }, gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/przychody");
  return { ok: true, message: `Zwrot ${(amountMinor / 100).toFixed(2).replace(".", ",")} ${brief.currency} zlecony w Stripe (${res.data.status}).`, data: { amountMinor } };
}

const syncSchema = z.object({ paymentId: z.string().min(1).max(100) }).strict();

export async function syncDisputeAction(input: { paymentId: string }): Promise<ActionResult> {
  const gate = await openGate({ path: "/przychody?tab=spory", rate: RATE.sync });
  if (!gate.ok) return gate.result;
  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const res = await adminDisputeSync({ paymentId: parsed.data.paymentId }, gate.ctx);
  if (!res.ok) return { ok: false, ...errorMessage(res.error) };
  revalidatePath("/przychody");
  return { ok: true, message: res.data.synced ? `Spór zsynchronizowany (status w Stripe: ${res.data.disputeStatus}).` : "Stripe nie zwraca sporu dla tej wpłaty." };
}

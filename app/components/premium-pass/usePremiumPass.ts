"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): browser side of the patron-zone API (own account only).
import { useCallback, useEffect, useState } from "react";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import type { PassMethod, PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";

export type PremiumPassStatus = { offer: PremiumPassOffer; pass: PassStatusDto };

export type CheckoutOutcome =
  | { kind: "success"; pass: PassStatusDto }
  | { kind: "declined" }
  | { kind: "max-ahead"; expiresAt?: string; lifetime?: boolean }
  | { kind: "consent" }
  | { kind: "error" };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchPassStatus(intent?: "checkout"): Promise<PremiumPassStatus | null> {
  try {
    const res = await fetch(`/api/user/premium-pass${intent ? `?intent=${intent}` : ""}`, { cache: "no-store", credentials: "same-origin" });
    return res.ok ? ((await res.json()) as PremiumPassStatus) : null;
  } catch {
    return null;
  }
}

/** The SIMULATED checkout (demo mode only; the server refuses it in `stripe` mode). */
export async function postDemoCheckout(input: {
  requestId: string;
  productId: string;
  currency: string;
  method: PassMethod;
  simulate: "success" | "declined";
}): Promise<CheckoutOutcome> {
  try {
    const res = await fetch("/api/user/premium-pass/checkout", {
      method: "POST",
      credentials: "same-origin",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...input, consents: { terms: true, waiver: true } }),
    });
    const data = (await res.json().catch(() => null)) as { pass?: PassStatusDto; code?: string; expiresAt?: string } | null;
    if (res.ok && data?.pass) return { kind: "success", pass: data.pass };
    if (data?.code === "DEMO_DECLINED") return { kind: "declined" };
    if (data?.code === "MAX_AHEAD") return { kind: "max-ahead", expiresAt: data.expiresAt };
    if (data?.code === "ALREADY_LIFETIME") return { kind: "max-ahead", lifetime: true };
    if (data?.code === "CONSENT_REQUIRED") return { kind: "consent" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export type IntentOutcome =
  | { kind: "ready"; paymentId: string; clientSecret: string; paymentMethodTypes: string[] }
  | { kind: "terminal" }
  | { kind: "in-progress" }
  | { kind: "max-ahead"; expiresAt?: string; lifetime?: boolean }
  | { kind: "unavailable" }
  | { kind: "error" };

/** Creates (or, for the same attempt, updates the amount of) the PaymentIntent. Real payments: `stripe` mode only. */
export async function postPatronIntent(input: { requestId: string; productId: string; currency: string }): Promise<IntentOutcome> {
  try {
    const res = await fetch("/api/user/premium-pass/intent", {
      method: "POST",
      credentials: "same-origin",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as
      | { paymentId?: string; clientSecret?: string | null; paymentMethodTypes?: string[]; terminal?: boolean; code?: string; expiresAt?: string }
      | null;
    if (res.ok && data?.terminal) return { kind: "terminal" };
    if (res.ok && data?.paymentId && data.clientSecret) {
      return { kind: "ready", paymentId: data.paymentId, clientSecret: data.clientSecret, paymentMethodTypes: Array.isArray(data.paymentMethodTypes) ? data.paymentMethodTypes : [] };
    }
    if (data?.code === "PAYMENT_IN_PROGRESS") return { kind: "in-progress" };
    if (data?.code === "MAX_AHEAD") return { kind: "max-ahead", expiresAt: data.expiresAt };
    if (data?.code === "ALREADY_LIFETIME") return { kind: "max-ahead", lifetime: true };
    if (data?.code === "PAYMENTS_UNAVAILABLE" || data?.code === "WRONG_MODE") return { kind: "unavailable" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Records that the two boxes were ticked on the viewer's own unpaid payment; false aborts the confirmation. */
export async function postPatronConsent(input: { paymentId: string; method?: string }): Promise<boolean> {
  try {
    const res = await fetch("/api/user/premium-pass/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...input, consents: { terms: true, waiver: true } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type PaymentPoll = "SUCCEEDED" | "FAILED" | "PENDING";

/**
 * After a confirmed payment (or a redirect return): asks the payment-status endpoint, which checks Stripe and runs
 * the canonical fulfilment (it grants the access), until the payment is recorded. Never grants anything itself.
 */
export async function pollPatronPayment(paymentId: string, opts: { attempts?: number; intervalMs?: number; isCancelled?: () => boolean } = {}): Promise<PaymentPoll> {
  const attempts = opts.attempts ?? 10;
  const intervalMs = opts.intervalMs ?? 2000;
  for (let i = 0; i < attempts; i++) {
    if (opts.isCancelled?.()) return "PENDING";
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store", credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { uiStatus?: string };
        if (data.uiStatus === "SUCCEEDED") return "SUCCEEDED";
        if (data.uiStatus === "FAILED" || data.uiStatus === "REFUNDED") return "FAILED";
      }
    } catch {
      // keep polling: the webhook or the cron records the payment anyway
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return "PENDING";
}

export async function postDemoControl(action: "expire" | "reset"): Promise<PassStatusDto | null> {
  try {
    const res = await fetch("/api/user/premium-pass/demo", { method: "POST", credentials: "same-origin", headers: JSON_HEADERS, body: JSON.stringify({ action }) });
    const data = (await res.json().catch(() => null)) as { pass?: PassStatusDto } | null;
    return res.ok && data?.pass ? data.pass : null;
  } catch {
    return null;
  }
}

/** The viewer's access status, or null while loading / when the experiment is invisible to them (404). */
export function usePremiumPassStatus(enabled: boolean) {
  const [status, setStatus] = useState<PremiumPassStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    const next = await fetchPassStatus();
    setStatus(next);
    setLoaded(true);
    return next;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);
  return { status, loaded, reload, setStatus };
}

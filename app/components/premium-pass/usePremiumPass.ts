"use client";
// experiment: premium-pass (docs/experiments/premium-pass.md): browser side of the demo pass API (own account only).
import { useCallback, useEffect, useState } from "react";
import type { PremiumPassOffer } from "@/lib/modules/experiment-premium-pass/domain/offer";
import type { PassMethod, PassStatusDto } from "@/lib/modules/experiment-premium-pass/domain/pass-state";
import type { PassProductId } from "@/lib/modules/experiment-premium-pass/domain/config";

export type PremiumPassStatus = { offer: PremiumPassOffer; pass: PassStatusDto };

export type CheckoutOutcome =
  | { kind: "success"; pass: PassStatusDto }
  | { kind: "declined" }
  | { kind: "already"; expiresAt?: string }
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

export async function postDemoCheckout(input: {
  requestId: string;
  product: PassProductId;
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
    if (data?.code === "PASS_ALREADY_ACTIVE") return { kind: "already", expiresAt: data.expiresAt };
    if (data?.code === "CONSENT_REQUIRED") return { kind: "consent" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
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

/** The viewer's pass status, or null while loading / when the experiment is invisible to them (404). */
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

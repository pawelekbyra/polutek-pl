import type { PassStatusDto } from "@/lib/modules/patron-zone/domain/pass-state";
import type { PremiumPassOffer } from "@/lib/modules/patron-zone/domain/offer";
import type { TipWallet } from "../support/tip-flow-config";
import { newRequestId } from "./pass-copy";

type ActivePass = Exclude<PassStatusDto, { state: "none" }>;

export type Stage =
  | { kind: "plan" }
  | { kind: "method" }
  | { kind: "pay" }
  | { kind: "processing" }
  | { kind: "success"; pass: ActivePass }
  | { kind: "pending"; paymentId: string; timedOut: boolean }
  | { kind: "declined" }
  | { kind: "max-ahead"; expiresAt?: string; lifetime?: boolean };

/** Query parameter of the return URL of redirect methods (Przelewy24, bank redirects). */
export const PASS_PAYMENT_PARAM = "pass_payment";
export const RETURN_PARAMS = [PASS_PAYMENT_PARAM, "payment_intent", "payment_intent_client_secret", "redirect_status", "pass"];
const ATTEMPT_KEY = "pp:patron-attempt-id";
export const DEMO_PROCESSING_MS = 1_200;
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One attempt = one request id = one PaymentIntent on the server (kept for the tab, like the tip gateway's). */
export function attemptId(): string {
  try {
    const stored = window.sessionStorage.getItem(ATTEMPT_KEY);
    if (stored) return stored;
    const fresh = newRequestId();
    window.sessionStorage.setItem(ATTEMPT_KEY, fresh);
    return fresh;
  } catch {
    return newRequestId();
  }
}

export function resetAttempt() {
  try {
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // storage blocked: the next attempt simply gets a new id
  }
}

/** BLIK and Przelewy24 are Polish methods: only PLN offers them; everything else starts from the card (Stripe's reply narrows it). */
export function candidateTypes(currency: string): string[] {
  return currency === "PLN" ? ["blik", "card", "p24"] : ["card"];
}

/** Demo mode has no Stripe to ask, so the wallets are guessed from the browser (as the old method tiles did). */
export function guessWallets(): TipWallet[] {
  const w = window as unknown as { ApplePaySession?: unknown };
  const chromium = /Chrome|CriOS|Android/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
  return [...(w.ApplePaySession ? (["apple_pay"] as const) : []), ...(chromium ? (["google_pay"] as const) : [])];
}

export function buildReturnUrl(paymentId: string): string {
  const url = new URL(window.location.href);
  RETURN_PARAMS.forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  url.searchParams.set(PASS_PAYMENT_PARAM, paymentId);
  return url.toString();
}

export interface PassCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: PremiumPassOffer;
  /** Preselects an option (the offer page cards). */
  initialProductId?: string;
  /** "Enter the patron zone" after a success (refreshes the playback plan). */
  onWatch: () => void;
  watchLabel?: string;
}

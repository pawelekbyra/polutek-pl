"use client";

import { useSyncExternalStore } from "react";
import { PASSKEY_NAME_MAX_LENGTH } from "./config";

/**
 * Browser-side passkey helpers: feature detection (passkey buttons are hidden where WebAuthn is
 * missing, e.g. old browsers and some in-app web views) and a default device name.
 */

type PublicKeyCredentialStatic = {
  isConditionalMediationAvailable?: () => Promise<boolean>;
};

function publicKeyCredential(): PublicKeyCredentialStatic | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  return typeof value === "function" ? (value as unknown as PublicKeyCredentialStatic) : null;
}

/** WebAuthn is available in this browser. */
export function isPasskeySupported(): boolean {
  return publicKeyCredential() !== null && typeof navigator !== "undefined" && Boolean(navigator.credentials);
}

/** The browser can offer passkeys in the e-mail field's autofill list (conditional mediation). */
export async function isPasskeyAutofillAvailable(): Promise<boolean> {
  const check = publicKeyCredential()?.isConditionalMediationAvailable;
  if (!isPasskeySupported() || typeof check !== "function") return false;
  try {
    return await check.call(publicKeyCredential());
  } catch {
    return false;
  }
}

/**
 * `null` until mounted (server render and first client render agree), then whether passkeys can
 * be used here. Callers render nothing passkey-related while it is not `true`.
 */
export function usePasskeySupport(): boolean | null {
  return useSyncExternalStore(subscribeNever, isPasskeySupported, serverSnapshot);
}

// Browser support does not change while the page is open.
const subscribeNever = () => () => undefined;
const serverSnapshot = () => null;

/** Short, readable name of this device for the passkey list ("iPhone", "Windows", ...). */
export function defaultPasskeyName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const device = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "Mac"
            : ua.includes("cros")
              ? "Chromebook"
              : ua.includes("linux")
                ? "Linux"
                : null;
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("firefox/") || ua.includes("fxios/")
      ? "Firefox"
      : ua.includes("chrome/") || ua.includes("crios/")
        ? "Chrome"
        : ua.includes("safari/")
          ? "Safari"
          : null;
  const name = [device, browser].filter(Boolean).join(" · ");
  return (name || "Passkey").slice(0, PASSKEY_NAME_MAX_LENGTH);
}

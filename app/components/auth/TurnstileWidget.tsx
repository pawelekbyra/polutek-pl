"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useAuthPublicConfig } from "@/lib/auth/public-config";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
      "before-interactive-callback": () => void;
      "after-interactive-callback": () => void;
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "flexible" | "compact";
      retry?: "auto" | "never";
      "refresh-expired"?: "auto" | "manual" | "never";
      "refresh-timeout"?: "auto" | "manual" | "never";
      theme?: "light" | "dark" | "auto";
      language?: string;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * checking: the check runs invisibly (the form shows a spinner on its button);
 * interactive: Cloudflare needs the visitor to act, so the widget is shown;
 * verified: a token exists; failed: the check could not finish (the visitor can retry).
 */
export type CaptchaState = "checking" | "interactive" | "verified" | "failed";

export type TurnstileHandle = { reset: () => void };

/**
 * Cloudflare Turnstile bot check in `interaction-only` mode: the widget is invisible and takes no
 * space unless Cloudflare needs an interactive challenge. Renders nothing when no site key is
 * configured (then the server does not enforce the captcha either). A token is single use: call
 * `reset()` after every request that consumed it. Forms should disable submit until `onToken`
 * delivers a token and may show a spinner while `onStateChange` reports "checking".
 */
export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  { onToken: (token: string | null) => void; isPl: boolean; onStateChange?: (state: CaptchaState) => void }
>(function TurnstileWidget({ onToken, isPl, onStateChange }, ref) {
  const { turnstileSiteKey } = useAuthPublicConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onStateChangeRef = useRef(onStateChange);
  const [state, setStateRaw] = useState<CaptchaState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
    onStateChangeRef.current = onStateChange;
  });

  const setState = useCallback((next: CaptchaState) => {
    setStateRaw(next);
    onStateChangeRef.current?.(next);
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      setState("checking");
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    },
  }));

  useEffect(() => {
    if (!turnstileSiteKey || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    const fail = () => {
      onTokenRef.current(null);
      setState("failed");
    };
    setState("checking");
    void loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetIdRef.current = api.render(container, {
          sitekey: turnstileSiteKey,
          appearance: "interaction-only",
          size: "flexible",
          theme: "light",
          language: isPl ? "pl" : "en",
          retry: "auto",
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback: (token) => {
            onTokenRef.current(token);
            setState("verified");
          },
          "expired-callback": () => {
            onTokenRef.current(null);
            setState("checking");
          },
          "timeout-callback": () => {
            onTokenRef.current(null);
            setState("checking");
          },
          "error-callback": fail,
          "before-interactive-callback": () => setState("interactive"),
          "after-interactive-callback": () => setState("checking"),
        });
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      onTokenRef.current(null);
    };
  }, [turnstileSiteKey, isPl, attempt, setState]);

  if (!turnstileSiteKey) return null;

  const visible = state === "interactive";
  return (
    <>
      {/* Hidden: out of flow (absolute, zero height) so it leaves no gap in the form's spacing,
          but still laid out at full width for Cloudflare to measure. Visible: a normal block. */}
      <div
        ref={containerRef}
        data-testid="turnstile-widget"
        data-visible={visible}
        className={visible ? "flex min-h-[65px] justify-center" : "pointer-events-none absolute inset-x-0 h-0 overflow-hidden opacity-0"}
      />
      {visible && (
        <p role="status" className="text-center text-[12px] text-[var(--chan-muted)]">
          {isPl ? "Potwierdź powyżej, że nie jesteś robotem." : "Please confirm above that you are not a robot."}
        </p>
      )}
      {state === "failed" && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
          {isPl ? "Nie udało się sprawdzić zabezpieczenia. " : "We couldn't complete the security check. "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              onTokenRef.current(null);
              setAttempt((n) => n + 1);
            }}
          >
            {isPl ? "Spróbuj ponownie" : "Try again"}
          </button>
        </div>
      )}
    </>
  );
});

/** True when a captcha is configured, so forms should wait for a token before submitting. */
export function useCaptchaRequired(): boolean {
  return Boolean(useAuthPublicConfig().turnstileSiteKey);
}

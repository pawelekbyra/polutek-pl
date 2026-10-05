"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useAuthPublicConfig } from "@/lib/auth/public-config";
import type { Tx } from "@/lib/i18n/ui";
import { turnstileLanguage } from "@/lib/i18n/ui";

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
 * checking: the check runs invisibly in the background; interactive: Cloudflare needs the visitor
 * to act, so the widget is shown; verified: a token exists; failed: the check could not finish
 * (or took too long, see `stall()`), the visitor can retry.
 */
export type CaptchaState = "checking" | "interactive" | "verified" | "failed";

export type TurnstileHandle = {
  /** Drop the (used) token and fetch a fresh one in the background. */
  reset: () => void;
  /** Start over with a new widget (after an error or a stall). */
  retry: () => void;
  /** The form gave up waiting for a token: show the "taking too long, try again" message. */
  stall: () => void;
};

/**
 * Cloudflare Turnstile bot check in `interaction-only` mode with the default `execution: "render"`:
 * the check starts as soon as the widget mounts (when the form opens), invisibly and without taking
 * space. Only if Cloudflare needs an interactive challenge does the widget expand smoothly in place,
 * with a one-line explanation. Renders nothing when no site key is configured (then the server does
 * not enforce the captcha either). A token is single use: call `reset()` after every request that
 * consumed it. Forms do not wait for the token themselves: `useCaptchaGate` queues a submit until
 * the token arrives.
 */
export const TurnstileWidget = forwardRef<
  TurnstileHandle,
  { onToken: (token: string | null) => void; tx: Tx; onStateChange?: (state: CaptchaState) => void }
>(function TurnstileWidget({ onToken, tx, onStateChange }, ref) {
  const { turnstileSiteKey } = useAuthPublicConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onStateChangeRef = useRef(onStateChange);
  const [state, setStateRaw] = useState<CaptchaState>("checking");
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
    onStateChangeRef.current = onStateChange;
  });

  const setState = useCallback((next: CaptchaState) => {
    setStateRaw(next);
    onStateChangeRef.current?.(next);
  }, []);

  const retry = useCallback(() => {
    onTokenRef.current(null);
    setStalled(false);
    setAttempt((n) => n + 1);
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      setStalled(false);
      setState("checking");
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    },
    retry,
    stall: () => setStalled(true),
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
          language: turnstileLanguage(tx.language),
          retry: "auto",
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback: (token) => {
            onTokenRef.current(token);
            setStalled(false);
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
  }, [turnstileSiteKey, tx, attempt, setState]);

  if (!turnstileSiteKey) return null;

  const visible = state === "interactive";
  const problem = state === "failed" || stalled;
  return (
    <>
      {/* Collapsed (0 rows, no margin) while the check runs invisibly, so it leaves no gap in the form's
          spacing but is still laid out at full width for Cloudflare to measure. When Cloudflare needs the
          visitor, the row grows to the widget's height (no jump). */}
      <div
        data-testid="turnstile-widget"
        data-visible={visible}
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
          visible ? "grid-rows-[1fr] opacity-100" : "pointer-events-none !my-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          {visible && (
            <p role="status" className="pb-2 text-center text-[12px] font-semibold text-[var(--chan-body)]">
              {tx("Potwierdź, że nie jesteś botem.", "Confirm that you're not a bot.")}
            </p>
          )}
          <div ref={containerRef} className="flex justify-center" />
        </div>
      </div>
      {problem && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
          {stalled && state !== "failed"
            ? tx("Sprawdzanie zabezpieczenia trwa zbyt długo. ", "The security check is taking too long. ")
            : tx("Nie udało się sprawdzić zabezpieczenia. ", "We couldn't complete the security check. ")}
          <button type="button" className="underline" onClick={retry}>
            {tx("Spróbuj ponownie", "Try again")}
          </button>
        </div>
      )}
    </>
  );
});

/** True when a captcha is configured, so forms must send a token with the request. */
export function useCaptchaRequired(): boolean {
  return Boolean(useAuthPublicConfig().turnstileSiteKey);
}

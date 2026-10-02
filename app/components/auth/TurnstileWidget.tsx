"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useAuthPublicConfig } from "@/lib/auth/public-config";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
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
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

/**
 * Cloudflare Turnstile bot check. Renders nothing when no site key is configured (then the
 * server does not enforce the captcha either). A token is single use: call `reset()` after every
 * request that consumed it.
 */
export const TurnstileWidget = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void; isPl: boolean }>(
  function TurnstileWidget({ onToken, isPl }, ref) {
    const { turnstileSiteKey } = useAuthPublicConfig();
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);

    useEffect(() => {
      onTokenRef.current = onToken;
    });

    useImperativeHandle(ref, () => ({
      reset: () => {
        onTokenRef.current(null);
        if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
      },
    }));

    useEffect(() => {
      if (!turnstileSiteKey || !containerRef.current) return;
      let cancelled = false;
      const container = containerRef.current;
      void loadTurnstile()
        .then((api) => {
          if (cancelled) return;
          widgetIdRef.current = api.render(container, {
            sitekey: turnstileSiteKey,
            theme: "light",
            language: isPl ? "pl" : "en",
            callback: (token) => onTokenRef.current(token),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => onTokenRef.current(null));
      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
        onTokenRef.current(null);
      };
    }, [turnstileSiteKey, isPl]);

    if (!turnstileSiteKey) return null;
    return <div ref={containerRef} className="flex min-h-[65px] justify-center" data-testid="turnstile-widget" />;
  },
);

/** True when a captcha is configured, so forms should wait for a token before submitting. */
export function useCaptchaRequired(): boolean {
  return Boolean(useAuthPublicConfig().turnstileSiteKey);
}

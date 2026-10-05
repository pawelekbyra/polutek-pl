"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TurnstileWidget, useCaptchaRequired, type CaptchaState, type TurnstileHandle } from "./TurnstileWidget";
import type { Tx } from "@/lib/i18n/ui";

/** How long a clicked submit waits for the invisible check before it gives up (paused while the visitor solves a challenge). */
export const CAPTCHA_WAIT_TIMEOUT_MS = 15_000;

export type CaptchaGate = {
  /** The bot check to place in the form (nothing visible unless Cloudflare needs the visitor). */
  widget: React.ReactNode;
  /**
   * Call at the top of a submit handler. True: a token is there (or no captcha is configured), go on.
   * False: the token is still coming; `resubmit` runs by itself the moment it arrives.
   */
  ready: (resubmit: () => void) => boolean;
  /** The current token, read at request time (single use). */
  token: () => string | null;
  /** After a request used the token: drop it and fetch a fresh one in the background right away. */
  reset: () => void;
  /** A submit is queued, waiting for the token: show the button's spinner. */
  waiting: boolean;
};

/**
 * Lets auth forms keep their submit button visible and active from the start. The Turnstile check
 * runs in the background from the moment the form opens; a visitor who clicks before it finished
 * sees the normal spinner and the request goes out as soon as the token arrives. If the check fails
 * or takes longer than `CAPTCHA_WAIT_TIMEOUT_MS`, the queued submit is dropped and the widget shows a
 * "try again" message; clicking the button again also starts a failed check over.
 */
export function useCaptchaGate(tx: Tx): CaptchaGate {
  const required = useCaptchaRequired();
  const widgetRef = useRef<TurnstileHandle>(null);
  const tokenRef = useRef<string | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<CaptchaState>("checking");
  const [state, setState] = useState<CaptchaState>("checking");
  const [waiting, setWaiting] = useState(false);

  const cancel = useCallback(() => {
    pendingRef.current = null;
    setWaiting(false);
  }, []);
  // The token arrived: send the queued submit (it reads the token through `token()`).
  const onToken = useCallback((next: string | null) => {
    tokenRef.current = next;
    const resubmit = pendingRef.current;
    if (!next || !resubmit) return;
    pendingRef.current = null;
    setWaiting(false);
    resubmit();
  }, []);
  // The check failed: drop the queued submit (the widget shows why, with "try again").
  const onStateChange = useCallback(
    (next: CaptchaState) => {
      stateRef.current = next;
      setState(next);
      if (next === "failed") cancel();
    },
    [cancel],
  );

  // Give up after a while, but never while the visitor is solving an interactive challenge.
  useEffect(() => {
    if (!waiting || state !== "checking") return;
    const timer = setTimeout(() => {
      cancel();
      widgetRef.current?.stall();
    }, CAPTCHA_WAIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting, state, cancel]);

  const ready = useCallback(
    (resubmit: () => void) => {
      if (!required || tokenRef.current) return true;
      if (stateRef.current === "failed") widgetRef.current?.retry();
      pendingRef.current = resubmit;
      setWaiting(true);
      return false;
    },
    [required],
  );
  const reset = useCallback(() => widgetRef.current?.reset(), []);
  const readToken = useCallback(() => tokenRef.current, []);

  const widget = (
    <DropQueuedSubmitOnUnmount onUnmount={cancel}>
      <TurnstileWidget ref={widgetRef} onToken={onToken} onStateChange={onStateChange} tx={tx} />
    </DropQueuedSubmitOnUnmount>
  );

  return { widget, ready, token: readToken, reset, waiting };
}

/**
 * The widget unmounts when the dialog closes or the view changes: a submit queued there must not
 * fire later (e.g. with the old e-mail and password after the dialog was reopened).
 */
function DropQueuedSubmitOnUnmount({ onUnmount, children }: { onUnmount: () => void; children: React.ReactNode }) {
  useEffect(() => onUnmount, [onUnmount]);
  return <>{children}</>;
}

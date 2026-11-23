"use client";

import React, { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft, Lock } from "../icons";

/**
 * The frame a step is drawn in. Both the patron checkout (`patron`) and the tip gateway (`gate`) sit in the same
 * checkout panel (premium-pass.module.css: 18 px gutters, --pass-* tokens, neutral back button, navy 48 px buttons), so
 * the steps below draw themselves in that look whenever either flag is set. `gate` is the tip gateway only (it adds the
 * padlock to its payment buttons; the premium checkout keeps its own look).
 */
export const TipBackContext = createContext<{
  /** The gate's "back" action, or null on the first step (no back button is drawn, the frame look stays). */
  onBack: (() => void) | null;
  label: string;
  /** The patron checkout: its 18 px gutters, neutral back button and 50 px buttons. */
  patron?: boolean;
  /** The tip gateway: the same panel look, plus a padlock on its payment buttons. */
  gate?: boolean;
  /** The back arrow is inactive (a payment is being confirmed). */
  disabled?: boolean;
  /** Rendered between the scrolling body and the footer's top line (the checkout's step dots). */
  aboveBar?: React.ReactNode;
} | null>(null);

/**
 * One step of the tip gate: a scrollable body and a footer pinned to the bottom of the
 * fixed-size frame, so the main button never moves between steps. The back arrow sits in the
 * footer (left of the main button), keeping the header badge in one place on every step.
 */
export function TipStepLayout({
  children,
  footer,
  bodyClassName,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}) {
  const back = useContext(TipBackContext);
  const pass = Boolean(back?.patron || back?.gate);
  return (
    <>
      <div className={cn("tip-select-scroll min-h-0 flex-1 overflow-y-auto pt-0", pass ? "px-[18px] pb-[var(--pass-body-pb,10px)]" : "px-5 pb-4 md:px-7", bodyClassName)}>{children}</div>
      {footer && back?.aboveBar}
      {footer && (
        <div className={cn("shrink-0 border-t", pass ? cn(back?.gate ? "border-[var(--pass-card-line,var(--chan-line))]" : "border-[var(--chan-line)]", "px-[18px] pb-[calc(var(--pass-bar-y,10px)+env(safe-area-inset-bottom))] pt-[var(--pass-bar-y,10px)]") : "border-[var(--chan-line)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:px-7 md:pb-5")}>
          {back?.onBack ? (
            <div className="flex items-end gap-2.5">
              <button
                type="button"
                onClick={back.onBack}
                disabled={back.disabled}
                aria-label={back.label}
                className={cn(
                  "flex w-[52px] shrink-0 items-center justify-center rounded-[14px] border-2 text-[var(--chan-ink)] transition-colors hover:border-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] disabled:cursor-not-allowed disabled:opacity-55",
                  pass ? "h-[var(--pass-btn-h,48px)] !rounded-[12px] border-[var(--pass-edge,var(--pass-gray-200,var(--chan-line)))] bg-[var(--chan-card)]" : "h-[52px] border-[var(--cm-amber-38)] bg-[var(--chan-amber-soft)] hover:bg-[var(--cm-amber-28)]",
                )}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">{footer}</div>
            </div>
          ) : (
            footer
          )}
        </div>
      )}
    </>
  );
}

export function TipPrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
  busy,
  lock,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  busy?: boolean;
  /** A padlock in front of the label (payment buttons of the tip gateway; ignored outside it). */
  lock?: boolean;
}) {
  const ctx = useContext(TipBackContext);
  const pass = Boolean(ctx?.patron || ctx?.gate);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn("font-sans flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--chan-ink)] text-[16px] font-extrabold tracking-[-0.02em] text-white shadow-[0_10px_22px_-12px_rgba(17,24,39,0.55)] transition-[background-color,transform] duration-200 hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none", ctx?.gate && "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--pass-accent)] focus-visible:ring-offset-2", pass ? "h-[var(--pass-btn-h,48px)] !rounded-[12px] !text-[14px] !font-semibold bg-[var(--pass-cta,var(--chan-ink))] hover:bg-[var(--pass-cta-hover,#000)] shadow-[0_10px_18px_-8px_rgba(1,40,106,0.55),0_3px_6px_-2px_rgba(1,40,106,0.3)]" : "h-[52px]")}
    >
      {lock && ctx?.gate && !busy && <Lock size={16} aria-hidden="true" focusable="false" />}
      {children}
    </button>
  );
}

/**
 * The heading of a step. In the checkout frame it is a left-aligned field label (13 px, semibold) with an optional quiet
 * line under it, and it takes focus when the step changes (`data-step-heading`, the gate focuses it so screen readers
 * announce the new step); outside it, the centred 24 px title of the old gate.
 */
export function TipStepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const back = useContext(TipBackContext);
  if (back?.patron || back?.gate) {
    return (
      <div>
        <h3 data-step-heading="" tabIndex={-1} className="m-0 text-[14px] font-semibold leading-5 text-[var(--chan-ink)] outline-none">
          {title}
        </h3>
        {subtitle && <p className="m-0 mt-0.5 text-[13px] leading-[1.45] text-[var(--chan-body)]">{subtitle}</p>}
      </div>
    );
  }
  return (
    <div className={subtitle ? "mb-2" : "mb-1"}>
      <h2 className="font-brand m-0 text-center text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-[13px] leading-[1.55] text-[var(--chan-body)]">{subtitle}</p>}
    </div>
  );
}

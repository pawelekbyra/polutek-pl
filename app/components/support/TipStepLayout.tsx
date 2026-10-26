"use client";

import React, { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "../icons";

/** The gate's "back" action, or null on the first/last step; drawn next to the footer button. */
export const TipBackContext = createContext<{ onBack: () => void; label: string; /** The patron checkout: its 18 px gutters, neutral back button and 50 px buttons. */ patron?: boolean } | null>(null);

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
  return (
    <>
      <div className={cn("tip-select-scroll min-h-0 flex-1 overflow-y-auto pt-0", back?.patron ? "px-[18px] pb-2.5" : "px-5 pb-4 md:px-7", bodyClassName)}>{children}</div>
      {footer && (
        <div className={cn("shrink-0 border-t border-[var(--chan-line)]", back?.patron ? "px-[18px] pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5" : "px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:px-7 md:pb-5")}>
          {back ? (
            <div className="flex items-end gap-2.5">
              <button
                type="button"
                onClick={back.onBack}
                aria-label={back.label}
                className={cn(
                  "flex w-[52px] shrink-0 items-center justify-center rounded-[14px] border-2 text-[var(--chan-ink)] transition-colors hover:border-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]",
                  back.patron ? "h-[50px] border-[var(--chan-line)] bg-[var(--chan-card)]" : "h-[52px] border-[var(--cm-amber-38)] bg-[var(--chan-amber-soft)] hover:bg-[var(--cm-amber-28)]",
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
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  busy?: boolean;
}) {
  const patron = useContext(TipBackContext)?.patron;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={cn("font-sans flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--chan-ink)] text-[16px] font-extrabold tracking-[-0.02em] text-white shadow-[0_10px_22px_-12px_rgba(17,24,39,0.55)] transition-[background-color,transform] duration-200 hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none", patron ? "h-[50px]" : "h-[52px]")}
    >
      {children}
    </button>
  );
}

export function TipStepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={subtitle ? "mb-2" : "mb-1"}>
      <h2 className="font-brand m-0 text-center text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-[13px] leading-[1.55] text-[var(--chan-body)]">{subtitle}</p>}
    </div>
  );
}

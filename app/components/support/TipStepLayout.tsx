"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * One step of the tip gate: a scrollable body and a footer pinned to the bottom of the
 * fixed-size frame, so the main button never moves between steps.
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
  return (
    <>
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2 md:px-7", bodyClassName)}>{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-[var(--chan-line)] bg-[var(--chan-card)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:px-7 md:pb-5">
          {footer}
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
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className="font-sans flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,var(--chan-amber-bright),var(--chan-amber))] text-[16px] font-extrabold tracking-[-0.02em] text-[var(--chan-amber-ink)] shadow-[0_1px_0_var(--cm-amber-66-black),0_10px_22px_-10px_var(--cm-amber-62)] transition-[filter,transform] duration-200 hover:brightness-[1.04] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

export function TipStepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-brand m-0 text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">
        {title}
      </h2>
      {subtitle && <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--chan-body)]">{subtitle}</p>}
    </div>
  );
}

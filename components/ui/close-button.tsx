"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared close control: a 32 px disc inside a 44 px target, 6 px from the panel corner. */
export const CloseButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  function CloseButton({ className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        data-close-button=""
        type={type}
        className={cn("group absolute right-1.5 top-1.5 z-20 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] disabled:cursor-not-allowed disabled:opacity-60", className)}
        {...props}
      >
        <span aria-hidden="true" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chan-surface)] font-sans text-[18px] font-black leading-none transition-colors group-hover:bg-[var(--chan-line)] motion-reduce:transition-none">×</span>
      </button>
    );
  },
);

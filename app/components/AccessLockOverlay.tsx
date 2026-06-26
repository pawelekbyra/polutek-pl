"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import type { PlaybackPlanStatus } from "@/lib/services/playback/playback.dto";
import { PlayerStateFrame } from "./PlayerStateFrame";

type AccessLockState = Extract<PlaybackPlanStatus, "LOGIN_REQUIRED" | "PATRON_REQUIRED">;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

const shellRadius = {
  default: "rounded-xl",
  thumbnail: "rounded-lg",
  thumbnailCompact: "rounded-md",
} as const;

const scaleClasses = {
  default: {
    content: "p-6 sm:p-8 md:p-10",
    centerCluster: "-translate-y-[clamp(0.2rem,1.2cqi,0.8rem)]",
    icon: "h-[clamp(4rem,10cqi,6rem)] w-[clamp(4rem,10cqi,6rem)] shrink-0 aspect-square",
    iconSpace: "mb-[clamp(0.75rem,2.2cqi,1.45rem)]",
    headline: "text-[clamp(2rem,10cqi,6rem)]",
    divider: "my-[clamp(0.45rem,1.05cqi,0.6rem)] w-[clamp(6rem,18cqi,12rem)]",
    cta: "bottom-[clamp(1.5rem,4cqi,2.5rem)]",
    ctaLine: "w-24 group-hover/cta:w-48",
    ctaText: "text-[10px] tracking-[0.5em]",
  },
  thumbnail: {
    content: "p-3",
    centerCluster: "-translate-y-[clamp(0.1rem,1cqi,0.35rem)]",
    icon: "h-[clamp(2rem,18cqi,3.25rem)] w-[clamp(2rem,18cqi,3.25rem)] shrink-0 aspect-square",
    iconSpace: "mb-[clamp(0.35rem,2.1cqi,0.65rem)]",
    headline: "text-[clamp(1.05rem,14cqi,2.55rem)]",
    divider: "my-[clamp(0.18rem,1.25cqi,0.32rem)] w-[clamp(3.1rem,26cqi,5.75rem)]",
    cta: "hidden",
    ctaLine: "w-12",
    ctaText: "text-[7px] tracking-[0.3em]",
  },
  thumbnailCompact: {
    content: "p-2",
    centerCluster: "-translate-y-[clamp(0.05rem,0.8cqi,0.22rem)]",
    icon: "h-[clamp(1.75rem,18cqi,2.55rem)] w-[clamp(1.75rem,18cqi,2.55rem)] shrink-0 aspect-square",
    iconSpace: "mb-[clamp(0.25rem,1.9cqi,0.48rem)]",
    headline: "text-[clamp(0.9rem,13cqi,2rem)]",
    divider: "my-[clamp(0.14rem,1.1cqi,0.24rem)] w-[clamp(2.8rem,25cqi,4.8rem)]",
    cta: "hidden",
    ctaLine: "w-10",
    ctaText: "text-[6px] tracking-[0.25em]",
  },
} as const;

const overlayConfig = {
  LOGIN_REQUIRED: {
    firstLine: "Strefa",
    secondLine: "Zalogowanych",
    cta: "Zaloguj się, aby obczaić",
    accent: "text-[#60a5fa]",
    firstLineColor: "text-white",
    secondLineColor: "text-[#60a5fa]",
    ctaHover: "group-hover/cta:text-[#3b82f6]",
    ariaLabel: "Zaloguj się",
    aurora: "bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.70),transparent_28%),radial-gradient(circle_at_70%_60%,rgba(30,64,175,0.62),transparent_35%),linear-gradient(135deg,#1e3a8a_0%,#000_48%,#172554_100%)]",
    shadow: "drop-shadow-[0_12px_26px_rgba(96,165,250,0.25)]",
  },
  PATRON_REQUIRED: {
    firstLine: "Thank You",
    secondLine: "Zone",
    cta: "Wyślij napiwek, aby dołączyć",
    accent: "text-[#f59e0b]",
    firstLineColor: "text-[#f59e0b]",
    secondLineColor: "text-white",
    ctaHover: "group-hover/cta:text-[#f59e0b]",
    ariaLabel: "Thank You Zone",
    aurora: "bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.74),transparent_28%),radial-gradient(circle_at_72%_62%,rgba(120,53,15,0.72),transparent_36%),linear-gradient(135deg,#78350f_0%,#000_48%,#451a03_100%)]",
    shadow: "drop-shadow-[0_12px_28px_rgba(245,158,11,0.30)]",
  },
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const config = overlayConfig[state];
  const size = scaleClasses[variant];
  const isPatronState = state === "PATRON_REQUIRED";

  const icon = isPatronState ? (
    <div className={cn("inline-flex shrink-0 items-center justify-center transition-transform duration-700 ease-out group-hover/paywall:scale-110 motion-reduce:transition-none", size.iconSpace)} aria-label={config.ariaLabel}>
      <PatronGemIcon className={cn(size.icon, config.accent, config.shadow)} />
    </div>
  ) : (
    <SignInButton mode="modal">
      <button type="button" className={cn("inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 transition duration-200 hover:scale-105 hover:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#60a5fa] motion-reduce:transition-none", size.iconSpace)} aria-label={config.ariaLabel}>
        <DoorLockIcon className={cn(size.icon, config.accent, config.shadow)} />
      </button>
    </SignInButton>
  );

  const ctaContent = (
    <>
      <span className={cn("h-px bg-white/10 transition-[width] duration-500 motion-reduce:transition-none", size.ctaLine)} />
      <span className={cn("font-brand font-black uppercase leading-none", size.ctaText)}>{config.cta}</span>
    </>
  );

  return (
    <PlayerStateFrame fill={variant === "thumbnailCompact"} className={shellRadius[variant]}>
      <div className={cn("group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0a0a0a] text-white [container-type:inline-size]", shellRadius[variant])}>
        <div className="absolute inset-0 z-0 opacity-60">
          <div className={cn("h-full w-full blur-[16px] transition-transform duration-700 ease-out group-hover/paywall:scale-110 motion-reduce:transition-none", config.aurora)} />
        </div>

        <div className={cn("relative z-10 h-full w-full text-center", size.content)}>
          <div className={cn("absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center px-3", size.centerCluster)}>
            {icon}
            <div className={cn("font-brand font-black uppercase leading-[0.8] tracking-[-0.06em] whitespace-nowrap", config.firstLineColor, size.headline)}>{config.firstLine}</div>
            <div className={cn("h-px bg-white/10", size.divider)} />
            <div className={cn("font-brand font-black uppercase leading-[0.8] tracking-[-0.06em] whitespace-nowrap", config.secondLineColor, size.headline)}>{config.secondLine}</div>
          </div>

          {isPatronState ? (
            <a href="#donations" onClick={(e) => { e.preventDefault(); document.getElementById("donations")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className={cn("group/cta absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/30 no-underline transition-colors duration-200 motion-reduce:transition-none", config.ctaHover, size.cta)}>
              {ctaContent}
            </a>
          ) : (
            <SignInButton mode="modal">
              <button type="button" className={cn("group/cta absolute left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-white/30 transition-colors duration-200 hover:text-[#3b82f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#60a5fa] motion-reduce:transition-none", size.cta)}>
                {ctaContent}
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;

function PatronGemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
      <path d="M2 9h20" />
      <path d="M6 3l6 18 6-18" />
      <path d="M6 3l-4 6" />
      <path d="M18 3l4 6" />
    </svg>
  );
}

function DoorLockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <path d="M12 15v2" />
    </svg>
  );
}

"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import type { PlaybackPlanStatus } from "@/lib/services/playback/playback.dto";
import { PlayerStateFrame } from "./PlayerStateFrame";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

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
    ctaLine: "w-[1px] h-[clamp(12px,2.2cqi,20px)]",
    ctaText: "text-[clamp(9px,1.4cqi,14px)] tracking-[0.42em]",
  },
  thumbnail: {
    content: "p-3",
    centerCluster: "-translate-y-[clamp(0.1rem,1cqi,0.35rem)]",
    icon: "h-[clamp(2rem,18cqi,3.25rem)] w-[clamp(2rem,18cqi,3.25rem)] shrink-0 aspect-square",
    iconSpace: "mb-[clamp(0.35rem,2.1cqi,0.65rem)]",
    headline: "text-[clamp(1.05rem,14cqi,2.55rem)]",
    divider: "my-[clamp(0.18rem,1.25cqi,0.32rem)] w-[clamp(3.1rem,26cqi,5.75rem)]",
    cta: "hidden",
    ctaLine: "",
    ctaText: "",
  },
  thumbnailCompact: {
    content: "p-2",
    centerCluster: "-translate-y-[clamp(0.05rem,0.8cqi,0.22rem)]",
    icon: "h-[clamp(1.75rem,18cqi,2.55rem)] w-[clamp(1.75rem,18cqi,2.55rem)] shrink-0 aspect-square",
    iconSpace: "mb-[clamp(0.25rem,1.9cqi,0.48rem)]",
    headline: "text-[clamp(0.9rem,13cqi,2rem)]",
    divider: "my-[clamp(0.14rem,1.1cqi,0.24rem)] w-[clamp(2.8rem,25cqi,4.8rem)]",
    cta: "hidden",
    ctaLine: "",
    ctaText: "",
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
    ctaHover: "group-hover/cta:text-[#60a5fa]",
    aurora:
      "bg-[linear-gradient(135deg,#1e3a8a_0%,#000_52%,#172554_100%)]",
    shadow: "drop-shadow-[0_14px_30px_rgba(96,165,250,0.30)]",
    noise: false,
  },
  PATRON_REQUIRED: {
    firstLine: "Strefa",
    secondLine: "Patronów",
    cta: "Odblokuj dostęp",
    accent: "text-[#f59e0b]",
    firstLineColor: "text-[#f59e0b]",
    secondLineColor: "text-white",
    ctaHover: "group-hover/cta:text-[#f59e0b]",
    aurora:
      "bg-[radial-gradient(circle_at_35%_28%,rgba(245,158,11,0.55),transparent_30%),linear-gradient(135deg,#78350f_0%,#000_48%,#451a03_100%)]",
    shadow: "drop-shadow-[0_0_28px_rgba(245,158,11,0.35)]",
    noise: true,
  },
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const isPatronState = state === "PATRON_REQUIRED";
  const config = overlayConfig[state];
  const size = scaleClasses[variant];
  const isCompact = variant !== "default";

  return (
    <PlayerStateFrame
      fill={variant === "thumbnailCompact"}
      className={shellRadius[variant]}
    >
      <div
        className={cn(
          "group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0a0a0a] text-white [container-type:inline-size]",
          shellRadius[variant],
        )}
      >
        {/* Aurora background */}
        <div className="absolute inset-0 z-0 opacity-60">
          <div
            className={cn(
              "h-full w-full blur-[18px] transition-transform duration-700 ease-out group-hover/paywall:scale-110 motion-reduce:transition-none",
              config.aurora,
            )}
          />
        </div>

        {/* Noise grid — patron overlay, full player only */}
        {config.noise && !isCompact && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] opacity-65"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(circle,black,transparent 78%)",
              WebkitMaskImage: "radial-gradient(circle,black,transparent 78%)",
            }}
          />
        )}

        <div
          className={cn(
            "relative z-10 h-full w-full text-center",
            size.content,
          )}
        >
          {/* Icon + headline cluster */}
          <div
            className={cn(
              "absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center px-3",
              size.centerCluster,
            )}
          >
            {isPatronState ? (
              <div
                className={cn(
                  "inline-flex shrink-0 items-center justify-center transition-transform duration-700 ease-out group-hover/paywall:scale-110 motion-reduce:transition-none",
                  size.iconSpace,
                )}
                aria-label="Strefa Patronów"
              >
                <GiftBoxIcon
                  className={cn(size.icon, config.accent, config.shadow)}
                />
              </div>
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 transition duration-200 hover:scale-105 hover:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#60a5fa] motion-reduce:transition-none",
                    size.iconSpace,
                  )}
                  aria-label="Zaloguj się"
                >
                  <LoginArrowIcon
                    className={cn(size.icon, config.accent, config.shadow)}
                  />
                </button>
              </SignInButton>
            )}

            <div
              className={cn(
                "font-brand font-black uppercase leading-[0.86] tracking-[-0.01em] whitespace-nowrap",
                config.firstLineColor,
                size.headline,
              )}
            >
              {config.firstLine}
            </div>
            <div className={cn("h-px bg-white/12", size.divider)} />
            <div
              className={cn(
                "font-brand font-black uppercase leading-[0.86] tracking-[-0.01em] whitespace-nowrap",
                config.secondLineColor,
                size.headline,
              )}
            >
              {config.secondLine}
            </div>
          </div>

          {/* CTA — hidden in all thumbnail variants via size.cta = "hidden" */}
          {isPatronState ? (
            <a
              href="#donations"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("donations")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={cn(
                "group/cta absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-[10px] text-white/40 no-underline transition-colors duration-300 motion-reduce:transition-none",
                config.ctaHover,
                size.cta,
              )}
            >
              <span
                className={cn(
                  "bg-gradient-to-b from-transparent to-white/20",
                  size.ctaLine,
                )}
              />
              <span
                className={cn(
                  "font-brand font-black uppercase leading-none",
                  size.ctaText,
                )}
              >
                {config.cta}
              </span>
            </a>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                className={cn(
                  "group/cta absolute left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-[10px] border-0 bg-transparent p-0 text-white/40 transition-colors duration-300 motion-reduce:transition-none",
                  config.ctaHover,
                  size.cta,
                )}
              >
                <span
                  className={cn(
                    "bg-gradient-to-b from-transparent to-white/20",
                    size.ctaLine,
                  )}
                />
                <span
                  className={cn(
                    "font-brand font-black uppercase leading-none",
                    size.ctaText,
                  )}
                >
                  {config.cta}
                </span>
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;

function LoginArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28 8H38a2 2 0 0 1 2 2V38a2 2 0 0 1-2 2H28" />
      <path d="M6 24H30" />
      <path d="M22 16l8 8-8 8" />
    </svg>
  );
}

function GiftBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8v13" />
      <path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4Z" />
      <path d="M12 8C12 8 13 3 16 3a2.5 2.5 0 0 1 0 5h-4Z" />
    </svg>
  );
}

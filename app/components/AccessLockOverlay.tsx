"use client";

import { SignInButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
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

const overlayMotion = {
  hidden: { opacity: 0, scale: 0.985 },
  visible: { opacity: 1, scale: 1 },
} as const;

const contentMotion = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
} as const;

const heroSize = {
  default: {
    content: "px-5 py-6 md:px-10 md:py-10",
    orb: "h-20 w-20 md:h-28 md:w-28",
    icon: "h-8 w-8 md:h-11 md:w-11",
    kicker: "text-[clamp(0.58rem,1.65cqi,0.82rem)]",
    line: "text-[clamp(1.9rem,8.2cqi,5.2rem)]",
    note: "text-[clamp(0.68rem,2.1cqi,0.92rem)]",
  },
  thumbnail: {
    content: "px-3 py-3",
    orb: "h-[clamp(3.1rem,28cqi,5.5rem)] w-[clamp(3.1rem,28cqi,5.5rem)]",
    icon: "h-[clamp(1rem,7.5cqi,1.75rem)] w-[clamp(1rem,7.5cqi,1.75rem)]",
    kicker: "text-[clamp(0.46rem,4.1cqi,0.64rem)]",
    line: "text-[clamp(1rem,8.6cqi,2.18rem)]",
    note: "text-[clamp(0.49rem,4cqi,0.7rem)]",
  },
} as const;

const compactSize = {
  icon: "h-[clamp(0.85rem,13cqi,1.25rem)] w-[clamp(0.85rem,13cqi,1.25rem)]",
  label: "text-[clamp(0.5rem,7cqi,0.7rem)]",
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";
  const isCompact = variant === "thumbnailCompact";
  const isPl = language === "pl";

  const overlayCopy = isPatronState
    ? {
        kicker: isPl ? "strefa patrona" : "patron room",
        lineOne: isPl ? "ZA KULISAMI" : "BEHIND",
        lineTwo: isPl ? "" : "THE SCENES",
        compactLabel: isPl ? "PATRON" : "PATRON",
        note: isPl
          ? "Odcinek otwiera jednorazowe wsparcie — bez subskrypcji."
          : "Unlocked by a one-time support gift — no subscription.",
        gradient: "from-[#251000] via-[#130d07] to-[#040404]",
        mesh: "bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.48),transparent_24%),radial-gradient(circle_at_76%_28%,rgba(249,115,22,0.24),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.11)_0_1px,transparent_1px_18px)]",
        glow: "bg-amber-300/28",
        accent: "text-amber-200",
        border: "border-amber-200/25",
        ring: "ring-amber-200/30",
      }
    : {
        kicker: isPl ? "konto widza" : "viewer account",
        lineOne: isPl ? "WEJDŹ" : "STEP",
        lineTwo: isPl ? "DO ŚRODKA" : "INSIDE",
        compactLabel: isPl ? "LOGIN" : "SIGN IN",
        note: isPl
          ? "Zaloguj się, żeby bezpiecznie uruchomić odtwarzanie."
          : "Sign in to securely start playback.",
        gradient: "from-[#03182d] via-[#08111f] to-[#030406]",
        mesh: "bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.45),transparent_24%),radial-gradient(circle_at_76%_28%,rgba(99,102,241,0.28),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.1)_0_1px,transparent_1px_18px)]",
        glow: "bg-cyan-300/24",
        accent: "text-cyan-200",
        border: "border-cyan-200/25",
        ring: "ring-cyan-200/30",
      };

  const Icon = isPatronState ? PatronGemIcon : DoorLockIcon;

  if (isCompact) {
    return (
      <PlayerStateFrame fill>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={overlayMotion}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#070707] text-white [container-type:inline-size]"
        >
          <AccessLockBackdrop gradient={overlayCopy.gradient} mesh={overlayCopy.mesh} glow={overlayCopy.glow} />

          <motion.div
            variants={contentMotion}
            transition={{ delay: 0.08, duration: 0.42, ease: "easeOut" }}
            className={cn("relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full border bg-black/38 px-2 py-1 text-center shadow-[0_12px_34px_rgba(0,0,0,0.45)] ring-1 backdrop-blur-md", overlayCopy.border, overlayCopy.ring)}
          >
            <Icon className={cn("shrink-0", overlayCopy.accent, compactSize.icon)} />
            <span className={cn("max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-brand font-black uppercase leading-none tracking-[0.14em]", overlayCopy.accent, compactSize.label)}>
              {overlayCopy.compactLabel}
            </span>
          </motion.div>

          {isLoginState && (
            <SignInButton mode="modal">
              <button
                type="button"
                className="absolute inset-0 z-20 cursor-pointer bg-transparent text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white/70"
                aria-label={isPl ? "Zaloguj się" : "Sign in"}
              />
            </SignInButton>
          )}
        </motion.div>
      </PlayerStateFrame>
    );
  }

  const size = heroSize[variant];

  return (
    <PlayerStateFrame className={variant === "thumbnail" ? "rounded-lg" : undefined}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={overlayMotion}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#070707] text-white [container-type:inline-size]"
      >
        <AccessLockBackdrop gradient={overlayCopy.gradient} mesh={overlayCopy.mesh} glow={overlayCopy.glow} />

        <motion.div
          variants={contentMotion}
          transition={{ delay: 0.09, duration: 0.5, ease: "easeOut" }}
          className={cn("relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden text-center", size.content)}
        >
          <div className={cn("relative mb-2 flex items-center justify-center rounded-full border bg-white/[0.055] shadow-[0_22px_70px_rgba(0,0,0,0.45)] ring-1 backdrop-blur-md md:mb-4", overlayCopy.border, overlayCopy.ring, size.orb)}>
            <div className={cn("absolute inset-2 rounded-full blur-xl", overlayCopy.glow)} />
            <Icon className={cn("relative z-10 drop-shadow-[0_0_18px_rgba(255,255,255,0.16)]", overlayCopy.accent, size.icon)} />
          </div>

          <div className={cn("mb-2 inline-flex items-center rounded-full border bg-black/28 px-3 py-1 shadow-[0_12px_35px_rgba(0,0,0,0.3)] backdrop-blur-md", overlayCopy.border)}>
            <span className={cn("font-black uppercase leading-none tracking-[0.22em] text-white/78", size.kicker)}>
              {overlayCopy.kicker}
            </span>
          </div>

          <div className="flex max-w-full flex-col items-center overflow-hidden">
            <span className={cn("font-brand font-black uppercase leading-[0.84] tracking-tighter whitespace-nowrap text-white", size.line)}>
              {overlayCopy.lineOne}
            </span>
            {overlayCopy.lineTwo && (
              <span className={cn("font-brand font-black uppercase leading-[0.84] tracking-tighter whitespace-nowrap", overlayCopy.accent, size.line)}>
                {overlayCopy.lineTwo}
              </span>
            )}
          </div>

          <p className={cn("mt-2 max-w-[31rem] text-balance font-medium leading-snug text-white/72 md:mt-4", size.note)}>
            {overlayCopy.note}
          </p>

          <div className="mt-6 flex gap-4 md:mt-8">
            {isLoginState && (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-full bg-white px-8 py-3 text-[min(12px,3.5cqi)] font-black uppercase tracking-widest text-[#070707] transition-all hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
                >
                  {isPl ? "Zaloguj się" : "Sign in"}
                </button>
              </SignInButton>
            )}

            {isPatronState && (
              <a
                href="#support"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('support-box')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="rounded-full bg-amber-400 px-8 py-3 text-[min(12px,3.5cqi)] font-black uppercase tracking-widest text-[#251000] transition-all hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-95"
              >
                {isPl ? "Wesprzyj jednorazowo" : "One-time support"}
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;

function AccessLockBackdrop({ gradient, mesh, glow }: { gradient: string; mesh: string; glow: string }) {
  return (
    <>
      <div className={cn("absolute inset-0 z-0 bg-gradient-to-br opacity-98 transition-transform duration-700 group-hover/paywall:scale-[1.035] motion-reduce:transition-none", gradient)} />
      <motion.div
        aria-hidden="true"
        animate={{ x: [0, 12, 0], y: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className={cn("absolute -left-[15%] -top-[30%] z-0 h-[78%] w-[68%] rounded-full blur-3xl motion-reduce:hidden", glow)}
      />
      <div className={cn("absolute inset-0 z-0 opacity-55", mesh)} />
      <div className="absolute inset-x-0 bottom-0 z-0 h-2/3 bg-gradient-to-t from-black/88 via-black/35 to-transparent" />
      <div className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08),transparent_18%,transparent_82%,rgba(255,255,255,0.06))] opacity-70" />
    </>
  );
}

function PatronGemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.4 4.5h11.2L21 9l-9 11L3 9l3.4-4.5Z" fill="currentColor" opacity="0.2" />
      <path d="M6.4 4.5h11.2L21 9l-9 11L3 9l3.4-4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3.4 9h17.2M8.2 4.8 12 20M15.8 4.8 12 20" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <path d="M18.7 2.8v2.6M17.4 4.1H20" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

function DoorLockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 21V4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V21" fill="currentColor" opacity="0.16" />
      <path d="M7 21V4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V21M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 12.2h2M12 12.2v2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.2 8.4a2.8 2.8 0 0 1 5.6 0v1.2H9.2V8.4Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
    </svg>
  );
}

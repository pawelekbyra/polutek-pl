"use client";

import { LockKeyhole, Star } from "lucide-react";
import { useAuthModal } from "./auth/AuthModalProvider";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const isPatron = state === "PATRON_REQUIRED";
  const isPl = language === "pl";
  const isCompact = variant !== "default";
  const Icon = isPatron ? Star : LockKeyhole;

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const label = isPatron
      ? isPl ? "Patroni" : "Patrons"
      : isPl ? "Zaloguj się" : "Sign in";

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 overflow-hidden [container-type:inline-size]",
            isPatron ? "bg-amber-500" : "bg-[#2563eb]",
          )}
        >
          <div
            className={cn(
              "grid place-items-center rounded-xl border border-white/25 bg-white/16 text-white shadow-sm backdrop-blur-sm",
              isTiny ? "h-7 w-7" : "h-9 w-9",
            )}
          >
            <Icon className={isTiny ? "h-4 w-4" : "h-[18px] w-[18px]"} />
          </div>
          <span className="px-2 text-center font-sans text-[clamp(9px,8cqi,11px)] font-bold uppercase leading-tight tracking-[0.08em] text-white">
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  return (
    <PlayerStateFrame className="rounded-[18px]">
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[var(--chan-nav,#f7f1e4)] p-6 [container-type:inline-size]">
        <div
          className={cn(
            "absolute left-1/2 top-1/2 h-[70%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl",
            isPatron ? "bg-amber-300/25" : "bg-blue-400/20",
          )}
          aria-hidden="true"
        />

        <div className="relative flex w-full max-w-[390px] flex-col items-center gap-[clamp(13px,2.5cqi,19px)] rounded-[20px] border border-[color-mix(in_srgb,var(--chan-ink)_12%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_94%,white)] px-7 py-[clamp(24px,5cqi,36px)] text-center shadow-[0_18px_46px_rgba(15,23,42,0.14)]">
          <div
            className={cn(
              "grid h-[clamp(52px,10cqi,66px)] w-[clamp(52px,10cqi,66px)] place-items-center rounded-[17px] text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]",
              isPatron ? "bg-amber-500" : "bg-[#2563eb]",
            )}
          >
            <Icon className="h-[clamp(24px,5cqi,30px)] w-[clamp(24px,5cqi,30px)]" />
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="font-brand text-[clamp(20px,4.6cqi,28px)] font-bold leading-tight text-[var(--chan-ink)]">
              {isPatron
                ? isPl ? "Strefa Patronów" : "Patron Zone"
                : isPl ? "Zaloguj się" : "Sign In"}
            </h2>
            <p className="font-sans text-[clamp(12.5px,2.3cqi,15px)] leading-relaxed text-[var(--chan-muted,#64748b)]">
              {isPatron
                ? isPl ? "Jednorazowe wsparcie odblokowuje dostęp na zawsze" : "One-time support unlocks access forever"
                : isPl ? "aby obejrzeć ten materiał" : "to watch this video"}
            </p>
          </div>

          {isPatron ? (
            <a
              href="#donations"
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById("donations")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-6 font-brand text-[clamp(13px,2.4cqi,15px)] font-bold text-[#211d18] shadow-[0_8px_20px_rgba(245,158,11,0.22)] transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-px hover:bg-amber-400 hover:shadow-[0_10px_24px_rgba(245,158,11,0.28)] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {isPl ? "Wesprzyj kanał" : "Support Channel"}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2563eb] px-6 font-brand text-[clamp(13px,2.4cqi,15px)] font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-px hover:bg-[#1d4ed8] hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              {isPl ? "Zaloguj się" : "Sign In"}
            </button>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;

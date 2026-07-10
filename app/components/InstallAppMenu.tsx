"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NajsIcon } from "./najs/primitives";
import { usePwaInstall } from "@/app/hooks/usePwaInstall";
import { useLanguage } from "./LanguageContext";

interface InstallAppMenuProps {
  className?: string;
}

export default function InstallAppMenu({ className }: InstallAppMenuProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { installed, isIOS, canInstallDirectly, install } = usePwaInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowIosInstructions(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // The install action is only actually available on iOS (manual
  // instructions) or when the browser captured a native install prompt.
  // Otherwise the button stays visible but inactive/informational.
  const canOfferInstall = !installed && (isIOS || canInstallDirectly);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosInstructions(true);
      return;
    }
    if (canInstallDirectly) {
      setIsOpen(false);
      await install();
    }
  };

  return (
    <div className={cn("relative", className)} ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setShowIosInstructions(false);
        }}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-[12px] px-3 shrink-0 font-sans text-base font-bold text-[var(--chan-ink)] transition-transform hover:-translate-y-px active:scale-95",
          !installed && !canOfferInstall && "opacity-50",
        )}
        aria-label={isPl ? "Zainstaluj aplikację" : "Install app"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <NajsIcon name="download" className="h-5 w-5" stroke="currentColor" />
        <span className="hidden sm:inline leading-none">{isPl ? "Pobierz appkę" : "Get the app"}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[1100] mt-2 min-w-[230px] rounded-2xl border border-[var(--chan-line)] bg-white p-1.5 shadow-[0_8px_26px_rgba(23,23,23,0.12)] animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {installed ? (
            <div className="px-3 py-2.5 text-[13px] font-bold text-[var(--chan-ink)]">
              {isPl ? "Przecież już masz ściągniętą apkę 😎" : "You've already got the app 😎"}
            </div>
          ) : showIosInstructions ? (
            <div className="px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--chan-ink)]">
              <p className="mb-1 font-bold">
                {isPl ? "Zainstaluj na iPhonie/iPadzie" : "Install on iPhone/iPad"}
              </p>
              <p className="text-[var(--chan-muted)]">
                {isPl
                  ? 'Stuknij ikonę Udostępnij w Safari, a potem "Dodaj do ekranu początkowego".'
                  : 'Tap the Share icon in Safari, then "Add to Home Screen".'}
              </p>
            </div>
          ) : canOfferInstall ? (
            <button
              type="button"
              role="menuitem"
              onClick={handleInstallClick}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)]"
            >
              <NajsIcon name="download" className="h-4 w-4" stroke="var(--chan-ink)" />
              {isPl ? "Zainstaluj aplikację" : "Install app"}
            </button>
          ) : (
            <div className="px-3 py-2.5 text-[12px] font-bold text-[var(--chan-muted)]">
              {isPl
                ? "Instalacja niedostępna w tej przeglądarce"
                : "Installation isn't available in this browser"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
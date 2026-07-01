"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Frame, NajsIcon, INK } from "./najs/primitives";
import { usePwaInstall } from "@/app/hooks/usePwaInstall";
import { useLanguage } from "./LanguageContext";

interface InstallAppMenuProps {
  className?: string;
}

export default function InstallAppMenu({ className }: InstallAppMenuProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { installed, canInstallDirectly, install } = usePwaInstall();
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

  const handleInstallClick = async () => {
    if (canInstallDirectly) {
      setIsOpen(false);
      await install();
      return;
    }
    setShowIosInstructions(true);
  };

  return (
    <div className={cn("relative", className)} ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          setShowIosInstructions(false);
        }}
        className="relative w-[38px] h-[38px] flex items-center justify-center shrink-0 active:scale-95"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Frame radius={20} seed={31} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
        <NajsIcon name="more" className="relative h-[18px] w-[18px]" stroke={INK} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[1100] mt-2 min-w-[230px] rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {installed ? (
            <div className="px-3 py-2.5 text-[12px] font-bold text-neutral-500">
              {isPl ? "Aplikacja jest już zainstalowana" : "The app is already installed"}
            </div>
          ) : showIosInstructions ? (
            <div className="px-3 py-2.5 text-[12.5px] leading-relaxed text-[#171717]">
              <p className="mb-1 font-bold">
                {isPl ? "Zainstaluj na iPhonie/iPadzie" : "Install on iPhone/iPad"}
              </p>
              <p>
                {isPl
                  ? 'Stuknij ikonę Udostępnij w Safari, a potem "Dodaj do ekranu początkowego".'
                  : 'Tap the Share icon in Safari, then "Add to Home Screen".'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={handleInstallClick}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[#171717] transition-colors hover:bg-secondary"
            >
              <NajsIcon name="download" className="h-[16px] w-[16px]" stroke={INK} />
              {isPl ? "Zainstaluj aplikację" : "Install app"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

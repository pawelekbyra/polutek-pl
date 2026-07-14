"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { usePwaInstall } from "@/app/hooks/usePwaInstall";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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

  // The install action is only actually available on iOS (manual
  // instructions) or when the browser captured a native install prompt.
  // Otherwise the button stays visible but informational.
  const canOfferInstall = !installed && (isIOS || canInstallDirectly);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setShowIosInstructions(false);
    }
  };

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
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn("relative", className)}>
        <DropdownMenuTrigger
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--chan-surface)] font-sans text-sm font-bold text-[var(--chan-ink)] transition-transform hover:-translate-y-px hover:brightness-110 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none",
            !installed && !canOfferInstall && "opacity-50",
          )}
          aria-label={isPl ? "Zainstaluj aplikację" : "Install app"}
        >
          <Download aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.8} />
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[1100] w-[250px] rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 text-[var(--chan-ink)] shadow-[0_8px_26px_rgba(23,23,23,0.12)] ring-0"
      >
        {installed ? (
          <DropdownMenuItem
            disabled
            className="min-h-10 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[var(--chan-ink)] opacity-100"
          >
            {isPl ? "Przecież już masz ściągniętą apkę 😎" : "You've already got the app 😎"}
          </DropdownMenuItem>
        ) : showIosInstructions ? (
          <DropdownMenuItem
            disabled
            className="flex-col items-start px-3 py-2.5 text-[12.5px] font-normal leading-relaxed text-[var(--chan-ink)] opacity-100"
          >
            <span className="mb-1 block font-bold">
              {isPl ? "Zainstaluj na iPhonie/iPadzie" : "Install on iPhone/iPad"}
            </span>
            <span className="block text-[var(--chan-muted)]">
              {isPl
                ? 'Stuknij ikonę Udostępnij w Safari, a potem "Dodaj do ekranu początkowego".'
                : 'Tap the Share icon in Safari, then "Add to Home Screen".'}
            </span>
          </DropdownMenuItem>
        ) : canOfferInstall ? (
          <DropdownMenuItem
            closeOnClick={!isIOS}
            onClick={() => void handleInstallClick()}
            className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)] motion-reduce:transition-none"
          >
            <Download aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {isPl ? "Zainstaluj aplikację" : "Install app"}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled
            className="min-h-10 rounded-xl px-3 py-2.5 text-[12px] font-bold text-[var(--chan-muted)] opacity-100"
          >
            {isPl
              ? "Instalacja niedostępna w tej przeglądarce"
              : "Installation isn't available in this browser"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

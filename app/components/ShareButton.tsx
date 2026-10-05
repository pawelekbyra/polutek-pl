"use client";

import { Check, Copy, Mail, Send } from "lucide-react";

import {
  BlueSkyIcon,
  FacebookIcon,
  LinkedInIcon,
  PinterestIcon,
  RedditIcon,
  TelegramIcon,
  WhatsAppIcon,
  WykopIcon,
} from "@/app/components/icons/brand-icons";
import { useShare } from "@/app/hooks/useShare";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import type { Tx } from "@/lib/i18n/ui";
import { useLanguage } from "./LanguageContext";

interface ShareButtonProps {
  url?: string;
  title: string;
  text?: string;
  className?: string;
  /** Stretch to fill remaining row width on mobile, matching desktop's fixed width from `lg` up. */
  fill?: boolean;
}

function buildShareCopy(tx: Tx) {
  return {
    triggerLabel: tx("Udostępnij", "Share"),
    copied: tx("Skopiowano!", "Copied!"),
    copyLink: tx("Kopiuj link", "Copy link"),
    shareOnX: tx("Udostępnij na X", "Share on X"),
    shareOnFacebook: tx("Udostępnij na Facebook", "Share on Facebook"),
    shareOnWhatsApp: tx("Wyślij przez WhatsApp", "Send via WhatsApp"),
    shareOnTelegram: tx("Wyślij na Telegram", "Send via Telegram"),
    shareOnLinkedIn: tx("Udostępnij na LinkedIn", "Share on LinkedIn"),
    shareOnReddit: tx("Udostępnij na Reddit", "Share on Reddit"),
    shareOnBluesky: tx("Udostępnij na Bluesky", "Share on Bluesky"),
    shareOnWykop: tx("Udostępnij na Wykop", "Share on Wykop"),
    shareOnPinterest: tx("Zapisz na Pinterest", "Save on Pinterest"),
    shareByEmail: tx("Wyślij emailem", "Send by email"),
  };
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0 fill-current", className)}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function ShareButton({
  url: propUrl,
  title,
  text,
  className,
  fill = false,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t, tx } = useLanguage();
  const { isMobile, canNativeShare, share, copied, copyToClipboard } = useShare();
  const copy = useMemo(() => buildShareCopy(tx), [tx]);
  const url = propUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const useNativeShare = isMobile && canNativeShare;

  const handleOpenChange = (open: boolean) => {
    if (open && useNativeShare) {
      void share({ title, text, url }).then((result) => {
        if (result === "failed" || result === "unsupported") {
          setIsOpen(true);
        }
      });
      return;
    }

    setIsOpen(open);
  };

  const itemClassName =
    "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--chan-ink)] transition-colors duration-100 hover:bg-[var(--chan-surface)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)] motion-reduce:transition-none";

  const e = encodeURIComponent;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn("relative", fill ? "flex-1 lg:flex-none" : "inline-block")}>
        <DropdownMenuTrigger
          className={cn(
            "relative flex h-9 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--chan-surface)] px-3 font-sans text-sm font-bold text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none",
            fill && "w-full",
            className,
          )}
          aria-label={copy.triggerLabel}
        >
          <Send aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="leading-none">{t.share}</span>
        </DropdownMenuTrigger>
      </div>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="tip-select-scroll z-[1100] w-[248px] overflow-y-auto rounded-2xl border border-[var(--cm-line-80)] bg-[var(--cm-card-94-white)] p-1.5 text-[var(--chan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_18px_44px_-16px_rgba(23,23,23,0.26)] ring-0 backdrop-blur-xl"
      >
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => void copyToClipboard(url)}
          className={cn(
            itemClassName,
            "font-bold uppercase tracking-wider text-[var(--chan-blue)] focus:text-[var(--chan-blue)]",
            copied && "bg-[var(--cm-blue-12-white)]",
          )}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copied ? copy.copied : copy.copyLink}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-0 bg-[var(--chan-line)]" />

        <DropdownMenuItem
          render={
            <a
              href={`https://x.com/intent/tweet?text=${e(title)}&url=${e(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <XIcon />
          <span>{copy.shareOnX}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${e(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <FacebookIcon />
          <span>{copy.shareOnFacebook}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://wa.me/?text=${e(`${title} ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <WhatsAppIcon />
          <span>{copy.shareOnWhatsApp}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://t.me/share/url?url=${e(url)}&text=${e(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <TelegramIcon />
          <span>{copy.shareOnTelegram}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <LinkedInIcon />
          <span>{copy.shareOnLinkedIn}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <RedditIcon />
          <span>{copy.shareOnReddit}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://bsky.app/intent/compose?text=${e(`${title} ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <BlueSkyIcon />
          <span>{copy.shareOnBluesky}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://www.wykop.pl/dodaj/link/?url=${e(url)}&title=${e(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <WykopIcon />
          <span>{copy.shareOnWykop}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a
              href={`https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(title)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          className={itemClassName}
        >
          <PinterestIcon />
          <span>{copy.shareOnPinterest}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          render={
            <a href={`mailto:?subject=${e(title)}&body=${e(url)}`} />
          }
          className={cn(itemClassName, "text-[var(--chan-muted)] focus:text-[var(--chan-muted)]")}
        >
          <Mail aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>{copy.shareByEmail}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

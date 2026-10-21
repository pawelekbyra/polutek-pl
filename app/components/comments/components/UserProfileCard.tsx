"use client";

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { X } from "../../icons";
import { SafeAvatar } from "../../SafeAvatar";
import { AuthorBadge } from "./AuthorBadge";
import type { CommentBadgeKind } from "../types";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

/** Avatar diameter inside the card (the source image is 256 px, so it stays sharp). */
export const PROFILE_AVATAR_SIZE = 160;

interface UserProfileCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: Locale;
  /** The public name the user chose (never an e-mail address). */
  displayName: string;
  /** Already resolved by the caller (the viewer's own comments use the live session avatar). */
  avatarSrc?: string | null;
  badge?: CommentBadgeKind | null;
}

/**
 * Small public profile card opened from a comment author's name or avatar. Built only from what
 * the comment DTO already carries (display name, avatar, badges): it never shows
 * an e-mail address or anything private, and it fetches nothing.
 */
export function UserProfileCard({
  open,
  onOpenChange,
  language,
  displayName,
  avatarSrc,
  badge,
}: UserProfileCardProps) {
  const tx = useOptionalTx(language);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30" />
        <DialogPopup
          data-testid="user-profile-card"
          className="fixed left-1/2 top-1/2 z-[1101] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-ink)] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)] outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-3 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none"
        >
          {/* Band the avatar overlaps: the site's ink colour, like its primary buttons (tokens only, so it follows light/dark). */}
          <div aria-hidden="true" className="h-24 bg-[var(--chan-ink)]" />
          {/* Close sits on the ink band: a solid card-coloured disc with an ink X is the exact inverse of the band, so the
              X keeps the ink-on-card contrast (>= 15:1) and the disc stays distinct from the band if the pair ever flips.
              The focus ring is offset with the band colour so it reads as a halo, not as a smear on the disc. */}
          <DialogClose
            aria-label={tx("Zamknij", "Close")}
            className="absolute right-3 top-3 grid cursor-pointer h-9 w-9 place-items-center rounded-full bg-[var(--chan-card)] text-[var(--chan-ink)] shadow-[0_2px_8px_-2px_rgba(15,23,42,0.5)] transition-colors hover:bg-[var(--chan-surface)] active:bg-[var(--chan-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--chan-ink)] motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-[18px] w-[18px]" />
          </DialogClose>

          <div className="flex flex-col items-center px-6 pb-7 text-center">
            <div className="-mt-20">
              <SafeAvatar
                src={avatarSrc}
                alt=""
                size={PROFILE_AVATAR_SIZE}
                className={cn("ring-4 shadow-[0_14px_34px_-14px_rgba(15,23,42,0.5)]", badge ? "ring-[var(--cm-blue-22)] border-2 border-[var(--chan-blue)]" : "ring-[var(--chan-card)]")}
              />
            </div>

            <DialogTitle className="mt-4 max-w-full break-words text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--chan-ink)]">
              {displayName}
            </DialogTitle>
            {badge && (
              <div className="mt-3">
                <AuthorBadge kind={badge} language={language} />
              </div>
            )}
            <DialogDescription className="sr-only">{tx("Profil użytkownika", "User profile")}</DialogDescription>

          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

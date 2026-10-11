"use client";

import React from "react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** The user's @handle, shown only when it differs from the display name. */
  username?: string | null;
  /** Already resolved by the caller (the viewer's own comments use the live session avatar). */
  avatarSrc?: string | null;
  badge?: CommentBadgeKind | null;
  /** More facts later (joined date, comment count): pass `UserProfileRow`s. */
  children?: React.ReactNode;
}

/** One labelled fact under the name. Add rows as children of `UserProfileCard`. */
export function UserProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
      <dt className="text-[var(--chan-muted)]">{label}</dt>
      <dd className="m-0 min-w-0 truncate font-semibold text-[var(--chan-ink)]">{children}</dd>
    </div>
  );
}

/**
 * Small public profile card opened from a comment author's name or avatar. Built only from what
 * the comment DTO already carries (id, display name, username, avatar, badges): it never shows
 * an e-mail address or anything private, and it fetches nothing.
 */
export function UserProfileCard({
  open,
  onOpenChange,
  language,
  displayName,
  username,
  avatarSrc,
  badge,
  children,
}: UserProfileCardProps) {
  const tx = useOptionalTx(language);
  const handle = username && username !== displayName ? username : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30" />
        <DialogPopup
          data-testid="user-profile-card"
          className="fixed left-1/2 top-1/2 z-[1101] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-ink)] shadow-[0_32px_80px_-24px_rgba(15,23,42,0.45)] outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-bottom-3 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none"
        >
          {/* Soft tinted band the avatar overlaps (tokens only, so it follows light/dark). */}
          <div
            aria-hidden="true"
            className="h-24 bg-[linear-gradient(135deg,var(--cm-amber-20),var(--cm-blue-20))]"
          />
          <DialogClose
            aria-label={tx("Zamknij", "Close")}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[var(--chan-card)]/70 text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none"
          >
            <X aria-hidden="true" className="h-[18px] w-[18px]" />
          </DialogClose>

          <div className="flex flex-col items-center px-6 pb-7 text-center">
            <div className="-mt-20">
              <SafeAvatar
                src={avatarSrc}
                alt={displayName}
                size={PROFILE_AVATAR_SIZE}
                className="ring-4 ring-[var(--chan-card)] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.5)]"
              />
            </div>

            <DialogTitle className="mt-4 max-w-full break-words text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--chan-ink)]">
              {displayName}
            </DialogTitle>
            {handle && (
              <p className="mt-1 max-w-full truncate text-[13px] text-[var(--chan-muted)]">@{handle}</p>
            )}
            {badge && (
              <div className="mt-3">
                <AuthorBadge kind={badge} language={language} />
              </div>
            )}
            <DialogDescription className="sr-only">{tx("Profil użytkownika", "User profile")}</DialogDescription>

            {children && (
              <dl className="m-0 mt-5 w-full divide-y divide-[var(--chan-line)] border-t border-[var(--chan-line)] text-left">
                {children}
              </dl>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

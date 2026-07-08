"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser, useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "../icons";
import { useLanguage } from "../LanguageContext";
import AccountModal from "./AccountModal";

interface UserMenuProps {
  isAdmin: boolean;
  isPatron: boolean;
}

// Custom replacement for Clerk's default user button: avatar trigger + our own dropdown and
// account panel. Clerk stays the backend (useUser/useClerk); no default Clerk UI is rendered.
export default function UserMenu({ isAdmin, isPatron }: UserMenuProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) return null;

  const displayName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "";
  const email = user.primaryEmailAddress?.emailAddress || "";
  const avatar = user.imageUrl;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={isPl ? "Menu konta" : "Account menu"}
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all active:scale-95"
        title={isPatron ? "Patron" : undefined}
      >
        <span
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full",
            isPatron
              ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
              : "border border-white/25",
          )}
        >
          {avatar ? (
            <Image src={avatar} alt="" width={30} height={30} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-sm font-bold text-[var(--chan-ink)]">{(displayName[0] || "?").toUpperCase()}</span>
          )}
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-60 rounded-2xl border border-[var(--chan-line)] bg-white p-2 font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(23,23,23,0.14)]"
        >
          <div>
            <div className="border-b border-[var(--chan-line)] px-2 pb-2 pt-1">
              <p className="truncate text-[14px] font-bold">{displayName}</p>
              {email && <p className="truncate text-[12px] text-[var(--chan-muted)]">{email}</p>}
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setAccountOpen(true);
              }}
              className="mt-1 w-full rounded-lg px-2 py-2 text-left text-[14px] font-semibold hover:bg-[var(--chan-surface)]"
            >
              {isPl ? "Moje konto" : "My account"}
            </button>

            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[14px] font-semibold hover:bg-[var(--chan-surface)]"
              >
                <ShieldCheck size={16} />
                {isPl ? "Zarządzaj kanałem" : "Manage channel"}
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
              className="mt-1 w-full rounded-lg border-t border-[var(--chan-line)] px-2 py-2 text-left text-[14px] font-semibold text-red-600 hover:bg-red-50"
            >
              {isPl ? "Wyloguj się" : "Sign out"}
            </button>
          </div>
        </div>
      )}

      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} isAdmin={isAdmin} />
    </div>
  );
}

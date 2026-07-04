"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser, useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "../icons";
import { Frame, INK } from "../najs/primitives";
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
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all active:scale-95",
          isPatron
            ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
            : "border border-[#171717]/25",
        )}
        title={isPatron ? "Patron" : undefined}
      >
        {avatar ? (
          <Image src={avatar} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span className="text-sm font-bold text-[#171717]">{(displayName[0] || "?").toUpperCase()}</span>
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-60 p-2 text-[#171717]"
          style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
        >
          <Frame radius={14} seed={23} stroke={INK} strokeWidth={1.3} fill="#ffffff" showShadow />
          <div className="relative z-10">
            <div className="border-b border-[#171717]/10 px-2 pb-2 pt-1">
              <p className="truncate text-[14px] font-bold">{displayName}</p>
              {email && <p className="truncate text-[12px] text-[#7a7a7a]">{email}</p>}
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setAccountOpen(true);
              }}
              className="mt-1 w-full rounded-lg px-2 py-2 text-left text-[14px] font-semibold hover:bg-[#171717]/5"
            >
              {isPl ? "Moje konto" : "My account"}
            </button>

            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[14px] font-semibold hover:bg-[#171717]/5"
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
              className="mt-1 w-full rounded-lg border-t border-[#171717]/10 px-2 py-2 text-left text-[14px] font-semibold text-red-600 hover:bg-red-50"
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

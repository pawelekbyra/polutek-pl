"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { ShieldCheck } from "../icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "../LanguageContext";
import AccountModal from "./AccountModal";

interface UserMenuProps {
  isAdmin: boolean;
  isPatron: boolean;
}

// Custom replacement for Clerk's default user button. Clerk remains the
// identity backend; the application owns all visible account UI.
export default function UserMenu({ isAdmin, isPatron }: UserMenuProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  if (!user) return null;

  const displayName =
    user.fullName ||
    user.username ||
    user.primaryEmailAddress?.emailAddress ||
    "";
  const email = user.primaryEmailAddress?.emailAddress || "";
  const avatar = user.imageUrl;
  const itemClassName =
    "min-h-10 rounded-xl px-3 py-2 text-[14px] font-semibold text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={isPl ? "Menu konta" : "Account menu"}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
          title={isPatron ? "Patron" : undefined}
        >
          <span
            className={
              isPatron
                ? "chan-patron-ring flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border"
                : "flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border border-[var(--chan-line)]"
            }
          >
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                width={34}
                height={34}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[13px] font-bold text-[var(--chan-ink)]">
                {(displayName[0] || "?").toUpperCase()}
              </span>
            )}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="z-[1100] w-64 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.14)] ring-0"
        >
          <DropdownMenuLabel className="px-3 py-2 font-normal">
            <span className="block truncate text-[14px] font-bold text-[var(--chan-ink)]">
              {displayName}
            </span>
            {email && (
              <span className="block truncate text-[12px] text-[var(--chan-muted)]">
                {email}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 bg-[var(--chan-line)]" />

          <DropdownMenuItem
            onClick={() => setAccountOpen(true)}
            className={itemClassName}
          >
            {isPl ? "Moje konto" : "My account"}
          </DropdownMenuItem>

          {isAdmin && (
            <DropdownMenuItem
              render={<Link href="/admin" />}
              className={itemClassName}
            >
              <ShieldCheck aria-hidden="true" size={16} />
              {isPl ? "Zarządzaj kanałem" : "Manage channel"}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="mx-1 bg-[var(--chan-line)]" />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => void signOut()}
            className="min-h-10 rounded-xl px-3 py-2 text-[14px] font-semibold"
          >
            {isPl ? "Wyloguj się" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        isAdmin={isAdmin}
      />
    </>
  );
}

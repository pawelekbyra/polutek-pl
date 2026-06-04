"use client";

import React, { useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, LogIn, ShieldCheck, X } from "./icons";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";
import BrandName from "./BrandName";

type NavbarMetadata = {
  isPatron?: unknown;
  referralPoints?: unknown;
  role?: unknown;
};

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/?q=${encodeURIComponent(searchValue.trim())}`);
      setIsMobileSearchOpen(false);
    } else {
      router.push("/");
      setIsMobileSearchOpen(false);
    }
  };

  const metadata = (user?.publicMetadata || {}) as NavbarMetadata;
  const isAdmin = metadata.role === "ADMIN";
  const isPatron =
    metadata.isPatron === true ||
    (typeof metadata.referralPoints === "number" &&
      metadata.referralPoints >= 5) ||
    isAdmin;

  return (
    <div className="flex items-center bg-neutral-50/80 backdrop-blur-md sticky top-0 z-[1000] border-b border-neutral-300 px-4 lg:px-6 h-14 min-h-14 font-sans justify-between gap-2 md:gap-4 w-full max-w-full overflow-visible">
      {isMobileSearchOpen ? (
        <div className="flex-1 flex items-center gap-2 px-2 animate-in slide-in-from-top-4 duration-200">
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="p-2 hover:bg-neutral-200 rounded-full transition-colors shrink-0"
          >
            <X size={20} />
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex">
            <input
              type="text"
              autoFocus
              placeholder="Szukaj"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-9 bg-white border border-neutral-300 rounded-full px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </form>
        </div>
      ) : (
        <>
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              className="shrink-0 px-1 md:px-2 flex items-center gap-0 hover:opacity-80 transition-all active:scale-95"
            >
              <div className="flex items-center">
                <BrandName
                  className="text-[1.1rem] md:text-[1.3rem]"
                  variant="handwriting"
                />
                <span className="ml-0.5 bg-neutral-900 text-[7px] font-black uppercase tracking-wider text-white px-1 py-0 rounded-[2px] self-start mt-0.5 shadow-sm select-none">
                  Beta
                </span>
              </div>
            </Link>
          </div>

          <div className="flex-1 max-w-[540px] hidden md:flex mx-4 min-w-0">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative flex-1 flex items-center min-w-0">
                <input
                  type="text"
                  placeholder="Szukaj"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-9 bg-white border border-neutral-300 rounded-l-full pl-6 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-neutral-400"
                />
              </div>
              <button
                type="submit"
                className="h-9 bg-neutral-100 border border-neutral-300 border-l-0 rounded-r-full px-5 hover:bg-neutral-200 transition-colors shrink-0 flex items-center justify-center text-neutral-600"
                title="Szukaj"
              >
                <Search size={18} />
              </button>
            </form>
          </div>

          <div className="flex items-center justify-end gap-1 md:gap-3">
            <div className="flex items-center gap-1 sm:hidden">
              <button
                onClick={() => setIsMobileSearchOpen(true)}
                className="p-2 hover:bg-neutral-200 rounded-full transition-colors"
              >
                <Search size={20} className="text-neutral-600" />
              </button>
            </div>

            <div className="flex gap-1 items-center bg-white/50 rounded-full px-1 sm:px-2 py-1 border border-neutral-300 h-9">
              <button
                onClick={() => {
                  if (setLanguage) setLanguage("pl");
                }}
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full transition-all",
                  language === "pl"
                    ? "bg-white shadow-sm text-neutral-900 border border-neutral-300"
                    : "text-neutral-400 hover:text-neutral-600",
                )}
              >
                PL
              </button>
              <button
                onClick={() => {
                  if (setLanguage) setLanguage("en");
                }}
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full transition-all",
                  language === "en"
                    ? "bg-white shadow-sm text-neutral-900 border border-neutral-300"
                    : "text-neutral-400 hover:text-neutral-600",
                )}
              >
                EN
              </button>
            </div>

            {/* Pionowy separator */}
            <div className="h-6 w-px bg-neutral-300 mx-1" aria-hidden="true" />

            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors whitespace-nowrap px-2"
              >
                Admin
              </Link>
            )}

            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-white text-neutral-900 hover:bg-neutral-50 font-bold text-[10px] sm:text-xs flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 h-9 rounded-full transition-all shadow-sm active:scale-95 border border-neutral-300">
                  <LogIn size={14} className="sm:w-4 sm:h-4 text-neutral-900" />
                  <span className="hidden sm:inline">{t.signIn}</span>
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div
                className={cn(
                  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                  isPatron
                    ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
                    : "border border-neutral-300",
                )}
                title={isPatron ? "Patron" : undefined}
              >
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonBox: isPatron ? "overflow-visible" : undefined,
                      userButtonTrigger: isPatron
                        ? "overflow-visible"
                        : undefined,
                      userButtonAvatarBox: isPatron
                        ? "h-9 w-9 border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
                        : undefined,
                    },
                  }}
                >
                  {isAdmin && (
                    <UserButton.MenuItems>
                      <UserButton.Link
                        href="/admin"
                        label="Panel admina"
                        labelIcon={<ShieldCheck size={16} />}
                      />
                    </UserButton.MenuItems>
                  )}
                </UserButton>
                {isPatron && (
                  <span className="pointer-events-none absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-1.5 py-0.5 text-[7px] font-black uppercase leading-none tracking-[0.12em] text-amber-950 shadow-sm ring-1 ring-amber-200">
                    Patron
                  </span>
                )}
              </div>
            </SignedIn>
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;

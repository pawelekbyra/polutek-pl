"use client";

import React, { useEffect, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, LogIn, ShieldCheck, X } from "./icons";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";
import BrandName from "./BrandName";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";

type NavbarMetadata = {
  isPatron?: unknown;
  role?: unknown;
};

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setIsMobileSearchOpen(false);
    } else {
      router.push("/");
      setIsMobileSearchOpen(false);
    }
  };

  const metadata = (user?.publicMetadata || {}) as NavbarMetadata;
  const [serverIsAdmin, setServerIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setServerIsAdmin(false);
      return () => {
        cancelled = true;
      };
    }

    fetch("/api/user/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((profile) => {
        if (!cancelled) setServerIsAdmin(profile?.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setServerIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = resolveNavbarAdminUiState(serverIsAdmin, metadata.role);
  const isPatron = isAdmin || metadata.isPatron === true;
  const searchLabel = language === "pl" ? "Szukaj" : "Search";

  return (
    <div className="flex items-center bg-background/80 backdrop-blur-md sticky top-0 z-[1000] border-b border-border px-4 lg:px-6 h-[58px] min-h-[58px] font-sans justify-between gap-2 md:gap-4 w-full max-w-full overflow-x-clip overflow-y-visible">
      {isMobileSearchOpen ? (
        <div className="flex-1 flex items-center gap-2 px-2 animate-in slide-in-from-top-4 duration-200">
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="p-2 hover:bg-secondary rounded-full transition-colors shrink-0"
          >
            <X size={20} />
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
            <input
              type="text"
              autoFocus
              placeholder={searchLabel}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-[38px] bg-white border border-input rounded-l-full pl-4 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-primary transition-all min-w-0"
            />
            <button
              type="submit"
              className="h-[38px] w-[46px] bg-secondary border border-input border-l-0 rounded-r-full hover:bg-secondary/80 transition-colors shrink-0 flex items-center justify-center text-[#5b5b5b]"
              aria-label={searchLabel}
              title={searchLabel}
            >
              <span className="text-[20px] leading-none" aria-hidden="true">
                →
              </span>
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              className="shrink-0 px-1 md:px-2 flex items-center gap-0 hover:opacity-80 transition-all active:scale-95"
            >
              <div className="flex items-start gap-[2px]">
                <BrandName
                  className="text-[22px] leading-none"
                  variant="classic"
                />
                <span className="bg-[#171717] text-[7px] font-extrabold uppercase tracking-[0.08em] leading-none text-white px-[2px] py-px rounded-[2px] select-none mt-[1px]">
                  Beta
                </span>
              </div>
            </Link>
          </div>

          <div className="flex-1 max-w-[520px] hidden md:flex mx-4 min-w-0">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative flex-1 flex items-center min-w-0">
                <input
                  type="text"
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-[38px] bg-white border border-input rounded-l-full pl-5 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-primary transition-all placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="submit"
                className="h-[38px] w-[54px] bg-secondary border border-input border-l-0 rounded-r-full hover:bg-secondary/80 transition-colors shrink-0 flex items-center justify-center text-[#5b5b5b]"
                title={searchLabel}
              >
                <Search size={18} />
              </button>
            </form>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1 md:gap-[14px]">
            <div className="flex items-center gap-1 sm:hidden">
              <button
                onClick={() => setIsMobileSearchOpen(true)}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <Search size={20} className="text-[#5b5b5b]" />
              </button>
            </div>

            <div className="flex gap-[2px] items-center bg-white rounded-full p-[3px] border border-input h-9">
              <button
                onClick={() => {
                  if (setLanguage) setLanguage("pl");
                }}
                className={cn(
                  "text-[11px] font-bold tracking-widest uppercase px-[9px] py-1 rounded-full transition-all border",
                  language === "pl"
                    ? "bg-zinc-50 text-zinc-950 border-zinc-300 shadow-sm"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-zinc-50",
                )}
              >
                PL
              </button>
              <button
                onClick={() => {
                  if (setLanguage) setLanguage("en");
                }}
                className={cn(
                  "text-[11px] font-bold tracking-widest uppercase px-[9px] py-1 rounded-full transition-all border",
                  language === "en"
                    ? "bg-zinc-50 text-zinc-950 border-zinc-300 shadow-sm"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-zinc-50",
                )}
              >
                EN
              </button>
            </div>

            {/* Pionowy separator */}
            <div className="h-6 w-px bg-[#DAD6CC] mx-0" aria-hidden="true" />

            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <button
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-input bg-white text-[#171717] font-bold text-[13px] transition-all active:scale-95 active:bg-zinc-50 active:border-zinc-300 active:shadow-inner hover:bg-zinc-50 hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:border-zinc-300 sm:w-auto sm:gap-2 sm:px-4"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <LogIn size={16} className="text-[#171717]" />
                  <span className="hidden sm:inline">{t.signIn}</span>
                </button>
              </SignInButton>
            )}
            {isLoaded && isSignedIn && (
              <div
                className={cn(
                  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                  isPatron
                    ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
                    : "border border-input",
                )}
                title={isPatron ? "Patron" : undefined}
              >
                <UserButton
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
                        label="Zarządzaj kanałem"
                        labelIcon={<ShieldCheck size={16} />}
                      />
                    </UserButton.MenuItems>
                  )}
                </UserButton>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Navbar;

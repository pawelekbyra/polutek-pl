"use client";

import React, { useEffect, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "./icons";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";
import BrandName from "./BrandName";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";
import { Frame, NajsIcon, NajsSeparator, INK } from "./najs/primitives";

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
      return () => { cancelled = true; };
    }
    fetch("/api/user/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((profile) => { if (!cancelled) setServerIsAdmin(profile?.isAdmin === true); })
      .catch(() => { if (!cancelled) setServerIsAdmin(false); });
    return () => { cancelled = true; };
  }, [user]);

  const isAdmin = resolveNavbarAdminUiState(serverIsAdmin, metadata.role);
  const isPatron = isAdmin || metadata.isPatron === true;
  const searchLabel = language === "pl" ? "Szukaj" : "Search";

  return (
    <div
      className="sticky top-0 z-[1000] w-full flex flex-col"
      style={{ background: "rgba(248,243,231,.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center px-4 lg:px-6 h-[58px] min-h-[58px] justify-between gap-2 md:gap-4 w-full max-w-full overflow-x-clip overflow-y-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-2 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative p-2 shrink-0 flex items-center justify-center"
            >
              <NajsIcon name="close" className="h-5 w-5" stroke={INK} />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-[38px]">
                <Frame radius={20} seed={18} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="relative w-full h-full bg-transparent pl-4 pr-12 text-sm outline-none"
                  style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
                  aria-label={searchLabel}
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke={INK} />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Logo */}
            <div className="flex items-center shrink-0">
              <Link
                href="/"
                className="shrink-0 px-1 md:px-2 flex items-center gap-0 hover:opacity-80 transition-all active:scale-95"
              >
                <div className="flex items-start gap-[2px]">
                  <BrandName
                    className="text-[22px] leading-none"
                    variant="classic"
                    style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
                  />
                  <span
                    className="bg-[#171717] text-[7px] font-extrabold uppercase tracking-[0.08em] leading-none text-white px-[2px] py-px rounded-[2px] select-none mt-[1px]"
                    style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
                  >
                    Beta
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[520px] hidden md:flex mx-4 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-[42px]">
                  <Frame radius={20} seed={18} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="relative w-full h-full bg-transparent pl-5 pr-14 text-sm outline-none"
                    style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
                  />
                  <button
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center"
                    title={searchLabel}
                    aria-label={searchLabel}
                  >
                    <NajsIcon name="search" className="h-5 w-5" stroke={INK} />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex min-w-0 items-center justify-end gap-1 md:gap-[10px]">
              {/* Mobile search trigger */}
              <div className="flex items-center gap-1 sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2"
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke={INK} />
                </button>
              </div>

              {/* Language switcher */}
              <div className="relative flex h-9 items-center px-1 text-sm font-black" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                <Frame radius={18} seed={52} stroke={INK} strokeWidth={1.1} fill="rgba(248,243,231,.8)" />
                <button
                  onClick={() => { if (setLanguage) setLanguage("pl"); }}
                  className={cn(
                    "relative px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest transition-colors",
                    language === "pl" ? "text-[#171717]" : "text-neutral-500"
                  )}
                >
                  PL
                </button>
                <span className="relative h-5 w-px bg-neutral-900/35" />
                <button
                  onClick={() => { if (setLanguage) setLanguage("en"); }}
                  className={cn(
                    "relative px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest transition-colors",
                    language === "en" ? "text-[#171717]" : "text-neutral-500"
                  )}
                >
                  EN
                </button>
              </div>

              <span className="hidden h-6 w-px bg-[#DAD6CC] sm:block" />

              {/* Auth */}
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <button
                    className="relative flex h-9 items-center justify-center gap-2 px-2 sm:px-4 shrink-0"
                    aria-label={t.signIn}
                    title={t.signIn}
                    style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
                  >
                    <Frame radius={18} seed={39} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
                    <NajsIcon name="login" className="relative h-4 w-4" stroke={INK} />
                    <span className="hidden sm:inline relative text-[13px] font-bold uppercase tracking-wide">{t.signIn}</span>
                  </button>
                </SignInButton>
              )}

              {isLoaded && isSignedIn && (
                <div
                  className={cn(
                    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
                    isPatron
                      ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
                      : ""
                  )}
                  title={isPatron ? "Patron" : undefined}
                >
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonBox: isPatron ? "overflow-visible" : undefined,
                        userButtonTrigger: isPatron ? "overflow-visible" : undefined,
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

      {/* Separator pod navbarem */}
      <NajsSeparator className="px-4" />
    </div>
  );
};

export default Navbar;

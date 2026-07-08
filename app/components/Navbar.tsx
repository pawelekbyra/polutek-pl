"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuthModal } from "./auth/AuthModalProvider";
import UserMenu from "./auth/UserMenu";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";
import BrandName from "./BrandName";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";
import { NajsIcon } from "./najs/primitives";
import { appendQueryString, getLocalizedHref, switchLocalePath, type Locale } from "@/lib/i18n/routing";

type NavbarMetadata = {
  isPatron?: unknown;
  role?: unknown;
};

const Navbar = () => {
  const { language, setLanguage, t } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`${getLocalizedHref(language, "search")}?q=${encodeURIComponent(searchValue.trim())}`);
      setIsMobileSearchOpen(false);
    } else {
      router.push(getLocalizedHref(language, "home"));
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
  const messagesLabel = language === "pl" ? "Wiadomości" : "Messages";
  const switchLanguage = (locale: Locale) => {
    setLanguage(locale);
    router.push(appendQueryString(switchLocalePath(pathname || "/", locale), searchParams));
  };

  return (
    <div
      className="polutek-watch-nav sticky top-0 z-[1000] w-full flex flex-col border-b border-white/10"
    >
      <div className="flex items-center px-4 md:px-6 lg:px-11 h-[64px] min-h-[64px] justify-between gap-3 md:gap-6 w-full max-w-[1536px] mx-auto overflow-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative p-2 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <NajsIcon name="close" className="h-5 w-5" stroke="currentColor" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-[42px] rounded-[10px] border border-white/[0.05] bg-white/[0.13] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl focus-within:bg-white/[0.18] transition-colors">
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-white placeholder:text-white/58"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4"
                  aria-label={searchLabel}
                >
                  <NajsIcon name="search" className="h-4 w-4" stroke="rgba(255,255,255,.78)" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Logo */}
            <div className="flex items-center shrink-0">
              <Link
                href={getLocalizedHref(language, "home")}
                className="shrink-0 flex h-10 items-center hover:opacity-85 transition-all active:scale-95"
                aria-label="POLUTEK.PL"
              >
                <div className="flex items-center">
                  <BrandName
                    className="text-[1.1rem] leading-none text-white md:text-[1.3rem]"
                    variant="handwriting"
                  />
                  <span className="ml-0.5 select-none self-start rounded-[2px] bg-white/90 px-1 py-0 text-[7px] font-black uppercase tracking-wider text-[#0F172A] shadow-sm">
                    Beta
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-[46px] rounded-[10px] border border-white/[0.035] bg-white/[0.115] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_26px_rgba(0,0,0,.22)] backdrop-blur-xl focus-within:bg-white/[0.16] transition-colors">
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-white placeholder:text-white/58"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4"
                    aria-label={searchLabel}
                  >
                    <NajsIcon name="search" className="h-4 w-4" stroke="rgba(255,255,255,.78)" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-2.5">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 rounded-full text-white hover:bg-white/10"
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke="currentColor" />
                </button>
              </div>

              {/* Language switcher */}
              <div className="hidden sm:flex h-10 items-center gap-2 rounded-full px-2 font-sans text-white">
                <button
                  onClick={() => switchLanguage(language === "pl" ? "en" : "pl")}
                  className="group inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-[14px] font-semibold tracking-[-0.01em] text-white/92 transition-colors hover:bg-white/10"
                  aria-label={language === "pl" ? "Zmień język" : "Change language"}
                >
                  <span className="relative h-[11px] w-[16px] overflow-hidden rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(255,255,255,.2)]">
                    <span className={cn("absolute inset-x-0", language === "pl" ? "bottom-0 h-1/2 bg-[#dc143c]" : "inset-y-0 left-0 w-[45%] bg-[#0a5eb8]")} />
                    {language === "en" && <span className="absolute inset-y-0 left-[45%] w-[10%] bg-white" />}
                    {language === "en" && <span className="absolute inset-y-0 right-0 w-[45%] bg-[#c8102e]" />}
                  </span>
                  <span>{language.toUpperCase()}</span>
                  <span className="text-[12px] leading-none opacity-80 transition-transform group-hover:translate-y-px">⌄</span>
                </button>
              </div>

              {/* Messages */}
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-white transition-transform hover:-translate-y-px hover:text-[#60A5FA] active:scale-95"
                aria-label={messagesLabel}
                title={messagesLabel}
              >
                <NajsIcon name="mail" className="h-5 w-5 shrink-0" stroke="currentColor" />
              </button>

              {/* Auth */}
              {isLoaded && !isSignedIn && (
                <button
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-10 items-center justify-center gap-2 rounded-[12px] px-2 sm:px-3 shrink-0 font-sans text-white transition-all hover:-translate-y-px hover:bg-white/10 active:scale-95"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <NajsIcon name="login" className="h-4 w-4" stroke="currentColor" />
                  <span className="hidden sm:inline text-[14px] font-semibold text-white">{t.signIn}</span>
                </button>
              )}

              {isLoaded && isSignedIn && (
                <UserMenu isAdmin={isAdmin} isPatron={isPatron} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Navbar;

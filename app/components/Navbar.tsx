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
  const switchLanguage = (locale: Locale) => {
    setLanguage(locale);
    router.push(appendQueryString(switchLocalePath(pathname || "/", locale), searchParams));
  };

  return (
    <div
      className="sticky top-0 z-[1000] w-full flex flex-col bg-[var(--chan-nav)]/95 border-b border-[var(--chan-line)] backdrop-blur-md"
    >
      <div className="flex items-center px-4 lg:px-8 h-[64px] min-h-[64px] justify-between gap-3 md:gap-6 w-full max-w-full overflow-x-clip overflow-y-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative p-2 shrink-0 flex items-center justify-center rounded-full hover:bg-[var(--chan-surface)]"
            >
              <NajsIcon name="close" className="h-5 w-5" stroke="var(--chan-ink)" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-[42px] rounded-[14px] bg-[var(--chan-surface)]">
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-4 pr-16 text-sm font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-7 -translate-y-1/2 items-center justify-center border-l border-[var(--chan-line)] pl-3 pr-4"
                  aria-label={searchLabel}
                >
                  <NajsIcon name="search" className="h-4 w-4" stroke="var(--chan-muted)" />
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
                className="shrink-0 flex items-start gap-1.5 hover:opacity-85 transition-all active:scale-95"
              >
                <BrandName className="text-[19px] md:text-[21px] leading-none tracking-[0.04em]" variant="classic" />
                <span className="relative -top-2.5 text-[8px] font-extrabold uppercase tracking-[0.05em] leading-none text-[#2563EB] bg-[#EFF3FE] rounded-[5px] px-[5px] py-[3px] select-none">
                  Beta
                </span>
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[480px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-[44px] rounded-[14px] bg-[var(--chan-surface)]">
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-4 pr-16 text-sm font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-7 -translate-y-1/2 items-center justify-center border-l border-[var(--chan-line)] pl-3 pr-4"
                    aria-label={searchLabel}
                  >
                    <NajsIcon name="search" className="h-4 w-4" stroke="var(--chan-muted)" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex min-w-0 items-center justify-end gap-1.5 md:gap-2.5">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 rounded-full hover:bg-[var(--chan-surface)]"
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke="var(--chan-ink)" />
                </button>
              </div>

              {/* Language switcher */}
              <div className="hidden sm:flex h-9 items-center rounded-[12px] bg-[var(--chan-surface)] p-[3px] font-sans">
                <button
                  onClick={() => switchLanguage("pl")}
                  className={cn(
                    "rounded-[9px] px-3 py-[5px] text-[11px] font-bold uppercase tracking-widest transition-colors",
                    language === "pl" ? "bg-white text-[#2563EB] shadow-sm" : "text-[var(--chan-muted)]"
                  )}
                >
                  PL
                </button>
                <button
                  onClick={() => switchLanguage("en")}
                  className={cn(
                    "rounded-[9px] px-3 py-[5px] text-[11px] font-bold uppercase tracking-widest transition-colors",
                    language === "en" ? "bg-white text-[#2563EB] shadow-sm" : "text-[var(--chan-muted)]"
                  )}
                >
                  EN
                </button>
              </div>

              {/* Auth */}
              {isLoaded && !isSignedIn && (
                <button
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-ink)] px-3 sm:px-4 shrink-0 font-sans transition-transform hover:-translate-y-px active:scale-95"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <NajsIcon name="login" className="h-4 w-4" stroke="#ffffff" />
                  <span className="hidden sm:inline text-[13px] font-bold text-white">{t.signIn}</span>
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

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuthModal } from "./auth/AuthModalProvider";
import UserMenu from "./auth/UserMenu";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import BrandName from "./BrandName";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";
import { NajsIcon } from "./najs/primitives";
import NotificationsMenu from "./notifications/NotificationsMenu";
import { getMockNotifications } from "../data/mock-notifications";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";

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
  const mockNotifications = useMemo(() => getMockNotifications(), []);
  const switchLanguage = (locale: Locale) => {
    setLanguage(locale);
  };

  return (
    <div
      className="polutek-watch-nav sticky top-0 z-[1000] w-full flex flex-col"
    >
      <div className="flex items-center px-3 md:px-4 lg:px-5 h-[52px] min-h-[52px] justify-between gap-3 md:gap-6 w-full overflow-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative p-2 shrink-0 flex items-center justify-center rounded-full text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]"
            >
              <NajsIcon name="close" className="h-5 w-5" stroke="currentColor" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-[38px] rounded-[10px] border border-[var(--chan-line)] bg-[var(--chan-surface)] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)] focus-within:bg-[var(--chan-line-soft)] transition-colors">
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4 text-[var(--chan-muted)]"
                  aria-label={searchLabel}
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke="currentColor" />
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
                <BrandName
                  className="text-[1.1rem] leading-none text-[var(--chan-ink)] md:text-[1.3rem]"
                  variant="classic"
                />
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-[38px] rounded-[10px] border border-[var(--chan-line)] bg-[var(--chan-surface)] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)] focus-within:bg-[var(--chan-line-soft)] transition-colors">
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4 text-[var(--chan-muted)]"
                    aria-label={searchLabel}
                  >
                    <NajsIcon name="search" className="h-5 w-5" stroke="currentColor" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-2">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-all hover:-translate-y-px hover:bg-[var(--chan-surface)] active:scale-95"
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke="currentColor" />
                </button>
              </div>

              {/* Language switcher — compact segmented pill, sized to align with the account actions. */}
              <div
                role="radiogroup"
                aria-label={language === "pl" ? "Wybierz język" : "Choose language"}
                className="relative flex h-10 w-[82px] shrink-0 items-center rounded-full border border-[var(--chan-line)] bg-[var(--chan-surface)] p-[3px] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)]"
              >
                <span
                  aria-hidden="true"
                  className={
                    "chan-lang-pill-active absolute bottom-[3px] left-[3px] top-[3px] w-[38px] rounded-full transition-transform duration-200 ease-out " +
                    (language === "en" ? "translate-x-[38px]" : "translate-x-0")
                  }
                />
                {(["pl", "en"] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    role="radio"
                    aria-checked={language === locale}
                    aria-label={locale === "pl" ? "Polski" : "English"}
                    title={locale === "pl" ? "Polski" : "English"}
                    onClick={() => switchLanguage(locale)}
                    className={
                      "relative z-10 flex h-full flex-1 items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.08em] transition-colors " +
                      (language === locale ? "text-white" : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]")
                    }
                  >
                    {locale.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Messages — only relevant once you have an account. */}
              {isSignedIn ? (
                <NotificationsMenu
                  notifications={mockNotifications}
                  language={language}
                  messagesLabel={messagesLabel}
                />
              ) : isLoaded ? (
                <button
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] px-2 sm:px-3 shrink-0 font-sans bg-black text-white transition-all hover:-translate-y-px hover:bg-[#1a1a1a] active:scale-95"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0" aria-hidden="true">
                    <path d="M15 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
                    <path d="M11 12h9m0 0-3.5-3.5M20 12l-3.5 3.5" />
                  </svg>
                  <span className="hidden sm:inline leading-none text-sm font-semibold text-white">{t.signIn}</span>
                </button>
              ) : (
                <div className="h-10 w-[100px] rounded-[12px] bg-black animate-pulse shrink-0" />
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

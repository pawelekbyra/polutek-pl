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
import { Search, X, LogIn } from "lucide-react";
import NotificationsMenu from "./notifications/NotificationsMenu";
import { NotificationDTO } from "@/app/types/notification";
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
  const [notifications, setNotifications] = React.useState<NotificationDTO[]>([]);

  React.useEffect(() => {
    if (isSignedIn) {
      fetch("/api/notifications")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setNotifications(Array.isArray(data) ? data : []))
        .catch(() => setNotifications([]));
    }
  }, [isSignedIn]);

  const switchLanguage = (locale: Locale) => {
    setLanguage(locale);
  };

  return (
    <div
      className="polutek-watch-nav sticky top-0 z-[1000] w-full flex flex-col"
    >
      <div className="flex min-h-[46px] items-center justify-between gap-3 overflow-visible px-3 py-1 md:gap-5 md:px-4 lg:px-5 w-full">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[background-color,box-shadow] duration-160 hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)]"
            >
              <X className="h-5 w-5 shrink-0" strokeWidth={1.8} />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-9 rounded-[9px] border border-[var(--chan-line)] bg-[var(--chan-surface)] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)] focus-within:bg-[var(--chan-line-soft)] focus-within:border-[var(--chan-blue)] transition-[border-color,background-color,box-shadow] duration-160">
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-4 pr-12 text-[14px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-3.5 text-[var(--chan-muted)]"
                  aria-label={searchLabel}
                >
                  <Search className="h-5 w-5 shrink-0" strokeWidth={1.8} />
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
                className="flex h-[38px] shrink-0 items-center gap-0 transition-all hover:opacity-85 active:scale-95"
                aria-label="POLUTEK.PL"
              >
                <BrandName
                  className="text-[1.3rem] leading-none text-[var(--chan-ink)] md:text-[1.65rem]"
                  variant="classic"
                  style={{ fontFamily: "'Bitter', Georgia, serif" }}
                />
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-9 rounded-[9px] border border-[var(--chan-line)] bg-[var(--chan-surface)] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)] focus-within:bg-[var(--chan-line-soft)] focus-within:border-[var(--chan-blue)] transition-[border-color,background-color,box-shadow] duration-160">
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-4 pr-12 text-[14px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-3.5 text-[var(--chan-muted)]"
                    aria-label={searchLabel}
                  >
                    <Search className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95"
                >
                  <Search className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                </button>
              </div>

              {/* Language switcher — compact segmented pill, sized to align with the account actions. */}
              <div
                role="radiogroup"
                aria-label={language === "pl" ? "Wybierz język" : "Choose language"}
                className="relative flex h-[38px] w-[78px] shrink-0 items-center rounded-full border border-[var(--chan-line)] bg-[var(--chan-surface)] p-[3px] shadow-[inset_0_1px_0_rgba(20,16,10,0.03)] transition-[border-color,box-shadow] duration-160 hover:border-[var(--chan-blue)] hover:shadow-[inset_0_1px_0_rgba(20,16,10,0.03),0_4px_12px_rgba(37,99,235,0.08)]"
              >
                <span
                  aria-hidden="true"
                  className={
                    "chan-lang-pill-active absolute bottom-[3px] left-[3px] top-[3px] w-9 rounded-full transition-transform duration-200 ease-out " +
                    (language === "en" ? "translate-x-9" : "translate-x-0")
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
                      "relative z-10 flex h-full flex-1 items-center justify-center rounded-full text-[10px] font-extrabold uppercase tracking-[0.08em] transition-colors " +
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
                  notifications={notifications}
                  language={language}
                  messagesLabel={messagesLabel}
                />
              ) : isLoaded ? (
                <button
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-[38px] items-center justify-center gap-1.5 rounded-[11px] px-2 sm:px-3 shrink-0 font-sans bg-black text-white border border-[#333] transition-[transform,background-color,border-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[#1a1a1a] hover:border-[#555] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] active:scale-95"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <LogIn className="h-5 w-5 shrink-0 text-white" strokeWidth={1.8} aria-hidden="true" />
                  <span className="hidden sm:inline leading-none text-[13px] font-semibold text-white">{t.signIn}</span>
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <div className="h-[38px] w-[38px] rounded-full bg-[var(--chan-line)] animate-pulse shrink-0 motion-reduce:animate-none" />
                  <div className="h-[38px] w-[38px] rounded-full bg-[var(--chan-line)] animate-pulse shrink-0 motion-reduce:animate-none" />
                </div>
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
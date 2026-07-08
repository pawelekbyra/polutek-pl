"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import NotificationsMenu from "./notifications/NotificationsMenu";
import { getMockNotifications } from "../data/mock-notifications";
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
  const mockNotifications = useMemo(() => getMockNotifications(), []);
  const switchLanguage = (locale: Locale) => {
    setLanguage(locale);
    router.push(appendQueryString(switchLocalePath(pathname || "/", locale), searchParams));
  };

  return (
    <div
      className="polutek-watch-nav sticky top-0 z-[1000] w-full flex flex-col border-b border-white/10"
    >
      <div className="flex items-center px-3 md:px-4 lg:px-5 h-[52px] min-h-[52px] justify-between gap-3 md:gap-6 w-full overflow-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="relative p-2 shrink-0 flex items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <NajsIcon name="close" className="h-5 w-5" stroke="currentColor" />
            </button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <div className="relative flex-1 flex items-center min-w-0 h-[38px] rounded-[10px] border border-white/[0.08] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl focus-within:bg-white/[0.14] transition-colors">
                <input
                  type="text"
                  autoFocus
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-white placeholder:text-white/50"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4"
                  aria-label={searchLabel}
                >
                  <NajsIcon name="search" className="h-4 w-4" stroke="rgba(255,255,255,.7)" />
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
                  className="text-[1.1rem] leading-none text-white md:text-[1.3rem]"
                  variant="classic"
                />
              </Link>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative flex-1 flex items-center min-w-0 h-[38px] rounded-[10px] border border-white/[0.08] bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl focus-within:bg-white/[0.14] transition-colors">
                  <input
                    type="text"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-5 pr-14 text-[15px] font-sans outline-none text-white placeholder:text-white/50"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-4"
                    aria-label={searchLabel}
                  >
                    <NajsIcon name="search" className="h-4 w-4" stroke="rgba(255,255,255,.7)" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right controls */}
            <div className="flex shrink-0 items-center justify-end gap-0.5 md:gap-1.5">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-2 rounded-full text-white hover:bg-white/10"
                >
                  <NajsIcon name="search" className="h-5 w-5" stroke="currentColor" />
                </button>
              </div>

              {/* Language switcher — always visible in the topbar. Signed-in users also have
                  the same toggle in account settings (see AccountSections ProfileSection). */}
              <div className="flex h-10 shrink-0 items-center gap-0.5 rounded-[12px] px-0.5 font-sans">
                {(["pl", "en"] as const).map((locale, i) => (
                  <React.Fragment key={locale}>
                    {i === 1 && <span aria-hidden="true" className="h-4 w-px bg-white/15" />}
                    <button
                      type="button"
                      onClick={() => switchLanguage(locale)}
                      className={cn(
                        "h-8 rounded-[9px] px-2.5 text-[12px] font-extrabold tracking-wide transition-colors",
                        language === locale
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/70",
                      )}
                      aria-label={locale === "pl" ? "Zmień język na polski" : "Switch language to English"}
                      title={locale === "pl" ? "Polski" : "English"}
                    >
                      {locale.toUpperCase()}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Messages — only relevant once you have an account. */}
              {isLoaded && isSignedIn && (
                <NotificationsMenu
                  notifications={mockNotifications}
                  language={language}
                  messagesLabel={messagesLabel}
                />
              )}

              {/* Auth */}
              {isLoaded && !isSignedIn && (
                <button
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-10 items-center justify-center gap-2 rounded-[12px] px-2 sm:px-3 shrink-0 font-sans text-white transition-all hover:-translate-y-px hover:bg-white/10 active:scale-95"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0" aria-hidden="true">
                    <path d="M15 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
                    <path d="M11 12h9m0 0-3.5-3.5M20 12l-3.5 3.5" />
                  </svg>
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
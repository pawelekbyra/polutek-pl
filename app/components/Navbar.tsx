"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/auth/react";
import { useAuthModal } from "./auth/AuthModalProvider";
import UserMenu from "./auth/UserMenu";
import NotificationBell from "./notifications/NotificationBell";
import { SHOW_NOTIFICATION_BELL } from "@/lib/ui-flags";
import BrandHomeLink from "./BrandHomeLink";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageContext";
import BrandName from "./BrandName";
import LanguageSwitcher from "./LanguageSwitcher";
import { useSwitchLanguage } from "./useSwitchLanguage";
import { resolveNavbarAdminUiState } from "@/lib/navbar-admin-ui";
import { Search, X, LogIn } from "lucide-react";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";

type ServerAdminState = {
  userId: string;
  isAdmin: boolean;
};

/**
 * The language switcher reads the current query string (to keep it when switching), which on a
 * statically rendered page (legal documents) is only known in the browser. Its own Suspense
 * boundary keeps that to the switcher: the static HTML shows the same pill, and the rest of the
 * page is not dropped to client rendering.
 */
function NavbarLanguageSwitcher({ language }: { language: Locale }) {
  const switchLanguage = useSwitchLanguage();
  return <LanguageSwitcher language={language} onSelect={switchLanguage} variant="icon" />;
}

// `isHome`: the page is the home page with the hero video (the logo then scrolls to its top).
const Navbar = ({ initialQuery = "", isHome = false }: { initialQuery?: string; isHome?: boolean }) => {
  const { language, setLanguage, t, tx } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  // The search page passes its query; elsewhere the box starts empty.
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  // Closing the phone search unmounts the focused control; focus goes back to the button that opened it.
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreSearchFocusRef = useRef(false);
  const closeMobileSearch = () => {
    restoreSearchFocusRef.current = true;
    setIsMobileSearchOpen(false);
  };
  useEffect(() => {
    if (isMobileSearchOpen || !restoreSearchFocusRef.current) return;
    restoreSearchFocusRef.current = false;
    searchTriggerRef.current?.focus();
  }, [isMobileSearchOpen]);

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

  const userId = user?.id;
  const [serverAdminState, setServerAdminState] =
    useState<ServerAdminState | null>(null);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    fetch("/api/user/profile", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((profile) => {
        if (!controller.signal.aborted) {
          setServerAdminState({ userId, isAdmin: profile?.isAdmin === true });
        }
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setServerAdminState({ userId, isAdmin: false });
        }
      });

    return () => controller.abort();
  }, [userId]);

  const serverIsAdmin =
    serverAdminState?.userId === userId && serverAdminState?.isAdmin === true;

  const isAdmin = resolveNavbarAdminUiState(serverIsAdmin, undefined);
  const searchLabel = tx("Szukaj", "Search");
  const openSearchLabel = tx("Otwórz wyszukiwanie", "Open search");
  const closeSearchLabel = tx("Zamknij wyszukiwanie", "Close search");
  const skipLabel = tx("Przejdź do treści", "Skip to content");
  const navLabel = tx("Główna nawigacja", "Main navigation");

  return (
    <header
      className="polutek-watch-nav sticky top-0 z-[1000] flex w-full flex-col"
    >
      {/* First stop of the Tab order: lets keyboard and screen-reader users jump past the bar (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-3 focus-visible:top-3 focus-visible:z-10 focus-visible:rounded-full focus-visible:bg-[var(--chan-ink)] focus-visible:px-4 focus-visible:py-2 focus-visible:text-[13px] focus-visible:font-semibold focus-visible:text-white"
      >
        {skipLabel}
      </a>
      <nav aria-label={navLabel} className="flex w-full items-center justify-between gap-3 overflow-visible px-2 py-[3px] md:gap-5 md:px-6 lg:px-8">
        {isMobileSearchOpen ? (
          <div
            className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeMobileSearch();
            }}
          >
            <button
              type="button"
              onClick={closeMobileSearch}
              aria-label={closeSearchLabel}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[background-color,box-shadow] duration-160 hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)]"
            >
              <X className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <form onSubmit={handleSearch} role="search" className="flex-1 flex min-w-0">
              <div className="relative flex h-10 min-w-0 flex-1 items-center rounded-full border border-[var(--cm-line-82)] bg-[var(--cm-card-74-white)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-[var(--cm-blue-55)] focus-within:bg-[var(--cm-card-45-white)] focus-within:shadow-[0_0_0_3px_var(--cm-blue-14)]">
                <input
                  type="search"
                  autoFocus
                  aria-label={searchLabel}
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full h-full bg-transparent pl-5 pr-12 text-[14px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-3.5 text-[var(--chan-ink)]"
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
              <BrandHomeLink
                language={language}
                isHome={isHome}
                className="ml-2 flex min-h-10 shrink-0 items-center gap-0 py-1 leading-none rounded-md transition-opacity duration-150 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:opacity-70 motion-reduce:transition-none md:ml-0"
              >
                {/* The link box is 44px tall for touch but contributes 38px to the bar (-my-[3px]); ml-2 on phones lines the logo up with the 16px page gutter. */}
                <BrandName decorative />
              </BrandHomeLink>
            </div>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} role="search" className="flex w-full">
                <div className="relative flex h-10 min-w-0 flex-1 items-center rounded-full border border-[var(--cm-line-82)] bg-[var(--cm-card-74-white)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-[var(--cm-blue-55)] focus-within:bg-[var(--cm-card-45-white)] focus-within:shadow-[0_0_0_3px_var(--cm-blue-14)]">
                  <input
                    type="search"
                    aria-label={searchLabel}
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder={searchLabel}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full h-full bg-transparent pl-5 pr-12 text-[14px] font-sans outline-none text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)]"
                  />
                  <button
                    type="submit"
                    className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center justify-center pl-3 pr-3.5 text-[var(--chan-ink)]"
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
              {/* -mr-[5px]: the icon itself is recessed ~9px inside this button's own 38px
                  box (no background at rest to mark the box edge), so the plain flex gap-1.5
                  here reads as a bigger gap to the language pill than the sign-in circle gets
                  on the switcher's other side (that button's filled background sits flush with
                  its own box edge). Pulling the box closer compensates for most of that recess
                  so both visual gaps roughly match — a full -9px overcorrected and looked too
                  tight. */}
              <div className="flex items-center md:hidden -mr-[5px]">
                <button
                  ref={searchTriggerRef}
                  type="button"
                  onClick={() => setIsMobileSearchOpen(true)}
                  aria-label={openSearchLabel}
                  aria-expanded={isMobileSearchOpen}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95"
                >
                  <Search className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>

              {/* Language switcher — one pill (globe, code, chevron) that opens the language list. */}
              {/* Signed-out visitors only: a signed-in user changes the language in the account panel (and in the footer). */}
              {isSignedIn ? null : (
                <Suspense fallback={<LanguageSwitcher language={language} onSelect={setLanguage} variant="icon" />}>
                  <NavbarLanguageSwitcher language={language} />
                </Suspense>
              )}

              {isSignedIn ? null : isLoaded ? (
                <button
                  type="button"
                  onClick={() => openAuthModal("sign-in")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--cm-ink-55)] bg-[var(--chan-ink)] px-0 font-sans text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(23,23,23,0.42)] transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-px hover:bg-[var(--cm-ink-88-black)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_11px_24px_-8px_rgba(23,23,23,0.48)] active:translate-y-0 active:scale-[0.97] sm:w-auto sm:px-4"
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <LogIn className="h-5 w-5 shrink-0 text-white" strokeWidth={1.8} aria-hidden="true" />
                  <span className="hidden sm:inline leading-none text-[13px] font-semibold text-white">{t.signIn}</span>
                </button>
              ) : (
                // Session not known yet: only on statically rendered pages (legal documents) on a
                // fresh load; dynamic pages get the session from the server. The slot keeps its
                // size, without a placeholder animation, until the button or the avatar is known.
                <div aria-hidden="true" className="h-10 w-10 shrink-0" />
              )}

              {SHOW_NOTIFICATION_BELL && isLoaded && isSignedIn && <NotificationBell />}

              {isLoaded && isSignedIn && (
                <UserMenu isAdmin={isAdmin} />
              )}
            </div>
          </>
        )}
      </nav>
    </header>
  );
};

export default Navbar;

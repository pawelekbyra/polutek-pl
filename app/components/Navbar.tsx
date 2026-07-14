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
import { Navbar as FlowbiteNavbar, NavbarBrand, TextInput, Button } from "flowbite-react";

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
    <FlowbiteNavbar
      fluid
      className="polutek-watch-nav sticky top-0 z-[1000] w-full rounded-none border-b border-[var(--chan-line)] bg-[var(--chan-nav)] px-4 py-2 md:px-6 lg:px-8"
    >
      <div className="flex min-h-[54px] w-full items-center justify-between gap-3 overflow-visible">
        {isMobileSearchOpen ? (
          <div className="flex-1 flex items-center gap-2 px-1 animate-in slide-in-from-top-4 duration-200">
            <Button
              color="light"
              pill
              size="sm"
              className="shrink-0 !p-2"
              onClick={() => setIsMobileSearchOpen(false)}
            >
              <X className="h-5 w-5 shrink-0" strokeWidth={1.8} />
            </Button>
            <form onSubmit={handleSearch} className="flex-1 flex min-w-0">
              <TextInput
                autoFocus
                type="text"
                placeholder={searchLabel}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                icon={Search}
                sizing="sm"
                className="w-full"
              />
            </form>
          </div>
        ) : (
          <>
            {/* Logo */}
            <NavbarBrand as={Link} href={getLocalizedHref(language, "home")} className="shrink-0">
              <BrandName
                className="text-[1.1rem] leading-none text-[var(--chan-ink)] md:text-[1.35rem]"
                variant="classic"
                style={{ fontFamily: "'Bitter', Georgia, serif" }}
              />
            </NavbarBrand>

            {/* Desktop search */}
            <div className="flex-1 max-w-[548px] hidden md:flex mx-2 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full">
                <TextInput
                  type="text"
                  placeholder={searchLabel}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  icon={Search}
                  sizing="sm"
                  className="w-full"
                />
              </form>
            </div>

            {/* Right controls */}
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {/* Mobile search trigger */}
              <div className="flex items-center sm:hidden">
                <Button
                  color="light"
                  pill
                  size="sm"
                  className="!p-2"
                  onClick={() => setIsMobileSearchOpen(true)}
                >
                  <Search className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                </Button>
              </div>

              {/* Language switcher — compact segmented pill, sized to align with the account actions. */}
              <div
                role="radiogroup"
                aria-label={language === "pl" ? "Wybierz język" : "Choose language"}
                className="relative flex h-[38px] w-[78px] shrink-0 items-center rounded-full border border-[color-mix(in_srgb,var(--chan-line)_84%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_82%,white)] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow] duration-160 hover:border-[var(--chan-blue)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.08)]"
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
                <Button
                  color="blue"
                  size="sm"
                  className="shrink-0"
                  onClick={() => openAuthModal("sign-in")}
                  aria-label={t.signIn}
                  title={t.signIn}
                >
                  <LogIn className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span className="hidden sm:inline ml-1.5 leading-none text-[13px] font-semibold">{t.signIn}</span>
                </Button>
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
    </FlowbiteNavbar>
  );
};

export default Navbar;

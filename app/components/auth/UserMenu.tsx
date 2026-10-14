"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Home, LayoutDashboard, LogOut, Settings, ShieldCheck, Users, X } from "lucide-react";
import { useAuth, useUser } from "@/lib/auth/react";
import { ADMIN_PANEL_ORIGIN } from "@/lib/admin-legacy-redirects";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import AccountModal from "./AccountModal";
import LanguageSwitcher from "../LanguageSwitcher";
import { useSwitchLanguage } from "../useSwitchLanguage";

interface UserMenuProps {
  isAdmin: boolean;
}

/** "Language: Polski" in the account panel; useSwitchLanguage reads the URL, so it sits in its own Suspense. */
function PanelLanguage() {
  const { language } = useLanguage();
  const switchLanguage = useSwitchLanguage();
  return (
    <div className="flex flex-wrap items-center px-1">
      <LanguageSwitcher language={language} onSelect={switchLanguage} variant="inline" />
    </div>
  );
}

type SubscribedChannel = { id: string; slug: string; handle: string | null; name: string };

/** How many followed channels the panel lists; the rest is one click away on the subscriptions page. */
const PANEL_CHANNEL_LIMIT = 8;

/**
 * Account panel. The avatar in the top bar opens a side panel from the right: who is signed in, the main places of
 * the site (home, Studio, account, the administrator panel), the channels the viewer follows, the legal documents and
 * the sign-out button pinned at the bottom. It replaces both the old dropdown and the left "hamburger" menu, which
 * duplicated each other. A modal dialog on every screen size: focus moves in, Esc and the backdrop close it, focus
 * returns to the avatar. Better Auth is the identity backend; the application owns all visible account UI.
 */
export default function UserMenu({ isAdmin }: UserMenuProps) {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language, tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [channels, setChannels] = useState<SubscribedChannel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll: lock both the root and the body (either may be the scroller) and keep the
    // layout from jumping when the scrollbar disappears.
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, bodyPaddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
    };
  }, [open, close]);

  // The followed channels are read when the panel opens (own data, never cached).
  const userId = user?.id;
  useEffect(() => {
    if (!open || !userId) return;
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/user/subscribed-channels", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items: SubscribedChannel[] }>) : Promise.reject(new Error("status"))))
      .then((data) => setChannels(data.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, userId]);

  if (!user) return null;

  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || "";
  const email = user.primaryEmailAddress?.emailAddress || "";
  const avatar = user.imageUrl;
  const initial = (displayName[0] || "?").toUpperCase();

  const itemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";
  const iconClass = "h-5 w-5 shrink-0";
  const sectionTitleClass = "px-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--chan-muted)]";

  const avatarImage = (size: number) =>
    avatar ? (
      <Image src={avatar} alt="" width={size} height={size} className="h-full w-full object-cover" unoptimized />
    ) : (
      <span className="text-[13px] font-bold text-[var(--chan-ink)]">{initial}</span>
    );

  const visibleChannels = channels?.slice(0, PANEL_CHANNEL_LIMIT) ?? [];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tx("Menu konta", "Account menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full border border-[var(--chan-line)]">
          {avatarImage(34)}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1100]">
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} className="absolute inset-0 h-full w-full cursor-default touch-none bg-black/40" />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={tx("Menu konta", "Account menu")}
            className="absolute right-0 top-0 flex h-full w-[min(88vw,320px)] flex-col overscroll-contain bg-[var(--chan-card)] shadow-2xl animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-start gap-3 border-b border-[var(--chan-line)] p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--chan-line)]">
                {avatarImage(48)}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[15px] font-bold text-[var(--chan-ink)]">{displayName}</p>
                {email && email !== displayName ? <p className="truncate text-[12px] text-[var(--chan-muted)]">{email}</p> : null}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={tx("Zamknij menu", "Close menu")}
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
              >
                <X className={iconClass} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-3">
              <nav aria-label={tx("Nawigacja boczna", "Side navigation")} className="grid gap-1">
                <Link href={getLocalizedHref(language, "home")} className={itemClass} onClick={() => setOpen(false)}>
                  <Home className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Strona główna", "Home")}
                </Link>
                <Link href={getLocalizedHref(language, "studio")} className={itemClass} onClick={() => setOpen(false)}>
                  <LayoutDashboard className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Studio twórcy", "Creator Studio")}
                </Link>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    setAccountOpen(true);
                  }}
                >
                  <Settings className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Moje konto", "My account")}
                </button>
                {isAdmin ? (
                  <a href={ADMIN_PANEL_ORIGIN} target="_blank" rel="noopener noreferrer" className={itemClass}>
                    <ShieldCheck className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                    {tx("Panel admina", "Admin panel")}
                  </a>
                ) : null}
              </nav>

              <section aria-labelledby={`${panelId}-subs`} className="mb-4 mt-4 grid gap-1 border-t border-[var(--chan-line)] pt-3">
                <h2 id={`${panelId}-subs`} className={sectionTitleClass}>
                  {tx("Subskrypcje", "Subscriptions")}
                </h2>
                <Link href={getLocalizedHref(language, "subscriptions")} className={itemClass} onClick={() => setOpen(false)}>
                  <Users className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Wszystkie subskrypcje", "All subscriptions")}
                </Link>
                {failed ? (
                  <p className="px-3 text-[13px] text-[var(--chan-muted)]" role="alert">
                    {tx("Nie udało się wczytać subskrypcji.", "Could not load your subscriptions.")}
                  </p>
                ) : channels === null ? (
                  <p className="px-3 text-[13px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>
                ) : channels.length === 0 ? (
                  <p className="px-3 text-[13px] text-[var(--chan-muted)]">{tx("Nie subskrybujesz jeszcze żadnego kanału.", "You do not follow any channel yet.")}</p>
                ) : (
                  <ul className="grid gap-1">
                    {visibleChannels.map((channel) => (
                      <li key={channel.id}>
                        <Link href={getLocalizedHref(language, "channel", { slug: channel.slug })} className={itemClass} onClick={() => setOpen(false)}>
                          <span className="min-w-0 truncate pl-8">{channel.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="mt-4 border-t border-[var(--chan-line)] pt-3">
                <Suspense fallback={null}>
                  <PanelLanguage />
                </Suspense>
              </div>

              <nav aria-label={tx("Informacje prawne", "Legal")} className="mt-auto grid gap-1 border-t border-[var(--chan-line)] pt-3">
                <Link href={getLocalizedHref(language, "terms")} className={itemClass} onClick={() => setOpen(false)}>
                  <BookOpen className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Regulamin", "Terms")}
                </Link>
                <Link href={getLocalizedHref(language, "privacy")} className={itemClass} onClick={() => setOpen(false)}>
                  <ShieldCheck className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                  {tx("Polityka prywatności", "Privacy policy")}
                </Link>
              </nav>
            </div>

            <div className="border-t border-[var(--chan-line)] p-3">
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <LogOut className={iconClass} strokeWidth={1.8} aria-hidden="true" />
                {tx("Wyloguj się", "Sign out")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} isAdmin={isAdmin} />
    </>
  );
}

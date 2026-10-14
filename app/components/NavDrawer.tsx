"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, Home, LayoutDashboard, Menu, ShieldCheck, Users, X } from "lucide-react";
import { useUser } from "@/lib/auth/react";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "./LanguageContext";

type SubscribedChannel = { id: string; slug: string; handle: string | null; name: string };

/**
 * The "hamburger" next to the logo: opens a side panel with the main places of the site and, for a signed-in viewer,
 * the channels they follow. A modal dialog on every screen size (focus moves in, Esc and the backdrop close it,
 * focus returns to the button), so it never competes with the page layout.
 */
export default function NavDrawer() {
  const { language, tx } = useLanguage();
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<SubscribedChannel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Esc closes; the page behind does not scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  // The followed channels are read when the panel is opened (fresh, own data, never cached).
  useEffect(() => {
    if (!open || !isSignedIn) return;
    const controller = new AbortController();
    setFailed(false);
    fetch("/api/user/subscribed-channels", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items: SubscribedChannel[] }>) : Promise.reject(new Error("status"))))
      .then((data) => setChannels(data.items))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, isSignedIn]);

  const itemClass =
    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tx("Otwórz menu", "Open menu")}
        aria-expanded={open}
        aria-controls={panelId}
        className="mr-1 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[background-color,box-shadow] duration-160 hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
      >
        <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1100]">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />
          <aside
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={tx("Menu boczne", "Side menu")}
            className="absolute left-0 top-0 flex h-full w-[min(86vw,300px)] flex-col gap-4 overflow-y-auto bg-[var(--chan-card)] p-3 shadow-2xl animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="px-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--chan-muted)]">{tx("Menu", "Menu")}</span>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={tx("Zamknij menu", "Close menu")}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[var(--chan-ink)] hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
              >
                <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label={tx("Nawigacja boczna", "Side navigation")} className="grid gap-1">
              <Link href={getLocalizedHref(language, "home")} className={itemClass} onClick={() => setOpen(false)}>
                <Home className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {tx("Strona główna", "Home")}
              </Link>
              {isSignedIn ? (
                <Link href={getLocalizedHref(language, "studio")} className={itemClass} onClick={() => setOpen(false)}>
                  <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {tx("Studio twórcy", "Creator Studio")}
                </Link>
              ) : null}
            </nav>

            <section aria-labelledby={`${panelId}-subs`} className="grid gap-1 border-t border-[var(--chan-line)] pt-3">
              <h2 id={`${panelId}-subs`} className="px-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--chan-muted)]">
                {tx("Subskrypcje", "Subscriptions")}
              </h2>
              {!isSignedIn ? (
                <p className="px-3 text-[13px] text-[var(--chan-muted)]">{tx("Zaloguj się, aby zobaczyć subskrybowane kanały.", "Sign in to see the channels you follow.")}</p>
              ) : failed ? (
                <p className="px-3 text-[13px] text-[var(--chan-muted)]" role="alert">{tx("Nie udało się wczytać subskrypcji.", "Could not load your subscriptions.")}</p>
              ) : channels === null ? (
                <p className="px-3 text-[13px] text-[var(--chan-muted)]">{tx("Wczytuję…", "Loading…")}</p>
              ) : channels.length === 0 ? (
                <p className="px-3 text-[13px] text-[var(--chan-muted)]">{tx("Nie subskrybujesz jeszcze żadnego kanału.", "You do not follow any channel yet.")}</p>
              ) : (
                <ul className="grid gap-1">
                  {channels.map((channel) => (
                    <li key={channel.id}>
                      <Link href={getLocalizedHref(language, "channel", { slug: channel.slug })} className={itemClass} onClick={() => setOpen(false)}>
                        <Users className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                        <span className="min-w-0 truncate">{channel.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <nav aria-label={tx("Informacje prawne", "Legal")} className="mt-auto grid gap-1 border-t border-[var(--chan-line)] pt-3">
              <Link href={getLocalizedHref(language, "terms")} className={itemClass} onClick={() => setOpen(false)}>
                <BookOpen className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {tx("Regulamin", "Terms")}
              </Link>
              <Link href={getLocalizedHref(language, "privacy")} className={itemClass} onClick={() => setOpen(false)}>
                <ShieldCheck className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                {tx("Polityka prywatności", "Privacy policy")}
              </Link>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

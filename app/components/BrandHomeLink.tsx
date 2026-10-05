"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";

const LABEL: Record<Locale, string> = {
  pl: "pawelperfect.com, strona główna",
  en: "pawelperfect.com, home page",
};

/** A click the browser should handle itself: new tab/window, download, or not the main button. */
function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented;
}

/**
 * The logo in the top bar: a real link (`<a href>`) to the localized home page, the one with the
 * hero video.
 *
 * On the home page itself (`isHome`) a plain click must not navigate: the home page is
 * `force-dynamic`, so even a same-URL navigation re-renders it on the server and shows the route's
 * loading screen (a flash, and the address bar is masked to "/" anyway). It scrolls back to the top
 * of the hero instead. Everywhere else (and for Ctrl/Cmd/middle clicks) the link navigates normally.
 */
export default function BrandHomeLink({
  language,
  isHome = false,
  className,
  children,
}: {
  language: Locale;
  isHome?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isHome || isModifiedClick(event)) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <Link
      href={getLocalizedHref(language, "home")}
      onClick={handleClick}
      className={className}
      aria-label={LABEL[language]}
      aria-current={isHome ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

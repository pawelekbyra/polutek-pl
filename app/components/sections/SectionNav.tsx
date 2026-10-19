"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/app/components/LanguageContext";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { SHOW_SECTION_NAV } from "@/lib/ui-flags";
import {
  SECTION_BAR_STORAGE_KEY,
  SECTION_RAIL_STORAGE_KEY,
  readHiddenPreference,
  sectionFromSegments,
  writeHiddenPreference,
  type SectionId,
} from "@/lib/sections/sections";

/**
 * Prototype navigation between the sections of the service (flag SHOW_SECTION_NAV): a rounded bottom bar on phones
 * (below lg) and a slim icon rail on the left on desktops. The page makes room only while a bar is shown (see
 * `.pp-section-bar` / `.pp-section-rail` in globals.css). Z-index 900 keeps it below the top bar (1000), the mobile
 * comment composer (1100) and every dialog; the full-screen player lives in the browser's top layer.
 */
const ICONS = { video: Play, photos: Camera, shop: ShoppingBag } as const;

function useSectionItems() {
  const { language, tx } = useLanguage();
  return [
    { id: "video" as const, label: tx("Wideo", "Video"), href: getLocalizedHref(language, "home") },
    { id: "photos" as const, label: tx("Zdjęcia", "Photos"), href: getLocalizedHref(language, "photos") },
    { id: "shop" as const, label: tx("Sklep", "Shop"), href: getLocalizedHref(language, "shop") },
  ];
}

/** Hidden while the viewer types (the on-screen keyboard would lift the bar over the field) or a video is full screen. */
function useSuppressed() {
  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => {
    const isField = (el: Element | null) =>
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);
    const update = () => setSuppressed(isField(document.activeElement) || !!document.fullscreenElement);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("fullscreenchange", update);
    };
  }, []);
  return suppressed;
}

function useHiddenPreference(key: string) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(readHiddenPreference(key));
  }, [key]);
  const update = (next: boolean) => {
    setHidden(next);
    writeHiddenPreference(key, next);
  };
  return [hidden, update] as const;
}

/** The rail starts below the top bar: publish the bar's height as --pp-topbar-h (it can differ per page and breakpoint). */
function useTopbarHeight(routeKey: string) {
  useEffect(() => {
    // A page can carry more than one top bar element (a hidden loading/skeleton copy has no height): use the visible one.
    const bars = Array.from(document.querySelectorAll<HTMLElement>("header.polutek-watch-nav"));
    if (bars.length === 0) return;
    const publish = () => {
      const height = Math.max(0, ...bars.map((bar) => Math.round(bar.getBoundingClientRect().height)));
      document.documentElement.style.setProperty("--pp-topbar-h", `${height > 0 ? height : 64}px`);
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    bars.forEach((bar) => observer?.observe(bar));
    window.addEventListener("resize", publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [routeKey]);
}

function BottomBar({ active }: { active: SectionId }) {
  const { tx } = useLanguage();
  const items = useSectionItems();
  const [hidden, setHidden] = useHiddenPreference(SECTION_BAR_STORAGE_KEY);
  const suppressed = useSuppressed();
  const shown = !hidden && !suppressed;
  const hideLabel = tx("Ukryj pasek sekcji", "Hide section bar");
  const showLabel = tx("Pokaż pasek sekcji", "Show section bar");

  return (
    <div className="lg:hidden">
      <div
        className="pp-section-bar fixed inset-x-0 bottom-0 z-[900] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] transition-transform duration-300 ease-out motion-reduce:transition-none"
        data-open={hidden ? "false" : "true"}
        style={{ transform: shown ? "translateY(0)" : "translateY(calc(100% + 24px))", pointerEvents: shown ? undefined : "none" }}
        aria-hidden={shown ? undefined : true}
      >
        <div className="relative w-full max-w-sm">
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label={hideLabel}
            title={hideLabel}
            tabIndex={shown ? 0 : -1}
            className="absolute -top-3 left-1/2 z-10 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-muted)] shadow-sm transition hover:text-[var(--chan-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <nav
            aria-label={tx("Sekcje serwisu", "Service sections")}
            className="grid grid-cols-3 gap-1 rounded-[28px] border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_92%,transparent)] p-1.5 shadow-[0_8px_30px_rgba(17,24,39,0.16)] backdrop-blur-md"
          >
            {items.map((item) => {
              const Icon = ICONS[item.id];
              const isActive = item.id === active;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  tabIndex={shown ? 0 : -1}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-[22px] px-2 py-2 text-[11px] font-semibold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] ${
                    isActive ? "bg-[var(--chan-blue)] text-white shadow-sm" : "text-[var(--chan-muted-2)] hover:bg-[var(--chan-surface)]"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {hidden && !suppressed ? (
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label={showLabel}
          title={showLabel}
          className="fixed bottom-0 left-1/2 z-[900] flex h-5 w-14 -translate-x-1/2 items-center justify-center rounded-t-2xl border border-b-0 border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-muted)] shadow-[0_-2px_10px_rgba(17,24,39,0.10)] transition hover:text-[var(--chan-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function Rail({ active }: { active: SectionId }) {
  useTopbarHeight(active);
  const { tx } = useLanguage();
  const items = useSectionItems();
  const [hidden, setHidden] = useHiddenPreference(SECTION_RAIL_STORAGE_KEY);
  const hideLabel = tx("Ukryj menu sekcji", "Hide section menu");
  const showLabel = tx("Pokaż menu sekcji", "Show section menu");

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label={showLabel}
        title={showLabel}
        className="fixed left-0 top-1/2 z-[900] hidden h-14 w-5 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-[var(--chan-line)] bg-[var(--chan-card)] text-[var(--chan-muted)] shadow-[2px_0_10px_rgba(17,24,39,0.10)] transition hover:text-[var(--chan-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] lg:flex"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      className="pp-section-rail fixed bottom-0 left-0 top-[var(--pp-topbar-h,64px)] z-[900] hidden w-16 flex-col items-center border-r border-t border-[var(--chan-line)] bg-[var(--chan-nav)] pb-4 pt-4 lg:flex"
      data-open="true"
    >
      <nav aria-label={tx("Sekcje serwisu", "Service sections")} className="flex flex-1 flex-col items-center gap-2">
        {items.map((item) => {
          const Icon = ICONS[item.id];
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] ${
                isActive ? "bg-[var(--chan-blue)] text-white shadow-sm" : "text-[var(--chan-muted-2)] hover:bg-[var(--chan-surface)]"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--chan-ink)] px-3 py-1 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={hideLabel}
        title={hideLabel}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--chan-muted)] transition hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}

export default function SectionNav() {
  const segments = useSelectedLayoutSegments();
  if (!SHOW_SECTION_NAV) return null;
  const active = sectionFromSegments(segments);
  if (!active) return null;
  return (
    <>
      <BottomBar active={active} />
      <Rail active={active} />
    </>
  );
}

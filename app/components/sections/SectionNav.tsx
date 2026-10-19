"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Camera, ChevronLeft, ChevronRight, Play, ShoppingBag } from "lucide-react";
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

/**
 * Phone: an arc-shaped dock on the left edge, vertically centred. It glides in from the edge with a small spring, its
 * three buttons pop in one after another along the curve, and hiding reverses it into a half-circle tab on the edge.
 * It floats over the page (no layout shift) and is glass-like so the content stays visible behind it.
 */
const DOCK_ITEM_OFFSETS = [-7, 0, -7]; // px: the outer buttons sit further in, so the column follows the arc

function ArcDock({ active }: { active: SectionId }) {
  const { tx } = useLanguage();
  const items = useSectionItems();
  const [hidden, setHidden] = useHiddenPreference(SECTION_BAR_STORAGE_KEY);
  const suppressed = useSuppressed();
  const shown = !hidden && !suppressed;
  const tabShown = hidden && !suppressed;
  const hideLabel = tx("Ukryj pasek sekcji", "Hide section bar");
  const showLabel = tx("Pokaż pasek sekcji", "Show section bar");

  return (
    <div className="lg:hidden">
      <div
        className="pp-dock fixed left-0 top-1/2 z-[900] flex w-[58px] flex-col items-center gap-1.5 py-4 pl-1.5 pr-2.5"
        data-open={shown ? "true" : "false"}
        style={{
          transform: `translate(${shown ? "0" : "calc(-100% - 8px)"}, -50%)`,
          transition: shown
            ? "transform 520ms cubic-bezier(0.22, 1.25, 0.36, 1)"
            : "transform 300ms cubic-bezier(0.4, 0, 0.9, 0.4)",
          pointerEvents: shown ? undefined : "none",
        }}
        aria-hidden={shown ? undefined : true}
      >
        <nav aria-label={tx("Sekcje serwisu", "Service sections")} className="flex flex-col items-center gap-1.5">
          {items.map((item, index) => {
            const Icon = ICONS[item.id];
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                tabIndex={shown ? 0 : -1}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] ${
                  isActive ? "bg-[var(--chan-blue)] text-white shadow-[0_4px_14px_rgba(37,99,235,0.45)]" : "text-[var(--chan-muted-2)] active:bg-[var(--chan-surface)]"
                }`}
                style={{
                  opacity: shown ? 1 : 0,
                  transform: `translateX(${shown ? (DOCK_ITEM_OFFSETS[index] ?? 0) : -14}px) scale(${shown ? 1 : 0.55})`,
                  transition: shown
                    ? `opacity 280ms ease ${140 + index * 80}ms, transform 420ms cubic-bezier(0.22, 1.4, 0.36, 1) ${140 + index * 80}ms, background-color 200ms`
                    : "opacity 140ms ease, transform 200ms ease, background-color 200ms",
                }}
              >
                <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
                <span className="mt-0.5 text-[8.5px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label={hideLabel}
          title={hideLabel}
          tabIndex={shown ? 0 : -1}
          className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--chan-muted)] active:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
          style={{ transform: "translateX(-2px)" }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label={showLabel}
        title={showLabel}
        tabIndex={tabShown ? 0 : -1}
        className="pp-dock-tab fixed left-0 top-1/2 z-[900] flex h-[76px] w-[22px] items-center justify-center text-[var(--chan-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
        style={{
          transform: `translate(${tabShown ? "0" : "-110%"}, -50%)`,
          transition: tabShown ? "transform 420ms cubic-bezier(0.22, 1.3, 0.36, 1) 160ms" : "transform 200ms ease-in",
          pointerEvents: tabShown ? undefined : "none",
        }}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
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
  const open = !hidden;

  return (
    <>
      <aside
        className="pp-section-rail fixed bottom-0 left-0 top-[var(--pp-topbar-h,64px)] z-[900] hidden w-16 flex-col items-center border-r border-t border-[var(--chan-line)] bg-[var(--chan-nav)] pb-4 pt-4 lg:flex"
        data-open={open ? "true" : "false"}
        aria-hidden={open ? undefined : true}
        style={{
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: open ? "transform 380ms cubic-bezier(0.22, 1.1, 0.36, 1)" : "transform 280ms cubic-bezier(0.4, 0, 0.9, 0.4)",
          pointerEvents: open ? undefined : "none",
        }}
      >
        <nav aria-label={tx("Sekcje serwisu", "Service sections")} className="flex flex-1 flex-col items-center gap-2">
          {items.map((item) => {
            const Icon = ICONS[item.id];
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                tabIndex={open ? 0 : -1}
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
          tabIndex={open ? 0 : -1}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--chan-muted)] transition hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </aside>

      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label={showLabel}
        title={showLabel}
        tabIndex={hidden ? 0 : -1}
        className="pp-dock-tab fixed left-0 top-1/2 z-[900] hidden h-[76px] w-[22px] items-center justify-center text-[var(--chan-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)] lg:flex"
        style={{
          transform: `translate(${hidden ? "0" : "-110%"}, -50%)`,
          transition: hidden ? "transform 420ms cubic-bezier(0.22, 1.3, 0.36, 1) 200ms" : "transform 200ms ease-in",
          pointerEvents: hidden ? undefined : "none",
        }}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

export default function SectionNav() {
  const segments = useSelectedLayoutSegments();
  if (!SHOW_SECTION_NAV) return null;
  const active = sectionFromSegments(segments);
  if (!active) return null;
  return (
    <>
      <ArcDock active={active} />
      <Rail active={active} />
    </>
  );
}

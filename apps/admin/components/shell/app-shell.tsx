"use client";
/**
 * The one shell of the panel (DESIGN-SYSTEM.md 3, 5, 6): side navigation (232 px, 64 px icons below
 * 1100 px, a drawer below 760 px), top bar, bottom bar on phones, the command palette and the global
 * keyboard shortcuts. Server data (counts, health) comes in as props; nothing here fetches on mount.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { NavCounts } from "@/lib/modules/admin-overview";
import { ALL_NAV, BOTTOM_NAV, NAV, NAV_FOOT, activeNavId, type NavItem } from "@admin/lib/nav";
import { Icon } from "../icons";
import { CommandPalette } from "./command-palette";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Topbar, type ShellHealth } from "./topbar";
import { ToastProvider } from "./toasts";

export type ShellViewer = { name: string; email: string; dev?: boolean; /** Access mode: the account menu links here to sign out (Cloudflare Access logout). */ signOutHref?: string };

const RANGE_ORDER = ["today", "7d", "28d", "90d"] as const;

function NavLink({ item, current, counts }: { item: NavItem; current: string | null; counts: NavCounts }) {
  const count = item.count ? counts[item.count] : 0;
  const tone = item.count === "contentErrors" ? "crit" : item.count === "systemAlerts" ? (counts.systemKind === "crit" ? "crit" : "warn") : "warn";
  return (
    <li>
      <Link href={item.href} aria-current={current === item.id ? "page" : undefined} title={`${item.label} (g, ${item.key})`} prefetch>
        <Icon name={item.icon} large />
        <span className="nav-label">{item.label}</span>
        {count ? (
          <>
            <span className={`nav-count ${tone}`}>
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">
                , {count} {item.what}
              </span>
            </span>
            <span className="badge-dot" aria-hidden="true" />
          </>
        ) : null}
        <span className="nav-kbd" aria-hidden="true">
          <kbd>g</kbd>
          <kbd>{item.key}</kbd>
        </span>
      </Link>
    </li>
  );
}

/** Screens that read the global period filter (`?range=`, `?cmp=`). */
const hasPeriod = (path: string) => path === "/" || path === "/analityka" || path.startsWith("/analityka/") || /^\/tresci\/[^/]+\/(analityka|jakosc)$/.test(path);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest?.("input, textarea, select, [contenteditable], dialog[open]");
}

export function AppShell({ children, counts, health, viewer, sample, now }: { children: ReactNode; counts: NavCounts; health: ShellHealth; viewer: ShellViewer; sample: boolean; now: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const current = activeNavId(pathname);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const gAt = useRef(0);

  const closeDrawer = useCallback((focusMore = false) => {
    setDrawer(false);
    if (focusMore) moreRef.current?.focus();
  }, []);

  // Close the drawer and move focus to the page heading after every navigation (WCAG 2.4.3).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setDrawer(false);
    window.scrollTo(0, 0);
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    if (drawer) document.querySelector<HTMLElement>("#sidebar a[aria-current], #sidebar a")?.focus();
  }, [drawer]);

  const setRange = useCallback(
    (range: string) => {
      const q = new URLSearchParams(params.toString());
      if (range === "today") q.delete("range");
      else q.set("range", range);
      const qs = q.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.key === "Escape" && drawer) {
        closeDrawer(true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const k = e.key;
      if (gAt.current && Date.now() - gAt.current < 1200) {
        gAt.current = 0;
        const n = ALL_NAV.find((x) => x.key === k.toLowerCase());
        if (n) {
          e.preventDefault();
          router.push(n.href);
        }
        return;
      }
      if (k === "g") {
        gAt.current = Date.now();
        return;
      }
      if (k === "?") {
        e.preventDefault();
        setShortcuts(true);
        return;
      }
      if (k === "/") {
        const f = document.querySelector<HTMLElement>("main .filters input, main input[type=search]");
        if (f) {
          e.preventDefault();
          f.focus();
        }
        return;
      }
      if ((k === "[" || k === "]") && hasPeriod(pathname)) {
        const cur = RANGE_ORDER.indexOf((params.get("range") as (typeof RANGE_ORDER)[number]) ?? "today");
        const next = RANGE_ORDER[Math.max(0, Math.min(RANGE_ORDER.length - 1, (cur < 0 ? 0 : cur) + (k === "]" ? 1 : -1)))];
        setRange(next);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeDrawer, drawer, params, pathname, router, setRange]);

  return (
    <ToastProvider>
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <div className={`app${drawer ? " nav-open" : ""}`}>
        <aside className="sidebar" id="sidebar" aria-label="Nawigacja główna">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              PP
            </div>
            <div className="brand-text">
              <div className="brand-name">Panel PP</div>
              <div className="brand-env">admin.pawelperfect.com</div>
            </div>
          </div>
          <nav aria-label="Moduły panelu">
            <ul className="nav">
              {NAV.map((item) => (
                <NavLink key={item.id} item={item} current={current} counts={counts} />
              ))}
              <li className="nav-sep" role="separator" />
              <NavLink item={NAV_FOOT[0]} current={current} counts={counts} />
            </ul>
          </nav>
          <div className="sidebar-foot">
            <ul className="nav">
              <NavLink item={NAV_FOOT[1]} current={current} counts={counts} />
            </ul>
            <p>Faza 1 · tylko odczyt</p>
          </div>
        </aside>
        <button className="scrim" type="button" aria-label="Zamknij menu" tabIndex={-1} onClick={() => closeDrawer(true)} />

        <div className="main-col">
          <Topbar
            health={health}
            viewer={viewer}
            sample={sample}
            now={now}
            showPeriod={hasPeriod(pathname)}
            range={params.get("range") ?? "today"}
            compare={params.get("cmp") ?? "prev"}
            onOpenPalette={() => setPalette(true)}
          />
          <main id="main" className="content" tabIndex={-1}>
            {children}
          </main>
        </div>

        <nav className="bottom-nav" aria-label="Nawigacja na telefonie">
          {BOTTOM_NAV.map((b) => {
            const count = b.count ? counts[b.count] : 0;
            return (
              <Link key={b.id} href={b.href} aria-current={current === b.id ? "page" : undefined}>
                <Icon name={b.icon} />
                {count ? (
                  <span className="bn-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
                <span>
                  {b.label}
                  {count ? <span className="sr-only">, {count} do przejrzenia</span> : null}
                </span>
              </Link>
            );
          })}
          <button type="button" ref={moreRef} aria-expanded={drawer} aria-controls="sidebar" onClick={() => setDrawer(true)}>
            <Icon name="menu" />
            <span>Więcej</span>
          </button>
        </nav>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onShortcuts={() => setShortcuts(true)} onRange={setRange} />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
    </ToastProvider>
  );
}

"use client";
/**
 * Top bar: command palette button, global period (+ comparison) in the URL, sample-data badge, health dot
 * (shape + word, never colour alone), theme toggle and the account menu with sign-out.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { adminAuthClient } from "@admin/lib/auth/client";
import { Icon } from "../icons";
import { applyTheme, readTheme, THEME_NAME, THEME_NEXT, type Theme } from "./theme";
import { useToast } from "./toasts";
import type { ShellViewer } from "./app-shell";

export type ShellHealth = {
  kind: "ok" | "warn" | "crit" | "info";
  word: string;
  headline: string;
  items: { kind: "ok" | "warn" | "crit" | "info"; label: string; detail: string }[];
  okCount: number;
};

function subscribeTheme(cb: () => void) {
  window.addEventListener("pp-admin-theme", cb);
  return () => window.removeEventListener("pp-admin-theme", cb);
}

export function Topbar({
  health,
  viewer,
  sample,
  showPeriod,
  range,
  compare,
  onOpenPalette,
}: {
  health: ShellHealth;
  viewer: ShellViewer;
  sample: boolean;
  now: string;
  showPeriod: boolean;
  range: string;
  compare: string;
  onOpenPalette: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "system");
  const [healthOpen, setHealthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const healthBtn = useRef<HTMLButtonElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const healthPop = useRef<HTMLDivElement>(null);
  const menuPop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (healthOpen && !healthPop.current?.contains(t) && !healthBtn.current?.contains(t)) setHealthOpen(false);
      if (menuOpen && !menuPop.current?.contains(t) && !menuBtn.current?.contains(t)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (healthOpen) {
        setHealthOpen(false);
        healthBtn.current?.focus();
      }
      if (menuOpen) {
        setMenuOpen(false);
        menuBtn.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [healthOpen, menuOpen]);

  useEffect(() => {
    if (healthOpen) healthPop.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [healthOpen]);
  useEffect(() => {
    if (menuOpen) menuPop.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [menuOpen]);

  function setParam(name: "range" | "cmp", value: string, fallback: string) {
    const q = new URLSearchParams(params.toString());
    if (value === fallback) q.delete(name);
    else q.set(name, value);
    const qs = q.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  async function signOut() {
    setMenuOpen(false);
    await adminAuthClient.signOut().catch(() => undefined);
    router.replace("/logowanie");
  }

  const nextTheme = THEME_NEXT[theme];
  const problems = health.items.filter((i) => i.kind === "warn" || i.kind === "crit");

  return (
    <header className="topbar">
      <button className="search-btn" type="button" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={onOpenPalette}>
        <Icon name="search" />
        <span className="search-long">Szukaj lub wykonaj polecenie…</span>
        <span className="search-short">Szukaj…</span>
        <span className="kbd-hint">
          <kbd>Ctrl</kbd> <kbd>K</kbd>
        </span>
      </button>
      {showPeriod ? (
        <div className="period" role="group" aria-label="Globalny filtr czasu">
          <label htmlFor="range">Okres</label>
          <select className="select" id="range" value={range} aria-describedby="range-hint" onChange={(e) => setParam("range", e.target.value, "today")}>
            <option value="today">Dziś (do teraz)</option>
            <option value="7d">Ostatnie 7 dni</option>
            <option value="28d">Ostatnie 28 dni</option>
            <option value="90d">Ostatnie 90 dni</option>
          </select>
          <label htmlFor="cmp">vs</label>
          <select className="select" id="cmp" value={compare} onChange={(e) => setParam("cmp", e.target.value, "prev")}>
            <option value="prev">{range === "today" ? "tydzień temu" : "poprzedni okres"}</option>
            <option value="none">bez porównania</option>
          </select>
          <span id="range-hint" className="sr-only">
            Okres dotyczy liczb i wykresów na ekranach Dzisiaj, Analityka i analityki filmu. Skróty: nawias kwadratowy otwierający i zamykający.
          </span>
        </div>
      ) : null}
      <div className="topbar-spacer" />
      {sample ? (
        <span className="sample-badge" title="Lokalny podgląd: liczby i nazwy są przykładowe (ADMIN_DEV_FIXTURES=1)">
          <Icon name="info" />
          <span className="sample-text">Dane przykładowe</span>
        </span>
      ) : null}
      <button
        ref={healthBtn}
        className="btn btn-ghost health-btn"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={healthOpen}
        aria-controls="health-pop"
        aria-label={`Zdrowie systemu: ${health.word}${problems.length ? `, ${problems.length} do sprawdzenia` : ""}. Pokaż szczegóły`}
        onClick={() => setHealthOpen((o) => !o)}
      >
        <span className={`health-dot ${health.kind === "info" ? "ok" : health.kind}`} aria-hidden="true" />
        <span className="health-text">{health.word}</span>
      </button>
      <button
        className="icon-btn"
        type="button"
        aria-label={`Motyw: ${THEME_NAME[theme]}. Przełącz na ${THEME_NAME[nextTheme]}`}
        title={`Motyw: ${THEME_NAME[theme]}`}
        onClick={() => {
          applyTheme(nextTheme);
          toast("ok", `Motyw: ${THEME_NAME[nextTheme]}`, nextTheme === "system" ? "Panel podąża za ustawieniem systemu." : undefined);
        }}
      >
        <Icon name={theme === "system" ? "monitor" : theme === "light" ? "sun" : "moon"} large />
      </button>
      <button ref={menuBtn} className="icon-btn" type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="account-pop" onClick={() => setMenuOpen((o) => !o)} aria-label={`Konto: ${viewer.name}`}>
        <span className="avatar" aria-hidden="true">
          {(viewer.name || "?").slice(0, 1).toUpperCase()}
        </span>
      </button>

      {healthOpen ? (
        <div ref={healthPop} className="popover popover-health" id="health-pop" role="dialog" aria-label="Stan systemu">
          <div className="row-between">
            <strong>Stan systemu</strong>
          </div>
          <p className="text-2 popover-lede">{health.headline}</p>
          <div className="checks">
            {problems.map((p, i) => (
              <div key={i} className={`check ${p.kind}`}>
                <Icon name={p.kind === "crit" ? "crit" : "warn"} />
                <div>
                  <div>{p.label}</div>
                  <div className="check-sub">{p.detail}</div>
                </div>
                <span className="sr-only">{p.kind === "crit" ? "Błąd" : "Uwaga"}</span>
              </div>
            ))}
            <div className="check ok">
              <Icon name="ok" />
              <div>{health.okCount} kontroli OK</div>
              <span className="sr-only">OK</span>
            </div>
          </div>
          <Link className="btn btn-sm" href="/system" onClick={() => setHealthOpen(false)}>
            Centrum zdrowia
          </Link>
        </div>
      ) : null}
      {menuOpen ? (
        <div ref={menuPop} className="popover popover-account" id="account-pop">
          <div className="account-who">
            <strong>{viewer.name}</strong>
            <span className="muted">{viewer.email}</span>
          </div>
          {viewer.signOutHref ? (
            <a className="btn btn-sm" href={viewer.signOutHref}>
              <Icon name="logout" />
              Wyloguj
            </a>
          ) : (
            <button type="button" className="btn btn-sm" onClick={signOut} disabled={!!viewer.dev}>
              <Icon name="logout" />
              Wyloguj
            </button>
          )}
        </div>
      ) : null}
    </header>
  );
}

"use client";
/**
 * Command palette (Ctrl/⌘+K, DESIGN-SYSTEM.md 3): modules, actions and objects (films, people, payments
 * found by /api/search, read only). Search ignores Polish diacritics; arrows + Enter; Esc closes.
 * Objects open in the old panel until their sections move here (phases 3-4).
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_NAV } from "@admin/lib/nav";
import { Icon, type IconName } from "../icons";
import { applyTheme, readTheme, THEME_NEXT } from "./theme";

type Command = { id: string; group: string; label: string; hint?: string; icon: IconName; keys?: string[]; run: () => void; keywords?: string };
type SearchHit = { group: "Filmy" | "Osoby" | "Płatności"; label: string; hint: string; href: string };

export const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

export function matches(c: { label: string; hint?: string; keywords?: string; group: string }, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = normalize(`${c.label} ${c.hint ?? ""} ${c.keywords ?? ""} ${c.group}`);
  return tokens.every((t) => hay.includes(t));
}

export function CommandPalette({ open, onClose, onShortcuts, onRange }: { open: boolean; onClose: () => void; onShortcuts: () => void; onRange: (r: string) => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      ...ALL_NAV.map((n) => ({ id: `nav-${n.id}`, group: "Przejdź", label: n.label, icon: n.icon, keys: ["g", n.key], run: go(n.href) })),
      { id: "range-today", group: "Akcje", label: "Okres: dziś", icon: "calendar", run: () => onRange("today"), keywords: "zakres czas" },
      { id: "range-7d", group: "Akcje", label: "Okres: ostatnie 7 dni", icon: "calendar", run: () => onRange("7d"), keywords: "zakres czas tydzien" },
      { id: "range-28d", group: "Akcje", label: "Okres: ostatnie 28 dni", icon: "calendar", run: () => onRange("28d"), keywords: "zakres czas miesiac" },
      { id: "refresh", group: "Akcje", label: "Odśwież dane na ekranie", icon: "refresh", run: () => router.refresh(), keywords: "przeladuj" },
      { id: "theme", group: "Akcje", label: "Przełącz motyw", icon: "sun", run: () => applyTheme(THEME_NEXT[readTheme()]), keywords: "ciemny jasny dark light" },
      { id: "shortcuts", group: "Akcje", label: "Pokaż wszystkie skróty", icon: "command", keys: ["?"], run: onShortcuts, keywords: "klawisze pomoc" },
      { id: "health", group: "Akcje", label: "Centrum zdrowia", icon: "server", run: go("/system"), keywords: "status awaria kontrole" },
      { id: "stepup", group: "Akcje", label: "Potwierdź tożsamość (step-up)", icon: "passkey", run: go("/potwierdz?next=/"), keywords: "passkey totp klucz" },
    ];
  }, [onRange, onShortcuts, router]);

  const items = useMemo(() => {
    const local = commands.filter((c) => matches(c, query));
    // Results of an older, longer query never linger once the query is too short to search.
    const visibleHits = query.trim().length >= 2 ? hits : [];
    const objects: Command[] = visibleHits.map((h, i) => ({
      id: `hit-${i}`,
      group: h.group,
      label: h.label,
      hint: h.hint,
      icon: h.group === "Filmy" ? "film" : h.group === "Osoby" ? "users" : "coins",
      run: () => window.open(h.href, "_blank", "noopener,noreferrer"),
    }));
    return [...local, ...objects].slice(0, 40);
  }, [commands, hits, query]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery("");
      setSelected(0);
      setHits([]);
      d.showModal();
      input.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  // Object search: debounced, aborted when the query changes, only from 2 characters.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, credentials: "same-origin" });
        if (res.ok) setHits(((await res.json()) as { hits: SearchHit[] }).hits ?? []);
      } catch {
        // Aborted or offline: the local commands still work.
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    document.getElementById(`pi-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function run(i: number) {
    const c = items[i];
    if (!c) return;
    onClose();
    setTimeout(() => c.run(), 0);
  }

  let group = "";
  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Paleta poleceń"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="palette-input">
        <Icon name="search" large />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={items.length ? `pi-${selected}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Szukaj filmu, osoby, płatności lub akcji…"
          aria-label="Szukaj lub wykonaj polecenie"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(items.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(selected);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul className="palette-list" id="palette-list" role="listbox" aria-label="Wyniki">
        {items.length === 0 ? (
          <li className="empty" role="presentation">
            <Icon name="search" />
            <span>Nic nie pasuje do „{query}”.</span>
          </li>
        ) : (
          items.map((c, i) => {
            const header = c.group !== group;
            group = c.group;
            return [
              header ? (
                <li key={`g-${c.group}`} className="palette-group" role="presentation">
                  {c.group}
                </li>
              ) : null,
              <li key={c.id} id={`pi-${i}`} className="palette-item" role="option" aria-selected={i === selected} onMouseEnter={() => setSelected(i)} onClick={() => run(i)}>
                <Icon name={c.icon} />
                <span className="pi-label">{c.label}</span>
                {c.hint ? <span className="pi-hint">{c.hint}</span> : null}
                {c.keys ? (
                  <span className="pi-hint">
                    {c.keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </span>
                ) : null}
              </li>,
            ];
          })
        )}
      </ul>
      <div className="palette-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> wybór
        </span>
        <span>
          <kbd>Enter</kbd> wykonaj
        </span>
        <span>
          <kbd>g</kbd> potem litera: przejdź
        </span>
        <span>
          <kbd>?</kbd> wszystkie skróty
        </span>
      </div>
    </dialog>
  );
}

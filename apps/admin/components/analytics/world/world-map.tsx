"use client";
/**
 * Interactive layer of the "Świat" map (docs/architecture/admin-world-map.md). The SVG itself comes from the
 * server (children); this component only reads `data-code` attributes and toggles classes, so the path data
 * never enters the client bundle. Features: hover tooltip, click/tap to pin a country in the details panel,
 * keyboard reading (arrows walk countries by visitors, Enter pins, Escape clears), region presets (animated
 * viewBox, instant under reduced motion) and the "podbój" playback (countries light up on the day they were
 * first seen). Positions go through the CSSOM / SVG attributes only, which the panel's strict CSP allows.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";

export type MapCountry = {
  code: string;
  name: string;
  visitors: number;
  pageviews: number;
  share: number;
  cls: number;
  firstDay: string | null;
  firstLabel: string | null;
  isNew: boolean;
  anchor: [number, number] | null;
};
/** totalLabel is built on the server ("3 kraje"): the client never imports the module barrel. */
export type MapStep = { day: string; label: string; codes: string[]; names: string[]; total: number; totalLabel: string };
export type MapRegion = { id: string; label: string; box: [number, number, number, number] };

type Props = {
  countries: MapCountry[];
  classes: { cls: number; label: string }[];
  steps: MapStep[];
  regions: MapRegion[];
  width: number;
  height: number;
  pointRadius: number;
  rangeLabel: string;
  unknownVisitors: number;
  children: ReactNode;
};

type Box = [number, number, number, number];
const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["pl"], { type: "region" });
  } catch {
    return null;
  }
})();
const nameOf = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};
const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function WorldMap({ countries, classes, steps, regions, width, height, pointRadius, rangeLabel, unknownVisitors, children }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<Box>([0, 0, width, height]);
  const animRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"period" | "conquest">("period");
  const [region, setRegion] = useState("world");
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(Math.max(0, steps.length - 1));
  const [playingRaw, setPlaying] = useState(false);

  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const playing = playingRaw && step < steps.length - 1;
  const stepDay = steps[step]?.day ?? null;
  // Keyboard order: by visitors in the period; in conquest mode, by the day of discovery up to the shown step.
  const order = useMemo(() => {
    if (mode === "period") return countries.filter((c) => c.visitors > 0).sort((a, b) => b.visitors - a.visitors).map((c) => c.code);
    return countries
      .filter((c) => c.firstDay && stepDay && c.firstDay <= stepDay)
      .sort((a, b) => (a.firstDay as string).localeCompare(b.firstDay as string) || a.name.localeCompare(b.name, "pl"))
      .map((c) => c.code);
  }, [countries, mode, stepDay]);

  const elements = useCallback(() => Array.from(frameRef.current?.querySelectorAll<SVGElement>("[data-code]") ?? []), []);

  // Class state of the server-rendered shapes: selection, keyboard focus, conquest progress.
  useEffect(() => {
    for (const el of elements()) {
      const code = el.getAttribute("data-code") ?? "";
      el.classList.toggle("is-selected", code === selected);
      el.classList.toggle("is-active", code === active);
      const first = byCode.get(code)?.firstDay ?? null;
      el.classList.toggle("is-on", mode === "conquest" && !!first && !!stepDay && first < stepDay);
      el.classList.toggle("is-fresh", mode === "conquest" && !!first && first === stepDay);
    }
  }, [elements, selected, active, mode, stepDay, byCode]);

  const scalePoints = useCallback(
    (box: Box) => {
      const r = Math.max(0.6, pointRadius * (box[2] / width));
      frameRef.current?.querySelectorAll("circle.wm-point").forEach((c) => c.setAttribute("r", r.toFixed(2)));
    },
    [pointRadius, width],
  );

  const applyBox = useCallback(
    (box: Box) => {
      boxRef.current = box;
      frameRef.current?.querySelector("svg.wm-svg")?.setAttribute("viewBox", box.map((v) => v.toFixed(1)).join(" "));
      scalePoints(box);
    },
    [scalePoints],
  );

  function zoomTo(id: string) {
    setRegion(id);
    const target: Box = id === "world" ? [0, 0, width, height] : (regions.find((r) => r.id === id)?.box ?? [0, 0, width, height]);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (prefersReducedMotion()) {
      applyBox(target);
      return;
    }
    const from = boxRef.current;
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const k = Math.min(1, (t - t0) / 380);
      const e = 1 - Math.pow(1 - k, 3);
      applyBox(from.map((v, i) => v + (target[i] - v) * e) as Box);
      if (k < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  // Conquest playback: one step per 0.9 s, stops at the last day.
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setStep((s) => Math.min(steps.length - 1, s + 1)), 900);
    return () => window.clearTimeout(t);
  }, [playing, steps.length, step]);

  function placeTip(px: number, py: number) {
    const frame = frameRef.current;
    const tip = tipRef.current;
    if (!frame || !tip) return;
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    const tw = tip.offsetWidth || 200;
    const th = tip.offsetHeight || 80;
    tip.style.left = `${Math.max(4, px + 14 + tw > w - 4 ? px - tw - 14 : px + 14)}px`;
    tip.style.top = `${Math.max(4, Math.min(h - th - 4, py - th / 2))}px`;
  }
  function anchorPx(code: string): [number, number] | null {
    const c = byCode.get(code);
    const frame = frameRef.current;
    if (!c?.anchor || !frame) return null;
    const [bx, by, bw, bh] = boxRef.current;
    // preserveAspectRatio meet: the drawing is scaled uniformly and centred in the frame.
    const s = Math.min(frame.clientWidth / bw, frame.clientHeight / bh);
    const ox = (frame.clientWidth - bw * s) / 2;
    const oy = (frame.clientHeight - bh * s) / 2;
    return [ox + (c.anchor[0] - bx) * s, oy + (c.anchor[1] - by) * s];
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = (e.target as Element).closest?.("[data-code]");
    const code = el?.getAttribute("data-code") ?? null;
    setHover(code);
    if (code) {
      const r = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      requestAnimationFrame(() => placeTip(x, y));
    }
  }
  function onClick(e: MouseEvent<HTMLDivElement>) {
    const code = (e.target as Element).closest?.("[data-code]")?.getAttribute("data-code") ?? null;
    setSelected((s) => (code && s !== code ? code : null));
  }
  function focusCountry(code: string | null) {
    setActive(code);
    if (!code) return;
    requestAnimationFrame(() => {
      const p = anchorPx(code);
      if (p) placeTip(p[0], p[1]);
    });
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!order.length) return;
    const i = active ? order.indexOf(active) : -1;
    const next: Record<string, number> = {
      ArrowRight: i < 0 ? 0 : Math.min(order.length - 1, i + 1),
      ArrowDown: i < 0 ? 0 : Math.min(order.length - 1, i + 1),
      ArrowLeft: i < 0 ? order.length - 1 : Math.max(0, i - 1),
      ArrowUp: i < 0 ? order.length - 1 : Math.max(0, i - 1),
      Home: 0,
      End: order.length - 1,
    };
    if (e.key in next) {
      e.preventDefault();
      focusCountry(order[next[e.key]]);
    } else if ((e.key === "Enter" || e.key === " ") && active) {
      e.preventDefault();
      setSelected((s) => (s === active ? null : active));
    } else if (e.key === "Escape") {
      setActive(null);
      setSelected(null);
    }
  }

  const shown = hover ?? active;
  const describe = (code: string) => {
    const c = byCode.get(code);
    if (!c || c.visitors <= 0) return `${c?.name ?? nameOf(code)}: brak odwiedzających w okresie${c?.firstLabel ? `, pierwszy raz ${c.firstLabel}` : ""}.`;
    return `${c.name}: ${nf.format(c.visitors)} odwiedzających, ${nf.format(c.pageviews)} odsłon, ${pf.format(c.share)}% ruchu${c.firstLabel ? `, pierwszy raz ${c.firstLabel}` : ""}${c.isNew ? " (nowy w okresie)" : ""}.`;
  };
  const sel = selected ? (byCode.get(selected) ?? null) : null;
  const cur = steps[step];

  return (
    <div className={`wm${mode === "conquest" ? " is-conquest" : ""}`}>
      <div className="wm-controls">
        <div className="row" role="group" aria-label="Co pokazuje mapa">
          <button type="button" className={`btn btn-sm${mode === "period" ? " btn-primary" : ""}`} aria-pressed={mode === "period"} onClick={() => { setMode("period"); setPlaying(false); }}>
            Odwiedzający ({rangeLabel})
          </button>
          <button type="button" className={`btn btn-sm${mode === "conquest" ? " btn-primary" : ""}`} aria-pressed={mode === "conquest"} disabled={!steps.length} onClick={() => setMode("conquest")}>
            Podbój świata
          </button>
        </div>
        <div className="row" role="group" aria-label="Przybliżenie">
          {[{ id: "world", label: "Świat" }, ...regions].map((r) => (
            <button key={r.id} type="button" className={`btn btn-sm${region === r.id ? " btn-primary" : " btn-ghost"}`} aria-pressed={region === r.id} onClick={() => zoomTo(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "conquest" && cur ? (
        <div className="wm-conquest-bar">
          <button type="button" className="btn btn-sm" aria-pressed={playing} onClick={() => {
            if (!playing && step >= steps.length - 1) setStep(0);
            setPlaying(!playing);
          }}>
            {playing ? "Pauza" : step >= steps.length - 1 ? "Odtwórz od początku" : "Odtwórz"}
          </button>
          <label className="sr-only" htmlFor="wm-step">Dzień podboju</label>
          <input id="wm-step" className="wm-range" type="range" min={0} max={Math.max(0, steps.length - 1)} step={1} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} aria-valuetext={`${cur.label}: ${cur.totalLabel}`} />
          <span className="wm-step-label" aria-live="polite">
            <strong>{cur.label}</strong> · {cur.totalLabel} · nowe: {cur.names.join(", ")}
          </span>
        </div>
      ) : null}

      <div className="wm-body">
        <div
          ref={frameRef}
          className="wm-frame"
          tabIndex={0}
          role="group"
          aria-label={`Mapa świata: ${mode === "period" ? `odwiedzający według kraju, ${rangeLabel}` : "kraje według dnia pierwszej wizyty"}. Strzałki przechodzą po krajach, Enter wybiera, Escape czyści. Pełne dane w tabeli pod mapą.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {children}
          <div ref={tipRef} className="chart-tip wm-tip" hidden={!shown} aria-hidden="true">
            {shown ? <TipBody c={byCode.get(shown) ?? null} code={shown} mode={mode} /> : null}
          </div>
          <span className="sr-only" aria-live="polite">{active ? describe(active) : ""}</span>
        </div>

        <aside className="wm-side" aria-label="Wybrany kraj">
          {sel ? (
            <>
              <h3 className="wm-side-title">{sel.name}</h3>
              <dl className="kv">
                <dt>Odwiedzający</dt>
                <dd>{sel.visitors > 0 ? nf.format(sel.visitors) : "brak w okresie"}</dd>
                <dt>Odsłony</dt>
                <dd>{sel.visitors > 0 ? nf.format(sel.pageviews) : "—"}</dd>
                <dt>Udział</dt>
                <dd>{sel.visitors > 0 ? `${pf.format(sel.share)}%` : "—"}</dd>
                <dt>Pierwszy raz</dt>
                <dd>{sel.firstLabel ?? "nieznany"}{sel.isNew ? <span className="badge info wm-new">nowy</span> : null}</dd>
              </dl>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>Odznacz</button>
            </>
          ) : selected ? (
            <p className="muted">{nameOf(selected)}: ani w tym okresie, ani wcześniej nie było stąd odwiedzających.</p>
          ) : (
            <p className="muted">Kliknij kraj na mapie (albo wybierz go strzałkami i Enter), żeby zobaczyć szczegóły.</p>
          )}
          {unknownVisitors > 0 ? <p className="wm-unknown">Nieznany kraj (VPN, Tor): {nf.format(unknownVisitors)} odwiedzających, poza mapą.</p> : null}
        </aside>
      </div>

      <ul className="wm-legend" aria-label="Legenda mapy">
        {mode === "period" ? (
          <>
            {classes.map((c) => (
              <li key={c.cls}><span className={`wm-key wm-c${c.cls}`} aria-hidden="true" />{c.label}</li>
            ))}
            <li><span className="wm-key wm-c0" aria-hidden="true" />brak odwiedzających</li>
          </>
        ) : (
          <>
            <li><span className="wm-key wm-key-on" aria-hidden="true" />odkryty wcześniej</li>
            <li><span className="wm-key wm-key-fresh" aria-hidden="true" />nowy tego dnia</li>
            <li><span className="wm-key wm-c0" aria-hidden="true" />jeszcze nie</li>
          </>
        )}
      </ul>
    </div>
  );
}

function TipBody({ c, code, mode }: { c: MapCountry | null; code: string; mode: "period" | "conquest" }) {
  const name = c?.name ?? nameOf(code);
  return (
    <>
      <div className="tip-title">{name}</div>
      {mode === "period" ? (
        c && c.visitors > 0 ? (
          <>
            <div className="tip-row"><strong>{nf.format(c.visitors)}</strong><span>odwiedzających · {pf.format(c.share)}%</span></div>
            <div className="tip-row"><strong>{nf.format(c.pageviews)}</strong><span>odsłon</span></div>
          </>
        ) : (
          <div className="tip-row"><span>brak odwiedzających w okresie</span></div>
        )
      ) : null}
      {c?.firstLabel ? <div className="tip-row"><span>pierwszy raz: {c.firstLabel}</span></div> : mode === "conquest" ? <div className="tip-row"><span>jeszcze nieodkryty</span></div> : null}
    </>
  );
}

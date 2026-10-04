/**
 * Building blocks of the panel (DESIGN-SYSTEM.md section 3), server-renderable and without inline styles.
 * State is always icon + word, never colour alone; every measured value can carry its age.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { deltaOf, fmtDateTime, fmtTime, isStale, STATE_WORD, type StateKind } from "@/lib/modules/admin-overview";
import { Icon, type IconName } from "./icons";

const STATE_ICON: Record<StateKind, IconName> = { ok: "ok", warn: "warn", crit: "crit", info: "info" };

export function Badge({ kind, children, icon }: { kind?: StateKind | "outline" | ""; children: ReactNode; icon?: IconName | false }) {
  const iconName = icon === false ? null : icon ?? (kind && kind !== "outline" ? STATE_ICON[kind] : null);
  return (
    <span className={`badge ${kind ?? ""}`}>
      {iconName ? <Icon name={iconName} /> : null}
      {children}
    </span>
  );
}

export function State({ kind, children }: { kind: StateKind; children?: ReactNode }) {
  return (
    <span className={`state ${kind}`}>
      <Icon name={STATE_ICON[kind]} />
      <span>{children ?? STATE_WORD[kind]}</span>
    </span>
  );
}

/** "dane z 14:32" or, when older than 2x the interval, "nieaktualne · dane z 13:05" (DESIGN-SYSTEM.md 3). */
export function Age({ at, everyMin, source, now }: { at: string | null; everyMin: number; source?: string; now: Date }) {
  if (!at) {
    return (
      <span className="age stale" title={source ? `Źródło: ${source}.` : undefined}>
        <Icon name="warn" />
        brak pomiaru
      </span>
    );
  }
  const stale = isStale(at, everyMin, now);
  const old = now.getTime() - new Date(at).getTime() > 86_400_000;
  const when = old ? fmtDateTime(at, now) : fmtTime(at);
  const title = `${source ? `Źródło: ${source}. ` : ""}Pomiar ${fmtDateTime(at, now)}, odświeżane co ${everyMin} min.`;
  return stale ? (
    <span className="age stale" title={title}>
      <Icon name="warn" />
      nieaktualne · dane z {when}
    </span>
  ) : (
    <span className="age" title={title}>
      <Icon name="clock" />
      dane z {when}
    </span>
  );
}

export function Card({
  id,
  title,
  meta,
  sub,
  foot,
  flush,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  sub?: ReactNode;
  foot?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`card${flush ? " card-flush" : ""}`} aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>{title}</h2>
        {meta}
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {children}
      {foot ? <div className="card-foot">{foot}</div> : null}
    </section>
  );
}

export function PageHead({ title, lede, actions, crumbs }: { title: string; lede?: ReactNode; actions?: ReactNode; crumbs?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {crumbs ? <div className="crumbs">{crumbs}</div> : null}
        <h1 tabIndex={-1} id="page-title">
          {title}
        </h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

/** Decorative trend next to a number (aria-hidden); never the only carrier of information. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - ((v - min) / span) * 22] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="spark-line" d={d} />
      <path className="spark-dot" d={`M${lx.toFixed(2)},${ly.toFixed(2)}h0`} />
    </svg>
  );
}

export function Delta({ current, previous, upIsGood, context }: { current: number; previous: number | null; upIsGood: boolean; context: string }) {
  const d = deltaOf(current, previous, upIsGood);
  if (!d) {
    if (previous === null) return <span className="delta-ctx">bez porównania</span>;
    // Previous period was 0: a percentage would be meaningless, so say it in words.
    return <span className="delta-ctx">{current === 0 ? `bez zmian, ${context}` : `${context}: było 0`}</span>;
  }
  return (
    <>
      <span className={`delta ${d.tone}`}>
        <Icon name={d.direction === "flat" ? "flat" : d.direction} />
        <span aria-hidden="true">{d.text}</span>
        <span className="sr-only">{d.spoken}</span>
      </span>{" "}
      <span className="delta-ctx">{context}</span>
    </>
  );
}

export function Tile({
  label,
  value,
  unit,
  hint,
  href,
  delta,
  spark,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  href?: string;
  delta?: ReactNode;
  spark?: number[];
}) {
  const body = (
    <>
      <span className="tile-label">
        {label}
        {hint ? (
          <span className="muted" title={hint}>
            <Icon name="info" />
            <span className="sr-only">{hint}</span>
          </span>
        ) : null}
      </span>
      <span className="tile-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      <span className="tile-meta">{delta}</span>
      {spark ? <Spark values={spark} /> : null}
    </>
  );
  return href ? (
    <Link className="tile" href={href}>
      {body}
    </Link>
  ) : (
    <div className="tile">{body}</div>
  );
}

const pctClass = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Limit meter: role="meter" with a spoken value; colour of the fill follows the thresholds. */
export function Meter({ percent, label, valueText, warnAt, critAt }: { percent: number; label: string; valueText: string; warnAt: number; critAt: number }) {
  const state = percent >= critAt ? "crit" : percent >= warnAt ? "warn" : "ok";
  return (
    <div
      className={`meter meter-${state}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-label={label}
      aria-valuetext={valueText}
    >
      <div className={`meter-fill pw-${pctClass(percent)}`} />
      <div className={`meter-threshold pl-${pctClass(warnAt)}`} aria-hidden="true" />
    </div>
  );
}

export function Check({ kind, title, sub, link }: { kind: StateKind; title: ReactNode; sub?: ReactNode; link?: ReactNode }) {
  return (
    <div className={`check ${kind}`}>
      <Icon name={STATE_ICON[kind]} />
      <div>
        <div>{title}</div>
        {sub ? <div className="check-sub">{sub}</div> : null}
      </div>
      <span>
        <span className="sr-only">{STATE_WORD[kind]}</span>
        {link}
      </span>
    </div>
  );
}

export function Empty({ icon = "ok", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Icon name="external" />
      <span className="sr-only"> (otwiera stary panel w nowej karcie)</span>
    </a>
  );
}

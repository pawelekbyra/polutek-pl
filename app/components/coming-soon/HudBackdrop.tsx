"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LOOP_SECONDS, engineAt } from "./cockpit-timeline";
import { activeProgress, cuesOf, lastIndex, sinceLast, useClockValue, type CockpitClock } from "./useCockpitClock";
import styles from "./HudBackdrop.module.css";
import type { Tx } from "@/lib/i18n/ui";

/*
 * The pilot's computer behind the premiere readout. The composition is a flight
 * whose destination is the premiere: the wings report the trip (trajectory and
 * systems on the left, radar and telemetry on the right), the top tape holds the
 * heading, the bottom bar syncs the course, and circuit traces carry data from the
 * instruments to a targeting reticle that locks onto the title once per loop.
 *
 * Every event is driven by the cockpit clock (the audio loop's position), so each
 * beep, scan, keystroke and data burst in the sound has its own motion here. Kept
 * dim, thin and additive — the readout in the centre is the only bright element.
 * Laid out on a 1600×900 grid (the player's 16:9).
 */

const W = 1600;
const H = 900;

/** Hero box the reticle locks onto: date + title + countdown. */
const HERO = { x: 380, y: 212, w: 840, h: 476 };

/**
 * Mission clock for the trajectory: departure → premiere. Departure is this fixed
 * date, or one day before the premiere when a premiere is scheduled earlier than it.
 */
const MISSION_START = Date.UTC(2026, 8, 1);
const MIN_MISSION_MS = 86_400_000;
const MISSION_KM = 54.6e6;

function buildCopy(tx: Tx) {
  return {
    trajectory: tx("TRAJEKTORIA", "TRAJECTORY"),
    dist: tx("DYST.", "DIST."),
    mkm: tx("mln km", "M km"),
    origin: tx("ZIEMIA", "EARTH"),
    target: tx("PREMIERA", "PREMIERE"),
    systems: tx("SYSTEMY", "SYSTEMS"),
    sys: [
      tx("NAPĘD", "DRIVE"),
      tx("ZASILANIE", "POWER"),
      tx("ŁĄCZNOŚĆ", "COMMS"),
      tx("OSŁONY", "SHIELDS"),
      tx("NAWIGACJA", "NAVIGATION"),
    ],
    test: tx("TEST", "TEST"),
    radar: tx("RADAR", "RADAR"),
    range: tx("ZASIĘG 40 000 km", "RANGE 40 000 km"),
    telemetry: tx("TELEMETRIA", "TELEMETRY"),
    speed: tx("PRĘDKOŚĆ", "VELOCITY"),
    thrust: tx("CIĄG", "THRUST"),
    fuel: tx("PALIWO", "FUEL"),
    core: tx("TEMP. RDZENIA", "CORE TEMP"),
    engine: tx("SILNIK", "ENGINE"),
    sync: tx("SYNCHRONIZACJA KURSU", "COURSE SYNC"),
    lock: tx("CEL NAMIERZONY", "TARGET LOCKED"),
    heading: tx("KURS", "HDG"),
  };
}

type Copy = ReturnType<typeof buildCopy>;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Frame callback bound to the cockpit clock; the callback may change between renders. */
function useFrame(clock: CockpitClock, cb: (phase: number) => void) {
  const ref = useRef(cb);
  // eslint-disable-next-line react-hooks/refs -- intentional render-time ref sync for the cockpit clock/audio timeline; an effect would desync picture and sound (CLAUDE.md coming-soon entry)
  ref.current = cb;
  useEffect(() => {
    const off = clock.onFrame((p) => ref.current(p));
    return () => off();
  }, [clock]);
}

function Header({ x, y, title, right }: { x: number; y: number; title: string; right?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text className={styles.head}>{title}</text>
      <path d="M0 8 H300" className={styles.rule} />
      <path d="M0 8 H26" className={styles.ruleBright} />
      {right ? (
        <text x={300} textAnchor="end" className={styles.small}>
          {right}
        </text>
      ) : null}
    </g>
  );
}

/* ---------- mission progress (real time) ---------- */

// Real time only after mount (SSR and hydration render the departure state); the
// panels are still powering on at that point, so the ship's jump to its position is unseen.
function useMission(premiereAt: Date) {
  const [now, setNow] = useState<number | null>(null);
  const end = premiereAt.getTime();
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    if (now === null) return { p: 0, kmLeft: MISSION_KM, kms: 0 };
    const start = Math.min(MISSION_START, end - MIN_MISSION_MS);
    const p = clamp01((now - start) / (end - start));
    const kmLeft = MISSION_KM * (1 - p);
    const secLeft = Math.max(1, (end - now) / 1000);
    return { p, kmLeft, kms: kmLeft / secLeft };
  }, [now, end]);
}

/* ---------- heading tape (top) ---------- */

function HeadingTape({ clock, copy, clipId }: { clock: CockpitClock; copy: Copy; clipId: string }) {
  const tapeRef = useRef<SVGGElement>(null);
  const readRef = useRef<SVGTextElement>(null);
  const PX_PER_DEG = 3.2;
  const ticks = useMemo(() => {
    const out: { x: number; major: boolean; label?: string }[] = [];
    for (let d = 180; d <= 360; d += 5) out.push({ x: d * PX_PER_DEG, major: d % 30 === 0, label: d % 30 === 0 ? String(d).padStart(3, "0") : undefined });
    return out;
  }, []);
  useFrame(clock, (p) => {
    const thrust = activeProgress("thrust", p);
    const hdg = 270 + 5 * Math.sin((p / LOOP_SECONDS) * Math.PI * 2) + (thrust >= 0 ? 1.2 * Math.sin(thrust * Math.PI) : 0);
    tapeRef.current?.setAttribute("transform", `translate(${(800 - hdg * PX_PER_DEG).toFixed(1)} 0)`);
    if (readRef.current) readRef.current.textContent = hdg.toFixed(1).padStart(5, "0");
  });
  return (
    <g className={styles.boot} style={{ "--boot": "0.2s" } as React.CSSProperties}>
      <clipPath id={clipId}>
        <rect x={600} y={30} width={400} height={50} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g ref={tapeRef}>
          {ticks.map(({ x, major, label }) => (
            <g key={x}>
              <line x1={x} y1={major ? 52 : 58} x2={x} y2={66} className={major ? styles.tickMajor : styles.tick} />
              {label ? (
                <text x={x} y={46} textAnchor="middle" className={styles.small}>
                  {label}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      </g>
      <path d="M600 66 H1000" className={styles.rule} />
      <path d="M800 70 L794 80 H806 Z" className={styles.caret} />
      <text x={818} y={80} className={styles.small}>
        {copy.heading}{" "}
        <tspan ref={readRef} className={styles.value}>
          270.0
        </tspan>
      </text>
    </g>
  );
}

/* ---------- trajectory (top left) ---------- */

const ORIGIN = { x: 26, y: 156 };
const CTRL = { x: 70, y: 18 };
const DEST = { x: 272, y: 52 };
const bez = (t: number) => ({
  x: (1 - t) ** 2 * ORIGIN.x + 2 * (1 - t) * t * CTRL.x + t ** 2 * DEST.x,
  y: (1 - t) ** 2 * ORIGIN.y + 2 * (1 - t) * t * CTRL.y + t ** 2 * DEST.y,
});
const bezAngle = (t: number) => {
  const dx = 2 * (1 - t) * (CTRL.x - ORIGIN.x) + 2 * t * (DEST.x - CTRL.x);
  const dy = 2 * (1 - t) * (CTRL.y - ORIGIN.y) + 2 * t * (DEST.y - CTRL.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

function Trajectory({ clock, copy, mission }: { clock: CockpitClock; copy: Copy; mission: ReturnType<typeof useMission> }) {
  const scanRef = useRef<SVGRectElement>(null);
  const targetRef = useRef<SVGGElement>(null);
  const arcPath = `M${ORIGIN.x} ${ORIGIN.y} Q${CTRL.x} ${CTRL.y} ${DEST.x} ${DEST.y}`;
  const ship = bez(mission.p);
  useFrame(clock, (p) => {
    const scan = activeProgress("scan", p);
    if (scanRef.current) {
      scanRef.current.setAttribute("x", (scan * 298).toFixed(1));
      scanRef.current.style.opacity = scan >= 0 ? String(0.9 * Math.sin(scan * Math.PI) + 0.1) : "0";
    }
    const lock = sinceLast("lock", p);
    if (targetRef.current) targetRef.current.style.opacity = lock < 3 ? String(1 - 0.6 * clamp01(lock / 3)) : "0.4";
  });
  return (
    <g transform="translate(56 100)" className={`${styles.detail} ${styles.boot}`} style={{ "--boot": "0.5s" } as React.CSSProperties}>
      <Header x={0} y={0} title={copy.trajectory} right={`${copy.dist} ${(mission.kmLeft / 1e6).toFixed(1)} ${copy.mkm}`} />
      <g transform="translate(0 22)">
        <rect width={300} height={170} className={styles.panel} />
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={i * 50} y1={0} x2={i * 50} y2={170} className={styles.grid} />
        ))}
        {[1, 2, 3].map((i) => (
          <line key={i} x1={0} y1={i * 42.5} x2={300} y2={i * 42.5} className={styles.grid} />
        ))}
        <path d={arcPath} className={styles.arcAhead} />
        <path d={arcPath} pathLength={100} className={styles.arcDone} style={{ strokeDasharray: `${(mission.p * 100).toFixed(2)} 100` }} />
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r={9} className={styles.planetOutline} />
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r={3} className={styles.dotFill} />
        <text x={ORIGIN.x + 16} y={ORIGIN.y + 4} className={styles.small}>{copy.origin}</text>
        <g ref={targetRef} transform={`translate(${DEST.x} ${DEST.y})`}>
          <path d="M0 -8 L8 0 L0 8 L-8 0 Z" className={styles.amberStroke} />
          <circle r={2.4} className={styles.amberFill} />
        </g>
        <text x={DEST.x} y={DEST.y + 24} textAnchor="middle" className={`${styles.small} ${styles.amberText}`}>{copy.target}</text>
        <g transform={`translate(${ship.x.toFixed(1)} ${ship.y.toFixed(1)}) rotate(${bezAngle(mission.p).toFixed(1)})`}>
          <path d="M7 0 L-5 -4.5 L-3 0 L-5 4.5 Z" className={styles.ship} />
          <circle r={11} className={styles.shipHalo} />
        </g>
        <rect ref={scanRef} x={0} y={0} width={2} height={170} className={styles.scanLine} style={{ opacity: 0 }} />
      </g>
    </g>
  );
}

/* ---------- systems (middle left) ---------- */

function Systems({ clock, copy }: { clock: CockpitClock; copy: Copy }) {
  const state = useClockValue(clock, (p) => {
    const beep = lastIndex("beep", p);
    const checking = p < 2.6 && beep >= 0 ? beep % 5 : -1;
    const flash = sinceLast("beep", p) < 0.16;
    const uplink = activeProgress("uplink", p) >= 0;
    const thrust = activeProgress("thrust", p) >= 0;
    const glitch = activeProgress("glitch", p) >= 0;
    return `${beep}|${checking}|${flash ? 1 : 0}|${uplink ? 1 : 0}|${thrust ? 1 : 0}|${glitch ? 1 : 0}`;
  });
  const [beepS, checkingS, flashS, uplinkS, thrustS, glitchS] = state.split("|");
  const beep = Number(beepS);
  const checking = Number(checkingS);
  const inCheck = beep < 9;
  return (
    <g transform="translate(56 346)" className={`${styles.detail} ${styles.boot}`} style={{ "--boot": "0.8s" } as React.CSSProperties}>
      <g className={glitchS === "1" ? styles.glitch : undefined}>
      <Header x={0} y={0} title={copy.systems} right={inCheck ? "DIAG…" : "5/5 OK"} />
      {copy.sys.map((name, i) => {
        const y = 42 + i * 30;
        const tested = beep >= i;
        const lit = checking === i && flashS === "1";
        const tx = i === 2 && uplinkS === "1";
        const burn = i === 0 && thrustS === "1";
        const status = burn ? "BURN" : tx ? "TX" : tested ? "OK" : copy.test;
        return (
          <g key={name} transform={`translate(0 ${y})`}>
            <circle cx={6} cy={-4} r={4.2} className={lit || tx || burn ? styles.lightOn : tested ? styles.lightOk : styles.lightOff} />
            <text x={20} className={styles.label}>{name}</text>
            <line x1={132} y1={-4} x2={250} y2={-4} className={styles.leaderDots} />
            <text x={300} textAnchor="end" className={`${styles.label} ${burn || tx ? styles.amberText : styles.value}`}>{status}</text>
          </g>
        );
      })}
      </g>
    </g>
  );
}

/* ---------- radar (top right) ---------- */

const CONTACT_POS = cuesOf("contact").map((_, i) => {
  const r = rng(i * 97 + 11);
  const a = r() * Math.PI * 2;
  const d = 20 + r() * 46;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
});

function Radar({ clock, copy }: { clock: CockpitClock; copy: Copy }) {
  const sweepRef = useRef<SVGGElement>(null);
  const pingRef = useRef<SVGCircleElement>(null);
  const contactRefs = useRef<(SVGCircleElement | null)[]>([]);
  const contacts = cuesOf("contact");
  const scanCue = cuesOf("scan")[0];
  useFrame(clock, (p) => {
    // Idle 1 rev / 4 s; the scan adds three extra turns, so the angle stays continuous.
    const scan = scanCue ? clamp01((p - scanCue.t) / scanCue.dur) : 0;
    const angle = (p / 4) * 360 + scan * 1080;
    sweepRef.current?.setAttribute("transform", `rotate(${(angle % 360).toFixed(1)})`);
    contacts.forEach((c, i) => {
      const el = contactRefs.current[i];
      if (!el) return;
      const age = p - c.t;
      el.style.opacity = age >= 0 && age < c.dur ? String((1 - age / c.dur) ** 1.5) : "0";
    });
    const ping = activeProgress("ping", p);
    if (pingRef.current) {
      pingRef.current.setAttribute("r", ping >= 0 ? (easeOut(ping) * 72).toFixed(1) : "0");
      pingRef.current.style.opacity = ping >= 0 ? String(1 - ping) : "0";
    }
  });
  return (
    <g transform="translate(1244 100)" className={`${styles.detail} ${styles.boot}`} style={{ "--boot": "0.65s" } as React.CSSProperties}>
      <Header x={0} y={0} title={copy.radar} right={copy.range} />
      <g transform="translate(150 112)">
        <circle r={72} className={styles.ring} />
        <circle r={48} className={styles.ringFaint} />
        <circle r={24} className={styles.ringFaint} />
        <path d="M-80 0 H80 M0 -80 V80" className={styles.grid} />
        <g ref={sweepRef}>
          <path d="M0 0 L0 -72 A72 72 0 0 1 36 -62.4 Z" className={styles.sweep} />
          <path d="M0 0 V-72" className={styles.sweepEdge} />
        </g>
        {contacts.map((c, i) => (
          <circle
            key={c.t}
            ref={(el) => {
              contactRefs.current[i] = el;
            }}
            cx={CONTACT_POS[i].x}
            cy={CONTACT_POS[i].y}
            r={3.4}
            className={styles.contact}
            style={{ opacity: 0 }}
          />
        ))}
        <circle ref={pingRef} r={0} className={styles.ping} style={{ opacity: 0 }} />
        <circle r={3} className={styles.dotFill} />
      </g>
    </g>
  );
}

/* ---------- telemetry (middle right) ---------- */

function Telemetry({ clock, copy, mission }: { clock: CockpitClock; copy: Copy; mission: ReturnType<typeof useMission> }) {
  const sparkRef = useRef<SVGPolylineElement>(null);
  const thrustBarRef = useRef<SVGRectElement>(null);
  const view = useClockValue(clock, (p) => {
    const proc = activeProgress("process", p);
    const scramble = proc >= 0 ? Math.floor(p * 16) : -1;
    const thrust = activeProgress("thrust", p);
    const thrustPct = Math.round(72 + (thrust >= 0 ? 22 * Math.sin(thrust * Math.PI) : 0));
    const ok = sinceLast("confirm", p) < 1.1;
    const core = Math.round(1142 + engineAt(p) * 9);
    return `${scramble}|${thrustPct}|${ok ? 1 : 0}|${core}`;
  });
  const [scrambleS, thrustS, okS, coreS] = view.split("|");
  const scramble = Number(scrambleS);
  const noisy = (text: string, salt: number) => {
    if (scramble < 0) return text;
    const r = rng(scramble * 31 + salt);
    return text.replace(/\d/g, () => String(Math.floor(r() * 10)));
  };
  useFrame(clock, (p) => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = p - 6 + i * 0.1;
      const v = engineAt(((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS);
      pts.push(`${(i * 5).toFixed(0)},${(26 - v * 22).toFixed(1)}`);
    }
    sparkRef.current?.setAttribute("points", pts.join(" "));
    const thrust = activeProgress("thrust", p);
    const pct = 0.72 + (thrust >= 0 ? 0.22 * Math.sin(thrust * Math.PI) : 0);
    thrustBarRef.current?.setAttribute("width", (pct * 150).toFixed(1));
  });
  const rows = [
    { k: copy.speed, v: noisy(`${mission.kms.toFixed(2)} km/s`, 1) },
    { k: copy.core, v: noisy(`${coreS} K`, 2) },
    { k: copy.fuel, v: noisy("64 %", 3) },
  ];
  return (
    <g transform="translate(1244 346)" className={`${styles.detail} ${styles.boot}`} style={{ "--boot": "0.95s" } as React.CSSProperties}>
      <Header x={0} y={0} title={copy.telemetry} right={okS === "1" ? "✓ OK" : undefined} />
      {rows.map(({ k, v }, i) => (
        <g key={k} transform={`translate(0 ${42 + i * 26})`}>
          <text className={styles.label}>{k}</text>
          <text x={300} textAnchor="end" className={`${styles.label} ${styles.value}`}>{v}</text>
        </g>
      ))}
      <g transform="translate(0 120)">
        <text className={styles.label}>{copy.thrust}</text>
        <rect x={110} y={-9} width={150} height={7} className={styles.barTrack} />
        <rect ref={thrustBarRef} x={110} y={-9} width={108} height={7} className={styles.barFill} />
        <text x={300} textAnchor="end" className={`${styles.label} ${styles.value}`}>{noisy(`${thrustS} %`, 4)}</text>
      </g>
      <g transform="translate(0 140)">
        <text y={10} className={styles.small}>{copy.engine}</text>
        <rect x={60} y={-4} width={240} height={32} className={styles.panel} />
        <g transform="translate(60 0)">
          <polyline ref={sparkRef} points="" className={styles.spark} transform="scale(0.8 1)" />
        </g>
      </g>
    </g>
  );
}

/* ---------- course sync (bottom centre) ---------- */

function CourseSync({ clock, copy }: { clock: CockpitClock; copy: Copy }) {
  const lit = useClockValue(clock, (p) => (p < 34 ? lastIndex("sync", p) + 1 : p < 36 ? -1 : 0));
  const fading = lit === -1;
  const count = fading ? 6 : lit;
  return (
    <g transform="translate(652 772)" className={styles.boot} style={{ "--boot": "1.1s" } as React.CSSProperties}>
      <g className={fading ? styles.fadeOut : styles.fadeIn}>
      <text x={0} y={-10} className={styles.small}>{copy.sync}</text>
      <text x={296} y={-10} textAnchor="end" className={`${styles.small} ${styles.value}`}>{count}/6</text>
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={i * 50} y={0} width={46} height={7} className={i < count ? styles.segOn : styles.segOff} />
      ))}
      </g>
    </g>
  );
}

/* ---------- data traces into the reticle ---------- */

const TRACES = {
  traj: "M356 206 H380 V246",
  sys: "M356 440 H380 V654",
  radar: "M1244 206 H1220 V246",
  telem: "M1244 440 H1220 V654",
  sync: "M800 758 V700",
  heading: "M800 84 V200",
};
type TraceKey = keyof typeof TRACES;
const PACKET_ROUTE: TraceKey[] = ["traj", "radar", "sys", "telem", "sync"];

function Traces({ clock }: { clock: CockpitClock }) {
  const refs = useRef<Partial<Record<TraceKey, SVGPathElement | null>>>({});
  const packets = cuesOf("packet");
  const ticks = cuesOf("tick");
  useFrame(clock, (p) => {
    const level: Partial<Record<TraceKey, number>> = {};
    packets.forEach((c, i) => {
      const k = (p - c.t) / c.dur;
      if (k >= 0 && k < 1) level[PACKET_ROUTE[i % PACKET_ROUTE.length]] = k;
    });
    ticks.forEach((c, i) => {
      const k = (p - c.t) / 0.45;
      if (k >= 0 && k < 1) level[i % 2 ? "telem" : "radar"] = k;
    });
    const lock = (p - (cuesOf("lock")[0]?.t ?? -99)) / 0.7;
    if (lock >= 0 && lock < 1) (Object.keys(TRACES) as TraceKey[]).forEach((k) => (level[k] = lock));
    (Object.keys(TRACES) as TraceKey[]).forEach((k) => {
      const el = refs.current[k];
      if (!el) return;
      const v = level[k];
      if (v === undefined) {
        el.style.opacity = "0";
        return;
      }
      el.style.opacity = String(Math.sin(v * Math.PI) * 0.95 + 0.05);
      el.style.strokeDashoffset = (100 - v * 112).toFixed(1);
    });
  });
  return (
    <g className={styles.boot} style={{ "--boot": "0.35s" } as React.CSSProperties}>
      {(Object.keys(TRACES) as TraceKey[]).map((k) => (
        <g key={k} className={k === "sync" || k === "heading" ? undefined : styles.detail}>
          <path d={TRACES[k]} className={styles.trace} />
          <path
            d={TRACES[k]}
            pathLength={100}
            ref={(el) => {
              refs.current[k] = el;
            }}
            className={styles.pulse}
            style={{ opacity: 0 }}
          />
        </g>
      ))}
    </g>
  );
}

/* ---------- targeting reticle around the hero ---------- */

function Reticle({ clock, copy }: { clock: CockpitClock; copy: Copy }) {
  const groupRef = useRef<SVGGElement>(null);
  const cornerRefs = useRef<(SVGPathElement | null)[]>([]);
  const labelRef = useRef<SVGGElement>(null);
  const scanCue = cuesOf("scan")[0];
  const lockCue = cuesOf("lock")[0];
  useFrame(clock, (p) => {
    let spread = 44 + 6 * Math.sin((p / 6) * Math.PI * 2);
    let jx = 0;
    let jy = 0;
    let alpha = 0.32;
    if (scanCue && p >= scanCue.t && p < scanCue.t + scanCue.dur) {
      // Hunting: the reticle searches, tightening as the scan converges on the target.
      const k = (p - scanCue.t) / scanCue.dur;
      const n = Math.sin(p * 7.1) * Math.sin(p * 3.3 + 1);
      spread = (1 - k) * 60 + 10 + 16 * Math.abs(n) * (1 - k);
      jx = 14 * Math.sin(p * 5.3) * (1 - k);
      jy = 9 * Math.sin(p * 4.1 + 2) * (1 - k);
      alpha = 0.5 + 0.25 * Math.abs(Math.sin(p * 22));
    } else if (lockCue && p >= lockCue.t) {
      const a = p - lockCue.t;
      if (a < 0.22) spread = 10 * (1 - easeOut(a / 0.22));
      else if (a < lockCue.dur) spread = 0;
      else spread = 44 * easeOut((a - lockCue.dur) / 1.6);
      alpha = a < 0.12 ? 1 : a < lockCue.dur ? 1 - 0.45 * clamp01((a - 0.12) / 1.2) : 0.55 - 0.23 * clamp01((a - lockCue.dur) / 1.6);
    }
    groupRef.current?.setAttribute("transform", `translate(${jx.toFixed(1)} ${jy.toFixed(1)})`);
    groupRef.current?.style.setProperty("opacity", alpha.toFixed(2));
    const s = spread;
    const corners = [
      [HERO.x - s, HERO.y - s, 1, 1],
      [HERO.x + HERO.w + s, HERO.y - s, -1, 1],
      [HERO.x - s, HERO.y + HERO.h + s, 1, -1],
      [HERO.x + HERO.w + s, HERO.y + HERO.h + s, -1, -1],
    ];
    corners.forEach(([x, y, dx, dy], i) => {
      cornerRefs.current[i]?.setAttribute("d", `M${x} ${y + 46 * dy} V${y} H${x + 46 * dx}`);
    });
    if (labelRef.current) {
      const a = lockCue ? p - lockCue.t : -1;
      labelRef.current.style.opacity = a >= 0.1 && a < lockCue.dur + 0.4 ? (Math.floor(a * 6) % 2 === 0 || a > 0.8 ? "1" : "0.25") : "0";
    }
  });
  return (
    <g>
      <g ref={groupRef} style={{ opacity: 0.32 }}>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            ref={(el) => {
              cornerRefs.current[i] = el;
            }}
            className={styles.bracket}
          />
        ))}
      </g>
      <g ref={labelRef} style={{ opacity: 0 }} transform={`translate(${HERO.x} ${HERO.y - 14})`}>
        <rect x={0} y={-15} width={170} height={20} className={styles.lockTag} />
        <text x={8} y={0} className={`${styles.small} ${styles.lockText}`}>{copy.lock}</text>
      </g>
    </g>
  );
}

/* ---------- far plane ---------- */

function FarPlane({ dotsId }: { dotsId: string }) {
  const ticks = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => {
        const a = ((i * 3 - 90) * Math.PI) / 180;
        const r1 = i % 5 === 0 ? 404 : 412;
        return `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)} L${(Math.cos(a) * 420).toFixed(1)} ${(Math.sin(a) * 420).toFixed(1)}`;
      }).join(""),
    [],
  );
  return (
    <>
      <defs>
        <pattern id={dotsId} width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className={styles.dot} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${dotsId})`} />
      <g transform={`translate(${W / 2} ${HERO.y + HERO.h / 2})`}>
        <g className={styles.spin}>
          <path d={ticks} className={styles.farLine} />
        </g>
      </g>
    </>
  );
}

export function HudBackdrop({
  clock,
  tx,
  running,
  premiereAt,
}: {
  clock: CockpitClock;
  tx: Tx;
  running: boolean;
  /** End of the trajectory: this video's premiere. */
  premiereAt: Date;
}) {
  const uid = useId().replace(/:/g, "");
  const copy = useMemo(() => buildCopy(tx), [tx]);
  const mission = useMission(premiereAt);
  return (
    <div className={`${styles.backdrop} ${running ? "" : styles.paused}`} aria-hidden="true">
      <svg className={`${styles.plane} ${styles.far}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <FarPlane dotsId={`dots-${uid}`} />
      </svg>
      <svg className={`${styles.plane} ${styles.mid}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Traces clock={clock} />
        <HeadingTape clock={clock} copy={copy} clipId={`tape-${uid}`} />
        <Trajectory clock={clock} copy={copy} mission={mission} />
        <Systems clock={clock} copy={copy} />
        <Radar clock={clock} copy={copy} />
        <Telemetry clock={clock} copy={copy} mission={mission} />
        <CourseSync clock={clock} copy={copy} />
        <Reticle clock={clock} copy={copy} />
      </svg>
    </div>
  );
}

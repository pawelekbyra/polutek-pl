"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./HudBackdrop.module.css";

/*
 * Onboard-computer screen behind the premiere readout: circuit traces with data
 * pulses, a star-map scanner, an orbital navigation plot, two terminal panels with
 * live data streams, and live status readouts. One SVG scene laid out on a
 * 1600×900 grid (the player's 16:9), leaving the centre clear for date, title and
 * countdown. Purely decorative (aria-hidden); deterministic on first render so SSR
 * and hydration agree.
 */

const W = 1600;
const H = 900;

const COPY = {
  pl: {
    scan: "SKAN SEKTORA",
    terminal: "STATUS TERMINALA",
    drive: "NAPĘD MIĘDZYGWIEZDNY",
    sector: "SEKTOR",
    coreTemp: "TEMP. RDZENIA",
    optimal: "OPTYMALNA",
    integrity: "INTEGRALNOŚĆ DANYCH",
    cooling: "Chłodzenie: stabilne",
    nav: "System nawigacji",
    ready: "System gotowy",
    status: "Status: gotowy",
    fuel: "Kompresja paliwa",
    signal: "SYGNAŁ",
  },
  en: {
    scan: "SECTOR SCAN",
    terminal: "TERMINAL STATUS",
    drive: "INTERSTELLAR DRIVE",
    sector: "SECTOR",
    coreTemp: "CORE TEMP",
    optimal: "OPTIMAL",
    integrity: "DATA INTEGRITY",
    cooling: "Cooling: stable",
    nav: "Navigation system",
    ready: "System ready",
    status: "Status: ready",
    fuel: "Fuel compression",
    signal: "SIGNAL",
  },
};

type Copy = (typeof COPY)["pl"];

function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const bits = (seed: number, groups: number) => {
  const r = rng(seed);
  return Array.from({ length: groups }, () => Array.from({ length: 4 }, () => (r() < 0.5 ? "0" : "1")).join("")).join(" ");
};

const hex = (seed: number, groups: number) => {
  const r = rng(seed);
  return Array.from({ length: groups }, () => Math.floor(r() * 256).toString(16).toUpperCase().padStart(2, "0")).join(" ");
};

function useTick(ms: number, running: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms, running]);
  return tick;
}

const ellipsePath = (rx: number, ry: number) => `M ${-rx} 0 A ${rx} ${ry} 0 1 0 ${rx} 0 A ${rx} ${ry} 0 1 0 ${-rx} 0`;

/* Corner brackets around a panel, drawn in local coordinates. */
function Brackets({ w, h, s = 14 }: { w: number; h: number; s?: number }) {
  return (
    <path
      className={styles.lineBright}
      d={`M0 ${s} V0 H${s} M${w - s} 0 H${w} V${s} M${w} ${h - s} V${h} H${w - s} M${s} ${h} H0 V${h - s}`}
    />
  );
}

/* Circuit traces: right-angled PCB runs in the gutters, each with a travelling data pulse. */
const TRACES: { d: string; dur: number; delay: number }[] = [
  { d: "M40 308 H300 L316 324 H402", dur: 4.2, delay: 0 },
  { d: "M452 118 H530 L548 136 H690 V168", dur: 5.1, delay: 1.2 },
  { d: "M1150 76 H1060 L1042 94 H910 V168", dur: 4.6, delay: 0.6 },
  { d: "M1560 300 H1330 L1312 318 H1212", dur: 3.8, delay: 2 },
  { d: "M40 772 H250 L270 792 H560 V748", dur: 5.4, delay: 0.4 },
  { d: "M1560 780 H1360 L1340 800 H1040 V752", dur: 4.9, delay: 1.7 },
  { d: "M28 330 V600", dur: 3.4, delay: 0.9 },
  { d: "M1572 330 V640", dur: 3.9, delay: 2.4 },
  { d: "M392 590 H420 V712 H470", dur: 4.4, delay: 1.5 },
  { d: "M1198 580 H1170 V700 H1130", dur: 4.1, delay: 0.2 },
  { d: "M640 30 H760 L776 46 H824 L840 30 H960", dur: 6, delay: 0.8 },
];

const NODES: [number, number, boolean][] = [
  [402, 324, true], [690, 168, false], [910, 168, true], [1212, 318, false],
  [560, 748, true], [1040, 752, false], [470, 712, false], [1130, 700, true],
  [40, 308, false], [1560, 300, false], [40, 772, false], [1560, 780, false],
];

function Traces() {
  return (
    <g>
      <path className={styles.faint} d="M40 30 H620 M980 30 H1560" />
      {TRACES.map(({ d }, i) => (
        <path key={`t${i}`} className={styles.line} d={d} />
      ))}
      {TRACES.map(({ d, dur, delay }, i) => (
        <path
          key={`p${i}`}
          className={styles.pulse}
          d={d}
          pathLength={100}
          style={{ "--d": `${dur}s`, "--delay": `${-delay}s` } as React.CSSProperties}
        />
      ))}
      {NODES.map(([x, y, blink], i) => (
        <g key={`n${i}`}>
          <circle cx={x} cy={y} r={5.5} className={styles.nodeRing} />
          <circle cx={x} cy={y} r={2.4} className={`${styles.node} ${blink ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.37}s` }} />
        </g>
      ))}
    </g>
  );
}

function StarMap({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(250, running);
  const progress = (tick % 72) / 72;
  const stars = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 16 }, () => ({ x: 20 + r() * 330, y: 14 + r() * 150, s: 1.4 + r() * 2.2, d: r() * 3 })).sort((a, b) => a.x - b.x);
  }, []);
  const route = "M18 150 C 96 36, 206 172, 300 44 S 352 40, 356 24";

  return (
    <g transform="translate(70 58)" className={styles.detail}>
      <rect x={0} y={0} width={370} height={180} className={styles.panelBg} />
      <Brackets w={370} h={180} />
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`gx${i}`} x1={i * 37} y1={0} x2={i * 37} y2={180} className={styles.grid} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`gy${i}`} x1={0} y1={i * 45} x2={370} y2={i * 45} className={styles.grid} />
      ))}
      <polyline
        className={styles.constellation}
        points={stars.filter((_, i) => i % 3 !== 2).map((p) => `${p.x},${p.y}`).join(" ")}
      />
      {stars.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.s} className={`${styles.star} ${styles.twinkle}`} style={{ animationDelay: `${-p.d}s` }} />
      ))}
      <path d={route} className={styles.route} />
      <circle r={4} className={styles.ship}>
        <animateMotion dur="7s" repeatCount="indefinite" path={route} />
      </circle>
      <rect x={0} y={0} width={2} height={180} className={styles.scanLine}>
        <animate attributeName="x" values="0;368;0" dur="6s" repeatCount="indefinite" />
      </rect>

      <text x={0} y={206} className={`${styles.txt} ${styles.txtSmall}`}>{copy.scan}</text>
      <text x={370} y={206} textAnchor="end" className={`${styles.txt} ${styles.txtSmall} ${styles.cyan}`}>
        {Math.round(progress * 100)}%
      </text>
      <rect x={0} y={214} width={370} height={7} className={styles.progressTrack} />
      <rect x={0} y={214} width={370} height={7} className={styles.progressFill} style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
      {[0, 24, 48, 90, 114, 170, 194, 218].map((x, i) => (
        <rect key={i} x={x} y={234} width={18} height={9} className={`${styles.glyph} ${i % 3 === 0 ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.5}s` }} />
      ))}
    </g>
  );
}

function Orbits({ copy }: { copy: Copy }) {
  const labels: { t: string; x: number; y: number; to: [number, number] }[] = [
    { t: copy.nav, x: 1128, y: 74, to: [1318, 104] },
    { t: copy.ready, x: 1128, y: 136, to: [1262, 150] },
    { t: copy.status, x: 1128, y: 198, to: [1284, 196] },
  ];

  return (
    <g className={styles.detail}>
      <g transform="translate(1390 164) rotate(-16)">
        <path d={ellipsePath(206, 78)} className={styles.orbitFaint} />
        <path d={ellipsePath(150, 58)} className={styles.orbit} />
        <path d={ellipsePath(92, 35)} className={styles.orbit} />
        <circle r={16} className={styles.sunHalo}>
          <animate attributeName="r" values="12;22;12" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle r={7} className={styles.sun} />
        <circle r={6} className={styles.planet}>
          <animateMotion dur="11s" repeatCount="indefinite" path={ellipsePath(150, 58)} />
        </circle>
        <circle r={4} className={styles.planetAmber}>
          <animateMotion dur="6.5s" repeatCount="indefinite" path={ellipsePath(92, 35)} />
        </circle>
        <circle r={3} className={styles.planet}>
          <animateMotion dur="19s" repeatCount="indefinite" begin="-7s" path={ellipsePath(206, 78)} />
        </circle>
      </g>
      {labels.map(({ t, x, y, to }, i) => (
        <g key={i}>
          <text x={x} y={y} className={styles.txt}>{t}</text>
          <rect x={x} y={y + 8} width={96} height={3} className={styles.glyph} />
          <rect x={x} y={y + 15} width={66} height={3} className={styles.glyph} />
          <polyline points={`${x + 150},${y - 4} ${to[0] - 16},${y - 4} ${to[0]},${to[1]}`} className={styles.leader} />
          <circle cx={to[0]} cy={to[1]} r={3.5} className={styles.node} />
        </g>
      ))}
      <text x={1420} y={276} className={styles.txt}>{copy.fuel}</text>
      <rect x={1420} y={284} width={110} height={3} className={styles.glyph} />
      <polyline points="1418,272 1400,272 1386,232" className={styles.leader} />
      <circle cx={1386} cy={232} r={3.5} className={`${styles.node} ${styles.amberFill}`} />

      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1452 + (i % 2) * 34} y={40 + Math.floor(i / 2) * 10} width={i % 2 ? 50 : 28} height={3} className={styles.glyph} />
      ))}

    </g>
  );
}

function Stream({ x, y, lines, running, kind, width, anchor = "start" }: {
  x: number; y: number; lines: number; running: boolean; kind: "bits" | "hex"; width: number; anchor?: "start" | "end";
}) {
  const tick = useTick(kind === "bits" ? 620 : 780, running);
  const groups = kind === "bits" ? Math.floor(width / 38) : Math.floor(width / 22);
  return (
    <g>
      {Array.from({ length: lines }, (_, i) => {
        const seed = (tick + i) * 7919 + (kind === "hex" ? 17 : 3);
        return (
          <text key={i} x={x} y={y + i * 15} textAnchor={anchor} className={styles.mono} style={{ opacity: 0.35 + (i / lines) * 0.6 }}>
            {kind === "bits" ? bits(seed, groups) : hex(seed, groups)}
          </text>
        );
      })}
    </g>
  );
}

function TerminalLeft({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(700, running);
  const lit = 7 + Math.round(2.5 + 2.5 * Math.sin(tick * 0.9));
  return (
    <g transform="translate(58 346)" className={styles.detail}>
      <text x={0} y={0} className={`${styles.txt} ${styles.txtHead}`}>{copy.terminal}</text>
      <path d="M190 -5 H330 V3" className={styles.lineBright} />
      <Stream x={0} y={24} lines={4} running={running} kind="bits" width={330} />

      <polyline points="0,108 22,100 60,100 78,108 60,116 22,116 0,108" className={styles.lineBright} />
      <path d="M22 100 L14 90 H34 L44 100 M22 116 L14 126 H34 L44 116 M60 104 H70" className={styles.line} />
      <text x={96} y={104} className={`${styles.txt} ${styles.txtSmall}`}>{copy.drive}</text>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={96 + i * 19} y={112} width={15} height={7} className={i < lit ? styles.cellOn : styles.cellOff} />
      ))}

      <text x={0} y={160} className={styles.txt}>{copy.sector}: <tspan className={styles.amber}>DELTA-7</tspan></text>
      <text x={0} y={180} className={styles.txt}>{copy.coreTemp}: <tspan className={styles.amber}>{copy.optimal}</tspan></text>
      <text x={0} y={200} className={styles.txt}>{copy.integrity}: <tspan className={styles.amber}>100%</tspan></text>
      <text x={0} y={218} className={`${styles.txt} ${styles.txtSmall} ${styles.dim}`}>{copy.cooling}</text>

      {Array.from({ length: 18 }, (_, i) => (
        <rect
          key={i}
          x={i * 18}
          y={234}
          width={10}
          height={30}
          className={styles.bar}
          style={{ "--d": `${0.7 + ((i * 37) % 9) / 10}s`, "--delay": `${-((i * 53) % 13) / 10}s` } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

function TerminalRight({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(110, running);
  const wave = useMemo(() => {
    const r = rng(tick * 131 + 7);
    return Array.from({ length: 64 }, (_, i) => {
      const y = 22 + Math.sin(i * 0.38 + tick * 0.35) * 11 + Math.sin(i * 1.7 + tick * 0.9) * 4 + (r() - 0.5) * 3;
      return `${(i * 330) / 63},${y.toFixed(1)}`;
    }).join(" ");
  }, [tick]);

  return (
    <g transform="translate(1212 342)" className={styles.detail}>
      <text x={330} y={0} textAnchor="end" className={`${styles.txt} ${styles.txtHead}`}>{copy.terminal}</text>
      <path d="M0 3 V-5 H140" className={styles.lineBright} />
      <Stream x={330} y={24} lines={4} running={running} kind="hex" width={330} anchor="end" />

      <text x={0} y={100} className={`${styles.txt} ${styles.txtSmall}`}>{copy.signal}</text>
      <rect x={0} y={106} width={330} height={44} className={styles.panelBg} />
      <line x1={0} y1={128} x2={330} y2={128} className={styles.grid} />
      <polyline points={wave} transform="translate(0 106)" className={styles.wave} />

      <text x={0} y={178} className={styles.txt}>{copy.integrity}: <tspan className={styles.amber}>100%</tspan></text>
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={i} x={i * 12.7} y={190} width={8} height={4} className={`${styles.glyph} ${i % 7 === 3 ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.21}s` }} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={`d${i}`} x={330 - 60 - i * 28} y={206} width={20} height={4} className={styles.glyphDim} />
      ))}
    </g>
  );
}

function CornerReadout({ running }: { running: boolean }) {
  const tick = useTick(1300, running);
  const fuel = 86 - (tick % 9 === 0 ? 1 : 0);
  const spd = (2.2 + 0.12 * Math.sin(tick)).toFixed(2);
  return (
    <g className={styles.detail}>
      <g transform="translate(62 646)">
        <text x={0} y={0} className={styles.mono}>[SPD: {spd}c]</text>
        <text x={0} y={16} className={styles.mono}>[FUEL: {fuel}%]</text>
        <text x={0} y={32} className={styles.mono}>[HULL: 99%]</text>
        <path d="M-10 -14 V40" className={styles.line} />
      </g>
      <g transform="translate(1452 690)">
        <text x={0} y={0} className={styles.mono}>[NAV: LOCK]</text>
        <text x={0} y={16} className={styles.mono}>[COMM: OK]</text>
        <text x={0} y={32} className={styles.mono}>[O2: 98%]</text>
        <path d="M-10 -14 V40" className={styles.line} />
      </g>
    </g>
  );
}

export function HudBackdrop({ isPl, still }: { isPl: boolean; still: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dotsId = `hud-dots-${useId().replace(/:/g, "")}`;
  const [visible, setVisible] = useState(true);
  const running = !still && visible;
  const copy = COPY[isPl ? "pl" : "en"];

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // SMIL (orbits, scanner, ship) can't be paused from CSS.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (running) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [running]);

  return (
    <div className={`${styles.backdrop} ${running ? "" : styles.paused}`} aria-hidden="true">
      <svg ref={svgRef} className={styles.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={dotsId} width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className={styles.dot} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${dotsId})`} />
        <Traces />
        <StarMap copy={copy} running={running} />
        <Orbits copy={copy} />
        <TerminalLeft copy={copy} running={running} />
        <TerminalRight copy={copy} running={running} />
        <CornerReadout running={running} />
      </svg>
    </div>
  );
}

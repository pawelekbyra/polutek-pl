"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./HudBackdrop.module.css";

/*
 * Onboard-computer screen behind the premiere readout, built on FUI hierarchy rules:
 * the readout is the only bright, sharp thing; everything here is dimmed, thin and
 * additive so it reads as a quiet texture of data, not as competing content.
 *
 * Two depth planes on one 1600×900 grid (the player's 16:9):
 *   far — a huge, slowly counter-rotating holographic reticle behind the title, blurred
 *   mid — the instruments: circuit traces with data pulses, star-map scanner, orbital
 *         plot, two terminal panels, radar, live readouts
 * Panels power on with a staggered flicker, and on fine pointers both planes drift a
 * few pixels against the cursor for a holographic parallax. Decorative (aria-hidden),
 * deterministic on first render so SSR and hydration agree, and everything pauses
 * offscreen, in a hidden tab and under reduced motion.
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
    radar: "RADAR BLISKI",
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
    radar: "SHORT-RANGE RADAR",
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

const arc = (r: number, from: number, to: number) => {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  };
  return `M ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)}`;
};

const bootStyle = (delay: number) => ({ "--boot": `${delay}s` }) as React.CSSProperties;

function Brackets({ w, h, s = 12 }: { w: number; h: number; s?: number }) {
  return (
    <path
      className={styles.frame}
      d={`M0 ${s} V0 H${s} M${w - s} 0 H${w} V${s} M${w} ${h - s} V${h} H${w - s} M${s} ${h} H0 V${h - s}`}
    />
  );
}

/* ---------- far plane: holographic reticle behind the title ---------- */

function Reticle() {
  const ticks = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => {
        const a = ((i * 2 - 90) * Math.PI) / 180;
        const major = i % 5 === 0;
        const r1 = major ? 372 : 380;
        return `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)} L${(Math.cos(a) * 388).toFixed(1)} ${(Math.sin(a) * 388).toFixed(1)}`;
      }).join(""),
    [],
  );
  return (
    <g transform={`translate(${W / 2} 440)`}>
      <g className={styles.spinSlow}>
        <path d={ticks} className={styles.farLine} />
        <path d={arc(400, 20, 70) + arc(400, 110, 160) + arc(400, 200, 250) + arc(400, 290, 340)} className={styles.farBright} />
      </g>
      <g className={styles.spinReverse}>
        <circle r={318} className={styles.farDash} />
        <path d={arc(300, -30, 30) + arc(300, 150, 210)} className={styles.farBright} />
      </g>
      <circle r={252} className={styles.farLine} />
    </g>
  );
}

/* ---------- mid plane ---------- */

const TRACES: { d: string; dur: number; delay: number }[] = [
  { d: "M40 306 H290 L306 322 H392", dur: 4.2, delay: 0 },
  { d: "M444 152 H520 L538 170 H660", dur: 5.1, delay: 1.2 },
  { d: "M1110 70 H1040 L1022 88 H940", dur: 4.6, delay: 0.6 },
  { d: "M1560 310 H1340 L1322 328 H1224", dur: 3.8, delay: 2 },
  { d: "M40 776 H250 L270 796 H520", dur: 5.4, delay: 0.4 },
  { d: "M1560 800 H1380 L1360 816 H1080", dur: 4.9, delay: 1.7 },
  { d: "M26 340 V600", dur: 3.4, delay: 0.9 },
  { d: "M1574 360 V640", dur: 3.9, delay: 2.4 },
  { d: "M376 596 H404 V720 H450", dur: 4.4, delay: 1.5 },
  { d: "M620 32 H760 L776 46 H824 L840 32 H980", dur: 6, delay: 0.8 },
];

const NODES: [number, number, boolean][] = [
  [392, 322, true], [660, 170, false], [940, 88, true], [1224, 328, false],
  [520, 796, true], [1080, 816, false], [450, 720, false], [40, 306, false],
  [1560, 310, false], [40, 776, false], [1560, 800, false],
];

function Traces() {
  return (
    <g className={styles.boot} style={bootStyle(0)}>
      <path className={styles.faint} d="M40 32 H600 M1000 32 H1560 M40 868 H300 M1300 868 H1560" />
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
          <circle cx={x} cy={y} r={5} className={styles.nodeRing} />
          <circle cx={x} cy={y} r={2.2} className={`${styles.node} ${blink ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.37}s` }} />
        </g>
      ))}
    </g>
  );
}

function StarMap({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(250, running);
  const progress = (tick % 72) / 72;
  const spd = (2.18 + 0.1 * Math.sin(tick * 0.2)).toFixed(2);
  const stars = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 16 }, () => ({ x: 18 + r() * 324, y: 14 + r() * 140, s: 1.3 + r() * 2, d: r() * 3 })).sort((a, b) => a.x - b.x);
  }, []);
  const route = "M16 142 C 92 36, 196 162, 290 42 S 340 36, 344 22";

  return (
    <g transform="translate(64 58)" className={`${styles.detail} ${styles.boot}`} style={bootStyle(0.35)}>
      <rect width={360} height={170} className={styles.panelBg} />
      <Brackets w={360} h={170} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`gx${i}`} x1={i * 45} y1={0} x2={i * 45} y2={170} className={styles.grid} />
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <line key={`gy${i}`} x1={0} y1={i * 42.5} x2={360} y2={i * 42.5} className={styles.grid} />
      ))}
      <polyline className={styles.constellation} points={stars.filter((_, i) => i % 3 !== 2).map((p) => `${p.x},${p.y}`).join(" ")} />
      {stars.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.s} className={`${styles.star} ${styles.twinkle}`} style={{ animationDelay: `${-p.d}s` }} />
      ))}
      <path d={route} className={styles.route} />
      <circle r={3.5} className={styles.ship}>
        <animateMotion dur="8s" repeatCount="indefinite" path={route} />
      </circle>
      <rect width={2} height={170} className={styles.scanLine}>
        <animate attributeName="x" values="0;358;0" dur="7s" repeatCount="indefinite" />
      </rect>

      <text x={0} y={192} className={`${styles.txt} ${styles.txtSmall}`}>{copy.scan}</text>
      <text x={360} y={192} textAnchor="end" className={`${styles.txt} ${styles.txtSmall}`}>{Math.round(progress * 100)}%</text>
      <rect y={199} width={360} height={6} className={styles.progressTrack} />
      <rect y={199} width={360} height={6} className={styles.progressFill} style={{ transform: `scaleX(${Math.max(0.02, progress)})` }} />
      {[0, 22, 44, 84, 106, 160, 182, 204].map((x, i) => (
        <rect key={i} x={x} y={216} width={16} height={8} className={`${styles.glyph} ${i % 3 === 0 ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.5}s` }} />
      ))}

      <g transform="translate(386 30)">
        <text y={0} className={styles.mono}>[SPD: {spd}c]</text>
        <text y={16} className={styles.mono}>[FUEL: 86%]</text>
        <text y={32} className={styles.mono}>[HULL: 99%]</text>
      </g>
    </g>
  );
}

function Orbits({ copy }: { copy: Copy }) {
  const labels: { t: string; x: number; y: number; to: [number, number] }[] = [
    { t: copy.nav, x: 1116, y: 72, to: [1316, 102] },
    { t: copy.ready, x: 1116, y: 132, to: [1262, 150] },
    { t: copy.status, x: 1116, y: 190, to: [1286, 194] },
  ];
  return (
    <g className={`${styles.detail} ${styles.boot}`} style={bootStyle(0.6)}>
      <g transform="translate(1392 160) rotate(-16)">
        <path d={ellipsePath(200, 76)} className={styles.orbitFaint} />
        <path d={ellipsePath(146, 56)} className={styles.orbit} />
        <path d={ellipsePath(90, 34)} className={styles.orbit} />
        <circle r={14} className={styles.sunHalo}>
          <animate attributeName="r" values="11;20;11" dur="3.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.08;0.5" dur="3.4s" repeatCount="indefinite" />
        </circle>
        <circle r={6} className={styles.sun} />
        <circle r={5} className={styles.planet}>
          <animateMotion dur="12s" repeatCount="indefinite" path={ellipsePath(146, 56)} />
        </circle>
        <circle r={3.5} className={styles.planetAmber}>
          <animateMotion dur="7s" repeatCount="indefinite" path={ellipsePath(90, 34)} />
        </circle>
        <circle r={2.6} className={styles.planet}>
          <animateMotion dur="21s" repeatCount="indefinite" begin="-7s" path={ellipsePath(200, 76)} />
        </circle>
      </g>
      {labels.map(({ t, x, y, to }, i) => (
        <g key={i}>
          <text x={x} y={y} className={styles.txt}>{t}</text>
          <rect x={x} y={y + 7} width={92} height={2.5} className={styles.glyph} />
          <rect x={x} y={y + 13} width={62} height={2.5} className={styles.glyph} />
          <polyline points={`${x + 146},${y - 4} ${to[0] - 16},${y - 4} ${to[0]},${to[1]}`} className={styles.leader} />
          <circle cx={to[0]} cy={to[1]} r={3} className={styles.node} />
        </g>
      ))}
      <text x={1424} y={268} className={styles.txt}>{copy.fuel}</text>
      <rect x={1424} y={275} width={104} height={2.5} className={styles.glyph} />
      <polyline points="1420,264 1404,264 1390,228" className={styles.leader} />
      <circle cx={1390} cy={228} r={3} className={`${styles.node} ${styles.amberFill}`} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={1452 + (i % 2) * 34} y={40 + Math.floor(i / 2) * 9} width={i % 2 ? 50 : 28} height={2.5} className={styles.glyph} />
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
          <text key={i} x={x} y={y + i * 14} textAnchor={anchor} className={styles.mono} style={{ opacity: 0.35 + (i / lines) * 0.65 }}>
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
    <g transform="translate(56 344)" className={`${styles.detail} ${styles.boot}`} style={bootStyle(0.9)}>
      <text className={`${styles.txt} ${styles.txtHead}`}>{copy.terminal}</text>
      <path d="M176 -5 H320 V3" className={styles.frame} />
      <Stream x={0} y={22} lines={3} running={running} kind="bits" width={320} />

      <polyline points="0,86 20,79 56,79 72,86 56,93 20,93 0,86" className={styles.frame} />
      <path d="M20 79 L13 70 H31 L40 79 M20 93 L13 102 H31 L40 93 M56 82.5 H65" className={styles.line} />
      <text x={90} y={82} className={`${styles.txt} ${styles.txtSmall}`}>{copy.drive}</text>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={90 + i * 19} y={88} width={15} height={6} className={i < lit ? styles.cellOn : styles.cellOff} />
      ))}

      <text y={132} className={styles.txt}>{copy.sector}: <tspan className={styles.amber}>DELTA-7</tspan></text>
      <text y={151} className={styles.txt}>{copy.coreTemp}: <tspan className={styles.amber}>{copy.optimal}</tspan></text>
      <text y={170} className={styles.txt}>{copy.integrity}: <tspan className={styles.amber}>100%</tspan></text>
      <text y={187} className={`${styles.txt} ${styles.txtSmall} ${styles.dim}`}>{copy.cooling}</text>

      {Array.from({ length: 18 }, (_, i) => (
        <rect
          key={i}
          x={i * 17.5}
          y={202}
          width={10}
          height={26}
          className={styles.bar}
          style={{ "--d": `${0.8 + ((i * 37) % 9) / 10}s`, "--delay": `${-((i * 53) % 13) / 10}s` } as React.CSSProperties}
        />
      ))}
    </g>
  );
}

function TerminalRight({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(120, running);
  const wave = useMemo(() => {
    const r = rng(tick * 131 + 7);
    return Array.from({ length: 64 }, (_, i) => {
      const y = 20 + Math.sin(i * 0.38 + tick * 0.3) * 10 + Math.sin(i * 1.7 + tick * 0.8) * 3.5 + (r() - 0.5) * 2.5;
      return `${((i * 320) / 63).toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [tick]);

  return (
    <g transform="translate(1224 354)" className={`${styles.detail} ${styles.boot}`} style={bootStyle(1.15)}>
      <text x={320} textAnchor="end" className={`${styles.txt} ${styles.txtHead}`}>{copy.terminal}</text>
      <path d="M0 3 V-5 H140" className={styles.frame} />
      <Stream x={320} y={22} lines={3} running={running} kind="hex" width={320} anchor="end" />

      <text y={82} className={`${styles.txt} ${styles.txtSmall}`}>{copy.signal}</text>
      <rect y={88} width={320} height={40} className={styles.panelBg} />
      <line x1={0} y1={108} x2={320} y2={108} className={styles.grid} />
      <polyline points={wave} transform="translate(0 88)" className={styles.wave} />

      <text y={152} className={styles.txt}>{copy.integrity}: <tspan className={styles.amber}>100%</tspan></text>
      {Array.from({ length: 25 }, (_, i) => (
        <rect key={i} x={i * 12.8} y={162} width={8} height={4} className={`${styles.glyph} ${i % 7 === 3 ? styles.blink : ""}`} style={{ animationDelay: `${-i * 0.21}s` }} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={`d${i}`} x={260 - i * 28} y={176} width={20} height={4} className={styles.glyphDim} />
      ))}
    </g>
  );
}

function Radar({ copy, running }: { copy: Copy; running: boolean }) {
  const tick = useTick(1400, running);
  const blips = useMemo(() => {
    const r = rng(tick * 17 + 5);
    return Array.from({ length: 3 }, () => {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 42;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: r() * 2.4 };
    });
  }, [tick]);
  return (
    <g className={`${styles.detail} ${styles.boot}`} style={bootStyle(1.4)}>
      <g transform="translate(1478 700)">
        <circle r={62} className={styles.orbit} />
        <circle r={41} className={styles.orbitFaint} />
        <circle r={20} className={styles.orbitFaint} />
        <path d="M-62 0 H62 M0 -62 V62" className={styles.grid} />
        <g>
          <path d="M0 0 L0 -62 A62 62 0 0 1 43.8 -43.8 Z" className={styles.sweep} />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
        </g>
        {blips.map((b, i) => (
          <circle key={`${tick}-${i}`} cx={b.x} cy={b.y} r={2.6} className={styles.blip} style={{ animationDelay: `${b.delay}s` }} />
        ))}
      </g>
      <text x={1478} y={784} textAnchor="middle" className={`${styles.txt} ${styles.txtSmall}`}>{copy.radar}</text>
      <g transform="translate(1290 682)">
        <text y={0} className={styles.mono}>[NAV: LOCK]</text>
        <text y={16} className={styles.mono}>[COMM: OK]</text>
        <text y={32} className={styles.mono}>[O2: 98%]</text>
        <path d="M-10 -13 V39" className={styles.line} />
      </g>
    </g>
  );
}

function CornerReadout({ running }: { running: boolean }) {
  const tick = useTick(1300, running);
  const fuel = 86 - (tick % 9 === 0 ? 1 : 0);
  return (
    <g transform="translate(64 648)" className={`${styles.detail} ${styles.boot}`} style={bootStyle(1.6)}>
      <text y={0} className={styles.mono}>[SPD: 22S]</text>
      <text y={16} className={styles.mono}>[FUEL: {fuel}%]</text>
      <text y={32} className={styles.mono}>[HULL: 99%]</text>
      <path d="M-10 -13 V39" className={styles.line} />
    </g>
  );
}

export function HudBackdrop({ isPl, still }: { isPl: boolean; still: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<SVGSVGElement>(null);
  const midRef = useRef<SVGSVGElement>(null);
  const dotsId = `hud-dots-${useId().replace(/:/g, "")}`;
  const [visible, setVisible] = useState(true);
  const running = !still && visible;
  const copy = COPY[isPl ? "pl" : "en"];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // SMIL (orbits, scanner, radar) can't be paused from CSS.
  useEffect(() => {
    for (const svg of [farRef.current, midRef.current]) {
      if (!svg) continue;
      if (running) svg.unpauseAnimations();
      else svg.pauseAnimations();
    }
  }, [running]);

  // Holographic parallax: planes drift a few px against a fine pointer.
  useEffect(() => {
    const root = rootRef.current;
    const host = root?.parentElement;
    if (!root || !host || still || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        root.style.setProperty("--px", (((e.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
        root.style.setProperty("--py", (((e.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
      });
    };
    const onLeave = () => {
      root.style.setProperty("--px", "0");
      root.style.setProperty("--py", "0");
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [still]);

  return (
    <div ref={rootRef} className={`${styles.backdrop} ${running ? "" : styles.paused}`} aria-hidden="true">
      <svg ref={farRef} className={`${styles.plane} ${styles.far}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={dotsId} width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className={styles.dot} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#${dotsId})`} />
        <Reticle />
      </svg>
      <svg ref={midRef} className={`${styles.plane} ${styles.mid}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Traces />
        <StarMap copy={copy} running={running} />
        <Orbits copy={copy} />
        <TerminalLeft copy={copy} running={running} />
        <TerminalRight copy={copy} running={running} />
        <Radar copy={copy} running={running} />
        <CornerReadout running={running} />
      </svg>
    </div>
  );
}

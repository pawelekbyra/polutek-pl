/**
 * The static world map (server-rendered): every country outline with its colour class, and a point for each
 * territory too small for the outlines that has data. The path strings live only in this server module and the
 * HTML, never in the client bundle; WorldMap (client) adds hover, selection, zoom and the conquest playback on
 * top through the `data-code` attributes. No inline styles: colours are classes, sizes are SVG attributes.
 */
import { WORLD_HEIGHT, WORLD_POINTS, WORLD_SHAPES, WORLD_WIDTH } from "./geo.generated";

export const POINT_RADIUS = 3.4;

export function WorldSvg({ classOf, withPoint }: { classOf: Record<string, number>; withPoint: Set<string> }) {
  return (
    <svg
      className="wm-svg"
      viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="wm-sea" x="-2000" y="-2000" width="5000" height="5000" />
      <g className="wm-shapes">
        {WORLD_SHAPES.map((s, i) => (
          <path key={`${s.code ?? "x"}-${i}`} className={`wm-country wm-c${s.code ? (classOf[s.code] ?? 0) : 0}`} d={s.d} data-code={s.code ?? undefined} />
        ))}
      </g>
      <g className="wm-points">
        {WORLD_POINTS.filter((p) => withPoint.has(p.code)).map((p) => (
          <circle key={p.code} className={`wm-country wm-point wm-c${classOf[p.code] ?? 0}`} cx={p.x} cy={p.y} r={POINT_RADIUS} data-code={p.code} />
        ))}
      </g>
    </svg>
  );
}

/** Where a country sits on the map (centre of its largest piece), for keyboard reading and the tooltip anchor. */
export function anchorOf(code: string): [number, number] | null {
  const s = WORLD_SHAPES.find((x) => x.code === code);
  if (s) return [s.cx, s.cy];
  const p = WORLD_POINTS.find((x) => x.code === code);
  return p ? [p.x, p.y] : null;
}

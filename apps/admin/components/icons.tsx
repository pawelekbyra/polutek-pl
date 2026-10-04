/**
 * Own icon set of the panel (inline SVG sprite, 24 px grid, 1.75 px stroke), copied 1:1 from the approved
 * prototype (docs/design/admin-panel/index.html). No emoji, no icon font, nothing from a CDN.
 * The sprite is rendered once in the root layout; <Icon> references a symbol with <use>.
 */
const ICONS = {
  today: `<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>`,
  chart: `<path d="M4 4v16h16"/><path d="m8 14 3.5-4 3 2.5L19 7"/>`,
  film: `<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M3.5 15h17M8 5v14M16 5v14"/>`,
  users: `<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.8c1.8.7 3 2.3 3.5 4.7"/>`,
  coins: `<ellipse cx="10" cy="7" rx="6" ry="2.5"/><path d="M4 7v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M8 17.3c.6.1 1.3.2 2 .2 1 0 2-.1 2.8-.3"/><path d="M15 12.2c3 .2 5 1.2 5 2.3v3c0 1.4-2.7 2.5-6 2.5-1.6 0-3-.3-4.1-.7"/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>`,
  server: `<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h4M12 16.5h4"/>`,
  shield: `<path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6.2z"/><path d="m9 12 2 2 4-4"/>`,
  settings: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
  live: `<circle cx="12" cy="12" r="2"/><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.3 9.3 0 0 1 0-13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>`,
  search: `<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  moon: `<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>`,
  monitor: `<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>`,
  ok: `<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.3 2.4 2.4 4.6-5"/>`,
  warn: `<path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>`,
  crit: `<path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3z"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/>`,
  info: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>`,
  up: `<path d="M12 19V5M6 11l6-6 6 6"/>`,
  down: `<path d="M12 5v14M6 13l6 6 6-6"/>`,
  flat: `<path d="M5 12h14"/>`,
  right: `<path d="m9 6 6 6-6 6"/>`,
  left: `<path d="m15 6-6 6 6 6"/>`,
  external: `<path d="M14 4h6v6M20 4l-8 8"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  close: `<path d="m6 6 12 12M18 6 6 18"/>`,
  refresh: `<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8"/><path d="M20 20v-4.5h-4.5"/>`,
  flag: `<path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/>`,
  key: `<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>`,
  upload: `<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>`,
  download: `<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>`,
  deploy: `<path d="M12 3.5 4 8v8l8 4.5 8-4.5V8z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>`,
  message: `<path d="M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z"/>`,
  "user-plus": `<circle cx="10" cy="8.5" r="3.5"/><path d="M4 19.5c.6-3.3 3-5 6-5 1.4 0 2.6.4 3.6 1"/><path d="M18 13v6M15 16h6"/>`,
  image: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>`,
  calendar: `<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>`,
  database: `<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>`,
  box: `<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5 12 11l8-3.5M12 11v9"/>`,
  globe: `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z"/>`,
  zap: `<path d="M13 3 5 13.5h6L10 21l9-11h-6.5z"/>`,
  logout: `<path d="M14 4.5h4.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>`,
  passkey: `<circle cx="9" cy="8" r="3.5"/><path d="M3 19.5c.6-3.3 3-5 6-5 1.2 0 2.3.3 3.2.8"/><circle cx="17" cy="13.5" r="2.5"/><path d="M17 16v4.5l1.5-1-1.5-1"/>`,
  command: `<path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15zm0 0v6m0 0h2.5a2.5 2.5 0 1 1-2.5 2.5V15zm0 0H9m0 0v2.5A2.5 2.5 0 1 1 6.5 15H9z"/>`,
  inbox: `<path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z"/><path d="M4 13.5h4.5l1.5 2h4l1.5-2H20"/>`,
  filter: `<path d="M4 5.5h16l-6 7.5v5l-4 1.5V13z"/>`,
  note: `<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>`,
} as const;

export type IconName = keyof typeof ICONS;

const SPRITE = Object.entries(ICONS)
  .map(([id, body]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`)
  .join("");

/** Rendered once per page; static markup from the constants above (no user input). */
export function IconSprite() {
  return (
    <svg width="0" height="0" className="sr-only" aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: SPRITE }} />
    </svg>
  );
}

export function Icon({ name, className, large }: { name: IconName; className?: string; large?: boolean }) {
  return (
    <svg className={`icon${large ? " icon-lg" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

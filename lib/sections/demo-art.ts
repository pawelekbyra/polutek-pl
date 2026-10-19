/**
 * Generated demo pictures for the prototype sections: inline SVG data URIs (the CSP allows `data:` images),
 * so no binary assets and no external hosts are needed.
 */
export type ArtKind = "sun" | "waves" | "mountains" | "dots" | "rings" | "stripes" | "blob" | "grid";
export type ArtPalette = readonly [string, string, string];

const SIZE = 400;

function shapes(kind: ArtKind, [, accent, ink]: ArtPalette): string {
  switch (kind) {
    case "sun":
      return `<circle cx="200" cy="170" r="84" fill="${accent}" opacity=".95"/><rect y="250" width="400" height="150" fill="${ink}" opacity=".55"/><rect y="280" width="400" height="12" fill="${accent}" opacity=".35"/>`;
    case "waves":
      return [0, 1, 2, 3]
        .map((i) => `<path d="M0 ${230 + i * 38} Q 100 ${190 + i * 38} 200 ${230 + i * 38} T 400 ${230 + i * 38} V 400 H 0 Z" fill="${i % 2 ? accent : ink}" opacity="${0.35 + i * 0.15}"/>`)
        .join("");
    case "mountains":
      return `<path d="M-20 400 L130 170 L230 320 L290 230 L420 400 Z" fill="${ink}" opacity=".6"/><path d="M-20 400 L90 260 L170 400 Z" fill="${accent}" opacity=".7"/><circle cx="310" cy="95" r="34" fill="${accent}" opacity=".9"/>`;
    case "dots":
      return Array.from({ length: 25 }, (_, i) => `<circle cx="${50 + (i % 5) * 75}" cy="${50 + Math.floor(i / 5) * 75}" r="${10 + ((i * 7) % 5) * 5}" fill="${i % 2 ? accent : ink}" opacity=".7"/>`).join("");
    case "rings":
      return [150, 110, 70, 30].map((r, i) => `<circle cx="200" cy="200" r="${r}" fill="none" stroke="${i % 2 ? ink : accent}" stroke-width="18" opacity=".8"/>`).join("");
    case "stripes":
      return Array.from({ length: 7 }, (_, i) => `<rect x="${-40 + i * 70}" y="-40" width="34" height="520" fill="${i % 2 ? accent : ink}" opacity=".55" transform="rotate(24 200 200)"/>`).join("");
    case "blob":
      return `<path d="M120 90 C 220 20 330 90 320 200 C 310 320 190 350 110 290 C 40 240 50 140 120 90 Z" fill="${accent}" opacity=".85"/><circle cx="270" cy="270" r="48" fill="${ink}" opacity=".5"/>`;
    case "grid":
      return Array.from({ length: 16 }, (_, i) => `<rect x="${40 + (i % 4) * 82}" y="${40 + Math.floor(i / 4) * 82}" width="66" height="66" rx="16" fill="${(i + Math.floor(i / 4)) % 2 ? accent : ink}" opacity="${0.35 + ((i * 3) % 5) * 0.12}"/>`).join("");
  }
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Square photo-like picture: gradient background and a few soft shapes. */
export function demoPhotoArt(kind: ArtKind, palette: ArtPalette, angle = 135): string {
  const [from] = palette;
  const to = palette[2];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>${shapes(kind, palette)}</svg>`;
  return toDataUri(svg);
}

export type ProductShape = "tee" | "mug" | "cap" | "poster" | "sticker" | "tote" | "notebook";

function productShape(shape: ProductShape, [, accent, ink]: ArtPalette): string {
  switch (shape) {
    case "tee":
      return `<path d="M130 90 L90 120 L60 170 L100 195 L120 170 V320 H280 V170 L300 195 L340 170 L310 120 L270 90 Q 200 130 130 90 Z" fill="${accent}"/><circle cx="200" cy="215" r="30" fill="${ink}" opacity=".8"/>`;
    case "mug":
      return `<rect x="110" y="120" width="150" height="170" rx="26" fill="${accent}"/><path d="M260 160 H292 a34 34 0 0 1 0 80 H260" fill="none" stroke="${accent}" stroke-width="22"/><rect x="110" y="120" width="150" height="26" rx="13" fill="${ink}" opacity=".35"/>`;
    case "cap":
      return `<path d="M90 250 C 90 130 310 130 310 250 Z" fill="${accent}"/><path d="M290 240 Q 380 240 380 275 Q 300 285 250 262 Z" fill="${ink}" opacity=".8"/><circle cx="200" cy="130" r="14" fill="${ink}" opacity=".8"/>`;
    case "poster":
      return `<rect x="100" y="60" width="200" height="280" rx="14" fill="#ffffff" opacity=".92"/><rect x="118" y="78" width="164" height="190" rx="8" fill="${accent}"/><circle cx="200" cy="160" r="40" fill="${ink}" opacity=".7"/><rect x="130" y="290" width="140" height="12" rx="6" fill="${ink}" opacity=".6"/>`;
    case "sticker":
      return `<circle cx="200" cy="200" r="120" fill="#ffffff" opacity=".95"/><circle cx="200" cy="200" r="100" fill="${accent}"/><path d="M200 130 L218 180 L270 182 L228 214 L244 266 L200 236 L156 266 L172 214 L130 182 L182 180 Z" fill="${ink}" opacity=".85"/>`;
    case "tote":
      return `<path d="M150 150 V110 a50 50 0 0 1 100 0 V150" fill="none" stroke="${ink}" stroke-width="14" stroke-linecap="round"/><rect x="95" y="145" width="210" height="210" rx="18" fill="${accent}"/><circle cx="200" cy="250" r="44" fill="${ink}" opacity=".75"/>`;
    case "notebook":
      return `<rect x="110" y="70" width="190" height="270" rx="18" fill="${accent}"/><rect x="110" y="70" width="28" height="270" rx="14" fill="${ink}" opacity=".5"/><rect x="165" y="130" width="100" height="14" rx="7" fill="#ffffff" opacity=".8"/><rect x="165" y="160" width="70" height="14" rx="7" fill="#ffffff" opacity=".6"/>`;
  }
}

/** Product picture: soft gradient backdrop with a simple silhouette of the item. */
export function demoProductArt(shape: ProductShape, palette: ArtPalette): string {
  const [from] = palette;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${palette[2]}" stop-opacity=".35"/></linearGradient></defs>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/><ellipse cx="200" cy="350" rx="110" ry="14" fill="#000" opacity=".12"/>${productShape(shape, palette)}</svg>`;
  return toDataUri(svg);
}

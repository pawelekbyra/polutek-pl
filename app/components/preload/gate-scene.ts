/**
 * The "ENTER" button as part of the warp's scene: captured from the DOM at the click (its box, the
 * exact box of its text, font and colours) and from then on drawn on the warp canvas under the same
 * camera as the vector rabbit. It stays where it was and zooms with the rabbit, sharp at any scale (a
 * CSS-scaled DOM button would turn into a blurry bitmap). Pure canvas drawing, no React.
 */

export type CapturedButton = {
  /** The button's border box (CSS px, viewport coordinates at the click). */
  box: { left: number; top: number; width: number; height: number };
  /** The box of its text (Range rect: exactly where the browser laid the glyphs out). */
  textBox: { left: number; top: number; width: number; height: number };
  text: string;
  font: string;
  letterSpacing: number;
  background: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  /** Keyboard focus ring (outline) shown at the click, if any. */
  ring: { color: string; width: number; offset: number } | null;
};

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

const px = (v: string) => Number.parseFloat(v) || 0;

/** Reads the button as the viewer sees it now; null when it is not on screen. */
export function captureButton(button: HTMLElement | null): CapturedButton | null {
  if (!button) return null;
  const r = button.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const textNode = [...button.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  let textBox = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (textNode) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const t = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
    if (t && t.width > 0) textBox = { left: t.left, top: t.top, width: t.width, height: t.height };
  }
  const cs = getComputedStyle(button);
  // Exactly the look on screen at the click, so the canvas copy replaces it without a flash: the dark
  // key, or its inverted look while a mouse is over it. Taken from the gate's palette variables (the
  // end state, not a colour caught halfway through the 140 ms hover transition), with the computed
  // colours as fallback.
  const hovered = matches(button, ":hover");
  const ink = cs.getPropertyValue(hovered ? "--mx-bg" : "--mx-ink").trim();
  const page = cs.getPropertyValue(hovered ? "--mx-ink" : "--mx-bg").trim();
  const outline = px(cs.outlineWidth);
  return {
    box: { left: r.left, top: r.top, width: r.width, height: r.height },
    textBox,
    text: (textNode?.textContent ?? button.textContent ?? "").trim(),
    font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    letterSpacing: px(cs.letterSpacing),
    background: ink || cs.backgroundColor,
    color: page || cs.color,
    borderColor: cs.getPropertyValue("--mx-ink").trim() || cs.borderTopColor,
    borderWidth: px(cs.borderTopWidth),
    ring:
      matches(button, ":focus-visible") && outline > 0 && cs.outlineStyle !== "none"
        ? { color: cs.outlineColor, width: outline, offset: px(cs.outlineOffset) }
        : null,
  };
}

/**
 * Draws the captured button under the camera `translate(tx, ty) scale(scale)` on a canvas whose
 * base transform is the device pixel ratio. Glyph by glyph with the captured letter spacing, so it
 * lines up with what the DOM showed at the click.
 */
export function drawButton(
  ctx: CanvasRenderingContext2D,
  b: CapturedButton,
  camera: { tx: number; ty: number; scale: number },
  dpr: number,
): void {
  const s = camera.scale;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * camera.tx, dpr * camera.ty);
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.background;
  ctx.fillRect(b.box.left, b.box.top, b.box.width, b.box.height);
  if (b.ring) {
    const o = b.ring.offset + b.ring.width / 2;
    ctx.strokeStyle = b.ring.color;
    ctx.lineWidth = b.ring.width;
    ctx.strokeRect(b.box.left - o, b.box.top - o, b.box.width + 2 * o, b.box.height + 2 * o);
  }
  if (b.borderWidth > 0) {
    ctx.strokeStyle = b.borderColor;
    ctx.lineWidth = b.borderWidth;
    const half = b.borderWidth / 2;
    ctx.strokeRect(b.box.left + half, b.box.top + half, b.box.width - b.borderWidth, b.box.height - b.borderWidth);
  }
  ctx.font = b.font;
  ctx.fillStyle = b.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const y = b.textBox.top + b.textBox.height / 2;
  let x = b.textBox.left;
  for (const ch of b.text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + b.letterSpacing;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** The "Follow the white rabbit" prompt as part of the warp's scene: rendered once (with its light
 * halo) into a high-resolution sprite and drawn under the camera; its block cursor is drawn apart, so
 * it keeps blinking. It leaves the screen at about 4x zoom, so a sprite at 4x the device resolution
 * stays sharp all the way. */
export type CapturedPrompt = {
  box: { left: number; top: number; width: number; height: number };
  sprite: HTMLCanvasElement;
  /** Sprite pixels per CSS px. */
  res: number;
  cursor: { left: number; top: number; width: number; height: number; color: string } | null;
  /** Where the on-screen cursor's blink was at the click (s into its 1.06 s cycle); see cursorBlinkPhase. */
  blinkPhase: number;
};

const BLINK = 1.06;

/**
 * Where the prompt's CSS cursor is in its blink cycle right now (seconds), so the canvas copy goes on
 * blinking in step instead of restarting "on" at the click (a cursor that was off flashed on).
 */
export function cursorBlinkPhase(p: HTMLElement | null): number {
  const cursor = p?.querySelector<HTMLElement>("[data-gate-cursor]");
  const anim = typeof cursor?.getAnimations === "function" ? cursor.getAnimations()[0] : undefined;
  const ms = typeof anim?.currentTime === "number" ? anim.currentTime : Number(anim?.currentTime ?? 0);
  return Number.isFinite(ms) ? (((ms / 1000) % BLINK) + BLINK) % BLINK : 0;
}

export function capturePrompt(p: HTMLElement | null, dpr: number): CapturedPrompt | null {
  if (!p) return null;
  const r = p.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const textNode = [...p.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  if (!textNode) return null;
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const tr = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : r;
  const cs = getComputedStyle(p);
  const res = Math.min(12, Math.max(2, dpr * 4));
  const pad = 16; // room for the halo
  const sprite = document.createElement("canvas");
  sprite.width = Math.ceil((r.width + pad * 2) * res);
  sprite.height = Math.ceil((r.height + pad * 2) * res);
  const g = sprite.getContext("2d");
  if (!g) return null;
  g.scale(res, res);
  g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  const spacing = Number.parseFloat(cs.letterSpacing) || 0;
  const text = (textNode.textContent ?? "").trim();
  const halo = cs.getPropertyValue("--mx-bg").trim() || "#f7f9fc";
  const y = tr.top - r.top + pad + tr.height / 2;
  const draw = () => {
    let x = tr.left - r.left + pad;
    for (const ch of text) {
      g.fillText(ch, x, y);
      x += g.measureText(ch).width + spacing;
    }
  };
  // The page-coloured halo of the CSS text-shadow (4, 8 and 12 px), then the letters on top.
  g.fillStyle = halo;
  g.shadowColor = halo;
  for (const blur of [12, 8, 4]) {
    g.shadowBlur = blur * res;
    draw();
  }
  g.shadowBlur = 0;
  g.fillStyle = cs.color;
  draw();
  const cursorEl = p.querySelector<HTMLElement>("[data-gate-cursor]");
  const cr = cursorEl?.getBoundingClientRect();
  return {
    box: { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 },
    sprite,
    res,
    cursor: cr && cr.width > 0 ? { left: cr.left, top: cr.top, width: cr.width, height: cr.height, color: cs.color } : null,
    blinkPhase: 0,
  };
}

export function drawPrompt(
  ctx: CanvasRenderingContext2D,
  prompt: CapturedPrompt,
  camera: { tx: number; ty: number; scale: number },
  dpr: number,
  t: number,
): void {
  const s = camera.scale;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * camera.tx, dpr * camera.ty);
  ctx.globalAlpha = 1;
  ctx.drawImage(prompt.sprite, prompt.box.left, prompt.box.top, prompt.box.width, prompt.box.height);
  // The terminal cursor keeps blinking (same rhythm as the CSS: 1.06 s, on for the first half).
  if (prompt.cursor && (t + prompt.blinkPhase) % BLINK < BLINK / 2) {
    ctx.fillStyle = prompt.cursor.color;
    ctx.fillRect(prompt.cursor.left, prompt.cursor.top, prompt.cursor.width, prompt.cursor.height);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

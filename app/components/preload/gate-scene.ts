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
};

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
  // The key's resting look (dark key, light letters), not whatever :hover/:active state the click left:
  // with a mouse the pointer is on the button when it is clicked, and the zoom must not keep the
  // inverted hover colours. Taken from the gate's palette variables, with the computed colours as fallback.
  const ink = cs.getPropertyValue("--mx-ink").trim();
  const page = cs.getPropertyValue("--mx-bg").trim();
  return {
    box: { left: r.left, top: r.top, width: r.width, height: r.height },
    textBox,
    text: (textNode?.textContent ?? button.textContent ?? "").trim(),
    font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    letterSpacing: px(cs.letterSpacing),
    background: ink || cs.backgroundColor,
    color: page || cs.color,
    borderColor: ink || cs.borderTopColor,
    borderWidth: px(cs.borderTopWidth),
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

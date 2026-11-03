// patron zone: palette A of the checkout (owner decision 2026-11-03). Pins the contrast of the critical pairs: text 4.5:1, control edges and the
// CTA against the window 3:1 (WCAG 1.4.3 / 1.4.11), and that the Stripe form variables use the same hexes (Stripe rejects rgba()/var()).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const css = read("app/components/premium-pass/premium-pass.module.css");
const block = css.slice(css.indexOf("\n.sheet {\n  /* shared gate components"));

function token(name: string): string {
  const match = block.match(new RegExp(String.raw`${name}:\s*(#[0-9a-fA-F]{6})\b`));
  if (!match) throw new Error(`token ${name} not found in the .sheet block`);
  return match[1];
}
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const WHITE = "#ffffff";

describe("checkout palette A: contrast", () => {
  const tint = token("--pass-tint");
  const sellerBg = block.match(/\.sheet \.sellerCard \{ background: (#[0-9a-f]{6})/)![1];

  it("pins the owner's tokens", () => {
    expect(token("--pass-cta")).toBe("#01286a");
    expect(token("--pass-cta-hover")).toBe("#011d4d");
    expect(token("--pass-accent")).toBe("#1d4ed8");
    expect(tint).toBe("#eaf2ff");
    expect(token("--pass-tint-line")).toBe("#b9cdf0");
    expect(token("--pass-edge")).toBe("#6b87c0");
    expect(token("--chan-ink")).toBe("#0b1b3d");
    expect(token("--chan-muted")).toBe("#56627a");
    expect(token("--pass-ok")).toBe("#15803d");
    expect(token("--pass-err")).toBe("#b91c1c");
  });

  it.each([
    ["headings on white", "--chan-ink", WHITE],
    ["body on white", "--chan-body", WHITE],
    ["muted text on white", "--chan-muted", WHITE],
    ["muted text on the summary tint", "--chan-muted", tint],
    ["muted text on the seller card", "--chan-muted", sellerBg],
    ["gray-600 labels on the tint", "--pass-gray-600", tint],
    ["security green on white", "--pass-ok", WHITE],
    ["security green on the seller card", "--pass-ok", sellerBg],
    ["error on white", "--pass-err", WHITE],
    ["CTA label", "--pass-cta-ink", "--pass-cta"],
  ])("text: %s has at least 4.5:1", (_label, fg, bg) => {
    const bgHex = bg.startsWith("--") ? token(bg) : bg;
    expect(contrast(token(fg), bgHex)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["radio / control edge on white", "--pass-edge", WHITE],
    ["radio / control edge on the tint", "--pass-edge", tint],
    ["selection accent on white", "--pass-accent", WHITE],
    ["CTA against the window", "--pass-cta", WHITE],
  ])("non-text: %s has at least 3:1", (_label, fg, bg) => {
    expect(contrast(token(fg), bg)).toBeGreaterThanOrEqual(3);
  });

  it("the Stripe form uses the same hexes as the tokens", () => {
    const step = read("app/components/premium-pass/PassPaymentStep.tsx");
    expect(step).toContain(`colorPrimary: "${token("--pass-accent")}"`);
    expect(step).toContain(`colorText: "${token("--chan-ink")}"`);
    expect(step).toContain(`colorDanger: "${token("--pass-err")}"`);
    expect(step).toContain(`colorTextSecondary: "${token("--chan-muted")}"`);
    expect(step).not.toMatch(/colorPrimary: "(rgba|var)/);
  });

  it("the shared pay button follows the CTA token only through a fallback, so the tips keep their own colour", () => {
    const layout = read("app/components/support/TipStepLayout.tsx");
    expect(layout).toContain("bg-[var(--pass-cta,var(--chan-ink))]");
    expect(layout).toContain("hover:bg-[var(--pass-cta-hover,#000)]");
  });
});

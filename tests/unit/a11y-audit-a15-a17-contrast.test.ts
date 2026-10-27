import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const css = read("app/globals.css");

function token(name: string): string {
  const match = css.match(new RegExp(String.raw`${name}:\s*(#[0-9a-fA-F]{6})\b`));
  if (!match) throw new Error(`token ${name} not found`);
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

describe("accessibility audit fixes: contrast of controls and focus (A15-A17)", () => {
  const surfaces = ["--chan-card", "--chan-nav", "--chan-surface"].map((name) => [name, token(name)] as const);

  it.each(surfaces)("A15: the focus ring has at least 3:1 on %s", (_name, bg) => {
    expect(contrast(token("--chan-focus-ring"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("A15: the global focus rules use the opaque ring token, not a translucent blue", () => {
    expect(css).not.toContain("rgba(37, 99, 235, .45)");
    expect(css.match(/outline: 3px solid var\(--chan-focus-ring\)/g)?.length).toBe(2);
  });

  it("A15: light checkout buttons do not use the gold ring (1.7:1 on white)", () => {
    const module = read("app/components/premium-pass/premium-pass.module.css");
    expect(module).toMatch(/\.inkBtn:focus-visible, \.lineBtn:focus-visible, \.ghostBtn:focus-visible \{ outline: 3px solid var\(--chan-focus-ring/);
    expect(module).not.toMatch(/\.inkBtn:focus-visible[^{]*\{[^}]*--pass-gold/);
  });

  it.each(surfaces)("A16: the field border has at least 3:1 on %s", (_name, bg) => {
    expect(contrast(token("--chan-control-border"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("A16: Studio fields and the sign-in / account fields use the control border, dividers keep --chan-line", () => {
    expect(read("app/components/studio/ui.tsx")).toMatch(/inputClass =\s*"w-full rounded-xl border border-\[var\(--chan-control-border\)\]/);
    expect(read("app/components/auth/AuthFormParts.tsx")).toContain("border border-[var(--chan-control-border)] bg-[var(--chan-surface)]");
    expect(read("app/components/auth/AccountSections.tsx")).toContain("border border-[var(--chan-control-border)] bg-[var(--chan-surface)]");
  });

  it("A17: the card-number placeholder passed to Stripe has at least 4.5:1 on white", () => {
    const color = read("app/components/support/TipPayStep.tsx").match(/"::placeholder": \{ color: "(#[0-9a-fA-F]{6})" \}/)?.[1];
    expect(color).toBeTruthy();
    expect(contrast(color!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

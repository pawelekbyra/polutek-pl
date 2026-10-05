import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

/** String constants whose name says they are a storage key: `const FOO_KEY = "..."`. */
function storageKeysInCode(): string[] {
  const keys = new Set<string>();
  for (const file of [...sourceFiles("app"), ...sourceFiles("lib")]) {
    const text = readFileSync(join(root, file), "utf8");
    if (!/localStorage|sessionStorage/.test(text)) continue;
    for (const m of text.matchAll(/const\s+[A-Z_]*(?:KEY)[A-Z_]*\s*=\s*[`"']([^`"']+)[`"']/g)) keys.add(m[1]!);
    for (const m of text.matchAll(/(?:local|session)Storage\.(?:get|set|remove)Item\(\s*["']([^"']+)["']/g)) keys.add(m[1]!);
  }
  return [...keys].map((key) => key.replace(/\$\{[^}]+\}/g, "<userId>"));
}

describe("cookie and browser-storage inventory (docs/legal/STORAGE-INVENTORY.md)", () => {
  const inventory = readFileSync(join(root, "docs/legal/STORAGE-INVENTORY.md"), "utf8");

  it("lists every localStorage/sessionStorage key the public app writes", () => {
    const keys = storageKeysInCode()
      // admin-only upload resume lives in lib/video-upload (not part of the public site)
      .filter((key) => key !== "undefined");
    expect(keys.length).toBeGreaterThan(5);
    const missing = keys.filter((key) => !inventory.includes(key));
    expect(missing).toEqual([]);
  });

  it("documents the cookies the privacy policy promises", () => {
    for (const name of ["pp.*", "app-language", "__stripe_mid", "__stripe_sid", "g_state"]) {
      expect(inventory).toContain(name);
    }
    const policy = readFileSync(join(root, "app/components/legal/LegalDocs.tsx"), "utf8");
    for (const name of ["app-language", "__stripe_mid", "g_state"]) expect(policy).toContain(name);
  });

  it("keeps Stripe.js and Google One Tap out of the first load (no cookie before the visitor acts)", () => {
    const stripe = readFileSync(join(root, "lib/payments/stripe-browser.ts"), "utf8");
    expect(stripe).toContain("@stripe/stripe-js/pure");
    const modal = readFileSync(join(root, "app/components/auth/SignUpFooter.tsx"), "utf8");
    expect(modal).toContain("GoogleOneTapPrompt");
  });
});

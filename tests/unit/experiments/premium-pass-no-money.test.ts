// experiment: premium-pass (docs/experiments/premium-pass.md, section 4): the experiment can never take money.
// Reads every experiment source file as text: no payment code, no sensitive payment fields, no discount claims.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOTS = [
  "lib/modules/experiment-premium-pass",
  "app/components/premium-pass",
  "app/api/user/premium-pass",
  "app/[locale]/premium",
  "app/[locale]/regulamin-premium",
  "app/[locale]/premium-terms",
];

function files(dir: string): string[] {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? files(rel) : /\.(tsx?|css)$/.test(entry.name) ? [rel] : [];
  });
}

const sources = ROOTS.flatMap(files).map((file) => ({ file, text: fs.readFileSync(path.join(process.cwd(), file), "utf8") }));

describe("premium-pass never touches money", () => {
  it("finds the experiment files", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it("imports no payment provider, payments or sales code", () => {
    const forbiddenImport = /from\s+["'](?:stripe|@stripe\/[^"']*|@\/lib\/modules\/(?:payments|sales)[^"']*|@\/lib\/payments\/[^"']*|@\/lib\/stripe[^"']*)["']|import\(\s*["'](?:stripe|@stripe\/)/;
    const offenders = sources.filter(({ text }) => forbiddenImport.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("calls no payment API", () => {
    const words = ["PaymentElement", "confirmPayment", "paymentIntents", "checkout.sessions", "loadStripe", "getStripeClient", "getStripeBrowser", "fulfillPayment", "recordOrderPaid"];
    const offenders = sources.flatMap(({ file, text }) => words.filter((w) => text.includes(w)).map((w) => `${file}: ${w}`));
    expect(offenders).toEqual([]);
  });

  it("writes no ledgers: only AppSetting rows", () => {
    const ledgers = /\.(payment|patronGrant|order|entitlement|ledgerEntry|userPaymentTotal)\.(create|update|upsert|delete)/;
    expect(sources.filter(({ text }) => ledgers.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("has no card, BLIK code or bank fields: only radio and checkbox inputs", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      if (/auto[cC]omplete=["']cc-/.test(text)) offenders.push(`${file}: cc-* autocomplete`);
      if (/inputMode=["']numeric|type=["']number|type=["']tel/.test(text)) offenders.push(`${file}: numeric input`);
      for (const match of text.matchAll(/<input\b[^>]*>/g)) {
        if (!/type=["'](?:radio|checkbox)["']/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("shows no struck-through or 'was' price (no discount, so no Omnibus information)", () => {
    const offenders = sources.filter(({ text }) => /<s>|<del\b|<s\s|line-through|text-decoration:\s*line-through/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the server accepts only provider DEMO and a simulated outcome", () => {
    const useCase = fs.readFileSync(path.join(process.cwd(), "lib/modules/experiment-premium-pass/application/checkout-demo.use-case.ts"), "utf8");
    expect(useCase).toContain('provider: "DEMO"');
    expect(useCase).toContain('simulate: z.enum(["success", "declined"])');
    expect(useCase).toContain(".strict()");
  });

  it("every purchase screen has the DEMO ribbon", () => {
    const sheet = fs.readFileSync(path.join(process.cwd(), "app/components/premium-pass/PassCheckoutSheet.tsx"), "utf8");
    const offer = fs.readFileSync(path.join(process.cwd(), "app/components/premium-pass/PassOfferPage.tsx"), "utf8");
    const stage = fs.readFileSync(path.join(process.cwd(), "app/components/premium-pass/PremiumPassOverlay.tsx"), "utf8");
    expect(sheet).toContain("<DemoRibbon");
    expect(offer).toContain("<DemoRibbon");
    expect(stage).toContain('tx("TRYB DEMO", "DEMO MODE")');
  });
});

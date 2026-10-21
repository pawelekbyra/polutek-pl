// experiment: premium-pass (docs/experiments/premium-pass.md, "Strefa patrona"): where money can and cannot move.
// Reads the sources as text. The simulated (demo) flow must stay free of any payment code; real payment code may exist
// only in a short allow-list of files; access may be granted only from the payments module's fulfilment.
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
    const rel = path.join(dir, entry.name).replace(/\\/g, "/");
    return entry.isDirectory() ? files(rel) : /\.(tsx?|css)$/.test(entry.name) ? [rel] : [];
  });
}

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const sources = ROOTS.flatMap(files).map((file) => ({ file, text: read(file) }));

/** The only files of the experiment that may talk to Stripe or the payments module (server and browser). */
const STRIPE_ALLOWED = new Set([
  "lib/modules/experiment-premium-pass/application/patron-checkout.use-case.ts", // createCheckoutIntent (the tip gateway's)
  "app/components/premium-pass/PassCheckoutSheet.tsx", // getStripeBrowser(): Stripe.js only once the checkout is open
  "app/components/premium-pass/PassPaymentStep.tsx", // <Elements> around the tip gateway's own forms
]);

describe("premium-pass: where money can move", () => {
  it("finds the experiment files", () => {
    expect(sources.length).toBeGreaterThan(25);
  });

  it("only the allow-listed files import a payment provider, the payments module or Stripe.js", () => {
    const stripeImport = /from\s+["'](?:stripe|@stripe\/[^"']*|@\/lib\/modules\/(?:payments|sales)[^"']*|@\/lib\/payments\/[^"']*|@\/lib\/stripe[^"']*)["']|import\(\s*["'](?:stripe|@stripe\/)/;
    const offenders = sources.filter(({ file, text }) => stripeImport.test(text) && !STRIPE_ALLOWED.has(file)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the simulated flow has no payment code at all", () => {
    for (const file of [
      "lib/modules/experiment-premium-pass/application/checkout-demo.use-case.ts",
      "lib/modules/experiment-premium-pass/application/demo-controls.use-case.ts",
      "app/api/user/premium-pass/checkout/route.ts",
      "app/api/user/premium-pass/demo/route.ts",
    ]) {
      const text = read(file);
      expect(text, file).not.toMatch(/@\/lib\/modules\/payments|@stripe\/|from\s+["']stripe["']|createCheckoutIntent|fulfillPayment|getStripe|paymentIntents/);
    }
    const demo = read("lib/modules/experiment-premium-pass/application/checkout-demo.use-case.ts");
    expect(demo).toContain('provider: "DEMO"');
    expect(demo).toContain('simulate: z.enum(["success", "declined"])');
    expect(demo).toContain(".strict()");
    expect(demo).toContain('resolvePremiumPayments().mode !== "demo"');
  });

  it("the default of the second switch is demo and the real flow checks it before anything else", () => {
    const mode = read("lib/modules/experiment-premium-pass/domain/payments-mode.ts");
    expect(mode).toContain('=== "stripe" ? "stripe" : "demo"');
    const checkout = read("lib/modules/experiment-premium-pass/application/patron-checkout.use-case.ts");
    expect(checkout.indexOf("resolvePremiumPayments()")).toBeGreaterThan(-1);
    expect(checkout.indexOf("resolvePremiumPayments()")).toBeLessThan(checkout.indexOf("createCheckoutIntent("));
    expect(checkout.indexOf("patronProduct(")).toBeGreaterThan(-1);
    expect(checkout.indexOf("purchaseBlock(")).toBeGreaterThan(-1);
    expect(checkout.indexOf("purchaseBlock(")).toBeLessThan(checkout.indexOf("createCheckoutIntent("));
    // the amount is the product's price from the server table, never a client field
    expect(checkout).toContain("patronPrice(input.productId, input.currency)");
    expect(checkout).toMatch(/\{ userId, amountMinor, currency: input\.currency,/);
    expect(checkout).not.toMatch(/input\.amountMinor/);
  });

  it("access is granted only by the payments module's fulfilment, never by a route, a component or the experiment's own use cases", () => {
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next") walk(rel);
        } else if (/\.tsx?$/.test(entry.name) && read(rel).includes("grantPatronAccessForPayment")) callers.push(rel);
      }
    };
    walk("app");
    walk("lib");
    expect(callers.sort()).toEqual([
      "lib/modules/experiment-premium-pass/application/patron-grant.ts",
      "lib/modules/payments/application/fulfill-payment.use-case.ts",
    ]);
    expect(read("lib/modules/experiment-premium-pass/index.ts")).toContain("patron-grant");
  });

  it("writes no ledger directly: AppSetting rows, plus the consent note on the viewer's own unpaid Payment", () => {
    const forbidden = /\.(patronGrant|order|entitlement|ledgerEntry|userPaymentTotal)\.(create|update|upsert|delete)|\.payment\.(create|upsert|delete|deleteMany)\b/;
    expect(sources.filter(({ text }) => forbidden.test(text)).map(({ file }) => file)).toEqual([]);
    const paymentWrites = sources.filter(({ text }) => /\.payment\.(update|updateMany)\b/.test(text)).map(({ file }) => file);
    expect(paymentWrites).toEqual(["lib/modules/experiment-premium-pass/application/patron-checkout.use-case.ts"]);
    const checkout = read("lib/modules/experiment-premium-pass/application/patron-checkout.use-case.ts");
    expect(checkout).toContain('status: "PENDING"');
  });

  it("revoking access never deletes a payment: the experiment code has no Payment delete anywhere", () => {
    expect(sources.some(({ text }) => /payment\.delete/i.test(text))).toBe(false);
    const script = read("scripts/experiments/premium-pass-revert.sh");
    expect(script).not.toMatch(/DELETE\s+FROM\s+"Payment"/i);
    expect(script).toMatch(/DELETE FROM "AppSetting" WHERE key LIKE 'xp\.premium\\_pass%'/);
    expect(script).toContain("--confirm-real-payments");
  });

  it("our own fields never ask for card, BLIK or bank data: the card forms are the tip gateway's Stripe elements", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      if (/auto[cC]omplete=["']cc-/.test(text)) offenders.push(`${file}: cc-* autocomplete`);
      if (/type=["'](?:number|tel|password)["']/.test(text)) offenders.push(`${file}: number/tel/password input`);
      for (const match of text.matchAll(/<input\b[^>]*>/g)) {
        const tag = match[0];
        const isChoice = /type=["'](?:radio|checkbox)["']/.test(tag);
        if (!isChoice) offenders.push(`${file}: ${tag.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Stripe.js is requested only from an effect of the open checkout, never at module level", () => {
    const sheet = read("app/components/premium-pass/PassCheckoutSheet.tsx");
    expect(sheet).not.toMatch(/^[^/\n]*\bloadStripe\(/m);
    expect(sheet).not.toMatch(/^(?:const|let)\s.*getStripeBrowser\(/m);
    const calls = [...sheet.matchAll(/getStripeBrowser\(\)/g)].length;
    expect(calls).toBe(1);
    expect(sheet.indexOf("getStripeBrowser()")).toBeGreaterThan(sheet.indexOf("useEffect(() => {\n    if (!open) return;"));
  });

  it("shows no struck-through or 'was' price (no discount, so no Omnibus information)", () => {
    const offenders = sources.filter(({ text }) => /<s>|<del\b|<s\s|line-through|text-decoration:\s*line-through/.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("the demo marker is shown only in demo mode and never inside the checkout modal", () => {
    const sheet = read("app/components/premium-pass/PassCheckoutSheet.tsx");
    const offer = read("app/components/premium-pass/PassOfferPage.tsx");
    const stage = read("app/components/premium-pass/PremiumPassOverlay.tsx");
    expect(sheet).not.toContain("DemoRibbon");
    expect(offer).toContain("{demo && <DemoRibbon />}");
    expect(stage).toContain('{demo && <span className={styles.stageDemo}>{tx("TRYB DEMO", "DEMO MODE")}</span>}');
    expect(stage).toContain('tx("TRYB TESTOWY", "TEST MODE")');
    expect(sheet).toContain('tx("Tryb testowy", "Test mode")');
  });
});

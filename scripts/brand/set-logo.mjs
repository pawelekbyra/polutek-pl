#!/usr/bin/env node
// One command to switch the header logo (owner request 2026-11-02: "przywrócenie okularków jedną komendą").
//   npm run logo -- glasses                 -> BRAND_LOGO_VARIANT = "glasses" in lib/ui-flags.ts
//   npm run logo -- wordmark-blue           -> the blue POLUTEK lettering
//   npm run logo -- wordmark-blue-symbol    -> the lettering with the play symbol in front (live since 2026-11-02)
//   npm run logo -- glasses --dry-run       -> only prints what it would change
//   (--root <dir> runs against another checkout; used by the test)
// It changes exactly two lines: the constant in lib/ui-flags.ts and LIVE_LOGO in tests/unit/components/brand-name.test.tsx
// (the test that pins the live logo). It refuses unknown names, names missing from the BrandLogoVariant type, and variants
// whose files are missing. Deploy stays the standard procedure (CLAUDE.md), the script never deploys.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Files each variant needs (paths from the repo root). */
export const VARIANT_ASSETS = {
  glasses: ["app/components/BrandName.tsx", "public/logo-glasses.svg"],
  wordmark: ["app/components/brand/PolutekWordmark.tsx", "app/components/brand/polutek-wordmark-paths.ts", "public/brand/polutek-wordmark.svg"],
  "wordmark-blue": [
    "app/components/brand/PolutekWordmarkBlue.tsx",
    "app/components/brand/polutek-wordmark-blue-paths.ts",
    "public/brand/polutek-wordmark-blue.svg",
  ],
  "wordmark-blue-symbol": [
    "app/components/brand/PolutekWordmarkBlueSymbol.tsx",
    "app/components/brand/polutek-symbol-paths.ts",
    "app/components/brand/polutek-wordmark-blue-paths.ts",
    "public/brand/polutek-wordmark-blue-symbol.svg",
  ],
};

const FLAGS = "lib/ui-flags.ts";
const TEST = "tests/unit/components/brand-name.test.tsx";
const CONST_RE = /export const BRAND_LOGO_VARIANT: BrandLogoVariant = "([a-z-]+)";/;
const TYPE_RE = /export type BrandLogoVariant =([^;]+);/;
const LIVE_RE = /const LIVE_LOGO = "([a-z-]+)"/;

/** Returns { code, lines } (lines = what to print); writes files unless dryRun. */
export function setLogo(variant, { root = process.cwd(), dryRun = false } = {}) {
  const out = [];
  const fail = (msg) => ({ code: 1, lines: [...out, `BŁĄD: ${msg}`] });
  const flagsPath = path.join(root, FLAGS);
  if (!existsSync(flagsPath)) return fail(`nie ma ${FLAGS} (uruchom w katalogu repozytorium)`);
  const flags = readFileSync(flagsPath, "utf8");
  const typeNames = [...(flags.match(TYPE_RE)?.[1] ?? "").matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  const usage = `dozwolone: ${typeNames.filter((n) => n in VARIANT_ASSETS).join(" | ")}`;
  if (!variant) return fail(`podaj wariant, np. npm run logo -- glasses (${usage})`);
  if (!(variant in VARIANT_ASSETS) || !typeNames.includes(variant)) return fail(`nieznany wariant "${variant}" (${usage})`);
  const missing = VARIANT_ASSETS[variant].filter((f) => !existsSync(path.join(root, f)));
  if (missing.length) return fail(`brak plików wariantu "${variant}": ${missing.join(", ")}`);
  const current = flags.match(CONST_RE)?.[1];
  if (!current) return fail(`nie znaleziono linii BRAND_LOGO_VARIANT w ${FLAGS}`);

  if (current === variant) {
    out.push(`Bez zmian: BRAND_LOGO_VARIANT już jest "${variant}".`);
    return { code: 0, lines: out, changed: false };
  }
  const changes = [[FLAGS, flags.replace(CONST_RE, (l) => l.replace(`"${current}"`, `"${variant}"`))]];
  out.push(`${FLAGS}: BRAND_LOGO_VARIANT "${current}" -> "${variant}"`);
  const testPath = path.join(root, TEST);
  if (existsSync(testPath)) {
    const t = readFileSync(testPath, "utf8");
    const live = t.match(LIVE_RE)?.[1];
    if (live && live !== variant) {
      changes.push([TEST, t.replace(LIVE_RE, `const LIVE_LOGO = "${variant}"`)]);
      out.push(`${TEST}: LIVE_LOGO "${live}" -> "${variant}"`);
    } else if (!live) out.push(`UWAGA: w ${TEST} nie ma LIVE_LOGO; sprawdź test logo ręcznie.`);
  }
  if (dryRun) {
    out.unshift("Sucha próba (--dry-run), nic nie zapisano:");
  } else {
    for (const [f, text] of changes) writeFileSync(path.join(root, f), text);
  }
  out.push(
    "",
    "Następny krok:",
    `  1) testy: nice npx vitest run ${TEST} tests/unit/components/navbar-logo-height.test.tsx --pool=threads`,
    variant === "glasses" ? "     (okularki: pasek 47 px na telefonie, 49 px od md; to oczekiwane)" : "     (pasek 47 px na telefonie i na desktopie)",
    "  2) gałąź, PR, merge (squash), potem wdrożenie według procedury z CLAUDE.md (backup.sh, deploy.sh ze świeżym tagiem rN).",
  );
  return { code: 0, lines: out, changed: !dryRun };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const ri = args.indexOf("--root");
  const root = ri >= 0 ? path.resolve(args[ri + 1]) : process.cwd();
  const variant = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--root");
  const { code, lines } = setLogo(variant, { root, dryRun });
  (code ? console.error : console.log)(lines.join("\n"));
  process.exit(code);
}

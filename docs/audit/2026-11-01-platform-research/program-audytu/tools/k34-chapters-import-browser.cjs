/* Browser acceptance for the actual chapter replacement dialog; fixture state and descriptions are synthetic. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { expect } = require('@playwright/test');
const playwright = require('playwright');

const root = process.cwd();
const toolsDir = path.join(root, 'docs/audit/2026-11-01-platform-research/program-audytu/tools');
const evidenceDir = path.join(root, 'docs/audit/2026-11-01-platform-research/program-audytu/evidence');
const browserName = process.env.K34_BROWSER || 'chromium';
if (!['chromium', 'firefox'].includes(browserName)) throw new Error('K34_BROWSER must be chromium or firefox');
const browserType = playwright[browserName];
const sourceFiles = [
  'docs/audit/2026-11-01-platform-research/program-audytu/tools/k34-chapters-import-browser.cjs',
  'docs/audit/2026-11-01-platform-research/program-audytu/tools/k34-chapters-import-harness.tsx',
  'app/components/studio/VideoChaptersEditor.tsx',
  'app/components/studio/ConfirmDialog.tsx',
  'app/components/studio/chapters-form.ts',
  'components/ui/dialog.tsx',
  'lib/video-chapters.ts',
  'app/globals.css',
  'tailwind.config.ts',
];
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'polutek-k34-chapters-'));
let browser;
let server;

async function main() {
  const css = await postcss([tailwind({ base: root, optimize: false })])
    .process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  fs.writeFileSync(path.join(temp, 'app.css'), css.css);
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(toolsDir, 'k34-chapters-import-harness.tsx')],
    outfile: path.join(temp, 'bundle.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    alias: { '@': root },
    logLevel: 'silent',
  });

  const html = '<!doctype html><html lang="pl"><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
  server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }
    const file = req.url === '/app.css' ? 'app.css' : req.url === '/bundle.js' ? 'bundle.js' : null;
    if (!file || !fs.existsSync(path.join(temp, file))) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(fs.readFileSync(path.join(temp, file)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const blocked = [];
  const errors = [];
  await context.route('**/*', (route) => route.request().url().startsWith(`${origin}/`)
    ? route.continue()
    : (blocked.push(route.request().url()), route.abort()));
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.researchReady === true);

  const rows = page.getByTestId('rows');
  const originalRows = await rows.textContent();
  const importButton = page.getByRole('button', { name: 'Importuj z opisu' });
  await importButton.click();
  let dialog = page.getByRole('alertdialog', { name: 'Zastąpić listę rozdziałów?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-describedby');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveText(originalRows);
  await expect(importButton).toBeFocused();

  await importButton.click();
  dialog = page.getByRole('alertdialog', { name: 'Zastąpić listę rozdziałów?' });
  await dialog.getByRole('button', { name: 'Zastąp' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows).toContainText('Pierwszy nowy rozdział');
  await expect(rows).toContainText('Drugi nowy rozdział');
  await expect(rows).not.toContainText('Stary rozdział');
  await expect(importButton).toBeFocused();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);

  const { execFileSync } = require('node:child_process');
  const evidence = {
    package: 'K34/R35',
    date: '2026-11-07',
    result: 'PASS',
    browser: browserName,
    browserVersion: await browser.version(),
    repositoryHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTreeFiles: [
      'docs/audit/2026-11-01-platform-research/program-audytu/tools/k34-chapters-import-browser.cjs',
      'docs/audit/2026-11-01-platform-research/program-audytu/tools/k34-chapters-import-harness.tsx',
    ],
    sourceSha256: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
    observations: [
      'The replacement dialog has an accessible alertdialog name, modal state, and description.',
      'Focus is within the dialog and remains within it after Tab.',
      'Escape cancels replacement, preserves the original chapter list, and restores focus to the import button.',
      'Confirm replaces the prior chapters with the parsed Polish description and restores focus to the import button.',
    ],
    checks: { pageErrors: errors.length, blockedExternalRequests: blocked.length },
    limitations: [
      'Actual VideoChaptersEditor and ConfirmDialog with project CSS; static local harness, not Next or the Studio page.',
      'Callbacks use synthetic local React state; no API, account, database, screen reader, or mobile hardware.',
    ],
    testCommand: `K34_BROWSER=${browserName} node docs/audit/2026-11-01-platform-research/program-audytu/tools/k34-chapters-import-browser.cjs`,
  };
  fs.mkdirSync(evidenceDir, { recursive: true });
  const resultPath = path.join(evidenceDir, `k34-chapters-import-${browserName}-2026-11-07.json`);
  fs.writeFileSync(resultPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ result: evidence.result, browserVersion: evidence.browserVersion, checks: evidence.checks, evidence: path.relative(root, resultPath) }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
});

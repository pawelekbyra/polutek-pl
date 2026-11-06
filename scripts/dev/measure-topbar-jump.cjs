// Pomiar topbara (header.polutek-watch-nav) w prawdziwym Chromium przy otwieraniu panelu konta i dialogu Base UI.
// Wymaga: node scripts/dev/topbar-jump-harness.cjs (buduje .harness-topbar/dist).
// Uzycie: node scripts/dev/measure-topbar-jump.cjs <katalogWyjsciowy> [--frames]  (kod wyjscia 1, gdy topbar sie przesunie)
const path = require("path");
const fs = require("fs");
const http = require("http");
const root = path.resolve(__dirname, "../..");
const dist = path.join(root, ".harness-topbar/dist");
const outDir = process.argv[2] || "/tmp/topbar-jump";
const frames = process.argv.includes("--frames");
const { chromium } = require(path.join(root, "node_modules/playwright-core"));
const exe = process.env.CHROMIUM_PATH || undefined;
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  const f = path.join(dist, req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html" });
    res.end(d);
  });
});

const sampler = () => {
  window.__s = [];
  const bar = document.querySelector("header.polutek-watch-nav");
  const tick = () => {
    const r = bar.getBoundingClientRect();
    const rs = getComputedStyle(document.documentElement), bs = getComputedStyle(document.body);
    window.__s.push({ t: Math.round(performance.now()), top: r.top, left: r.left, width: r.width, height: r.height, scrollY: window.scrollY,
      htmlOv: rs.overflow, bodyOv: bs.overflow, bodyPR: bs.paddingRight, bodyPos: bs.position, bodyTop: bs.top, htmlClientW: document.documentElement.clientWidth });
    window.__raf = requestAnimationFrame(tick);
  };
  tick();
};

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const rows = [];
  const cases = [];
  for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]])
    for (const scroll of [0, 40, 700])
      for (const sb of ["classic", "overlay"])
        for (const trigger of ["avatar", "dialog"]) cases.push({ w, h, scroll, sb, trigger });
  for (const c of cases) {
    const args = ["--no-sandbox"];
    if (c.sb === "overlay") args.push("--enable-features=OverlayScrollbar");
    const browser = await chromium.launch({ executablePath: exe, args, ignoreDefaultArgs: ["--hide-scrollbars"] });
    const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, hasTouch: c.w < 500, isMobile: false });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForSelector("header.polutek-watch-nav");
    await page.evaluate((y) => window.scrollTo(0, y), c.scroll);
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => ({ docW: document.documentElement.clientWidth, win: innerWidth, scrollY, hh: getComputedStyle(document.documentElement).getPropertyValue("--header-h") }));
    await page.evaluate(sampler);
    await page.waitForTimeout(120);
    const trig = c.trigger === "avatar" ? 'button[aria-label="Menu konta"]' : "#dlg-trigger";
    if (frames && c.w === 1366 && c.scroll === 40 && c.sb === "classic" && c.trigger === "avatar") {
      // Slow motion (10%) so the 200 ms slide-in can be captured; a red reference line sits where the bar ends at rest.
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Animation.enable");
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
      await page.evaluate((bottom) => {
        const l = document.createElement("div");
        l.style.cssText = `position:fixed;left:0;right:0;top:${bottom}px;height:1px;background:red;z-index:99999;pointer-events:none`;
        const t = document.createElement("div");
        t.id = "__lbl"; t.style.cssText = "position:fixed;left:6px;top:50px;z-index:99999;font:11px monospace;color:red;background:#fffa;padding:1px 3px;pointer-events:none";
        document.body.append(l, t);
      }, 47);
      await page.click(trig);
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => { const r = document.querySelector("header.polutek-watch-nav").getBoundingClientRect(); document.getElementById("__lbl").textContent = `bar top=${r.top.toFixed(1)} left=${r.left.toFixed(1)} scrollY=${scrollY}`; });
        await page.screenshot({ path: path.join(outDir, `klatka-${i + 1}.png`), clip: { x: 0, y: 0, width: c.w, height: 90 } });
        await page.waitForTimeout(250);
      }
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
      await page.evaluate(() => { document.getElementById("__lbl")?.remove(); });
    } else {
      await page.click(trig);
    }
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__s; });
    const b = s[0];
    const dys = s.map((x) => x.top - b.top), dxs = s.map((x) => x.left - b.left), dws = s.map((x) => x.width - b.width);
    const worst = (a) => a.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
    const mid = s.find((x) => x.bodyOv === "hidden" || x.htmlOv === "hidden");
    rows.push({ ...c, scrollbarW: info.win - info.docW, startTop: b.top, startScrollY: b.scrollY, maxDy: worst(dys), maxDx: worst(dxs), maxDw: worst(dws), endScrollY: s[s.length - 1].scrollY, lockedHtml: mid && mid.htmlOv, lockedBody: mid && mid.bodyOv, bodyPR: mid && mid.bodyPR, n: s.length });
    await browser.close();
  }
  server.close();
  const fmt = (r) => `${String(r.w).padStart(4)} ${String(r.scroll).padStart(4)} ${r.sb.padEnd(7)} ${r.trigger.padEnd(6)} sb=${String(r.scrollbarW).padStart(2)}  top0=${r.startTop}  dy=${r.maxDy}  dx=${r.maxDx}  dw=${r.maxDw}  scrollY ${r.startScrollY}->${r.endScrollY}  lock(html=${r.lockedHtml},body=${r.lockedBody},padR=${r.bodyPR})`;
  const text = "vw   scrollY sbar    trigger  (px, rel. do stanu przed otwarciem)\n" + rows.map(fmt).join("\n") + "\n";
  fs.writeFileSync(path.join(outDir, "pomiary.txt"), text);
  fs.writeFileSync(path.join(outDir, "pomiary.json"), JSON.stringify(rows, null, 1));
  console.log(text);
  const bad = rows.filter((r) => Math.abs(r.maxDy) > 0.01 || Math.abs(r.maxDx) > 0.01 || Math.abs(r.maxDw) > 0.01 || r.endScrollY !== r.startScrollY);
  if (bad.length) { console.log(`PRZESUNIECIE w ${bad.length}/${rows.length} przypadkach`); process.exit(1); }
  console.log("OK: topbar nieruchomy we wszystkich przypadkach");
})().catch((e) => { console.error(e); process.exit(2); });

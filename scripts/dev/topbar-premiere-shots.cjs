// Zrzuty i pomiary topbara z napisem PREMIERA (prawdziwy Chromium). Wymaga: node scripts/dev/topbar-premiere-harness.cjs
// Uzycie: node scripts/dev/topbar-premiere-shots.cjs <katalogWyjsciowy> [szerokosci,po,przecinku] [jezyki,po,przecinku] [signed:0|1|both]
const path = require("path");
const fs = require("fs");
const http = require("http");
const root = path.resolve(__dirname, "../..");
const dist = path.join(root, ".harness-premiere/dist");
const outDir = process.argv[2] || "/tmp/shots-premiere";
const widths = (process.argv[3] || "1280,1024,768,430,360").split(",").map(Number);
const langs = (process.argv[4] || "pl").split(",");
const signedArg = process.argv[5] || "both";
const signedList = signedArg === "both" ? [0, 1] : [Number(signedArg)];
const { chromium } = require(path.join(root, "node_modules/playwright-core"));
fs.mkdirSync(outDir, { recursive: true });
const types = { svg: "image/svg+xml", js: "text/javascript", css: "text/css", html: "text/html", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  let f = path.join(dist, u === "/" ? "index.html" : u);
  if (!fs.existsSync(f)) f = path.join(root, "public", u); // logo-glasses.svg itp.
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[f.split(".").pop()] || "application/octet-stream" });
    res.end(d);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const rows = [];
  for (const lang of langs) for (const signed of signedList) for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 160 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${base}?lang=${lang}&signed=${signed}`);
    await page.waitForSelector("header nav");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, t: Math.round(b.top * 10) / 10, b: Math.round(b.bottom * 10) / 10, w: Math.round(b.width * 10) / 10 }; };
      const header = document.querySelector("header");
      const nav = header.querySelector("nav");
      const logo = nav.querySelector("img");
      const note = nav.querySelector('[data-testid="topbar-premiere"]');
      const search = nav.querySelector('form[role="search"]');
      const kids = Array.from(nav.children[0] ? nav.children : []);
      const right = nav.querySelector("div.justify-end");
      const cs = note ? getComputedStyle(note) : null;
      return {
        header: r(header), logo: r(logo), note: note && getComputedStyle(note).display !== "none" ? r(note) : null,
        search: search && search.offsetParent ? r(search) : null, right: r(right),
        scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
        font: cs && cs.display !== "none" ? cs.fontFamily.slice(0, 40) + " " + cs.fontSize : null,
        fontLoaded: document.fonts.check('300 16px "Gaegu Light"'),
        text: note ? note.textContent : null,
      };
    });
    const name = `${lang}-${signed ? "in" : "out"}-${w}`;
    await page.screenshot({ path: path.join(outDir, `${name}.png`), clip: { x: 0, y: 0, width: w, height: Math.ceil(m.header.b) + 6 } });
    rows.push({ name, ...m });
    console.log(name, "bar", m.header.b - m.header.t, "note", JSON.stringify(m.note), "search", m.search && m.search.w, "logoR", m.logo && m.logo.r, "rightL", m.right && m.right.l, "scroll", m.scrollW + "/" + m.clientW, "font", m.font, m.fontLoaded);
    await ctx.close();
  }
  fs.writeFileSync(path.join(outDir, "pomiary.json"), JSON.stringify(rows, null, 1));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });

// Składa prototyp w jeden plik HTML (CSS, dane i JS wstawione inline), np. do podglądu,
// który nie wczytuje osobnych plików z file:// albo do publikacji jako jedna strona.
// Użycie (z katalogu repo):  node docs/design/admin-panel/build-standalone.mjs
// Wynik: docs/design/admin-panel/prototype-standalone.html (nie edytować ręcznie).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(dir, f), "utf8");
let html = read("index.html");

const css = read("styles.css");
html = html.replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>\n${css}\n</style>`);

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error("Nie znaleziono skryptów w index.html");
for (const src of scripts) {
  // "</script" w treści skryptu zamknąłby znacznik, więc zabezpieczamy.
  const js = read(src).replace(/<\/script/gi, "<\\/script");
  html = html.replace(`<script src="${src}"></script>`, () => `<script>/* ${src} */\n${js}\n</script>`);
}
html = html.replace("<head>", "<head>\n  <!-- WYGENEROWANE przez build-standalone.mjs z index.html, styles.css i plików .js. Nie edytuj ręcznie. -->");
writeFileSync(join(dir, "prototype-standalone.html"), html);
console.log(`prototype-standalone.html: ${(html.length / 1024).toFixed(0)} KB, skrypty: ${scripts.join(", ")}`);

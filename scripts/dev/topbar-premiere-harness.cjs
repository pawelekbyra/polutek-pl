// Harness do zrzutow i pomiarow napisu PREMIERA w topbarze.
// Buduje PRAWDZIWY Navbar (+ BrandName, TopbarPremiere, LanguageSwitcher, NotificationBell, UserMenu) i PRAWDZIWY app/globals.css
// do .harness-premiere/dist; mockowane sa tylko next/*, auth i modal konta.
// Uzycie: node scripts/dev/topbar-premiere-harness.cjs, potem: node scripts/dev/topbar-premiere-shots.cjs <katalogWyjsciowy>
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "../..");
const out = path.join(root, ".harness-premiere/dist");
fs.mkdirSync(out, { recursive: true });
const esbuild = require(path.join(root, "node_modules/esbuild"));
(async () => {
  const postcss = require(path.join(root, "node_modules/postcss"));
  const tw = (await import(path.join(root, "node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const res = await postcss([tw({ base: root })]).process(css, { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(out, "app.base.css"), res.css);
  const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import Navbar from "@/app/components/Navbar";
import { LanguageProvider } from "@/app/components/LanguageContext";
import de from "@/lib/i18n/catalog/de.json";
import es from "@/lib/i18n/catalog/es.json";
import fr from "@/lib/i18n/catalog/fr.json";
import it from "@/lib/i18n/catalog/it.json";
import pt from "@/lib/i18n/catalog/pt.json";
import zh from "@/lib/i18n/catalog/zh.json";
const catalogs = { de, es, fr, it, pt, zh };
const q = new URLSearchParams(location.search);
const lang = q.get("lang") || "pl";
window.fetch = async (u) => {
  const s = String(u);
  if (s.includes("unread-count")) return new Response(JSON.stringify({ unreadCount: 3 }));
  if (s.includes("profile")) return new Response(JSON.stringify({ isAdmin: false }));
  return new Response(JSON.stringify({ items: [], unreadCount: 3, nextCursor: null, snapshotAt: new Date().toISOString() }));
};
function App() {
  return (
    <LanguageProvider forcedLanguage={lang} initialLanguage={lang} initialCatalog={catalogs[lang] || null} initialCatalogLanguage={lang}>
      <Navbar isHome />
      <main style={{ padding: 16 }}><h1>Strona</h1><p>Tresc pod paskiem.</p></main>
    </LanguageProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
`;
  const mocks = {
    nav: 'export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}}); export const usePathname=()=>"/"; export const useSearchParams=()=>new URLSearchParams();',
    img: 'import React from "react"; export default function Image(p){const {unoptimized,priority,fill,...r}=p; return <img {...r}/>;}',
    link: 'import React from "react"; export default function Link({href,prefetch,...r}){return <a href={href} {...r}/>;}',
    auth: 'const signed=new URLSearchParams(location.search).get("signed")==="1"; const user=signed?{id:"u1",fullName:"Jan Test",imageUrl:"",primaryEmailAddress:{emailAddress:"jan@example.com"}}:null; export const useUser=()=>({user,isLoaded:true,isSignedIn:signed}); export const useAuth=()=>({signOut:async()=>{},isSignedIn:signed,userId:signed?"u1":null});',
    modal: 'export const useAuthModal=()=>({open(){}});',
    acc: 'export default function AccountModal(){return null;}',
  };
  await esbuild.build({
    stdin: { contents: entry, resolveDir: root, loader: "tsx" },
    absWorkingDir: root, bundle: true, outdir: out, entryNames: "app",
    loader: { ".woff2": "file", ".module.css": "local-css", ".json": "json" },
    assetNames: "assets/[name]",
    define: { "process.env.NODE_ENV": '"production"' }, banner: { js: "var process={env:{NODE_ENV:\"production\"}};" },
    plugins: [{
      name: "mocks", setup(build) {
        const m = (filter, p) => build.onResolve({ filter }, () => ({ path: p, namespace: "mock" }));
        m(/^next\/navigation$/, "nav"); m(/^next\/image$/, "img"); m(/^next\/link$/, "link");
        m(/\/lib\/auth\/react$/, "auth"); m(/\/AuthModalProvider$/, "modal"); m(/\/AccountModal$/, "acc");
        build.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({ loader: "tsx", resolveDir: root, contents: mocks[a.path] }));
      },
    }],
  });
  // esbuild zapisuje CSS modulow do app.css; dokladamy go po bazowym CSS (app.base.css)
  const modulesCss = fs.existsSync(path.join(out, "app.css")) ? fs.readFileSync(path.join(out, "app.css"), "utf8") : "";
  fs.writeFileSync(path.join(out, "app.all.css"), res.css + "\n" + modulesCss);
  fs.writeFileSync(path.join(out, "index.html"), '<!doctype html><html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.all.css"></head><body class="font-sans bg-background text-foreground min-h-[100dvh] relative"><div id="root"></div><script src="app.js"></script></body></html>');
  console.log("built", out);
})().catch((e) => { console.error(e); process.exit(1); });

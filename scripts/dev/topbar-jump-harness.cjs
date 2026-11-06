// Harness do pomiaru topbara przy otwarciu panelu konta / dialogu Base UI.
// Buduje PRAWDZIWE komponenty (UserMenu, ui/dialog) + PRAWDZIWY app/globals.css do .harness-topbar/dist.
// Uzycie: node scripts/dev/topbar-jump-harness.cjs, potem: node scripts/dev/measure-topbar-jump.cjs <katalogWyjsciowy>
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "../..");
const out = path.join(root, ".harness-topbar/dist");
fs.mkdirSync(out, { recursive: true });
const esbuild = require(path.join(root, "node_modules/esbuild"));
(async () => {
  const postcss = require(path.join(root, "node_modules/postcss"));
  const tw = (await import(path.join(root, "node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
  const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const res = await postcss([tw({ base: root })]).process(css, { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(out, "app.css"), res.css);
  const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import UserMenu from "@/app/components/auth/UserMenu";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
window.fetch = async (u) => new Response(JSON.stringify(String(u).includes("subscribed") ? { items: [{ id: "1", slug: "a", handle: null, name: "Kanal" }] } : {}));
function App() {
  return (<>
    <header className="polutek-watch-nav sticky top-0 z-[1000] flex w-full flex-col" data-testid="bar">
      <nav className="flex w-full items-center justify-between gap-3 px-2 py-[3px] md:px-6 lg:px-8" style={{height: 47}}>
        <b>POLUTEK</b>
        <span style={{display:"flex",gap:8,alignItems:"center"}}>
          <Dialog><DialogTrigger id="dlg-trigger">Dialog</DialogTrigger><DialogContent><DialogTitle>Test</DialogTitle>tresc</DialogContent></Dialog>
          <UserMenu isAdmin={false} />
        </span>
      </nav>
    </header>
    <main id="main" style={{padding:16}}><h1>Strona</h1>{Array.from({length:120}).map((_,i)=><p key={i}>Tresc strony pod paskiem, linia {i}. Lorem ipsum dolor sit amet.</p>)}</main>
  </>);
}
createRoot(document.getElementById("root")).render(<App />);
`;
  const mocks = {
    nav: 'export const useRouter=()=>({push(){},replace(){},refresh(){}}); export const usePathname=()=>"/"; export const useSearchParams=()=>new URLSearchParams();',
    img: 'import React from "react"; export default function Image(p){const {unoptimized,...r}=p; return <img {...r}/>;}',
    link: 'import React from "react"; export default function Link({href,...r}){return <a href={href} {...r}/>;}',
    lang: 'import { createTx } from "@/lib/i18n/ui"; const tx=createTx("pl", null); export const useLanguage=()=>({language:"pl",tx});',
    auth: 'export const useUser=()=>({user:{id:"u1",fullName:"Jan Test",imageUrl:"",primaryEmailAddress:{emailAddress:"jan@example.com"}}}); export const useAuth=()=>({signOut:async()=>{}});',
    acc: 'import React from "react"; import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"; export default function AccountModal({open,onOpenChange}){return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogTitle>Moje konto</DialogTitle>konto</DialogContent></Dialog>;}',
    ls: 'import React from "react"; export default function LS(){return <button>PL</button>;}',
  };
  await esbuild.build({
    stdin: { contents: entry, resolveDir: root, loader: "tsx" },
    absWorkingDir: root, bundle: true, outfile: path.join(out, "app.js"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "mocks", setup(build) {
        const m = (filter, p) => build.onResolve({ filter }, () => ({ path: p, namespace: "mock" }));
        m(/^next\/navigation$/, "nav"); m(/^next\/image$/, "img"); m(/^next\/link$/, "link");
        m(/LanguageContext$/, "lang"); m(/\/lib\/auth\/react$/, "auth"); m(/\/AccountModal$/, "acc"); m(/\/LanguageSwitcher$/, "ls");
        build.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({ loader: "tsx", resolveDir: root, contents: mocks[a.path] }));
      },
    }],
  });
  fs.writeFileSync(path.join(out, "index.html"), '<!doctype html><html lang="pl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="app.css"></head><body class="font-sans bg-background text-foreground min-h-[100dvh] relative"><div id="root"></div><script src="app.js"></script></body></html>');
  console.log("built", out);
})().catch((e) => { console.error(e); process.exit(1); });

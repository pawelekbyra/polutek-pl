import type { Metadata } from "next";
import { headers } from "next/headers";
import { getEmbedView, type EmbedView } from "@/lib/modules/syndication";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api/client-ip";
import { resolveDocumentLanguage } from "@/lib/i18n/server-language";
import { getServerTx } from "@/lib/i18n/server-tx";
import { getExplicitLocaleHref } from "@/lib/i18n/routing";
import { getBaseUrl } from "@/lib/utils";
import { APP_NAME, SITE_TITLE } from "@/lib/constants";
import EmbedPlayer from "./EmbedPlayer";

// Per request and never shared: the answer depends on the video's current state. Reads NO cookie and NO session on the
// server (the language comes from the proxy, which derives it from ?lang= and request headers only; see middleware.ts).
export const dynamic = "force-dynamic";

// A playback surface inside someone else's page, never a landing page: noindex (the proxy also sends X-Robots-Tag).
export const metadata: Metadata = {
  title: SITE_TITLE,
  robots: { index: false, follow: false, nocache: true },
};

const EMBED_PAGE_LIMIT = 120;
const EMBED_PAGE_WINDOW_MS = 60 * 1000;

/** Per-IP limit like the other public endpoints. A limiter outage never breaks embeds; a limited visitor sees the neutral card. */
async function isRateLimited(): Promise<boolean> {
  try {
    const result = await rateLimit({
      key: `embed-page:${getClientIp(await headers())}`,
      limit: EMBED_PAGE_LIMIT,
      windowMs: EMBED_PAGE_WINDOW_MS,
    });
    return !result.success;
  } catch {
    return false;
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white">
      {children}
    </main>
  );
}

export default async function EmbedPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const locale = await resolveDocumentLanguage();
  const tx = await getServerTx(locale);

  const view: EmbedView = (await isRateLimited()) ? { kind: "unavailable" } : await getEmbedView(slug);

  if (view.kind === "embeddable") return <EmbedPlayer video={view.video} />;

  if (view.kind === "site-only") {
    const watchUrl = `${getBaseUrl()}${getExplicitLocaleHref(locale, "home")}?v=${encodeURIComponent(view.slug)}`;
    return (
      <Card>
        <h1 className="max-w-xl text-lg font-bold leading-snug">{view.title}</h1>
        <p className="max-w-md text-sm text-white/70">{tx("Ten film można obejrzeć tylko na stronie.", "This video can only be watched on the site.")}</p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold uppercase tracking-wider text-black hover:opacity-90"
        >
          {tx("Obejrzyj na {0}", "Watch on {0}", APP_NAME)}
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-lg font-bold">{tx("Film niedostępny", "Video unavailable")}</h1>
      <p className="max-w-md text-sm text-white/70">{tx("Ten film nie istnieje albo nie jest już publiczny.", "This video does not exist or is no longer public.")}</p>
    </Card>
  );
}

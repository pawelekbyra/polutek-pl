// patron zone (docs/architecture/patron-zone.md): the DRAFT "Patron Zone Terms" page.
// A short list of what the patron zone is; the real terms come with a lawyer before the first real sale. 404 when the
// patron zone is invisible to the viewer. The site's real legal documents (LegalDocs.tsx) do not change.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { getActorFromAuth } from "@/lib/api/auth";
import { premiumPassFor, resolvePremiumPayments } from "@/lib/modules/patron-zone";
import { getServerTx } from "@/lib/i18n/server-tx";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { DemoRibbon } from "./DemoRibbon";
import { PassTermsContent, passTermsTitle } from "./PassTermsContent";

export type PassTermsPageProps = { params: Promise<{ locale: string }> };

export async function passTermsMetadata(props: PassTermsPageProps): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const tx = await getServerTx(isLocale(raw) ? raw : "pl");
  return { title: `${passTermsTitle(tx)} · ${APP_NAME}`, robots: { index: false, follow: false } };
}

export default async function PassTermsPage({ params, expected }: PassTermsPageProps & { expected: "pl" | "other" }) {
  const { locale: raw } = await params;
  if (!isLocale(raw) || (expected === "pl") !== (raw === "pl")) notFound();
  if (!premiumPassFor(await getActorFromAuth())) notFound();
  const locale: Locale = raw;
  const tx = await getServerTx(locale);
  const demo = resolvePremiumPayments().mode === "demo";
  return (
    <div className="min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)]">
      {demo && <DemoRibbon />}
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-14 focus:outline-none">
        <h1 className="text-[clamp(1.25rem,5.4vw,1.875rem)] font-black tracking-tight">{passTermsTitle(tx)}</h1>
        <div className="mt-6">
          <PassTermsContent
            tx={tx}
            locale={locale}
            demo={demo}
            termsLink={<a className="font-bold underline" href={getLocalizedHref(locale, "terms")}>{tx("Regulamin serwisu", "Terms of service")}</a>}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

// experiment: premium-pass (docs/experiments/premium-pass.md, section 9): the draft "Pass Terms" page of the demo.
// One paragraph: it is a look at the layout, no contract is made and nothing is charged. 404 when the experiment is
// invisible to the viewer. The site's real legal documents (LegalDocs.tsx) do not change.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { getActorFromAuth } from "@/lib/api/auth";
import { premiumPassFor } from "@/lib/modules/experiment-premium-pass";
import { getServerTx } from "@/lib/i18n/server-tx";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { DemoRibbon } from "./DemoRibbon";
import { sellerLine, vatLine } from "./pass-copy";
import { PASS_VAT_RATE_PERCENT } from "@/lib/modules/experiment-premium-pass";

export type PassTermsPageProps = { params: Promise<{ locale: string }> };

export async function passTermsMetadata(props: PassTermsPageProps): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const tx = await getServerTx(isLocale(raw) ? raw : "pl");
  return { title: `${tx("Regulamin wejściówki (projekt, DEMO)", "Pass Terms (draft, DEMO)")} · ${APP_NAME}`, robots: { index: false, follow: false } };
}

export default async function PassTermsPage({ params, expected }: PassTermsPageProps & { expected: "pl" | "other" }) {
  const { locale: raw } = await params;
  if (!isLocale(raw) || (expected === "pl") !== (raw === "pl")) notFound();
  if (!premiumPassFor(await getActorFromAuth())) notFound();
  const locale: Locale = raw;
  const tx = await getServerTx(locale);
  return (
    <div className="min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)]">
      <DemoRibbon />
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-14 focus:outline-none">
        <h1 className="text-[clamp(1.25rem,5.4vw,1.875rem)] font-black tracking-tight">{tx("Regulamin wejściówki (projekt, DEMO)", "Pass Terms (draft, DEMO)")}</h1>
        <p className="mt-6 text-[15px] leading-relaxed">
          {tx(
            "To jest pokaz wyglądu sprzedaży wejściówki. Żadna umowa nie jest zawierana, nic nie jest pobierane, a wejściówka demo nie ma wartości. Właściwy regulamin powstanie razem z prawnikiem przed prawdziwą sprzedażą. Obowiązują zwykłe dokumenty serwisu.",
            "This is a preview of how selling a pass would look. No contract is made, nothing is charged and the demo pass has no value. The real terms will be written with a lawyer before any real sale. The site's usual documents apply.",
          )}
        </p>
        <p className="mt-4 text-[14px] text-[var(--chan-muted)]">{sellerLine(tx)} · {vatLine(tx, PASS_VAT_RATE_PERCENT)} · support@pawelperfect.com</p>
        <p className="mt-8">
          <a className="font-bold underline" href={getLocalizedHref(locale, "terms")}>{tx("Regulamin serwisu", "Terms of service")}</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}

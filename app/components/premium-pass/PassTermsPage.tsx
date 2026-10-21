// patron zone (docs/architecture/patron-zone.md): the DRAFT "Patron Zone Terms" page.
// A short list of what the patron zone is; the real terms come with a lawyer before the first real sale. 404 when the
// patron zone is invisible to the viewer. The site's real legal documents (LegalDocs.tsx) do not change.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { getActorFromAuth } from "@/lib/api/auth";
import {
  PATRON_PRICES,
  PATRON_VAT_RATE_PERCENT,
  premiumPassFor,
  resolvePremiumPayments,
} from "@/lib/modules/patron-zone";
import { getServerTx } from "@/lib/i18n/server-tx";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";
import { APP_NAME } from "@/lib/constants";
import { DemoRibbon } from "./DemoRibbon";
import { PATRON_SUPPORT_EMAIL, price, sellerLine, vatLine } from "./pass-copy";

export type PassTermsPageProps = { params: Promise<{ locale: string }> };

export async function passTermsMetadata(props: PassTermsPageProps): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const tx = await getServerTx(isLocale(raw) ? raw : "pl");
  return { title: `${tx("Regulamin strefy patrona (projekt)", "Patron Zone Terms (draft)")} · ${APP_NAME}`, robots: { index: false, follow: false } };
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
        <h1 className="text-[clamp(1.25rem,5.4vw,1.875rem)] font-black tracking-tight">{tx("Regulamin strefy patrona (projekt)", "Patron Zone Terms (draft)")}</h1>
        <p className="mt-6 text-[15px] leading-relaxed">
          {demo
            ? tx(
                "To jest projekt regulaminu i pokaz sprzedaży dostępu do strefy patrona. Żadna umowa nie jest zawierana, a nic nie jest pobierane. Właściwy regulamin powstanie razem z prawnikiem przed prawdziwą sprzedażą.",
                "This is a draft of the terms and a preview of how access to the patron zone would be sold. No contract is made and nothing is charged. The real terms will be written with a lawyer before any real sale.",
              )
            : tx(
                "To jest projekt regulaminu strefy patrona; ostateczny tekst zatwierdzi prawnik przed pierwszą prawdziwą sprzedażą. Obowiązują też zwykłe dokumenty serwisu.",
                "This is a draft of the patron zone terms; a lawyer approves the final text before the first real sale. The site's usual documents apply as well.",
              )}
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
          <li>{tx("Strefa patrona to zamknięta część serwisu z filmami dla patronów projektu.", "The patron zone is a closed part of the site with videos for the project's patrons.")}</li>
          <li>{tx("Dostęp na 30 dni kosztuje {0}, a dostęp bez limitu {1} (ceny brutto; w innych walutach ceny są pokazane w kasie). Dostęp na 30 dni możesz przedłużać kolejnymi wpłatami; dostęp bez limitu płacisz raz i nie ma on końca.", "30-day access costs {0} and unlimited access {1} (gross prices; prices in other currencies are shown at checkout). You can extend 30-day access with further payments; unlimited access is paid once and has no end date.", price(locale, PATRON_PRICES.ACCESS_30D.PLN), price(locale, PATRON_PRICES.ACCESS_LIFETIME.PLN))}</li>
          <li>{tx("To nie jest subskrypcja: nic nie odnawia się samo i nie ma czego anulować.", "This is not a subscription: nothing renews by itself and there is nothing to cancel.")}</li>
          <li>{tx("Dostęp otwiera się od razu po potwierdzeniu płatności. Przed zapłatą prosimy o zgodę na to, że od rozpoczęcia oglądania tracisz prawo odstąpienia od umowy (treści cyfrowe).", "Access opens right after the payment is confirmed. Before you pay we ask for your consent that once you start watching you lose the right to withdraw from the contract (digital content).")}</li>
          <li>{tx("Reklamacje i zwroty: support@polutek.com.", "Complaints and refunds: support@polutek.com.")}</li>
        </ul>
        <p className="mt-4 text-[14px] text-[var(--chan-muted)]">{sellerLine(tx)} · {vatLine(tx, PATRON_VAT_RATE_PERCENT)} · {PATRON_SUPPORT_EMAIL}</p>
        <p className="mt-8">
          <a className="font-bold underline" href={getLocalizedHref(locale, "terms")}>{tx("Regulamin serwisu", "Terms of service")}</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}

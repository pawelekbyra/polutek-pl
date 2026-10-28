// patron zone (docs/architecture/patron-zone.md): the BODY of the DRAFT "Patron Zone Terms". One source of the text for
// the standalone page (PassTermsPage) and for the legal sheet opened from inside the checkout (LegalSheet), so the legal
// wording exists once. No hooks and no data fetching: callers pass the translator, the language and the payments mode.
import type { ReactNode } from "react";
import type { Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";
import { PATRON_PRICES } from "@/lib/modules/patron-zone/domain/config";
import { PATRON_SUPPORT_EMAIL, price, sellerLine, vatLine } from "./pass-copy";

/** The draft's own title (the page h1 and the sheet title). */
export function passTermsTitle(tx: Tx): string {
  return tx("Regulamin strefy patrona (projekt)", "Patron Zone Terms (draft)");
}

export function PassTermsContent({ tx, locale, demo, termsLink }: { tx: Tx; locale: Locale; demo: boolean; termsLink: ReactNode }) {
  return (
    <>
      <p className="text-[15px] leading-relaxed">
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
      <p className="mt-4 text-[14px] text-[var(--chan-muted)]">{sellerLine(tx)} · {vatLine(tx)} · {PATRON_SUPPORT_EMAIL}</p>
      <p className="mt-8">{termsLink}</p>
    </>
  );
}

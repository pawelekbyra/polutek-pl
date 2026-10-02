import React from 'react';

export const LEGAL_EFFECTIVE_DATE = 'Obowiązuje od 26 września 2026 r.';
export const LEGAL_EFFECTIVE_DATE_EN = 'Effective as of 26 September 2026.';

/**
 * The service is run by a private individual (see § 1 of the Terms). Every legal document —
 * Terms and Privacy Policy, PL and EN — names the same person and this one contact address.
 */
export const LEGAL_CONTACT_EMAIL = 'hello@pawelperfect.com';

export function LegalSection({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 text-lg font-black uppercase tracking-tight text-[var(--chan-ink)]">
        <span className="text-primary tabular-nums">{nr}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-[1.7] text-[var(--chan-body)]">{children}</div>
    </section>
  );
}

export function LegalSummary({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="mb-12 rounded-xl border border-[var(--chan-ink)]/15 bg-white/60 p-5 text-[14px] leading-[1.7]">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--chan-muted)]">W skrócie</p>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Full Terms of Service body (no page chrome), shared by the /regulamin page and the support-box modal. */
export function RegulaminContent() {
  return (
    <>
      <div className="space-y-10">
        <LegalSection nr="1" title="Informacje o serwisie">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Twórcą i administratorem serwisu WWW.PAWELPERFECT.COM jest Paweł Perfect (dalej: „Twórca”). Adres do
              doręczeń: ul. Złota 75, 00-819 Warszawa, e-mail w sprawach technicznych:{' '}
              <a href="mailto:support@pawelperfect.com" className="underline hover:text-primary">support@pawelperfect.com</a>.
            </li>
            <li>
              Serwis ma charakter niekomercyjny. Twórca nie prowadzi za pośrednictwem Serwisu sprzedaży towarów, usług
              ani treści cyfrowych. Wszelkie wpłaty dokonywane na rzecz Twórcy mają charakter dobrowolnego wsparcia
              (darowizny) i nie stanowią zapłaty za towary, usługi ani treści cyfrowe.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="2" title="Zakres serwisu i wymagania techniczne">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Serwis udostępnia materiały wideo. Dostęp do treści nigdy nie wymaga płatności — dobrowolne wsparcie
              Twórcy nie wpływa na to, co użytkownik może oglądać.
            </li>
            <li>
              Część materiałów wideo oraz niektóre funkcje, np. komentowanie, wymagają założenia bezpłatnego konta.
              Pozostałe materiały są dostępne bez logowania.
            </li>
            <li>
              Do korzystania z serwisu potrzebne są urządzenie z aktualną przeglądarką internetową z włączoną obsługą
              JavaScript oraz dostęp do internetu. Założenie konta wymaga podania adresu e-mail.
            </li>
            <li>
              Twórca nie gwarantuje poprawnego działania serwisu w przestarzałych przeglądarkach, na urządzeniach
              nieobsługujących nowoczesnych standardów wideo ani przy zablokowanych skryptach lub elementach
              potrzebnych do logowania i odtwarzania.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="3" title="Konto i zasady korzystania">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Konto jest bezpłatne i można je usunąć w każdej chwili.
            </li>
            <li>
              W serwisie, w szczególności w komentarzach, nie wolno publikować treści bezprawnych, obraźliwych ani
              spamu. Twórca może usuwać takie treści, a w przypadku rażących naruszeń zablokować konto bez wcześniejszego ostrzeżenia.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="4" title="Wsparcie Twórcy">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Osoba posiadająca konto może przekazać Twórcy dobrowolne wsparcie w dowolnej kwocie jako wyraz
              podziękowania za udostępnione materiały. Przekazanie wsparcia wymaga zalogowania się do serwisu.
            </li>
            <li>
              Wsparcie jest darowizną na rzecz Twórcy. Nie jest ceną ani wynagrodzeniem za jakiekolwiek treści lub usługi.
            </li>
            <li>
              Wsparcie nie daje dostępu do żadnych treści, funkcji, wyróżnień ani innych korzyści. Nie zobowiązuje też
              Twórcy do żadnego świadczenia, np. do publikowania nowych materiałów.
            </li>
            <li>
              Wsparcie nie jest zapłatą za sprzedaż, dlatego Twórca nie wystawia do niego faktur ani rachunków.
            </li>
            <li>
              Płatności obsługuje Stripe. Twórca nie przechowuje danych kart płatniczych. Potwierdzenie wpłaty wysyła operator płatności.
            </li>
            <li>
              Wsparcie nie podlega zwrotowi, z wyjątkiem wpłat dokonanych omyłkowo (np. podwójna płatność lub błędna
              kwota) albo bez zgody posiadacza karty.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="5" title="Zmiany regulaminu">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Twórca może zmienić regulamin, w szczególności w razie zmiany przepisów, funkcji serwisu lub sposobu jego działania.
            </li>
            <li>
              Zmiany regulaminu wchodzą w życie z chwilą ich opublikowania w serwisie.
            </li>
            <li>
              Dalsze korzystanie z serwisu po opublikowaniu zmian oznacza ich akceptację.
            </li>
          </ol>
        </LegalSection>
      </div>
    </>
  );
}

const DATA_ROWS = [
  { what: 'Konto i logowanie', data: 'e-mail, nazwa, avatar', why: 'prowadzenie konta i zapewnienie dostępu do funkcji serwisu' },
  { what: 'Wsparcie (płatności)', data: 'kwota, data, identyfikator płatności, e-mail, status płatności', why: 'obsługa dobrowolnego wsparcia, potwierdzenia i obowiązki podatkowe' },
  { what: 'Komentarze', data: 'treść, nazwa, data', why: 'publiczna dyskusja pod filmami i moderacja' },
  { what: 'E-maile transakcyjne', data: 'adres e-mail', why: 'potwierdzenia wpłat, bezpieczeństwo konta (np. zmiana hasła) i istotne informacje o serwisie' },
  { what: 'Powiadomienia marketingowe', data: 'adres e-mail', why: 'wysyłka newslettera lub informacji marketingowych, wyłącznie gdy udzielisz odrębnej zgody' },
  { what: 'Bezpieczeństwo', data: 'adres IP, logi techniczne', why: 'ochrona serwisu przed nadużyciami i limity zapytań' },
];

/** Full Privacy Policy body (no page chrome), shared by the /polityka-prywatnosci page and the modal. */
export function PolitykaContent() {
  return (
    <>
      <LegalSummary
        items={[
          'Zbieramy tylko to, co potrzebne do działania serwisu: konto, wpłaty wsparcia, komentarze, e-maile transakcyjne i logi bezpieczeństwa.',
          'Niczego nie sprzedajemy i nie profilujemy Cię reklamowo. Brak cookies reklamowych.',
          <>Zawsze możesz poprosić o dostęp do swoich danych albo ich usunięcie: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a>.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Administrator danych">
          <p>
            Administratorem Twoich danych osobowych jest Paweł Perfect, osoba fizyczna prowadząca serwis
            WWW.PAWELPERFECT.COM, adres do korespondencji: ul. Złota 75, 00-819 Warszawa.
          </p>
          <p>W sprawach danych osobowych pisz na adres <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a>.</p>
        </LegalSection>

        <LegalSection nr="2" title="Jakie dane zbieramy i po co">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b-2 border-[var(--chan-ink)]/15 text-left">
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Obszar</th>
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Dane</th>
                  <th className="py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Po co</th>
                </tr>
              </thead>
              <tbody>
                {DATA_ROWS.map((row) => (
                  <tr key={row.what} className="border-b border-dashed border-[var(--chan-ink)]/10 align-top">
                    <td className="py-3 pr-4 font-bold">{row.what}</td>
                    <td className="py-3 pr-4">{row.data}</td>
                    <td className="py-3">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Podstawy prawne przetwarzania danych zależą od celu: prowadzenie konta i korzystanie z serwisu na
            zasadach regulaminu oraz obsługa dobrowolnego wsparcia (darowizny) — wykonanie umowy (art. 6 ust. 1
            lit. b RODO); obowiązki wynikające z przepisów, np. podatkowych — obowiązek prawny (art. 6 ust. 1 lit. c
            RODO); bezpieczeństwo serwisu, zapobieganie nadużyciom oraz ustalenie, obrona i dochodzenie roszczeń —
            nasz prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO); newsletter lub informacje marketingowe —
            Twoja odrębna zgoda (art. 6 ust. 1 lit. a RODO), jeżeli jej udzielisz.
          </p>
        </LegalSection>

        <LegalSection nr="3" title="Komu powierzamy dane">
          <p>
            Korzystamy z zaufanych dostawców technologii: Clerk (logowanie), Stripe (płatności), Resend (e-maile),
            Vercel (hosting), Neon (baza danych), Cloudflare (wideo i infrastruktura) i Upstash (ochrona przed nadużyciami).
            W zależności od rodzaju usługi dostawcy mogą działać jako podmioty przetwarzające dane na nasze polecenie
            albo jako odrębni administratorzy danych w zakresie niezbędnym do realizacji własnych obowiązków prawnych,
            bezpieczeństwa i działania infrastruktury — w szczególności dotyczy to operatora płatności Stripe.
          </p>
          <p>
            Część dostawców może przetwarzać dane poza Europejskim Obszarem Gospodarczym. Transfer odbywa się na podstawie
            dostępnych mechanizmów przewidzianych przez prawo, takich jak Data Privacy Framework, standardowe klauzule
            umowne lub inne właściwe zabezpieczenia. Nikomu nie sprzedajemy Twoich danych.
          </p>
        </LegalSection>

        <LegalSection nr="4" title="Jak długo przechowujemy dane">
          <p>
            Dane konta przechowujemy do czasu jego usunięcia, a następnie przez okres niezbędny do obrony roszczeń
            i realizacji obowiązków prawnych. Dane wpłat przechowujemy przez okres wymagany przez przepisy,
            w szczególności podatkowe. Logi techniczne przechowujemy co do zasady do 90 dni, chyba że dłuższe
            przechowywanie jest potrzebne do wyjaśnienia nadużyć, awarii lub roszczeń.
            Komentarze przechowujemy do czasu ich usunięcia przez Ciebie lub moderację.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Twoje prawa">
          <p>
            Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
            przenoszenia oraz sprzeciwu. Jeżeli dane przetwarzamy na podstawie zgody, możesz ją w każdej chwili wycofać,
            co nie wpływa na zgodność z prawem przetwarzania sprzed jej wycofania. Wystarczy wysłać e-mail na{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a> —
            w ten sposób usuniesz też konto. Możesz również złożyć skargę do Prezesa Urzędu Ochrony Danych
            Osobowych (uodo.gov.pl).
          </p>
        </LegalSection>

        <LegalSection nr="6" title="E-maile i powiadomienia">
          <p>
            E-maile transakcyjne, takie jak potwierdzenie wpłaty, powiadomienie o zmianie hasła lub o istotnych
            zmianach w serwisie, wysyłamy w związku z korzystaniem z serwisu na zasadach regulaminu albo naszym
            obowiązkiem informacyjnym. Newsletter, informacje
            marketingowe lub promocyjne wysyłamy wyłącznie wtedy, gdy udzielisz odrębnej zgody. Z takich wiadomości
            możesz wypisać się w każdej chwili.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Cookies">
          <p>
            Używamy wyłącznie plików cookies i podobnych technologii niezbędnych do działania serwisu: utrzymania sesji
            po zalogowaniu, bezpieczeństwa, ochrony przed nadużyciami i odtwarzania materiałów. Nie używamy cookies
            reklamowych ani śledzących. Jeżeli w przyszłości dodamy narzędzia analityczne lub marketingowe wymagające zgody,
            poprosimy o nią przed ich użyciem. Cookies możesz usunąć w ustawieniach przeglądarki — serwis bez zalogowania
            będzie działał normalnie, ale część funkcji konta może wymagać cookies niezbędnych.
          </p>
        </LegalSection>

        <LegalSection nr="8" title="Zmiany polityki">
          <p>
            Jeśli polityka się zmieni (np. dojdzie nowy dostawca), zaktualizujemy ten dokument i datę na górze strony.
            Istotne zmiany zakomunikujemy w serwisie.
          </p>
        </LegalSection>
      </div>
    </>
  );
}

/** Full Terms of Service body (English translation, no page chrome), used by the /en/terms page. */
export function TermsContentEn() {
  return (
    <>
      <div className="space-y-10">
        <LegalSection nr="1" title="Information about the service">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The creator and administrator of the service WWW.PAWELPERFECT.COM is Paweł Perfect (hereinafter: the &ldquo;Creator&rdquo;).
              Address for service: ul. Złota 75, 00-819 Warsaw, Poland, email for technical matters:{' '}
              <a href="mailto:support@pawelperfect.com" className="underline hover:text-primary">support@pawelperfect.com</a>.
            </li>
            <li>
              The service is non-commercial. The Creator does not sell goods, services, or digital content through the
              service. All payments made to the Creator are voluntary support (a donation) and do not constitute payment
              for goods, services, or digital content.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="2" title="Scope of the service and technical requirements">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The service provides video content. Access to content never requires payment — voluntary support for the
              Creator has no effect on what a user can watch.
            </li>
            <li>
              Some video content and some features, such as commenting, require a free account. Other content is
              available without signing in.
            </li>
            <li>
              Using the service requires a device with an up-to-date web browser with JavaScript enabled, and an internet
              connection. Creating an account requires an email address.
            </li>
            <li>
              The Creator does not guarantee that the service will work correctly in outdated browsers, on devices that do
              not support modern video standards, or when scripts or elements needed for signing in and playback are blocked.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="3" title="Account and rules of use">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              An account is free and can be deleted at any time.
            </li>
            <li>
              In the service, in particular in comments, it is not allowed to post unlawful or offensive content or spam.
              The Creator may remove such content and, in the case of serious violations, block the account without prior warning.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="4" title="Supporting the Creator">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A person with an account may give the Creator voluntary support in any amount as an expression of thanks for
              the material provided. Giving support requires signing in to the service.
            </li>
            <li>
              Support is a donation to the Creator. It is not a price or remuneration for any content or services.
            </li>
            <li>
              Support does not give access to any content, features, distinctions, or other benefits. Nor does it oblige the
              Creator to provide anything, for example to publish new material.
            </li>
            <li>
              Support is not payment for a sale, so the Creator does not issue invoices or receipts for it.
            </li>
            <li>
              Payments are processed by Stripe. The Creator does not store payment card data. The payment confirmation is sent by the payment processor.
            </li>
            <li>
              Support is non-refundable, except for payments made by mistake (for example a duplicate payment or a wrong
              amount) or without the cardholder&apos;s consent.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="5" title="Changes to the Terms">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The Creator may change the Terms, in particular in the event of changes in law, in the features of the service, or in the way it works.
            </li>
            <li>
              Changes to the Terms take effect when they are published in the service.
            </li>
            <li>
              Continuing to use the service after changes are published means accepting them.
            </li>
          </ol>
        </LegalSection>
      </div>
    </>
  );
}

const DATA_ROWS_EN = [
  { what: 'Account and sign-in', data: 'email, name, avatar', why: 'managing the account and providing access to service features' },
  { what: 'Support (payments)', data: 'amount, date, payment identifier, email, payment status', why: 'processing voluntary support, confirmations and tax obligations' },
  { what: 'Comments', data: 'content, name, date', why: 'public discussion under videos and moderation' },
  { what: 'Transactional emails', data: 'email address', why: 'payment confirmations, account security (e.g. password changes) and important service information' },
  { what: 'Marketing notifications', data: 'email address', why: 'sending a newsletter or marketing information, only when you give separate consent' },
  { what: 'Security', data: 'IP address, technical logs', why: 'protecting the service from abuse and rate limiting' },
];

/** Full Privacy Policy body (English translation, no page chrome), used by the /en/privacy-policy page. */
export function PrivacyContentEn() {
  return (
    <>
      <LegalSummary
        items={[
          'We only collect what is needed to run the service: account, support payments, comments, transactional emails and security logs.',
          'We never sell your data and we do not build advertising profiles from it. No advertising cookies.',
          <>You can always ask for access to your data, or ask us to delete it: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a>.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Data controller">
          <p>
            The controller of your personal data is Paweł Perfect, the private individual who runs the service
            WWW.PAWELPERFECT.COM, correspondence address: ul. Złota 75, 00-819 Warsaw, Poland.
          </p>
          <p>For matters concerning personal data, write to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a>.</p>
        </LegalSection>

        <LegalSection nr="2" title="What data we collect and why">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b-2 border-[var(--chan-ink)]/15 text-left">
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Area</th>
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Data</th>
                  <th className="py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--chan-muted)]">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {DATA_ROWS_EN.map((row) => (
                  <tr key={row.what} className="border-b border-dashed border-[var(--chan-ink)]/10 align-top">
                    <td className="py-3 pr-4 font-bold">{row.what}</td>
                    <td className="py-3 pr-4">{row.data}</td>
                    <td className="py-3">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The legal basis for processing depends on the purpose: running the account and using the service under
            the Terms, and processing voluntary support (a gift) — performance of a contract (Article 6(1)(b) GDPR);
            obligations under the law, e.g. tax law — a legal obligation (Article 6(1)(c) GDPR); service security,
            abuse prevention, and the establishment, defense and pursuit of claims — our legitimate interest
            (Article 6(1)(f) GDPR); newsletter or marketing information — your separate consent (Article 6(1)(a)
            GDPR), if you give it.
          </p>
        </LegalSection>

        <LegalSection nr="3" title="Who we share data with">
          <p>
            We use trusted technology providers: Clerk (sign-in), Stripe (payments), Resend (emails), Vercel
            (hosting), Neon (database), Cloudflare (video and infrastructure), and Upstash (abuse protection).
            Depending on the type of service, these providers may act as processors on our instructions, or as
            separate controllers to the extent necessary to fulfil their own legal, security and infrastructure
            obligations — this applies in particular to the payment operator Stripe.
          </p>
          <p>
            Some providers may process data outside the European Economic Area. Transfers rely on the mechanisms
            available under law, such as the Data Privacy Framework, standard contractual clauses, or other
            appropriate safeguards. We never sell your data to anyone.
          </p>
        </LegalSection>

        <LegalSection nr="4" title="How long we keep data">
          <p>
            We keep account data until the account is deleted, and afterwards for the period necessary for the
            defense of claims and compliance with legal obligations. We keep support payment data for the period
            required by law, in particular tax law. We generally keep technical logs for up to 90 days, unless a
            longer retention period is needed to investigate abuse, failures or claims.
            We keep comments until you or moderation deletes them.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Your rights">
          <p>
            You have the right to: access your data, have it corrected, deleted, have its processing restricted,
            transfer it, and object to its processing. Where we process data based on consent, you can withdraw it
            at any time, which does not affect the lawfulness of processing carried out before its withdrawal. Just
            email <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">{LEGAL_CONTACT_EMAIL}</a>{' '}
            — this also deletes your account. You may also file a complaint with the President of the Polish Data
            Protection Authority (UODO, uodo.gov.pl).
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Emails and notifications">
          <p>
            We send transactional emails — such as a payment confirmation, a password-change notice, or notice of
            significant changes to the service — in connection with your use of the service under the Terms or our
            information obligations. We send
            newsletters or marketing/promotional information only when you give separate consent. You can
            unsubscribe from such messages at any time.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Cookies">
          <p>
            We use only cookies and similar technologies necessary for the service to work: keeping you signed in,
            security, abuse protection, and playing content. We do not use advertising or tracking cookies. If we
            add analytics or marketing tools that require consent in the future, we will ask for it before using
            them. You can remove cookies in your browser settings — the service will work normally without signing
            in, but some account features may require necessary cookies.
          </p>
        </LegalSection>

        <LegalSection nr="8" title="Changes to this policy">
          <p>
            If this policy changes (e.g. a new provider is added), we will update this document and the date at the
            top of the page. We will communicate significant changes within the service.
          </p>
        </LegalSection>
      </div>
    </>
  );
}

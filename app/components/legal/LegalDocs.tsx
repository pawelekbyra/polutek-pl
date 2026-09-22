import React from 'react';

export const LEGAL_EFFECTIVE_DATE = 'Obowiązuje od 3 lipca 2026 r.';
export const LEGAL_EFFECTIVE_DATE_EN = 'Effective as of 3 July 2026.';

export const LEGAL_OWNER = {
  name: 'Kutashi Yakimoto LLC',
  street: '1201 Third Avenue, Suite 2200',
  cityStateZip: 'Seattle, WA 98101',
  countryPl: 'Stany Zjednoczone',
  countryEn: 'United States',
  llcId: '2026-001487321',
  ein: '99-4471268',
  email: 'contact@kutashi.com',
  phone: '+1 (307) 555-0148',
};

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

const OWNER = LEGAL_OWNER;

/** Letterhead-style presentation of the operating entity for Polish documents, used in § 1. */
export function LegalOwnerBlock({ leadIn }: { leadIn: string }) {
  return (
    <>
      <p>{leadIn}:</p>
      <div className="border-l-2 border-[var(--chan-blue)]/25 pl-4">
        <p className="font-bold text-[var(--chan-ink)]">{OWNER.name}</p>
        <p className="mt-1">
          {OWNER.street}
          <br />
          {OWNER.cityStateZip}
          <br />
          {OWNER.countryPl}
        </p>
        <p className="mt-2">
          Wyoming LLC ID <span className="tabular-nums">{OWNER.llcId}</span>
          <br />
          EIN <span className="tabular-nums">{OWNER.ein}</span>
        </p>
        <p className="mt-2">
          E-mail:{' '}
          <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">
            {OWNER.email}
          </a>
          <br />
          Telefon:{' '}
          <a href={`tel:${OWNER.phone.replace(/[^\d+]/g, '')}`} className="underline hover:text-primary">
            {OWNER.phone}
          </a>
        </p>
      </div>
    </>
  );
}

/** Letterhead-style presentation of the operating entity for English documents, used in § 1. */
export function LegalOwnerBlockEn({ leadIn }: { leadIn: string }) {
  return (
    <>
      <p>{leadIn}:</p>
      <div className="border-l-2 border-[var(--chan-blue)]/25 pl-4">
        <p className="font-bold text-[var(--chan-ink)]">{OWNER.name}</p>
        <p className="mt-1">
          {OWNER.street}
          <br />
          {OWNER.cityStateZip}
          <br />
          {OWNER.countryEn}
        </p>
        <p className="mt-2">
          Wyoming LLC ID <span className="tabular-nums">{OWNER.llcId}</span>
          <br />
          EIN <span className="tabular-nums">{OWNER.ein}</span>
        </p>
        <p className="mt-2">
          Email:{' '}
          <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">
            {OWNER.email}
          </a>
          <br />
          Phone:{' '}
          <a href={`tel:${OWNER.phone.replace(/[^\d+]/g, '')}`} className="underline hover:text-primary">
            {OWNER.phone}
          </a>
        </p>
      </div>
    </>
  );
}

const REGULAMIN_CONTACT_EMAIL = 'support@pawelperfect.pl';

/** Full Terms of Service body (no page chrome), shared by the /regulamin page and the support-box modal. */
export function RegulaminContent() {
  return (
    <>
      <div className="space-y-10">
        <LegalSection nr="1" title="Kto prowadzi serwis">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Serwis WWW.PAWELPERFECT.PL prowadzi Paweł Perfect, osoba fizyczna, adres do korespondencji: ul. Złota 75,
              00-819 Warszawa, e-mail: <a href={`mailto:${REGULAMIN_CONTACT_EMAIL}`} className="underline hover:text-primary">{REGULAMIN_CONTACT_EMAIL}</a> (dalej: „Twórca").
            </li>
            <li>Serwis ma charakter niekomercyjny. Twórca nie sprzedaje w nim towarów, usług ani treści cyfrowych.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="2" title="Co znajdziesz w serwisie i wymagania techniczne">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Serwis udostępnia materiały wideo. Dostęp do treści nigdy nie wymaga płatności — dobrowolne wsparcie
              Twórcy (§ 4) nie wpływa na to, co użytkownik może oglądać.
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
              Logowanie obsługuje zewnętrzny dostawca Clerk. Materiały wideo mogą być dostarczane przez zewnętrzną
              infrastrukturę hostingową i streamingową.
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
              Konto jest bezpłatne i można je usunąć w każdej chwili. Wystarczy wiadomość na adres{' '}
              <a href={`mailto:${REGULAMIN_CONTACT_EMAIL}`} className="underline hover:text-primary">{REGULAMIN_CONTACT_EMAIL}</a>.
            </li>
            <li>
              W serwisie, w szczególności w komentarzach, nie wolno publikować treści bezprawnych, obraźliwych ani
              spamu. Twórca może usuwać takie treści, a przy powtarzających się naruszeniach zablokować konto.
            </li>
            <li>Materiały w serwisie są chronione prawem autorskim i przeznaczone wyłącznie do użytku osobistego.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="4" title="Wsparcie Twórcy">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Osoba posiadająca konto może przekazać Twórcy dobrowolne wsparcie w dowolnej kwocie jako wyraz
              podziękowania za udostępnione materiały. Przekazanie wsparcia wymaga zalogowania się do serwisu.
            </li>
            <li>Wsparcie jest darowizną na rzecz Twórcy. Nie jest ceną ani wynagrodzeniem za jakiekolwiek treści lub usługi.</li>
            <li>
              Wsparcie nie daje dostępu do żadnych treści, funkcji, wyróżnień ani innych korzyści. Nie zobowiązuje też
              Twórcy do żadnego świadczenia, np. do publikowania nowych materiałów.
            </li>
            <li>Płatności obsługuje Stripe. Twórca nie przechowuje danych kart płatniczych. Potwierdzenie wpłaty wysyła operator płatności.</li>
            <li>
              Wsparcie nie podlega zwrotowi, z wyjątkiem wpłat dokonanych omyłkowo (np. podwójna płatność lub błędna
              kwota) albo bez zgody posiadacza karty. W takim przypadku napisz niezwłocznie na{' '}
              <a href={`mailto:${REGULAMIN_CONTACT_EMAIL}`} className="underline hover:text-primary">{REGULAMIN_CONTACT_EMAIL}</a>.
            </li>
            <li>Wsparcie nie jest zapłatą za sprzedaż, dlatego Twórca nie wystawia do niego faktur ani rachunków.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="5" title="Reklamacje">
          <p>
            Jeśli coś w serwisie nie działa, napisz na{' '}
            <a href={`mailto:${REGULAMIN_CONTACT_EMAIL}`} className="underline hover:text-primary">{REGULAMIN_CONTACT_EMAIL}</a>.
            Opisz problem i podaj adres e-mail konta, jeśli je masz. Odpowiemy najpóźniej w ciągu 14 dni.
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Dane osobowe">
          <p>Administratorem danych osobowych jest Twórca. Zasady przetwarzania danych opisuje Polityka prywatności.</p>
        </LegalSection>

        <LegalSection nr="7" title="Zmiany regulaminu i prawo właściwe">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Twórca może zmienić regulamin z ważnych przyczyn, np. zmiany przepisów lub funkcji serwisu.</li>
            <li>O zmianach informuje w serwisie z co najmniej 14-dniowym wyprzedzeniem.</li>
            <li>Regulamin podlega prawu polskiemu.</li>
          </ol>
        </LegalSection>
      </div>
    </>
  );
}

const DATA_ROWS = [
  { what: 'Konto i logowanie', data: 'e-mail, nazwa, avatar', why: 'prowadzenie konta i zapewnienie dostępu do funkcji serwisu' },
  { what: 'Płatności', data: 'kwota, data, identyfikator płatności, e-mail, status dostępu', why: 'realizacja płatności, nadanie dostępu, potwierdzenia i obowiązki podatkowe' },
  { what: 'Komentarze', data: 'treść, nazwa, data', why: 'publiczna dyskusja pod filmami i moderacja' },
  { what: 'E-maile transakcyjne', data: 'adres e-mail', why: 'potwierdzenia wpłat, dostępu, reklamacji i istotnych informacji o usłudze' },
  { what: 'Powiadomienia marketingowe', data: 'adres e-mail', why: 'wysyłka newslettera lub informacji marketingowych, wyłącznie gdy udzielisz odrębnej zgody' },
  { what: 'Bezpieczeństwo', data: 'adres IP, logi techniczne', why: 'ochrona serwisu przed nadużyciami i limity zapytań' },
];

/** Full Privacy Policy body (no page chrome), shared by the /polityka-prywatnosci page and the modal. */
export function PolitykaContent() {
  return (
    <>
      <LegalSummary
        items={[
          'Zbieramy tylko to, co potrzebne do działania serwisu: konto, płatności, komentarze, e-maile transakcyjne i logi bezpieczeństwa.',
          'Niczego nie sprzedajemy i nie profilujemy Cię reklamowo. Brak cookies reklamowych.',
          <>Zawsze możesz poprosić o dostęp do swoich danych albo ich usunięcie: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Administrator danych">
          <LegalOwnerBlock leadIn="Administratorem serwisu WWW.PAWELPERFECT.PL jest" />
          <p>W sprawach danych osobowych pisz na adres <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.</p>
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
            Podstawy prawne przetwarzania danych zależą od celu: prowadzenie konta, obsługa dostępu i płatności —
            wykonanie umowy lub działania przed jej zawarciem (art. 6 ust. 1 lit. b RODO); rozliczenia podatkowe
            i księgowe — obowiązek prawny (art. 6 ust. 1 lit. c RODO); bezpieczeństwo serwisu, zapobieganie nadużyciom,
            obsługa reklamacji oraz ustalenie, obrona i dochodzenie roszczeń — nasz prawnie uzasadniony interes
            (art. 6 ust. 1 lit. f RODO); newsletter lub informacje marketingowe — Twoja odrębna zgoda
            (art. 6 ust. 1 lit. a RODO), jeżeli jej udzielisz.
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
            Dane konta przechowujemy do czasu jego usunięcia, a następnie przez okres niezbędny do rozliczeń,
            obrony roszczeń i realizacji obowiązków prawnych. Dane płatności i rozliczeń przechowujemy przez okres
            wymagany przez przepisy podatkowe i rachunkowe. Logi techniczne przechowujemy co do zasady do 90 dni,
            chyba że dłuższe przechowywanie jest potrzebne do wyjaśnienia nadużyć, awarii, reklamacji lub roszczeń.
            Komentarze przechowujemy do czasu ich usunięcia przez Ciebie lub moderację.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Twoje prawa">
          <p>
            Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
            przenoszenia oraz sprzeciwu. Jeżeli dane przetwarzamy na podstawie zgody, możesz ją w każdej chwili wycofać,
            co nie wpływa na zgodność z prawem przetwarzania sprzed jej wycofania. Wystarczy wysłać e-mail na{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
            w ten sposób usuniesz też konto. Możesz również złożyć skargę do Prezesa Urzędu Ochrony Danych
            Osobowych (uodo.gov.pl).
          </p>
        </LegalSection>

        <LegalSection nr="6" title="E-maile i powiadomienia">
          <p>
            E-maile transakcyjne, takie jak potwierdzenia płatności, dostępu, reklamacji lub istotnych zmian usługi,
            wysyłamy w związku z wykonaniem umowy albo naszym obowiązkiem informacyjnym. Newsletter, informacje
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

const TERMS_EN_CONTACT_EMAIL = 'support@pawelperfect.pl';

/** Full Terms of Service body (English translation, no page chrome), used by the /en/terms page. */
export function TermsContentEn() {
  return (
    <>
      <div className="space-y-10">
        <LegalSection nr="1" title="Who runs the service">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The service WWW.PAWELPERFECT.PL is run by Paweł Perfect, a private individual, correspondence address:
              ul. Złota 75, 00-819 Warsaw, Poland, email:{' '}
              <a href={`mailto:${TERMS_EN_CONTACT_EMAIL}`} className="underline hover:text-primary">{TERMS_EN_CONTACT_EMAIL}</a> (hereinafter: the &ldquo;Creator&rdquo;).
            </li>
            <li>The service is non-commercial. The Creator does not sell any goods, services, or digital content through it.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="2" title="What you'll find in the service and technical requirements">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The service provides video content. Access to content never requires payment — voluntarily supporting
              the Creator (§ 4) has no effect on what a user can watch.
            </li>
            <li>
              Some video content and some features, such as commenting, require creating a free account. Other
              content is available without signing in.
            </li>
            <li>
              Using the service requires a device with an up-to-date web browser with JavaScript enabled and an
              internet connection. Creating an account requires an email address.
            </li>
            <li>
              Sign-in is handled by the external provider Clerk. Video content may be delivered using external
              hosting and streaming infrastructure.
            </li>
            <li>
              The Creator does not guarantee correct operation of the service on outdated browsers, on devices that
              do not support modern video standards, or when scripts or elements needed for sign-in and playback are
              blocked.
            </li>
          </ol>
        </LegalSection>

        <LegalSection nr="3" title="Account and usage rules">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              The account is free and can be deleted at any time. A message to{' '}
              <a href={`mailto:${TERMS_EN_CONTACT_EMAIL}`} className="underline hover:text-primary">{TERMS_EN_CONTACT_EMAIL}</a> is enough.
            </li>
            <li>
              Within the service, in particular in comments, it is not allowed to publish unlawful or offensive
              content, or spam. The Creator may remove such content and, in the case of repeated violations, block
              the account.
            </li>
            <li>Content in the service is protected by copyright and intended solely for personal use.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="4" title="Supporting the Creator">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              A user with an account may give the Creator voluntary support in any amount as a token of thanks for
              the materials made available. Giving support requires signing in to the service.
            </li>
            <li>Support is a gift (donation) to the Creator. It is not a price or remuneration for any content or services.</li>
            <li>
              Support does not grant access to any content, features, distinctions, or other benefits. Nor does it
              obligate the Creator to any performance, e.g. to publish new materials.
            </li>
            <li>Payments are handled by Stripe. The Creator does not store card data. Confirmation of payment is sent by the payment operator.</li>
            <li>
              Support is non-refundable, except for payments made by mistake (e.g. a duplicate payment or an
              incorrect amount) or made without the cardholder&rsquo;s authorization. In such a case, write to us
              promptly at{' '}
              <a href={`mailto:${TERMS_EN_CONTACT_EMAIL}`} className="underline hover:text-primary">{TERMS_EN_CONTACT_EMAIL}</a>.
            </li>
            <li>Support is not payment for a sale, so the Creator does not issue invoices or receipts for it.</li>
          </ol>
        </LegalSection>

        <LegalSection nr="5" title="Complaints">
          <p>
            If something in the service is not working, write to{' '}
            <a href={`mailto:${TERMS_EN_CONTACT_EMAIL}`} className="underline hover:text-primary">{TERMS_EN_CONTACT_EMAIL}</a>.
            Describe the problem and provide your account email address, if you have one. We will respond within 14
            days at the latest.
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Personal data">
          <p>The Creator is the controller of personal data. The rules for processing data are described in the Privacy Policy.</p>
        </LegalSection>

        <LegalSection nr="7" title="Changes to the Terms and governing law">
          <ol className="list-decimal space-y-2 pl-5">
            <li>The Creator may change the Terms for important reasons, e.g. changes in law or in the service&rsquo;s features.</li>
            <li>Changes will be announced in the service at least 14 days in advance.</li>
            <li>The Terms are governed by Polish law.</li>
          </ol>
        </LegalSection>
      </div>
    </>
  );
}

const DATA_ROWS_EN = [
  { what: 'Account and sign-in', data: 'email, name, avatar', why: 'managing the account and providing access to service features' },
  { what: 'Payments', data: 'amount, date, payment identifier, email, access status', why: 'processing payments, granting access, confirmations and tax obligations' },
  { what: 'Comments', data: 'content, name, date', why: 'public discussion under videos and moderation' },
  { what: 'Transactional emails', data: 'email address', why: 'confirmations of payments, access, complaints and other important service information' },
  { what: 'Marketing notifications', data: 'email address', why: 'sending a newsletter or marketing information, only when you give separate consent' },
  { what: 'Security', data: 'IP address, technical logs', why: 'protecting the service from abuse and rate limiting' },
];

/** Full Privacy Policy body (English translation, no page chrome), used by the /en/privacy-policy page. */
export function PrivacyContentEn() {
  return (
    <>
      <LegalSummary
        items={[
          'We only collect what is needed to run the service: account, payments, comments, transactional emails and security logs.',
          'We never sell your data and we do not build advertising profiles from it. No advertising cookies.',
          <>You can always ask for access to your data, or ask us to delete it: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Data controller">
          <LegalOwnerBlockEn leadIn="The controller of your personal data is" />
          <p>For matters concerning personal data, write to <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.</p>
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
            The legal basis for processing depends on the purpose: running the account, handling access and payments
            — performance of a contract or steps taken at your request before entering into one (Article 6(1)(b)
            GDPR); tax and accounting settlements — a legal obligation (Article 6(1)(c) GDPR); service security,
            abuse prevention, complaint handling, and the establishment, defense and pursuit of claims — our
            legitimate interest (Article 6(1)(f) GDPR); newsletter or marketing information — your separate consent
            (Article 6(1)(a) GDPR), if you give it.
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
            We keep account data until the account is deleted, and afterwards for the period necessary for
            settlements, defense of claims and compliance with legal obligations. We keep payment and settlement
            data for the period required by tax and accounting law. We generally keep technical logs for up to 90
            days, unless a longer retention period is needed to investigate abuse, failures, complaints or claims.
            We keep comments until you or moderation deletes them.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Your rights">
          <p>
            You have the right to: access your data, have it corrected, deleted, have its processing restricted,
            transfer it, and object to its processing. Where we process data based on consent, you can withdraw it
            at any time, which does not affect the lawfulness of processing carried out before its withdrawal. Just
            email <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>{' '}
            — this also deletes your account. You may also file a complaint with the President of the Polish Data
            Protection Authority (UODO, uodo.gov.pl).
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Emails and notifications">
          <p>
            We send transactional emails — such as confirmations of payments, access, complaints, or significant
            service changes — in connection with performing the contract or our information obligations. We send
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

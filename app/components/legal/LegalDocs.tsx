import React from 'react';
import { formatLegalDateEn, formatLegalDatePl } from '@/lib/legal/version';
import { TECHNICAL_DATA_RETENTION_DAYS } from '@/lib/modules/privacy/domain/retention';
import { TELEMETRY_AGGREGATE_RETENTION_MONTHS, TELEMETRY_RAW_RETENTION_DAYS } from '@/lib/telemetry/retention';

/** Derived from LEGAL_DOCUMENTS_VERSION (lib/legal/version.ts): change the date there. */
export const LEGAL_EFFECTIVE_DATE = `Obowiązuje od ${formatLegalDatePl()} r.`;
export const LEGAL_EFFECTIVE_DATE_EN = `Effective as of ${formatLegalDateEn()}.`;

/**
 * The service is run by a private individual (see § 1 of the Terms). Every legal document —
 * Terms and Privacy Policy, PL and EN — names the same person and this one contact address.
 */
export const LEGAL_CONTACT_EMAIL = 'support@pawelperfect.com';

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

function ContactLink() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline hover:text-primary">
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

function CookieName({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-[var(--chan-ink)]/5 px-1 text-[13px]">{children}</code>;
}

/** Full Privacy Policy body (no page chrome), shared by the /polityka-prywatnosci page and the tip-gate dialog. */
export function PolitykaContent() {
  return (
    <div className="space-y-10">
      <LegalSection nr="1" title="Administrator">
        <p>
          Administratorem danych jest Paweł Perfect, osoba fizyczna prowadząca serwis WWW.PAWELPERFECT.COM,
          ul. Złota 75, 00-819 Warszawa, e-mail: <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection nr="2" title="Dane, cel i podstawa">
        <p>Podstawy prawne to art. 6 ust. 1 RODO:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Konto: e-mail (bez niego nie założysz konta), hasło, pseudonim, awatar, język, logowanie dwuetapowe, klucze
            dostępu (klucz publiczny, identyfikator i nazwa urządzenia; klucz prywatny zostaje na Twoim urządzeniu); przy
            logowaniu przez Google e-mail i identyfikator od Google. Podstawa: umowa, czyli Regulamin (lit. b).
          </li>
          <li>Komentarze, reakcje i subskrypcja kanału. Pseudonim, awatar i komentarze są publiczne. Podstawa: umowa (lit. b).</li>
          <li>
            Wpłaty: kwota, data, status i identyfikatory płatności, bez danych karty. Podstawa: umowa i obowiązki
            podatkowe (lit. b i c).
          </li>
          <li>
            E-maile o koncie i wpłatach: umowa (lit. b). O nowych filmach: Twoja zgoda (lit. a), którą wycofasz
            linkiem w wiadomości.
          </li>
          <li>Wiadomości do nas, żeby odpowiedzieć: nasz uzasadniony interes (lit. f).</li>
          <li>
            Adres IP, dane przeglądarki i przebieg odtwarzania, dla bezpieczeństwa, liczenia wyświetleń i naprawy
            błędów: nasz uzasadniony interes (lit. f).
          </li>
          <li>
            Statystyki serwisu: odwiedzona strona (bez parametrów adresu), domena strony, z której przyszedłeś, kraj,
            rodzaj urządzenia, przeglądarka i system, szybkość ładowania strony oraz jakość odtwarzania filmów (czas
            startu, buforowanie, błędy, obejrzane fragmenty). Bez cookies i bez zapisu czegokolwiek na Twoim
            urządzeniu. Adresu IP nie zapisujemy: z adresu IP i danych przeglądarki tworzymy skrót z losową wartością,
            którą codziennie zmieniamy i kasujemy, więc następnego dnia nie da się Cię rozpoznać. Statystyk nie łączymy
            z kontem. Gdy przeglądarka wysyła sygnał Global Privacy Control lub Do Not Track, statystyk nie zbieramy;
            to także sposób na sprzeciw. Podstawa: nasz uzasadniony interes (lit. f), czyli wiedza, jak działa serwis.
          </li>
        </ol>
        <p>
          Dane możemy też wykorzystać do obrony roszczeń (lit. f). Nie sprzedajemy ich, nie profilujemy Cię i nie
          podejmujemy decyzji wyłącznie automatycznie.
        </p>
      </LegalSection>

      <LegalSection nr="3" title="Odbiorcy">
        <ul className="list-disc space-y-1 pl-5">
          <li>Hetzner (Niemcy): serwer i baza danych;</li>
          <li>Cloudflare: sieć, ochrona przed atakami i botami, pliki, kopie zapasowe, poczta przychodząca;</li>
          <li>Amazon Web Services (Amazon SES, region Sztokholm w UE): wysyłka e-maili;</li>
          <li>Resend: wysyłka e-maili awaryjnie, gdy główny dostawca nie może wysłać;</li>
          <li>Google: kopia wiadomości wysłanych na nasz adres (Gmail).</li>
        </ul>
        <p>
          Stripe i operator wybranej metody płatności (np. BLIK, PayPal) oraz Google przy logowaniu przez Google są
          odrębnymi administratorami. Cloudflare, Amazon Web Services, Resend, Stripe i Google mogą przekazywać dane do USA na podstawie
          Data Privacy Framework lub standardowych klauzul umownych (kopię wyślemy na prośbę).
        </p>
      </LegalSection>

      <LegalSection nr="4" title="Jak długo">
        <p>
          Dane konta trzymamy do jego usunięcia. Wtedy kasujemy dane logowania, awatar, zgody i treść Twoich
          komentarzy, usuwamy Twój adres z listy mailingowej, a e-mail i pseudonim anonimizujemy. Konto z
          niepotwierdzonym e-mailem usuwamy po 7 dniach, treść usuniętego komentarza po 30 dniach, sesja logowania
          wygasa po 30 dniach (wygasłe sesje i linki z e-maili kasujemy codziennie), kopie zapasowe po 14 dniach. Adres
          IP i dane przeglądarki zapisane w naszej bazie usuwamy po {TECHNICAL_DATA_RETENTION_DAYS} dniach, zdarzenia
          statystyczne po {TELEMETRY_RAW_RETENTION_DAYS} dniach, a dzienne zestawienia statystyk po{' '}
          {TELEMETRY_AGGREGATE_RETENTION_MONTHS} miesiącach. Wpłaty
          trzymamy tak długo, jak wymagają przepisy podatkowe, a wiadomości do załatwienia sprawy.
        </p>
      </LegalSection>

      <LegalSection nr="5" title="Twoje prawa">
        <p>
          Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia oraz
          sprzeciwić się przetwarzaniu opartemu na lit. f. Zgodę wycofasz w każdej chwili, bez wpływu na wcześniejsze
          przetwarzanie. Dane konta zmienisz, a konto usuniesz w ustawieniach konta; w innych sprawach napisz na{' '}
          <ContactLink />. Możesz złożyć skargę do Prezesa UODO (uodo.gov.pl).
        </p>
      </LegalSection>

      <LegalSection nr="6" title="Cookies">
        <p>Używamy tylko cookies i pamięci przeglądarki niezbędnych dla funkcji, z których korzystasz, więc nie prosimy o zgodę:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><CookieName>pp.*</CookieName>: logowanie, do 30 dni;</li>
          <li><CookieName>app-language</CookieName>: język, rok;</li>
          <li>
            <CookieName>__stripe_mid</CookieName>, <CookieName>__stripe_sid</CookieName>: ochrona wpłat przed
            oszustwami, po otwarciu bramki napiwkowej, do roku;
          </li>
          <li><CookieName>g_state</CookieName>: logowanie przez Google, po otwarciu okna logowania;</li>
          <li>pamięć przeglądarki: Twoje ustawienia, np. wyciszenie dźwięku.</li>
        </ul>
        <p>Formularze logowania chroni Cloudflare Turnstile, bez cookies.</p>
        <p>Statystyki z § 2 działają bez cookies i bez pamięci przeglądarki.</p>
      </LegalSection>

      <LegalSection nr="7" title="Zmiany">
        <p>O zmianach poinformujemy w serwisie i zmienimy datę na górze strony.</p>
      </LegalSection>
    </div>
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

/** Full Privacy Policy body (English translation, no page chrome), used by the /en/privacy-policy page. */
export function PrivacyContentEn() {
  return (
    <div className="space-y-10">
      <LegalSection nr="1" title="Controller">
        <p>
          The controller of your data is Paweł Perfect, the private individual who runs the service WWW.PAWELPERFECT.COM,
          ul. Złota 75, 00-819 Warsaw, Poland, email: <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection nr="2" title="Data, purpose and legal basis">
        <p>The legal bases are in Article 6(1) GDPR:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Account: email (you cannot create an account without it), password, nickname, avatar, language, two-step
            sign-in, passkeys (public key, identifier and device name; the private key stays on your device); with Google
            sign-in, the email and identifier from Google. Basis: the contract, i.e. the Terms
            (point (b)).
          </li>
          <li>Comments, reactions and channel subscription. Your nickname, avatar and comments are public. Basis: the contract (point (b)).</li>
          <li>
            Payments: amount, date, status and payment identifiers, without card details. Basis: the contract and tax
            obligations (points (b) and (c)).
          </li>
          <li>
            Emails about your account and payments: the contract (point (b)). About new videos: your consent (point
            (a)), which you can withdraw with the link in the message.
          </li>
          <li>Messages to us, so that we can reply: our legitimate interest (point (f)).</li>
          <li>
            IP address, browser data and the course of playback, for security, counting views and fixing errors: our
            legitimate interest (point (f)).
          </li>
          <li>
            Service statistics: the page visited (without address parameters), the domain of the page you came from,
            country, device type, browser and operating system, page loading speed and video playback quality (start-up
            time, buffering, errors, parts watched). No cookies and nothing stored on your device. We do not store your
            IP address: we turn the IP address and browser data into a hash with a random value that we change and
            delete every day, so you cannot be recognised the next day. Statistics are not linked to your account. When
            your browser sends a Global Privacy Control or Do Not Track signal, we collect no statistics; this is also
            a way to object. Basis: our legitimate interest (point (f)), i.e. knowing how the service works.
          </li>
        </ol>
        <p>
          We may also use data to defend claims (point (f)). We do not sell it, profile you or make decisions based
          solely on automated processing.
        </p>
      </LegalSection>

      <LegalSection nr="3" title="Recipients">
        <ul className="list-disc space-y-1 pl-5">
          <li>Hetzner (Germany): server and database;</li>
          <li>Cloudflare: network, protection against attacks and bots, files, backups, incoming mail;</li>
          <li>Amazon Web Services (Amazon SES, Stockholm region in the EU): sending emails;</li>
          <li>Resend: sending emails as a fallback when the main provider cannot send;</li>
          <li>Google: a copy of messages sent to our address (Gmail).</li>
        </ul>
        <p>
          Stripe and the operator of the payment method you choose (e.g. BLIK, PayPal), and Google when you sign in
          with Google, are separate controllers. Cloudflare, Amazon Web Services, Resend, Stripe and Google may transfer data to the USA
          under the Data Privacy Framework or standard contractual clauses (we will send a copy on request).
        </p>
      </LegalSection>

      <LegalSection nr="4" title="How long">
        <p>
          We keep account data until the account is deleted. We then erase sign-in data, avatar, consents and the
          text of your comments, remove your address from our mailing list, and anonymise your email and nickname. We
          delete an account with an unconfirmed email after 7 days and the text of a deleted comment after 30 days; a
          sign-in session expires after 30 days (expired sessions and email links are erased daily) and backups after
          14 days. We erase IP addresses and browser data stored in our database after {TECHNICAL_DATA_RETENTION_DAYS}{' '}
          days, statistics events after {TELEMETRY_RAW_RETENTION_DAYS} days and daily statistics summaries after{' '}
          {TELEMETRY_AGGREGATE_RETENTION_MONTHS} months. We keep payments as long as tax law requires, and messages until the matter is resolved.
        </p>
      </LegalSection>

      <LegalSection nr="5" title="Your rights">
        <p>
          You may request access to your data, its correction, deletion, restriction of processing and portability,
          and object to processing based on point (f). You can withdraw consent at any time, without affecting earlier
          processing. You can change account data and delete the account in the account settings; for anything else,
          write to <ContactLink />. You may lodge a complaint with the President of the Polish Data Protection Office
          (UODO, uodo.gov.pl).
        </p>
      </LegalSection>

      <LegalSection nr="6" title="Cookies">
        <p>We only use cookies and browser storage needed for the features you use, so we do not ask for consent:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><CookieName>pp.*</CookieName>: sign-in, up to 30 days;</li>
          <li><CookieName>app-language</CookieName>: language, one year;</li>
          <li>
            <CookieName>__stripe_mid</CookieName>, <CookieName>__stripe_sid</CookieName>: protecting payments from
            fraud, after you open the tip gate, up to one year;
          </li>
          <li><CookieName>g_state</CookieName>: Google sign-in, after you open the sign-in window;</li>
          <li>browser storage: your settings, e.g. muted sound.</li>
        </ul>
        <p>Sign-in forms are protected by Cloudflare Turnstile, without cookies.</p>
        <p>The statistics described in section 2 work without cookies and without browser storage.</p>
      </LegalSection>

      <LegalSection nr="7" title="Changes">
        <p>We will announce changes in the service and update the date at the top of the page.</p>
      </LegalSection>
    </div>
  );
}

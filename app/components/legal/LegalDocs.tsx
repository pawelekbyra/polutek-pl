import React from 'react';
import { APP_NAME } from '@/lib/constants';

export const LEGAL_EFFECTIVE_DATE = 'Obowiązuje od 3 lipca 2026 r.';
export const LEGAL_EFFECTIVE_DATE_EN = 'Effective as of 3 July 2026.';

export const LEGAL_OWNER = {
  name: 'Paweł Perfect Inc.',
  address: 'ul. Złota 75A/7, 00-819 Warszawa',
  nip: '527-000-00-00',
  regon: '000000000',
  phone: '+48 600 000 000',
  email: 'kontakt@polutek.pl',
};

export function LegalSection({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 text-lg font-black uppercase tracking-tight text-[var(--chan-ink)]">
        <span className="text-primary tabular-nums">{nr}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-[1.7] text-[#333]">{children}</div>
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

/** Full Terms of Service body (no page chrome), shared by the /regulamin page and the support-box modal. */
export function RegulaminContent() {
  return (
    <>
      <LegalSummary
        items={[
          'Oglądanie publicznych filmów jest darmowe i nie wymaga konta.',
          'Jednorazowa wpłata w kwocie wskazanej w serwisie daje bezterminowy dostęp do Strefy Fenkjuu na czas funkcjonowania serwisu lub tej części serwisu. Bez subskrypcji.',
          'Dostęp dostajesz od razu, dlatego — za Twoją wyraźną zgodą — po jego pełnym uruchomieniu nie przysługuje odstąpienie od umowy.',
          <>Reklamacje: napisz na {OWNER.email}, odpowiadamy do 14 dni.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Kto prowadzi serwis">
          <p>
            Administratorem serwisu {APP_NAME} jest {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
            Kontakt: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>, tel. {OWNER.phone}.
          </p>
        </LegalSection>

        <LegalSection nr="2" title="Co znajdziesz w serwisie i wymagania techniczne">
          <p>
            {APP_NAME} to autorski kanał wideo jednego twórcy. Publiczne filmy oglądasz za darmo i bez konta.
            Część funkcji (komentarze, materiały dla zalogowanych) wymaga bezpłatnego konta.
            Strefa Fenkjuu to sekcja z materiałami dodatkowymi, dostępna dla wspierających (§ 4).
          </p>
          <p>
            Do korzystania z serwisu wystarczy urządzenie z aktualną przeglądarką internetową, włączoną obsługą
            JavaScript i dostępem do internetu. Do założenia konta potrzebny jest adres e-mail. Logowanie obsługuje
            zewnętrzny dostawca Clerk, a materiały wideo mogą być dostarczane z wykorzystaniem zewnętrznej
            infrastruktury hostingowej i streamingowej. Nie gwarantujemy poprawnego działania serwisu na nieaktualnych
            przeglądarkach, urządzeniach bez obsługi współczesnych standardów wideo ani przy blokowaniu skryptów,
            logowania lub elementów niezbędnych do odtworzenia materiałów.
          </p>
        </LegalSection>

        <LegalSection nr="3" title="Konto i zasady korzystania">
          <p>
            Konto jest bezpłatne i możesz je w każdej chwili usunąć (wystarczy e-mail na adres z § 1).
            Korzystając z serwisu — w szczególności komentując — nie wolno publikować treści bezprawnych,
            obraźliwych ani spamu. Takie treści możemy usuwać, a w razie powtarzających się naruszeń zablokować konto.
            Filmy i pozostałe materiały są chronione prawem autorskim i przeznaczone wyłącznie do osobistego użytku.
          </p>
        </LegalSection>

        <LegalSection nr="4" title="Wsparcie i dostęp do Strefy Fenkjuu">
          <p>
            Jednorazowa wpłata w kwocie wskazanej w serwisie w momencie wpłaty stanowi cenę za zawarcie umowy
            o dostarczanie treści cyfrowych i daje Ci <strong>bezterminowy dostęp do Strefy Fenkjuu</strong> — wszystkich
            obecnych i przyszłych materiałów dodatkowych — na czas funkcjonowania serwisu lub tej części serwisu.
            Dostęp uruchamiamy niezwłocznie po zaksięgowaniu płatności, na koncie, z którego dokonano wpłaty.
          </p>
          <p>
            Nie ma subskrypcji, płatności cyklicznych ani ukrytych kosztów. Jeżeli w przyszłości kwota wsparcia się zmieni,
            nie wpływa to na dostęp już przyznany. Twoja wpłata finansuje rozwój projektu — biblioteka materiałów
            dodatkowych dopiero rośnie i nie gwarantujemy częstotliwości publikacji nowych materiałów.
          </p>
          <p>
            Osoby, które mają już aktywny dostęp do Strefy Fenkjuu, mogą dodatkowo wspierać kanał dowolną kwotą.
            Taka dodatkowa wpłata jest dobrowolnym wsparciem projektu, nie stanowi ceny ani wynagrodzenia za nowe
            treści cyfrowe, dodatkowy dostęp, wydłużenie dostępu ani inne świadczenie wzajemne i nie daje żadnych
            dodatkowych korzyści poza tymi, które użytkownik już posiada. Wpłata jest realizowana jako transakcja
            płatnicza przez operatora płatności, ale nie zwiększa zakresu praw użytkownika w serwisie.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Płatności, ceny i faktury">
          <p>
            Płatności obsługuje Stripe. Kwoty podawane w serwisie są cenami całkowitymi do zapłaty przez konsumenta.
            Po udanej płatności otrzymasz potwierdzenie e-mailem. Nie przechowujemy danych Twojej karty.
          </p>
          <p>
            Potwierdzenie zakupu dostępu może obejmować w szczególności: nazwę świadczenia, kwotę płatności,
            informację o jednorazowym charakterze płatności, datę płatności, identyfikator płatności, informację
            o uruchomieniu dostępu oraz potwierdzenie zgód dotyczących natychmiastowego dostarczenia treści cyfrowych.
          </p>
          <p>
            Na żądanie nabywcy wystawiamy fakturę zgodnie z obowiązującymi przepisami prawa podatkowego.
            Żądanie wystawienia faktury może zostać zgłoszone w terminie i na zasadach wynikających z tych przepisów.
            Status VAT, sposób dokumentowania sprzedaży oraz ewentualne rozliczenia transgraniczne zależą od
            obowiązujących przepisów podatkowych i statusu sprzedawcy w chwili sprzedaży.
          </p>
          <p>
            Dodatkowe dobrowolne wpłaty osób, które mają już dostęp do Strefy Fenkjuu, nie są dokumentowane jako cena
            za dostęp do treści cyfrowych, jeżeli nie wiążą się z żadnym świadczeniem wzajemnym po stronie sprzedawcy.
            Ich kwalifikacja podatkowa i sposób dokumentowania zależą od charakteru danej wpłaty oraz obowiązujących
            przepisów podatkowych.
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Odstąpienie od umowy">
          <p>
            Konsumentowi przysługuje 14 dni na odstąpienie od umowy zawartej na odległość. Ponieważ jednak dostęp
            do Strefy Fenkjuu uruchamiamy natychmiast po płatności, przed wpłatą prosimy Cię o wyraźną zgodę na
            rozpoczęcie dostarczania treści cyfrowych przed upływem terminu do odstąpienia od umowy oraz o potwierdzenie,
            że przyjmujesz do wiadomości utratę prawa odstąpienia po pełnym uruchomieniu dostępu.
          </p>
          <p>
            Jeżeli wyrazisz te zgody i dostęp zostanie w pełni uruchomiony, tracisz prawo odstąpienia od umowy
            o dostarczanie treści cyfrowych niedostarczanych na nośniku materialnym (art. 38 ust. 1 pkt 13 ustawy
            o prawach konsumenta). Informację o zawarciu umowy i udzielonych zgodach możemy potwierdzić e-mailem.
          </p>
          <p>
            Jeżeli zapłaciłeś, a dostęp nie został uruchomiony — napisz do nas; naprawimy to albo zwrócimy pieniądze.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Reklamacje i pozasądowe rozwiązywanie sporów">
          <p>
            Coś nie działa? Napisz na <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
            opisz problem i podaj e-mail konta. Odpowiemy najpóźniej w ciągu 14 dni. Odpowiadamy za zgodność treści
            cyfrowych z umową na zasadach ustawy o prawach konsumenta.
          </p>
          <p>
            Jeżeli treści cyfrowe są niezgodne z umową, konsument może żądać doprowadzenia ich do zgodności z umową.
            W przypadkach przewidzianych prawem konsument może również złożyć oświadczenie o obniżeniu ceny albo
            odstąpieniu od umowy.
          </p>
          <p>
            Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń,
            w szczególności z pomocy miejskiego lub powiatowego rzecznika konsumentów oraz właściwego Wojewódzkiego
            Inspektoratu Inspekcji Handlowej. Informacje o zasadach dostępu do tych procedur oraz wykazie podmiotów
            uprawnionych są dostępne w serwisie UOKiK dotyczącym polubownego rozwiązywania sporów konsumenckich.
            Sprzedawca nie zobowiązuje się z góry do udziału w postępowaniu ADR; decyzję podejmujemy po zapoznaniu się
            z konkretną sprawą.
          </p>
        </LegalSection>

        <LegalSection nr="8" title="Zmiany regulaminu i prawo właściwe">
          <p>
            Regulamin możemy zmienić z ważnych powodów (np. zmiana prawa lub funkcji serwisu). O zmianach poinformujemy
            w serwisie z wyprzedzeniem, a zmiany nie odbierają praw już nabytych — w szczególności przyznanego dostępu
            do Strefy Fenkjuu. Umowy podlegają prawu polskiemu, co nie pozbawia konsumenta ochrony wynikającej
            z przepisów bezwzględnie obowiązujących.
          </p>
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
          <>Zawsze możesz poprosić o dostęp do swoich danych albo ich usunięcie: {OWNER.email}.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Administrator danych">
          <p>
            Administratorem Twoich danych jest {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
            W sprawach danych osobowych pisz na{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.
          </p>
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
            co nie wpływa na zgodność z prawem przetwarzania sprzed jej wycofania. Wystarczy e-mail na{' '}
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

/** Full Terms of Service body (English translation, no page chrome), used by the /en/terms page. */
export function TermsContentEn() {
  return (
    <>
      <LegalSummary
        items={[
          'Watching public videos is free and does not require an account.',
          'A one-time payment in the amount shown in the service grants lifetime access to the Thank You Zone for as long as the service (or that part of the service) operates. No subscription.',
          'You get access right away, so — with your explicit consent — once access is fully activated you no longer have the right to withdraw from the contract.',
          <>Complaints: email {OWNER.email}, we reply within 14 days.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Who runs the service">
          <p>
            {APP_NAME} is administered by {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
            Contact: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>, tel. {OWNER.phone}.
          </p>
        </LegalSection>

        <LegalSection nr="2" title="What you'll find in the service and technical requirements">
          <p>
            {APP_NAME} is a single creator&rsquo;s video channel. Public videos can be watched for free and without an
            account. Some features (comments, content for signed-in users) require a free account. The Thank You Zone
            is a section with bonus content, available to supporters (§ 4).
          </p>
          <p>
            Using the service only requires a device with an up-to-date web browser, JavaScript enabled, and an
            internet connection. Creating an account requires an email address. Sign-in is handled by the external
            provider Clerk, and video content may be delivered using external hosting and streaming infrastructure.
            We do not guarantee correct operation of the service on outdated browsers, on devices that do not support
            modern video standards, or when scripts, sign-in, or elements required to play content are blocked.
          </p>
        </LegalSection>

        <LegalSection nr="3" title="Account and usage rules">
          <p>
            The account is free and you can delete it at any time (an email to the address in § 1 is enough). When
            using the service — in particular when commenting — you must not publish unlawful or offensive content,
            or spam. We may remove such content and, in the case of repeated violations, block the account. Videos
            and other materials are protected by copyright and are intended solely for personal use.
          </p>
        </LegalSection>

        <LegalSection nr="4" title="Support and access to the Thank You Zone">
          <p>
            A one-time payment in the amount shown in the service at the moment of payment constitutes the price for
            entering into an agreement for the supply of digital content and grants you <strong>lifetime access to
            the Thank You Zone</strong> — all current and future bonus materials — for as long as the service (or
            that part of the service) operates. We activate access immediately after the payment is credited, on the
            account the payment was made from.
          </p>
          <p>
            There is no subscription, no recurring payments, and no hidden costs. If the support amount changes in
            the future, this does not affect access already granted. Your payment funds the development of the
            project — the library of bonus content is still growing, and we do not guarantee the frequency of new
            material publication.
          </p>
          <p>
            People who already have active access to the Thank You Zone may additionally support the channel with
            any amount. Such an additional payment is voluntary support for the project; it is not a price or
            remuneration for new digital content, additional access, extended access, or any other reciprocal
            performance, and it does not grant any additional benefits beyond those the user already has. The
            payment is processed as a payment transaction through the payment operator, but it does not expand the
            user&rsquo;s rights in the service.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Payments, prices and invoices">
          <p>
            Payments are handled by Stripe. Amounts shown in the service are total prices payable by the consumer.
            After a successful payment you will receive an email confirmation. We do not store your card data.
          </p>
          <p>
            Confirmation of the access purchase may include, in particular: the name of the service, the payment
            amount, information about the one-time nature of the payment, the payment date, the payment identifier,
            information about the activation of access, and confirmation of consents relating to the immediate
            delivery of digital content.
          </p>
          <p>
            Upon the buyer&rsquo;s request we issue an invoice in accordance with applicable tax law. A request to
            issue an invoice may be made within the timeframe and on the terms resulting from those provisions. VAT
            status, the manner of documenting sales, and any cross-border settlements depend on the applicable tax
            regulations and the seller&rsquo;s status at the time of sale.
          </p>
          <p>
            Additional voluntary payments made by people who already have access to the Thank You Zone are not
            documented as a price for access to digital content, provided they are not linked to any reciprocal
            performance on the seller&rsquo;s part. Their tax treatment and the manner of documenting them depend on
            the nature of the given payment and the applicable tax regulations.
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Right of withdrawal">
          <p>
            A consumer has 14 days to withdraw from a contract concluded at a distance. However, because we activate
            access to the Thank You Zone immediately after payment, before you pay we ask you for explicit consent to
            begin supplying digital content before the withdrawal period expires, and for confirmation that you
            acknowledge you will lose the right of withdrawal once access has been fully activated.
          </p>
          <p>
            If you give these consents and access is fully activated, you lose the right to withdraw from the
            agreement for the supply of digital content not delivered on a tangible medium (Article 38(1)(13) of the
            Polish Consumer Rights Act). We may confirm the conclusion of the agreement and the consents given by
            email.
          </p>
          <p>
            If you paid and access was not activated — contact us; we will fix it or refund your money.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Complaints and out-of-court dispute resolution">
          <p>
            Something not working? Email{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
            describe the problem and provide the account email. We will respond within 14 days at the latest. We are
            liable for the conformity of digital content with the contract under the terms of the Polish Consumer
            Rights Act.
          </p>
          <p>
            If digital content is not in conformity with the contract, the consumer may demand that it be brought
            into conformity with the contract. In cases provided for by law, the consumer may also make a statement
            on price reduction or withdrawal from the contract.
          </p>
          <p>
            The consumer may use out-of-court methods of handling complaints and pursuing claims, in particular the
            assistance of the municipal or district consumer ombudsman and the competent Provincial Trade
            Inspectorate. Information on access to these procedures and the list of authorized entities is available
            on the UOKiK website on out-of-court consumer dispute resolution. The seller does not commit in advance
            to participate in ADR proceedings; we decide after reviewing the specific case.
          </p>
        </LegalSection>

        <LegalSection nr="8" title="Changes to the Terms and governing law">
          <p>
            We may change these Terms for important reasons (e.g. a change in law or in the service&rsquo;s
            features). We will announce changes within the service in advance, and changes do not take away rights
            already acquired — in particular, access already granted to the Thank You Zone. Agreements are governed
            by Polish law, which does not deprive the consumer of the protection resulting from mandatory legal
            provisions.
          </p>
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
          <>You can always ask for access to your data, or ask us to delete it: {OWNER.email}.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Data controller">
          <p>
            The controller of your data is {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
            For matters concerning personal data, write to{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.
          </p>
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
            email{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>{' '}
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

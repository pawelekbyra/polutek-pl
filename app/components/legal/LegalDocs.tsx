import React from 'react';
import { APP_NAME } from '@/lib/constants';

export const LEGAL_EFFECTIVE_DATE = 'Obowiązuje od 3 lipca 2026 r.';

export const LEGAL_OWNER = {
  name: 'Paweł Perfect Inc',
  address: 'ul. Złota 75A/7, 00-819 Warszawa',
  nip: '527-000-00-00',
  regon: '000000000',
  phone: '+48 600 000 000',
  email: 'kontakt@polutek.pl',
};

export function LegalSection({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-3 text-lg font-black uppercase tracking-tight text-[#1a1a1a]">
        <span className="text-primary tabular-nums">{nr}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-[1.7] text-[#333]">{children}</div>
    </section>
  );
}

export function LegalSummary({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="mb-12 rounded-xl border border-[#1a1a1a]/15 bg-white/60 p-5 text-[14px] leading-[1.7]">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#7a7a7a]">W skrócie</p>
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
            Serwis {APP_NAME} prowadzi {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
            Kontakt: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>, tel. {OWNER.phone}.
            Najszybciej odpowiadamy na e-maile.
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
                <tr className="border-b-2 border-[#1a1a1a]/15 text-left">
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#7a7a7a]">Obszar</th>
                  <th className="py-2 pr-4 text-[11px] font-black uppercase tracking-[0.1em] text-[#7a7a7a]">Dane</th>
                  <th className="py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#7a7a7a]">Po co</th>
                </tr>
              </thead>
              <tbody>
                {DATA_ROWS.map((row) => (
                  <tr key={row.what} className="border-b border-dashed border-[#1a1a1a]/10 align-top">
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

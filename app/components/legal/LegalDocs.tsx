import React from 'react';
import { APP_NAME } from '@/lib/constants';

export const LEGAL_EFFECTIVE_DATE = 'Obowiązuje od 3 lipca 2026 r.';

export const LEGAL_OWNER = {
  name: 'Paweł Perfect',
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
          'Jednorazowa wpłata w kwocie wskazanej w serwisie daje dożywotni dostęp do Strefy Fenkju. Bez subskrypcji.',
          'Dostęp dostajesz od razu, dlatego — za Twoją zgodą — nie przysługuje odstąpienie od umowy po jego uruchomieniu.',
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

        <LegalSection nr="2" title="Co znajdziesz w serwisie">
          <p>
            {APP_NAME} to autorski kanał wideo jednego twórcy. Publiczne filmy oglądasz za darmo i bez konta.
            Część funkcji (komentarze, materiały dla zalogowanych) wymaga bezpłatnego konta.
            Strefa Fenkju to sekcja z materiałami dodatkowymi, dostępna dla wspierających (§ 4).
          </p>
          <p>
            Do korzystania z serwisu wystarczy urządzenie z aktualną przeglądarką internetową i dostęp do internetu,
            a do założenia konta — adres e-mail. Logowanie obsługuje zewnętrzny dostawca Clerk.
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

        <LegalSection nr="4" title="Wsparcie i dostęp do Strefy Fenkju">
          <p>
            Jednorazowa wpłata w kwocie wskazanej w serwisie w momencie wpłaty daje Ci <strong>dożywotni dostęp
            do Strefy Fenkju</strong> — wszystkich obecnych i przyszłych materiałów dodatkowych. To umowa o dostarczanie
            treści cyfrowych: dostęp uruchamiamy niezwłocznie po zaksięgowaniu płatności, na koncie, z którego dokonano wpłaty.
          </p>
          <p>
            Nie ma subskrypcji, płatności cyklicznych ani ukrytych kosztów. Jeżeli w przyszłości kwota wsparcia się zmieni,
            nie wpływa to na dostęp już przyznany. Twoja wpłata finansuje rozwój projektu — biblioteka materiałów
            dodatkowych dopiero rośnie i nie gwarantujemy częstotliwości publikacji nowych materiałów.
          </p>
          <p>
            Osoby, które mają już aktywny dostęp do Strefy Fenkju, mogą dodatkowo wspierać kanał dowolną kwotą.
            Taka dodatkowa wpłata jest dobrowolnym wsparciem projektu, nie stanowi zapłaty za nowe treści cyfrowe,
            dodatkowy dostęp ani inne świadczenie wzajemne i nie daje żadnych dodatkowych korzyści poza tymi,
            które użytkownik już posiada.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Płatności">
          <p>
            Płatności obsługuje Stripe. Kwoty podawane w serwisie są kwotami całkowitymi (brutto).
            Po udanej płatności otrzymasz potwierdzenie e-mailem. Nie przechowujemy danych Twojej karty.
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Odstąpienie od umowy">
          <p>
            Konsumentowi przysługuje 14 dni na odstąpienie od umowy zawartej na odległość. Ponieważ jednak dostęp
            do Strefy Fenkju uruchamiamy natychmiast po płatności, przed wpłatą wyrażasz zgodę na natychmiastowe
            dostarczenie treści cyfrowych i przyjmujesz do wiadomości, że z chwilą uruchomienia dostępu tracisz
            prawo odstąpienia (art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta).
          </p>
          <p>
            Jeżeli zapłaciłeś, a dostęp nie został uruchomiony — napisz do nas; naprawimy to albo zwrócimy pieniądze.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Reklamacje">
          <p>
            Coś nie działa? Napisz na <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
            opisz problem i podaj e-mail konta. Odpowiemy najpóźniej w ciągu 14 dni. Odpowiadamy za zgodność treści
            cyfrowych z umową na zasadach ustawy o prawach konsumenta. Konsument może też skorzystać z bezpłatnej
            pomocy miejskiego lub powiatowego rzecznika konsumentów.
          </p>
        </LegalSection>

        <LegalSection nr="8" title="Zmiany regulaminu i prawo właściwe">
          <p>
            Regulamin możemy zmienić z ważnych powodów (np. zmiana prawa lub funkcji serwisu). O zmianach poinformujemy
            w serwisie z wyprzedzeniem, a zmiany nie odbierają praw już nabytych — w szczególności przyznanego dostępu
            do Strefy Fenkju. Umowy podlegają prawu polskiemu, co nie pozbawia konsumenta ochrony wynikającej
            z przepisów bezwzględnie obowiązujących.
          </p>
        </LegalSection>
      </div>
    </>
  );
}

const DATA_ROWS = [
  { what: 'Konto i logowanie', data: 'e-mail, nazwa, avatar', why: 'prowadzenie konta (obsługuje Clerk)' },
  { what: 'Płatności', data: 'kwota, data, identyfikator transakcji', why: 'realizacja wsparcia i obowiązki podatkowe (obsługuje Stripe; nie widzimy danych karty)' },
  { what: 'Komentarze', data: 'treść, nazwa, data', why: 'publiczna dyskusja pod filmami' },
  { what: 'E-maile', data: 'adres e-mail', why: 'potwierdzenia wpłat i powiadomienia (obsługuje Resend); z powiadomień możesz się wypisać jednym kliknięciem' },
  { what: 'Bezpieczeństwo', data: 'adres IP, logi techniczne', why: 'ochrona serwisu przed nadużyciami i limity zapytań' },
];

/** Full Privacy Policy body (no page chrome), shared by the /polityka-prywatnosci page and the modal. */
export function PolitykaContent() {
  return (
    <>
      <LegalSummary
        items={[
          'Zbieramy tylko to, co potrzebne do działania serwisu: konto, płatności, komentarze, logi bezpieczeństwa.',
          'Niczego nie sprzedajemy i nie profilujemy Cię reklamowo. Brak cookies reklamowych.',
          <>Zawsze możesz poprosić o dostęp do swoich danych albo ich usunięcie: {OWNER.email}.</>,
        ]}
      />

      <div className="space-y-10">
        <LegalSection nr="1" title="Administrator danych">
          <p>
            Administratorem Twoich danych jest {OWNER.name}, {OWNER.address}.
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
            Podstawy prawne: wykonanie umowy (konto, dostęp, płatności), obowiązki prawne (podatki i księgowość)
            oraz nasz uzasadniony interes (bezpieczeństwo serwisu).
          </p>
        </LegalSection>

        <LegalSection nr="3" title="Komu powierzamy dane">
          <p>
            Korzystamy z zaufanych dostawców technologii: Clerk (logowanie), Stripe (płatności), Resend (e-maile),
            Vercel (hosting), Neon (baza danych), Cloudflare (wideo) i Upstash (ochrona przed nadużyciami).
            Przetwarzają oni dane wyłącznie na nasze polecenie. Część z nich działa w USA — transfer odbywa się
            na podstawie unijnych mechanizmów (Data Privacy Framework lub standardowe klauzule umowne).
            Nikomu nie sprzedajemy Twoich danych.
          </p>
        </LegalSection>

        <LegalSection nr="4" title="Jak długo przechowujemy dane">
          <p>
            Dane konta — do czasu jego usunięcia. Dane płatności — 5 lat od końca roku podatkowego (wymóg prawa).
            Logi techniczne — do 90 dni. Komentarze — do czasu ich usunięcia przez Ciebie lub moderację.
          </p>
        </LegalSection>

        <LegalSection nr="5" title="Twoje prawa">
          <p>
            Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
            przenoszenia oraz sprzeciwu. Wystarczy e-mail na{' '}
            <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
            w ten sposób usuniesz też konto. Możesz również złożyć skargę do Prezesa Urzędu Ochrony Danych
            Osobowych (uodo.gov.pl).
          </p>
        </LegalSection>

        <LegalSection nr="6" title="Cookies">
          <p>
            Używamy wyłącznie plików cookies niezbędnych do działania serwisu: utrzymania sesji po zalogowaniu
            i bezpieczeństwa. Nie używamy cookies reklamowych ani śledzących. Cookies możesz usunąć
            w ustawieniach przeglądarki — serwis bez zalogowania będzie działał normalnie.
          </p>
        </LegalSection>

        <LegalSection nr="7" title="Zmiany polityki">
          <p>
            Jeśli polityka się zmieni (np. dojdzie nowy dostawca), zaktualizujemy ten dokument i datę na górze strony.
            Istotne zmiany zakomunikujemy w serwisie.
          </p>
        </LegalSection>
      </div>
    </>
  );
}

import React from 'react';
import { APP_NAME } from '@/lib/constants';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';

export const metadata = {
  title: `Regulamin — ${APP_NAME}`,
  description: `Regulamin serwisu ${APP_NAME}: zasady korzystania, wsparcie twórcy, dostęp do Strefy Fenkju, reklamacje.`,
};

const OWNER = {
  name: 'Paweł Perfect',
  address: 'ul. Złota 75A/7, 00-819 Warszawa',
  nip: '527-000-00-00',
  regon: '000000000',
  phone: '+48 600 000 000',
  email: 'kontakt@polutek.pl',
};

function Section({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
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

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-background text-[#1a1a1a]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[#1a1a1a]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Regulamin serwisu {APP_NAME}</h1>
          <p className="mt-2 text-sm text-[#7a7a7a]">Obowiązuje od 3 lipca 2026 r.</p>
        </header>

        <div className="mb-12 rounded-xl border border-[#1a1a1a]/15 bg-white/60 p-5 text-[14px] leading-[1.7]">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#7a7a7a]">W skrócie</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Oglądanie publicznych filmów jest darmowe i nie wymaga konta.</li>
            <li>Jednorazowa wpłata w kwocie wskazanej w serwisie daje dożywotni dostęp do Strefy Fenkju. Bez subskrypcji.</li>
            <li>Dostęp dostajesz od razu, dlatego — za Twoją zgodą — nie przysługuje odstąpienie od umowy po jego uruchomieniu.</li>
            <li>Reklamacje: napisz na {OWNER.email}, odpowiadamy do 14 dni.</li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section nr="1" title="Kto prowadzi serwis">
            <p>
              Serwis {APP_NAME} prowadzi {OWNER.name}, {OWNER.address}, NIP: {OWNER.nip}, REGON: {OWNER.regon}.
              Kontakt: <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>, tel. {OWNER.phone}.
              Najszybciej odpowiadamy na e-maile.
            </p>
          </Section>

          <Section nr="2" title="Co znajdziesz w serwisie">
            <p>
              {APP_NAME} to autorski kanał wideo jednego twórcy. Publiczne filmy oglądasz za darmo i bez konta.
              Część funkcji (komentarze, materiały dla zalogowanych) wymaga bezpłatnego konta.
              Strefa Fenkju to sekcja z materiałami dodatkowymi, dostępna dla wspierających (§ 4).
            </p>
            <p>
              Do korzystania z serwisu wystarczy urządzenie z aktualną przeglądarką internetową i dostęp do internetu,
              a do założenia konta — adres e-mail. Logowanie obsługuje zewnętrzny dostawca Clerk.
            </p>
          </Section>

          <Section nr="3" title="Konto i zasady korzystania">
            <p>
              Konto jest bezpłatne i możesz je w każdej chwili usunąć (wystarczy e-mail na adres z § 1).
              Korzystając z serwisu — w szczególności komentując — nie wolno publikować treści bezprawnych,
              obraźliwych ani spamu. Takie treści możemy usuwać, a w razie powtarzających się naruszeń zablokować konto.
              Filmy i pozostałe materiały są chronione prawem autorskim i przeznaczone wyłącznie do osobistego użytku.
            </p>
          </Section>

          <Section nr="4" title="Wsparcie i dostęp do Strefy Fenkju">
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
              Osoby, które mają już dostęp, mogą dodatkowo wspierać kanał dowolną kwotą. Takie wpłaty są dobrowolne
              i nie wiążą się z żadnymi dodatkowymi świadczeniami.
            </p>
          </Section>

          <Section nr="5" title="Płatności">
            <p>
              Płatności obsługuje Stripe. Kwoty podawane w serwisie są kwotami całkowitymi (brutto).
              Po udanej płatności otrzymasz potwierdzenie e-mailem. Nie przechowujemy danych Twojej karty.
            </p>
          </Section>

          <Section nr="6" title="Odstąpienie od umowy">
            <p>
              Konsumentowi przysługuje 14 dni na odstąpienie od umowy zawartej na odległość. Ponieważ jednak dostęp
              do Strefy Fenkju uruchamiamy natychmiast po płatności, przed wpłatą wyrażasz zgodę na natychmiastowe
              dostarczenie treści cyfrowych i przyjmujesz do wiadomości, że z chwilą uruchomienia dostępu tracisz
              prawo odstąpienia (art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta).
            </p>
            <p>
              Jeżeli zapłaciłeś, a dostęp nie został uruchomiony — napisz do nas; naprawimy to albo zwrócimy pieniądze.
            </p>
          </Section>

          <Section nr="7" title="Reklamacje">
            <p>
              Coś nie działa? Napisz na <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
              opisz problem i podaj e-mail konta. Odpowiemy najpóźniej w ciągu 14 dni. Odpowiadamy za zgodność treści
              cyfrowych z umową na zasadach ustawy o prawach konsumenta. Konsument może też skorzystać z bezpłatnej
              pomocy miejskiego lub powiatowego rzecznika konsumentów.
            </p>
          </Section>

          <Section nr="8" title="Zmiany regulaminu i prawo właściwe">
            <p>
              Regulamin możemy zmienić z ważnych powodów (np. zmiana prawa lub funkcji serwisu). O zmianach poinformujemy
              w serwisie z wyprzedzeniem, a zmiany nie odbierają praw już nabytych — w szczególności przyznanego dostępu
              do Strefy Fenkju. Umowy podlegają prawu polskiemu, co nie pozbawia konsumenta ochrony wynikającej
              z przepisów bezwzględnie obowiązujących.
            </p>
          </Section>
        </div>

        <div className="mt-20 border-t border-[#1a1a1a]/10 pt-10">
          <Link href="/" className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest transition-colors hover:text-primary">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
            Wróć na stronę główną
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

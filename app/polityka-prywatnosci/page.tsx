import React from 'react';
import { APP_NAME } from '@/lib/constants';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';

export const metadata = {
  title: `Polityka prywatności — ${APP_NAME}`,
  description: `Polityka prywatności serwisu ${APP_NAME}: jakie dane zbieramy, po co i jakie masz prawa.`,
};

const OWNER = {
  name: 'Paweł Perfect',
  address: 'ul. Złota 75A/7, 00-819 Warszawa',
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

const DATA_ROWS = [
  {
    what: 'Konto i logowanie',
    data: 'e-mail, nazwa, avatar',
    why: 'prowadzenie konta (obsługuje Clerk)',
  },
  {
    what: 'Płatności',
    data: 'kwota, data, identyfikator transakcji',
    why: 'realizacja wsparcia i obowiązki podatkowe (obsługuje Stripe; nie widzimy danych karty)',
  },
  {
    what: 'Komentarze',
    data: 'treść, nazwa, data',
    why: 'publiczna dyskusja pod filmami',
  },
  {
    what: 'E-maile',
    data: 'adres e-mail',
    why: 'potwierdzenia wpłat i powiadomienia (obsługuje Resend); z powiadomień możesz się wypisać jednym kliknięciem',
  },
  {
    what: 'Bezpieczeństwo',
    data: 'adres IP, logi techniczne',
    why: 'ochrona serwisu przed nadużyciami i limity zapytań',
  },
];

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-background text-[#1a1a1a]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <header className="mb-10 border-b-2 border-[#1a1a1a]/10 pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Polityka prywatności {APP_NAME}</h1>
          <p className="mt-2 text-sm text-[#7a7a7a]">Obowiązuje od 3 lipca 2026 r.</p>
        </header>

        <div className="mb-12 rounded-xl border border-[#1a1a1a]/15 bg-white/60 p-5 text-[14px] leading-[1.7]">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#7a7a7a]">W skrócie</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Zbieramy tylko to, co potrzebne do działania serwisu: konto, płatności, komentarze, logi bezpieczeństwa.</li>
            <li>Niczego nie sprzedajemy i nie profilujemy Cię reklamowo. Brak cookies reklamowych.</li>
            <li>Zawsze możesz poprosić o dostęp do swoich danych albo ich usunięcie: {OWNER.email}.</li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section nr="1" title="Administrator danych">
            <p>
              Administratorem Twoich danych jest {OWNER.name}, {OWNER.address}.
              W sprawach danych osobowych pisz na{' '}
              <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a>.
            </p>
          </Section>

          <Section nr="2" title="Jakie dane zbieramy i po co">
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
          </Section>

          <Section nr="3" title="Komu powierzamy dane">
            <p>
              Korzystamy z zaufanych dostawców technologii: Clerk (logowanie), Stripe (płatności), Resend (e-maile),
              Vercel (hosting), Neon (baza danych), Cloudflare (wideo) i Upstash (ochrona przed nadużyciami).
              Przetwarzają oni dane wyłącznie na nasze polecenie. Część z nich działa w USA — transfer odbywa się
              na podstawie unijnych mechanizmów (Data Privacy Framework lub standardowe klauzule umowne).
              Nikomu nie sprzedajemy Twoich danych.
            </p>
          </Section>

          <Section nr="4" title="Jak długo przechowujemy dane">
            <p>
              Dane konta — do czasu jego usunięcia. Dane płatności — 5 lat od końca roku podatkowego (wymóg prawa).
              Logi techniczne — do 90 dni. Komentarze — do czasu ich usunięcia przez Ciebie lub moderację.
            </p>
          </Section>

          <Section nr="5" title="Twoje prawa">
            <p>
              Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania,
              przenoszenia oraz sprzeciwu. Wystarczy e-mail na{' '}
              <a href={`mailto:${OWNER.email}`} className="underline hover:text-primary">{OWNER.email}</a> —
              w ten sposób usuniesz też konto. Możesz również złożyć skargę do Prezesa Urzędu Ochrony Danych
              Osobowych (uodo.gov.pl).
            </p>
          </Section>

          <Section nr="6" title="Cookies">
            <p>
              Używamy wyłącznie plików cookies niezbędnych do działania serwisu: utrzymania sesji po zalogowaniu
              i bezpieczeństwa. Nie używamy cookies reklamowych ani śledzących. Cookies możesz usunąć
              w ustawieniach przeglądarki — serwis bez zalogowania będzie działał normalnie.
            </p>
          </Section>

          <Section nr="7" title="Zmiany polityki">
            <p>
              Jeśli polityka się zmieni (np. dojdzie nowy dostawca), zaktualizujemy ten dokument i datę na górze strony.
              Istotne zmiany zakomunikujemy w serwisie.
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

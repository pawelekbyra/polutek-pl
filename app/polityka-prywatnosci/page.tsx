import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1a1a1a] font-serif">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-12 border-b-2 border-[#1a1a1a]/10 pb-8">Polityka Prywatności</h1>
        <div className="prose prose-md prose-neutral leading-relaxed space-y-8">
          <section>
            <h2 className="text-lg font-black uppercase tracking-tight text-[#1a1a1a]">1. Dane osobowe i logowanie</h2>
            <p>
              Dla bezpieczeństwa i wygody użytkowników, POLUTEK.PL korzysta z zewnętrznego systemu uwierzytelniania <strong>Clerk</strong>.
              Clerk zarządza procesem rejestracji, logowania oraz danymi profilowymi użytkowników. Rejestrując się, zgadzasz się na
              przetwarzanie danych przez tę platformę zgodnie z jej polityką prywatności.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">2. Płatności i bezpieczeństwo finansowe</h2>
            <p>
              Wszystkie operacje finansowe (darowizny, napiwki) są procesowane wyłącznie przez <strong>Stripe</strong> – światowego lidera
              bezpiecznych płatności online. POLUTEK.PL nie przechowuje ani nie ma bezpośredniego dostępu do danych kart płatniczych
              ani innych poufnych informacji bankowych. Stripe gwarantuje najwyższy poziom bezpieczeństwa transakcji.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">3. Przetwarzanie i wykorzystanie danych</h2>
            <p>
              Twoje dane są wykorzystywane wyłącznie w celu zapewnienia prawidłowego funkcjonowania serwisu, personalizacji dostępu
              do materiałów &quot;premium&quot; oraz ewentualnego kontaktu w sprawach technicznych. Nigdy nie udostępniamy Twoich danych osobom trzecim
              poza wymienionymi dostawcami technologicznymi (Clerk i Stripe).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">4. Pliki Cookies</h2>
            <p>
              Strona POLUTEK.PL wykorzystuje niezbędne pliki cookies do utrzymania sesji użytkownika oraz zapewnienia bezpieczeństwa.
              Wykorzystujemy je również do analizy ruchu, aby stale ulepszać nasz serwis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">5. Kontakt</h2>
            <p>
              W sprawach dotyczących Twoich danych osobowych, możesz kontaktować się bezpośrednio z twórcą serwisu pod adresem email: pawel.perfect@gmail.com.
            </p>
          </section>
        </div>

        <div className="mt-24 pt-12 border-t border-[#1a1a1a]/5">
           <Link href="/" className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest hover:text-primary transition-colors">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
              Wróć do strony głównej
           </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

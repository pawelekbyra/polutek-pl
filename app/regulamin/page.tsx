import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import Link from 'next/link';
import { ArrowLeft } from '@/app/components/icons';

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1a1a1a] font-serif leading-relaxed">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-12 border-b-2 border-[#1a1a1a]/10 pb-8">Regulamin Serwisu POLUTEK.PL</h1>
        <div className="prose prose-md prose-neutral space-y-8 text-[#1a1a1a]">
          <section>
            <h2 className="text-lg font-black uppercase tracking-tight text-[#1a1a1a]">1. Charakter platformy</h2>
            <p>
              Serwis POLUTEK.PL jest prywatną, autorską platformą wideo.
              Platforma działa w modelu dożywotniego patronatu. Dostęp do treści cyfrowych jest uzależniony od łącznej kwoty wsparcia przekazanego twórcy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">2. Model wsparcia i dostęp do treści</h2>
            <p>
              Wsparcie finansowe przekazywane przez użytkowników ma charakter <strong>dobrowolnej wpłaty (napiwku)</strong>.
              Użytkownicy odblokowują kolejne poziomy dostępu (Tiers) na podstawie swojej <strong>historycznej sumy wpłat</strong> (Lifetime Total):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>GUEST:</strong> Dostęp do materiałów publicznych. Brak możliwości komentowania.</li>
              <li><strong>LOGGED_IN:</strong> Możliwość komentowania, lajkowania i dostępu do podstawowych materiałów dla zalogowanych (Suma wpłat: 0 PLN).</li>
              <li><strong>VIP1:</strong> Dożywotni dostęp do materiałów poziomu VIP1 (Suma wpłat: ≥ 5 PLN).</li>
              <li><strong>VIP2:</strong> Dożywotni dostęp do wszystkich materiałów premium poziomu VIP2 (Suma wpłat: ≥ 10 PLN).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">3. Płatności i brak zwrotów</h2>
            <p>
              Wszelkie wpłaty są procesowane przez Stripe i mają charakter bezzwrotny. Dokonując wpłaty, użytkownik wspiera rozwój projektów POLUTEK.PL
              i w zamian otrzymuje dostęp do określonych sekcji serwisu. Raz odblokowany poziom dostępu jest przypisany do konta użytkownika na stałe (Lifetime Access).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">4. Prywatność i konto użytkownika</h2>
            <p>
              Autoryzacja w serwisie odbywa się za pośrednictwem systemu Clerk. Użytkownik zobowiązuje się do korzystania z serwisu w sposób zgodny z prawem
              i nienaruszający dóbr osobistych twórcy oraz innych użytkowników. Komentowanie materiałów wymaga zalogowania.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#1a1a1a]">5. Postanowienia końcowe</h2>
            <p>
              Twórca zastrzega sobie prawo do zmiany regulaminu oraz modyfikacji poziomów dostępu w przyszłości.
              Korzystanie z serwisu po wprowadzeniu zmian oznacza ich akceptację.
            </p>
          </section>
        </div>

        <div className="mt-24 pt-12 border-t border-[#1a1a1a]/5">
           <Link href="/" className="group flex items-center gap-3 text-sm font-black uppercase tracking-widest hover:text-primary transition-colors">
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-2" />
              Wróć do platformy
           </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

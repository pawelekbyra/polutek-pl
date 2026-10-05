/**
 * Honest "coming in phase N" pages for modules that are not built yet (no mock data, no dead filters).
 * Scope lines follow docs/architecture/admin-panel.md section 3 (MUST at launch) and section 4 (phases).
 */
export type UpcomingModule = {
  id: string;
  title: string;
  phase: 2 | 3 | 4;
  summary: string;
  scope: string[];
  /** Where the owner does this today (old panel on www), if anywhere. */
  today?: { label: string; path: string }[];
};

export const UPCOMING_MODULES: Record<string, UpcomingModule> = {
  spolecznosc: {
    id: "spolecznosc",
    title: "Społeczność",
    phase: 3,
    summary: "Moderacja z klawiatury, komentarze i profil 360° każdej osoby. Odczyt w fazie 3, akcje (ukryj, wycisz, odpowiedz) w fazie 4.",
    scope: ["kolejka moderacji: j/k, h ukryj, z zostaw, w wycisz, z cofnięciem", "komentarze z filtrami w adresie", "profil 360°: konto, 2FA, sesje, komentarze, wpłaty, e-maile, audyt", "segmenty i wzrost liczby kont"],
    today: [
      { label: "Zgłoszenia w starym panelu", path: "/admin/comments/reports" },
      { label: "Komentarze", path: "/admin/comments" },
      { label: "Użytkownicy", path: "/admin/users" },
    ],
  },
  przychody: {
    id: "przychody",
    title: "Przychody",
    phase: 3,
    summary: "Napiwki jedną definicją (opłacone i częściowo zwrócone, netto), lejek bramki, spory z terminem i zdrowie webhooków. Zwroty dopiero w fazie 4, zawsze z ponownym potwierdzeniem tożsamości.",
    scope: ["przychód brutto i netto, lista wpłat z filtrami", "lejek bramki napiwkowej", "spory z terminem na dowody, zwroty ze step-up", "rekonsylacja, eksport CSV odporny na wstrzyknięcie formuł"],
    today: [
      { label: "Wpłaty w starym panelu", path: "/admin/users/payments" },
      { label: "Ustawienia płatności", path: "/admin/payments" },
    ],
  },
  komunikacja: {
    id: "komunikacja",
    title: "Komunikacja",
    phase: 3,
    summary: "E-maile transakcyjne, dostarczalność względem progów Resend, rozsyłki, wypisy i PP Support w jednym miejscu.",
    scope: ["maile transakcyjne i dostarczalność", "limity Resend", "rozsyłki (wysyłka ze step-up w fazie 4)", "wypisy, blokady, liczby z PP Support"],
    today: [{ label: "Poczta w starym panelu", path: "/admin/emails" }],
  },
  bezpieczenstwo: {
    id: "bezpieczenstwo",
    title: "Bezpieczeństwo",
    phase: 3,
    summary: "Logowania do panelu, sesje, nieudane próby i dziennik audytu z filtrami. Dziennik logowań panelu już się zapisuje (AdminAuthEvent, tylko dopisywanie, łańcuch skrótów); ekran przyjdzie w fazie 3.",
    scope: ["logowania admina i aktywne sesje", "passkey, TOTP, step-up i Cloudflare Access w jednym widoku", "nieudane logowania i blokady", "dziennik audytu z filtrami i eksportem"],
  },
  ustawienia: {
    id: "ustawienia",
    title: "Ustawienia",
    phase: 4,
    summary: "Kanał, progi płatności, alerty i stan integracji (bez wartości sekretów). Wygląd panelu działa już teraz.",
    scope: ["kanał i baner", "progi płatności", "progi alertów i godziny ciszy", "stan integracji, konto administratora"],
    today: [
      { label: "Kanał w starym panelu", path: "/admin/channel" },
      { label: "Media", path: "/admin/settings" },
    ],
  },
};

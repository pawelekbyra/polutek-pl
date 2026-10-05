# SZKIC: uzupełnienia Polityki prywatności i podstawa cookies (art. 399 PKE)

> **DO PRZEGLĄDU PRAWNIKA. Nie publikować w serwisie bez jego zgody.** Szkic inżynieryjny, nie porada prawna.
> Nie jest wczytywany przez żadną stronę. Stan faktów: 2026-10-05, kod z gałęzi `fix/audits-www`.
> Dotyczy LEG-02, LEG-09, LEG-10, LEG-11, LEG-12, LEG-20, LEG-30 z `audit-legal-privacy.md`.

## 1. Cookies i pamięć przeglądarki: zgoda czy nie

- Art. 399 ust. 1 PKE (od 10.11.2024): zapis informacji w urządzeniu końcowym albo dostęp do nich wymaga zgody, **chyba
  że jest niezbędny do świadczenia usługi, o którą wprost prosi użytkownik** (analogia do art. 5(3) dyrektywy
  ePrivacy). Wytyczne EROD 2/2023 (v2, 7.10.2024) obejmują też piksele, odciski urządzeń i ładowanie zasobów
  czytających informacje z urządzenia ([EROD](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)).
- Po zmianach z tego PR-a **żaden zapis nie powstaje u gościa, który tylko ogląda**: Stripe.js (`__stripe_mid`,
  `__stripe_sid`) ładuje się dopiero po otwarciu bramki napiwkowej (`@stripe/stripe-js/pure`), Google One Tap
  (`g_state`) dopiero w otwartym oknie logowania, hls.js jest we własnym bundlu, Turnstile nie używa cookies.
  Pełny wykaz: `docs/legal/STORAGE-INVENTORY.md` (pilnowany testem).
- **Do oceny prawnika:** (a) czy `__stripe_mid` (rok) w trakcie płatności jest „niezbędny” (argument: ochrona przed
  nadużyciem płatności inicjowanej przez użytkownika; kontrargument: roczny identyfikator urządzenia, [analiza](https://getconzent.com/cookie/__stripe_mid/));
  (b) czy One Tap zainicjowany otwarciem okna logowania wystarczy bez zgody; (c) **telemetria strony** (`/api/t`,
  kolektor własny, bez cookies i bez zapisu na urządzeniu): jeśli nic nie jest zapisywane ani odczytywane z urządzenia,
  art. 399 PKE nie ma zastosowania, ale RODO (podstawa, obowiązek informacyjny, retencja) tak. Wyłącznik:
  `TELEMETRY_BEACON=off`.
- Wniosek ostrożny: baner zgody nie jest potrzebny, dopóki spełnione są warunki powyżej; test w repo wykryje nowy
  klucz pamięci, który nie trafił do inwentarza.

## 2. Poprawki treści § 6 (cookies), jeśli prawnik zaakceptuje stan z pkt 1

Zamiast ogólnego zdania o „pamięci przeglądarki” podać tabelę z `STORAGE-INVENTORY.md` (nazwa, cel, czas, kiedy
powstaje), z zaznaczeniem, że Stripe i Google ustawiają swoje cookies dopiero po wykonaniu przez użytkownika
czynności (płatność, logowanie) i że są to odrębni administratorzy.

## 3. Brakujące elementy art. 13/14 RODO (lista z LEG-11, do uzupełnienia w tekście)

- źródło danych przy logowaniu Google (e-mail, imię, zdjęcie) i fakt, że Google jest odrębnym administratorem;
- czy podanie danych jest wymogiem umownym (konto: tak, e-mail) i skutek niepodania;
- brak zautomatyzowanego podejmowania decyzji o skutkach prawnych (Turnstile, limity zapytań to środki
  bezpieczeństwa, nie profilowanie);
- konkretne prawnie uzasadnione interesy (bezpieczeństwo, statystyki oglądania, ochrona linków, obrona roszczeń);
- publiczna widoczność pseudonimu i awatara przy komentarzach;
- kategorie: 2FA/passkey, język, reakcje, subskrypcje, powiadomienia, kontakt w Resend (po zgodzie), korespondencja
  supportu (także kopia w skrzynce właściciela: LEG-07, decyzja właściciela);
- odbiorcy z rolą (podmiot przetwarzający / odrębny administrator): Hetzner (DE, umowa powierzenia w panelu),
  Cloudflare (DPA, SCC), Resend (USA, SCC + DPF), Stripe (IE + USA, DPF) i operatorzy metod płatności, Google;
  **zweryfikować** lokalizację bucketu kopii `serwerek-backups` (LEG-12).

## 4. Retencja (LEG-09): stan faktyczny do wpisania do tabeli okresów

Jest cron retencji (`/api/cron/retention`, timer systemd) oraz `prune-expired-auth`, `prune-playback-sessions`,
`prune-unverified-accounts`, `purge-deleted-comments`. Przed publikacją tabeli prawnik potwierdza okresy dla
płatności (zwykle 5 lat podatkowo), logów audytu i telemetrii; wartości muszą odpowiadać stałym w
`lib/modules/**/retention*` i opisowi w `docs/operations/` (sprawdzić, nie przepisywać z pamięci).

## 5. Prawa osób (LEG-20): stan po tym PR-ie

- **Dostęp i przenoszenie:** `GET /api/user/export` (JSON z własnymi danymi konta, komentarzami, reakcjami,
  subskrypcjami, preferencjami e-mail i płatnościami; bez haseł, tokenów, IP i danych innych osób); przycisk
  „Pobierz moje dane” w oknie konta. Zdanie w Polityce § 5 można zmienić na: „Dane pobierzesz sam w ustawieniach
  konta; w innych sprawach napisz na support@…”.
- **Usunięcie:** w ustawieniach konta (nieodwracalne, z ponownym potwierdzeniem); komentarze zostają ukryte i
  wyczyszczone z treści, kontakt w Resend usuwany, historia e-maili zanonimizowana. Płatności i logi bezpieczeństwa
  zostają przez okres wynikający z przepisów (do potwierdzenia przez prawnika).
- Zdanie „w ten sposób usuniesz też konto” w § 5 (PL i EN) sugeruje, że każdy e-mail o prawach kasuje konto:
  do przeformułowania.

## 6. Różnice PL/EN (LEG-23)

- Podsumowanie, pkt 2: PL „Niczego nie sprzedajemy” vs EN „We never sell your data”: ujednolicić do „nie sprzedajemy
  Twoich danych”.
- EN § 2: „a gift” → „a donation” (jak w Regulaminie EN).

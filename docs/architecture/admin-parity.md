# Parytet: stary panel `/admin` → nowy panel `admin.pawelperfect.com`

Stan: 2026-10-04 (po zmianie zakresu przez właściciela: nowy panel ma pokryć **wszystko**, co robi stary panel
i cała obsługa strony, nie tylko analitykę). Źródła: kod `app/admin/**`, `app/api/admin/**` (49 plików, 66
handlerów), wywołania z publicznego UI, audyt [`admin-1-audit.md`](../audit/2026-10-03/admin-1-audit.md) (sekcje 2–3).
Plan faz: [`admin-panel.md`](admin-panel.md) sekcja 4. Wygląd ekranów: prototyp `docs/design/admin-panel/`
(adresy `#/…` w kolumnie „Nowy panel”).

**Zasada:** stary panel działa do fazy 5, a sekcja przechodzi na 308 do nowego panelu dopiero, gdy każdy wiersz
tej sekcji ma status „zrobione”. Każda zmiana zakresu = zmiana tego pliku w tym samym PR.

**Fazy (skrót, sekcja 4 w `admin-panel.md`):** 0 fundament i zbieranie · 1 powłoka, logowanie, Dzisiaj, System ·
**2 Treści i Społeczność (pełny CRUD)** · **3 Kanał, Przychody, Komunikacja, Powiadomienia, Bezpieczeństwo** ·
A Analityka i tryb premiery (równolegle od fazy 2, gdy jest 7+ dni danych) · 5 wygaszenie starego panelu.

**Status:** `zrobione` · `plan` (ekran jest w prototypie, kod w fazie z kolumny) · `DROP` (świadomie nie przenosimy) ·
`decyzja` (czeka na właściciela).

## 1. Strony i przyciski starego panelu

### 1.1 Pulpit

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| `/admin`: 7 kafelków-linków (bez danych) | **Dzisiaj** `#/dzisiaj` (zdrowie, KPI, „Wymaga uwagi”, aktywność, kolejki) | 1 | zrobione |
| link „Zarządzaj kanałem” w `UserMenu.tsx` i `AccountModal.tsx` na `www` | link do `admin.pawelperfect.com` (zmiana w fazie 5) | 5 | plan |

### 1.2 Filmy (`/admin/videos`, `/admin/videos/[id]`, `/admin/videos/[id]/edit`, `/admin/videos/layout`)

| Stary panel: funkcja / przycisk | Nowy panel | Faza | Status |
|---|---|---|---|
| Lista filmów z filtrami (status, tier, szukaj) i stronami | **Treści** `#/tresci` (filtry i strona w URL, stan HLS, miniatura, napisy) | 2 | plan |
| Statystyki nad listą (`AdminVideoStats`) | kafle na liście Treści; obejrzenia z faz A | 2 | plan |
| „Utwórz” (inline na liście) | **Nowy film** `#/tresci/nowy` (osobny ekran: metadane → wgranie oryginału → kodowanie) | 2 | plan |
| Upload oryginału (multipart, wznawianie, weryfikacja) | `#/tresci/nowy` krok 2 i karta „Kodowanie i wideo” filmu (te same use case'y i `multipart-uploader.ts`) | 2 | plan |
| Postęp kodowania (polling) | karta „Kodowanie i wideo” (etapy, rendycje, log błędu) | 2 | plan |
| „Anuluj kodowanie” | przycisk „Anuluj” w karcie kodowania (odwracalne, bez okna) | 2 | plan |
| „Zakoduj ponownie” / „Ponów” | „Przekoduj” / „Ponów kodowanie” | 2 | plan |
| „Usuń wersję HLS” (2 kliknięcia) | lista wersji w karcie kodowania, okno ze skutkiem | 2 | plan |
| „Edytuj” (inline na liście) | **DROP**: jeden formularz edycji na film | – | DROP |
| `/edit`: tytuł, slug, opis, tier, status, kategorie pól | **Edycja** `#/tresci/<slug>/edycja` (wszystkie pola, walidacja przy polu) | 2 | plan |
| `/edit`: „Publikacja: Natychmiast / Premiera + data” | karta „Publikacja i premiera” | 2 | plan |
| `/edit`: „Cel zbiórki” (procent ręczny, kwota, waluta, data) | karta „Pasek zbiórki” w edycji | 2 | plan |
| Miniatura (`CoverImageUpload`, podgląd) | karta „Miniatura” (kadrowanie, 3 podglądy, magic bytes) | 2 | plan |
| Napisy PL/EN (URL VTT w formularzu) | karta „Napisy” (wgranie VTT z walidacją; zarządzany hosting: #1219) | 2 | plan |
| Szczegóły: zakładka Podsumowanie (odtwarzacz) | Przegląd filmu + „Podgląd jako widz” | 2 | plan |
| Szczegóły: zakładka Treść | edycja | 2 | plan |
| Szczegóły: zakładka Media (pipeline) | karta „Kodowanie i wideo” | 2 | plan |
| Szczegóły: zakładka Dostęp | pole „Dostęp” + lista kontrolna | 2 | plan |
| Szczegóły: zakładka Diagnostyka | lista kontrolna publikacji (pre-flight) i test po publikacji | 2 | plan |
| Szczegóły: zakładka Komentarze (martwa, ADM-06) | Społeczność → Komentarze z filtrem filmu | 2 | plan |
| Szczegóły: zakładka Statystyki | Analityka filmu | A | plan |
| Szczegóły: zakładka Historia | karta „Historia zmian” (audyt) | 2 | plan |
| „Publikuj” | przycisk „Opublikuj” (blokady publikacji, pre-flight) | 2 | plan |
| „Cofnij publikację” (bez potwierdzenia, ADM-05) | okno „Skutek” (zdejmuje z sidebaru i Hero, kasuje publiczną miniaturę) | 2 | plan |
| „Archiwizuj” (bez potwierdzenia) | okno „Skutek” | 2 | plan |
| „Przywróć” (z archiwum) | przycisk „Przywróć do szkiców” | 2 | plan |
| „Usuń film” (dialog) | strefa zagrożenia: okno ze skutkiem + wpisanie sluga | 2 | plan |
| „Duplikuj” (kopia bez okładki, ADM-10) | „Duplikuj jako szkic” (z okładką) | 2 | plan |
| „Podgląd”, „Kopiuj link” | „Podgląd jako widz”, „Kopiuj link” | 2 | plan |
| Hero on/off (szczegóły) | przełącznik „Hero strony głównej” (karta Ekspozycja) | 2 | plan |
| Sidebar on/off i pozycja (szczegóły) | przełącznik „Na liście filmów” + pozycja | 2 | plan |
| `/admin/videos/layout`: kolejność, Hero, oko (zapis nie działa dla Hero, ADM-02) | **Układ kanału** `#/tresci?widok=uklad` (przeciąganie i klawiatura, jeden zapis) | 2 | plan |

### 1.3 Użytkownicy i wpłaty (`/admin/users*`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Lista użytkowników, filtry, szukaj, sortowanie | **Społeczność → Użytkownicy** `#/spolecznosc?tab=uzytkownicy` | 2 | plan |
| 4 kafelki statystyk (`/users/stats`) | kafle nad listą | 2 | plan |
| Eksport CSV (`/users/export`) | „Eksport CSV” ze step-up (dane osobowe) | 2 | plan |
| „Wyślij wiadomość” (martwy) | DROP (wysyłka do jednej osoby: PP Support) | – | DROP |
| Nadaj / cofnij znacznik wspierającego (dialog z powodem) | profil 360°: „Znacznik wspierającego…” (okno z powodem) | 2 | plan |
| Szczegóły: Podsumowanie, suma wpłat | profil 360° `#/spolecznosc/u/<id>` | 2 | plan |
| Szczegóły: Wpłaty | karta „Napiwki” w profilu | 2 | plan |
| Szczegóły: Granty | karta „Znacznik wspierającego” (historia nadań/cofnięć) | 2 | plan |
| Szczegóły: Aktywność | karty Komentarze, Oglądanie, E-maile | 2 | plan |
| Szczegóły: Historia zmian | karta „Audyt dotyczący osoby” | 2 | plan |
| „Zobacz w Stripe” | link przy wpłacie | 3 | plan |
| Zmiana roli (`UserRoleActions`, ADMIN/USER, wymaga świeżego logowania) | profil: „Rola…” (okno, step-up; rola ADMIN na `www` po fazie 5 to tylko odznaka) | 2 | plan |
| Usunięcie konta (`UserDangerZone`, wpisanie e-maila, świeże logowanie) | profil: strefa zagrożenia „Usuń i zanonimizuj…” z wpisaniem e-maila + step-up | 2 | plan |
| Diagnostyka dostępu (`AdminAccessDiagnostics`) | profil: „Podgląd jako ta osoba” (tylko odczyt, wpis `ADMIN_VIEW_AS`) | 2 | plan |
| `/admin/users/dashboard` (4 kafelki + sumy walut) | DROP (kafle na liście + Przychody) | – | DROP |
| `/admin/users/payments`: lista wpłat, podsumowanie, filtry | **Przychody → Wpłaty** `#/przychody?tab=wplaty` | 3 | plan |
| „Zwrot” (dialog z kwotą, bez powodu) | „Zwrot…”: skutek + powód + step-up + klucz idempotencji | 3 | plan |
| „Synchronizuj spór” | Przychody → Zwroty i spory: „Odśwież ze Stripe” | 3 | plan |

### 1.4 Komentarze (`/admin/comments`, `/admin/comments/reports`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Lista komentarzy, szukaj, filtry, licznik zgłoszeń | **Społeczność → Komentarze** | 2 | plan |
| Wstrzymaj / ukryj / zatwierdź / przywróć | akcje w wierszu i klawisze; „Ukryj” z toastem „Cofnij” | 2 | plan |
| Usuń (bez potwierdzenia, ostateczne) | „Usuń…” z oknem „Skutek” | 2 | plan |
| Akcje zbiorcze (ukryj/usuń do 50, 50 żądań) | zaznaczanie + jedno żądanie zbiorcze, okno dla usuwania | 2 | plan |
| Zgłoszenia: odrzuć / ukryj+rozwiąż / wstrzymaj+rozwiąż | **Moderacja** `#/spolecznosc?tab=moderacja` (j/k, h, z, w; atomowe „rozwiąż z akcją”) | 2 | plan |
| Serduszko twórcy (tylko z `www`) | „Serduszko” i „Odpowiedz jako twórca” w Komentarzach | 2 | plan |

### 1.5 Poczta i powiadomienia (`/admin/emails`, `/admin/notifications`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Szablony: lista, edycja PL/EN, zapis, „Przywróć domyślny”, usuń własny | **Komunikacja → Szablony** `#/komunikacja?tab=szablony` (edytor z podglądem i różnicą względem domyślnego) | 3 | plan |
| Kreator rozsyłki: odbiorcy (audience), treść PL/EN, test do siebie, wyślij | **Komunikacja → Rozsyłki** „Nowa rozsyłka” (kreator 4 kroków, step-up przed wysłaniem) | 3 | plan |
| Historia rozsyłek, postęp, „Anuluj” | Rozsyłki: tabela z postępem i „Anuluj” | 3 | plan |
| Powiadomienia: kafle, rozsyłka (dialog), szablony, lista | **Komunikacja → Powiadomienia**: ekran istnieje, wysyłka wyłączona, bo dzwonek usunięty decyzją 2026-10-04 | 3 | decyzja |

### 1.6 Kanał i ustawienia (`/admin/channel`, `/admin/settings`, `/admin/payments`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Nazwa, opis, banner (URL), domyślna miniatura (URL) | **Ustawienia → Kanał** `#/ustawienia?tab=kanal` (banner i miniatura przez wgranie, podgląd) | 3 | plan |
| Licznik subskrybentów (`displaySubscribersCount`, nigdzie nie wyświetlany) | DROP pola; zostaje „Przelicz subskrybentów” | 3 | DROP |
| „Resync licznika subskrybentów” | „Przelicz subskrybentów” | 3 | plan |
| Konto kanału (właściciel `Creator.userId`) | Ustawienia → Kanał: „Konto kanału” (wybór konta, step-up) | 3 | plan |
| `/admin/settings`: domyślna miniatura (wgraj, usuń) | Ustawienia → Kanał: „Domyślna miniatura” | 3 | plan |
| `/admin/payments`: minimalna kwota napiwku × 5 walut | **Ustawienia → Płatności** `#/ustawienia?tab=platnosci` | 3 | plan |

## 2. Trasy `app/api/admin/**` (każdy handler)

Nowy panel nie wywołuje tras `www`: każda akcja to Route Handler albo Server Action w `apps/admin` wołający **ten sam use case**
z `lib/modules/**` (wrapper `requireAdmin → zod (.strict) → limit → step-up tam, gdzie trzeba → use case → audyt`).

| Trasa (metody) | Use case / rola | Nowy panel | Faza | Status |
|---|---|---|---|---|
| `channel` (GET, PATCH) | ustawienia kanału | Ustawienia → Kanał (odczyt serwerowy, zapis akcją) | 3 | plan |
| `comments` (GET) | lista komentarzy | Społeczność → Komentarze | 2 | plan |
| `comments/[id]/approve` (POST) | moderacja | akcja „Zatwierdź” | 2 | plan |
| `comments/[id]/hold` (POST) | moderacja | „Wstrzymaj” | 2 | plan |
| `comments/[id]/hide` (POST) | moderacja (też z `www`) | „Ukryj” (klawisz `h`) | 2 | plan |
| `comments/[id]/restore` (POST) | moderacja (też z `www`) | „Przywróć” / „Cofnij” | 2 | plan |
| `comments/[id]/delete` (POST) | usunięcie | „Usuń…” | 2 | plan |
| `comments/[id]/heart` (POST) | serduszko (tylko `www`) | „Serduszko” | 2 | plan |
| `comments/reports` (GET) | zgłoszenia | Moderacja | 2 | plan |
| `comments/reports/[id]/resolve` (POST) | rozwiązanie | atomowe „rozwiąż z akcją” | 2 | plan |
| `emails/broadcast` (GET, POST) | historia, utworzenie (kolejka) | Rozsyłki | 3 | plan |
| `emails/broadcast/[id]/cancel` (POST) | anulowanie | „Anuluj” | 3 | plan |
| `emails/broadcast/audience` (GET) | liczba odbiorców | kreator, krok 1 | 3 | plan |
| `emails/broadcast/test` (POST) | test do siebie | kreator, krok 3 | 3 | plan |
| `maintenance/main-channel/preview` (GET) | brak wołającego | DROP (jednorazowa naprawa) | – | DROP |
| `maintenance/main-channel/apply` (POST) | brak wołającego | DROP | – | DROP |
| `notifications` (GET) | lista | Komunikacja → Powiadomienia | 3 | decyzja |
| `notifications/broadcast` (POST) | rozsyłka powiadomienia | wyłączone do decyzji o dzwonku | 3 | decyzja |
| `notifications/templates` (GET, PUT, DELETE) | szablony powiadomień | Komunikacja → Powiadomienia | 3 | decyzja |
| `payment-settings` (GET, PATCH) | minimalne kwoty | Ustawienia → Płatności | 3 | plan |
| `payments` (GET) | lista wpłat | Przychody → Wpłaty | 3 | plan |
| `payments/[id]/refund` (POST) | `adminRefund` | „Zwrot…” ze step-up | 3 | plan |
| `payments/[id]/dispute-sync` (POST) | `adminDisputeSync` | „Odśwież ze Stripe” | 3 | plan |
| `settings/media/default-video-thumbnail` (GET, POST, DELETE) | domyślna miniatura | Ustawienia → Kanał | 3 | plan |
| `settings/media/default-video-thumbnail/proxy` (GET) | podgląd obrazu | podgląd w Ustawieniach (route panelu) | 3 | plan |
| `stats` (GET) | brak wołającego | DROP (Dzisiaj ma własne odczyty) | 1 | DROP |
| `subscribers/resync` (POST) | przeliczenie | „Przelicz subskrybentów” | 3 | plan |
| `templates` (GET, POST, DELETE) | szablony e-mail | Komunikacja → Szablony | 3 | plan |
| `users` (GET) | lista | Społeczność → Użytkownicy | 2 | plan |
| `users/[userId]` (GET) | szczegóły | profil 360° | 2 | plan |
| `users/[userId]` (DELETE) | usunięcie i anonimizacja | strefa zagrożenia profilu (e-mail + step-up) | 2 | plan |
| `users/[userId]/patron` (PATCH) | znacznik wspierającego | „Znacznik wspierającego…” | 2 | plan |
| `users/[userId]/role` (PATCH) | rola | „Rola…” ze step-up | 2 | plan |
| `users/export` (GET) | eksport CSV (audyt) | „Eksport CSV” ze step-up | 2 | plan |
| `users/stats` (GET) | kafle | kafle Użytkowników | 2 | plan |
| `videos` (GET) | lista | Treści | 2 | plan |
| `videos` (POST) | utworzenie i (z `id`) edycja | „Nowy film” i jeden `PATCH` edycji | 2 | plan |
| `videos` (DELETE) | usunięcie + sprzątanie R2 | strefa zagrożenia filmu | 2 | plan |
| `videos/[id]` (GET, PATCH) | szczegóły, edycja, miniatura | edycja filmu | 2 | plan |
| `videos/[id]/actions` (POST) | publish/unpublish/archive/restore/set-hero | przyciski statusu i Hero | 2 | plan |
| `videos/[id]/actions` (PATCH, luźny schemat, ADM-08) | sidebar i pozycja | przełączniki Ekspozycji (ścisły schemat) | 2 | plan |
| `videos/[id]/comments` (GET) | brak wołającego (ADM-06) | Komentarze z filtrem filmu | 2 | plan |
| `videos/[id]/original-upload/multipart` (POST, GET, DELETE) | start, wznowienie, przerwanie | „Nowy film” krok 2, karta kodowania | 2 | plan |
| `…/multipart/parts` (POST) | adresy części | uploader | 2 | plan |
| `…/multipart/complete` (POST) | weryfikacja + kolejka | uploader | 2 | plan |
| `videos/[id]/pipeline` (GET) | stan | karta kodowania (SSE zamiast pollingu, faza A) | 2 | plan |
| `videos/[id]/pipeline/encode` (POST) | przekodowanie | „Przekoduj” | 2 | plan |
| `videos/[id]/pipeline/jobs/[jobId]` (DELETE) | anulowanie | „Anuluj” | 2 | plan |
| `videos/[id]/pipeline/assets/[assetId]` (DELETE) | usunięcie wersji | „Usuń wersję…” | 2 | plan |
| `videos/cover-upload` (POST) | miniatura do R2 | karta Miniatura | 2 | plan |
| `videos/r2-diagnostics` (GET) | brak wołającego | System → diagnostyka R2 | 3 | plan |
| `videos/reorder` (POST) | kolejność sidebaru | Układ kanału | 2 | plan |
| `videos/resync` (POST) | brak wołającego | DROP (zastąpione przez post-flight) | – | DROP |

## 3. Uprawnienia admina używane z publicznej strony

| Miejsce na `www` | Co robi | Docelowo | Faza | Status |
|---|---|---|---|---|
| `CommentItem.tsx`: ukryj, przywróć | `/api/admin/comments/[id]/{hide,restore}` | całość do panelu (decyzja 8 z `admin-panel.md`) | 5 | plan |
| `CommentItem.tsx`: serduszko | `/api/admin/comments/[id]/heart` | „Serduszko” w panelu | 5 | plan |
| `UserMenu.tsx`, `AccountModal.tsx`: link „Zarządzaj kanałem” | `/admin` | link do `admin.pawelperfect.com` | 5 | plan |
| `lib/video-upload/multipart-uploader.ts` | woła trasy admina | używany przez panel (ten sam moduł) | 2 | plan |

## 4. Obsługa strony poza starym panelem (dziś terminal, baza albo nic)

| Czynność | Nowy panel | Faza | Status |
|---|---|---|---|
| Stan serwera, kontenerów, cronów, kopii | System | 1 | zrobione |
| Kto ma rolę ADMIN, 2FA, sesje | Społeczność (filtr „Z 2FA”, rola) + Bezpieczeństwo | 2–3 | plan |
| Wylogowanie osoby ze wszystkich urządzeń | profil: „Wyloguj wszędzie” | 2 | plan |
| Wyciszenie komentowania osoby | profil i moderacja: „Wycisz” | 2 | plan |
| Dziennik audytu z filtrami i eksportem | Bezpieczeństwo → Dziennik | 3 | plan |
| Logowania do panelu, sesje panelu | Bezpieczeństwo → Logowania (dane już w `AdminAuthEvent`) | 3 | plan |
| Premiera na żywo | Premiera na żywo | A | plan |
| Czy serwer wytrzyma szczyt (dziś: arkusz z testu obciążenia) | **Zapas serwera**: System → Serwer i kontenery (pełny), Dzisiaj (skrót); szczyt odsłon/s z telemetrii (1 h, 24 h, 7 dni) wobec granicy z `server-capacity.config.ts` (LOAD-TEST.md), progi 50/80%, rekomendacja, przelicznik na odsłony dziennie | 1 | zrobione (dane po włączeniu `ADMIN_TELEMETRY_DATABASE_URL`) |

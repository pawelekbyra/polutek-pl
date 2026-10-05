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
| Lista filmów z filtrami (status, tier, szukaj) i stronami | **Treści** `/tresci` (filtry: status, dostęp, stan wideo, sortowanie i strona w URL; stan HLS, miniatury i napisów) | 2 | zrobione |
| Statystyki nad listą (`AdminVideoStats`) | licznik filmów i błędów kodowania w nagłówku Treści; kafle obejrzeń w fazie A (telemetria) | 2/A | zrobione (licznik), plan (kafle A) |
| „Utwórz” (inline na liście) | **Nowy film** `/tresci/nowy` (metadane → szkic → edycja otwarta na wgraniu oryginału) | 2 | zrobione |
| Upload oryginału (multipart, wznawianie, weryfikacja) | karta „Oryginał wideo” w edycji (te same use case'y i `multipart-uploader.ts` z `apiBase=/api/videos`; trasy panelu `/api/videos/[id]/original-upload/*`) | 2 | zrobione |
| Postęp kodowania (polling) | karta „Kodowanie i wideo” (etapy, rendycje, log błędu) | 2 | zrobione |
| „Anuluj kodowanie” | przycisk „Anuluj” w karcie kodowania (odwracalne, bez okna) | 2 | zrobione |
| „Zakoduj ponownie” / „Ponów” | „Przekoduj” / „Ponów kodowanie” | 2 | zrobione |
| „Usuń wersję HLS” (2 kliknięcia) | lista wersji w karcie kodowania, okno ze skutkiem | 2 | zrobione |
| „Edytuj” (inline na liście) | **DROP**: jeden formularz edycji na film | – | DROP |
| `/edit`: tytuł, slug, opis, tier, status, kategorie pól | **Edycja** `/tresci/<slug>/edycja` (wszystkie pola, walidacja przy polu, blokada nadpisania nowszej wersji; tylko dwa poziomy dostępu, decyzja 2026-10-04) | 2 | zrobione |
| `/edit`: „Publikacja: Natychmiast / Premiera + data” | karta „Publikacja i premiera” | 2 | zrobione |
| `/edit`: „Cel zbiórki” (procent ręczny, kwota, waluta, data) | karta „Pasek zbiórki” w edycji | 2 | zrobione |
| Miniatura (`CoverImageUpload`, podgląd) | karta „Miniatura” (wgranie do R2, magic bytes, podgląd przez trasę panelu, stan kopii publicznej); kadrowanie w przeglądarce: później | 2 | zrobione |
| Napisy PL/EN (URL VTT w formularzu) | karta „Napisy” (wgranie VTT z walidacją, hosting w publicznym R2 `videos/<id>/subtitles/`, podmiana, usunięcie; decyzja 2026-10-04, #1219) | 2 | zrobione |
| Szczegóły: zakładka Podsumowanie (odtwarzacz) | Przegląd filmu `/tresci/<slug>` + „Zobacz na stronie”; „Podgląd jako widz” (tryb tylko do odczytu na www) w fazie 3 | 2/3 | zrobione (przegląd), plan (podgląd jako widz) |
| Szczegóły: zakładka Treść | edycja | 2 | zrobione |
| Szczegóły: zakładka Media (pipeline) | karta „Kodowanie i wideo” | 2 | zrobione |
| Szczegóły: zakładka Dostęp | pole „Dostęp” + lista kontrolna | 2 | zrobione |
| Szczegóły: zakładka Diagnostyka | lista kontrolna publikacji (pre-flight przed zapisem); test po publikacji (token → master → segment) w fazie A | 2/A | zrobione (pre-flight), plan (post-flight) |
| Szczegóły: zakładka Komentarze (martwa, ADM-06) | Treści → film → **Komentarze** `/tresci/<slug>/komentarze` (te same akcje moderacji co w Społeczności) | 2 | zrobione |
| Szczegóły: zakładka Statystyki | Film → **Analityka** `/tresci/<slug>/analityka` i **Jakość** `/tresci/<slug>/jakosc` (obejrzenia, widzowie, retencja z pasmem typowego filmu, QoE, ostrzeżenie o małej próbie; admin-phaseA.md) | A | zrobione |
| Szczegóły: zakładka Historia | karta „Historia zmian” (audyt) | 2 | zrobione |
| „Publikuj” | przycisk „Opublikuj” (blokady publikacji, pre-flight) | 2 | zrobione |
| „Cofnij publikację” (bez potwierdzenia, ADM-05) | okno „Skutek” (zdejmuje z sidebaru i Hero, kasuje publiczną miniaturę) | 2 | zrobione |
| „Archiwizuj” (bez potwierdzenia) | okno „Skutek” | 2 | zrobione |
| „Przywróć” (z archiwum) | przycisk „Przywróć do szkiców” | 2 | zrobione |
| „Usuń film” (dialog) | strefa zagrożenia: okno ze skutkiem + wpisanie sluga + step-up (passkey/TOTP z 5 min, decyzja 2026-10-04); sprząta R2 i napisy | 2 | zrobione |
| „Duplikuj” (kopia bez okładki, ADM-10) | „Duplikuj” (szkic z tytułem, opisami i dostępem; bez okładki celowo: wspólny obiekt w R2 skasowałby się przy zmianie okładki jednej z kopii) | 2 | zrobione |
| „Podgląd”, „Kopiuj link” | „Zobacz na stronie”, „Kopiuj link”; „Podgląd jako widz” w fazie 3 | 2 | zrobione |
| Hero on/off (szczegóły) | przełącznik „Hero strony głównej” (karta Ekspozycja) | 2 | zrobione |
| Sidebar on/off i pozycja (szczegóły) | przełącznik „Na liście filmów”; pozycja w Układzie kanału | 2 | zrobione |
| `/admin/videos/layout`: kolejność, Hero, oko (zapis nie działa dla Hero, ADM-02) | **Układ kanału** `/tresci/uklad` (strzałki i Alt+↑/↓, jeden zapis, Hero przez use case z regułami Hero) | 2 | zrobione |

### 1.3 Użytkownicy i wpłaty (`/admin/users*`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Lista użytkowników, filtry, szukaj, sortowanie | **Społeczność → Użytkownicy** `/spolecznosc?tab=uzytkownicy` (szukaj, 9 segmentów, 6 sortowań, strona w URL, tabela kart na telefonie) | 2 | zrobione |
| 4 kafelki statystyk (`/users/stats`) | kafle nad listą (konta, nowe 7 dni, ze znacznikiem, niezweryfikowane), każdy to link do segmentu | 2 | zrobione |
| Eksport CSV (`/users/export`) | „Eksport CSV” (POST, step-up, limit 5/h, audyt `USERS_EXPORT`, komórki odporne na wstrzyknięcie formuł, limit 20 000 wierszy) | 2 | zrobione |
| „Wyślij wiadomość” (martwy) | DROP (wysyłka do jednej osoby: PP Support) | – | DROP |
| Nadaj / cofnij znacznik wspierającego (dialog z powodem) | profil 360°: „Znacznik wspierającego…” (okno z obowiązkowym powodem, idempotentne, audyt) | 2 | zrobione |
| Szczegóły: Podsumowanie, suma wpłat | profil 360° `/spolecznosc/u/<id>` | 2 | zrobione |
| Szczegóły: Wpłaty | karta „Napiwki” w profilu | 2 | zrobione |
| Szczegóły: Granty | karta „Znacznik wspierającego: historia” | 2 | zrobione |
| Szczegóły: Aktywność | karty Komentarze, Oglądanie, E-maile, Sesje | 2 | zrobione |
| Szczegóły: Historia zmian | karta „Audyt dotyczący osoby” | 2 | zrobione |
| „Zobacz w Stripe” | link przy wpłacie | 3 | plan |
| Zmiana roli (`UserRoleActions`, ADMIN/USER, wymaga świeżego logowania) | profil: „Rola…” (okno, step-up) | 2 | zrobione |
| Usunięcie konta (`UserDangerZone`, wpisanie e-maila, świeże logowanie) | profil: „Usuń…” z oknem skutków (liczby), wpisaniem e-maila i step-up | 2 | zrobione |
| Diagnostyka dostępu (`AdminAccessDiagnostics`) | profil: „Podgląd jako ta osoba” (tylko odczyt, wyliczenie według zasad strony, wpis `ADMIN_VIEW_AS`) | 2 | zrobione |
| `/admin/users/dashboard` (4 kafelki + sumy walut) | DROP (kafle na liście + Przychody) | – | DROP |
| `/admin/users/payments`: lista wpłat, podsumowanie, filtry | **Przychody → Wpłaty** `#/przychody?tab=wplaty` | 3 | plan |
| „Zwrot” (dialog z kwotą, bez powodu) | „Zwrot…”: skutek + powód + step-up + klucz idempotencji | 3 | plan |
| „Synchronizuj spór” | Przychody → Zwroty i spory: „Odśwież ze Stripe” | 3 | plan |

### 1.4 Komentarze (`/admin/comments`, `/admin/comments/reports`)

| Stary panel | Nowy panel | Faza | Status |
|---|---|---|---|
| Lista komentarzy, szukaj, filtry, licznik zgłoszeń | **Społeczność → Komentarze**: szukaj w treści/autorze, status, film, autor, „pytania bez odpowiedzi”, licznik zgłoszeń | 2 | zrobione |
| Wstrzymaj / ukryj / zatwierdź / przywróć | akcje w wierszu (Ukryj, Przywróć, Zatwierdź) i klawisze w Moderacji; toast „Cofnij” (atomowo: status + zgłoszenia); Wstrzymaj w Moderacji (`p`) | 2 | zrobione |
| Usuń (bez potwierdzenia, ostateczne) | „Usuń…” z oknem „Skutek” i step-up (usunięcie jest ostateczne) | 2 | zrobione |
| Akcje zbiorcze (ukryj/usuń do 50, 50 żądań) | checkboxy (do 50) + pasek akcji: JEDNO żądanie atomowe (wszystko albo nic), „Cofnij” dla ukryj/przywróć, okno i step-up dla usuwania | 2 | zrobione |
| Zgłoszenia: odrzuć / ukryj+rozwiąż / wstrzymaj+rozwiąż | **Moderacja** `/spolecznosc` (domyślna zakładka; j/k, h, z, p, w; decyzja = komentarz + zgłoszenia w jednej transakcji; „Cofnij”; historia rozstrzygniętych) | 2 | zrobione |
| Serduszko twórcy (tylko z `www`) | „Serduszko” (ustawia stan, idempotentnie) i „Odpowiedz jako twórca” (z konta właściciela kanału, odporne na podwójne kliknięcie) | 2 | zrobione |

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
| `comments` (GET) | lista komentarzy | Społeczność → Komentarze | 2 | zrobione |
| `comments/[id]/approve` (POST) | moderacja | akcja „Zatwierdź” | 2 | zrobione |
| `comments/[id]/hold` (POST) | moderacja | „Wstrzymaj” | 2 | zrobione |
| `comments/[id]/hide` (POST) | moderacja (też z `www`) | „Ukryj” (klawisz `h`) | 2 | zrobione |
| `comments/[id]/restore` (POST) | moderacja (też z `www`) | „Przywróć” / „Cofnij” | 2 | zrobione |
| `comments/[id]/delete` (POST) | usunięcie | „Usuń…” | 2 | zrobione |
| `comments/[id]/heart` (POST) | serduszko (tylko `www`) | „Serduszko” | 2 | zrobione |
| `comments/reports` (GET) | zgłoszenia | Moderacja | 2 | zrobione |
| `comments/reports/[id]/resolve` (POST) | rozwiązanie | atomowe „rozwiąż z akcją” | 2 | zrobione |
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
| `users` (GET) | lista | Społeczność → Użytkownicy | 2 | zrobione |
| `users/[userId]` (GET) | szczegóły | profil 360° | 2 | zrobione |
| `users/[userId]` (DELETE) | usunięcie i anonimizacja | strefa zagrożenia profilu (e-mail + step-up) | 2 | zrobione |
| `users/[userId]/patron` (PATCH) | znacznik wspierającego | „Znacznik wspierającego…” | 2 | zrobione |
| `users/[userId]/role` (PATCH) | rola | „Rola…” ze step-up | 2 | zrobione |
| `users/export` (GET) | eksport CSV (audyt) | „Eksport CSV” ze step-up | 2 | zrobione |
| `users/stats` (GET) | kafle | kafle Użytkowników | 2 | zrobione |
| `videos` (GET) | lista | Treści | 2 | zrobione |
| `videos` (POST) | utworzenie i (z `id`) edycja | „Nowy film” i jeden `PATCH` edycji | 2 | zrobione |
| `videos` (DELETE) | usunięcie + sprzątanie R2 | strefa zagrożenia filmu | 2 | zrobione |
| `videos/[id]` (GET, PATCH) | szczegóły, edycja, miniatura | edycja filmu | 2 | zrobione |
| `videos/[id]/actions` (POST) | publish/unpublish/archive/restore/set-hero | przyciski statusu i Hero | 2 | zrobione |
| `videos/[id]/actions` (PATCH, luźny schemat, ADM-08) | sidebar i pozycja | przełączniki Ekspozycji (ścisły schemat) | 2 | zrobione |
| `videos/[id]/comments` (GET) | brak wołającego (ADM-06) | Komentarze z filtrem filmu | 2 | zrobione |
| `videos/[id]/original-upload/multipart` (POST, GET, DELETE) | start, wznowienie, przerwanie | „Nowy film” krok 2, karta kodowania | 2 | zrobione |
| `…/multipart/parts` (POST) | adresy części | uploader | 2 | zrobione |
| `…/multipart/complete` (POST) | weryfikacja + kolejka | uploader | 2 | zrobione |
| `videos/[id]/pipeline` (GET) | stan | karta kodowania (polling co 3 s tylko gdy coś trwa; SSE w fazie A) | 2 | zrobione |
| `videos/[id]/pipeline/encode` (POST) | przekodowanie | „Przekoduj” | 2 | zrobione |
| `videos/[id]/pipeline/jobs/[jobId]` (DELETE) | anulowanie | „Anuluj” | 2 | zrobione |
| `videos/[id]/pipeline/assets/[assetId]` (DELETE) | usunięcie wersji | „Usuń wersję…” | 2 | zrobione |
| `videos/cover-upload` (POST) | miniatura do R2 | karta Miniatura | 2 | zrobione |
| `videos/r2-diagnostics` (GET) | brak wołającego | System → diagnostyka R2 | 3 | plan |
| `videos/reorder` (POST) | kolejność sidebaru | Układ kanału | 2 | zrobione |
| `videos/resync` (POST) | brak wołającego | DROP (zastąpione przez post-flight) | – | DROP |

## 3. Uprawnienia admina używane z publicznej strony

| Miejsce na `www` | Co robi | Docelowo | Faza | Status |
|---|---|---|---|---|
| `CommentItem.tsx`: ukryj, przywróć | `/api/admin/comments/[id]/{hide,restore}` | całość do panelu (decyzja 8 z `admin-panel.md`) | 5 | plan |
| `CommentItem.tsx`: serduszko | `/api/admin/comments/[id]/heart` | „Serduszko” w panelu | 5 | plan |
| `UserMenu.tsx`, `AccountModal.tsx`: link „Zarządzaj kanałem” | `/admin` | link do `admin.pawelperfect.com` | 5 | plan |
| `lib/video-upload/multipart-uploader.ts` | woła trasy admina | używany przez panel (ten sam moduł) | 2 | zrobione |

## 4. Obsługa strony poza starym panelem (dziś terminal, baza albo nic)

| Czynność | Nowy panel | Faza | Status |
|---|---|---|---|
| Stan serwera, kontenerów, cronów, kopii | System | 1 | zrobione |
| Kto ma rolę ADMIN, 2FA, sesje | Społeczność (filtr „Z 2FA”, rola) + Bezpieczeństwo | 2–3 | zrobione (Społeczność), plan (Bezpieczeństwo) |
| Wylogowanie osoby ze wszystkich urządzeń | profil: „Wyloguj wszędzie” | 2 | zrobione |
| Wyciszenie komentowania osoby | profil i Moderacja: „Wycisz…” (1/7/30/365 dni, powód, audyt; `createVideoComment` odmawia do końca wyciszenia) i „Zdejmij wyciszenie” | 2 | zrobione |
| Dziennik audytu z filtrami i eksportem | Bezpieczeństwo → Dziennik | 3 | plan |
| Logowania do panelu, sesje panelu | Bezpieczeństwo → Logowania (dane już w `AdminAuthEvent`) | 3 | plan |
| Premiera na żywo | **Premiera na żywo** `/premiera` (SSE `/api/live`, keep-alive 25 s, „Wstrzymaj”, widzowie, QoE, serwer, napiwki; admin-phaseA.md §4). Przeżycie 10 min przez prawdziwy tunel do sprawdzenia przy wdrożeniu | A | zrobione (w kodzie; test przez tunel przy wdrożeniu) |
| Tłumaczenia filmów (dziś tylko pola EN w edycji) | **Treści → film → Tłumaczenia** `/tresci/<slug>/tlumaczenia`: języki z flagami, stan (szkic automatyczny / zatwierdzone / napisane przez człowieka), tytuł, adres, opis, napisy, „Zatwierdź”, „Zatwierdź wszystkie”; model `VideoTranslation` + `VideoSlugHistory` (admin-phase2-content.md §6) | 2 | zrobione |
| Generowanie szkiców tłumaczeń (AI) | przycisk „Generuj szkice AI” (dziś wyłączony, „wkrótce”) | 3 | decyzja (model: Claude API czy Workers AI) |
| Rola „tłumacz” (tylko wybrane języki, bez reszty panelu) | konta panelu z rolą `TRANSLATOR` i grantami języków (projekt w admin-phase2-content.md §6) | 3 | plan |
| Adresy filmów per język, etykieta i `noindex` szkiców automatycznych na stronie | strona www (`translationPublicMeta`, `resolveFilmText`, 301 z `VideoSlugHistory`) | po decyzji | decyzja (wstrzymane przez właściciela) |
| Czy serwer wytrzyma szczyt (dziś: arkusz z testu obciążenia) | **Zapas serwera**: System → Serwer i kontenery (pełny), Dzisiaj (skrót); szczyt odsłon/s z telemetrii (1 h, 24 h, 7 dni) wobec granicy z `server-capacity.config.ts` (LOAD-TEST.md), progi 50/80%, rekomendacja, przelicznik na odsłony dziennie | 1 | zrobione (dane po włączeniu `ADMIN_TELEMETRY_DATABASE_URL`) |

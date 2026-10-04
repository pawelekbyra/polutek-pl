# Faza 2 panelu: Treści (plan ekranów i kodu)

## 0. Stan po implementacji (2026-10-04, PR „faza 2: Treści”)

Zbudowane i odhaczone w [`admin-parity.md`](admin-parity.md) (sekcja 1.2 i trasy `videos*`). Odpowiedzi właściciela
na 3 pytania z sekcji 4: wszystkie „tak” (step-up przy usunięciu filmu + wpisanie sluga; hosting VTT w R2 już teraz;
w edycji tylko dwa poziomy dostępu). Gdzie kod różni się od planu niżej, obowiązuje ta sekcja:

| Element | Gdzie | Uwagi |
|---|---|---|
| Lista | `apps/admin/app/(panel)/tresci/page.tsx` | filtry w URL (`q`, `status`, `tier`, `hls`, `sort`, `page`) jako zwykły formularz GET; stan miniatury z `thumbnailState()` (jedno zapytanie na stronę). „Wymaga uwagi” i „Premiery” jako filtry: później (repozytorium filtruje tylko po polach). |
| Nowy film | `tresci/nowy` + `components/content/new-film-form.tsx` | tworzy szkic i przekierowuje do edycji na kartę „Oryginał wideo”. |
| Przegląd filmu | `tresci/[slug]/page.tsx` | kodowanie na żywo (`encode-panel.tsx`, polling `/api/videos/[id]/pipeline` co 3 s tylko gdy coś trwa), lista kontrolna z `getAdminVideoDiagnostics`, napisy, ekspozycja, zbiórka, historia z audytu, przyciski statusu w oknach „Skutek”, „Zobacz na stronie”, „Kopiuj link”, „Duplikuj”. |
| Edycja | `tresci/[slug]/edycja/page.tsx` | jeden formularz tekstowy (`film-form.tsx`, Server Action `saveFilmAction`, wysyłany ręcznie, więc odrzucony zapis nie czyści pól); pliki zapisują się od razu po wgraniu (`original-upload.tsx`, `media-cards.tsx`); strefa zagrożenia (`danger-zone.tsx`). |
| Układ kanału | `tresci/uklad` (nie `?widok=uklad`) + `layout-editor.tsx` | strzałki i Alt+↑/↓, jeden zapis `saveChannelLayout`. |
| Zapisy | `apps/admin/app/(panel)/tresci/actions.ts` | wspólne klocki zamiast `adminAction()`: `lib/actions/panel.ts` (`panelContext`, `errorMessage`, czas warszawski, `zodFieldErrors`, `sampleDataRefusal`). Aktor use case'ów: `{ type: "admin", userId: AdminUser.id }`, `requestId` = `cf-ray`; `AuditLog.actorUserId` nie ma klucza obcego, więc id konta panelu jest bezpieczne. |
| Trasy plików | `apps/admin/app/api/videos/[id]/{original-upload/multipart{,/parts,/complete},cover,subtitles/[lang],thumbnail,pipeline}` | `lib/api/panel-route.ts`: sesja panelu, JSON `{ error, code }`, limity rozmiaru przed czytaniem ciała. |
| Moduł | `lib/modules/admin-content` | `detectImage`, `validateVtt`, `slugify`, `thumbnailState`, `uploadVideoCover`, `uploadVideoSubtitle`, `removeVideoSubtitle`, `listContent`, `getContentDetail`, `getThumbnailSource`, `deleteVideoWithStorage`, `getChannelLayout`, `saveChannelLayout`. |
| Publikacja | `saveFilmAction` | pre-flight przed zapisem: blokada strukturalna odrzuca cały zapis; jeśli brakuje tylko gotowego HLS, zapis idzie jako szkic + `requestPublishAfterAssetReady` (encoder opublikuje). Premiera na szkicu publikuje film (zostaje „nadchodzący”). Ponowne wysłanie zapisanej premiery nie jest zmianą. |
| Optymistyczna blokada | `saveFilmAction` | `expectedUpdatedAt` z formularza; inny `updatedAt` → komunikat „odśwież”, nic nie zapisane. |
| Usunięcie | `deleteFilmAction` | wpisany slug (sprawdzany na serwerze) + `hasFreshStepUp()`; bez step-upu → `/potwierdz?next=…`. |
| Napisy | `uploadVideoSubtitle` | publiczny bucket miniatur, klucz `videos/<id>/subtitles/<hash>.vtt`; nocny `reconcilePublicThumbnails` pomija ten prefiks; stary plik kasowany po podmianie, przy usunięciu napisów i filmu. Odtwarzacz CC na www (osobny PR) czyta `subtitleUrlPl/En` jak dotąd; host `thumbs.pawelperfect.pl` musi być w `connect-src` CSP www. |
| CSP panelu | `lib/security/csp.ts` | jedyny zewnętrzny origin: `connect-src https://*.r2.cloudflarestorage.com` (PUT części oryginału). CORS bucketa oryginałów: `scripts/hls/originals-cors.json` z `https://admin.pawelperfect.com` (ustawić raz, ADMIN-PANEL.md rozdz. 1). |
| Dane przykładowe | `lib/content-fixtures.ts` | `ADMIN_DEV_FIXTURES=1` pokazuje 7 filmów bez bazy; każdy zapis odpowiada „Dane przykładowe: zapis jest wyłączony”. |
| Linki | wyszukiwarka, „Dzisiaj”, „System” | filmy otwierają się w nowym panelu (`/tresci/<slug>`), osoby i płatności nadal w starym. |

Świadomie później: kadrowanie miniatury w przeglądarce, „Podgląd jako widz” (faza 3, wymaga trybu na www),
test po publikacji (faza A), filtry „Wymaga uwagi”/„Premiery”, duplikat z okładką (wspólny obiekt w R2).

---

Stan: 2026-10-04, plan przed kodem. Zakres: wiersze sekcji 1.2 i trasy `videos*`, `videos/cover-upload`,
`videos/reorder`, `videos/[id]/{actions,pipeline*,original-upload*}` z [`admin-parity.md`](admin-parity.md).
Wygląd: prototyp `docs/design/admin-panel/` (`#/tresci`, `#/tresci/nowy`, `#/tresci/<slug>`, `#/tresci/<slug>/edycja`,
`#/tresci?widok=uklad`). Społeczność (sekcje 1.3–1.4) to drugi PR tej fazy, na tych samych wzorcach.

## 1. Wspólne klocki (pierwszy commit fazy 2)

| Klocek | Gdzie | Co robi |
|---|---|---|
| `adminAction()` | `apps/admin/lib/actions/run.ts` | jedyna droga zapisu: `requireAdmin` → zod `.strict()` → limit (pamięć procesu, per admin) → opcjonalnie `requireStepUp` → use case z `lib/modules/*` → `revalidatePath` → wynik `{ ok } | { ok:false, fieldErrors, message }` po polsku. Server Actions (CSRF: Next sprawdza `Origin`, plus nasz proxy). |
| Audyt z kontekstem | `lib/modules/audit` (rozszerzenie) | aktor panelu (`AdminUser.id`, `actorType: "panel_admin"`), IP/UA/`cf-ray` z nagłówków; każdy use case dostaje kontekst bez zmian w sygnaturach (AppContext z `requestId`). |
| Formularz | `apps/admin/components/form/*` | `.field` z prototypu: etykieta, podpowiedź, błąd przy polu (`aria-invalid`, `aria-describedby`), fokus na pierwszym błędzie; `useActionState`; przycisk z `aria-busy`. |
| Tabela + filtry w URL | `apps/admin/components/table/*` | serwerowa tabela z sortowaniem (`aria-sort`), filtrami i stroną w `searchParams`, pager „1–12 z 74”, karty na telefonie, „Wyczyść filtry”. |
| Okna | `confirm-dialog.tsx`, `typed-confirm.tsx` | `<dialog>` z ramką „Skutek”; nieodwracalne: wpisanie sluga/e-maila + `--crit-solid`; odwracalne bez okna, toast „Cofnij”. |
| Konflikt edycji | use case | `expectedUpdatedAt` w zapisie; inny `updatedAt` → 409 → komunikat „Ktoś zmienił film; odśwież” (bez nadpisania). |

## 2. Ekrany

### 2.1 Lista `/tresci`
- Server Component, `getAdminVideoList` (filtry: szukaj tytuł/slug, status z „Premiery” i „Wymaga uwagi”, dostęp; sort: tytuł, publikacja, obejrzenia 7 d; strona 20).
- Kolumny: miniatura (proxy panelu `/api/thumbnail/[id]`, `next/image unoptimized`, `img-src 'self'`), tytuł + slug, status (Szkic / Opublikowany / Premiera data / Archiwum), HLS (Gotowe / Kodowanie x% / Błąd / brak oryginału), miniatura OK/domyślna/niezsynchr., napisy PL/EN, dostęp, publikacja, obejrzenia 7 d.
- Baner „Kodowanie w toku” z kolejki; przyciski „Premiery”, „Układ kanału”, „Nowy film”.
- „Wymaga uwagi” = brak HLS, błąd kodowania, miniatura domyślna/niezsynchronizowana, opublikowany bez napisów PL.

### 2.2 Nowy film `/tresci/nowy`
1. Metadane (tytuł, slug z podpowiedzią z tytułu, opisy PL/EN, dostęp) → `createAdminVideo` (zawsze szkic) → przekierowanie do `/tresci/<slug>/edycja#oryginal` (naprawia ADM-11: drugi szkic przy uploadzie).
2. Oryginał: istniejący `lib/video-upload/multipart-uploader.ts` przez trasy panelu `apps/admin/app/api/videos/[id]/original-upload/{multipart,parts,complete}` (cienkie adaptery na `startOriginalUpload`, `presignOriginalParts`, `listOriginalParts`, `completeOriginalMultipart`, `abortOriginalUpload`); wznawianie z `localStorage` jak dziś. CSP: `connect-src` + host R2 (presigned PUT), jedyny wyjątek od `'self'`, opisany.
3. Kodowanie: stan z `getPipelineState`; w fazie 2 odświeżanie co 3 s tylko na tym ekranie (SSE w fazie A), przycisk „Wstrzymaj odświeżanie”.

### 2.3 Szczegóły `/tresci/[slug]`
- Przegląd: kafle (obejrzenia, czas, napiwki: z fazy A gdy będą), etapy kodowania, rendycje, log błędu (`failureReason`), „Przekoduj” (`enqueueEncode`), „Anuluj” (`cancelEncode`), wersje HLS z „Usuń wersję…” (`deleteSelfHlsAsset`, okno).
- Lista kontrolna publikacji (pre-flight) z `getAdminVideoDiagnostics` + `VideoPolicy.getPublicationBlockers`; „Uruchom test teraz” (post-flight: token → `master.m3u8` → 1. segment rendycji → miniatura) jako akcja serwerowa z wynikiem w karcie.
- Historia zmian z `AuditLog` (target Video).
- „Podgląd jako widz”: link do strony z parametrem podglądu admina (bez wydawania sesji), wpis `ADMIN_VIEW_AS`.

### 2.4 Edycja `/tresci/[slug]/edycja` (jeden formularz, jeden zapis)
| Karta | Pola | Use case / reguła |
|---|---|---|
| Podstawowe | tytuł, slug, opis PL/EN, dostęp (2 poziomy: publiczny, po zalogowaniu; `PATRON` znika decyzją 2026-10-04) | `updateAdminVideo` przez `buildAdminVideoUpdatePayload`, schemat `adminVideoWriteSchema` → wersja `.strict()` |
| Publikacja i premiera | szkic / od razu po kodowaniu / premiera z datą (`datetime-local`, Warszawa → ISO UTC) | `isAllowedPremiereChange`; szkic + premiera → `publishAdminVideo` **w tej samej akcji, atomowo** (ADM-33: najpierw blokady, potem zapis) |
| Pasek zbiórki | brak / procent ręczny / cel (kwota, waluta, „licz od”) | `fundraisingGoalUpdateFields`, `adminVideoFundraisingManualPercentSchema` |
| Miniatura | wgranie (magic bytes, nie tylko MIME), kadr 16:9, 3 podglądy, „Klatka z filmu” (później) | przeniesienie `cover-upload` z trasy do `lib/modules/media` (KEEP z sekcji 2 `admin-panel.md`); `syncPublicThumbnail`; stara okładka usuwana po zapisie, nie przed |
| Napisy | wgranie VTT PL/EN z walidacją, podmiana, usunięcie | dziś tylko URL (`subtitleUrlPl/En`); w fazie 2 wgranie do R2 + walidacja nagłówka `WEBVTT` i czasu; zarządzany hosting z #1219 |
| Ekspozycja | na liście (sidebar), Hero | `updateAdminVideo` (`isMainFeatured` z `getHeroBlockers`), sidebar tylko dla opublikowanych |
| Strefa zagrożenia | Archiwizuj (okno), Przywróć, Usuń (wpisanie sluga + step-up) | `archiveAdminVideo`; usunięcie: nowy use case `deleteAdminVideoWithStorage` w module (dziś orkiestracja `snapshotVideoStorage` → `deleteAdminVideo` → `purgeVideoStorage` siedzi w trasie) |

### 2.5 Układ kanału `/tresci?widok=uklad`
- Lista filmów z sidebaru w kolejności serwisu, wszystkie (bez ucięcia do 20), przesuwanie strzałkami i `Alt+↑/↓`, „Schowaj”, wybór Hero; jeden zapis: `reorderAdminVideos` + Hero przez `updateAdminVideo` w jednej transakcji (ADM-02).

## 3. Przekierowania i wygaszanie
Po wdrożeniu: `/admin/videos*` na `www` → 308 na `admin.pawelperfect.com/tresci*`; wiersze 1.2 w `admin-parity.md` → „zrobione”.

## 4. Testy
- Jednostkowe: schematy `.strict()`, `adminAction` (401 bez sesji, step-up, mapowanie błędów use case'ów na polskie komunikaty), premiera atomowa, konflikt `updatedAt`, usunięcie z `snapshot`/`purge`.
- RTL: formularz (błąd przy polu, fokus), okno z wpisaniem sluga, tabela (sort, `aria-sort`, filtry w URL).
- Postgres (CI): utworzenie → edycja → publikacja premiery → archiwizacja → usunięcie na prawdziwym schemacie.
- Playwright (wirtualny WebAuthn, jeśli CI dostanie przeglądarkę): nowy film z małym plikiem testowym do atrapy R2.

## 5. Pytania do właściciela
1. Usunięcie filmu: wymagać step-up (passkey) oprócz wpisania sluga? *Rekomendacja:* tak.
2. Napisy: przenosić hosting VTT do R2 już w fazie 2 (zakres #1219), czy na razie tylko URL? *Rekomendacja:* R2 w fazie 2.
3. Poziom dostępu `PATRON`: w edycji tylko dwa poziomy (decyzja 2026-10-04); migracja czyszcząca enuma osobno.

## 6. Tłumaczenia filmów (zatwierdzone przez właściciela 2026-10-04, PR „Tłumaczenia: model i ekran”)

Koncepcja i model docelowy grupowego przeglądu: [`translations-concept.md`](translations-concept.md). W fazie 2 powstaje model
danych, odczyt z kompatybilnością i ekran; **bez generowania AI** (następny krok) i **bez zmiany publicznych adresów**
(krótkie adresy wstrzymane przez właściciela).

**Dane** (migracja `20261005100000_add_video_translations`, addytywna, idempotentna, bez BOM):

| Tabela | Pola | Zasady |
|---|---|---|
| `VideoTranslation` | `videoId`, `language` (`en`, `de`, `es`, `fr`, `it`, `pt`, `zh`), `title`, `slug`, `description`, `subtitleUrl`, `status` (`AI_DRAFT` / `APPROVED` / `EDITED`), `reviewedAt`, `reviewedById` (id konta panelu, bez klucza obcego) | unikalne `(videoId, language)` i `(language, slug)`; kasowane razem z filmem |
| `VideoSlugHistory` | `language`, `slug`, `videoId` | każdy poprzedni adres tłumaczenia; unikalne `(language, slug)`, więc stary adres nie przejdzie na inny film (pod przyszłe 301) |

**Kompatybilność (nic na stronie się nie zmienia):** polski to wiersz `Video` (oryginał). Strona i odtwarzacz dalej czytają
`Video.titleEn/descriptionEn` i `subtitleUrlPl/En`. Migracja kopiuje istniejące tytuły i opisy EN do `VideoTranslation(en)` jako
`EDITED` (adres = adres filmu, więc bez kolizji). Zapis EN w panelu aktualizuje oba miejsca; napisy EN trafiają do
`Video.subtitleUrlEn` i są lustrzane w wierszu `en`; napisy innych języków tylko w ich wierszu (wymaga zapisanego tytułu).
Odczyt dla strony: `resolveFilmText()` (wiersz tłumaczenia, potem stare kolumny EN, potem oryginał z flagą `fallback`).
Mapowanie po przejściu: gdy wszystkie odczyty pójdą przez `resolveFilmText()`, kolumny EN na `Video` można wygasić osobną migracją.

**Adres z tytułu** (`uniqueSlug()`, czysta funkcja z testami): transliteracja (akcenty, `ł`, `ß`, niemieckie `ä → ae`,
`&` w danym języku), myślniki, do 80 znaków, przy zajętym adresie `-2`, `-3` (sufiks mieści się w limicie), tytuł bez liter
łacińskich (chiński) bierze adres oryginału. Zajęte = inny film ma ten adres w tym języku, także w historii.

**Ekran** `/tresci/[slug]/tlumaczenia` (zakładka obok „Przegląd” i „Edycja”): wiersz oryginału (źródło) i wiersz na język z flagą
(`apps/admin/public/flags`, te same co przełącznik na www), stanem, tytułem, adresem i napisami; „Dodaj/Edytuj” (okno: tytuł,
adres, opis; zapis = `EDITED`, zmiana adresu idzie do historii), „Wgraj VTT”/„Podmień”/„Usuń”, „Zatwierdź” (szkic → `APPROVED`),
„Zatwierdź wszystkie szkice”, „Generuj szkice AI” widoczne, wyłączone z opisem „wkrótce”. Audyt: `VIDEO_TRANSLATION_SAVED`,
`VIDEO_TRANSLATION_APPROVED`, napisy jak dotąd.

**Publicznie (projekt, wdrożenie razem z adresami per język):** `translationPublicMeta()`: `AI_DRAFT` ma etykietę
„tłumaczenie automatyczne”, `noindex` i jest poza mapą strony; `APPROVED` i `EDITED` to zwykłe strony.

**Rola „tłumacz” (projekt, budowa w fazie 3):** osobne uprawnienie w modelu kont panelu, nie rola strony. Propozycja:
`AdminUser.role` = `OWNER` | `TRANSLATOR`, plus tabela `AdminLanguageGrant(adminUserId, language, level: TRANSLATOR | REVIEWER | LEAD)`.
Tłumacz widzi tylko ekran „Do przetłumaczenia” i zakładkę Tłumaczenia filmów, tylko swoje języki; zapis sprawdza grant w use case
(`saveFilmTranslation` dostaje `allowedLanguages` z kontekstu), nie zatwierdza własnych zmian (próg zgód z koncepcji, etap B/C).
Nawigacja panelu filtruje moduły po roli; `requireAdmin()` przyjmie wymaganą rolę. Konta tłumaczy też przez `admin-enroll`
(passkey), z dostępem Cloudflare Access na ich e-mail.

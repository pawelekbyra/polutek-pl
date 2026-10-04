# Faza 2 panelu: Treści (plan ekranów i kodu)

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

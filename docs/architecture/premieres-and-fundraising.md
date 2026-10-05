# Premiery i pasek zbiórki

Stan 2026-10-05. Kod: `lib/modules/video/domain/premiere.ts` (re-export `lib/premiere.ts`), `lib/modules/video/domain/fundraising.ts`, `lib/modules/video/infrastructure/fundraising-progress.service.ts`,
`app/components/coming-soon/`. Edycja odbywa się w panelu administratora (`/tresci/<slug>/edycja`).

## Premiery (zaplanowane wydanie)

- **Model:** `Video.premiereAt DateTime?` (indeksowane). Film jest *nadchodzący* wtedy i tylko wtedy, gdy `status = PUBLISHED` i `premiereAt > now`. Nie ma dodatkowego statusu i **nie ma crona**:
  każda ścieżka odczytu sprawdza to w chwili żądania jednym helperem `isUpcomingPremiere()`. Nigdy nie porównuj `premiereAt` z zegarem ręcznie. W `premiereAt` film staje się zwykłym filmem w swojej sekcji, co do sekundy.
- **`publishedAt` NIE jest przesuwane na premierę.** Każde publiczne zapytanie (`publishedAt <= now`, `checkVideoAccess()`) traktuje przyszłe `publishedAt` jako ukryte, co ukryłoby nadchodzący film i zepsuło jego komentarze.
  Publiczne DTO i kolejność w sidebarze używają `effectivePublishedAt()` (późniejsze z `publishedAt` i `premiereAt`). DTO administratora zachowują zapisane `publishedAt`. Anulowanie premiery („Natychmiast”) ustawia `publishedAt = now`.
- **Bramka serwerowa (bezpieczeństwo):** `PlaybackService.createPlaybackPlanWithContext()` sprawdza premierę przed jakimkolwiek źródłem, tokenem, identyfikatorem dostawcy czy sesją: gość dostaje `LOGIN_REQUIRED`,
  zalogowany plan `COMING_SOON` z `premiereAt` (ISO); bez sesji, bez liczenia wyświetleń. Dotyczy obu poziomów dostępu i nie dotyka `checkVideoAccess()`. Administratorzy przechodzą (ich sesje mają `isAdminPreview`), jak przy podglądzie szkiców.
- **Dane publiczne:** `premiereAt` (ISO lub null) jest w `PublicVideoDTO`, `toPublicVideoDto` i pozycjach sidebara. Układ sidebara ma sekcję `UPCOMING` („Już wkrótce”) z każdym nadchodzącym filmem `showInSidebar`, najbliższym pierwszym;
  nadchodzące nigdy nie trafiają do sekcji FREE/LOGGED_IN. Nie ma sekcji PATRON.
- **Klient:** `PremiumWrapper` decyduje z `premiereAt` przed pobraniem planu: zalogowany → `AccessLockOverlay state="COMING_SOON"` (kokpit), gość → blokada logowania; renderuje też defensywnie plan `COMING_SOON` i ponawia, gdy zegar serwera się rozjeżdża.
  `SidebarPlaylist`: gość → ściana logowania, zalogowany → kompaktowy kafel PREMIERA z datą. `usePremiereClock()` przestawia stan w dokładnej chwili premiery na otwartej stronie (odtwarzacz prosi o plan, sidebar odświeża układ, bez przeładowania).
- **Panel:** karta „Publikacja” („Natychmiast” / „Premiera” + `datetime-local` w czasie lokalnym administratora, wysyłane jako ISO UTC). Nowa lub przesunięta premiera musi być w przyszłości (`isAllowedPremiereChange()`, `VIDEO_INVALID_PREMIERE`);
  ponowne wysłanie zapisanej wartości jest dozwolone. „Premiera” na szkicu wysyła `status: PUBLISHED` i `updateAdminVideo` publikuje przez `publishAdminVideo()` (blokady publikacji nadal działają).
  Walidacja: `adminVideoPremiereAtSchema` / `adminVideoWriteSchema`, wpis w metadanych audytu.

### Kokpit premiery (nakładka COMING_SOON)

`app/components/coming-soon/CockpitComingSoon.tsx`: canvas z gwiazdami (widok pilota) pod minimalnym HUD: data premiery, „PREMIERA”, odliczanie T−, dziennik lotu. Tło `HudBackdrop.tsx`. Całość jest zsynchronizowana z pętlą dźwiękową
`public/sounds/cockpit-loop.m4a` (+ `.mp3`): `coming-soon/cockpit-timeline.ts` jest wygenerowany z analizy dźwięku (sygnały, pik celu w 14,15 s, głośność kabiny w krokach 50 ms); przy zmianie nagrania trzeba go wygenerować od nowa,
nie stroić ręcznie. `useCockpitClock.ts` jest jedynym zegarem (przy dźwięku czyta zegar `AudioContext` minus `outputLatency`, inaczej `performance.now()`), więc obraz i dźwięk się nie rozjeżdżają.
Dźwięk startuje po kliknięciu bramki wejściowej lub pierwszym geście, zatrzymuje się poza ekranem i w ukrytej karcie, ma przełącznik wyciszenia w HUD (zapamiętany w `localStorage`, wymóg WCAG 1.4.2);
`prefers-reduced-motion` zamraża scenę na klatce z zablokowanym celem, bez dźwięku. Data i cyfry: DSEG7 (tylko zapalone segmenty), napis „PREMIERA” to dostarczony przez właściciela SVG (`PremieraLettering.tsx`, `premiera-lettering.ts`),
etykiety: Oxanium (obsługuje polskie litery). Obie czcionki (SIL OFL) są lokalnie w `app/fonts/` przez `@font-face` w `CockpitComingSoon.module.css`, nie przez `next/font`. Poświata ma być wąska; kolory: cyjan z pomarańczowym akcentem.
To jedyny świadomy wyjątek od zasady „publiczna typografia to Geist”. Miniatura kompaktowa to statyczny kawałek kosmosu z napisem i datą; obie wersje pokazują `premiereAt` filmu sformatowane `formatPremiereDate()` (Europe/Warsaw).
Canvas pauzuje poza ekranem i w ukrytej karcie. Wyjątek limitu linii: `HudBackdrop.tsx` (`maxLines: 620` w `scripts/check-hotspots.ts`).

## Pasek zbiórki (bez kwot)

Pasek pod tytułem filmu premierowego, w stylu crowdfundingu, **bez kwot** (bez waluty, bez widocznego procentu).

- **Model:** `Video.fundraisingGoalMinor Int?`, `fundraisingGoalCurrency String?`, `fundraisingStartAt DateTime?`, `fundraisingManualPercent Int?` (0-100). Brak celu i brak ręcznego procentu = brak paska.
- **Ręczny procent (decyzja właściciela, obowiązuje):** gdy `fundraisingManualPercent` jest ustawione, `fundraisingProgress` = procent/100 i zapytanie o płatności jest pomijane (`manualFundraisingProgress()`). Pasek jest ustawiany ręcznie; film premierowy ma 65.
  Ponieważ wypełnienie nie wynika z wpłat, widz tego nie odróżni: to znane ryzyko wprowadzenia w błąd (audyt płatności PAY-15).
- **Tryb liczony** (gdy brak procentu ręcznego): wpłat **nie da się przypisać do filmu** (`create-intent` nie niesie id filmu), więc pasek liczy **wszystkie udane napiwki kanału** (`SUCCEEDED` + `PARTIALLY_REFUNDED`, netto o `refundedAmountMinor`)
  od `fundraisingStartAt` (null = wszystkie). Inne waluty przelicza do waluty celu przybliżonymi kursami (`fundraisingRatesToPln()`). Przy ewentualnym przypisaniu wpłat do filmu zmienia się tylko `queryTipTotals()`.
- **Dane publiczne:** wyłącznie `PublicVideoDTO.fundraisingProgress` (0..1, zaokrąglone w dół do pełnych procentów, min 0,01 gdy cokolwiek zebrano, 1 tylko przy osiągnięciu; null = brak celu), doklejane przez `withFundraisingProgress()`.
  Cel i sumy nigdy nie opuszczają serwera. Sumy to jedno `payment.groupBy` z 60-sekundowym cache; błąd ukrywa pasek zamiast psuć stronę.
- **UI:** `app/components/FundraisingProgressBar.tsx` tuż pod `<h1>` w `Hero` (bursztynowe wypełnienie `--chan-amber*`, `role="progressbar"`, `aria-valuenow` 0-100, jednorazowa animacja chyba że reduced motion).
- **Panel:** karta „Cel zbiórki” (pierwsze pole „Wypełnienie paska (%) — ręcznie”, cel/waluta/„Liczone od” jako sekcja dodatkowa). Wysyłane jako `fundraisingManualPercent` i `fundraisingGoal: { amountMinor, currency, startAt } | null`;
  walidacja `adminVideoFundraisingManualPercentSchema` i `adminVideoFundraisingGoalSchema`, mapowanie `fundraisingGoalUpdateFields()`, wpis w audycie. Surowe klucze `fundraisingGoal*` w ciele żądania są ignorowane
  (audyt zgłaszał, że nie na każdej trasie: sprawdź przy zmianach).

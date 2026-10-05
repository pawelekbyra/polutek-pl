# Audyt frontendu pawelperfect.com (wydajność, dostępność, jakość kodu UI)

> Stan po naprawach: patrz `RESULT-www-fixes.md` (znaleziska naprawione lub nieaktualne zostały usunięte z tego pliku).

Data: 2026-10-03. Stan: `main` @ `88c787d0` (worktree `dns-migration-cloudflare-bcfaf0`). Audyt tylko do odczytu.
Metody: czytanie kodu, lokalny `next build` (Next 16.3.8, Turbopack, bez `.env` z DB; build przeszedł, 7,2 min kompilacji), żądania GET do produkcji (`curl`, bez logowania), pomiar rozmiarów chunków z produkcji, skrypty Node w scratchpadzie (sieroty, nieużywane eksporty, tokeny CSS, kontrast).
Pominięte zgodnie z poleceniem: kod dostawców Mux/Stream/YouTube/Vimeo (PR #1614), szczegółowa spójność stylów i szczegóły preloadera/szybkości ładowania (osobni agenci). `CLAUDE.md` traktowany jako historia; tam, gdzie kłamie, zaznaczam to.

---

## 1. Podsumowanie

**Najważniejsze liczby (produkcja, `https://www.pawelperfect.com/en`, pierwszy widok):**
- 32 zasoby JS/CSS w HTML; **JS ≈ 630 KB gzip / ≈ 2,1 MB po rozpakowaniu** (bez polyfillu `noModule` 40 KB gz), CSS 52 KB gz / 314 KB raw. Największy chunk 431 KB raw (Vidstack + hls). Do pierwszego widoku trafiają m.in.: framer-motion (141 KB raw), loader Stripe + kod bramki napiwkowej (BLIK), cały modal konta z 2FA i `qrcode.react`, modal logowania z Turnstile, kokpit premiery (53 KB raw), teksty wszystkich 4 dokumentów prawnych.
- HTML strony głównej: 104 KB.

**Stan ogólny:** kod jest staranny w szczegółach (Base UI w dialogach, `aria-current`, `prefers-reduced-motion` w wielu miejscach, czyszczenie AbortControllerami), ale architektura klienta narosła warstwami obejść: maskowanie URL, zdarzenia `window`, podwójnie montowana playlista z własnym deduplikatorem żądań, ręczny cache planów odtwarzania, 668 trójargumentowych tłumaczeń inline, globalne monkey-patchowanie `fetch`. Prawie cały interfejs jest kliencki i ładowany statycznie, przez co pierwszy widok płaci za funkcje, z których większość odwiedzających nigdy nie skorzysta.

**Błędy produkcyjne potwierdzone żądaniami GET (do naprawy od ręki):**
1. `/unsubscribe` zwraca **404**. Linki wypisu w e-mailach (`lib/modules/subscriptions/domain/signed-unsubscribe-token.ts:84`) nie działają (FE-01).
2. Polskie strony (`/`, `/regulamin`, …) są serwowane **bez nagłówka CSP**; `/en` go ma (FE-02).
3. Polska strona główna `/` ma `<html lang="en">` i angielski interfejs (`<h1>` po angielsku), a `og:title` jest po polsku (FE-03).
4. `AppVersionCheck` co 60 s odpytuje `/api/__version`, który **nigdy nie istniał** (folder z `_` jest prywatny w App Routerze). Każda karta co minutę pobiera stronę 404 o rozmiarze 16 KB (FE-04).
5. `<Analytics />` Vercela na własnym serwerze: `/_vercel/insights/script.js` → 404 (FE-05).
6. `/icon` (apple-touch-icon) → 404 (FE-30).
7. `sitemap.xml` jest generowany statycznie w czasie buildu Dockera, bez bazy, więc nie zawiera filmów ani kanału (FE-29).

**Liczba znalezisk:** 58 (P1: 17, P2: 32, P3: 9).

---

## 2. Znaleziska

Legenda: waga P1 (pilne / realna szkoda) · P2 (ważne) · P3 (porządki). Nakład: S (< pół dnia), M (1–2 dni), L (> 2 dni). Pewność: wysoka / średnia.

### A. Błędy działające na produkcji

### B. Wydajność i bundle

**FE-09 · P1 · wydajność (budżet)** · cały pierwszy widok (`app/[locale]/(home)`)
Problem: ≈630 KB gz JS na pierwszy widok to kilkukrotnie więcej niż rozsądny budżet dla strony z jednym playerem. Główne składniki (pomiar chunków z produkcji): Vidstack+hls 117 KB gz, framer-motion 46 KB gz, Better Auth + modale ≈ 70 KB gz, Stripe/tip ≈ 21 KB gz, kokpit ≈ 17 KB gz, TanStack Query, date-fns z locale `pl`.
Rozwiązanie: po FE-06/07/08/10/50 ustalić budżet (np. ≤ 250 KB gz) i pilnować go w CI. Narzędzie: `next experimental-analyze` (Next 16.1+, analizator dla Turbopacka, pokazuje łańcuch importów) ([Next.js 16.1](https://nextjs.org/blog/next-16-1)). Nakład M. Pewność wysoka (rozmiary zmierzone; podział na biblioteki wg znaczników w chunkach, średnia precyzja).

**FE-10 · P2 · wydajność** · framer-motion w 7 plikach: `AccessLockOverlay.tsx:4`, `SubscribeButton.tsx:4`, `comments/EmbeddedComments.tsx:24`, `comments/components/comment-motion*`, `Providers.tsx:7` (`MotionConfig`)
Problem: pełny framer-motion (141 KB raw) służy do kilku efektów wejścia i liczników.
Rozwiązanie: przejście na CSS (keyframes, `@starting-style`, `transition-behavior: allow-discrete`). Jeśli coś musi zostać, to `LazyMotion` + `m` + `domAnimation` tylko w komentarzach. Nakład M. Pewność wysoka.

**FE-12 · P2 · CSS/wydajność** · `tailwind.config.ts:106-108`
Problem: wtyczka `@tailwindcss/typography` dokłada ≈26 KB raw `.prose` do globalnego CSS, a klasa `prose` występuje tylko w `app/admin/emails/components/BroadcastWizard.tsx` i `app/admin/emails/broadcast/BroadcastHistory.tsx`.
Rozwiązanie: usunąć wtyczkę i ostylować podgląd maila lokalnie; ewentualnie `@plugin` w osobnym CSS admina. Nakład S. Pewność wysoka.

**FE-14 · P2 · wydajność/dane** · `app/components/preload/AppPreloadProvider.tsx:14,33-35,98-111,220-223,240-285`, `preload/PreloadProgressBar.tsx:134-142`
Problem: (a) przy każdym wejściu boot rozgrzewa bieżący film i w `requestIdleCallback` 3 sąsiednie, każdy przez `/api/media-source/…`, co tworzy prawdziwe `VideoPlaybackSession`, podpisane tokeny i dociąga komentarze, nawet gdy widz nic nie kliknie. (b) `priority` w `WarmVideoOptions` nie jest nigdzie czytane. (c) `markVideoActive`, `warmComments`, `initialProgress` i `initialReady` są w kontekście, ale nikt ich nie używa z zewnątrz, a zmiany `initialProgress` (≈5 na każdy film) odświeżają wartość kontekstu, czyli renderują ponownie całe `ChannelHomeContent` (konsument `useAppPreload`). (d) Postęp jest równolegle rozgłaszany zdarzeniem `window` do `PreloadProgressBar`.
Rozwiązanie: rozgrzewać tylko przy intencji (hover/focus/touchstart) i tylko lekką część; sesję odtwarzania tworzyć dopiero przy starcie odtwarzania, a nie przy pobraniu planu. Usunąć stan postępu z kontekstu (pasek może czytać z małego store'u przez `useSyncExternalStore`) i usunąć nieużywane pola. Nakład M. Pewność wysoka.

**FE-15 · P3 · dane** · `AppPreloadProvider.tsx:136,206-211`
Problem: plan `ready` jest trzymany w pamięci bez względu na `source.expiresAt`. Po powrocie do filmu po wygaśnięciu tokenu `PremiumWrapper` (`:246-257`) od razu robi drugi fetch.
Rozwiązanie: traktować plan z `expiresAt - 120 s < now` jako brak w cache. Nakład S. Pewność wysoka.

**FE-17 · P2 · wydajność** · `app/components/ChannelHome.tsx:380-393`, `channel/sidebar-layout-request.ts`, `ChannelHome.tsx:98-110`
Problem: `SidebarPlaylist` jest montowana dwa razy (panel mobilny „zawsze zamontowany” i `aside` desktopu). Podwaja to DOM, obrazki, nakładki, zegary premiery i id `donations`. Istnieją wyłącznie po to, żeby to obejść: moduł deduplikacji żądań i `getVisibleDonationsElement`.
Rozwiązanie: jedna instancja ustawiana CSS-em (grid z obszarami albo `order`), a nieaktywną kartę mobilną ukryć przez [`<Activity mode="hidden">`](https://react.dev/blog/2025/10/01/react-19-2) (React 19.2: stan zostaje, efekty są odmontowane). Moduł `sidebar-layout-request.ts` i helper od `#donations` znikają. Nakład M. Pewność wysoka.

**FE-18 · P2 · wydajność/architektura** · `force-dynamic` w `app/[locale]/(home)/page.tsx:10`, `search/page.tsx:10`, `watch/[slug]/page.tsx:7`, `channel/[slug]`, `app/admin/layout.tsx:6`; `app/layout.tsx` czyta ciasteczka/nagłówki
Problem: każda strona jest w pełni dynamiczna, więc nie ma statycznej powłoki i TTFB zależy od bazy. Publiczna część strony głównej (lista filmów, opisy) jest identyczna dla wszystkich.
Rozwiązanie: Next 16 [Cache Components](https://nextjs.org/blog/next-16) (`cacheComponents: true`, `"use cache"` + `cacheTag('videos')` dla treści publicznych, `updateTag`/`revalidateTag` przy publikacji w adminie), a rzeczy zależne od widza (polubienia, subskrypcja, sesja) w `<Suspense>`. Daje to PPR: statyczną powłokę z CDN Cloudflare plus dynamiczne dziury. Nakład L. Pewność średnia (wymaga przebudowy granic danych).

**FE-20 · P3 · jakość** · `app/components/Providers.tsx:62-85,102-104`
Problem: globalne nadpisanie `window.fetch` wywoływane w trakcie renderu, żeby dodać timeouty trzem ścieżkom. Ukryte, globalne i łatwe do zapomnienia.
Rozwiązanie: `AbortSignal.any([signal, AbortSignal.timeout(15000)])` we wspólnym fetcherze (lub `queryFn`). Nakład S. Pewność wysoka.

### C. Pobieranie danych i stan

**FE-21 · P2 · dane** · TanStack Query tylko w 4 plikach (komentarze); ręczne `fetch` w efektach m.in. `Hero.tsx:99-114`, `Navbar.tsx:55-79,90-98`, `PremiumWrapper.tsx:170-178`, `AppPreloadProvider.tsx:146`, `SidebarPlaylist.tsx:111-145` (+ własny dedup), `SubscribeButton`, 12 stron admina
Problem: dwie warstwy danych i brak sprawdzania `response.ok`: `PremiumWrapper.tsx:172-177`, `AppPreloadProvider.tsx:146-152` (JSON błędu 500 jest traktowany jak plan), `LanguageContext.tsx:86-90`, `admin/videos/layout/page.tsx` (cichy pusty stan).
Rozwiązanie: wybrać jedną drogę (rozdz. 4.2): RSC dla odczytów + TanStack Query z `queryOptions` per zasób dla tego, co naprawdę klienckie (komentarze, stan widza), z jednym fetcherem rzucającym błąd przy `!ok`. Nakład M-L. Pewność wysoka.

**FE-22 · P2 · dane** · `AppPreloadProvider.tsx:113-128` vs `comments/hooks/useComments.ts`
Problem: dwie niezależne definicje `queryFn` dla tego samego klucza `["comments", videoId, sortBy]`. Rozjazd jednej z nich da w cache dane innego kształtu.
Rozwiązanie: wspólne `commentsInfiniteQueryOptions(videoId, sortBy)` używane w obu miejscach. Nakład S. Pewność wysoka.

**FE-23 · P2 · dane** · `app/components/Navbar.tsx:55-85`
Problem: po hydracji klient woła `/api/user/profile`, żeby ustalić `isAdmin`/`isPatron`, choć serwer w `HomeExperience` ma już `userDb.role` i `hasActivePatronGrant`. Powstaje wodospad i link admina pojawia się z opóźnieniem.
Rozwiązanie: rola jako `additionalFields` sesji Better Auth albo prop z serwera. Nakład S. Pewność wysoka.

**FE-24 · P2 · stan** · `app/components/UrlMask.tsx` (całość), `ChannelHome.tsx:112-195`
Problem: każdy publiczny URL jest po montażu zamieniany na `/`. Skutki: F5 na wyszukiwaniu, kanale albo filmie wraca na stronę główną; zakładki i kopiowanie adresu nie działają; Wstecz/Dalej wymagają hacka z `history.state`. Efekt ma zależności `[pathname]` (`:78`), więc po płytkim `pushState` z `?v=` URL zostaje **niezamaskowany**, czyli zachowanie jest niespójne. Wzorzec `/logo\d+` (`:30-32`) dotyczy usuniętego eksperymentu. Maskowanie stoi też w sprzeczności z canonical/hreflang.
Rozwiązanie (decyzja właściciela): usunąć `UrlMask` i pokazywać prawdziwe, ładne URL-e (`/?v=slug` albo `/film/slug`). Jeśli maskowanie ma zostać, przynajmniej zostawić `?v=` i wyszukiwanie. Nakład S (usunięcie) / M (nowe URL-e). Pewność wysoka.

**FE-25 · P2 · stan** · zdarzenia `window` jako szyna: `polutek:open-support` (`Hero.tsx:358`, `ChannelHome.tsx:226-229`), `polutek:gate-enter` (`PageRevealGate.tsx:177`, `VideoPlayer.tsx:165-174`), `polutek:app-preload-progress` (`AppPreloadProvider.tsx:63-66`, `PreloadProgressBar.tsx:140`)
Problem: niejawne zależności bez typów, niemożliwe do prześledzenia w IDE. `Hero` zakłada, że „zawsze” renderuje się w `ChannelHome`.
Rozwiązanie: `SupportGateProvider` z `open()`, stan bramki w istniejącym `PageRevealContext`, postęp w store (FE-14). Nakład S-M. Pewność wysoka.

**FE-26 · P2 · stan/hydracja** · `app/components/preload/PageRevealGate.tsx:112-114`
Problem: początkowy stan z `sessionStorage` w inicjalizatorze `useState`. Przy F5 w tej samej karcie serwer renderuje preloader, a klient od razu `done`, co daje niedopasowanie hydracji (React przerenderowuje drzewo po stronie klienta).
Rozwiązanie: zawsze startować od `covering`, a pominięcie liczyć w `useLayoutEffect`/`useSyncExternalStore`, albo przenieść flagę do ciasteczka czytanego na serwerze. Nakład S. Pewność wysoka.

**FE-27 · P2 · stan/hydracja** · `Hero.tsx:43-93,386`, `SidebarPlaylist.tsx:263-279`, wzorzec `mounted` w wielu plikach
Problem: (a) `new Date(publishedAt).toLocaleDateString(...)` w renderze bez strefy czasowej (serwer UTC, klient lokalnie): ryzyko rozjazdu hydracji w okolicy północy. (b) Wzorzec „najpierw surowa liczba, po `mounted` sformatowana” daje dodatkowy render i mignięcie. (c) Trzy `useEffect` kopiujące propsy do stanu po `video.id`, mimo że `Hero` i tak jest przemontowywany przez `key={selectedVideo.id}` na wrapperze (`ChannelHome.tsx:330-333`), więc te efekty są zbędne.
Rozwiązanie: formatowanie po stronie serwera (`Intl` z `timeZone: 'Europe/Warsaw'`), przekazanie gotowych stringów, usunięcie efektów synchronizujących. Nakład S. Pewność wysoka.

### D. SEO, metadane, PWA

**FE-32 · P2 · jakość/SEO** · `next.config.mjs:27-29,33-62,79-85`; `app/robots.ts:4`
Problem: `typescript.ignoreBuildErrors: true` (build przepuszcza błędy typów; build pokazał „Skipping validation of types”); `poweredByHeader` domyślny (na produkcji jest `x-powered-by: Next.js`); `remotePatterns` dla martwych hostów (pinata, unsplash, dicebear, `img.clerk.com`, `*.blob.vercel-storage.com` jeśli migracja skończona, `i.ytimg.com`); przestarzały `X-XSS-Protection`; `robots.ts` z fallbackiem na `localhost`.
Rozwiązanie: wyłączyć `ignoreBuildErrors` (typecheck jest w CI, więc build powinien też pilnować), `poweredByHeader: false`, wyczyścić hosty, fallback robots na `https://www.pawelperfect.com`. Nakład S. Pewność wysoka.

### E. Dostępność (WCAG 2.2 AA)

**FE-34 · P1 · dostępność** · `app/components/preload/SitePreloaderScreen.tsx:32-36`, `preload/MatrixGatePrompt.tsx:61-102`, `preload/PageRevealGate.tsx:183-196`
Problem: (a) kontener `role="status" aria-live="polite"` obejmuje pisany znak po znaku tekst (zmiana co 95 ms), więc czytnik ekranu go zasypuje; (b) przycisk wejścia jest wewnątrz regionu live; (c) `aria-label="Enter"` jest zawsze po angielsku; (d) przycisk jest fokusowalny, gdy jest niewidoczny (`opacity:0`), a Enter nic wtedy nie robi; (e) fokus nie jest przenoszony na przycisk; (f) strona pod nakładką nie jest `inert`, więc Tab wędruje po ukrytej treści (WCAG 2.4.3, 2.4.11, 4.1.3); (g) animacja pisania ignoruje `prefers-reduced-motion`.
Rozwiązanie: tekst pisany jako `aria-hidden` + pełny tekst `sr-only`, bez `aria-live` na kontenerze; `inert` na wrapperze strony, dopóki `phase !== 'done'`; przycisk renderować dopiero po pojawieniu się, z `autoFocus` i zlokalizowaną etykietą; przy reduced motion tekst od razu w całości. Nakład S. Pewność wysoka.

**FE-38 · P2 · dostępność** · `app/components/AccessLockOverlay.tsx:132-142,165-197,100-124`; `channel/SidebarPlaylist.tsx:239-245`
Problem: blokada logowania to `section role="button"` z nazwą z obrazka („Nie masz psychy sie zalogowac”: bez polskich znaków i bez informacji, co robi akcja); Spacja nie ma `preventDefault`, więc przewija stronę; tekst jest obrazkiem (`wall-text-*.png`, WCAG 1.4.5). Kafelki z `role="img"` wewnątrz linku playlisty doklejają „Zaloguj się”/„Premiera …” do nazwy linku.
Rozwiązanie: prawdziwy `<button aria-label="Zaloguj się, aby obejrzeć">`, grafika `alt=""` + tekst `sr-only`; w kafelkach `aria-hidden` i stan w opisie linku. Nakład S. Pewność wysoka.

**FE-39 · P2 · dostępność** · `app/components/ChannelHome.tsx:343-385`
Problem: zakładki mobilne to przyciski z `aria-pressed`, a nie wzorzec `tablist`/`tab`/`tabpanel`. Kolor aktywnej zakładki „Filmy” `--chan-amber-strong` (#d97706) na #f7f9fc daje kontrast **3,02:1** przy 12 px (wymagane 4,5:1; obliczone).
Rozwiązanie: wzorzec tabs (np. Base UI `Tabs`), ciemniejszy bursztyn (#b45309 ≈ 5:1) lub atrament z bursztynowym podkreśleniem. Nakład S. Pewność wysoka.

**FE-40 · P2 · dostępność** · `app/components/channel/SupportModal.tsx:133-137,265-276,287-290`
Problem: kropki postępu są `aria-hidden` i nie ma tekstowego „Krok 2 z 5”; przy zmianie kroku cała treść jest przemontowywana (`key`), a fokus z usuniętego przycisku nie trafia na nagłówek nowego kroku. `handleClose` od razu woła `onClose()`, więc rodzic odmontowuje dialog i animacja zamknięcia opisana w komentarzu (`:68-70`) nigdy się nie odtwarza. `paymentRequest({ country: "PL" })` (`:88`) jest zaszyte na sztywno.
Rozwiązanie: `aria-live`/tekst kroku, fokus na nagłówek kroku po zmianie, `onOpenChangeComplete` z Base UI do odmontowania po animacji. Nakład S. Pewność średnia (zachowanie fokusu Base UI przy usunięciu aktywnego elementu warto sprawdzić w przeglądarce).

**FE-43 · P2 · dostępność/jakość** · `app/components/Hero.tsx:143-162,194-213`; `VideoPlayer.tsx:347`
Problem: toasty z surowym komunikatem serwera („BŁĄD BAZY DANYCH: ${result.message}”) tylko po polsku, ujawniające wewnętrzne błędy. Komunikat playera „…CORS…” jest tylko po polsku i techniczny. Obsługa like/dislike to dwie kopie tej samej funkcji.
Rozwiązanie: mapowanie kodów błędów na zlokalizowane komunikaty i jedna funkcja `toggleReaction(kind)` z `useOptimistic` (React 19). Nakład S. Pewność wysoka.

### F. CSS

**FE-47 · P2 · CSS** · `app/components/watch-actions.module.css:139-325`
Problem: około 45 `!important` i selektory globalne zależne od struktury DOM: `:global(main):has(.metaRow) :global(section:has(.polutek-vidstack-player) > div > div:nth-child(2) > div > div:nth-child(2))`, `div[class~="space-y-[24px]"]`, `aside:has(a[href*="?v="])`. Każda zmiana zagnieżdżenia albo klasy Tailwind w `Hero`/`EmbeddedComments`/playliście po cichu psuje style.
Rozwiązanie: przenieść te style do komponentów (klasy lub warianty Tailwind na właściwych elementach) i usunąć moduł. Nakład M. Pewność wysoka. (Szczegóły spójności wizualnej robi osobny agent.)

### G. Martwy kod i zasoby

**FE-50 · P1 · martwe/wydajność** · bramka boczna za `TEMP_SUPPORT_AS_MODAL=true`: `channel/DonationBox.tsx` (294 l.), `channel/DonationAmountField.tsx`, `channel/DonationLegalDialog.tsx`, `playlist/CheckoutModal.tsx` (241 l.), `playlist/CheckoutSummaryPanel.tsx`, `CheckoutForm.tsx`, `SidebarPlaylist.tsx:56-62,306-308,342-346`, `ChannelHome.tsx:98-110,212-223`
Problem: martwy w działaniu, ale **statycznie importowany**, więc ciągnie Stripe do pierwszego widoku (FE-06). Szczegóły i warianty w rozdz. „Flagi TEMP_*”. Nakład M. Pewność wysoka.

**FE-52 · P2 · martwe** · trasy nieosiągalne: `app/page.tsx`, `app/regulamin/page.tsx`, `app/polityka-prywatnosci/page.tsx`, `app/search/page.tsx`, `app/watch/[slug]/page.tsx`, `app/channel/[slug]/page.tsx` (+ `loading.tsx`)
Problem: proxy przepisuje każdą ścieżkę bez prefiksu na `/pl/...` (`middleware.ts:84-96`), zanim te trasy zostaną dopasowane, więc nigdy się nie wykonują. Build i tak je buduje (`/regulamin` i `/polityka-prywatnosci` nawet prerenderuje statycznie z przekierowaniem na `/en`, przez flagę).
Rozwiązanie: usunąć. Przy przebudowie i18n zdecydować jawnie w `proxy.ts`. Nakład S. Pewność wysoka (logika proxy jednoznaczna; warto potwierdzić jednym testem e2e).

**FE-55 · P3 · jakość** · `"use client"` bez potrzeby
Pliki bez hooków i handlerów: `app/components/BrandName.tsx`, `PlayerStateFrame.tsx`, `playlist/CheckoutSummaryPanel.tsx`, `najs/primitives.tsx`, `icons/brand-icons.tsx`, **`comments/types.ts`** (plik z samymi typami!), `app/admin/users/AdminAccessDiagnostics.tsx`, `components/ui/{label,table}.tsx`. `Footer.tsx` jest kliencki tylko dla `useLanguage`, co da się zastąpić propem `locale`. Strony prawne renderują po stronie serwera, ale wciągają kliencki `Navbar` z całym drzewem auth.
Rozwiązanie: zdjąć dyrektywę, `Footer` przerobić na RSC z `locale`. Nakład S. Pewność wysoka.

### H. Panel admina

**FE-56 · P2 · admin** · 12 z 16 stron `app/admin/**/page.tsx` to całe strony `"use client"` (comments, comments/reports, emails, notifications, settings, users, users/dashboard, users/payments, users/[userId], videos, videos/[id], videos/[id]/edit, videos/layout)
Problem: layout serwerowy już weryfikuje admina, a strony i tak po hydracji pobierają `/api/admin/*` w efektach, co daje wodospad. 12 plików `loading.tsx` pokazuje się tylko na moment trywialnego renderu, po czym strona pokazuje własny szkielet, więc są dwa stany ładowania. Strony importują publiczny `Navbar` (wyszukiwarka, przełącznik języka, modale auth).
Rozwiązanie: odczyty w RSC (wywołanie use-case'ów bezpośrednio, bez HTTP), mutacje przez Server Actions + `useOptimistic`/`useActionState`, interaktywne fragmenty jako wyspy klienckie; własny `AdminHeader` zamiast publicznego `Navbar`. Nakład L. Pewność wysoka.

**FE-57 · P2 · admin** · brak `app/admin/error.tsx`; `app/admin/videos/layout/page.tsx`
Problem: błąd w panelu trafia do publicznego `app/error.tsx` (z linkiem „Wróć do strony głównej”). Trasa `/admin/videos/layout` (folder nazwany `layout` myli się z konwencją plików) przy `!res.ok` pokazuje cicho pustą listę.
Rozwiązanie: `app/admin/error.tsx` z retry i digestem; zmiana nazwy na `/admin/videos/kolejnosc`; obsługa błędu przez wspólny `useAdminListQuery`/RSC. Nakład S. Pewność wysoka.

**FE-58 · P3 · admin** · `app/admin/videos/components/VideoTable.tsx:25` `alert()`; trzy różne powłoki (`AdminVisualShell` w layoucie, `AdminLayoutShell` w wideo, ręczne w innych)
Rozwiązanie: toast i jedna powłoka strony z nagłówkiem, okruszkami i slotami akcji. Nakład M. Pewność wysoka.

---

## Flagi `TEMP_*` (punkt 9 zakresu)

Decyzja właściciela z dziś: flagi mają zniknąć. Dla każdej opisuję obie drogi.

### `TEMP_SUPPORT_AS_MODAL = true` (`lib/temp-support-modal.ts:15`)
Czytana w: `ChannelHome.tsx:19,208,239`, `SidebarPlaylist.tsx:22,59,306,342`.
- **Utrwalić modal (zalecane, zgodne z „napiwek nic nie odblokowuje” i obecnym UX):** usunąć flagę i plik. Wylatują: `channel/DonationBox.tsx`, `DonationAmountField.tsx`, `DonationLegalDialog.tsx`, `playlist/CheckoutModal.tsx`, `playlist/CheckoutSummaryPanel.tsx`, `CheckoutForm.tsx`, `SidebarSupportBox` i `patronBox` + szkielet w `SidebarPlaylist.tsx` (`:56-62,290,306-308,342-346`), `getVisibleDonationsElement` i gałąź przewijania w `revealDonations` (`ChannelHome.tsx:98-110,212-223`), kotwice `#donations`, testy `tests/unit/components/channel/DonationBox*.test.tsx` i `channel-home-support-handoff.test.tsx`, a w `useCheckoutFlow` obsługa `?support=1`, jeśli była tylko dla DonationBox. `SupportModal` zostaje jedyną ścieżką: ładowany `dynamic`, Stripe przez `/pure` (FE-06), otwierany z kontekstu `useSupportGate()` zamiast zdarzenia `polutek:open-support` (FE-25). Sekcja §4.10 CLAUDE.md do skrócenia.
- **Przywrócić boczny box:** flaga `false`, wtedy martwe staje się `channel/SupportModal.tsx` i cały `app/components/support/*` (11 plików + `tip-flow-config.ts`, `tip-confirm.ts`), a `ChannelHome` wraca do przełączania zakładki i przewijania. Nie zostawiać obu.

### `TEMP_HIDE_NOTIFICATIONS_BELL = true` (`app/components/Navbar.tsx:23`)
- **Utrwalić ukrycie:** usunąć flagę, `NotificationsMenu.tsx` (183 l.), importy `NotificationsMenu`/`NotificationDTO` (`Navbar.tsx:15-16`), stan i efekt `notifications` (`:88-98`), `messagesLabel`. Konsekwencja produktowa (do decyzji z backendem): `/api/notifications`, `/admin/notifications` i tabele powiadomień tracą odbiorcę. `NotificationsAccountSection` (preferencje e-mail) to coś innego i zostaje.
- **Przywrócić dzwonek:** flaga `false`; wtedy pobieranie przenieść do `useQuery` z lazy-loadowanym menu (`dynamic`), a nie `fetch` w efekcie Navbara przy każdej stronie.

### `TEMP_FORCE_ENGLISH = true` (`lib/i18n/server-language.ts:31`)
- **Utrwalić tylko EN:** sprzeczne z decyzją „PL i EN prawdziwe”; odradzam.
- **Usunąć flagę (zalecane, ale razem z FE-03):** samo zdjęcie flagi przywróci łańcuch ciasteczko → DB → nagłówek, który w root layoucie robi dodatkowy odczyt sesji i bazy przy każdym renderze strony, a `/regulamin` i `/polityka-prywatnosci` przestaną być statyczne (dziś mają zapieczone przekierowanie na `/en`). `x-vercel-ip-country` nie działa za Cloudflare (FE-33). Właściwa kolejność: najpierw język z `[locale]` (FE-03 / rozdz. 4.1), a `resolveInitialLanguage` zostaje tylko w proxy do przekierowania z `/` przy pierwszej wizycie.

---

## 3. Do usunięcia od ręki (z dowodem)

| Co | Dowód |
|---|---|
| `app/components/AppVersionCheck.tsx`, `app/api/__version/` | trasa nie istnieje (folder prywatny `_`), prod GET → 404; `data-build-id="development"` |
| `<Analytics />` + `@vercel/analytics` | prod `/_vercel/insights/script.js` → 404 |
| `brandLogoFont` (`app/fonts.ts:9-17`, `layout.tsx:47`), `tailwind.config.ts` `brandLogo`, `app/fonts/space-grotesk-bold-latin.woff2`, `app/fonts/bowlby-one-*` | brak użyć `font-brandLogo`/bowlby; prod preloaduje Space Grotesk |
| `@import '@vidstack/react/player/styles/default/layouts/video.css'` (`globals.css:2`) | brak `DefaultVideoLayout`/`vds-video-layout` w kodzie |
| `@tailwindcss/typography` | `prose` tylko w 2 komponentach admina |
| `RotateDeviceGuard.tsx` + `.module.css`, `OrientationLock.tsx`, `InstallAppMenu.tsx`, `cloudflarePlaybackSource.ts` | skrypt sierot: brak importów poza testami |
| `HomePageSkeleton`, `SkeletonNavbar`, `VideoCardSkeleton`, `VideoGridSkeleton`, `StatCardsSkeleton`, 15 ikon w `icons/index.tsx`, 3 w `brand-icons.tsx`, `useMediaQuery`, 5 stałych w `lib/constants.ts` | skrypt nieużywanych eksportów |
| 21 kluczy słownika w `LanguageContext.tsx` (lista w FE-28) | 0 użyć poza słownikiem/testami |
| Trasy `app/page.tsx`, `app/regulamin`, `app/polityka-prywatnosci`, `app/search`, `app/watch/[slug]`, `app/channel/[slug]` | proxy przepisuje te ścieżki na `/pl/...` przed dopasowaniem |
| `UrlMask` wzorzec `/logo\d+` (`UrlMask.tsx:30-32`), komentarz `/logoN` (`HomeExperience.tsx:31-33`) | eksperyment usunięty |
| CSS: tokeny i klasy z FE-48/FE-49, blok fallbacków `color-mix` (`globals.css:498-614`), `.tip-gate-slide` + keyframes | skrypt użycia CSS; targety Tailwind 4 |
| `public/gallery/` (12 MB), `Nieruchomosc3.jpeg`, `Nydek1/2.jpg`, `nowe.png`, `obok-loga.png`, `stripe.png`, `logo-wektorowe.svg`, `qr-code-placeholder.png`, `public/fonts/*.ttf`; w katalogu głównym `Projektowanie stylu Polutek (1).zip`, `logo1.png`, `logo1.svg`, `logoperfect.png` | 0 odwołań w `app/`, `lib/`, `components/`, `workers/`, configach |
| `media-icons`, `@radix-ui/react-progress` (+ `slot` po migracji `Button`), skrypt `clerk:resync` | 0 importów / Clerk usunięty |
| `"use client"` w `comments/types.ts` i plikach z FE-55 | brak hooków i handlerów |
| `VideoPlayer` wariant `thumbnail`, stała `isAdmin=false` | brak wywołań z `variant="thumbnail"` |

---

## 4. Lepsze rozwiązania (gdzie przepisać i na co)

Wszystkie propozycje sprawdzone pod kątem stanu na październik 2026. Źródła przy punktach.

### 4.1 i18n: z 668 trójargumentowych `isPl ? … : …` na słowniki po stronie serwera
Dziś: słownik 46 kluczy (połowa martwa) + **668** inline'owych `language === 'pl' ? … : …`/`isPl` (policzone w `app/`), komunikaty w RSC osobno, maile osobno, język z ciasteczka, a nie z URL (FE-03).
Na co:
- `messages/pl.json` i `messages/en.json` (przestrzenie nazw: `nav`, `player`, `comments`, `tip`, `auth`, `legal`, `admin`), typowane kluczami.
- **next-intl**: `getTranslations` w RSC (zero bajtów w kliencie), `NextIntlClientProvider` z wybranymi przestrzeniami tylko dla wysp klienckich, routing `localePrefix: 'as-needed'` (PL bez prefiksu, EN `/en`), pod Next 16 w `proxy.ts`. Biblioteka jest kompatybilna z Next 16 i aktywnie rozwijana ([next-intl + Next 16](https://www.aniq-ui.com/en/blog/next-intl-nextjs-16-caching-root-params), [przewodnik 2026](https://nextjslaunchpad.com/article/nextjs-internationalization-next-intl-app-router-i18n-guide)). Alternatywa bez zależności: wzorzec `getDictionary(locale)` z [przewodnika i18n Next.js](https://nextjs.org/docs/app/guides/internationalization) i mały kontekst klienta.
- `app/[locale]/layout.tsx` ustawia `<html lang={locale}>`; zmiana języka to nawigacja na drugi URL (już tak jest w `useSwitchLanguage`), bez `forcedLanguage`, refów i `document.documentElement.lang = …`.
- Przełącznik: tylko PL/EN, dopóki inne języki nie istnieją (sześć makiet to fałszywa afordancja; `LanguageSwitcher.tsx:18-27`).

### 4.2 Warstwa danych: RSC + Cache Components zamiast fetchy w efektach
- Odczyty publiczne (`loadHomeContent`, układ playlisty) jako funkcje `"use cache"` z `cacheTag('videos')` i `cacheLife`, unieważniane `updateTag`/`revalidateTag` w use-case'ach admina (publikacja, zmiana kolejności, okładka). Włączenie `cacheComponents: true` daje [PPR](https://nextjs.org/blog/next-16): statyczna powłoka (Cloudflare może ją cache'ować) + dynamiczne części widza w `<Suspense>` ([przewodnik migracji](https://nextjs.org/docs/app/guides/upgrading/version-16)).
- Odczyty per żądanie przez `React.cache` (sesja, użytkownik): koniec z potrójnym `loadHomeContent` i podwójną sesją (FE-16).
- Mutacje widza (like/dislike, subskrypcja, język) jako Server Actions + [`useOptimistic`](https://react.dev/reference/react/useOptimistic), co zastępuje ręczne optymistyczne kopie stanu w `Hero.tsx`.
- To, co klienckie z natury (komentarze, stan po płytkiej zmianie filmu, plan odtwarzania), przez TanStack Query z `queryOptions` per zasób i jednym fetcherem (`!ok` → wyjątek, `AbortSignal.timeout`). Znikają: monkey-patch `fetch`, `sidebar-layout-request.ts`, ręczny cache w `AppPreloadProvider` (zostaje tylko `queryClient.prefetchQuery` przy intencji).
- [React Compiler](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler) jest stabilny w Next 16 (`reactCompiler: true`). Po włączeniu można usunąć większość ręcznych `useMemo`/`useCallback` (np. `AppPreloadProvider`, `LanguageContext`); koszt to dłuższy build (Babel).
- `useEffectEvent` (React 19.2) zamiast `eslint-disable react-hooks/exhaustive-deps` (np. `ChannelHome.tsx:193-194`) ([React 19.2](https://react.dev/blog/2025/10/01/react-19-2)).

### 4.3 System dialogów
Dziś: Base UI w większości miejsc (dobrze: pułapka fokusu, Esc, przywracanie fokusu), ale treść modali jest ładowana statycznie, etykiety angielskie zaszyte w `components/ui/dialog.tsx`, `window.confirm`/`alert()` obok dialogów, ręczny panel emoji z `role="dialog"`.
Na co: jeden `AppDialog` na Base UI z obowiązkowym `title`, zlokalizowanym zamknięciem, `onOpenChangeComplete` (odmontowanie po animacji), fokusem na nagłówek przy zmianie kroku i leniwą treścią (`dynamic`); `AlertDialog` zamiast `confirm`. Proste przypadki (np. dialog prawny) mogą użyć natywnego [`<dialog>` + `showModal()`](https://developer.mozilla.org/docs/Web/HTML/Element/dialog), który daje top layer, `inert` tła i Esc bez JS ([przegląd 2026](https://www.dfm2html.com/tutorials/the-modern-modal-in-2026-using-the-html-dialog-element/)). Panel emoji jako Base UI `Popover`. Preloader i bramka: `inert` na treści (FE-34).

### 4.4 Montowanie i bundle
- Zasada: na pierwszy widok tylko player, tytuł, playlista i szkielet komentarzy; wszystko, co otwiera się kliknięciem (auth, konto, napiwek, prawne, share, kokpit premiery), przez `dynamic()` z prefetchem na `pointerenter`/`focus`.
- Stripe: `@stripe/stripe-js/pure` ([stripe-js README](https://github.com/stripe/stripe-js)).
- `<Activity mode="hidden">` zamiast podwójnego montowania playlisty i ukrywania klasą ([React 19.2](https://react.dev/blog/2025/10/01/react-19-2)).
- Animacje: CSS (`@starting-style`, `transition-behavior`), a do przejść między filmami View Transitions API. `<ViewTransition>` w React jest wciąż eksperymentalny, więc na razie zostaje lokalny fade.
- Budżet i kontrola: `next experimental-analyze` ([Next.js 16.1](https://nextjs.org/blog/next-16-1)) + test CI na rozmiar JS strony głównej. Cele [Core Web Vitals](https://web.dev/articles/vitals): LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (p75); największe ryzyko dziś to INP (2 MB JS do sparsowania na telefonie).

### 4.5 CSS: tokeny Tailwind 4
Przenieść konfigurację z `tailwind.config.ts` do `@theme` w CSS (Tailwind 4 natywnie; JS config to tryb zgodności), `--chan-*` jako tokeny `@theme` (dają klasy `bg-chan-blue`, `text-chan-muted`), mieszanki przezroczystości przez modyfikator `/10` (`bg-chan-blue/10` korzysta z `color-mix`), skasować ≈90 ręcznych `--cm-*` i blok fallbacków. Targety przeglądarek zgodne z [Tailwind 4: Safari 16.4+, Chrome 111+, Firefox 128+](https://tailwindcss.com/docs/compatibility). `watch-actions.module.css` rozpisać na komponenty (FE-47).

### 4.6 Dostępność: kryteria WCAG 2.2, które warto dopisać do checklisty PR
[2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) (sticky navbar + overlaye), [2.5.8 Target Size 24×24](https://www.w3.org/TR/WCAG22/) (dziś w większości spełnione: przyciski 32–44 px), 3.3.8 dostępne uwierzytelnianie (Google/One Tap i menedżery haseł: `autocomplete` jest, OK). Do CI: `@axe-core/playwright` na stronie głównej (gość, zalogowany), w bramce napiwkowej i w modalu logowania.

### 4.7 Proxy
`middleware.ts` → `proxy.ts` ([Next 16](https://nextjs.org/blog/next-16): middleware przestarzały, proxy na Node.js); jedna tablica tras najwyższego poziomu bez lokalizacji, współdzielona z testem (FE-01/02/30/52).

---

## 5. Proponowana kolejność małych PR-ów

1. **fix(proxy): /unsubscribe, /icon, CSP dla polskich stron** (FE-01, FE-02, FE-30 część): wyjątki + nagłówki na rewrite + test tras. S. Pilne (prawo i bezpieczeństwo).
2. **chore: usunięcie martwego runtime'u** (FE-04, FE-05, FE-13): `AppVersionCheck`, `/api/__version`, Vercel Analytics, Space Grotesk/Bowlby. S.
3. **perf: Stripe bez efektów ubocznych + utrwalenie modalu napiwku** (FE-06, FE-50, flaga `TEMP_SUPPORT_AS_MODAL`): `/pure`, usunięcie DonationBox/CheckoutModal i spółki, `useSupportGate()`. M.
4. **perf: leniwe modale auth/konta/kokpitu/prawnych** (FE-07, FE-08, FE-19). M.
5. **perf(css): Vidstack bez domyślnego layoutu, bez typography, martwy CSS** (FE-11, FE-12, FE-48, FE-49 część). S.
6. **fix(seo): sitemap dynamiczny, viewport/metadata, manifest i ikony, next.config** (FE-29, FE-30, FE-31, FE-32). S.
7. **a11y: bramka i preloader** (FE-34) + **navbar/landmarki/skip link/zagnieżdżony main** (FE-35, FE-36). S.
8. **a11y: Hero opis, blokada logowania, zakładki mobilne, playlista, dialog „Close”, confirm/alert** (FE-37 do FE-43). S-M.
9. **chore: martwe komponenty, trasy, eksporty, zasoby, zależności** (FE-51, FE-52, FE-53, FE-54, FE-55). S.
10. **data: `React.cache` dla sesji i treści strony głównej, rola w sesji** (FE-16, FE-23). S.
11. **i18n krok 1: język z `[locale]`, `<html lang>` z URL, zdjęcie `TEMP_FORCE_ENGLISH`, `cf-ipcountry`** (FE-03, FE-33). M.
12. **i18n krok 2: słowniki + next-intl, migracja trójargumentowych tłumaczeń modułami** (4.1, FE-28, FE-41, FE-45). L, w kilku PR-ach (nav → player → komentarze → napiwek → auth → admin).
13. **decyzja + PR: usunięcie `UrlMask`** (FE-24) i zdarzeń `window` (FE-25); hydracja (FE-26, FE-27). S-M.
14. **state: jedna playlista + `<Activity>`, uproszczenie AppPreload** (FE-14, FE-15, FE-17, FE-22). M.
15. **flaga dzwonka**: decyzja właściciela, potem PR (usunięcie albo lazy + `useQuery`). S.
16. **data: Cache Components/PPR dla strony głównej** (FE-18) + `reactCompiler` (4.2). L.
17. **admin: RSC + Server Actions, `error.tsx`, jedna powłoka** (FE-56, FE-57, FE-58). L, stopniowo per sekcja.
18. **CSS: `@theme` zamiast `tailwind.config.ts`, rozbiórka `watch-actions.module.css`** (FE-47, FE-49, 4.5). M; skoordynować z agentem od spójności stylów.
19. **CI: budżet JS + axe** (FE-09, 4.6). S.

Uwagi do pracy: lokalny `next build` zgłasza też niezgodność schematu Prismy z Better Auth (`twoFactor.verified`, `failedVerificationCount`, `lockedUntil`); to temat backendu, przekazać właściwemu agentowi. CLAUDE.md zawiera nieaktualne twierdzenia (montowany `RotateDeviceGuard`, `HomePageSkeleton` w `HomeRouteLoading`, kanarkowa bramka, „Clerk” w wielu miejscach). Warto go odchudzić po tych PR-ach.

# Audyt wydajności postrzeganej: preloader, ładowanie, płynność (pawelperfect.com)

> Stan po naprawach: patrz `RESULT-www-fixes.md` (znaleziska naprawione lub nieaktualne zostały usunięte z tego pliku).

Data: 2026-10-03. Stan kodu: `main` @ `88c787d0`. Audyt tylko do odczytu, jako gość, tylko GET.
Narzędzia: analiza kodu, `curl` (HTTP/1.1, Schannel), sonda HTTP/2 w Node (`http2`), Playwright 1.61 + systemowy Chrome 154 (headless), z PerformanceObserver (`layout-shift`, `largest-contentful-paint`, `longtask`) i znacznikami stanu preloadera/wideo co klatkę.
Ograniczenia: (a) Lighthouse (`npx lighthouse@13`) uruchomiony, ale zabity przez limit czasu (maszyna mocno obciążona); nie powtarzałem go, żeby nie dokładać ruchu na produkcję. Zastępczo: przebieg Playwright z emulacją „Slow 4G” (150 ms RTT, 1,6 Mb/s, CPU ×4). (b) Wyszukiwarka/WebFetch zwróciły limit sesji, więc źródła w §6 to oficjalna dokumentacja podana z wiedzy, **niezweryfikowana w tej sesji**. (c) DNS na tej maszynie jest wolny (0,3–1,5 s), więc czasy „zimnego” pierwszego wejścia są zawyżone o ten koszt. Czasy serwera podaję osobno (ciepłe połączenie HTTP/2).

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 4/10 względem celu „wszystko gotowe naraz, bez szkieletów”.** Serwer jest szybki (HTML ~90–110 ms na ciepłym połączeniu), ale prawie cała gotowość strony powstaje dopiero po stronie klienta, w długim, szeregowym łańcuchu: HTML → 666 KB JS (br) → hydratacja → `GET /api/auth/get-session` → `GET /api/media-source/:id` → montaż Vidstack → **pobranie hls.js z cdn.jsdelivr.net (189 KB)** → manifest → segment testowy 360p (557 KB) → segment 540p (865 KB) → pierwsza klatka. Bramka „Follow the white rabbit” to zasłania, ale:

1. **Na produkcji plakat (poster) nigdy się nie pokazuje.** CSP `img-src` nie zawiera `thumbs.pawelperfect.pl`, więc każdy surowy `<img>`/`new Image()`/`<link rel=preload as=image>` z R2 jest blokowany (11 błędów CSP na jedno wejście; `naturalWidth = 0`). Mechanizm „poster-first” (`PlayerPosterLoading`) pokazuje czarny prostokąt ze spinnerem, a po kliknięciu bramki użytkownik widzi czarny odtwarzacz aż do pierwszej klatki (mobile: ~5 s po wejściu).
2. **Bramka prawie zawsze pojawia się dopiero po limicie czasu, nie po gotowości.** Desktop: bramka po 7,4 s, pierwsza klatka wideo po 16,4 s. Mobile (Slow 4G): bramka po 7,8 s, pierwsza klatka po 21,0 s. Warunek „gracz ma 3 s bufora” praktycznie nigdy nie zdąży przed `PAGE_REVEAL_MAX_WAIT_MS = 6000`. Użytkownik czeka ~6–8 s na samą możliwość kliknięcia, a i tak dostaje niegotowy odtwarzacz.
3. **Stripe.js ładuje się u każdego gościa na stronie głównej** (moduł-level `loadStripe()` w `lib/hooks/useCheckoutFlow.ts:30-32`, importowany statycznie przez `SidebarPlaylist → DonationBox`), choć bramka napiwków jest ukryta (`TEMP_SUPPORT_AS_MODAL`). To ~800 KB zewnętrznego JS + iframe’y `m.stripe.network`, które na mobile konkurują o pasmo z hls.js i segmentami.
4. **Brak gotowości przy ponownym wejściu w tej samej karcie.** Bramka pomija się przez `sessionStorage`, więc odświeżenie pokazuje „surowe” ładowanie: szkielety nawigacji (2 kółka), komentarzy (21 elementów), czarny poster, potem wideo. Dokładnie to, czego właściciel nie chce.
5. **Brak cache na każdym poziomie publicznych danych**: strona `force-dynamic`, `getHomeContentCached()` nic nie cache’uje i jest wołane 3× na żądanie (~26 zapytań do bazy), dokumenty prawne też renderowane per żądanie (`no-store`), `/_next/image` i `/api/videos/*/thumbnail` nie są cache’owane przez Cloudflare (`cf-cache-status: DYNAMIC`).

CLS jest dobry (0,0045 desktop, 0,0086 mobile, głównie pod bramką), więc problem to **czas i dociąganie**, nie przesunięcia. Przełączanie filmu (rozgrzane hoverem) to ~3,3 s do pierwszej klatki na desktopie, z czego ~0,6 s to sam render po kliknięciu, a resztę zjada start hls.js.

Najważniejsze, tanie wygrane (pierwsze 4 PR-y z §7): naprawa CSP posterów, hls.js z bundla zamiast z jsDelivr, `testBandwidth:false` + ustalony `startLevel`, Stripe ładowany dopiero przy otwarciu bramki napiwku, bramka pokazana od razu (bez fazy „covering”). Łącznie realnie **−5 do −10 s** do „pełnej strony z grającym wideo” na mobile i brak czarnego odtwarzacza.

---

## 2. Pomiary

### 2.1 HTML, serwer, kompresja, nagłówki

| Pomiar | Wartość | Uwagi |
|---|---|---|
| TTFB `/pl`, ciepłe HTTP/2 (3 próby) | 112 / 91 / 91 ms (mediana **91 ms**) | sonda Node http2; zawiera Cloudflare + Tunnel + render |
| TTFB `/en`, ciepłe HTTP/2 | 91 ms | |
| Czas serwera z curl (ttfb − tls), `/`, `/pl`, `/en` (9 prób) | 106–175 ms, mediana **~120 ms** | HTTP/1.1; zimne DNS 0,3–1,5 s (problem tej maszyny) |
| Rozmiar HTML `/pl` | 104 144 B surowo; **13,3 KB br**, 14,1 KB zstd | br i zstd działają |
| HTTP | h2 (Node), `alt-svc: h3` ogłaszany | |
| `cache-control` HTML | `private, no-cache, no-store, max-age=0, must-revalidate`; `cf-cache-status: DYNAMIC` | |
| `103 Early Hints` | **brak** (żaden status 1xx w sondzie h2) | nagłówek `Link` jest, ale preloaduje złe fonty |
| `Link:` preload | GeistMono (72 KB), Geist (70 KB), **Space Grotesk Bold (13,5 KB, nieużywany)** | |
| `/pl/regulamin` | 110–116 ms, `no-store`, DYNAMIC | dokument statyczny renderowany per żądanie |
| `/api/channel/sidebar` | 90–103 ms, brak `cache-control`, DYNAMIC | |
| `/api/auth/get-session` (gość) | 94 ms, `no-store` | zawsze po hydratacji |
| `/_next/static/chunks/*.js` | `public, max-age=31536000, immutable`, CF **HIT** | dobrze |
| fonty `/_next/static/media/*.woff2` | immutable; CF MISS świeżo po deployu | dobrze |
| `/_next/image?...thumbs...&w=384` | `max-age=31536000, must-revalidate`, **CF DYNAMIC**, `x-nextjs-cache: MISS`, 346 ms TTFB | sharp na 2 vCPU przy każdym nowym wariancie; CF tego nie cache’uje |
| `/api/videos/<id>/thumbnail` | `s-maxage=3600, stale-while-revalidate=86400`, ale **CF DYNAMIC**; `vary: rsc, next-router-…` | nagłówki gotowe, brak reguły cache w CF |
| `/rabbit.png` (favicon + apple icon + obraz bramki) | **105 KB**, `max-age=14400`, CF REVALIDATED | ikona 105 KB pobierana kilka razy |
| `/manifest.json` | `max-age=0` | |
| HLS `master.m3u8` / `index.m3u8` | `public, max-age=300`, CF HIT, TTFB 0,36–0,45 s (nowe połączenie z curl) | |
| HLS `init.mp4`, `seg_*.m4s` | `public, max-age=31536000, immutable`, CF HIT, TTFB ~0,31 s (nowe połączenie) | dobrze |
| Długość segmentu hero | 6 s + 4 s (`TARGETDURATION 6`), drabina 720p/540p/360p (1,83 / 1,21 / 0,76 Mb/s) | |

### 2.2 Zasoby pierwszego widoku

| Pomiar | Wartość |
|---|---|
| Skrypty `<script src>` w HTML | **29 plików, 666 KB br / 2,10 MB surowo** |
| Największe | `2eqc-zw0c11o-.js` 113 KB br (Vidstack), `3nwkmopkiklms.js` 71 KB (react-dom), `1e679cme38j72.js` 55 KB, `2hqk6qm95-7ks.js` 50 KB (cały AuthModal: Dialog, 2FA, Turnstile, One Tap, onboarding), `0a6j1169lou_a.js` 47 KB (framer-motion), `0nka6ngk6e868.js` 21 KB (Stripe/PaymentElement) |
| CSS | 3 pliki, 52 KB br (główny 44 KB) |
| Zewnętrzne na starcie (gość) | `js.stripe.com/dahlia/stripe.js` 256 KB → potem `controller` 349 KB + `shared` 203 KB + iframe’y; `cdn.jsdelivr.net/npm/hls.js@^1.5.0` 189 KB; po bramce `accounts.google.com/gsi/client` 102 KB |
| Błędy w konsoli (gość) | 11× naruszenie CSP `img-src` dla `thumbs.pawelperfect.pl`; `/_vercel/insights/script.js` 404 (Vercel Analytics na self-hoście) |
| Prefetch RSC Next.js | **~10 żądań do serwera na wizytę** (`/?_rsc`, `/?v=czesc`, `/?v=jj`, `/?v=dla-patronow`, `/?v=test-transkodowania`, `/channel/polutek`, `/regulamin`, `/polityka-prywatnosci`), w dwóch rundach |
| Rozgrzewanie w bezczynności (gość) | 3× `/api/media-source` (2× **403** dla zablokowanych filmów, 1× tworzy sesję odtwarzania) + 3× `/api/comments` |

### 2.3 Playwright: pierwsze wejście gościa (czasy od startu nawigacji)

| Zdarzenie | Desktop 1440×900, sieć bez dławienia | Mobile 390×844, Slow 4G, CPU ×4 |
|---|---|---|
| HTML responseStart | 2 669 ms (w tym ~1–2 s DNS/TLS tej maszyny) | 394 ms |
| Fonty Geist/GeistMono gotowe | +1,2–1,3 s | +4,4 s (konkurują z JS) |
| DOMContentLoaded | 4 083 ms | 4 335 ms |
| FCP | 4 776 ms | 5 256 ms |
| LCP (Chrome, bez uwzględnienia zasłonięcia) | 5 328 ms (H1) → 16 516 ms (video) | 5 640 ms (H1) |
| `get-session` start | 5 161 ms | 5 694 ms |
| `media-source` start | 6 282 ms | 7 011 ms |
| hls.js z jsDelivr | 9 008 ms (+1 541 ms) | 8 387 ms (+1 544 ms) |
| **Bramka (królik) widoczna** | **7 389 ms** (limit czasu, nie gotowość) | **7 770 ms** (limit czasu) |
| Pierwszy segment (360p, test pasma, 557 KB) | 11 709 ms (+502) | 10 744 ms (+3 118) |
| Segment 540p #0 (865 KB) | 12 648 ms (+545) | 14 210 ms (+4 380) |
| **Pierwsza klatka wideo** | **16 360 ms** | **20 980 ms** |
| Długie zadania (>50 ms) | 127 zadań, łącznie 11,1 s w ~24 s (desktop: deszcz Matrix ~7 tys. `fillText`/klatkę) | 42 zadania, 4,6 s; pierwsze 510 ms (hydratacja) |
| CLS (cała sesja) | 0,0045 | 0,0086 |
| Liczba elementów-szkieletów w DOM (oś) | 0 → 23 (SSR) → 2 → 0 → 21 (szkielet komentarzy po załadowaniu chunka) → 0 przy 7,9 s | 0 → 23 → 0 → 21 → 0 przy 8,8 s |
| Plakat w odtwarzaczu | `<img>` zablokowany przez CSP (`naturalWidth 0`) → czarne tło | to samo |

### 2.4 Odświeżenie w tej samej karcie (bramka pominięta) i przełączenie filmu (desktop)

| Zdarzenie | Wartość |
|---|---|
| Preloader znika (hydratacja) | 902 ms |
| Szkielety widoczne | 23 przy 417 ms → 25 → 2 → 21 przy 1 130 ms → 0 przy **1 842 ms** |
| Element `<video>` | 2 091 ms |
| Pierwsza klatka wideo | **9 691 ms** (bez bramki użytkownik ogląda czarny odtwarzacz ~7 s) |
| Przełączenie filmu po 400 ms hoveru: klik → poster/nowy `<video>` | 583 ms (blokada głównego wątku) |
| klik → `master.m3u8` | 796 ms |
| klik → pierwsza klatka | **3 307 ms** |
| Żądania przy przełączeniu | plan i komentarze już rozgrzane (dobrze); 6× zablokowany CSP poster; manifest + index + init + 18 segmentów 360p w 5 s (bufor 30 s) |

---

## 3. Oś czasu

### 3.1 Pierwsze wejście, gość (`/pl`)

1. **Middleware** (`middleware.ts:98-105`, `:209`): rewrite `/`→`/pl`, CSP generowane per żądanie.
2. **Serwer** (`app/[locale]/(home)/page.tsx`): `generateMetadata` (`:42`) i `Home` (`:81`) wołają `getHomeContentCached()`, a potem `HomeExperience` (`app/components/home/HomeExperience.tsx:46-53`) woła je trzeci raz. `getHomeContentCached` to zwykły passthrough (`lib/modules/channel/application/home-content.loader.ts:92-94`), bez `React.cache`. Każde wywołanie to szeregowo: `creator.findUnique` + admin `user.findFirst`, `getAllVideos` (`findMainChannel` + `video.findMany` + admin `user.findFirst` + fundraising), `getMainFeaturedVideo` (`findMainChannel` + `video.findFirst` (+ drugi) + admin `user.findFirst`). Do tego sidebar (`ChannelLayoutService.getSidebarLayout`: `findMainChannel` + `video.findMany`). Razem ~26 zapytań na żądanie gościa. Mimo to TTFB ~90–120 ms (lokalny Postgres).
3. **Strumień HTML**: najpierw `loading.tsx` → `HomeRouteLoading` → `SitePreloaderScreen` (na serwerze `sessionStorage` niedostępny, więc zawsze pełny preloader), potem cała strona pod nim. SSR renderuje: nawigację ze **szkieletem auth** (`Navbar.tsx:216-219`), Hero z `PremiumWrapper` w stanie ładowania (`PlayerLoadingState` z posterem, `PremiumWrapper.tsx:328`), playlistę z serwera (`initialLayout`, bez szkieletu), **szkielet komentarzy** (`ChannelHome.tsx:378` → `CommentLoadingSkeleton`).
4. **JS** 666 KB br, 29 plików. Na mobile ~4 s samego pobierania.
5. **Hydratacja**: `PageRevealGate` w fazie „covering”, `MatrixRain` zaczyna rysować pełny ekran co klatkę.
6. **Żądania po hydratacji** (kolejność i czy blokują widok):

| # | URL | Kiedy | Blokuje widok? | Na serwer? |
|---|---|---|---|---|
| 1 | `/api/auth/get-session` | po hydratacji | tak: `isLoaded=false` trzyma szkielet nawigacji, plan odtwarzania, sidebar effect, bramkę | **tak**: sesja jest już odczytana w `HomeExperience`; przekazać do klienta |
| 2 | `js.stripe.com/dahlia/stripe.js` (+ controller/shared/iframe) | import modułu | nie, ale zabiera pasmo i CPU | usunąć z pierwszego widoku |
| 3 | `/api/media-source/:hero` | po (1) | tak (odtwarzacz) | częściowo: plan dla PUBLIC można wyliczyć w RSC (tokeny per-widz, bez cache) |
| 4 | `/api/comments?videoId=…` | po załadowaniu chunka `EmbeddedComments` (`ssr:false`) | tak (szkielet komentarzy, klucz `comments` bramki) | **tak**: pierwsza strona komentarzy w RSC jako `initialData` |
| 5 | `cdn.jsdelivr.net/npm/hls.js@^1.5.0` | przy montażu `MediaPlayer` | tak (pierwsza klatka) | nie; ale do bundla/chunka z preloadem |
| 6 | manifest + test 360p + 540p | po (5) | tak | preload manifestu można zacząć wcześniej |
| 7 | ~10× prefetch RSC `?_rsc` | po hydratacji | nie | wyłączyć (`prefetch={false}`) |
| 8 | 3× `/api/media-source` + 3× `/api/comments` (idle) | po bootcie | nie | dla gościa pominąć filmy zablokowane |
| 9 | `/_vercel/insights/script.js` | po hydratacji | nie | 404, usunąć |
| 10 | `/api/videos/<upcoming>/thumbnail` 2× + `/_next/image` | obrazki playlisty | nie | cache w CF |

7. **Bramka**: `allReady` wymaga `authLoaded` + dekodowania postera (zawsze „gotowe” przez błąd CSP) + `player` (pierwsza klatka **i** 3 s bufora) + `comments`. W praktyce wygrywa limit 6 s (`PageRevealGate.tsx:177`, `:282-292`), a długie zadania przesuwają go do 7,4–7,8 s. Potem animacja pisania 23 znaków × 95 ms + 700 ms (`MatrixGatePrompt.tsx:47-78`): przycisk aktywny po ~3 s więcej, czyli **~10–11 s** od wejścia.
8. **Klik**: `polutek:gate-enter` → przewinięcie wideo do 0 i włączenie dźwięku (`VideoPlayer.tsx:165-174`), blur-fade 700 ms. Jeśli wideo jeszcze nie gra (typowe), odtwarzacz jest czarny, bo poster zablokowany.
9. **Po bramce**: Google One Tap (`gsi/client` 102 KB), heartbeat telemetrii, `AppVersionCheck` co 60 s.

### 3.2 Pierwsze wejście, zalogowany (z kodu; nie logowałem się)

Jak wyżej, plus na serwerze: `getOrCreateCurrentUser` (szeregowo, `HomeExperience.tsx:99`) + 6 zapytań równolegle (`:103-123`), w tym drugi raz `user.findUnique` w sidebarze (`channel-layout.service.ts:50`). Po stronie klienta dodatkowo:
- `Navbar`: szkielet 2 kółek → avatar + `UserMenu` po `get-session`; potem `/api/user/profile` (`Navbar.tsx:54-77`) przełącza `isAdmin/isPatron` (drugie dociągnięcie).
- `Hero`: stan polubienia z serwera jest ignorowany, dopóki klient nie zna `userId` (`Hero.tsx:73-93`: `userId ? initialInteraction.liked : false`), więc kciuk „zapala się” po `get-session`.
- `SidebarPlaylist`: kafelek premiery renderowany na SSR jako ściana logowania (`isSignedIn=false`), po auth przełącza się na „PREMIERA” (`SidebarPlaylist.tsx:162-164`).
- `AccessLockOverlay`/`CockpitComingSoon` dla premier: wszystko w bundlu startowym (import statyczny `AccessLockOverlay.tsx:8`), ~1,25 tys. linii kodu kokpitu ładowane także dla gości.
- `AuthLifecycleProvider` synchronizuje język po zalogowaniu.

### 3.3 Przełączenie filmu (desktop, po hoverze)

hover → `warmVideo` (plan + poster + komentarze) → klik → `handleVideoSelect` (`ChannelHome.tsx:276-301`), `history.pushState`, render Hero z animacją `fade/slide` (`:330-333`) i nowym `PremiumWrapper` → plan z cache (dobrze) → nowy `MediaPlayer` (`key`) → hls.js już w pamięci → manifest (+796 ms od kliku) → index → init → seg 0 → klatka po **3,3 s**. Poster zablokowany przez CSP (6 błędów w tej chwili), więc 3 s czarnego prostokąta. ~0,6 s blokady wątku zaraz po kliku (re-render Hero + komentarzy + framer-motion).

Tworzenie sesji odtwarzania przy hoverze/bezczynności: zysk istnieje (plan gotowy przy kliku, oszczędza ~150–300 ms), ale koszt to wiersz `VideoPlaybackSession` na każdy hover i 3 na każdą wizytę (sprzątany cronem po 30 dniach), a dla gościa 2 z 3 to 403 dla filmów, o których klient wie, że są zablokowane. Lepszy kompromis w §5 (LOAD-13).

---

## 4. Wszystkie szkielety i spinnery w części publicznej, z planem usunięcia

| # | Miejsce (plik:linia) | Kiedy widoczny | Jak wyeliminować |
|---|---|---|---|
| S1 | `app/components/Navbar.tsx:216-219` (2× `Skeleton` 38 px) | SSR i do `get-session` (każde wejście; widoczny przy odświeżeniu) | Przekazać sesję z serwera (`HomeExperience` już ją ma) do `AuthSessionProvider` i zasilić `authClient` (nanostore `$sessionSignal`/atom sesji) przed hydratacją; `isLoaded=true` od pierwszego renderu. Gość od razu widzi „ENTER”, zalogowany avatar. |
| S2 | `app/components/ChannelHome.tsx:30-32, 378` (`CommentsMountPlaceholder` → `CommentLoadingSkeleton`) | SSR do montażu klienta | Usunąć `dynamic(..., { ssr:false })` dla `EmbeddedComments` (`:26-28`) i renderować na serwerze z danymi pierwszej strony. |
| S3 | `app/components/comments/EmbeddedComments.tsx:52-70, 439-440` (`CommentsLoadingState`: spinner „Rozgrzewamy dyskusję…” + szkielet) | po chunku do odpowiedzi `/api/comments` | Pierwsza strona komentarzy z serwera jako `initialData` dla `useInfiniteQuery` (`useComments.ts:182-194`) lub `HydrationBoundary` z TanStack Query; przy zmianie sortowania trzymać poprzednią listę (`placeholderData: keepPreviousData`) zamiast szkieletu. |
| S4 | `app/components/channel/SidebarPlaylist.tsx:322-345` (3 sekcje szkieletów) | tylko gdy brak `initialLayout`, przy zmianie viewera (logowanie/wylogowanie) i przy premierze (`setLayout(null)` w `:119-121`) | Nie zerować układu przy refetchu: trzymać stary `layout` do czasu nowego. Po zasileniu sesji z serwera (S1) refetch na starcie nie wystąpi. |
| S5 | `app/components/PlayerLoadingState.tsx:27-72` (`PlayerPosterLoading`: poster + spinner po 450 ms) | przed planem odtwarzania i do pierwszej klatki | Najpierw naprawić CSP (LOAD-01), żeby był poster, nie czerń. Potem plan dla Hero w RSC (LOAD-07) i preload manifestu (LOAD-08); spinner tylko po 1 s. |
| S6 | `app/components/PlayerLoadingState.tsx:80-125, 148+` (`PlayerLoadingIndicator` „Już podaję film…”) | gdy brak `posterUrl` (miniatury w playliście, `variant=thumbnail`) | Zostawić tylko jako awaryjny; z posterem nie występuje. |
| S7 | `app/components/VideoPlayer.tsx:184-191` (poster przed montażem) | jedna klatka po planie | OK po naprawie CSP. |
| S8 | `app/components/preload/SitePreloaderScreen.tsx` + `MatrixRain.tsx` (pełny ekran) | pierwsze wejście w sesji karty | Zmienić w czystą nakładkę bramki bez fazy „covering” (LOAD-05). |
| S9 | `app/[locale]/(home)/loading.tsx` → `HomeRouteLoading.tsx:14-17` | strumień SSR pierwszego wejścia; przy nawigacji klienckiej w sesji zwraca `null` (biały/pusty ekran do RSC) | Po wprowadzeniu cache publicznej części (LOAD-09) loading może zostać tylko jako tło bramki; dla nawigacji w sesji: zachować poprzednią treść (`useTransition` / `<Link>` bez loading boundary). |
| S10 | `app/loading.tsx` (pusty ekran `min-h-[100dvh]`) | trasy bez własnego `loading` (`/[locale]/search`, `/[locale]/watch/[slug]`, `/` redirect) | Usunąć dla tras, które da się wyrenderować szybko; dla wyszukiwarki zostawić stronę i podmienić wyniki. |
| S11 | `app/[locale]/{regulamin,polityka-prywatnosci,terms,privacy-policy}/loading.tsx` (`LegalDocSkeleton`) | nawigacja kliencka do dokumentu prawnego (dynamiczny render ~110 ms + RTT) | Zrobić strony prawne statycznymi (`generateStaticParams` + bez dynamicznych API; obecnie `no-store`), usunąć `loading.tsx`; prefetch przy hoverze stopki. |
| S12 | `app/channel/[slug]/loading.tsx` (`ChannelPageSkeleton`) | nawigacja do strony kanału (`revalidate = 60`) | Po ISR odpowiedź jest z cache; usunąć `loading.tsx` lub zostawić tylko na zimny start. |
| S13 | `Hero.tsx:265, 336, 382` i `SidebarPlaylist.tsx:263-281` (wartości zależne od `mounted`: „1234” → „1,2 tys.”, „1234” → „1 234”, pusta data względna → „3 miesiące temu”) | po hydratacji | Formatować na serwerze tym samym `Intl` z jawnie podaną strefą/locale (deterministycznie) albo `suppressHydrationWarning` na tekście; datę względną liczyć od `now` przekazanego z serwera. |
| S14 | `CommentComposer.tsx`, `DonationBox.tsx`, `CheckoutModal.tsx`, `support/Tip*` (spinnery akcji) | po akcji użytkownika | OK (odpowiedź na akcję, nie ładowanie strony). |
| S15 | `app/sso-callback/page.tsx` (spinner) | powrót z Google | OK. |

---

## 5. Znaleziska

Skala: P1 = widocznie psuje cel „gotowe naraz” albo marnuje sekundy; P2 = istotne; P3 = drobne. Nakład S/M/L. Zysk szacowany z pomiarów w §2.

**LOAD-05 · P1 · Bramka czeka do 6 s, a potem jeszcze ~3 s animacji, zanim da się kliknąć**
- Pliki: `app/components/preload/PageRevealGate.tsx:177, 271-297`, `MatrixGatePrompt.tsx:47-78`, `VideoPlayer.tsx:74, 158-161`.
- Problem: faza „covering” czeka na `auth` + poster + `player` (pierwsza klatka i 3 s bufora) + `comments`. Zmierzone: zawsze kończy limit (7,4 s desktop / 7,8 s mobile, bo długie zadania opóźniają timer), a „gotowość” wideo przychodzi 9–13 s później. Potem 2,2 s pisania + 0,7 s → przycisk po ~10–11 s. Koszt dostępności: `role="status"` na zasłonie, `aria-label` „Ładowanie strony…” zamiast nazwy akcji; `body overflow:hidden`; przycisk `aria-label="Enter"` także w PL. SEO: treść jest w HTML, więc indeksacja OK; LCP liczony przez Chrome pod zasłoną (5,3–5,6 s), czyli metryki nie oddają tego, co widzi użytkownik.
- Naprawa: bramka jako czysta nakładka od pierwszego malowania (napis i przycisk w HTML/CSS; animacja pisania przez CSS `steps()`), przycisk aktywny po hydratacji, bez fazy „covering” i bez `waitFor`. Czas patrzenia na bramkę wykorzystać na: preload manifestu HLS + pierwszego segmentu (`<link rel=preload as=fetch crossorigin>` po planie z RSC), dekodowanie postera, `import('hls.js')`, czcionki. Klik odsłania stronę, która była gotowa pod spodem; jeżeli wideo nie gra, widać poster (po LOAD-01).
- Zysk: przycisk dostępny ~1 s po FCP zamiast ~10 s (−6 do −9 s czekania). Nakład M. Pewność: wysoka.

**LOAD-11 · P2 · Ponowne wejście w tej samej karcie pokazuje surowe ładowanie**
- Pliki: `PageRevealGate.tsx:184-203, 255-257`, `HomeRouteLoading.tsx:14-17`.
- Problem: po pierwszej bramce `sessionStorage` pomija ją przy odświeżeniu. Zmierzone przy reloadzie: szkielety do 1,84 s, czarny odtwarzacz do 9,7 s. Do tego SSR zawsze renderuje preloader (serwer nie zna `sessionStorage`), a klient od razu startuje z `phase="done"`: niezgodność hydratacji i znikający ekran bez animacji.
- Naprawa: wyeliminować przyczyny (LOAD-01/02/03/06/07, S1–S4), bo bramka nie może ich zasłaniać przy każdej wizycie. Stan „bramka już była” trzymać w ciasteczku sesyjnym, żeby serwer wiedział, czy renderować preloader (zgodny SSR i hydratacja).
- Zysk: brak migania przy odświeżeniu. Nakład M (po pozostałych). Pewność: wysoka.

**LOAD-12 · P2 · Dokumenty prawne i miniatury bez cache**
- Pliki: `app/[locale]/regulamin/page.tsx` i 3 pozostałe, ich `loading.tsx`; reguły Cloudflare.
- Problem: `/pl/regulamin` `no-store`, ~110 ms renderu na żądanie, a przy nawigacji klienckiej szkielet (S11). `/_next/image` i `/api/videos/*/thumbnail` mają poprawne nagłówki, ale CF ich nie cache’uje (`DYNAMIC`), więc każdy wariant obrazka liczy sharp na 2 vCPU (zmierzone 346 ms MISS).
- Naprawa: `generateStaticParams` dla `[locale]` w stronach prawnych i `dynamicParams = false` (upewnić się, że root layout nie czyta cookies/headers dla tych tras; `resolveInitialLanguage` z `TEMP_FORCE_ENGLISH` zwraca wcześnie, ale po wyłączeniu flagi czyta `auth()`/cookies). Reguła Cache Rules w Cloudflare: `/_next/image*` (Eligible for cache, respect origin, z kluczem cache po `Accept`, albo prościej `images.unoptimized` dla hosta R2 i serwowanie gotowych wariantów z `thumbs.pawelperfect.pl`), `/api/videos/*/thumbnail` (respect origin `s-maxage`). Usunąć `vary: rsc,…` z odpowiedzi obrazkowych.
- Zysk: dokumenty prawne natychmiast (cache CF), miniatury z brzegu CF. Nakład S–M. Pewność: wysoka.

**LOAD-13 · P2 · Rozgrzewanie: sesje odtwarzania przy hoverze i 403 dla gościa**
- Pliki: `AppPreloadProvider.tsx:130-204, 269-280`, `SidebarPlaylist.tsx:165-185`.
- Problem: każda wizyta tworzy do 3 dodatkowych `VideoPlaybackSession` (idle), każdy hover kolejną; gość dostaje 2× 403 za filmy, o których klient wie, że są zablokowane (`isLocked`/tier).
- Naprawa: nie rozgrzewać planu dla `isLocked`/premier u gościa; rozdzielić plan na „lekki” (dostęp + URL manifestu + token, bez sesji) i tworzenie sesji przy pierwszym evencie `PLAY_STARTED`; przy hoverze dodatkowo preload manifestu i `init.mp4` (`fetch` z `priority:'low'`), co realnie skraca przełączenie (manifest +796 ms od kliku w pomiarze).
- Zysk: przełączenie ~−0,8 s; mniej zapisów w bazie. Nakład M. Pewność: średnia.

**LOAD-14 · P2 · Deszcz Matrix obciąża główny wątek w najgorszym momencie**
- Plik: `app/components/preload/MatrixRain.tsx:120-153`.
- Problem: pełne przerysowanie płótna co klatkę, ~7 tys. `fillText` na klatkę przy 1440×900 (102 kolumny × 71 wierszy), w czasie hydratacji, fetchy i startu hls.js. Desktop: 127 długich zadań, 11,1 s w ~24 s.
- Naprawa: rysować tylko głowy i zmienione komórki (zanikanie przez półprzezroczysty `fillRect`), limit 30 fps, atlas glifów (`drawImage`) albo `OffscreenCanvas` w workerze; pauza na czas hydratacji (start po `requestIdleCallback`).
- Zysk: kilka sekund CPU na słabszych urządzeniach, szybsza hydratacja i INP kliknięcia bramki. Nakład S–M. Pewność: wysoka.

**LOAD-18 · P3 · Zmiany tekstu po hydratacji (`mounted`)**
- Pliki: `Hero.tsx:265, 336, 382`, `SidebarPlaylist.tsx:263-281`.
- Problem: liczby i daty zmieniają format po montażu; pusty `<span>` daty względnej dostaje wysokość dopiero po montażu (mikroprzesunięcie w playliście).
- Naprawa: patrz S13. Nakład S. Pewność: wysoka.

**LOAD-19 · P3 · Język: przemaskowany adres `/` zawsze w EN**
- Pliki: `lib/i18n/server-language.ts:31-34` (`TEMP_FORCE_ENGLISH`), `app/components/Providers.tsx:95-97`, `UrlMask.tsx`.
- Problem: `UrlMask` zamienia `/pl` (i `/en`) na `/`; odświeżenie `/` renderuje polską trasę (`/pl` przez rewrite) z angielskim UI (zmierzone: po reloadzie „Search”, „ENTER”, „views”). Polski widz po odświeżeniu dostaje inną stronę niż przed chwilą (zmiana języka to pełny „przeskok” treści).
- Naprawa: przy maskowaniu zachowywać język w ciasteczku `app-language` i czytać je w `resolveInitialLanguage` przed `TEMP_FORCE_ENGLISH` albo nie maskować prefiksu `/en`; temat zgłosić właścicielowi (flaga tymczasowa z rejestru).
- Nakład S. Pewność: wysoka (obserwacja), przyczyna z kodu.

**LOAD-20 · P3 · Brak Early Hints, preconnectów i Speculation Rules**
- Problem: brak 103; brak `preconnect` do `video.pawelperfect.com` i `thumbs.pawelperfect.pl`; brak spekulacji dla stron prawnych.
- Naprawa: włączyć Early Hints w Cloudflare (Speed → Optimization) po poprawie nagłówka `Link` (Geist + CSS + `preconnect` wideo); React 19 `preconnect()` w `HomeExperience`; dla stron prawnych (po LOAD-12) `<script type="speculationrules">` z `prefetch` przy `moderate` eagerness. Nie stosować `prerender` dla home (tworzy sesje odtwarzania).
- Zysk: ~100–300 ms na zimnym wejściu. Nakład S. Pewność: średnia.

**LOAD-21 · P3 · Konfiguracja serwera**
- Obserwacje: `x-powered-by: Next.js` (wyłączyć `poweredByHeader:false`), CSP generowane w middleware per żądanie (koszt mały), kompresja br/zstd robi Cloudflare (dobrze; w Node nie trzeba `compress`). Brak danych o pamięci kontenera (nie logowałem się na serwer). Zalecenia: `NODE_OPTIONS=--max-old-space-size` dopasowane do RAM, `keepAliveTimeout` > timeout tunelu (cloudflared utrzymuje połączenia), cache `/_next/image` na dysku trwałym między deployami.
- Nakład S. Pewność: niska–średnia (bez dostępu do serwera).

---

## 6. Docelowa architektura ładowania „wszystko gotowe naraz”

### Zasada
Serwer w jednym żądaniu oddaje **kompletny widok** (nawigacja w poprawnym stanie auth, Hero z posterem i planem odtwarzania, playlista, pierwsza strona komentarzy, stan lajków, właściwy język). Klient niczego nie „dociąga” do pierwszego widoku; po hydratacji tylko zaczyna grać wideo, które było rozgrzewane od pierwszego bajtu HTML. Bramka to nakładka, która nie czeka na nic.

### Warstwy
1. **Cache publiczny (Next 16 Cache Components)**: `cacheComponents: true`; `loadHomeContent`, `getSidebarLayout` (bez widza), strona kanału, dokumenty prawne jako `'use cache'` z `cacheTag('videos' | 'channel' | 'legal')` i `cacheLife`. Inwalidacja `revalidateTag` w use case’ach admina. Część per-widz w `<Suspense>` z danymi, które przychodzą w tym samym strumieniu (PPR: statyczna powłoka + dziury dynamiczne), bez widocznego fallbacku, bo dane per-widz to kilka prostych zapytań (< 20 ms).
2. **Per-widz w RSC**: sesja (`auth()` raz, `React.cache`), lajki/subskrypcja, `isLocked`, plan odtwarzania Hero (sesja + token, nigdy w cache; HTML `private, no-store` jak dziś), pierwsza strona komentarzy z polem `viewer` (TanStack `HydrationBoundary`).
3. **Klient**: `AuthSessionProvider` zasilony z serwera (brak `get-session` na starcie); `AppPreloadProvider` z rekordem planu Hero od razu `ready`; `EmbeddedComments` renderowane na serwerze; `useComments` z `initialData` i `keepPreviousData`; `SidebarPlaylist` nie czyści układu przy refetchu.
4. **Wideo**: hls.js z bundla (chunk z `modulepreload`), `testBandwidth:false`, `startLevel` jawny, `<link rel=preload as=fetch>` manifestu i `init.mp4` pierwszego wariantu w `<head>` (React 19 `preload`), `preconnect` do `video.pawelperfect.com`; krótszy pierwszy segment w enkoderze. Przy hoverze: plan bez sesji + manifest + init. Sesja odtwarzania tworzona przy starcie odtwarzania.
5. **Bramka**: SSR-owa nakładka (CSS, bez JS do pierwszego wyglądu), przycisk aktywny po hydratacji, brak `waitFor`; deszcz w `OffscreenCanvas`/30 fps; o tym, czy pokazać, decyduje ciasteczko sesyjne (zgodny SSR).
6. **Brzeg (Cloudflare)**: Cache Rules dla `/_next/image*`, `/api/videos/*/thumbnail`, `/manifest.json` (krótki TTL), statycznych plików `public/` (długi TTL + wersjonowanie nazw); Early Hints; Tiered Cache dla R2/Workera HLS; HTML home zostaje `no-store` (per-widz).
7. **JS**: < 350 KB br na starcie: dynamiczne `AuthModal`, `CheckoutModal/DonationBox/SupportModal` (Stripe dopiero tam), kokpit premier, `framer-motion` tylko w miejscach interakcji.

### Oczekiwany efekt (szacunek)
| Metryka | Teraz (zmierzone) | Cel |
|---|---|---|
| Przycisk bramki aktywny | ~10–11 s | ~1–1,5 s po FCP |
| Strona pod bramką kompletna (bez szkieletów) | 7,9 s (desktop) / 8,8 s (mobile), przy reloadzie 1,8 s ze szkieletami | w pierwszym HTML |
| Pierwsza klatka wideo | 16,4 s desktop / 21,0 s Slow 4G | ~3–4 s desktop / ~7–9 s Slow 4G (po LOAD-01..07) |
| Przełączenie filmu → klatka | 3,3 s, czarny ekran | poster natychmiast, klatka ~1–1,5 s |
| TTFB HTML (ciepło) | ~90–120 ms | ~40–60 ms |
| JS startowy | 666 KB br + ~800 KB Stripe + 189 KB hls.js z CDN | < 350 KB br + hls.js w chunku |

### Ryzyka
- Plan odtwarzania w RSC: token HLS i `playbackSessionId` w HTML są per-widz; HTML musi zostać `private, no-store` (jest), a odpowiedzi RSC dla home nigdy nie mogą trafić do cache CF ani Next. Plan odmowy bez URL (test już istnieje).
- `cacheComponents` zmienia semantykę całej aplikacji (dynamiczne API muszą być w `<Suspense>`); wprowadzać trasą po trasie, zaczynając od `React.cache` (LOAD-09 krok 1).
- Zasilenie sesji z serwera w root layout uczyni każdą stronę dynamiczną: robić to w layoutach tras dynamicznych.
- Bramka bez czekania: jeśli użytkownik kliknie szybko, a wideo nie gra, zobaczy poster (wymaga LOAD-01).

### Źródła (oficjalna dokumentacja; nie udało się pobrać ich w tej sesji z powodu limitu narzędzia wyszukiwania, więc warto je sprawdzić przed wdrożeniem)
- Next.js: Cache Components / `use cache` / `cacheTag` / `cacheLife`: https://nextjs.org/docs/app/api-reference/directives/use-cache , https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents ; prefetch `<Link prefetch>`: https://nextjs.org/docs/app/api-reference/components/link#prefetch ; `loading.js` i streaming: https://nextjs.org/docs/app/api-reference/file-conventions/loading ; `next/font` `preload`: https://nextjs.org/docs/app/api-reference/components/font
- React 19: `preload`/`preinit`/`preconnect`: https://react.dev/reference/react-dom/preload ; `cache`: https://react.dev/reference/react/cache
- TanStack Query SSR/Hydration: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- hls.js API (`testBandwidth`, `startLevel`, `startFragPrefetch`, `maxBufferLength`): https://github.com/video-dev/hls.js/blob/master/docs/API.md
- Vidstack HLS provider (`library`, ładowanie z CDN domyślnie): https://www.vidstack.io/docs/player/api/providers/hls
- Stripe.js `@stripe/stripe-js/pure` (bez ładowania przy imporcie): https://github.com/stripe/stripe-js#importing-loadstripe-without-side-effects
- Cloudflare Early Hints: https://developers.cloudflare.com/cache/advanced-configuration/early-hints/ ; Cache Rules: https://developers.cloudflare.com/cache/how-to/cache-rules/ ; Tiered Cache: https://developers.cloudflare.com/cache/how-to/tiered-cache/
- Core Web Vitals (LCP/INP/CLS, progi): https://web.dev/articles/vitals ; Speculation Rules: https://developer.chrome.com/docs/web-platform/prerender-pages ; `fetchpriority`: https://web.dev/articles/fetch-priority ; `content-visibility`: https://web.dev/articles/content-visibility

---

## 7. Kolejność małych PR-ów

1. **CSP: host R2 (i `api.dicebear.com`) w `img-src`** + test (LOAD-01). S. Natychmiast przywraca postery.
2. **hls.js z bundla + konfiguracja startu** (`library`, `testBandwidth:false`, `startLevel`, `startFragPrefetch`), usunięcie jsDelivr z CSP (LOAD-02, LOAD-03 część konfiguracyjna). S.
3. **Stripe leniwie** (`@stripe/stripe-js/pure`, `loadStripe` przy otwarciu, `DonationBox` dynamicznie) (LOAD-04). S.
4. **Drobne sprzątanie**: `<Analytics />` out, fonty bez preloadu (GeistMono, Space Grotesk), mała ikona, `poweredByHeader:false`, `prefetch={false}` w playliście (LOAD-10, LOAD-16, LOAD-17). S.
5. **`React.cache` dla loadera home + jedno zapytanie admin/kanał** (LOAD-09 krok 1). S.
6. **Bramka bez czekania** (nakładka od pierwszego malowania, CSS-owe pisanie, bez `waitFor`, ciasteczko zamiast `sessionStorage`) + tańszy deszcz Matrix (LOAD-05, LOAD-11 część, LOAD-14). M.
7. **Sesja z serwera do klienta** (`AuthSessionProvider` w dynamicznych layoutach) (LOAD-06, S1). M.
8. **Komentarze w RSC** (`initialData`, bez `ssr:false`, `keepPreviousData`) (S2, S3). M.
9. **Plan odtwarzania Hero w RSC + preload manifestu/`init.mp4` + preconnect** (LOAD-07, LOAD-08). M.
10. **Rozgrzewanie bez sesji i bez 403 dla gościa; manifest przy hoverze** (LOAD-13). M.
11. **Statyczne dokumenty prawne + reguły cache CF dla obrazków + Early Hints** (LOAD-12, LOAD-20). S–M (część w panelu Cloudflare).
12. **Odchudzenie JS startowego** (AuthModal/kokpit/framer dynamicznie) (LOAD-15). M.
13. **Formatowanie liczb/dat deterministycznie na serwerze; playlista bez zerowania przy refetchu** (S4, S13, LOAD-18). S.
14. **Cache Components / `use cache` z tagami** dla części publicznej (LOAD-09 krok 2). L.
15. **Enkoder: krótszy pierwszy segment** (LOAD-03 część enkodera). M.
16. **Język przy zamaskowanym `/`** (LOAD-19), po decyzji właściciela co do `TEMP_FORCE_ENGLISH`. S.

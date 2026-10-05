# Wynik napraw audytów 2026-10-03 (strona publiczna www)

Gałąź `fix/audits-www`, po scaleniu `origin/main` (c06d8b3f). Weryfikacja lokalna: testy dotknięte zmianami,
`tsc -p tsconfig.typecheck.json`, eslint (0 błędów), `quality:hotspots`, `npm run build`, `npm run admin:build`,
suite Postgres (49/49), pełny `npm run quality`.

## Naprawione w tej gałęzi
- **Frontend:** FE-07/08 (okno logowania, onboarding i kokpit premiery jako osobne chunki, rozgrzewane w bezczynności), FE-11 (bez
  `layouts/video.css` Vidstacka), FE-13 (czcionka Bowlby), FE-28 (11 martwych kluczy słownika), FE-29 (mapa strony dynamiczna, bez /search; robots
  bez localhost), FE-30/31 (jeden `viewport`, bez ręcznego `<head>`, ikony PNG 192/512/maskable, manifest, OG url/locale/twitter), FE-35/36
  (`<header>`, `<nav>`, skip link, etykiety i `type=search`, jeden `<main id="main">`), FE-37 (przyciski „więcej/mniej”), FE-41 (`alt=""` miniatur),
  FE-42 (zlokalizowane „Zamknij”), FE-44 (fokus pól logowania), FE-45 (tekst błędu bez fałszywej obietnicy), FE-46 (unikalne id ikon, 17 martwych ikon),
  FE-48/49 (martwe tokeny, klasy, blok fallbacków color-mix, `browserslist` do targetów Tailwind 4, martwe wpisy `tailwind.config.ts`),
  FE-51/53/54 (martwe komponenty, ~15 MB zasobów, `media-icons`).
- **Styl:** STY-07/08 (domyślny fokus także w oknach portalowych), STY-13 (przycisk WEJŚCIE 38 px), STY-16/17 (kontrast `--chan-muted`, serce twórcy),
  STY-36 (`color-scheme: light`).
- **Prywatność (inżynieria):** `GET /api/user/export` + przycisk w oknie konta (LEG-20, test); `docs/legal/STORAGE-INVENTORY.md` + test pilnujący kluczy pamięci i
  braku Stripe/One Tap przed działaniem widza (LEG-02/30).
- **Szkice prawne (nie opublikowane, do przeglądu prawnika):** `docs/legal/DRAFT-regulamin-reklamacje-dsa.md`, `docs/legal/DRAFT-polityka-prywatnosci-uzupelnienia.md`
  (DSA art. 11/12/14/16/17, UŚUDE art. 8, art. 399 PKE, EROD 2/2023). Źródła podają różne daty polskiej ustawy DSA: do sprawdzenia w Dz.U.
- **Testy:** poprawione typy w 5 testach, test color-mix i test linków auth dostosowane; usunięte testy martwego InstallAppMenu.

## Nieaktualne (naprawione wcześniej na main, usunięte z audytów)
FE-01/02/03/04/05/06/16/19/33, LOAD-01..04/06..10/15..17, LEG-01/04/05/09/21/25/28/29 oraz większość LOAD (sesja z serwera, plan odtwarzania i komentarze z serwera,
hls.js z bundla, Stripe `/pure`, statyczne dokumenty prawne, bez szkieletów).

## Zostawione, z powodem
- **Preloader/bramka** (FE-34, FE-26, LOAD-05/11/14): gałąź `feat/preloader-polish` przepisuje te pliki; naprawiać tam.
- **`typescript.ignoreBuildErrors: true` (FE-32)**: próba `false` nie przeszła, bo `next build` sprawdza też testy, a pełny `tsc -p tsconfig.json` ma ok. 30 błędów
  typów w testach cudzych obszarów (admin-analytics, admin-phase3, SidebarPlaylist-premiere, auth-lifecycle-language, ops). Wartość przywrócona; `npm run quality`
  (typecheck jak CI) nadal pilnuje kodu produkcyjnego. Do zrobienia: naprawić te testy, potem przełączyć na `false`.
- **middleware → proxy (FE-02 część)**: ostrzeżenie Next, ale rename dotyka testów, skryptów i Dockerfile; osobny PR.
- **FE-09/18/21/22/25/27/14/15/17/20/24** (budżet JS, Cache Components/PPR, jedna warstwa danych, magistrala zdarzeń, stan podglądu, podwójna playlista, monkey-patch fetch):
  duże przebudowy; UrlMask zostaje decyzją właściciela.
- **FE-23** (rola admina z serwera w Navbarze) i **FE-12** (wtyczka typography): sprawdzić po usunięciu starego admina.
- **FE-10** (framer-motion do CSS), **STY-01..06, 09..12, 14, 15, 18..35, 37..40** (rytm komentarzy, ramy modali, skale typografii/promieni/cieni, ikony):
  wymagają oceny wizualnej w przeglądarce; nie weryfikowalne tutaj.
- **LEG-02 (ocena prawna `__stripe_mid`/One Tap), LEG-03, 06, 07, 08, 10..19, 22..24, 26, 27**: decyzje właściciela/prawnika, zmiany bazy (poza zakresem) lub
  tekst prawny (tylko szkice). **LOAD-12/20**: reguły Cloudflare (panel), nie kod.
- **audit-tests.md**: nie ruszane poza usunięciem testów martwego kodu (większość flaky/martwych testów usunięto wcześniej na main).

## Nie zweryfikowano
Wygląd w przeglądarce (nawigacja, skip link, fokus, kontrast), działanie lazy chunków przy pierwszym kliknięciu logowania, `public/gallery` (usunięte po braku odwołań w kodzie;
stare `thumbnailUrl` w bazie niesprawdzone).

# Syndykacja: RSS, oEmbed i odtwarzacz do osadzania

Stan na 2026-10-19. Trzy publiczne powierzchnie, które pozwalają innym stronom i czytnikom korzystać z kanału bez logowania. Kod: moduł `lib/modules/syndication`, czyste pomocniki w `lib/embed/`, trasy w `app/`.
Żadnej zmiany schematu; nic z tego nie zmienia zasad dostępu do filmów (§4.4, §4.17 w `CLAUDE.md`).

## 1. Kanał RSS: `/channel/<slug>/feed.xml`

- Trasa `app/channel/[slug]/feed.xml/route.ts`. `<slug>` to stały slug kanału albo jego bieżący `@handle`. Adres jest **bez prefiksu języka** (proxy nie przepisuje go na `/pl/...`, `isChannelFeedPath()`).
- Lista: do 50 najnowszych filmów **`PUBLISHED`**, już wymagalnych (bez przyszłej daty publikacji i bez premiery, która jeszcze się nie odbyła), bez `REMOVED`, bez 18+ (`isAdult`, `AGE_RESTRICTED`), z kanału publicznie widocznego (`ACTIVE`/`LIMITED`, nie usunięty; inaczej 404). `UNLISTED`, `DRAFT` i `ARCHIVED` nigdy. Wybór robi czysta `selectFeedVideos()` (zapytanie tylko zawęża).
- Pozycja niesie wyłącznie: tytuł, link (`<base>/pl?v=<slug>`, ten sam adres kanoniczny co sitemap), `guid` (id filmu, `isPermaLink="false"`), `pubDate` i **krótki publiczny opis** (do 280 znaków, zwykły tekst). Film `LOGGED_IN`/`PAID` jest na liście, ale tylko w tej formie; miniaturę (`media:thumbnail`) dostaje tylko poziom `PUBLIC`.
- **Brak `<enclosure>`** i jakiegokolwiek adresu mediów: strumień jest chroniony (plan HLS per widz), czytnik otwiera film na stronie.
- Wszystko przez `escapeXml()` (pięć znaków specjalnych, znaki niedozwolone w XML 1.0 i samotne surogaty są usuwane). Adresy bezwzględne na `getBaseUrl()`.
- Nagłówki: `Content-Type: application/rss+xml; charset=utf-8`, `Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=600`, słaby `ETag` (SHA-1 treści), `Last-Modified` (data najnowszej pozycji, stabilna między przebudowami), `If-None-Match`/`If-Modified-Since` → 304 (`isNotModified()`). Limit 60/min na IP (429 z `Retry-After`).
- Autodiscovery: `<link rel="alternate" type="application/rss+xml">` w nagłówku strony kanału (`/[locale]/channel/[slug]`) i strony głównej/filmu (kanał główny).

## 2. oEmbed: `/api/oembed?url=&format=json`

- Trasa `app/api/oembed/route.ts`, publiczna w `middleware.ts`. `url` musi być adresem **tej witryny**: `/?v=<slug>`, `/<lang>?v=<slug>`, `/watch/<slug>`, `/<lang>/watch/<slug>` albo `/embed/<slug>` (host = `getBaseUrl()` lub jego odmiana z/bez `www`; `parseVideoSlugFromUrl()`).
- Odpowiedź: typ `video`, wersja `1.0`, `title`, `author_name`/`author_url` (kanał), `provider_name`/`provider_url`, `thumbnail_url` (+ wymiary 1280x720, miniatury są 16:9), `html` (iframe na `/embed/<slug>`), `width`/`height`. `maxwidth`/`maxheight` są respektowane (16:9, nigdy ponad limit; `computeEmbedSize()`), błędne wartości ignorowane.
- Kody: 200; **501** dla formatu innego niż JSON; 400 bez `url`; **404** dla wszystkiego, czego nie wolno osadzić (nieznany adres, `UNLISTED`, szkic, `REMOVED`, 18+, premiera przed czasem, ukryty kanał, poziom inny niż `PUBLIC`): jedno i to samo ciało, więc nic nie zdradza istnienia filmu. Reguła jest w jednym miejscu: `decideEmbed()` (`domain/embed-eligibility.ts`, czyta SUROWY `tier`, bo `PAID` musi pozostać niepubliczny).
- Nagłówki: `s-maxage=300`, `Access-Control-Allow-Origin: *` (dane publiczne), limit 60/min na IP.
- Autodiscovery: `<link rel="alternate" type="application/json+oembed">` na stronie filmu (`/?v=<slug>`), tylko gdy `isOembedDiscoverable()` (poziom `PUBLIC`, `PUBLISHED`, nie 18+, nie nadchodząca premiera).

## 3. Odtwarzacz do osadzania: `/embed/<slug>`

- Strona `app/embed/[slug]/page.tsx` (serwerowa, `force-dynamic`) + `EmbedPlayer.tsx`. Bez nawigacji i stopki; ten sam stos co strona (`PremiumWrapper` → plan z `/api/media-source/[videoId]` → `VideoPlayer`/hls.js). Plan i token nadal wystawia wyłącznie `PlaybackService` po `checkVideoAccess()` (§4.3); embed niczego tu nie omija.
- `getEmbedView()` zwraca: `embeddable` (poziom `PUBLIC`, `PUBLISHED`, wymagalny, nie 18+) → odtwarzacz; `site-only` (opublikowany, ale `LOGGED_IN`/`PAID`/18+/premiera przed czasem) → karta z tytułem i przyciskiem „Obejrzyj na {0}” (link na stronę, `target=_blank rel=noopener`), **nigdy odtwarzacz, plan ani token**; `unavailable` (brak, `UNLISTED`, szkic, usunięty, ukryty kanał) → neutralna karta „Film niedostępny”, identyczna dla filmu nieistniejącego i ukrytego.
- Odtwarzacz nie startuje sam (`VideoPlayer autoPlay={false}`, nowy opcjonalny prop; domyślnie `true`, więc zwykłe strony bez zmian) i startuje z dźwiękiem po kliknięciu widza. Pozycja wznowienia nie jest zapisywana ani czytana (nie ma bramy wejściowej).
- **Język:** `?lang=` → kraj (`CF-IPCountry`, tylko PL) → `Accept-Language` → angielski (`resolveEmbedLanguage()` w `lib/i18n/accept-language.ts`). Liczy to **proxy** i przekazuje w nagłówku żądania `x-pp-route-locale`, więc root layout nie czyta ciasteczka ani sesji, żeby wyrenderować osadzenie (`resolveDocumentLanguage()` zwraca nagłówek od razu).
- **Bez danych widza po stronie serwera:** strona nie woła `auth()` ani nie czyta ciasteczek. Po stronie klienta zostaje to, co ma cała witryna (odczyt sesji przez Better Auth, anonimowy `TelemetryBeacon`); w ramce obcej strony ciasteczka sesji (SameSite=Lax) zwykle w ogóle nie są wysyłane, więc osadzenie działa jak gość.
- Limit 120/min na IP liczony na stronie; po przekroczeniu widz dostaje neutralną kartę (strona serwerowa nie ustawia kodu 429), awaria limitera nie psuje osadzeń. `/api/media-source` ma własny limit (60/min).
- `noindex`: meta `robots` + `X-Robots-Tag: noindex, nofollow` z proxy (niezależnie od etapu witryny). `UrlMask` nie zwija adresu `/embed/...`.

## 4. Nagłówki: gdzie wolno ramkować (jedyny wyjątek od `frame-ancestors 'none'`)

- **CSP, jedno miejsce:** `generateCSP({ embeddable })` w `lib/utils/security.ts`. Domyślnie `frame-ancestors 'none'`; `embeddable: true` daje `frame-ancestors *` i **nic więcej się nie zmienia**. `middleware.ts` przekazuje `embeddable` wyłącznie dla `isEmbedPath()` (`/embed/<slug>`, dokładnie jeden segment).
- **`X-Frame-Options`:** `next.config.mjs` ustawia `DENY` teraz osobnym wpisem ze źródłem `/((?!embed/).*)`, czyli na wszystkim poza `/embed/*` (stary nagłówek `DENY` unieważniłby `frame-ancestors *`). Pozostałe nagłówki bezpieczeństwa nadal obejmują każdą ścieżkę.
- Pilnuje tego `tests/unit/syndication/framing-headers.test.ts` (CSP, proxy dla `/embed/x` i reszty tras, wpis `X-Frame-Options` w `next.config.mjs`).

## 5. Snippet do „Udostępnij → Osadź”

`buildEmbedSnippet()` (`lib/embed/embed-snippet.ts`, czysta, bezpieczna dla klienta) zwraca kod `<iframe>` (src na `/embed/<slug>`, `allow="fullscreen; picture-in-picture"`, `loading="lazy"`, `referrerpolicy`), z escape'owaniem atrybutów; ten sam helper buduje pole `html` w oEmbed. Przycisku w interfejsie jeszcze nie ma. Przed pokazaniem opcji „Osadź” w UI sprawdź poziom filmu (`PUBLIC`), bo strona osadzenia i tak odmówi innym.

## 6. Mapa plików

| Plik | Rola |
|---|---|
| `lib/embed/paths.ts` | `isEmbedPath`, `isChannelFeedPath`, `buildEmbedPath`, `buildChannelFeedPath` |
| `lib/embed/embed-snippet.ts` | rozmiar 16:9, `buildEmbedSnippet`, `parseEmbedDimension` |
| `lib/embed/discovery.ts` | adres autodiscovery oEmbed, `isOembedDiscoverable` |
| `lib/i18n/accept-language.ts` | czysta negocjacja języka (współdzielona z `server-language.ts` i proxy) |
| `lib/modules/syndication/` | `rss.ts`, `oembed.ts`, `embed-eligibility.ts`, `conditional.ts`, przypadki użycia i zapytania |
| `app/channel/[slug]/feed.xml/route.ts`, `app/api/oembed/route.ts`, `app/embed/[slug]/` | trasy |
| `tests/unit/syndication/` | RSS, oEmbed, dostęp do osadzenia, snippet, nagłówki ramkowania |

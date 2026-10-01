# 02 — Dostarczanie HLS z R2 przez CDN Cloudflare (skrócone)

Stan: 2026-10-01. **Badanie przerwane decyzją właściciela**: HLS nie jest teraz
priorytetem (filmy testowe zostają na Muxie). Ten dokument zapisuje to, co
zdążyliśmy sprawdzić; reszta jest w „Otwartych pytaniach". Kontekst:
`docs/architecture/serwerek.md` §3, §5, §7, §8; `CLAUDE.md` §4.3, §4.15.

> ### Rekomendacja dla nas (robocza, do potwierdzenia prototypem)
>
> **Token w ścieżce + reguła WAF `is_timed_hmac_valid_v0` + Transform Rule, która
> wycina token przed cache.** Plan Cloudflare **Pro**, bez Workera na każdy plik.
>
> - URL odtwarzania: `https://media.<domena>/t/<ts>-<mac>/v/<videoId>/<wersja>/master.m3u8`.
> - W manifestach **wyłącznie względne** ścieżki (`720p/index.m3u8`, `seg_001.m4s`).
>   Wtedy każde podrzędne żądanie samo dziedziczy `/t/<token>/` i działa to
>   **jednakowo w hls.js i w natywnym HLS Safari** (bez nagłówków, bez cookies,
>   bez przepisywania manifestów).
> - Podpis obejmuje **prefiks filmu** (`/v/<videoId>/<wersja>/`), nie pojedynczy plik.
> - WAF sprawdza token na **surowej** ścieżce (`raw.http.request.uri.path`), bo
>   Transform Rules działają przed WAF. Transform Rule usuwa `/t/<token>`, więc do
>   cache i R2 trafia czysta ścieżka i cache jest wspólny dla wszystkich widzów.
> - Token wydaje wyłącznie `PlaybackService.createPlaybackPlanWithContext()` po
>   sprawdzeniu dostępu i premiery (§4.3/§4.15); odmowa = brak URL-a.
> - TTL jest jednakowy dla wszystkich tokenów (literał w regule), np. 6 h. Przy
>   3-minutowych filmach wystarczy; po wygaśnięciu odtwarzacz pobiera nowy plan.
> - Koszt przy 10 mln odtworzeń: **~20–25 USD/mies. (Pro) + R2 ≈ 0** (niżej).
> - **To nie jest DRM**: zalogowany widz może skopiować URL na czas TTL i pobrać pliki.

## Kluczowe ustalenia (ze źródłami)

1. **Token WAF HMAC wymaga planu Pro lub wyższego** („requires a Cloudflare Pro,
   Business, or Enterprise plan"). Przykład z dokumentacji ma token w query
   (`?verify=<ts>-<mac>`), który musi być ostatnim parametrem. Format `MessageMAC`:
   wiadomość, separator, 10-cyfrowy timestamp, `-`, MAC (Base64; flaga `'s'` =
   URL-safe bez paddingu). Źródła:
   [WAF token auth](https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/),
   [functions](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/) (2026-10-01).
2. **`MessageMAC` można zbudować przez `concat()`/`substring()`**: oficjalny
   przykład podpisuje prefiks ścieżki,
   `concat(substring(http.request.uri.path, 0, 51), "?", http.request.uri.query)`.
   Źródło: [Require valid HMAC token](https://developers.cloudflare.com/waf/custom-rules/use-cases/require-valid-hmac-token/) (2026-10-01).
3. **Pro nie ma regexów** w regułach WAF ani w Transform Rules (dopiero Business).
   Limity Pro: 20 reguł WAF custom, 25 Transform Rules. Dlatego segmenty ścieżki
   mają stałą długość (`substring` po stałych offsetach) albo używamy
   `wildcard_replace()` (dozwolone tylko w wyrażeniach URL rewrite). Źródła:
   [WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/),
   [Transform Rules](https://developers.cloudflare.com/rules/transform/) (2026-10-01).
4. **Kolejność faz:** URL rewrite (`http_request_transform`), potem WAF custom,
   potem cache rules. `raw.http.request.uri.path` to ścieżka „without any
   transformation". Reguły WAF custom „run before cache rules", więc blokują też
   żądania, które trafiłyby w cache. Źródła:
   [phases](https://developers.cloudflare.com/ruleset-engine/reference/phases-list/),
   [raw path](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/raw.http.request.uri.path/),
   [WAF + cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/waf-snippets/) (2026-10-01).
5. **Własne klucze cache (cookie, nagłówki, wybrane parametry) to Enterprise.**
   Free/Pro/Business mają tylko „Ignore/Sort query string". Token w query z
   „Ignore query string" też daje wspólny cache, ale wtedy token trzeba dopisywać
   do każdego segmentu (manifesty albo `xhrSetup`), a natywny Safari tego nie zrobi.
   Źródło: [cache keys](https://developers.cloudflare.com/cache/how-to/cache-keys/) (2026-10-01).
6. **Domyślny cache nie obejmuje `.m3u8`, `.ts`, `.m4s`, `.vtt`** (obejmuje `.mp4`),
   więc potrzebna jest Cache Rule „Eligible for cache" dla hosta wideo. Na Free/Pro
   Cloudflare honoruje `Cache-Control` z originu (nie da się tego wyłączyć). Range
   requests są obsługiwane z cache. Źródła:
   [default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/),
   [R2 + cache](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/) (2026-10-01).
7. **Smart Tiered Cache jest na wszystkich planach, bez dopłat**; dla R2 wybiera
   górną warstwę obok bucketu. **Cache Reserve nie działa dla R2** („Requests to R2
   public buckets … will not use Cache Reserve"), więc go pomijamy. Źródła:
   [tiered cache](https://developers.cloudflare.com/cache/how-to/tiered-cache/),
   [cache reserve](https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/) (2026-10-01).
8. **r2.dev trzeba wyłączyć**, inaczej bucket chroniony WAF-em zostaje publiczny
   przez r2.dev. Źródło: [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) (2026-10-01).
9. **CORS R2** działa na własnej domenie, ale dokumentacja nie wspomina
   `Access-Control-Allow-Credentials`. Wariant „cookie + hls.js" (wymaga
   `withCredentials`) jest więc niepewny; to kolejny powód, by token był w ścieżce.
   Źródło: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) (2026-10-01).
10. **Regulamin:** wideo przez CDN jest dozwolone, gdy jest hostowane w usłudze
    Cloudflare („Stream, Images, or R2"); warunki z 28.09.2026 mówią o „Paid Services
    (e.g., the Developer Platform, Images, and Stream)". Ryzyko kontaktu ze strony
    Cloudflare przy ~0,5 PB/mies. na Pro zostaje (serwerek.md §8). Źródła:
    [blog 2023-05-16](https://blog.cloudflare.com/updated-tos/),
    [service-specific terms](https://www.cloudflare.com/service-specific-terms-application-services/) (2026-10-01).
11. **Worker przed R2 (wariant B):** każde żądanie na trasie Workera jest płatne,
    nawet trafienie w cache („Workers runs before the Cloudflare cache"); 10 mln w
    cenie, potem 0,30 USD/mln. Nowy „Workers Cache" może zwrócić odpowiedź **bez
    uruchamiania Workera**, czyli z pominięciem sprawdzenia tokenu, jeśli klucz
    cache go nie obejmuje. Zonowe Cache Rules nie dotyczą cache Workera. Źródła:
    [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
    [Workers cache](https://developers.cloudflare.com/workers/cache/) (2026-10-01).
12. **Odtwarzacz:** Vidstack 1.15.6 (w repo) wybiera hls.js, gdy jest
    `ManagedMediaSource` lub `MediaSource` (więc także iPhone z iOS 17.1+), a w
    przeciwnym razie natywny HLS. **Domyślnie ładuje hls.js z jsDelivr**
    (`hls.js@^1.0.0`); przy wdrożeniu przypiąć wersję przez `library` (import), nie
    CDN (sprawdzone w `node_modules/vidstack`). Najnowsze hls.js: v1.7.3
    (2026-09-11). MMS na iPhonie wymaga wyłączonego AirPlay albo alternatywnego
    źródła AirPlay (hls.js ustawia `disableRemotePlayback`); z tokenem w ścieżce
    można podać natywny URL jako źródło AirPlay. Źródła:
    [WebKit Safari 17.1](https://webkit.org/blog/14735/webkit-features-in-safari-17-1/),
    [hls.js API](https://github.com/video-dev/hls.js/blob/master/docs/API.md),
    [releases](https://github.com/video-dev/hls.js/releases) (2026-10-01).

## Szkic konfiguracji (niesprawdzony, do prototypu)

Ścieżka z tokenem: `/t/<10 cyfr ts>-<43 znaki MAC base64url>/v/<id>/<ver>/...`
(token ma 54 znaki; `id` i `ver` o stałej długości, np. cuid 25 znaków + `v001`).

Reguła WAF custom (Block) dla hosta `media.<domena>`:

```
(http.host eq "media.example.com" and not is_timed_hmac_valid_v0(
  "<SEKRET>",
  concat(substring(raw.http.request.uri.path, 57, 89), substring(raw.http.request.uri.path, 3, 57)),
  21600, http.request.timestamp.sec, 0, "s"))
```

Wiadomość to `/v/<id>/<ver>/` (offsety do przeliczenia), za nią `<ts>-<mac>`.
Aplikacja liczy `mac = base64url(HMAC-SHA256(sekret, wiadomość + ts))`.
**Do sprawdzenia:** czy `raw.*` i `concat` są akceptowane jako `MessageMAC`.

Transform Rule (URL rewrite, dynamic): warunek `starts_with(http.request.uri.path, "/t/")`,
ścieżka `wildcard_replace(http.request.uri.path, "/t/*/v/*", "/v/${2}")`.

Cache Rule dla hosta wideo: Eligible for cache, Edge TTL według nagłówków originu.
Nagłówki obiektów w R2: segmenty i init `public, max-age=31536000, immutable`
(ścieżki wersjonowane); `.m3u8` VOD też się nie zmienia w obrębie wersji, ale
ostrożnie `max-age=60`. Content-Type: `.m3u8` `application/vnd.apple.mpegurl`,
`.m4s` `video/iso.segment`, `init.mp4` `video/mp4`, `.ts` `video/mp2t`, `.vtt` `text/vtt`.

CORS R2:

```json
[
  {
    "AllowedOrigins": ["https://www.pawelperfect.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range"],
    "MaxAgeSeconds": 3600
  }
]
```

hls.js (VOD): `lowLatencyMode: false`, `capLevelToPlayerSize: true`,
`startLevel: -1` (z `testBandwidth`), `maxBufferLength: 30`,
`backBufferLength: 30`, `preferManagedMediaSource: true`; ponawianie segmentów
przez `fragLoadPolicy` (stare `fragLoadingMaxRetry` jest deprecated). Na 403
(wygasły token) pobrać nowy plan z `/api/media-source` i podmienić źródło.

## Koszty (10 mln odtworzeń, ~350 mln żądań/mies.)

- Wariant zalecany: Pro **20 USD/mies. przy płatności rocznej lub 25 USD
  miesięcznie** (tylko źródła wtórne, np.
  [blazingcdn](https://blog.blazingcdn.com/en-us/cloudflare-pricing-2026-free-pro-business-enterprise-explained);
  oficjalnej strony cennika nie udało się odczytać). R2 Class B tylko przy miss:
  przy 1% miss to 3,5 mln, mniej niż 10 mln darmowych, czyli **0 USD**. Wzór:
  `max(0, żądania × miss% − 10 mln) × 0,36 USD/mln`. Egress z R2 = 0.
- Wariant B (Worker na każdy plik): `(350 − 10) × 0,30 + 5 ≈ 107 USD` plus CPU.

## Otwarte pytania

- Czy `is_timed_hmac_valid_v0` przyjmuje `concat(...)` na `raw.http.request.uri.path`
  (oficjalny przykład używa `http.request.uri.path`).
- Czy klucz cache po URL rewrite to przepisana ścieżka (nie znaleziono tego wprost
  w dokumentacji).
- `wildcard_replace` na Pro z dwoma `*`: dostępność i limity.
- Odnawianie tokenu w natywnym Safari (bez hls.js nie złapiemy 403). Przy 3-minutowych
  filmach TTL jest dużo dłuższy niż film, więc raczej bez znaczenia.
- Tokeny dla anonimów (publiczne filmy) i limity nadużyć (serwerek.md §9.2).
- Ryzyko regulaminowe przy ~0,5 PB/mies. na Pro: regulamin nie podaje twardej granicy.

## Do zweryfikowania prototypem

1. Jeden film na R2, host `media.<domena>`, reguły jak wyżej: 200 z ważnym tokenem,
   403 z wygasłym lub obcym, `cf-cache-status: HIT` dla dwóch różnych tokenów.
2. hls.js (Chrome, Android, iPhone przez MMS) oraz natywny Safari na macOS i AirPlay.
3. Żądania Range i preflight CORS z `www.pawelperfect.com`.
4. Telemetria QoE do zbierania: czas startu, liczba i czas rebufferingu, przełączenia
   jakości, średni bitrate, błędy 403/5xx, odsetek MMS vs natywny HLS.

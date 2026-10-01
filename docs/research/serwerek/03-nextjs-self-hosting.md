# Next.js z Vercel na serwerek: co trzeba zrobić porządnie i co tracimy

Badanie z 2026-10-01. Dotyczy aplikacji z tego repo (Next.js 16.3.8, App Router, React 19) i serwera "serwerek" (Hetzner CPX22, nbg1: 2 vCPU, 4 GB RAM, Docker, Cloudflare Tunnel + Access, Caddy zainstalowany i wyłączony). Stan serwera: `docs/operations/SERWEREK.md`; pomiary aplikacji: tamże §14. Plan ogólny: `docs/architecture/serwerek.md`.

Oznaczenia: **[zweryfikowane]** = sprawdzone w kodzie tego repo albo w podanym źródle w dniu badania; **[niezweryfikowane]** = wiedza ogólna lub wniosek, którego nie sprawdzono testem ani w dokumentacji. Daty przy źródłach to "ostatnia aktualizacja" strony, jeśli strona ją podaje; dostęp do wszystkich: 2026-10-01.

> ## Rekomendacja dla nas
>
> 1. **Da się, i to bez przepisywania aplikacji.** Next.js na `next start`/standalone obsługuje wszystko, czego używamy (proxy/middleware, `next/image`, streaming, `after()`, ISR). Pomiar z §14: 59 renderów strony głównej/s lokalnie, RAM aplikacji do 240 MiB. To wystarcza z zapasem dla obecnego ruchu.
> 2. **Wdrożenie: zwykły Docker Compose + GitHub Actions.** Obraz budowany w CI (nie na serwerze: build potrzebuje ok. 3 GB sterty, a serwer ma 4 GB), wysyłany do GHCR z tagiem = SHA commita, na serwerze `docker compose pull` + skrypt `deploy.sh` z health checkiem. Bez Coolify/Dokku (zjadają RAM i CPU, które są naszym limitem). Kamal 2 jest dobrą alternatywą, ale dokłada Ruby i kamal-proxy, a nam wystarczy krótki skrypt w repo, który agent AI czyta i rozumie.
> 3. **Ruch: Cloudflare Tunnel -> Caddy (127.0.0.1) -> 2 kontenery aplikacji.** Caddy daje health check i przełączanie bez przestojów; Tunnel zostaje jedynym wejściem (zero otwartych portów). `www.pawelperfect.com` musi być **bez** aplikacji Access (jest publiczna).
> 4. **Trzy zmiany w kodzie przed przełączeniem** (małe, bezpieczne też na Vercel):
>    - prawdziwe IP klienta z `CF-Connecting-IP` (dziś bierzemy ostatni wpis `X-Forwarded-For`; za Caddy byłby to `127.0.0.1`, czyli jeden wspólny limit dla wszystkich),
>    - `GIT_SHA`/`deploymentId` zamiast zmiennych `VERCEL_GIT_COMMIT_SHA`,
>    - zapisywalny `.next/cache` w obrazie (dziś runner działa jako `node`, a `/app` należy do roota, więc cache obrazków `next/image` nie ma gdzie się zapisać).
> 5. **Zostaje na zewnątrz, bez zmian:** Neon (baza), Upstash (limity; w produkcji bez Redisa aplikacja rzuca błąd), Clerk, Stripe, Resend, Cloudflare Stream/R2, Vercel Blob (tylko starsze miniatury i obrazki w komentarzach; działa z tokenem spoza Vercel).
> 6. **Crony z `vercel.json` -> timery systemd** wołające `http://127.0.0.1:<port>/api/cron/...` z `Bearer $CRON_SECRET`. Przy okazji możemy włączyć `stripe-reconciliation` co 15 min (na Hobby się nie dało).
> 7. **Przełączenie:** zmiana rekordu `www` w Cloudflare z Vercel na tunel, Vercel zostaje nietknięty jako zapas na 14 dni. Powrót = przywrócenie rekordu (sekundy). Migracje bazy dalej tylko addytywne, bo obie wersje patrzą w tę samą bazę.
> 8. **Tracimy:** podglądy PR (zostawiamy je na Vercel, darmowe), autoskalowanie (przy skoku ruchu rośnie opóźnienie zamiast liczby instancji), Vercel Analytics (zamiennik: Cloudflare Web Analytics), panel logów (zamiennik: logi Dockera + Sentry Developer, darmowy).
> 9. **Nie robimy na start:** cache'owania HTML strony głównej w Cloudflare (ryzyko podania cudzej strony zalogowanemu). Zamiast tego, jeśli trzeba, cache danych w Next (`use cache`/`unstable_cache` z krótkim TTL) dla list filmów.
> 10. **Najpierw sprawdzić region Neon** (Otwarte pytania, pkt 1): jeśli baza jest daleko od Norymbergi, przeniesienie samej aplikacji pogorszy czasy odpowiedzi.

---

## 1. Co z Vercel faktycznie używamy i czym to zastąpić

Wszystko poniżej sprawdzone grepem w repo (commit `59928404`).

| Funkcja | Gdzie w kodzie | Na serwerku | Uwagi |
|---|---|---|---|
| **Vercel Cron** (3 zadania) | `vercel.json`: `video-provider-jobs/reconcile` 04:00, `prune-playback-sessions` 05:00, `sync-public-thumbnails` 06:00 | timery systemd (albo `/etc/cron.d`) na hoście, `curl` do `127.0.0.1` z `Authorization: Bearer $CRON_SECRET` + `flock` przeciw nakładaniu | Trasy już same sprawdzają `CRON_SECRET` i są publiczne w `middleware.ts` (CLAUDE.md §6). Vercel wysyła sekret jako `Authorization: Bearer` i nie ponawia nieudanych wywołań [zweryfikowane: Vercel, "Managing Cron Jobs", 2026-08-11]. Dochodzi `stripe-reconciliation` co 15 min. |
| **Vercel Blob** | `@vercel/blob`: `comments/image-upload` (tylko Blob), `cover-upload` i domyślna miniatura (fallback, gdy brak env R2), odczyt w `lib/blob.ts`, `thumbnail-response.service.ts`, `media-storage.service.ts` | działa dalej przez API z `BLOB_READ_WRITE_TOKEN` | Magazyn zostaje na koncie Vercel, więc **nie usuwać projektu Vercel**, dopóki obrazki komentarzy i 6 starych miniatur nie przejdą na R2. Upewnić się, że env R2 są ustawione, inaczej nowe okładki pójdą do Blob. [niezweryfikowane: działanie `put`/`get` spoza Vercel nie było testowane na serwerku] |
| **@vercel/analytics** | `app/layout.tsx` (`<Analytics />`) | usunąć albo zostawić bez efektu; zamiennik Cloudflare Web Analytics (darmowy) | Poza Vercel skrypt `/_vercel/insights/*` nie istnieje, dane nie będą zbierane [niezweryfikowane]. |
| **Upstash / Vercel KV (limity)** | `lib/rate-limit.ts`, `lib/api/admin-rate-limit.ts` | bez zmian (REST po HTTPS) | W produkcji brak Redisa = wyjątek przy tworzeniu store'u [zweryfikowane: `resolveRateLimitStoreKind`]. Na serwerku trzeba podać `UPSTASH_REDIS_REST_*` albo `KV_REST_API_*`. Lokalny Redis wymagałby nowego adaptera (dziś tylko REST). |
| **Optymalizacja obrazków** | 17 plików z `next/image`, część z `unoptimized`; `sharp` w zależnościach; `remotePatterns` w `next.config.mjs` | działa w `next start` bez konfiguracji [zweryfikowane: Next.js "Self-hosting", 2026-08-25] | Liczy się na naszym CPU (tym samym co SSR). Cache w `.next/cache/images`: wolumen + uprawnienia (patrz §1.1). `remotePatterns` czytają env (`NEXT_PUBLIC_R2_PUBLIC_HOST` itd.) w czasie builda, więc muszą być ustawione w CI. Next ostrzega o zużyciu pamięci przez sharp na glibc (link do alokatora w dokumentacji). |
| **ISR / data cache / `revalidatePath`** | 79 deklaracji `force-dynamic`, `revalidate = 60` w `__version` i `channel/[slug]`, `revalidatePath('/', 'layout')` w `lib/actions/interactions.ts`, `user.ts` | działa na jednej instancji z dyskiem [zweryfikowane: Next.js docs] | Przy 2 replikach każda ma własny cache i `revalidatePath` czyści tylko swój. U nas to bez znaczenia, bo prawie wszystko jest dynamiczne; gdybyśmy dodali `use cache`, to krótkie TTL albo wspólny handler (Redis) z `refreshTags()`. |
| **Middleware** | `middleware.ts` (Clerk, CSP, CSRF, limity admina) | działa w `next start` [zweryfikowane: docs: Proxy "works self-hosted with zero configuration"] | Next 16 ostrzega, że nazwa `middleware` jest przestarzała (`proxy`), co widać w logach z §14. Bez wpływu na działanie. |
| **Edge runtime** | `app/icon.tsx`, `app/icon-512/route.tsx` (`runtime = 'edge'`) | `next start` emuluje edge w Node [niezweryfikowane testem; w §14 ikon nie sprawdzano osobno] | Najprościej przy okazji zmienić na `nodejs`. |
| **`VERCEL_ENV` / `VERCEL_GIT_*`** | `scripts/vercel-build.mjs` (migracje tylko gdy nie preview), `app/api/__version`, `app/layout.tsx` (`buildId`), trasy `admin/health/*` | nowe `GIT_SHA`/`APP_ENV` z CI, z fallbackiem na `VERCEL_*` | Migracje wyjmujemy z builda do osobnego kroku wdrożenia (§2). |
| **Geolokalizacja** | `lib/i18n/server-language.ts` czyta `x-vercel-ip-country` | `cf-ipcountry` (kod kraju ISO od Cloudflare) [zweryfikowane: Cloudflare "HTTP headers", 2026-05-05] | Dziś i tak nieaktywne, bo `TEMP_FORCE_ENGLISH = true`. |
| **Podglądy PR** | automatyczne na Vercel | zostawić na Vercel (Hobby) | Jak dotąd podgląd dzieli bazę z produkcją (CLAUDE.md §4). Własne podglądy na serwerku zjadałyby CPU i RAM. |
| **Zmienne środowiskowe** | panel Vercel | `/etc/serwerek/polutek-prod.env` (root, 600) jako `env_file`, `NEXT_PUBLIC_*` jako sekrety GitHub (build args) | `NEXT_PUBLIC_*` są wypalane w bundlu w czasie builda [zweryfikowane: docs]. Dzisiejszy `Dockerfile` ma atrapę klucza Clerk: obraz produkcyjny musi dostać prawdziwe `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_R2_PUBLIC_HOST`, `NEXT_PUBLIC_BLOB_PUBLIC_HOST` itd. |
| **Logi** | panel Vercel | `docker logs` z rotacją, błędy do Sentry | §6. |
| **Instant Rollback** | panel Vercel | poprzedni tag obrazu w GHCR + `deploy.sh <sha>` | §2. |

### 1.1 Poprawki w `deploy/serwerek/Dockerfile` przed produkcją

- `RUN mkdir -p .next/cache && chown -R node:node .next` w runnerze (albo `COPY --chown=node:node`). Dziś `/app` należy do roota, a proces działa jako `node`, więc cache `next/image` się nie zapisze. [zweryfikowane w Dockerfile; skutków nie testowano, bo §14 nie sprawdzało `/_next/image`]
- Wolumen na `.next/cache/images`, żeby restart nie gubił zoptymalizowanych obrazków.
- Build args dla `NEXT_PUBLIC_*` z sekretów CI (zamiast atrapy), `GIT_SHA` jako `ENV`.
- `stop_grace_period: 30s` w compose: Next kończy rozpoczęte żądania i callbacki `after()` po `SIGTERM`; dokumentacja zaleca 10-30 s [zweryfikowane: docs, sekcja `after`].
- Osobny, mały etap `migrate` (Prisma CLI + `prisma/`) zamiast 3,4 GB obrazu narzędziowego z §14.
- Limity z §14: `app` `mem_limit: 1g`; Postgresa nie ma (produkcja zostaje na Neon).

## 2. Jak wdrażać: porównanie

| | Compose + GitHub Actions + skrypt | Kamal 2 | Coolify | Dokku |
|---|---|---|---|---|
| Gdzie build | CI (GitHub) | lokalnie albo CI, push do rejestru | domyślnie na serwerze | na serwerze (`git push`) |
| Zero przestojów | Caddy + 2 repliki + health check (piszemy sami, krótki skrypt) | wbudowane w kamal-proxy (domyślnie `/up` co 1 s) [zweryfikowane: kamal-deploy.org/docs/configuration/proxy] | wbudowane | wbudowane (checks) [niezweryfikowane] |
| Rollback | `deploy.sh <poprzedni-sha>` | `kamal rollback <wersja>`, stare kontenery trzymane 3 dni [zweryfikowane: kamal-deploy.org/docs/commands/rollback] | z panelu | `dokku ps:rollback` [niezweryfikowane] |
| Narzut na serwerze | ~0 (Caddy, kilkadziesiąt MB) [niezweryfikowane] | kamal-proxy (mały) | min. 2 CPU / 2 GB RAM dla samego Coolify [zweryfikowane: coolify.io/docs/get-started/installation] | mały, ale build na serwerze |
| Dla agenta AI | wszystko jako pliki w repo, przewidywalne komendy | konfiguracja w `deploy.yml`, ale narzędzie Ruby na maszynie operatora (Windows: przez Docker/WSL) | stan w panelu/bazie Coolify, nie w git | konwencje Herokuowe, mniej przejrzyste |
| Pasuje do Tunnel | tak | tak (Tunnel na kamal-proxy na `127.0.0.1:80`) [niezweryfikowane] | tak | tak |

**Wybór: Compose + GitHub Actions + `deploy.sh`.** Build na serwerze zabiera jedyny zasób w deficycie (CPU; w §14 sam `next build` trwał 35 s na obu rdzeniach z `--max-old-space-size=3072`), Coolify zabiera połowę RAM-u, a AI-operator najlepiej działa na plikach w repo. Kamal rozważyć, jeśli dojdzie druga maszyna.

### 2.1 Przepływ

1. Merge do `main` -> workflow `deploy-serwerek.yml`: build obrazu z `NEXT_PUBLIC_*` z sekretów, tag `ghcr.io/<owner>/polutek-app:<sha>`, push do GHCR (prywatny pakiet; serwer loguje się tokenem tylko do odczytu).
2. Krok `migrate`: `prisma migrate deploy` przeciw Neon (z CI albo jednorazowy kontener na serwerze). Najpierw migracja, potem kod; migracje tylko addytywne (zasada z CLAUDE.md §4), pliki bez BOM.
3. Krok deploy: SSH na serwer (osobny klucz deploy z ograniczeniem `command="/opt/serwerek/apps/polutek/deploy.sh"` w `authorized_keys`) -> `deploy.sh <sha>`:
   - `docker pull` nowego tagu, restart `app_b` na nowym tagu, czekanie aż `/api/health` da 200 (max 60 s); przy porażce: `app_b` wraca na stary tag, koniec z błędem,
   - restart `app_a` na nowym tagu (Caddy w tym czasie kieruje ruch do `app_b` dzięki `lb_try_duration` i health checkom), sprawdzenie zdrowia,
   - zapis `<sha>` w `/opt/serwerek/apps/polutek/DEPLOYED`, poprzedniego w `PREVIOUS`, wpis do `ai-log`.
4. Smoke test z CI: `curl https://www.pawelperfect.com/api/__version` zwraca nowy SHA.

**Rollback:** `deploy.sh $(cat PREVIOUS)` (obraz jest już na dysku; szacunek ok. 30 s) [niezweryfikowane]. Migracji nie cofamy, dlatego muszą być kompatybilne wstecz o jedną wersję.

**Skew wersji przy 2 replikach:** ustawić `deploymentId: process.env.GIT_SHA` w `next.config.mjs`. Wtedy klient ze starej wersji dostaje pełne przeładowanie zamiast błędów brakujących chunków i "Failed to find Server Action" [zweryfikowane: docs, "Version skew"]. Klucz szyfrowania Server Actions powstaje w buildzie, a obie repliki biegną z tego samego obrazu, więc jest wspólny [zweryfikowane: docs, "Server Functions encryption key"].

**Sekrety:** runtime w `/etc/serwerek/polutek-prod.env` (root, 600; jak inne pliki z sekretami, poza backupem), `NEXT_PUBLIC_*` i klucz SSH deploya w GitHub Secrets. Później SOPS+age (SERWEREK.md §11 pkt 10). Nic sekretnego w obrazie (`NEXT_PUBLIC_*` są i tak publiczne).

## 3. Wejście ruchu

| Wariant | Za | Przeciw |
|---|---|---|
| **Tunnel -> aplikacja** (1 kontener) | najprościej, działa dziś dla `apptest` | brak zero-downtime (restart = 502 przez kilka sekund), Tunnel nie robi health checków między portami lokalnymi |
| **Tunnel -> Caddy -> 2 repliki** | zero-downtime, health check, limit rozmiaru body, jedno miejsce na nagłówki | jedna warstwa więcej; trzeba poprawić odczyt IP (§3.1) |
| **Publiczny 443 + proxy Cloudflare** | klasyka | trzeba otworzyć porty w dwóch firewallach, certyfikat origin, Authenticated Origin Pulls, inaczej ktoś obejdzie Cloudflare; tracimy obecne "zero portów" |

**Wybór: Tunnel -> Caddy (`127.0.0.1:8080`) -> `127.0.0.1:3001` i `:3002`.** Szkic konfiguracji Caddy [niezweryfikowane testem]:

```
:8080 {
  bind 127.0.0.1
  request_body {
    max_size 25MB
  }
  reverse_proxy 127.0.0.1:3001 127.0.0.1:3002 {
    lb_policy round_robin
    lb_try_duration 5s          # w trakcie restartu repliki żądanie czeka na drugą
    health_uri /api/health
    health_interval 5s
    flush_interval -1           # streaming RSC/Suspense bez buforowania
    trusted_proxies 127.0.0.1/32 ::1
  }
}
```

Opcje `lb_try_duration`, `health_uri`, `flush_interval -1` (brak buforowania) są w dokumentacji Caddy [zweryfikowane: caddyserver.com/docs/caddyfile/directives/reverse_proxy]. Streaming musi przejść bez buforowania przez całą ścieżkę [zweryfikowane: Next.js docs, "Streaming and Suspense"]. Instalowany Caddy to 2.6.2 (Ubuntu): przed użyciem sprawdzić, czy ta wersja zna `trusted_proxies` w tej formie, albo użyć obrazu `caddy:2` w compose [niezweryfikowane].

### 3.1 Prawdziwe IP klienta (ważne)

- Dziś `getAdminClientIp()` (`lib/api/admin-rate-limit.ts`) i `getMediaClientIp()` (`lib/media/rate-limit.ts`) biorą **ostatni** wpis `X-Forwarded-For`. Korzystają z tego: limity admina, `nickname-available`, `media-source` (limit + skrót IP sesji odtwarzania), `playback-event`, audyt.
- Cloudflare ustawia `CF-Connecting-IP` na IP klienta i **dopisuje** się do `X-Forwarded-For` [zweryfikowane: Cloudflare "HTTP headers", 2026-05-05].
- Caddy domyślnie ignoruje przychodzące `X-Forwarded-For` (chyba że nadawca jest w `trusted_proxies`) i **dopisuje IP bezpośredniego nadawcy**, czyli cloudflared = `127.0.0.1` [zweryfikowane: dokumentacja Caddy]. Ostatni wpis to wtedy `127.0.0.1` dla każdego: wszyscy dzielą jeden licznik (np. 20/min na `nickname-available` dla całego internetu).
- **Zmiana:** jedna funkcja `getClientIp(headers)`, która przy `TRUST_CF_CONNECTING_IP=1` bierze `CF-Connecting-IP`, inaczej obecna logika. Bezpieczne, bo origin jest osiągalny tylko przez Tunnel (wszystko na `127.0.0.1`, porty zamknięte), więc nagłówka nie da się podrobić z zewnątrz. Na Vercel flaga wyłączona, zachowanie bez zmian.
- Czy samo cloudflared przekazuje `CF-Connecting-IP` i `X-Forwarded-For` do originu, dokumentacja parametrów originu nie mówi [zweryfikowane: brak w "Origin parameters", 2026-04-17]. Sprawdzić testem: tymczasowo zalogować wyliczone IP i porównać z `https://www.cloudflare.com/cdn-cgi/trace` z tej samej przeglądarki.
- CSRF (`lib/api/csrf.ts`) porównuje `Origin` z `x-forwarded-host`/`host` i z hostami z `NEXT_PUBLIC_APP_URL`. `www.pawelperfect.com` jest na liście z `NEXT_PUBLIC_APP_URL`, więc działa niezależnie od tego, jaki `Host` dotrze do aplikacji.

### 3.2 HTTPS, HSTS, cache, kompresja

- TLS kończy Cloudflare; Tunnel to szyfrowane połączenie wychodzące z serwera.
- HSTS już wysyła aplikacja (`next.config.mjs`: `max-age=31536000; includeSubDomains; preload`). `includeSubDomains` obejmuje też `test.`/`apptest.`: są za Cloudflare po HTTPS, więc OK.
- `_next/static/*` dostaje od Next `public, max-age=31536000, immutable` [zweryfikowane: docs]; Cloudflare buforuje po rozszerzeniu (`.js`, `.css`), więc to działa samo [niezweryfikowane dla naszej strefy].
- **`/_next/image` nie ma rozszerzenia, więc Cloudflare domyślnie go nie buforuje** [niezweryfikowane]. Reguła Cache Rules: `starts_with(http.request.uri.path, "/_next/image")` -> eligible for cache, TTL wg originu. Klucz zawiera query (`url`, `w`, `q`). Podobnie ewentualnie dla publicznych API bez danych użytkownika (np. `/api/payment-settings`), jeśli dostaną `s-maxage`.
- Strony dynamiczne mają od Next `private, no-cache, no-store` [zweryfikowane: docs], więc Cloudflare ich nie zbuforuje bez naszej reguły. Tak ma zostać (§5).
- Kompresja: Cloudflare kompresuje do klienta. Next domyślnie gzipuje sam; `compress: false` w `next.config.mjs` oszczędziłby trochę CPU [niezweryfikowane: zysk niezmierzony; zmierzyć przed zmianą].
- WAF/boty: jeśli włączymy Bot Fight Mode, dodać regułę pomijającą `/api/webhooks/*` i `/api/cron/*`, inaczej Stripe/Svix/Resend mogą dostać wyzwanie [niezweryfikowane].

## 4. Webhooki i Clerk

- Domena się nie zmienia (`www.pawelperfect.com`), więc **adresy webhooków w Stripe, Clerk (Svix) i Resend zostają** (`https://www.pawelperfect.com/api/webhooks/*`, CLAUDE.md §0). Svix nie podąża za przekierowaniami (CLAUDE.md §4.12): nowa ścieżka nie może zwracać 301 dla tych adresów.
- Podpisy liczone są z surowego body; Tunnel i Caddy go nie zmieniają [niezweryfikowane testem]. Stripe sprawdza znacznik czasu w podpisie, więc zegar serwera musi być zsynchronizowany (`timedatectl` -> `System clock synchronized: yes`) [niezweryfikowane: tolerancja Stripe 5 min z pamięci].
- Po przełączeniu: testowy event z panelu Stripe, Clerk "Message Attempts" (zielone) i tabela `ClerkEvent`, w Resend lista zdarzeń webhooka.
- **Clerk:** instancja produkcyjna jest przypięta do domeny, nie do hostingu. `clerk.pawelperfect.com` (Frontend API) to CNAME do Clerk i się nie zmienia. CSP (`lib/utils/security.ts`) liczy hosty z `NEXT_PUBLIC_APP_URL`, która zostaje ta sama, więc CSP bez zmian. Klucz publikowalny musi trafić do builda (§1).
- Przekierowania apex `pawelperfect.com` -> `www` i `.pl` -> `.com` są dziś w Vercel. Jeśli kiedyś wyłączymy Vercel, trzeba je odtworzyć w Cloudflare (Redirect Rules / Bulk Redirects) **przed** usunięciem domen z Vercel.

## 5. Wydajność i skala

**Co wiemy z pomiarów (§14, lokalny Postgres):** `/en` 59 req/s (p50 330 ms przy 20 połączeniach), sidebar API 422 req/s, aplikacja do 240 MiB RAM, CPU do 158% z 200%. Ograniczeniem jest CPU. Produkcja będzie na Neon zamiast lokalnego Postgresa: każde zapytanie dostaje RTT z Norymbergi do regionu Neon (nieznany, Otwarte pytania pkt 1), więc opóźnienie wzrośnie; przepustowość CPU raczej się nie zmieni [niezweryfikowane].

**Pojemność (szacunek):** przy 1 renderze SSR na odsłonę i zapasie 50% to ok. 30 odsłon/s stale, czyli ok. 100 tys. odsłon w godzinie szczytu. Przy premierze (wszyscy naraz) rośnie opóźnienie, nie liczba błędów; Vercel w tym miejscu dołożyłby instancje. Próg rozbudowy z §14: CPX32, gdy stały ruch przekracza ok. 30 renderów/s.

**Procesy:** Node renderuje w jednym wątku. Dwie repliki na 2 vCPU dają zero-downtime i lepiej wykorzystują oba rdzenie przy równoległych żądaniach [niezweryfikowane: zysk niezmierzony, bo jedna replika już doszła do 158% CPU dzięki wątkom GC/libuv]. Każda `mem_limit: 1g`; razem z Caddy i workerem ffmpeg (ok. 300 MB) mieści się w 3,8 GB.

**Cache dla anonimowych (od najbezpieczniejszego):**
1. **Cache danych w Next** (`'use cache'` z `cacheLife` albo `unstable_cache`) dla list filmów kanału, ustawień płatności, layoutu sidebara dla gości. TTL 30-60 s, `revalidateTag` z mutacji admina. Działa na `next start`; przy 2 replikach każda ma swój cache, co przy krótkim TTL jest akceptowalne [zweryfikowane: docs, "Multi-Instance Cache Coordination"]. Zysk: mniej zapytań do Neon na render; render React nadal na CPU.
2. **Cache HTML w Cloudflare z pominięciem zalogowanych:** reguła "bypass, gdy jest cookie `__session`" jest możliwa w Cache Rules (`http.cookie`) [zweryfikowane: przykład w dokumentacji Cloudflare, 2026-04-16; dostępność na planie Free tylko ze źródeł wtórnych]. **Nie rekomenduję teraz**: strona główna jest `force-dynamic` i czyta stan Clerk; Clerk może ustawiać ciasteczka (`__client_uat`, handshake) także niezalogowanym [niezweryfikowane]; trzeba by nadpisać `Cache-Control: private` po stronie Cloudflare; pomyłka = cudza strona dla zalogowanego. Do rozważenia dopiero, gdy pkt 1 nie wystarczy, i z testem.
3. `stale-while-revalidate` na publicznych API (`s-maxage=30, stale-while-revalidate=300`) + reguła cache w Cloudflare dla tych konkretnych ścieżek.

Nie wolno buforować: `/api/media-source` (sesja odtwarzania związana z IP/UA, CLAUDE.md §4.3), webhooków, cronów, niczego pod `/api/admin`.

## 6. Obserwowalność

| Potrzeba | Propozycja | Koszt | Uwagi |
|---|---|---|---|
| Logi aplikacji | `docker logs`, sterownik `json-file` z rotacją (`max-size: 10m`, `max-file: 5`); middleware już nadaje `x-request-id` | 0 | Szukanie: `docker compose logs --since 1h \| grep <requestId>`. Wysyłka na zewnątrz (Grafana Cloud / Better Stack, plany darmowe) dopiero gdy będzie potrzebna [limity niesprawdzone]. |
| Błędy | Sentry SaaS, plan Developer: 5 tys. błędów/mies., 1 użytkownik, 30 dni [zweryfikowane tylko w zestawieniach z 2026, nie na sentry.io] | 0 | Self-hosted Sentry wymaga kilkunastu GB RAM [niezweryfikowane], na CPX22 odpada; lżejsza alternatywa GlitchTip [niezweryfikowane]. Mamy już `instrumentation.ts`, do którego wpina się `@sentry/nextjs`. |
| Uptime z zewnątrz | UptimeRobot Free: 50 monitorów co 5 min [zweryfikowane w zestawieniach 2026]; **warunki użytku komercyjnego są w źródłach sprzeczne** | 0 | Monitorować `https://www.pawelperfect.com/api/health` (publiczne, nie za Access). Alternatywa: Better Stack free [niesprawdzone]. Decyzja właściciela (SERWEREK.md §11 pkt 11). |
| Crony | heartbeat po udanym przebiegu (np. healthchecks.io, plan darmowy) [limity niesprawdzone] albo `health.sh` sprawdza datę ostatniego sukcesu | 0 | Ani Vercel, ani timer nie ponawiają, więc alert o pominiętym przebiegu ma sens. |
| Metryki hosta | istniejący `health.sh` (dysk, RAM, swap, usługi) + dopisać: oba kontenery `healthy`, liczba restartów | 0 | Netdata/Prometheus to przerost na jedną maszynę. |
| Analityka ruchu | Cloudflare Web Analytics (darmowy, bez ciasteczek) zamiast Vercel Analytics | 0 | Sprawdzić z właścicielem wpis w Polityce Prywatności. |

## 7. Plan migracji krok po kroku

**Faza 0: przygotowanie (bez wpływu na produkcję, wszystko działa też na Vercel)**
- [ ] Odpowiedź na Otwarte pytania 1 i 2 (region Neon, obecny rekord `www`).
- [ ] PR: `getClientIp()` z `CF-Connecting-IP` za flagą `TRUST_CF_CONNECTING_IP` + testy jednostkowe.
- [ ] PR: `GIT_SHA` z fallbackiem na `VERCEL_GIT_COMMIT_SHA` (`__version`, `layout`, `admin/health/*`), `deploymentId` gdy `GIT_SHA` ustawione, `cf-ipcountry` jako fallback geolokalizacji, ikony na `runtime = 'nodejs'`.
- [ ] PR: Dockerfile produkcyjny (zapisywalny `.next/cache`, build args `NEXT_PUBLIC_*`, `GIT_SHA`, mały etap `migrate`), `deploy/serwerek/prod/docker-compose.yml` (2 repliki, Caddy, limity, `stop_grace_period`, rotacja logów), `deploy.sh`, timery systemd dla cronów.
- [ ] PR: workflow `deploy-serwerek.yml` (build -> GHCR -> migrate -> SSH deploy -> smoke test), na razie tylko ręcznie (`workflow_dispatch`).

**Faza 1: produkcja na serwerku pod ukrytą nazwą**
- [ ] `/etc/serwerek/polutek-prod.env` z prawdziwymi wartościami (z `.ai-secrets`/env Vercel), 600.
- [ ] Hostname testowy, np. `prodtest.pawelperfect.com` -> Tunnel -> Caddy, **za Access** (bez indeksowania i obcych). Logowanie Clerk produkcyjnego może tam nie działać (inny host niż `NEXT_PUBLIC_APP_URL`) [niezweryfikowane]; sprawdzamy SSR, API, obrazki, crony; logowanie po przełączeniu.
- [ ] Crony: tylko `sync-public-thumbnails?dryRun=1` na nowej instancji; reszta zostaje na Vercel do przełączenia, żeby nie biegły dwa razy.
- [ ] Test obciążenia jak w §14, tym razem z Neon i Upstash. Zapisać p50/p99 i CPU.
- [ ] Test IP: logi limitów pokazują różne IP dla różnych klientów, nie `127.0.0.1`.
- [ ] Ćwiczenie rollbacku: `deploy.sh <poprzedni-sha>` i z powrotem.

**Faza 2: przełączenie (godzina małego ruchu, właściciel dostępny)**
- [ ] Zapisać obecny rekord `www` w strefie `pawelperfect.com` (typ, cel, proxied) w `ai-log`.
- [ ] Ingress Tunnel: dodać `www.pawelperfect.com` -> `http://127.0.0.1:8080` (PUT z pełną listą reguł, SERWEREK.md §9), **bez aplikacji Access**.
- [ ] DNS: `www` CNAME -> `a61ae173-0747-492e-9fa5-47692e43c1a7.cfargotunnel.com`, proxied. Przy rekordzie proxied zmiana działa na krawędzi Cloudflare niemal od razu [niezweryfikowane: czasu nie mierzono].
- [ ] Apex i `.pl`: zostają na Vercel (przekierowania) w okresie zapasowym.
- [ ] Wyłączyć crony Vercel (panel: "Disable Cron Jobs"), włączyć timery na serwerku, dodać `stripe-reconciliation` co 15 min.
- [ ] Smoke: `/api/__version` = nowy SHA; strona główna jako gość i zalogowany; komentarz; odtwarzanie wideo; testowy event z panelu Stripe; webhook Clerk (zmiana nicku); cron bez tokena = 401 JSON (nie HTML).
- [ ] Obserwacja przez 2 h: Sentry, `docker stats`, alerty `health.sh`.

**Faza 3: okres zapasowy (14 dni)**
- [ ] Vercel bez zmian: projekt, env, domeny przypisane. Wdrożenia z `main` dalej budują się na Vercel, więc zapas jest aktualny.
- [ ] **Powrót:** przywrócić zapisany rekord `www`, włączyć crony Vercel, wyłączyć timery. Baza wspólna, więc nic nie ginie.
- [ ] Po 14 dniach bez powrotu: decyzja właściciela, czy wyłączyć produkcyjne buildy Vercel (zostawić podglądy PR i Blob), przenieść obrazki komentarzy z Blob do R2, zaktualizować CLAUDE.md §2/§6 (stack i crony) i SERWEREK.md §4.

## Otwarte pytania

1. **Region Neon.** Gdzie jest baza? Jeśli daleko od Norymbergi (np. USA), każdy render dostanie kilkadziesiąt ms na zapytanie i przeniesienie traci sens bez przeniesienia bazy. Sprawdzić w panelu Neon przed fazą 1.
2. **Jak dziś jest skonfigurowany `www` w Cloudflare:** proxied do Vercel czy DNS-only? Od tego zależy, co dokładnie przywracamy przy powrocie i czy Vercel odnawia certyfikat.
3. **Warunki planu Hobby Vercel** (użytek niekomercyjny) wobec serwisu z napiwkami: argument za przeniesieniem czy za planem Pro? [niezweryfikowane]
4. **Czy w ogóle chcemy zero-downtime** (2 repliki + Caddy), czy wystarczy jedna replika i kilka sekund 502 przy wdrożeniu nocą? Prościej, ale każdy merge to krótka przerwa.
5. **Monitoring zewnętrzny:** który serwis i czy właściciel zakłada konto (UptimeRobot ma niejasne warunki komercyjne).
6. **Sentry:** czy zakładamy konto (darmowe) i czy dopisać je do Polityki Prywatności (IP/UA w zgłoszeniach błędów).
7. **Ruch szczytowy przy premierze:** ile osób realnie wejdzie naraz? Powyżej ok. 30 odsłon/s najpierw cache danych (§5 pkt 1), potem CPX32.
8. **Blob:** kiedy przenieść obrazki komentarzy (`comments/image-upload` ma tylko ścieżkę Blob) na R2, żeby móc kiedyś zamknąć projekt Vercel.

## Źródła (dostęp 2026-10-01)

- Next.js, "How to self-host your Next.js application", wersja 16.3.8, aktualizacja 2026-08-25: https://nextjs.org/docs/app/guides/self-hosting
- Vercel, "Managing Cron Jobs", aktualizacja 2026-08-11: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Cloudflare, "Cloudflare HTTP headers", aktualizacja 2026-05-05: https://developers.cloudflare.com/fundamentals/reference/http-headers/
- Cloudflare, "Origin parameters" (Tunnel), aktualizacja 2026-04-17: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/cloudflared-parameters/origin-parameters/ (nie opisuje nagłówków IP)
- Cloudflare, "Cache Rules settings", aktualizacja 2026-09-16: https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ (nie podaje dostępności per plan)
- Cloudflare, "Bypass Cache on Cookie", aktualizacja 2026-04-16: https://developers.cloudflare.com/cache/how-to/cache-rules/examples/bypass-cache-on-cookie/
- Wtórne, cookie w Cache Rules na Free: https://stackharbor.com/en/knowledge-base/cfops-cookies-cache-bypass/ [niezweryfikowane]
- Caddy, `reverse_proxy` (bez daty): https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Kamal, proxy (bez daty): https://kamal-deploy.org/docs/configuration/proxy/ ; rollback: https://kamal-deploy.org/docs/commands/rollback/
- Coolify, instalacja (bez daty): https://coolify.io/docs/get-started/installation
- Clerk, cookies (bez daty): https://clerk.com/docs/guides/how-clerk-works/cookies (nie opisuje ciasteczek dla wylogowanych)
- Sentry, ceny 2026 (zestawienie wtórne): https://costbench.com/software/developer-tools/sentry/ [niezweryfikowane na sentry.io]
- UptimeRobot, plan Free 2026 (zestawienie wtórne): https://stillup.org/blog/uptimerobot-free-plan-limits [sprzeczne co do użytku komercyjnego]
- Repo (commit `59928404`): `deploy/serwerek/Dockerfile`, `deploy/serwerek/docker-compose.yml`, `vercel.json`, `next.config.mjs`, `middleware.ts`, `lib/api/admin-rate-limit.ts`, `lib/media/rate-limit.ts`, `lib/api/csrf.ts`, `lib/rate-limit.ts`, `lib/i18n/server-language.ts`, `scripts/vercel-build.mjs`, `docs/operations/SERWEREK.md` §14.

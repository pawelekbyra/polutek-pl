# E. Inżynieria platformy UGC (multi-creator) dla pawelperfect.com

Data opracowania: 2026-10-13. Zakres: decyzje inżynierskie przy przejściu z jednego kanału (admin) na platformę, na której każdy użytkownik może założyć kanał, wgrywać wideo i obrazy, pisać teksty i otrzymywać napiwki przez Stripe Connect. Stos: Next.js 16 (App Router), React 19, TypeScript, Postgres 17 + Prisma, Better Auth, Redis, Hetzner + Docker + Cloudflare Tunnel, R2, Worker na `video.pawelperfect.com`, osobny admin za Cloudflare Access.

Uwaga metodologiczna: ceny i limity dostawców sprawdziłem w dniu opracowania tam, gdzie się dało. Część danych pochodzi wyłącznie ze źródeł wtórnych, co zaznaczam przy każdej z nich. Przed budżetowaniem trzeba je zweryfikować u dostawcy.

---

## Wnioski (TL;DR)

1. **Autoryzacja: centralna warstwa polityk w kodzie zamiast RLS i zamiast zewnętrznego silnika ReBAC.** Wprowadzamy moduł `lib/modules/access` z czystymi funkcjami `can(actor, action, resource)` oraz `assertCan(...)` i z repozytoriami, które **zawsze** filtrują po zakresie (`scopedTo(actor)`). Do tego tabela `ChannelMember(channelId, userId, role)` od pierwszego dnia, nawet jeśli dziś istnieje tylko rola `OWNER`. OpenFGA, Cedar i Oso to przy tej skali przerost formy. RLS w Postgresie traktujemy jako opcjonalną drugą linię obrony, wyłącznie dla kilku tabel wrażliwych (np. `Tip`, `Payout`), i to dopiero po zmierzeniu kosztu. Przykład RLS dla Prisma jest oficjalnie oznaczony jako „not intended to be used in production”.
2. **Superadmin nie omija polityk „ifem”.** Ma jawne uprawnienia w polityce (`platform:*`), działa tylko w aplikacji admin (Cloudflare Access + step-up), a każda jego mutacja zapisuje się w audycie z uzasadnieniem. Impersonacja domyślnie działa tylko do odczytu.
3. **IDOR/BOLA (OWASP API1:2023):** nieprzewidywalne publiczne ID (np. 11-znakowe base62, jak `watch?v=`), autoryzacja w każdej funkcji przyjmującej ID od klienta, testy macierzowe blokujące wdrożenie oraz test architektury, który zabrania importu „gołego” Prisma poza warstwą infrastructure.
4. **Upload:** zostajemy przy S3 multipart bezpośrednio do R2 (Uppy `@uppy/aws-s3` z `signRequest`). Nie wdrażamy tus, bo wymagałby serwera pośredniego przenoszącego cały ruch. Każdy upload poprzedza „rezerwacja” w Postgresie, która egzekwuje kwoty: liczbę, bajty i minuty na dzień oraz limity zależne od poziomu zaufania. Niedokończone multiparty sprząta reguła cyklu życia R2 (domyślnie po 7 dniach), a osierocone oryginały zbiera nasz własny GC.
5. **Encoder traktujemy jak kod uruchamiający złośliwe dane.** Pinujemy aktualne ffmpeg i ffprobe. Kontener bez sieci (`--network none`), w wariancie rootless lub z userns-remap, z `--read-only`, `--cap-drop ALL`, `no-new-privileges`, domyślnym seccomp, limitami `--memory`, `--cpus` i `--pids-limit`, z twardym timeoutem oraz whitelistą demuxerów i protokołów (`-protocol_whitelist file`). Najpierw ffprobe w tym samym sandboksie, potem odrzucamy pliki przekraczające limity rozdzielczości, czasu, liczby strumieni i FPS. Pobranie i wysłanie plików do R2 robi osobny proces z dostępem do sieci. Ten proces nie parsuje mediów.
6. **Fair scheduling kolejki:** do `EncodeJob` dodajemy `channelId`, `priority` i `attempts`. Pobieranie zadań idzie per-kanał w trybie round-robin (proste zapytanie `DISTINCT ON` po kanale z limitem współbieżności per kanał, z `SKIP LOCKED`). Dodajemy status `DEAD` po N próbach, backoff i „lease” z heartbeatem.
7. **Bezpieczeństwo treści:** od pierwszego dnia potrzebny jest plan CSAM. Cloudflare CSAM Scanning Tool skanuje tylko treści **serwowane przez cache Cloudflare** i dokumentacja mówi o obrazach, więc wideo w prywatnym R2 za Workerem nie jest nim objęte. Zalecenie: złożyć wniosek o PhotoDNA Cloud Service (bezpłatny dla zakwalifikowanych organizacji, wymaga weryfikacji) i wysłać zapytanie ofertowe do Thorn Safer (cennik niepubliczny; Safer Match obsługuje hashowanie wideo). Do tego klasyfikator NSFW na klatkach próbkowanych z wideo i miniaturach, uruchamiany w encoderze. Nowe kanały domyślnie wymagają ręcznej moderacji przed publikacją.
8. **Moderacja:** osobna maszyna stanów moderacji (`PENDING_REVIEW → APPROVED | LIMITED | REMOVED`) niezależna od statusu publikacji. Do tego kolejka zgłoszeń z SLA, niemutowalny dziennik decyzji i rekord „statement of reasons” zgodny z art. 17 DSA. Mikro- i małe przedsiębiorstwa są zwolnione z wysyłki do DSA Transparency Database, ale nie z obowiązku wręczenia uzasadnienia użytkownikowi.
9. **Handle:** wyłącznie ASCII `[a-z0-9._]` (3–30 znaków), przechowywane w `citext` lub z unikalnym indeksem na `lower(handle)`, plus lista zastrzeżonych nazw i historia zmian z przekierowaniami 301. Pozwala to uniknąć homoglifów w handle. Dla nazw wyświetlanych liczymy „skeleton” wg UTS #39 i sprawdzamy podobieństwo do zweryfikowanych kanałów. W Next.js katalog `@x` oznacza **slot parallel routes**, więc `/@handle` trzeba zrealizować przez rewrite w `proxy.ts` lub `next.config` na `/[locale]/c/[handle]`.
10. **Model danych:** `Channel` oddzielony od `User`, `ChannelMember`, jawne maszyny stanów (`Channel.status`, `Video.publicationStatus`, `Video.moderationStatus`, `Video.processingStatus`), soft delete z terminem twardego usunięcia, liczniki denormalizowane aktualizowane asynchronicznie, `DomainEvent` i `Outbox` w tej samej transakcji co zmiana stanu.
11. **Feed:** fan-out on read. `WHERE channelId IN (subskrypcje) ORDER BY publishedAt DESC` z indeksem `(channelId, publishedAt DESC)` i paginacją keyset. Trending liczony formułą typu HN (`(v)^0.8/(h+2)^1.8`) w zadaniu co 10–15 minut do tabeli `VideoScore`. Wyszukiwanie: `tsvector` z `unaccent` (konfiguracja `simple` dla PL, bo Postgres nie ma polskiego stemmera Snowball) oraz `pg_trgm` do literówek. Strony spersonalizowane nigdy nie trafiają do wspólnego cache.
12. **Stripe Connect (inżynieria):** dwa endpointy webhooków (konto platformy i „Connected accounts”), każdy z własnym sekretem. Deduplikacja po `event.id` przez unikalny indeks. Zdarzenie traktujemy jako wyzwalacz i stan pobieramy z API. Klucze idempotencji budujemy deterministycznie z naszego ID (Stripe przechowuje je co najmniej 24 h). Lokalny mirror `StripeAccount`, tabela `Tip` jako ledger ze stanami, nocna rekoncyliacja z Balance Transactions. Refundy i spory obsługujemy przez transfer reversal. Spór na destination charge obciąża platformę.
13. **Skalowanie:** jako pierwsze zabraknie CPU encodera, potem dysku tymczasowego, a potem połączeń Postgresa. Plan: encoder na osobną maszynę, przy czym Hetzner w czerwcu 2026 mocno podniósł ceny linii CCX, więc warto porównać serwery dedykowane AX. Później kilku workerów na tej samej kolejce Postgres. Cloudflare Stream może służyć jako „overflow”: kodowanie jest darmowe, ale dostarczanie kosztuje 1 USD za 1000 minut. Przy naszym modelu (R2 bez opłat za egress i Worker) własna dystrybucja jest o rzędy wielkości tańsza.
14. **Narzędzia superadmina:** impersonacja tylko do odczytu, z banerem, limitem czasu, uzasadnieniem i audytem. Better Auth ma `impersonateUser` z domyślną sesją 1 h, ale my uruchamiamy ją tylko z aplikacji admin i blokujemy mutacje. Do tego globalne kill-switche w tabeli `PlatformSetting`, cache'owane w Redis z krótkim TTL, oraz flagi per kanał.
15. **Migracja:** expand/contract. Najpierw dodajemy `Channel` i `channelId` jako nullable, następnie backfill z istniejącego `Creator.isPrimary`, dual-write, dual-read za flagą, a na końcu `NOT NULL` i usunięcie starych pól. Macierz testów autoryzacji obejmuje każdą trasę i akcję serwera × {guest, user, owner, other-owner, banned, superadmin} i jest generowana z rejestru tras.

---

## 1. Autoryzacja wielodostępna (ownership, RBAC per kanał, superadmin, IDOR)

### Co mówią źródła

- **OWASP API Security Top 10 2023, API1: Broken Object Level Authorization.** Atakujący podmienia identyfikator obiektu w ścieżce, query, nagłówku lub body. Każdy endpoint, który przyjmuje ID obiektu i na nim operuje, musi sprawdzić, czy zalogowany użytkownik może wykonać daną akcję na tym obiekcie. OWASP podkreśla, że samo porównanie ID z sesji z parametrem nie wystarcza. Zalecenia: mechanizm autoryzacji oparty na rolach, politykach i hierarchii; sprawdzanie dostępu w każdej funkcji używającej wejścia klienta do odczytu lub zmiany rekordu; losowe, nieprzewidywalne identyfikatory; testy autoryzacji, które blokują wdrożenie, gdy nie przechodzą. Dostęp do funkcji, do której nie powinno się mieć dostępu, to osobna kategoria, BFLA (API5). [OWASP API1:2023]
- **Postgres RLS.** Polityki `CREATE POLICY` działają per tabela. Właściciel tabeli i role z `BYPASSRLS` je omijają, chyba że włączymy `FORCE ROW LEVEL SECURITY`. [Postgres docs, ddl-rowsecurity]
- **Prisma + RLS.** Oficjalny przykład `prisma-client-extensions/row-level-security` ustawia zmienną sesyjną przez `set_config` w transakcji batchowej opakowującej każde zapytanie. README ostrzega, że jawne `$transaction()` „may not work as intended” i że przykład „is not intended to be used in production environments”. Społeczność dokłada kolejne zastrzeżenia: `set_config(..., true)` musi być lokalne dla transakcji, bo inaczej przy poolingu wartość przecieknie do innego żądania; rola runtime nie może być właścicielem tabel ani mieć `BYPASSRLS`; zapytania `$queryRaw` są poza rozszerzeniem; Prisma Studio pokaże niepełne dane. [Prisma extensions repo; Redwood RLS demo; prisma-rls README; Atlas guide]
- **Silniki polityk.** Zanzibar, OpenFGA i SpiceDB to ReBAC: krotki relacji w osobnej usłudze i model z dziedziczeniem relacji. Wymagają synchronizacji danych z bazą aplikacji, co rodzi problem „dual write” i spójności. Cedar (AWS) to język polityk ABAC/RBAC z ewaluatorem w procesie (jest też wasm/JS). Oso Cloud oraz CASL (biblioteka JS do „abilities”, również do filtrowania zapytań) to opcje lżejsze. [OpenFGA docs; Cedar docs; CASL docs]
- **Next.js 16:** `middleware.ts` zmieniono na `proxy.ts`. Źródła wtórne podkreślają, że proxy nie jest warstwą autoryzacji. Po CVE-2025-29927 (obejście middleware przez nagłówek) zalecane jest sprawdzanie uprawnień w handlerach i w warstwie dostępu do danych. [Next.js 16 proxy, źródła wtórne]

### Rekomendacja dla naszego stosu

**Model zasobów i ról**

```
User ──< ChannelMember >── Channel ──< Video ──< Comment
                               └──< Post, Playlist, Tip(recipient)
```

- `ChannelMember { channelId, userId, role: OWNER | MANAGER | EDITOR | MODERATOR | VIEWER_ANALYTICS, createdAt }` z `@@unique([channelId, userId])`. Na start istnieje tylko `OWNER` (dokładnie jeden, wymuszony częściowym unikalnym indeksem `WHERE role='OWNER'`). Pozostałe role są w enumie i macierzy, ale za flagą.
- Role platformowe: `User.platformRole: USER | MODERATOR | SUPERADMIN`. Obecne `ADMIN` migrujemy do `SUPERADMIN`. Rola platformowa **nie** daje automatycznie członkostwa w kanale.

**Warstwa polityk (`lib/modules/access`)**

- `domain/actions.ts`: zamknięty typ akcji, np. `'video:create' | 'video:update' | 'video:publish' | 'video:delete' | 'video:view' | 'video:viewPrivate' | 'comment:create' | 'comment:moderate' | 'channel:updateSettings' | 'channel:manageMembers' | 'channel:viewRevenue' | 'tip:refund' | 'platform:moderate' | 'platform:impersonate' ...`.
- `domain/policies/*.ts`: czyste funkcje bez I/O, np. `canOnVideo(actor, action, video: VideoAuthzView)`. `VideoAuthzView` to minimalny projekt danych (`channelId`, `status`, `moderationStatus`, `visibility`, `channel.status`) plus członkostwo aktora, pobrane wcześniej.
- `application/authorize.ts`:
  - `can(actor, action, resource): Decision`, gdzie `Decision = { allow: boolean, reason: string }`. Uzasadnienie przydaje się w logach i testach.
  - `assertCan(...)` rzuca `ForbiddenError`. Na zewnątrz zwracamy **404 zamiast 403** dla zasobów, których istnienia aktor nie powinien znać (np. prywatne wideo), żeby nie ujawniać istnienia obiektu.
- **Odczyty list:** zamiast pobierać wszystko i filtrować w JS, każda polityka ma odpowiednik `scopeFor(actor, action): Prisma.VideoWhereInput`. To ten sam pomysł co `accessibleBy` w CASL. Repozytorium łączy go z filtrami użytkownika. Dla każdej polityki mamy testy kontraktowe sprawdzające, że `can()` i `scopeFor()` dają te same wyniki na wygenerowanym zbiorze danych.
- **Use-case'y** (`application/*`) jako pierwszy krok wołają `assertCan`. Server Actions i route handlers to cienkie adaptery: parsują dane Zod, budują `Actor` z sesji i wołają use-case. Ani komponenty, ani handlery nie importują Prisma.

**Superadmin**

- W polityce: `if (actor.platformRole === 'SUPERADMIN' && actor.context === 'admin-app' && action in PLATFORM_OVERRIDABLE) allow`. Override nie jest globalny. Akcje typu „wypłać napiwek na moje konto” czy „zmień ownera bez audytu” nie są na liście.
- `actor.context` ustawia serwer na podstawie hosta (admin.pawelperfect.com za Cloudflare Access, z weryfikacją JWT Access w aplikacji, nie tylko na brzegu). Na www superadmin jest zwykłym użytkownikiem.
- Każda mutacja przez override wymaga `reason` (string) i zapisuje `AuditLog` w tej samej transakcji.

**RLS: decyzja**

- Nie robimy RLS jako głównego mechanizmu. Przykład Prismy nie nadaje się na produkcję, kłóci się z interaktywnymi transakcjami i z `$queryRaw`, a nasz model nie jest „tenant = organizacja” z twardą izolacją. Większość treści jest publiczna, a granice dotyczą głównie zapisu.
- Opcjonalnie, w fazie 2: osobna rola DB `app_runtime` (nie właściciel tabel, bez `BYPASSRLS`) i polityki tylko na tabelach finansowych i prywatnych (`Tip`, `StripeAccount`, `ChannelMember`, `ModerationCase`). Kontekst przekazujemy przez `SELECT set_config('app.actor_id', $1, true)` na początku interaktywnej transakcji w helperze `withActorTx(actor, fn)`. Jeśli kiedyś pojawi się PgBouncer w trybie transaction, `set_config(..., true)` działa poprawnie, a `SET` sesyjne nie.

**Wymuszanie architekturą (testy architektury)**

- `dependency-cruiser` lub `eslint-plugin-boundaries`:
  - `@prisma/client` i `lib/db` mogą importować tylko pliki `lib/modules/*/infrastructure/**`.
  - `app/**` (strony, akcje) mogą importować tylko `lib/modules/*/application/**` (use-case'y), nigdy `infrastructure`.
  - `domain/**` nie importuje niczego z `infrastructure` ani z `next/*`.
- Test „każdy use-case autoryzuje”: konwencja `defineUseCase({ action, load, authorize, execute })`, a test przechodzi po rejestrze i sprawdza, że `authorize` istnieje. Alternatywnie reguła ESLint: eksport z `application/` musi być opakowany w `defineUseCase`.
- Test „każda Server Action przechodzi przez use-case”: skan AST plików z `'use server'`. Akcja nie może wywołać niczego spoza `application`.
- Publiczne ID: `Video.publicId` (11 znaków base62, losowe, unikalne) w URL. Wewnętrzne `cuid`/`uuid` nie pojawiają się w adresach.

---

## 2. Niezaufane uploady wideo i obrazów w skali

### Co mówią źródła

- **Uppy:** `@uppy/aws-s3` realizuje architekturę klient → storage (bez serwera pośredniego). Multipart jest wznawialny, bo ponawiane są tylko nieudane części. Domyślnie multipart włącza się powyżej 100 MiB. S3 wymaga części co najmniej 5 MiB (poza ostatnią) i maksymalnie 10 000 części. Najbezpieczniejszy wariant to `signRequest` (poświadczenia zostają na serwerze). tus to architektura klient → serwer → storage, która wymaga własnego serwera i load balancera. [Uppy AWS S3 docs]
- **R2 lifecycle:** każdy bucket ma domyślną regułę przerywającą niedokończone multiparty po 7 dniach. Reguły wygasania obsługują prefiks i wiek, a przejście do Infrequent Access kosztuje operację klasy A. Obiekty znikają zwykle w ciągu 24 h od wygaśnięcia. Limit to 1000 reguł na bucket. [R2 object lifecycles]
- **YouTube** jako punkt odniesienia dla kwot: bez weryfikacji konta filmy do 15 minut, po weryfikacji (SMS lub połączenie) do 12 h, maksymalnie 256 GB, w zależności od tego, który limit zostanie osiągnięty pierwszy. [YouTube Help 71673]
- **ffmpeg CVE:** ffmpeg regularnie ma błędy pamięci w demuxerach i dekoderach. Przykład: CVE-2025-22920, heap overflow w libavformat przy grupach kafelków. Kolejne zgłoszenia pojawiały się w 2025–2026 (IAMF demuxer, mov.c CENC, dekodery audio). Wspólne zalecenie źródeł: izolacja (brak sieci, ograniczony FS, seccomp, limity CPU i pamięci), pinowanie załatanej wersji, `no-new-privileges`. Sandbox ogranicza, do czego exploit ma dostęp, ale nie chroni przed crashem workera, więc trzeba projektować na awarie. [SentinelOne CVE-2025-22920; zestawienia CVE; dev.to „Sandboxed isn't safe”]
- **PeerTube** oddaje transkodowanie do „remote runners”, ale dokumentacja wprost mówi, że runner może zmieniać treść wideo, więc administrator runnera musi być zaufany. To model rozdzielenia orkiestracji od wykonania, który warto naśladować. [PeerTube remote runners]
- **Fair queue w Postgresie:** Hatchet opisuje deterministyczny round-robin, w którym ID zadań są przydzielane w blokach per grupa, a pobieranie to `ORDER BY id ... FOR UPDATE SKIP LOCKED`. Holistics stosuje limity „slotów” per tenant w zapytaniu claim. Prostsze warianty (pętla round-robin po tenantach) wystarczą, dopóki metryki czasu oczekiwania nie pokażą nierówności. `SKIP LOCKED` daje widok celowo niespójny i tylko przybliżoną kolejność FIFO. [Hatchet; Holistics; Artur's notes]
- **YouTube encoding guide:** zalecane bitraty wejściowe SDR to 1080p 8 Mbps, 720p 5 Mbps, 480p 2,5 Mbps, 360p 1 Mbps (30 fps). Wtórne opracowania Apple HLS Authoring Spec podają drabinę H.264 od około 235 kbps (416×234) do 4,5–6 Mbps (1080p), segmenty około 6 s, High Profile do Level 4.2 i peak ≤ 200% średniej dla VOD. [YouTube Help 1722171; Streaming Learning Center; Wowza]
- **Obrazy:** OWASP File Upload Cheat Sheet zaleca whitelistę rozszerzeń i typów, weryfikację sygnatury, limity rozmiaru, przepisanie (re-encode) obrazu oraz przechowywanie poza webrootem pod losową nazwą. SVG może zawierać skrypty. [OWASP File Upload CS]

### Rekomendacja dla naszego stosu

**Upload wideo (zostaje S3 multipart na R2)**

1. `POST /api/uploads` → use-case `reserveUpload(actor, channelId, {size, mime, filename})`:
   - `assertCan(actor, 'video:create', channel)`, sprawdzenie, że `channel.status === ACTIVE` i że globalny kill-switch `uploadsEnabled` jest włączony.
   - Kwoty w jednej transakcji z `SELECT ... FOR UPDATE` na wierszu `ChannelQuota` (albo z atomowym `UPDATE ... WHERE used + $n <= limit RETURNING`):
     - `maxFileBytes` (np. 4 GB dla TL0, 20 GB dla TL2),
     - `maxUploadsPerDay` (TL0: 3, TL1: 10, TL2: 30),
     - `maxBytesPerDay` i `maxStorageBytesTotal` (np. 50 GB dla nowego kanału),
     - limit długości wideo sprawdzany po ffprobe (TL0: 15 min, jak YouTube bez weryfikacji; po weryfikacji telefonu lub Stripe: 2–4 h).
   - Tworzy `Upload { id, channelId, key: originals/{channelId}/{uploadId}, status: RESERVED, expiresAt }` i zwraca `uploadId` oraz `createMultipartUpload`.
   - Rate limit w Redis per user i per IP (już istnieje) jako dodatkowa warstwa, nie główna.
2. Klient: Uppy `@uppy/aws-s3` z `shouldUseMultipart: true`, a `signPart` przez nasz endpoint, który sprawdza, że `uploadId` należy do aktora i że numer części ≤ wyliczonego maksimum dla zadeklarowanego rozmiaru.
3. `complete`: serwer robi `HeadObject` (rzeczywisty rozmiar ≤ zarezerwowany) i odczyt pierwszych bajtów (magic bytes, co już robimy), a potem przełącza status na `UPLOADED` i w tej samej transakcji tworzy `EncodeJob` (to jest outbox).
4. Rozliczenie kwot: przy `complete` bierzemy rzeczywisty rozmiar, a przy wygaśnięciu lub odrzuceniu zwalniamy rezerwację.

**Lifecycle i GC**

- R2: zostawiamy domyślną regułę 7 dni dla niedokończonych multipartów, a dla prefiksu `originals/` skracamy ją do 2 dni.
- Job `gcOrphans` co godzinę:
  - `Upload` w stanie `RESERVED` lub `UPLOADING` po `expiresAt` → `AbortMultipartUpload` i `EXPIRED`;
  - obiekty w `originals/` bez wiersza `Upload` → usunięcie po 48 h (listowanie po prefiksie kanału);
  - `Video.deletedAt` + 30 dni → usunięcie prefiksów `hls/{videoId}/`, `thumbs/{videoId}/`, oryginału i kopii publicznej miniatury. Każde usunięcie to rekord `StorageDeletion` (idempotentny, z ponowieniami).
- Opcja kosztowa: oryginały po 30 dniach od udanego kodowania przenosimy do Infrequent Access (0,01 zamiast 0,015 USD/GB-mies.) albo usuwamy, jeśli kanał nie ma uprawnień „keep originals”. Decyzja zależy od tego, czy chcemy kiedyś przekodować drabinę (np. na AV1). Zalecam zachowanie oryginałów w IA.

**Sandbox encodera**

- Dzielimy kontener na dwa procesy lub dwa kontenery:
  - `encoder-io`: ma sieć do R2 i Postgresa. Pobiera oryginał na lokalny wolumen, potem wysyła wyniki. **Nie parsuje mediów.**
  - `encoder-sandbox`: uruchamiany per zadanie przez `docker run --rm --network none --read-only --tmpfs /tmp:size=… --cap-drop ALL --security-opt no-new-privileges --security-opt seccomp=default --pids-limit 256 --memory 3g --memory-swap 3g --cpus 1.5 --user 10001:10001 -v job/in:/in:ro -v job/out:/out`. Zamiast Docker-in-Docker lepszy jest systemd-run lub bubblewrap na hoście, albo gVisor (`--runtime=runsc`), jeśli koszt wydajności jest akceptowalny.
- Kolejność w sandboksie:
  1. `ffprobe -v error -show_format -show_streams -of json -protocol_whitelist file /in/src`. Odrzucamy pliki, gdy: brak strumienia wideo, więcej niż 1 strumień wideo lub więcej niż 8 strumieni łącznie, rozdzielczość > 4096×4096 (dla TL0 > 1920×1080 → downscale), FPS > 120, czas > limit kwoty, format spoza whitelisty (`mov,mp4,m4a,3gp,3g2,mj2`, `matroska,webm`, `avi`?).
  2. Transkodowanie z `-protocol_whitelist file`, jawnym `-f` dla wejścia zgodnym z wynikiem probe, `-max_muxing_queue_size`, `-threads N`, a całość pod `timeout --kill-after=30s (duration*X + Y)`.
  3. Limit wyjścia: sumaryczny rozmiar `/out` przez tmpfs size. Chroni to przed bombą dekompresyjną, czyli małym plikiem o ogromnej rozdzielczości lub długości.
- Aktualizacje: obraz bazowy z pinowanym ffmpeg (np. statyczny build z wersją z digestem), Renovate lub Dependabot dla digestów i cotygodniowy rebuild. Śledzimy security-mailing ffmpeg i NVD.
- Crash lub OOM w sandboksie to błąd zadania, który ponawiamy maksymalnie 2 razy. Kolejne błędy dają `DEAD`, a moderator dostaje sygnał „podejrzany plik”.

**Kolejka: fair scheduling, priorytety, retry, dead letter**

Proponowane pola `EncodeJob`: `id, videoId, channelId, priority (0 = premium/admin, 1 = normalny, 2 = backfill), status (QUEUED | RUNNING | SUCCEEDED | FAILED | DEAD | CANCELLED), attempts, maxAttempts=3, runAfter, leaseUntil, workerId, lastError, createdAt`.

Claim (prosty round-robin wystarczający przy dziesiątkach lub setkach kanałów):

```sql
WITH running AS (
  SELECT channel_id, count(*) c FROM encode_job WHERE status='RUNNING' GROUP BY channel_id
), candidates AS (
  SELECT DISTINCT ON (j.channel_id) j.id
  FROM encode_job j
  LEFT JOIN running r ON r.channel_id = j.channel_id
  WHERE j.status='QUEUED' AND j.run_after <= now() AND coalesce(r.c,0) < 1  -- limit 1 równoległe na kanał
  ORDER BY j.channel_id, j.priority, j.created_at
)
SELECT j.* FROM encode_job j
JOIN candidates c ON c.id=j.id
ORDER BY j.priority, (SELECT max(finished_at) FROM encode_job x WHERE x.channel_id=j.channel_id) NULLS FIRST, j.created_at
LIMIT 1
FOR UPDATE OF j SKIP LOCKED;
```

(W praktyce `last_served_at` trzymamy w tabeli `ChannelQueueState`, a nie w podzapytaniu. Kanał, który najdawniej był obsłużony, idzie pierwszy.) Gdy metryki pokażą problem, przechodzimy na schemat blokowy Hatcheta.

- Lease: `leaseUntil = now()+5 min` odnawiany heartbeatem co minutę. Reaper przywraca `RUNNING` z przeterminowanym lease do `QUEUED` i zwiększa `attempts`.
- Retry z backoffem wykładniczym (`runAfter = now() + 2^attempts min`). Błędy deterministyczne (nieobsługiwany kodek, plik uszkodzony) od razu idą do `FAILED`, bez ponawiania.
- Dead letter: status `DEAD` jest widoczny w adminie, z przyciskiem „retry” (zapisywanym w audycie) i powiadomieniem twórcy.

**Drabina dla UGC**

Proponowana drabina H.264 (High, `-preset veryfast` lub `faster` dla TL0/TL1, `medium` dla zaufanych), AAC-LC 128 kbps stereo, segmenty 6 s, GOP 2 s, `-sc_threshold 0`:

| Rendycja | Rozdzielczość | Średnio | Max (VBV) |
|---|---|---|---|
| 1080p | 1920×1080 | 5,0 Mbps | 7,5 Mbps |
| 720p | 1280×720 | 2,8 Mbps | 4,2 Mbps |
| 480p | 854×480 | 1,2 Mbps | 1,8 Mbps |
| 360p | 640×360 | 0,7 Mbps | 1,05 Mbps |

- Nie robimy upscale'u: drabina kończy się na rozdzielczości źródła.
- 1440p i 4K tylko dla kanałów z flagą `allow4k`, bo koszt CPU rośnie około 2–4×.
- High frame rate (50/60) przepuszczamy tylko dla ≥ 720p, z bitrate × 1,5.
- Ograniczenie wejścia: TL0 skalujemy do maksymalnie 1080p i 60 fps.

**Miniatury**

- Generowane w tym samym sandboksie: `ffmpeg -ss {10%, 30%, 50%} -i … -frames:v 1 -vf scale=1280:-2` → WebP lub AVIF. Twórca wybiera jedną albo wgrywa własną.
- Te same klatki trafiają do skanu bezpieczeństwa (sekcja 3).

**Obrazy (awatary, bannery, miniatury własne)**

- Whitelist typów: JPEG, PNG, WebP (AVIF opcjonalnie). **SVG zakazane** (może zawierać skrypty). GIF animowany tylko po konwersji do statycznego WebP.
- Limity: awatar ≤ 5 MB i ≤ 4096×4096 px, banner ≤ 10 MB. Wymiary sprawdzamy z nagłówka **przed** pełnym dekodowaniem (`sharp(...).metadata()`), z ustawionym `limitInputPixels` (np. 40 MP). To chroni przed bombami pikselowymi.
- Zawsze robimy re-encode przez `sharp`: `.rotate()` (zastosowanie orientacji EXIF), `.resize()` do docelowych rozmiarów i `.webp({quality: 82})`. Metadane (EXIF, GPS, XMP, ICC poza sRGB) są domyślnie odrzucane, bo sharp nie kopiuje ich bez `withMetadata()`.
- Przetwarzanie obrazów też odbywa się w workerze (może to być `encoder-sandbox` z innym poleceniem), a nie w procesie Next.js. libvips i libheif również mają CVE.
- Serwowanie: publiczny bucket z `Content-Type` ustawionym przez nas, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` i osobną domeną (np. `img.pawelperfect.com`, cookieless), żeby wyeliminować ryzyko XSS z treści użytkownika.

---

## 3. Bezpieczeństwo treści na małej platformie

### Co mówią źródła

- **Cloudflare CSAM Scanning Tool** porównuje „content served for your website through the Cloudflare cache” z listami znanego CSAM (np. NCMEC). Przy dopasowaniu wysyła raz dziennie e-mail ze ścieżkami i, jeśli to możliwe, blokuje serwowanie. Prawne obowiązki (zgłoszenie do NCMEC lub właściwych organów, zabezpieczenie danych, usunięcie) spoczywają na właścicielu strony. Dokumentacja mówi o obrazach i nie wspomina o wideo. [Cloudflare CSAM Scanning docs]
- **PhotoDNA Cloud Service** (Microsoft) jest bezpłatny dla „qualified organizations”, w tym firm technologicznych i deweloperów. Kwalifikację zatwierdza zewnętrzny podmiot weryfikujący. Wolno go używać wyłącznie do zwalczania CSAM, a Microsoft może audytować użycie. [Microsoft PhotoDNA]
- **Thorn Safer:** cennik niepubliczny (kontrakt przez sprzedaż, również przez AWS Marketplace). Safer Match obejmuje hashowanie kryptograficzne i percepcyjne obrazów oraz wideo (scene-sensitive video hashing). Produkt jest kierowany do „any platform with an upload button”. [Thorn Safer; AWS Marketplace]
- **Workers AI:** w katalogu jest `@cf/microsoft/resnet-50` (ImageNet, nie NSFW), modele wizyjne (Gemma, Kimi, LLaVA) i, według źródeł wtórnych, Llama Guard dla tekstu. Nie znalazłem oficjalnego dedykowanego klasyfikatora NSFW. Cloudflare publikuje architekturę referencyjną „serverless image content management” (Worker klasyfikuje obraz, a wynik trafia do metadanych w R2). [Workers AI; Cloudflare ref. architecture]
- **Otwarte klasyfikatory NSFW:** np. `Falconsai/nsfw_image_detection` (ViT, binarny normal/nsfw). Do tekstu i podpisów: Llama Guard 3/4. [Replicate collection]
- **Copyright:** Chromaprint i acoustid-index to otwarte, self-hostowane rozwiązania do dopasowań „near-identical” względem **własnej** biblioteki referencyjnej. Indeks jest append-only. Audible Magic: brak publicznego cennika. W badaniu z 2017 r. tier dla małych OSP szacowano na około 900 EUR/mies., a dla średnich na 10–25 tys. USD/mies. Pex Attribution Engine deklaruje darmowe skanowanie dla platform i model revenue share z licencji, ale dopasowuje do **swojego** rejestru. [Chromaprint; acoustid-index; Copybuzz 2024; Pex]
- **Discourse trust levels:** TL0 to sandbox (ograniczenia linków, obrazów, wiadomości prywatnych, flagowania, rate limity). Awans na TL1 jest automatyczny po niewielkiej aktywności (np. 5 tematów, 30 przeczytanych postów, 10 minut czytania). Nowsze wersje przechodzą na uprawnienia oparte na grupach. [Discourse blog]
- **DSA:** art. 17 wymaga wręczenia uzasadnienia (statement of reasons) przy każdym ograniczeniu, zarówno za treść nielegalną, jak i za naruszenie regulaminu. Zawiera ono m.in. rodzaj decyzji, fakty, informację o użyciu automatyzacji oraz podstawę prawną lub regulaminową. Art. 24(5): przesyłanie SoR do DSA Transparency Database dotyczy platform poza mikro- i małymi przedsiębiorstwami (< 50 osób, ≤ 10 mln EUR). Bez danych osobowych, przez API po onboardingu u koordynatora DSC. [EC DSA Transparency DB onboarding; Lewis Silkin]

### Rekomendacja dla naszego stosu

**CSAM: warstwy**

1. **Natychmiast:** włączyć Cloudflare CSAM Scanning Tool dla strefy z publicznymi miniaturami (bucket publiczny za custom domain, serwowany przez cache). Pokrywa to tylko obrazy w cache, nie HLS w prywatnym R2.
2. **Przed otwarciem uploadów dla wszystkich:** złożyć wniosek o PhotoDNA Cloud Service. Równolegle wysłać zapytanie o Safer (Essential lub Match), które obsługuje wideo. Do czasu akceptacji: **nowe kanały nie publikują bez ręcznej akceptacji** (moderacja wstępna), a uploady wideo ograniczamy do kont zweryfikowanych (telefon lub Stripe Connect onboarding).
3. **Integracja w pipeline:** encoder wyciąga N klatek (np. 1 klatka na 10 s, maks. 60 na wideo, plus klatki z detekcją zmiany sceny `select='gt(scene,0.4)'`) i miniatury. Liczy hash (PhotoDNA lub Safer) przez usługę `content-scan` (osobny kontener z siecią, bo sandbox jej nie ma) i porównuje.
4. **Procedura przy trafieniu:** automatyczne `moderationStatus = REMOVED_CSAM`, natychmiastowe odcięcie dostępu (Worker sprawdza status lub unieważnia token), blokada konta, zabezpieczenie materiału w odizolowanym buckecie z dostępem tylko dla superadmina (dokumentacja Cloudflare mówi o przechowywaniu informacji przez rok) i zgłoszenie do właściwego organu. W Polsce to Dyżurnet.pl i policja, a NCMEC dotyczy USA. Trzeba to potwierdzić z prawnikiem. Proces jest opisany w runbooku, a moderatorzy nie oglądają materiału bez potrzeby.

**NSFW i przemoc**

- Model `Falconsai/nsfw_image_detection` (ONNX) uruchamiany w kontenerze `content-scan` na CPU. Na 60 klatkach to kilka sekund. Progi dzielimy na trzy strefy: `>0.9` daje automatycznie `LIMITED` i kolejkę do review, `0.6–0.9` to review bez ograniczenia, poniżej nie robimy nic.
- Alternatywa bez własnej infrastruktury: Worker z modelem wizyjnym z Workers AI i promptem klasyfikacyjnym. Jest mniej przewidywalny, więc warto go traktować jako drugi sygnał, nie jako jedyny.
- Tekst (tytuły, opisy, komentarze): Llama Guard na Workers AI lub lokalnie, plus listy słów i regexy linków. Wynik to „sygnał”, nie decyzja.

**Copyright**

- Na start: procedura notice-and-action (formularz zgłoszenia naruszenia praw autorskich, ścieżka DSA/DMCA-like, counter-notice), a powtarzające się naruszenia blokują konto (zasada „three strikes”).
- Opcjonalnie: Chromaprint (`fpcalc` z audio wyciągniętego w sandboksie) i własny `acoustid-index` z odciskami treści, które już raz usunęliśmy (re-upload detection). To tanie i skuteczne przeciw ponownym uploadom.
- Audible Magic i Pex dopiero przy realnym problemie z muzyką. Pex warto rozważyć ze względu na brak kosztów stałych, ale wymaga to weryfikacji umowy.

**Spam, farmy kont i poziomy zaufania**

- Rejestracja: Turnstile (już w ekosystemie Cloudflare) przy rejestracji, logowaniu, tworzeniu kanału, pierwszym uploadzie i komentarzach anonimowo-podobnych. Weryfikacja tokenu Turnstile **po stronie serwera** z `remoteip`.
- `User.trustLevel` (0–3) liczony jobem:
  - TL0: konto < 7 dni lub niezweryfikowany e-mail. Brak uploadu wideo albo upload z moderacją wstępną, maks. 3 komentarze na 10 minut, brak linków w komentarzach i opisach, brak napiwków wychodzących powyżej X.
  - TL1: zweryfikowany e-mail i wiek konta ≥ 7 dni lub weryfikacja telefonu. Upload do 15 minut, publikacja z automatycznym skanem i bez moderacji wstępnej, jeśli skan jest czysty.
  - TL2: zakończony onboarding Stripe Connect lub ręczny awans. Wyższe limity i dłuższe filmy.
  - TL3 / „verified”: nadawany ręcznie.
- Zgodnie z kierunkiem Discourse uprawnienia mapujemy na **grupy lub uprawnienia** (`capabilities`), a nie bezpośrednio na liczby. `trustLevel` wyznacza domyślny zestaw, który admin może nadpisać per użytkownik lub kanał.
- Sygnały farm kont: ten sam hash urządzenia lub IP /24 dla wielu rejestracji, e-maile jednorazowe (lista domen), wzorzec „nowe konto → link w komentarzu”. W Redis trzymamy liczniki, a w Postgresie `RiskSignal`.
- Komentarze: shadow-hold (komentarz widoczny tylko dla autora, dopóki nie przejdzie filtra) dla TL0. Właściciel kanału może włączyć „wstrzymuj komentarze z linkami” lub „wszystkie do akceptacji”.

**Kolejka zgłoszeń i moderacja (projekt)**

- `Report { id, reporterId?, targetType, targetId, reason (enum: CSAM, ILLEGAL, HATE, HARASSMENT, SPAM, COPYRIGHT, IMPERSONATION, OTHER), details, createdAt, sourceIpHash }`. Wiele zgłoszeń agreguje się w `ModerationCase { id, targetType, targetId, status, priority, assigneeId, slaDueAt, openedAt, closedAt }`.
- Stany case'a: `OPEN → IN_REVIEW → (ACTIONED | DISMISSED) → (APPEALED → APPEAL_REVIEW → UPHELD | REVERSED)`. Priorytet zależy od kategorii (CSAM i zagrożenie życia: P0 z SLA < 1 h, nielegalne: 24 h, regulamin: 72 h).
- `ModerationDecision` (niemutowalny, tylko INSERT): `caseId, decidedBy (user or 'automation:<model@version>'), action (REMOVE, LIMIT_VISIBILITY, DEMONETIZE, SUSPEND_CHANNEL, WARN, NO_ACTION), groundType (ILLEGAL | TOS), legalReference?, tosClause?, facts, automatedDetection: bool, automatedDecision: bool, territorialScope, durationUntil?, createdAt`. To jest nasz rekord **statement of reasons**. Wysyłamy go użytkownikowi e-mailem (przez outbox) i pokazujemy w panelu twórcy z przyciskiem odwołania.
- Odwołania rozpatruje inna osoba niż autor decyzji (wymuszone w polityce).
- Pole `transparencyDbSubmittedAt` dodajemy od razu, nawet jeśli dziś jesteśmy zwolnieni z art. 24(5). Przy wzroście wystarczy dopisać wysyłkę bez danych osobowych.
- Audit: każda akcja moderatora trafia też do `AuditLog` (kto, co, kiedy, IP, uzasadnienie).

---

## 4. Handle i URL-e

### Co mówią źródła

- **Next.js App Router:** katalog z prefiksem `@` to „slot” parallel routes, a nie segment URL, więc nie da się wprost zrobić folderu `app/@[handle]`. Typowe obejście to rewrite `/@:handle` → `/c/:handle` (w `next.config` lub w `proxy.ts`). Kolejność rewrite'ów (`beforeFiles`, `afterFiles`, `fallback`) ma znaczenie. Bywają problemy z kodowaniem `%40` zależne od środowiska. [Next.js rewrites docs; GitHub issue; zenn.dev]
- **UTS #39:** algorytm „skeleton” (usuń znaki Default_Ignorable, NFD, zamień na prototypy z `confusables.txt`, NFD) pozwala wykryć wizualnie mylące ciągi: równe szkielety oznaczają ryzyko pomyłki. Wykrywanie mieszania pism (restriction levels) to osobny mechanizm. Ekosystem JS nie ma dojrzałej biblioteki, a ICU (`SpoofChecker`) jest dostępny np. w PHP. [Unicode UTS #39; wyniki wyszukiwania]
- **Postgres:** `citext` lub unikalny indeks na wyrażeniu `lower(handle)` zapewnia unikalność niewrażliwą na wielkość liter. Kolacje niedeterministyczne ICU (`deterministic=false`) są alternatywą, ale mają ograniczenia (np. `LIKE` do PG16; w PG17 częściowo wspierane). [Postgres docs citext, collation]

### Rekomendacja dla naszego stosu

- **Format handle:** `^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$`, bez `..`, `._`, `_.`, przechowywany już znormalizowany do lowercase. Wyłącznie ASCII, co eliminuje homoglify w handle (tak robią m.in. Instagram i X). Nazwa wyświetlana kanału (`displayName`) może być Unicode (np. polskie znaki), ale:
  - NFC, usuwamy Default_Ignorable i znaki bidi-override, limit długości w grafemach;
  - liczymy `displayNameSkeleton` (port `confusables.txt`, około 6 tys. mapowań; prosty do wygenerowania skryptem z danych Unicode i trzymany w repo z wersją danych) i blokujemy lub flagujemy nowy kanał, którego skeleton nazwy jest równy skeletonowi kanału zweryfikowanego.
- **Unikalność:** `CREATE EXTENSION citext; handle citext UNIQUE` albo `@@unique` na kolumnie i dodatkowy indeks `CREATE UNIQUE INDEX ON channel (lower(handle))` w migracji SQL (Prisma nie modeluje indeksów wyrażeniowych, więc robimy to w surowej migracji i opisujemy w schemacie komentarzem).
- **Zastrzeżone nazwy:** `ReservedHandle` w bazie (zarządzana z admina) plus seed: `admin, administrator, api, app, www, mail, support, help, about, terms, privacy, legal, dmca, abuse, security, status, blog, docs, dev, static, assets, cdn, img, video, media, upload, uploads, login, logout, signin, signup, register, auth, oauth, settings, account, dashboard, studio, channel, channels, c, u, user, users, watch, search, explore, trending, feed, subscriptions, notifications, tips, pay, payments, stripe, billing, moderator, mod, staff, team, official, pawelperfect, root, system, null, undefined, me, self, new, edit, delete`. Do tego wszystkie kody locale (`pl`, `en`, …) oraz nazwy istniejących segmentów tras, sprawdzane testem, który skanuje `app/[locale]/*`. Porównanie z listą idzie po normalizacji: usunięciu `._` i cyfr na końcu, żeby `admin_1` też było flagowane do review.
- **Historia i przekierowania:** `HandleHistory { handle citext UNIQUE, channelId, validFrom, validTo }`. Zmiana handle jest możliwa raz na 30 dni. Stary handle jest „zamrożony” na 90 dni (nikt inny go nie zajmie), a `/@old` daje 301 na `/@new`. Po 90 dniach handle wraca do puli, chyba że kanał był zweryfikowany. Wtedy rezerwujemy go na stałe.
- **Trasy:** `app/[locale]/c/[handle]/(tabs)/…` oraz rewrite w `proxy.ts`: `/:locale(pl|en)/@:handle/:rest*` → `/:locale/c/:handle/:rest*` i analogicznie bez locale z domyślnym językiem. Kanoniczny URL pokazujemy jako `/@handle` (`<link rel=canonical>`). Test e2e sprawdza `@` i `%40`.
- **Wideo:** globalne, stabilne `publicId` w URL `/{locale}/watch/{publicId}` (opcjonalnie z kosmetycznym slugiem `/{locale}/watch/{publicId}/{slug}`, gdzie slug jest ignorowany przy rozwiązywaniu i poprawiany przez 301). Nie robimy slugów per kanał jako identyfikatora, bo zmiana handle lub tytułu łamałaby linki, a powstają kolizje. Link `/@handle/videos` to tylko lista.
- Tokeny HMAC do Worker'a wiążemy z `videoId` (wewnętrznym lub publicznym), a nie z handle.

---

## 5. Model danych kanałów

### Co mówią źródła

- **Transactional outbox** (microservices.io): zapis zdarzenia do tabeli outbox w tej samej transakcji co zmiana stanu, a osobny relay publikuje. Daje to semantykę at-least-once, więc odbiorcy muszą być idempotentni. [microservices.io outbox]
- **Expand/contract (Parallel Change)** (Fowler): rozszerzamy schemat, migrujemy klientów, a na końcu zwężamy. [martinfowler.com]
- Soft delete: częsta praktyka to `deletedAt` plus filtr. Ryzyka to zapomniane filtry, kolizje unikalności i RODO (prawo do usunięcia), stąd wzorzec „soft delete z terminem hard delete”. (Ogólna praktyka branżowa; brak jednego kanonicznego źródła.)

### Rekomendacja dla naszego stosu

**Encje (skrót schematu Prisma)**

```prisma
model Channel {
  id            String   @id @default(cuid())
  handle        String   @unique            // citext w migracji
  displayName   String
  displayNameSkeleton String
  status        ChannelStatus @default(PENDING_REVIEW)
  statusReason  String?
  verifiedAt    DateTime?
  createdById   String
  stripeAccountId String? @unique
  deletedAt     DateTime?
  purgeAfter    DateTime?
  // denormalizacje
  subscriberCount Int @default(0)
  videoCount      Int @default(0)
  members  ChannelMember[]
  videos   Video[]
  @@index([status])
}
enum ChannelStatus { PENDING_REVIEW ACTIVE RESTRICTED SUSPENDED DELETED }

model Video {
  id               String @id @default(cuid())
  publicId         String @unique   // 11 znaków base62
  channelId        String
  uploaderId       String
  processingStatus ProcessingStatus  // UPLOADING, QUEUED, PROCESSING, READY, FAILED
  publicationStatus PublicationStatus // DRAFT, SCHEDULED, PUBLISHED, UNLISTED, PRIVATE
  moderationStatus ModerationStatus  // PENDING_REVIEW, APPROVED, LIMITED, AGE_RESTRICTED, REMOVED
  publishedAt      DateTime?
  deletedAt        DateTime?
  viewCount        BigInt @default(0)
  @@index([channelId, publishedAt(sort: Desc)])
}
```

- **Widoczność publiczna** jest funkcją, nie kolumną: `isPubliclyVisible = channel.status ∈ {ACTIVE, RESTRICTED} ∧ video.publicationStatus = PUBLISHED ∧ video.moderationStatus ∈ {APPROVED, AGE_RESTRICTED} ∧ processingStatus = READY ∧ deletedAt IS NULL`. Funkcja żyje w domenie i w `scopeFor` (sekcja 1), a to samo wyrażenie sprawdza endpoint wydający token HMAC.
- **Maszyny stanów:** `ChannelStatus` i `ModerationStatus` mają jawne tablice dozwolonych przejść w `domain/` (np. `SUSPENDED → ACTIVE` tylko przez `platform:moderate` z decyzją moderacyjną). Każde przejście emituje `DomainEvent`. Ochrona przed współbieżnością: `UPDATE ... WHERE id=$1 AND status=$expected` (optimistic) i sprawdzenie liczby zmienionych wierszy.
- **RESTRICTED**: kanał widoczny, ale bez uploadu, napiwków i rekomendacji. **SUSPENDED**: niewidoczny publicznie, właściciel widzi panel z SoR i może się odwołać. **DELETED**: soft delete, `purgeAfter = now()+30d`, potem job usuwa media i anonimizuje. Rekordy finansowe (`Tip`) zostają przez okres wymagany prawem (np. 5 lat), z odpięciem danych osobowych.
- **Unikalność a soft delete:** handle usuniętego kanału przechodzi do `HandleHistory` (zamrożony), a kolumna w `Channel` dostaje wartość `deleted_<id>`. Dzięki temu unikalny indeks nie blokuje.
- **Liczniki:**
  - `subscriberCount` aktualizujemy w tej samej transakcji co `Subscription` insert/delete (`UPDATE channel SET subscriber_count = subscriber_count + 1`). Przy obecnej skali hot-row nie jest problemem. Nocny job rekoncyliuje z `COUNT(*)`.
  - `viewCount`: zliczenia trafiają do Redis (`HINCRBY views:{videoId}` z deduplikacją per sesja/IP przez `SET NX EX 30min`), a job co minutę zrzuca je batchowo do Postgresa (`UPDATE … FROM (VALUES …)`). Nie robimy `UPDATE` na wierszu wideo przy każdym odtworzeniu.
- **Audit i zdarzenia:**
  - `AuditLog` (append-only, kto, co, na czym, diff, IP, userAgent, `actorContext`, `impersonatorId?`, `reason?`) zostaje dla akcji ludzkich, zwłaszcza w adminie.
  - `DomainEvent` (lub tabela `Outbox`) `{ id, aggregateType, aggregateId, type, payload jsonb, createdAt, processedAt, attempts, lastError }`. Jeden dispatcher w workerze robi `SELECT … FOR UPDATE SKIP LOCKED LIMIT 50`, a handlery to e-maile, wywołania Stripe, invalidacje cache, skan treści i indeksowanie wyszukiwarki. Istniejącą kolejkę e-maili warto przepiąć na ten mechanizm, żeby mieć jeden wzorzec.
  - Zasada: **żadnych wywołań zewnętrznych (Stripe, e-mail, R2 delete) wewnątrz transakcji**. Use-case zapisuje stan i zdarzenie, a resztę robi handler, który jest idempotentny (klucz idempotencji = `event.id`).
- **Uprawnienia granularne:** `ChannelFeature { channelId, key, value jsonb, setBy, setAt }` dla flag per kanał (sekcja 9).

---

## 6. Feedy i odkrywanie bez ML

### Co mówią źródła

- **Hacker News:** w uproszczeniu `(P-1)/(T+2)^G` z `G=1.8`. Rzeczywisty kod news.arc stosuje `(score-1)^0.8 / (age_hours+2)^1.8` plus kary. Wyższy wykładnik przy czasie oznacza, że wynik zawsze w końcu spada. [righto.com; Salihefendic]
- **Reddit hot:** `sign(s)·log10(max(|s|,1)) + seconds/45000`. Logarytm sprawia, że pierwsze 10 głosów waży tyle co kolejne 100. 45 000 s to 12,5 h, co odpowiada 10× różnicy. Obecny algorytm Reddita nie jest publiczny. Komentarze sortowano przedziałem Wilsona. [Salihefendic; Lemmy ranking doc]
- **Postgres FTS:** brak polskiego stemmera Snowball w dystrybucji. Polski wymaga słownika Hunspell/Ispell (pliki z LibreOffice, np. przez pg_hunspell) z instalacją do `tsearch_data`. [pg_hunspell; Postgres docs textsearch-dictionaries]

### Rekomendacja dla naszego stosu

- **Feed subskrypcji (fan-out on read):**
  ```sql
  SELECT v.* FROM video v
  WHERE v.channel_id IN (SELECT channel_id FROM subscription WHERE user_id = $1)
    AND <isPubliclyVisible>
    AND (v.published_at, v.id) < ($cursorTs, $cursorId)
  ORDER BY v.published_at DESC, v.id DESC LIMIT 24;
  ```
  Indeks `(channel_id, published_at DESC, id DESC)` z warunkiem częściowym `WHERE publication_status='PUBLISHED' AND moderation_status IN (...) AND deleted_at IS NULL`. Przy subskrypcjach do kilkuset kanałów Postgres robi tu Merge Append lub sortowanie małego zbioru. Fan-out on write (tabela `FeedItem`) ma sens dopiero przy milionach wierszy i bardzo popularnych kanałach.
- **„Najnowsze”:** ten sam indeks bez filtra kanału, plus filtr jakości: kanał `ACTIVE`, nie TL0 (żeby nowe konta nie spamowały strony głównej).
- **Trending:** job co 15 minut liczy wynik do `VideoScore(videoId, window, score, computedAt)`:
  `score = (w_v·views_24h + w_l·likes + w_c·comments + w_t·tipsCount)^0.8 / (ageHours + 2)^1.8`,
  gdzie `views_24h` pochodzi z unikalnych odsłon (Redis HyperLogLog per wideo per godzina). Ograniczenia: maksymalnie 2 wideo z jednego kanału w top N (różnorodność) i wykluczenie TL0 oraz `LIMITED`.
- **Wyszukiwarka:**
  - Kolumna generowana `search_vector tsvector` = `setweight(to_tsvector('simple', unaccent(title)),'A') || setweight(to_tsvector('simple', unaccent(description)),'C') || setweight(to_tsvector('simple', unaccent(channel_display_name)),'B')`. Uwaga: `unaccent` nie jest `IMMUTABLE`, więc trzeba go opakować we własną funkcję `immutable_unaccent` (znany wzorzec) albo liczyć wartość triggerem.
  - Konfiguracja `simple` + `unaccent` działa dobrze dla PL i EN bez stemmingu. Dodatkowo `english` dla treści oznaczonych jako EN, jeśli mamy `Video.language`. Polski stemming przez Hunspell jest możliwy, ale komplikuje obraz Dockera Postgresa (pliki w `tsearch_data`). Odkładamy go do etapu „search quality”.
  - `pg_trgm` z indeksem GIN na `immutable_unaccent(lower(title))` do dopasowań fuzzy i autouzupełniania (`similarity`, `%`), oraz na `handle` i `displayName` dla wyszukiwania kanałów.
  - Ranking: `ts_rank_cd` × współczynnik świeżości × log(views). Paginujemy offsetem do 10 stron, dalej nie pozwalamy.
  - Gdy treści będzie dużo (setki tysięcy wideo) lub potrzebna będzie odporność na literówki w wielu językach, kolejnym krokiem jest Meilisearch lub Typesense indeksowane z outboxa.
- **Cache:**
  - Strony publiczne (kanał, watch dla gościa, trending) cache'ujemy przez Next.js (`'use cache'`/`cacheTag`, `revalidateTag` z handlerów outboxa) oraz w Cloudflare z krótkim `s-maxage`, ale **tylko odpowiedzi bez sesji**. Część zależną od użytkownika (subskrybuję, polubiłem, panel twórcy) renderujemy osobno: dynamicznie, z `Cache-Control: private, no-store`, albo jako klient-komponent z endpointu prywatnego.
  - Reguła Cloudflare: bypass cache przy obecności cookie sesji Better Auth. Test e2e loguje się jako A, potem jako gość pobiera tę samą stronę i sprawdza brak danych A.
  - Feed subskrypcji nie jest nigdy cache'owany współdzielenie. Ewentualnie trzymamy go w Redis per user z TTL 60 s.

---

## 7. Stripe Connect: inżynieria płatności

### Co mówią źródła

- **Connect webhooks:** platforma ma dwa typy endpointów: „Account” (zdarzenia własnego konta) i „Connect” (zdarzenia kont podłączonych; w API `connect: true`). Zdarzenia z kont podłączonych mają pole `account`. Na produkcyjny endpoint Connect przychodzą też zdarzenia testowe, więc trzeba sprawdzać `livemode`. Każdy endpoint ma swój sekret podpisu. [Stripe Connect webhooks]
- **Idempotencja:** Stripe przechowuje wynik pierwszego żądania z danym `Idempotency-Key` (także błędy) i może usuwać klucze starsze niż 24 h. Ponowienie z innymi parametrami zwraca błąd. Klucz ma do 255 znaków. [Stripe idempotent requests]
- **Kolejność i duplikaty webhooków:** brak gwarancji kolejności, duplikaty są normalne. Zalecenia: deduplikacja po `event.id`, szybka odpowiedź 2xx i przetwarzanie asynchroniczne, traktowanie zdarzenia jako wyzwalacza i pobranie aktualnego obiektu z API albo zapis warunkowy z wersją lub znacznikiem czasu. [Stripe webhooks; Hookdeck]
- **Stan konta:** `charges_enabled`, `payouts_enabled`, `requirements.currently_due`, `current_deadline`, `disabled_reason` (np. `platform_paused` przy pauzie nałożonej przez platformę). Funkcje włączamy, gdy `currently_due` i `pending_verification` są puste, a `disabled_reason` jest null. [Stripe handling verification; pausing payments]
- **Refundy i spory (destination charges):** pełny refund odwraca cały transfer, częściowy proporcjonalną część (przy `reverse_transfer=true`). Opłatę aplikacyjną platforma domyślnie zatrzymuje, chyba że `refund_application_fee=true`. Spór na destination charge obciąża **platformę**. Odzyskanie środków od twórcy to transfer reversal, a po wygranym sporze można przelać je z powrotem. Przy cross-border mogą wystąpić ograniczenia ponownego przelewu. [Stripe destination charges; Connect disputes]

### Rekomendacja dla naszego stosu

(Wybór typu kont i charge to temat innego agenta. Zakładam destination charges z `application_fee_amount` i ewentualnie `on_behalf_of`.)

- **Endpointy:** `/api/stripe/webhook/platform` i `/api/stripe/webhook/connect`, z osobnymi sekretami (`STRIPE_WEBHOOK_SECRET_PLATFORM`, `..._CONNECT`). Weryfikacja podpisu na **surowym** body (`await req.text()` w route handlerze, bez parsowania). Odrzucamy `livemode` niezgodny ze środowiskiem.
- **Przyjęcie:** `INSERT INTO stripe_event (id, type, account, livemode, payload, received_at) ON CONFLICT (id) DO NOTHING` i natychmiast 200. Przetwarzanie robi worker (`SKIP LOCKED`) z retry i `DEAD`. Handler jest wyzwalaczem: dla `account.updated` robi `stripe.accounts.retrieve(account)`, dla `payment_intent.*` pobiera PI z `expand: ['latest_charge.transfer']`. Lokalny stan aktualizujemy tylko, gdy `stripe_object.created/updated` jest nowsze albo status jest „dalej” w maszynie stanów (monotoniczność).
- **Mirror konta:** `StripeAccount { id (acct_), channelId UNIQUE, chargesEnabled, payoutsEnabled, detailsSubmitted, disabledReason, currentlyDue jsonb, currentDeadline, country, defaultCurrency, syncedAt }`. Przycisk napiwku jest aktywny tylko, gdy `channel.status=ACTIVE ∧ chargesEnabled ∧ disabledReason IS NULL ∧ tipsEnabled (kill-switch i flaga kanału)`.
- **Ledger napiwków:**
  ```
  Tip { id, publicId, channelId, stripeAccountId (snapshot), tipperUserId?, amount, currency,
        applicationFeeAmount, status: CREATED|REQUIRES_ACTION|SUCCEEDED|FAILED|REFUNDED|PARTIALLY_REFUNDED|DISPUTED|DISPUTE_LOST|DISPUTE_WON,
        paymentIntentId UNIQUE, chargeId, transferId, balanceTransactionId,
        idempotencyKey UNIQUE, createdAt, succeededAt }
  TipLedgerEntry { id, tipId, type: CHARGE|FEE|TRANSFER|REFUND|TRANSFER_REVERSAL|FEE_REFUND|DISPUTE|DISPUTE_FEE|DISPUTE_REVERSAL,
        amount (signed, minor units), currency, stripeObjectId UNIQUE, occurredAt }
  ```
  Ledger jest append-only. Saldo twórcy (do wyświetlenia) to suma wpisów, a nie mutowalna kolumna.
- **Klucze idempotencji:** `tip:{tip.id}:create-pi`, `tip:{tip.id}:refund:{refundRequestId}`, `tip:{tip.id}:reverse:{disputeId}`. `Tip` z `idempotencyKey` powstaje **przed** wywołaniem Stripe (stan `CREATED`). Wywołanie robi handler outboxa albo use-case po commicie. Retry z tym samym kluczem jest bezpieczny w oknie 24 h, a po nim rekoncyliacja sprawdza istnienie PI po `metadata.tipId` (search API lub `list` z filtrem).
- **Konto wyłączone w trakcie płatności:** przed utworzeniem PI sprawdzamy mirror i świeżość (`syncedAt` < 1 h, w przeciwnym razie `retrieve`). Jeśli PI zostanie utworzony, a konto stanie się nieaktywne, Stripe może odrzucić transfer lub zwrócić błąd. Obsługujemy `payment_intent.payment_failed` i błędy API z kodem dotyczącym konta jako stan `FAILED` z komunikatem dla tippera, bez retry. Gdy płatność przeszła, ale konto zostało zawieszone przez nas (`platform_paused`), środki zostają na saldzie twórcy, a wypłaty wstrzymuje Stripe. To decyzja produktowo-prawna (inny agent).
- **Refundy:** use-case `refundTip(actor, tipId)` (polityka `tip:refund`: superadmin, ewentualnie właściciel kanału w X dni) → `refunds.create({payment_intent, reverse_transfer: true, refund_application_fee: <polityka>}, {idempotencyKey})`. Stan aktualizujemy wyłącznie z webhooka `charge.refunded` lub `refund.updated`.
- **Spory:** `charge.dispute.created` → `Tip.status=DISPUTED`, wpis ledger `DISPUTE`, automatyczny `transfers.createReversal(transferId, {amount})` (z idempotencją), powiadomienie twórcy przez outbox. `charge.dispute.closed` z `won` → nowy transfer do twórcy (sprawdzamy ograniczenia cross-border).
- **Rekoncyliacja (nocny job):**
  1. `balanceTransactions.list({created: {gte: yesterday}})` dla platformy, plus `transfers.list` i `applicationFees.list`, porównane z `TipLedgerEntry` po `stripeObjectId`. Rozbieżności trafiają do `ReconciliationIssue` i alertu.
  2. Dla każdego `Tip` w stanie przejściowym starszym niż 1 h robimy `retrieve` i naprawiamy stan.
  3. Dla `StripeAccount` z `syncedAt` > 24 h robimy `retrieve`.
- **Testy:** Stripe CLI (`stripe trigger`, `stripe listen --forward-connect-to`) w CI na stagingu oraz testy kontraktowe handlerów z nagranymi payloadami (fixtures), uwzględniające duplikat i odwróconą kolejność.

---

## 8. Ścieżka skalowania

### Co mówią źródła

- **R2:** Standard 0,015 USD/GB-mies. (15 USD/TB), Infrequent Access 0,01 USD/GB-mies. (10 USD/TB), klasa A 4,50 USD/mln, klasa B 0,36 USD/mln, **egress darmowy**. Free tier: 10 GB, 1 mln A, 10 mln B. [R2 pricing]
- **Cloudflare Stream:** 5 USD za 1000 minut przechowywanych (prepaid), 1 USD za 1000 minut dostarczonych. Ingest i kodowanie są darmowe. [Stream pricing]
- **Mux:** kodowanie per minuta zależne od rozdzielczości (wg strony overview pierwsze progi około 0,025 USD/min do 720p, 0,03125 USD/min 1080p). Basic quality ma minimalną opłatę za storage równą jednemu miesiącowi. Storage około 0,003 USD/min/mies. dla 1080p. W 2025 r. Mux obniżył ceny o 17–23%. Dane cenowe były niespójne między stronami, więc trzeba je zweryfikować. [Mux pricing docs]
- **Hetzner:** 15.06.2026 podniósł ceny chmury. Linia CCX (dedykowane vCPU) podrożała około 2–2,2×, np. CCX33 z 62,49 do 138,49 EUR/mies., CCX43 z 124,99 do 275,99 EUR/mies. Zmiana dotyczy nowych zamówień i rescale'ów. To dane ze źródeł wtórnych, do weryfikacji na hetzner.com. [privatedevops.com; spendark]
- **PeerTube:** wzorzec „remote runners” do odciążenia transkodowania z głównego serwera. [PeerTube docs]

### Rekomendacja dla naszego stosu

**Co pęknie pierwsze (2 vCPU / 4 GB)**

1. **CPU encodera.** x264 przy drabinie 4 rendycji 1080p na 2 vCPU koduje szacunkowo wolniej niż w czasie rzeczywistym, czyli godzina materiału to kilka godzin pracy. Jednocześnie zabiera CPU Next.js i Postgresowi. Natychmiast: `--cpus 1` dla encodera, `nice`/`ionice` i `concurrency=1`.
2. **Dysk tymczasowy.** Oryginał plus rendycje plus segmenty mogą zająć 2–3× rozmiaru oryginału. Potrzebny strumieniowy upload segmentów i limit rozmiaru zadania względem wolnego miejsca (sprawdzany przed claimem).
3. **RAM.** Next.js (1–1,5 GB), Postgres (shared_buffers ~1 GB), Redis i ffmpeg (do 1–2 GB przy 1080p z wieloma wyjściami) to OOM przy 4 GB.
4. **Połączenia Postgresa.** Prisma z wieloma instancjami (Next, worker, outbox) × `connection_limit` łatwo przekracza `max_connections=100`. Trzeba jawnie ustawić `connection_limit` per proces (np. web 10, worker 5) i dodać PgBouncer (transaction mode), gdy pojawi się więcej replik. Pamiętajmy: z PgBouncer transaction mode Prisma wymaga `pgbouncer=true` lub zgodnej konfiguracji prepared statements.

**Kroki**

- **Krok 1 (teraz, przed otwarciem dla twórców):** encoder na osobną maszynę. Po podwyżce CCX warto porównać serwer dedykowany Hetzner z linii AX (np. 8–16 rdzeni fizycznych Ryzen, ceny do sprawdzenia) z cloud CCX. Dla kodowania x264 dedykowany serwer ma zwykle znacznie lepszy stosunek rdzeni do ceny, a łączy się z resztą przez prywatną sieć lub Tailscale, bo tunel Cloudflare nie jest potrzebny dla workera. Worker łączy się z Postgresem (TLS, osobny użytkownik DB z prawami tylko do tabel kolejki i `Video`) i z R2.
- **Krok 2:** wielu workerów na tej samej kolejce (Postgres `SKIP LOCKED` wystarczy do dziesiątek workerów). Możliwy autoscaling Hetzner Cloud (instancje na godziny) sterowany głębokością kolejki.
- **Krok 3:** GPU (NVENC) ma sens dopiero przy dużym wolumenie. Jakość NVENC przy tym samym bitrate jest gorsza niż x264 medium, ale przepustowość jest wielokrotnie większa. Dla UGC jest to akceptowalne. Hetzner oferuje serwery GPU (GEX), ale koszt stały jest wysoki.
- **Overflow do Cloudflare Stream:** przy kolejce dłuższej niż X godzin zadania kanałów zaufanych można kierować do Stream (kodowanie darmowe), ale wtedy dostarczanie idzie przez Stream (1 USD/1000 min) i powstaje druga ścieżka playbacku i autoryzacji (signed URLs Stream). Rekomendacja: **nie budować overflow na start**. Lepiej mieć dobry worker skalowany horyzontalnie. Stream warto rozważyć dopiero, gdy koszt utrzymania pipeline'u przewyższy koszty dostarczania.

**Porównanie kosztów (szacunek, założenia jawne)**

Założenia: 1 h materiału 1080p, drabina z sekcji 2 (~9,7 Mbps łącznie ≈ 4,4 GB/h) plus oryginał ~6 GB/h; oglądalność 1000 h na miesiąc.

| | Własny pipeline (R2 + Worker) | Cloudflare Stream | Mux (Basic, do weryfikacji) |
|---|---|---|---|
| Kodowanie 1 h | koszt CPU: ~1–2 h pracy 8-rdzeniowej maszyny; przy maszynie ~100–150 EUR/mies. to ułamek euro, jeśli maszyna jest wykorzystana | 0 USD | ~1,9 USD (60 min × 0,031) lub 0 przy Basic, jeśli darmowe — zweryfikować |
| Storage 1 h / mies. | ~10,4 GB × 0,015 = ~0,16 USD (z oryginałem; ~0,10 przy oryginale w IA) | 60 min × 5/1000 = 0,30 USD | ~60 × 0,003 = 0,18 USD |
| Dostarczenie 1000 h | egress 0; requesty Worker ~600 seg/h × 1000 = 0,6 mln → ~0,18 USD (ponad pakiet Workers Paid), R2 klasa B mniej dzięki cache | 60 000 min × 1/1000 = **60 USD** | ~60 000 × 0,001 = ~60 USD (po darmowym progu) |
| TB przechowywania | 15 USD/TB (IA: 10) | n/d (płatne minutami) | n/d |

Wniosek: przy modelu „egress free” R2 + Worker najdroższa jest praca CPU i inżynieria, a nie przechowywanie ani dystrybucja. Dostarczanie przez Stream lub Mux kosztuje rząd 0,06 USD za godzinę oglądania. Przy 100 tys. h oglądania miesięcznie to około 6000 USD, a u nas groszowe kwoty. Należy upewnić się, że serwowanie wideo z R2 przez Workera jest zgodne z aktualnymi warunkami Cloudflare (od 2023 r. warunki self-serve pozwalają serwować duże pliki i wideo z R2 i usług deweloperskich, ale trzeba to potwierdzić w Service-Specific Terms).

**Kontrola kosztów per twórca**

- `ChannelUsage` (dziennie: bajty storage, minuty kodowania, odtworzenia i segmenty z logów Workera przez Workers Analytics Engine lub Logpush) oraz alerty przy anomaliach (np. kanał z 1 TB storage i zerową oglądalnością).
- Kwoty storage per poziom zaufania (sekcja 2). Po przekroczeniu blokujemy nowe uploady, nic nie usuwamy.
- Worker: cache segmentów HLS w Cloudflare (`cache-control: public, max-age=31536000, immutable` dla segmentów; token sprawdzany w Workerze **przed** odczytem z cache, a klucz cache bez tokenu). Rate limit per token i IP chroni przed hotlinkingiem.

---

## 9. Narzędzia superadmina

### Co mówią źródła

- **Better Auth admin plugin:** `impersonateUser` (domyślnie sesja 1 h lub do końca sesji przeglądarki), `stopImpersonating`, domyślnie brak impersonacji innych adminów (uprawnienie `impersonate-admins`), access control przez `createAccessControl`, `banUser` z powodem i czasem (ban unieważnia sesje). [Better Auth admin plugin docs]
- Wzorce branżowe (Stripe, GitHub i in.): impersonacja z wyraźnym banerem, krótkim TTL, rejestrem audytowym i powodem. Zalecane jest ograniczanie do trybu tylko do odczytu oraz step-up auth. (Praktyka ogólna; OWASP ASVS V4 Access Control wymaga, by dostęp administracyjny był chroniony dodatkowymi mechanizmami i logowany.)

### Rekomendacja dla naszego stosu

- **Impersonacja („view as”)**
  - Uruchamiana tylko z aplikacji admin: `POST /admin/impersonations {targetUserId, reason, mode: 'READ_ONLY'}`. Wymaga step-upu (ponowne potwierdzenie passkey/TOTP w ostatnich 5 minutach) i rekordu `Impersonation { id, adminId, targetUserId, reason, mode, startedAt, endedAt, ip }`.
  - Lepsza alternatywa niż sesja Better Auth jako użytkownik: **„view as” w adminie**, czyli renderowanie widoków twórcy w aplikacji admin z `Actor = { kind: 'impersonation', viewer: admin, subject: target, mode: 'READ_ONLY' }`. Polityka zabrania wszystkich akcji mutujących przy `mode='READ_ONLY'`. Dzięki temu sesja administratora nigdy nie żyje na www, a ciasteczka nie mieszają się między domenami.
  - Jeśli używamy `impersonateUser` z Better Auth: `impersonationSessionDuration: 15*60`, sprawdzenie `session.impersonatedBy` w budowaniu `Actor` (każda mutacja przy impersonacji jest odrzucana, chyba że akcja jest na whitelist), czerwony baner w layoucie, zakaz dostępu do ustawień płatności, haseł i e-maili oraz audyt każdego żądania.
  - Opcjonalne powiadomienie użytkownika („Pomoc techniczna przeglądała Twoje konto w dniu…”), co zwiększa zaufanie.
- **Globalne wyszukiwanie:** jedno pole w adminie przeszukuje `User` (e-mail dokładnie, nazwa trigramem), `Channel` (handle, displayName), `Video` (`publicId`, tytuł), `Tip` (`publicId`, `paymentIntentId`), `stripeAccountId` i IP (hash). Wyniki filtruje polityka moderatora (moderator nie widzi danych płatniczych).
- **Akcje masowe:** zawsze jako `BulkOperation { id, type, filter jsonb, targetIds[], status, requestedBy, approvedBy?, reason, dryRunResult }`. Najpierw dry-run (podgląd liczby i próbki), potem wykonanie w jobie w partiach z checkpointem. Każdy element generuje `AuditLog` i, jeśli dotyczy treści, `ModerationDecision` (SoR). Operacje nieodwracalne (purge) wymagają zasady czterech oczu przy > N elementów.
- **Kill switches:** tabela `PlatformSetting { key, value jsonb, updatedBy, updatedAt, reason }`: `registrationsEnabled`, `uploadsEnabled`, `uploadsRequireReview`, `tipsEnabled`, `commentsEnabled`, `newChannelCreationEnabled`, `encodeQueuePaused`, `maxUploadSizeOverride`. Odczyt z Redis (TTL 10–30 s) z fallbackiem na DB. Przy awarii Redis używamy **bezpiecznych domyślnych** wartości: dla uploadów i napiwków „wyłączone” albo ostatnia znana wartość z pamięci procesu (do wyboru i opisania). Worker i Cloudflare Worker także czytają przełączniki: Worker przez KV lub zmienną odświeżaną przez API admina, np. `playbackEnabled` per kanał przy incydencie.
- **Flagi per kanał:** `ChannelFeature` (sekcja 5): `allow4k`, `maxVideoMinutes`, `tipsEnabled`, `commentsMode`, `skipPreReview`, `storageQuotaGb`. Ewaluacja w polityce: `effective = platformSetting ∧ channelFeature ∧ trustLevelDefault`. Biblioteka flag nie jest potrzebna. Jeśli później pojawią się eksperymenty A/B, można dodać OpenFeature z lokalnym providerem.
- **Bezpieczeństwo admina:** utrzymać Cloudflare Access, osobne auth, CSP i audyt. Dodać weryfikację JWT Access (`Cf-Access-Jwt-Assertion`) w aplikacji, role moderator i superadmin z rozdziałem uprawnień oraz alert przy każdym użyciu override'u superadmina.

---

## 10. Strategia testów i migracji

### Co mówią źródła

- OWASP API1: testy autoryzacji, które **blokują wdrożenie**. [OWASP API1:2023]
- Expand/contract (Parallel Change), dual-write lub dual-read i flagi przy migracjach bez przestojów. [Fowler ParallelChange; Prisma docs „expand and contract”]

### Rekomendacja dla naszego stosu

**Macierz autoryzacji**

- Aktorzy w fixtures: `guest`, `userTL0`, `userTL2`, `ownerA` (kanał A), `ownerB` (kanał B), `bannedUser`, `ownerOfSuspendedChannel`, `moderator`, `superadminOnWww`, `superadminOnAdmin`, `impersonatingAdminReadOnly`.
- Zasoby: wideo A w każdej kombinacji statusów (DRAFT, PUBLISHED, UNLISTED, PRIVATE × APPROVED, LIMITED, REMOVED × kanał ACTIVE, SUSPENDED), komentarze, napiwki, ustawienia kanału.
- **Poziom 1: testy jednostkowe polityk (Vitest).** Tabela oczekiwań w pliku `access/__tests__/matrix.ts` jako `Record<Action, Record<ActorKind, Record<ResourceState, boolean>>>`. Test sprawdza **kompletność**: każda akcja z typu `Action` ma wpisy dla wszystkich aktorów (wymuszone typem TS z `satisfies`). Dodanie nowej akcji bez macierzy nie przejdzie kompilacji.
- **Poziom 2: testy kontraktowe `can()` ↔ `scopeFor()`.** Na tej samej bazie testowej (Testcontainers Postgres 17) `scopeFor(actor,'video:view')` musi zwrócić dokładnie te rekordy, dla których `can(actor,'video:view', r)` jest prawdą. Można dodać property-based testing (`fast-check`) generujący stany zasobów.
- **Poziom 3: testy integracyjne tras.** Rejestr tras: każda Server Action i route handler eksportuje metadane `{ action, resourceParam }`, a test generuje żądania dla każdej trasy × aktora z ID zasobu **innego właściciela** (klasyczny test BOLA) i oczekuje 404/403. Test architektury sprawdza, że każda trasa w `app/**/route.ts` i każda akcja `'use server'` jest w rejestrze.
- **Poziom 4: e2e (Playwright)** na krytycznych ścieżkach: upload jako TL0 (moderacja wstępna), zmiana handle i redirect, napiwek z Stripe test mode, impersonacja read-only (próba mutacji kończy się błędem), cache (dane A nie wyciekają do gościa).
- **Worker HMAC:** testy jednostkowe Workera (Vitest + Miniflare): token innego wideo, wygasły token, zmieniony path, wideo zablokowane po wydaniu tokenu (krótki TTL tokenu, np. 10 minut z odnawianiem, lub lista odwołań w KV).

**Migracja z single-channel (`Creator.isPrimary`)**

1. **Expand (migracja 1):** tabele `Channel`, `ChannelMember`, `HandleHistory`, `ChannelQuota`, kolumny `Video.channelId NULL`, `Tip.channelId NULL`, `EncodeJob.channelId NULL`, plus `Video.publicId NULL`. Nic nie jest jeszcze czytane.
2. **Backfill (skrypt idempotentny, w jobie, w partiach):** dla `Creator` z `isPrimary=true` tworzymy `Channel` (handle z obecnego sluga lub nazwy, status `ACTIVE`, `verifiedAt=now`) i `ChannelMember(OWNER = obecny admin)`, a następnie ustawiamy `channelId` na wszystkich wideo, napiwkach i zadaniach. Generujemy `publicId` dla istniejących wideo, a **stare URL-e (slug) mapujemy w `LegacyVideoRedirect`** na 301. Skrypt raportuje liczby przed i po. Uruchamiamy go najpierw na kopii bazy produkcyjnej.
3. **Dual-write:** kod tworzący wideo lub napiwek ustawia zarówno stare pola (`creatorId`), jak i `channelId`. Wdrażamy i obserwujemy.
4. **Dual-read za flagą** `readFromChannel` (PlatformSetting): nowe ścieżki odczytu i polityki działają na `channelId`. Shadow-mode porównuje wyniki starej i nowej ścieżki w logach (np. lista wideo kanału) przez kilka dni.
5. **Switch:** flaga włączona, stare ścieżki tylko do odczytu.
6. **Contract (migracja N):** `channelId NOT NULL` + FK + indeksy (`CREATE INDEX CONCURRENTLY` w surowym SQL, poza transakcją migracji Prisma), usunięcie `Creator.isPrimary` i starych kolumn. Dopiero po tym kroku otwieramy tworzenie kanałów dla wszystkich (`newChannelCreationEnabled`).
- Każda migracja Prisma jest przeglądana pod kątem blokad: `ALTER TABLE ... ADD COLUMN` bez default jest szybkie, `SET NOT NULL` wymaga skanu. W PG12+ można wcześniej dodać `CHECK (channel_id IS NOT NULL) NOT VALID`, potem `VALIDATE CONSTRAINT`, a dopiero wtedy `SET NOT NULL` bez długiej blokady.
- Rollback: do kroku 5 włącznie wystarczy wyłączyć flagę. Po kroku 6 rollback wymaga przywrócenia z backupu, więc przed nim robimy snapshot i PITR.

---

## Ryzyka

1. **Prawne i CSAM przed narzędziami:** otwarcie uploadów zanim PhotoDNA lub Safer zostaną zatwierdzone. Mitigacja: moderacja wstępna dla wszystkich nowych kanałów i ograniczenie uploadu do zweryfikowanych kont. Cloudflare CSAM Tool nie pokrywa wideo w prywatnym R2.
2. **Exploity ffmpeg i libvips:** realne i powtarzalne (CVE co kwartał). Sandbox bez sieci i rozdzielenie I/O od parsowania są obowiązkowe. Ryzyko rezydualne to ucieczka z kontenera przez błąd jądra, więc encoder powinien działać na osobnej maszynie, bez sekretów innych niż minimalny token R2 dla prefiksu.
3. **Rozjazd `can()` i `scopeFor()`** prowadzi do wycieku prywatnych wideo w listach. Mitigacja: testy kontraktowe (sekcja 10).
4. **Wyciek danych przez cache** (strony spersonalizowane w cache Cloudflare lub Next). Mitigacja: reguły bypass po cookie i testy e2e.
5. **Koszty:** nadużycie storage (R2 jako darmowy hosting plików) i CPU kodowania. Mitigacja: kwoty, poziomy zaufania, `ChannelUsage` z alertami.
6. **Webhooki Stripe poza kolejnością** nadpisują stan starszym. Mitigacja: wyzwalacz i `retrieve`, zapisy monotoniczne, rekoncyliacja.
7. **Spór na destination charge obciąża platformę**, a odzyskanie środków od twórcy może być niemożliwe (saldo 0, ograniczenia cross-border). To ryzyko finansowe do zaakceptowania lub ograniczenia limitami napiwków dla nowych kanałów.
8. **Ceny Hetznera (podwyżka 06/2026) oraz Mux i Stream** mogą się zmieniać. Liczby w tabeli są szacunkami i trzeba je zweryfikować przed decyzją.
9. **Next.js `/@handle`:** zależność od rewrite'u i kodowania `%40`. Wymaga testów e2e na produkcyjnym stosie (Cloudflare Tunnel).
10. **Złożoność:** pełny program (moderacja, DSA, ledger, sandbox) to wielomiesięczna praca. Proponowana kolejność: (a) autoryzacja i model `Channel` z migracją, (b) sandbox encodera i kwoty, (c) moderacja wstępna i raporty, (d) CSAM, (e) napiwki dla wielu kanałów, (f) feed i wyszukiwarka, (g) narzędzia superadmina rozwijane równolegle.
11. **Zwolnienie z art. 24(5) DSA** zależy od wielkości przedsiębiorstwa. Obowiązki z art. 16 (notice & action) i art. 17 (statement of reasons) obowiązują niezależnie od tego zwolnienia. Kwestie prawne potwierdza inny agent lub prawnik.

---

## Źródła

Dostęp do wszystkich: 2026-10-13.

Autoryzacja i bezpieczeństwo:
- OWASP API Security Top 10 2023, API1 BOLA: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- PostgreSQL 17, Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Prisma client extensions, row-level-security (README, caveats): https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security
- Prisma, Shared extensions & examples: https://www.prisma.io/docs/orm/prisma-client/client-extensions/extension-examples
- RedwoodJS RLS demo (zastrzeżenia transakcyjne): https://github.com/realstandal/redwood-rls-demo
- prisma-rls README (raw queries): https://unpkg.com/prisma-rls@0.5.6/README.md
- Atlas, Prisma RLS guide: https://atlasgo.io/guides/orms/prisma/row-level-security
- GuardLayer, ORM a RLS (rola, set_config lokalny): https://www.guardlayer.io/blog/orm-bypasses-supabase-rls
- OpenFGA docs: https://openfga.dev/docs ; Cedar: https://docs.cedarpolicy.com ; CASL: https://casl.js.org
- Next.js 16 proxy (źródła wtórne): https://johnkavanagh.co.uk/articles/next-js-proxy-replaces-middleware/
- Next.js rewrites: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
- Next.js issue (parallel routes, dynamic segments): https://github.com/vercel/next.js/issues/62656
- Unicode UTS #39 Security Mechanisms: https://www.unicode.org/reports/tr39/
- Unicode L2/22-231 mixed-script detection: https://unicode.org/L2/L2022/22231r-mixed-script-detection.pdf
- Better Auth admin plugin: https://www.better-auth.com/docs/plugins/admin

Wideo i upload:
- Uppy AWS S3: https://uppy.io/docs/aws-s3/
- Cloudflare R2 object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Stream pricing: https://developers.cloudflare.com/stream/pricing/
- Mux pricing overview: https://www.mux.com/docs/pricing/overview ; https://www.mux.com/docs/pricing/video
- YouTube Help, uploady > 15 min: https://support.google.com/youtube/answer/71673
- YouTube Help, recommended upload encoding settings: https://support.google.com/youtube/answer/1722171
- Streaming Learning Center, Apple HLS Authoring Spec: https://streaminglearningcenter.com/blogs/encoding-brief-apple-releases-hls-authoring-specification-for-apple-tv.html
- Wowza, Encoding ladders: https://www.wowza.com/blog/encoding-ladders-what-you-need-to-know
- CVE-2025-22920 (SentinelOne): https://www.sentinelone.com/vulnerability-database/cve-2025-22920/
- Zestawienie CVE FFmpeg: https://cve.imfht.com/vendor/FFmpeg?lang=en
- „Sandboxed isn't safe” (dev.to): https://dev.to/phpboyscout/sandboxed-isnt-safe-k42
- Untrusted video inputs (video-use): https://instagit.com/browser-use/video-use/security-considerations-untrusted-video-inputs/
- PeerTube remote runners: https://docs.joinpeertube.org/admin/remote-runners
- Hatchet, multi-tenant queues in Postgres: https://hatchet.run/blog/multi-tenant-queues
- Holistics, multi-tenant job queue: https://www.holistics.io/blog/how-we-built-a-multi-tenant-job-queue-system-with-postgresql-ruby
- Artur's notes, SKIP LOCKED in production: https://artur.bearblog.dev/background-jobs-without-redis-postgres-skip-locked-in-production/
- Hetzner podwyżka 06/2026 (wtórne): https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do ; https://spendark.com/instances/ccx33/

Bezpieczeństwo treści:
- Cloudflare CSAM Scanning Tool: https://developers.cloudflare.com/cache/reference/csam-scanning/
- Microsoft PhotoDNA: https://www.microsoft.com/en-us/photodna ; Terms: https://www.microsoft.com/en-us/photodna/termsofuse
- Thorn Safer Match: https://www.thorn.org/blog/safer-match/ ; AWS Marketplace: https://aws.amazon.com/marketplace/pp/prodview-dfwekn4bx4ake
- Cloudflare ref. architecture, serverless image content management: https://developers.cloudflare.com/reference-architecture/diagrams/serverless/serverless-image-content-management/
- Workers AI resnet-50: https://developers.cloudflare.com/workers-ai/models/resnet-50/ ; deprecations 2026-05: https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/
- Replicate, NSFW detection collection: https://replicate.com/collections/detect-nsfw-content
- Chromaprint: https://github.com/acoustid/chromaprint ; acoustid-index: https://github.com/acoustid/acoustid-index
- Copybuzz (koszty Audible Magic, 2024): https://copybuzz.com/analysis/things-money-cant-buy/
- Pex Attribution Engine: https://pex.com/products/attribution-engine/
- Discourse, Understanding trust levels: https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/
- DSA Transparency Database, onboarding: https://transparency.dsa.ec.europa.eu/page/onboarding-documentation ; API: https://transparency.dsa.ec.europa.eu/page/api-documentation
- Lewis Silkin, DSA moderation obligations: https://www.lewissilkin.com/insights/2023/10/20/hosting-providers-online-platforms-ready-comply-your-dsa-content-moderation-february-2024
- Cloudflare Turnstile, server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

Feedy i wyszukiwanie:
- righto.com, HN ranking: https://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html
- Salihefendic, HN ranking: https://medium.com/hacking-and-gonzo/how-hacker-news-ranking-algorithm-works-1d9b0cf2c08d
- Lemmy ranking doc: https://git.join-lemmy.org/asonix/lemmy/raw/branch/master/docs/ranking.md
- pg_hunspell: https://github.com/EvanCarroll/pg_hunspell
- PostgreSQL text search dictionaries: https://www.postgresql.org/docs/17/textsearch-dictionaries.html ; unaccent: https://www.postgresql.org/docs/17/unaccent.html ; pg_trgm: https://www.postgresql.org/docs/17/pgtrgm.html ; citext: https://www.postgresql.org/docs/17/citext.html

Płatności:
- Stripe Connect webhooks: https://docs.stripe.com/connect/webhooks
- Stripe idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Stripe webhooks (best practices): https://docs.stripe.com/webhooks
- Stripe handling verification: https://docs.stripe.com/connect/handling-api-verification
- Stripe pausing payments/payouts: https://docs.stripe.com/connect/pausing-payments-or-payouts-on-connected-accounts
- Stripe destination charges: https://docs.stripe.com/connect/destination-charges
- Stripe Connect disputes: https://docs.stripe.com/connect/disputes
- Hookdeck, Stripe webhooks guide: https://hookdeck.com/webhooks/platforms/guide-to-stripe-webhooks-features-and-best-practices

Architektura:
- microservices.io, Transactional outbox: https://microservices.io/patterns/data/transactional-outbox.html
- Martin Fowler, Parallel Change: https://martinfowler.com/bliki/ParallelChange.html

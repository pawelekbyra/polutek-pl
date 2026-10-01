# Serwerek 05: własny stos zamiast usług zarządzanych (co zastąpić, czym, kiedy)

Badanie z 2026-10-01. Pytanie właściciela: serwis **nie jest jeszcze uruchomiony** (nie ma użytkowników do migrowania), więc czy i jak zastąpić usługi zarządzane własnymi na serwerach Hetzner, dla pełnej kontroli. **Zostaje Stripe.** Ten dokument ocenia każdą usługę osobno i kończy się kolejnością, architekturą docelową, kosztami i pytaniami.

Kontekst, którego tu nie powtarzamy: plan [`docs/architecture/serwerek.md`](../../architecture/serwerek.md), stan i pomiary serwera [`docs/operations/SERWEREK.md`](../../operations/SERWEREK.md) (§14: aplikacja 122-240 MiB, Postgres 35-69 MiB, wąskie gardło CPU), [`01-hls-encoding.md`](01-hls-encoding.md), [`02-hls-delivery-cloudflare.md`](02-hls-delivery-cloudflare.md), `03-nextjs-self-hosting.md` (Vercel → Docker + Caddy + Tunnel; w chwili pisania na gałęzi `docs/research-hls-encoding`, jeszcze nie na `main`), [`04-data-queue-ops.md`](04-data-queue-ops.md) (Neon → własny Postgres, pgBackRest, pg-boss, SOPS+age).

Oznaczenia: **[zweryfikowane]** = sprawdzone w kodzie repo albo w podanym źródle 2026-10-01; **[niezweryfikowane]** = wiedza ogólna, źródła wtórne albo szacunek, do potwierdzenia przed decyzją. Liczby RAM bez oznaczenia "zmierzone" to szacunki.

Serwer dziś: Hetzner CPX22 (2 vCPU AMD, 4 GB RAM, 80 GB, Norymberga), ok. €24,59/mies. z VAT (`SERWEREK.md` §3).

> ## Rekomendacja dla nas
>
> 1. **Zastąpić teraz (przed startem, bo teraz jest najtaniej):** Clerk → **Better Auth** (Prisma adapter, w aplikacji, bez osobnej usługi), razem z Vercel → Docker na Hetzner, Neon → Postgres 17 na tym samym serwerze i Upstash → limity w Postgresie. Te cztery idą w parze: Better Auth trzyma sesje w bazie, baza musi stać obok aplikacji (Neon us-east-1 ↔ Norymberga = 92 ms RTT, `04` §2.2), a aplikacja poza Vercel nie potrzebuje Upstash REST.
> 2. **Vercel Blob → R2** też teraz (mała zmiana, niezależna od serwera: obrazki komentarzy + 6 starych miniatur).
> 3. **Zastąpić później:** Mux/Cloudflare Stream → własny HLS z FFmpeg na R2 (research wstrzymany przez właściciela, `01`/`02`); Resend Audiences → własna tabela subskrybentów; Resend inbound → Gmail API skrzynki `hello@`; analityka → Umami; błędy → GlitchTip; monitoring → Uptime Kuma na drugim serwerze.
> 4. **Zostawić zarządzane (świadomie):** **Stripe** (decyzja), **Cloudflare** (DNS, CDN, DDoS, Tunnel, Access, R2, Turnstile — nie da się tego zrobić samemu na VPS), **wysyłka maili przez zewnętrzny relay** (Resend albo europejski odpowiednik; własny MTA na Hetznerze to zły interes: zablokowany port 25, reputacja IP, reguły Gmail/Outlook), **Google Workspace** (skrzynka `hello@` i dostęp agentów), **GitHub** jako główne repo i CI (agenci żyją na `gh` i przepływie PR; Forgejo najwyżej jako lustro).
> 5. **Docelowo 2 serwery + Cloudflare z przodu:** "app" (Next.js ×2, Postgres, Caddy, cloudflared) i "ops" (worker FFmpeg, GlitchTip, Uptime Kuma, Umami, ewentualnie lustro Forgejo). Koszt ok. **€40-55/mies.** (z Cloudflare Pro i płatnym relayem ok. €80-95) zamiast dzisiejszych ok. €25 + darmowe plany (szczegóły §17). Własny stos nie jest tańszy; płacimy za kontrolę i za brak limitów darmowych planów.
> 6. **Największe ryzyko całego planu:** bezpieczeństwo logowania przechodzi na nas (hasła, sesje, reset hasła, ochrona przed botami). Better Auth daje gotowe klocki, ale konfiguracja i aktualizacje są nasze. Drugie ryzyko: jeden serwer = jeden punkt awarii dla aplikacji, bazy i logowania naraz.

---

## 1. Inwentarz: co dziś jest zarządzane

| Usługa | Do czego u nas | Gdzie w kodzie (zweryfikowane grepem) |
|---|---|---|
| Vercel | hosting, build, 3 crony, podglądy PR, Analytics | `vercel.json`, `scripts/vercel-build.mjs`, `@vercel/analytics` w `app/layout.tsx` |
| GitHub | repo, CI (`.github/workflows/ci.yml`, `production-db-migrations.yml`), PR, `gh` agentów | — |
| Clerk | logowanie Google OAuth + e-mail/hasło, pseudonim, avatar, Turnstile, webhook | **43 pliki** importują `@clerk/*` (`@clerk/nextjs` ^7.5.3, `@clerk/localizations`), 40 plików testów mockuje Clerk |
| Resend | maile transakcyjne i broadcast, webhook zdarzeń (`/api/webhooks/resend`), skrzynka przychodząca w adminie, Audiences (subskrypcje) | `legacy-email-service-provider.ts`, `handle-resend-webhook.use-case.ts`, `list-inbound-emails.use-case.ts`, `resend-audience.gateway.ts` |
| Mux / Cloudflare Stream | wideo (upload, transkodowanie, odtwarzanie) | `provision-mux-upload.use-case.ts`, `playback.service.ts`, `/api/webhooks/cloudflare` |
| Neon | Postgres 17, us-east-1, Free, ok. 56 MB | `04` §1 |
| Upstash | limity żądań (REST, `EVAL`) | `lib/rate-limit.ts` (`RateLimitStore`: `hit`, `setNxEx`), `lib/api/admin-rate-limit.ts` |
| Vercel Blob + R2 | miniatury (R2 + 6 starych w Blob), obrazki komentarzy (tylko Blob), oryginały wideo (R2) | `@vercel/blob`, `r2-thumbnail-storage.client.ts` |
| Google Workspace | skrzynka `hello@pawelperfect.com`, logowanie Google (OAuth client), konto admina dla agentów | `docs/operations/GOOGLE_ACCESS.md` |
| Cloudflare | DNS obu domen, CDN, Tunnel + Access do serwerka, R2, Turnstile (przez Clerk) | `SERWEREK.md` §4 |
| Stripe | płatności (napiwki) | zostaje |

## 2. Auth: Clerk → Better Auth (szczegółowo)

### 2.1 Werdykt

**Zastąpić teraz, przed startem.** Teraz nie ma kogo migrować (testowe konta można porzucić), a po starcie każda zmiana dostawcy logowania oznacza migrację haseł/tożsamości i ryzyko wylogowania ludzi. Better Auth działa **wewnątrz** naszej aplikacji Next.js i trzyma dane w **naszym** Postgresie przez Prisma, więc nie ma osobnej usługi do utrzymania (zero dodatkowego RAM poza samą biblioteką).

### 2.2 Fakty o Better Auth (stan 2026-10-01)

| Rzecz | Ustalenie | Status |
|---|---|---|
| Wersja | `better-auth` **1.7.7** (npm, modyfikacja 2026-09-30) | [zweryfikowane: `npm view`] |
| Prisma | peer deps: `prisma` i `@prisma/client` **`^5 \|\| ^6 \|\| ^7`**, więc nasze **Prisma 6.19** jest wspierane. Dokumentacja pokazuje przykłady z Prisma 7 (driver adapter `PrismaPg`, generator z `output`), ale pisze wprost, że przy Prisma 6 driver adapter jest opcjonalny i obecny klient zostaje bez zmian | [zweryfikowane: `npm view better-auth peerDependencies`; docs "Prisma"] |
| Adapter | `import { prismaAdapter } from "better-auth/adapters/prisma"` (nie Drizzle) | [zweryfikowane: docs] |
| Schemat i migracje | CLI `npx auth@latest generate` dopisuje modele do `schema.prisma`; **migracji nie robi** dla Prisma, robimy je sami (`prisma migrate dev`, potem nasza zasada: addytywnie, bez BOM). Stary pakiet `@better-auth/cli` (1.4.21, sierpień 2026) jest zastąpiony przez `auth` | [zweryfikowane: docs "CLI", "Prisma"; npm] |
| Tabele | `user`, `session`, `account`, `verification` (+ tabele pluginów); nazwy modeli i pól mapowane przez `user: { modelName, fields }`, dodatkowe pola przez `additionalFields`, ID przez `advanced.database.generateId` | [zweryfikowane: docs "Database"] |
| Next.js 16 | route handler `app/api/auth/[...all]/route.ts`: `export const { GET, POST } = toNextJsHandler(auth)` z `better-auth/next-js`; na serwerze `auth.api.getSession({ headers: await headers() })`; plugin `nextCookies()` jako **ostatni** (cookies z server actions); w proxy szybki test `getSessionCookie(request)` z `better-auth/cookies` (sprawdza tylko istnienie ciasteczka, nie ważność) | [zweryfikowane: docs "Next.js"] |
| Proxy w Next 16 | `middleware.ts` jest przestarzały, nowa nazwa `proxy.ts`; proxy **domyślnie działa w runtime Node.js** (od 16.0.0), opcji `runtime` nie da się w nim ustawić; codemod `npx @next/codemod@canary middleware-to-proxy .` | [zweryfikowane: Next.js docs "proxy.js", lastUpdated 2026-09-07] |

Pluginy, których potrzebujemy (nazwy pakietów i ścieżek):

| Funkcja u nas dziś | Plugin Better Auth | Import | Status |
|---|---|---|---|
| Google OAuth | wbudowany `socialProviders.google` | `betterAuth({ socialProviders: { google: {...} } })` | [niezweryfikowane szczegółowo; standardowa funkcja] |
| Google One Tap (opcja) | `oneTap` / `oneTapClient` | `better-auth/plugins` / `better-auth/client/plugins` | [zweryfikowane: docs] |
| e-mail + hasło | wbudowane `emailAndPassword` (+ `sendResetPassword`, `requireEmailVerification`) | — | [niezweryfikowane szczegółowo] |
| pseudonim | `username` (unikalny, normalizowany do małych liter, `displayUsername`, `usernameValidator`, domyślnie 3-30 znaków) | `better-auth/plugins` | [zweryfikowane: docs] |
| Turnstile | `captcha({ provider: "cloudflare-turnstile", secretKey })`; domyślnie chroni `/sign-up/email`, `/sign-in/email`, `/request-password-reset`; inne ścieżki trzeba dopisać w `endpoints` | `better-auth/plugins` | [zweryfikowane: docs "Captcha"] |
| sprawdzanie wyciekniętych haseł | `haveIBeenPwned` (k-anonimowość: wysyłane tylko 5 pierwszych znaków hasha) | `better-auth/plugins/haveibeenpwned` | [zweryfikowane: docs] |
| passkeys (później) | `passkey` / `passkeyClient` | pakiet **`@better-auth/passkey`** (1.7.7), klient `@better-auth/passkey/client` | [zweryfikowane: docs + npm] |
| 2FA dla admina (zalecane) | `twoFactor` | `better-auth/plugins` | [niezweryfikowane szczegółowo] |
| kod/link e-mailem (opcja) | `emailOTP`, `magicLink` | `better-auth/plugins` | [niezweryfikowane szczegółowo] |
| ban/impersonacja w adminie (opcja) | `admin` | `better-auth/plugins` | [niezweryfikowane szczegółowo]; uwaga §2.4 |

### 2.3 Punkty styku w naszym kodzie (zweryfikowane grepem 2026-10-01)

- **43 pliki** z importem `@clerk/*`: 16 + 8 z `@clerk/nextjs/server`, 16 + 3 z `@clerk/nextjs`, 1 z `@clerk/localizations`. Użycia: `useAuth` 25×, `useUser` 19×, `clerkClient` 10×, `useClerk` 8×, `currentUser` 6×, `useSignIn`/`useSignUp` po 4×, `ClerkProvider` 4×, `clerkMiddleware`/`createRouteMatcher` w `middleware.ts`, `await auth()` ok. 20×, `AuthenticateWithRedirectCallback` w `app/sso-callback/page.tsx`.
- **`lib/api/auth.ts`**: `getAuthSession()`, `getActorFromAuth()`, `requireAdminActor()`, `resolveDbBackedActor()` biorą `userId` z `auth()` Clerka, a rolę i stan konta **już dziś z bazy**. To jest jedno wąskie gardło: wystarczy podmienić źródło `userId` na `auth.api.getSession()`; reszta (aktor, admin, `isDeleted`) zostaje.
- **`lib/api/identity-provider.ts`** (`ClerkIdentityProvider` na `clerkClient`) i **`lib/clerk.ts`**: podmienić na implementację Better Auth tego samego interfejsu (używany m.in. przez `update-user-language.use-case.ts`).
- **`User.id` = Clerk user id** (komentarz w `schema.prisma`: "This is now the clerkUserId directly"). Klucze obce do `User` mają m.in. komentarze, reakcje, płatności, `UserPaymentTotal`, `PatronGrant`, subskrypcje, powiadomienia (14 relacji `references: [id]` w schemacie). Ponieważ `User.id` to zwykły `String`, Better Auth może po prostu **generować nowe ID** w tej samej kolumnie (np. `generateId: "uuid"` albo domyślne); FK nie trzeba zmieniać.
- **Model `User` jako `user` Better Auth:** `user: { modelName: "User", fields: { image: "imageUrl" } }`. Brakuje kolumny `emailVerified Boolean` (addytywna migracja). Better Auth wymaga `name`, a u nas `name` jest `String?`: przy rejestracji zawsze ustawiamy pseudonim, więc to wystarczy; do potwierdzenia, czy adapter akceptuje `NULL` w starych wierszach [niezweryfikowane]. Pola `role`, `language`, `isDeleted` dopisujemy jako `additionalFields` z `input: false`.
- **Nowe tabele:** `Session`, `Account` (hasła i tokeny OAuth), `Verification`, ewentualnie `TwoFactor`, `Passkey`. `ClerkEvent` zostaje do wygaszenia (historia), potem usuwana osobną decyzją.
- **`ADMIN_CLERK_USER_IDS`** (`lib/admin-config.ts`, `lib/env/validation.ts`, `/api/admin/health/clerk`): po zmianie ID przestaje cokolwiek znaczyć. Zastąpić samym `User.role = ADMIN` (już dziś honorowane) i ewentualnie `ADMIN_EMAILS` jako awaryjną listę, sprawdzaną tylko dla adresów z `emailVerified = true`.
- **`/api/webhooks/clerk`** i `sync-user-from-webhook.use-case.ts`: znikają. Better Auth zapisuje użytkownika bezpośrednio w naszej bazie, więc nie ma czego synchronizować. Mail powitalny: przez hook `databaseHooks.user.create.after` [niezweryfikowane: nazwa hooka do sprawdzenia w docs]. `getOrCreateCurrentUser()`/`sync-user.use-case` (CLAUDE.md §4.14) zamienia się w odczyt, bo wiersz zawsze już istnieje.
- **`/sso-callback`**: Better Auth sam obsługuje `/api/auth/callback/google` i przekierowuje na `callbackURL`. Strona `/sso-callback` może zostać jako cienki ekran przejściowy (formularz pseudonimu przy pierwszym logowaniu Google) albo zniknąć; logikę pseudonimu przenosimy na `newUserCallbackURL` [niezweryfikowane: nazwa opcji].
- **UI zostaje, zmienia się okablowanie:** `AuthModal.tsx`, `AuthModalProvider.tsx`, `UserMenu.tsx`, `AccountModal.tsx`, `AccountSections.tsx`, `ProfileSection.tsx` wołają dziś hooki Clerka; po zmianie wołają `authClient` (`createAuthClient` z `better-auth/react`: `signIn.email`, `signIn.social`, `signUp.email`, `useSession`, `updateUser`, `changePassword`). Walidacja pseudonimu (`lib/auth/nickname.ts`, `/api/users/nickname-available`) zostaje; plugin `username` dokłada **unikalność w bazie**, której dziś świadomie nie ma (CLAUDE.md §4.12), więc to decyzja właściciela (pytanie 3).
- **Avatar** (`lib/auth/avatar.ts`, `public/default-avatar.jpg`): zamiast wgrywania do Clerka zapis do R2 (prywatny/publiczny bucket jak miniatury) i `User.imageUrl`.
- **CSP** (`lib/utils/security.ts`): wylatują hosty Clerka (`clerk.*`, `accounts.*`); zostaje `challenges.cloudflare.com` dla Turnstile i `accounts.google.com` dla One Tap.
- **Testy:** 40 plików mockuje Clerk; trzeba wspólny mock `authClient`/`getSession` w `tests/setup.ts` i przepisać mocki. To największa pozycja pracy.
- **Proxy:** `middleware.ts` → `proxy.ts` (codemod). Bonus: w Node.js runtime proxy może rozmawiać z Postgresem, więc limity admina (`admin-rate-limit.ts`) przestają wymagać Upstash REST (§7).

### 2.4 Pułapki

- **`admin` plugin a nasza rola:** plugin trzyma rolę jako string (`"admin"`, `"user"`), a my mamy enum `SystemRole` (`ADMIN`/`USER`). Nie mieszać: na start bez pluginu `admin`, autoryzacja dalej przez `resolveDbBackedActor`. [niezweryfikowane: czy da się zmapować wartości]
- **Bezpieczeństwo jest nasze:** limity prób logowania (Better Auth ma wbudowany rate limit; magazyn ustawić na bazę, nie pamięć, bo mamy 2 repliki [niezweryfikowane: opcja `rateLimit.storage: "database"`]), `BETTER_AUTH_SECRET` w SOPS, `trustedOrigins`, ciasteczka `Secure`/`SameSite=Lax`, 2FA dla admina, aktualizacje biblioteki (subskrypcja wydań/advisories).
- **Maile auth** (weryfikacja, reset hasła) idą przez nasz relay (§4). Bez działającej wysyłki nikt nie zresetuje hasła.
- **Google OAuth client** w Google Cloud: nowe redirect URI `https://www.pawelperfect.com/api/auth/callback/google`; zgoda OAuth (ekran consent) w trybie produkcyjnym. Konto Google zostaje IdP, tego się nie da "sprowadzić do siebie".

### 2.5 Plan etapami (bez migracji użytkowników)

0. **Decyzje** (pytania 1-3 w §19) i gałąź robocza. Clerk działa dalej na produkcji (Vercel) do końca.
1. **Schemat:** addytywna migracja: `User.emailVerified`, tabele `Session`/`Account`/`Verification`. Bez usuwania czegokolwiek.
2. **Serwer auth:** `lib/auth.ts` (`betterAuth` + `prismaAdapter` + Google + email/hasło + `username` + `captcha` Turnstile + `haveIBeenPwned` + `nextCookies()` na końcu), `app/api/auth/[...all]/route.ts`, wysyłka maili przez istniejący moduł e-mail.
3. **Warstwa aktora:** `lib/api/auth.ts` i `identity-provider.ts` na Better Auth; reszta modułów bez zmian (one znają tylko `Actor`).
4. **Proxy:** `middleware.ts` → `proxy.ts`, `clerkMiddleware` → `getSessionCookie` do przekierowań; prawdziwa autoryzacja dalej w trasach (`requireAdminForApi`). CSRF i limity admina bez zmian w logice.
5. **UI:** `AuthModal`/`AccountModal`/`ProfileSection`/`UserMenu` na `authClient`; usunięcie `ClerkProvider`, `ClerkLocalizationProvider` (tłumaczenia błędów piszemy sami), `/sso-callback` uproszczone.
6. **Testy i porządki:** wspólne mocki, usunięcie `@clerk/*`, `svix` (jeśli nie używany gdzie indziej), `/api/webhooks/clerk`, `/api/admin/health/clerk`, `ADMIN_CLERK_USER_IDS`; aktualizacja CLAUDE.md §4.5, §4.12.
7. **Przełączenie** razem z przeniesieniem aplikacji na serwer (§3): świeża baza na serwerze, pierwsze konto admina (rola nadana SQL-em albo `ADMIN_EMAILS`), testowe konta Clerk porzucone. Komentarze/płatności testowe albo czyścimy, albo zostawiamy jako osierocone wiersze starych ID (to dane testowe).

Szacunek pracy: **3-6 dni agenta** (największe: UI i 40 plików testów) [niezweryfikowane]. RAM/CPU: brak osobnej usługi; koszt CPU hashowania haseł (scrypt) przy logowaniu, pomijalny przy naszym ruchu [niezweryfikowane]. Ryzyko: **średnie-wysokie** (bezpieczeństwo logowania przechodzi na nas), łagodzone tym, że nikt jeszcze nie korzysta.

**Odrzucone alternatywy:** Auth.js/NextAuth v5 (mniej gotowych klocków: brak wbudowanego username/2FA/passkey/captcha w jednym spójnym API; projekt od 2025 utrzymywany przez zespół Better Auth [niezweryfikowane]); Keycloak/Zitadel/Authentik (osobna usługa JVM/Go z własną bazą, 0,5-1,5 GB RAM, własny UI logowania, a my chcemy zachować nasze modale); Ory Kratos (mocny, ale osobna usługa i dużo konfiguracji); Lucia (projekt wygaszony jako biblioteka w 2025, zostały poradniki [niezweryfikowane]); Supabase Auth/Neon Auth (znowu zarządzane albo wymaga stosu Supabase).

## 3. Hosting: Vercel → Docker + Caddy + Cloudflare Tunnel

Szczegóły w `03-nextjs-self-hosting.md`; tu tylko werdykt.

- **Zamiennik:** obraz budowany w CI (GitHub Actions), wysyłany do GHCR, na serwerze `docker compose pull` + `deploy.sh` z health checkiem, 2 repliki za Caddy, Cloudflare Tunnel jako jedyne wejście. Crony → timery systemd z `Bearer $CRON_SECRET` (wtedy także `stripe-reconciliation` co 15 min).
- **Odrzucone:** Coolify/Dokku/CapRover (zjadają RAM i CPU, których mamy mało; Coolify ok. 0,5-1 GB [niezweryfikowane]); Kamal 2 (dobry, ale dokłada Ruby i kamal-proxy; nasz skrypt jest prostszy dla agentów); budowanie na serwerze (build potrzebuje ok. 3 GB sterty, `03` §1).
- **Uwaga nowa względem `03`:** `03` zakładał, że Clerk/Neon/Upstash zostają. W tym planie przenosimy je razem, więc znika problem opóźnienia do Neon us-east-1 (`04` §2.2), ale **podglądy PR na Vercel tracą bazę** (dziś dzielą ją z produkcją, po przeniesieniu bazy na serwer nie mają do niej dostępu). Rekomendacja: wyłączyć podglądy Vercel; jeśli potrzebne, podgląd na serwerze "ops" z osobną bazą.
- **Wysiłek:** 2-4 dni agenta. **RAM:** 2 repliki × 120-240 MiB [zmierzone §14] + Caddy ok. 30-50 MB [niezweryfikowane]. **Ryzyko:** średnie (autoskalowanie znika; przy skoku ruchu rośnie opóźnienie). **Werdykt: zastąpić teraz** (razem z bazą i auth).

## 4. E-mail wychodzący: Resend → ? (uczciwie: zostaje relay)

### 4.1 Dlaczego własny serwer pocztowy na Hetznerze to zły interes

- **Port 25 i 465 są zablokowane** na wszystkich serwerach Hetzner Cloud. Odblokowanie: po **miesiącu** klienta i **pierwszej opłaconej fakturze** można złożyć "limit request" z uzasadnieniem; port 587 jest otwarty od razu, ale tylko do wysyłki przez zewnętrznego dostawcę. [zweryfikowane: Hetzner Docs, Cloud Servers FAQ, dostęp 2026-10-01]
- **Reputacja IP:** świeże IP z puli chmurowej (często na listach typu "dynamic/cloud" w Spamhaus/UCEPROTECT) zaczyna z gorszą reputacją; trzeba "rozgrzewać" wysyłkę tygodniami i pilnować list blokad. [niezweryfikowane: ogólna wiedza branżowa]
- **Reguły Gmaila** (od 2024-02-01): wszyscy nadawcy muszą mieć SPF lub DKIM, poprawny rekord PTR (odwrotny DNS), TLS i spam rate w Postmaster Tools poniżej 0,3%; nadawcy powyżej 5000 maili/dzień: SPF **i** DKIM, DMARC (wystarczy `p=none`), zgodność domeny From z SPF/DKIM, jednoklikowy wypis dla maili marketingowych. [zweryfikowane: Google Workspace Admin Help "Email sender guidelines", answer 81126]
- **Outlook/Microsoft** wprowadził podobne wymagania (SPF, DKIM, DMARC) dla nadawców powyżej 5000 maili/dzień w 2025 r. [niezweryfikowane: komunikat Microsoft z kwietnia 2025, nie sprawdzony dziś]
- **Kto to utrzymuje:** kolejka, odbicia (bounces), skargi (FBL), DKIM-rotacja, monitorowanie list blokad. Dziś robi to Resend i przekazuje nam zdarzenia webhookiem (`handle-resend-webhook.use-case.ts`).

### 4.2 Opcje

| Opcja | Plusy | Minusy | Werdykt |
|---|---|---|---|
| **Zostaje Resend** (dziś Free: 100 maili/dzień, 3000/mies., `EMAIL_SETUP.md`) | działa, domena zweryfikowana, kod gotowy | usługa USA; przy broadcastach limit Free szybko się skończy | **zostaje na teraz** |
| Europejski relay (np. Scaleway TEM, Brevo, Mailjet, Lettermint, AWS SES eu-central-1) | dane w UE, tanio przy małym wolumenie | zmiana adaptera (`legacy-email-service-provider.ts`) i webhooków zdarzeń | **później, jeśli suwerenność danych ma znaczenie** [ceny niezweryfikowane] |
| **Postal** (własny "Mailgun") | pełna kontrola, webhooki, wiele domen | wymaga **min. 4 GB RAM i 2 rdzeni**, zalecany osobny serwer, nadal problem portu 25 i reputacji IP | odrzucony [zweryfikowane: Postal docs "Pre-requisites"] |
| **Stalwart** (Rust, jeden plik: SMTP, IMAP, JMAP, filtr spamu, ACME) | lekki (ok. 100-150 MB w spoczynku), dobry jako serwer skrzynek | ten sam problem portu 25/reputacji przy wysyłce bezpośredniej | odrzucony do wysyłki; **ewentualnie później jako lokalna kolejka z relayem** [RAM: źródła wtórne] |
| Postfix jako lokalny MTA → relay na 587 | kolejka u nas, aplikacja mówi SMTP | nic nie poprawia w dostarczalności, dokłada usługę | odrzucony (Resend API ma już kolejkę i ponowienia) |

**Werdykt: zostawić zarządzany relay.** Ewentualna zmiana na europejskiego dostawcę = "później", mała zmiana adaptera. **Resend Audiences** (`resend-audience.gateway.ts`) można zastąpić własną tabelą subskrybentów (mamy już `Subscription` i podpisany `/unsubscribe`): **później**, mało pracy, mniej zależności. Nagłówek `List-Unsubscribe` + `List-Unsubscribe-Post` (wymóg Gmail dla masowych) trzeba wtedy ustawiać samemu [niezweryfikowane: czy dziś robi to Resend za nas].

## 5. E-mail przychodzący i skrzynka `hello@`

- Dziś: MX domen u Google (Workspace), `hello@pawelperfect.com` to skrzynka Workspace; osobno Resend przyjmuje maile przychodzące (`email.received`) i admin ma "Inbox" (`list-inbound-emails.use-case.ts`).
- **Własny serwer odbiorczy** (Stalwart/Mailcow/Mailu) jest technicznie łatwiejszy niż wysyłka (port 25 przychodzący na Hetznerze nie jest blokowany [niezweryfikowane]), ale: filtr spamu, kopie skrzynek, dostępność (nadawcy ponawiają kilka dni, więc krótka awaria nie gubi poczty [niezweryfikowane]), klient pocztowy, telefon. Mailcow chce 6+ GB RAM [niezweryfikowane].
- **Werdykt: Google Workspace zostaje** (skrzynka właściciela i dostęp agentów przez `gcloud`/konto serwisowe są już ustawione, `GOOGLE_ACCESS.md`). Inbound z Resend **później** można zastąpić odczytem skrzynki `hello@` przez Gmail API z konta serwisowego (już istnieje) i usunąć jedną zależność od Resend.

## 6. Repozytorium i CI: GitHub → Forgejo?

- **Fakty:** Forgejo v16.0 (2026-07-16), Forgejo Runner v13.1.0 (2026-08-31); Forgejo Actions jest w dużej mierze zgodne ze składnią GitHub Actions. [zweryfikowane: forgejo.org, wpisy wydań; zgodność "w dużej mierze" niezweryfikowana dla naszego `ci.yml`]
- **Co nas trzyma przy GitHub:** agenci pracują przez `gh` (PR, checks, merge), narzędzia sesji (`mcp__ccd_pr__*`) i cały przepływ "PR → zielone CI → squash merge" z CLAUDE.md §0; GHCR na obrazy (`03`); Dependabot/alerty bezpieczeństwa; integracja Vercel (do czasu przeniesienia). Forgejo ma własne CLI (`tea`) i API, ale **nie jest zgodne z `gh`**, więc każdy agent i każda instrukcja musiałaby się zmienić.
- **CI na własnym runnerze:** build Next potrzebuje ok. 3 GB sterty (`03`), a serwer "app" ma 4 GB i działającą aplikację. Runner musiałby stać na osobnej, większej maszynie albo spowalniać produkcję.
- **Zasoby Forgejo:** sam serwer ok. 150-300 MB RAM + baza [niezweryfikowane]; runner z Dockerem tyle, ile job.
- **Werdykt: GitHub zostaje głównym repo i CI. Później: lustro na Forgejo** (pull mirror co godzinę na serwerze "ops") jako kopia poza GitHub, bez Actions. Przeprowadzka tylko, jeśli właściciel ma konkretny powód (np. blokada konta), i wtedy jako osobny projekt z przepisaniem instrukcji agentów. Odrzucone: Gitea (Forgejo to wspólnotowy fork z aktywniejszym rozwojem; licencyjnie i funkcjonalnie bliskie, wybór Forgejo jest preferencją [niezweryfikowane]), GitLab CE (4+ GB RAM [niezweryfikowane], za ciężki).

## 7. Limity żądań: Upstash → Postgres (albo Valkey)

- Dziś: `lib/rate-limit.ts` ma interfejs `RateLimitStore` z dwiema metodami (`hit`, `setNxEx`) i implementację Upstash REST; w produkcji bez Redisa aplikacja rzuca wyjątek (`03` §1). Limity admina są wołane z `middleware.ts`, który w Next 16 po zmianie na `proxy.ts` działa w Node.js (§2.2), więc może używać zwykłego klienta bazy.
- **Opcja A, Postgres (rekomendowana na start):** tabela `UNLOGGED rate_limit(key, count, reset_at)` i jedno `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` na `hit`; `setNxEx` jako `INSERT ... ON CONFLICT DO NOTHING` z wygasaniem. Zero nowych usług, spójne z `04` (pg-boss też na Postgresie). Koszt: zapis na każde chronione żądanie, przy naszym ruchu pomijalny [niezweryfikowane pod obciążeniem]. Uwaga: tabelę `UNLOGGED` tworzymy surowym SQL w migracji (Prisma tego nie modeluje), a po awarii Postgresa jej zawartość znika, co dla limitów jest w porządku.
- **Opcja B, Valkey 8** (wolny fork Redisa): kontener z `maxmemory 64mb`, bez trwałości, ok. 10-30 MB RAM [niezweryfikowane]; nowy adapter na `ioredis`. Ma sens, jeśli dodamy Better Auth `secondaryStorage` (sesje w Redisie) albo BullMQ.
- Odrzucone: zostawienie Upstash (działa, darmowe, ale kolejna zależność USA i ok. 100+ ms RTT z Norymbergi do regionu bazy Upstash [niezweryfikowane: region naszej bazy Upstash nie sprawdzony]); limity w pamięci procesu (2 repliki = 2 osobne liczniki).
- **Werdykt: zastąpić teraz (Opcja A)**, razem z przeniesieniem aplikacji. Wysiłek: ok. pół dnia + testy.

## 8. Pliki: Vercel Blob i R2

- **Vercel Blob → R2: zastąpić teraz.** Upload obrazków komentarzy (`comments/image-upload`, dziś tylko Blob) na R2 tym samym klientem co miniatury; 6 starych miniatur skryptem `media:migrate-thumbnails-r2` (już istnieje, CLAUDE.md §4.8). Potem `@vercel/blob` i `BLOB_READ_WRITE_TOKEN` do usunięcia, i dopiero wtedy wolno usunąć projekt Vercel.
- **R2 → własny magazyn S3 (MinIO/Garage/SeaweedFS): nie.** Cała strategia wideo zakłada, że pliki dla widzów idą z R2 przez CDN Cloudflare, a nie przez VPS (`serwerek.md` §3, `02`). Własny S3 na serwerze oznaczałby transfer przez nasze łącze, dysk 80 GB i własne kopie. R2 ma zerowy koszt transferu wychodzącego i 10 GB za darmo.
  - **MinIO odpada w ogóle:** repozytorium społecznościowe w trybie utrzymania od grudnia 2025, zarchiwizowane 2026-04-25, obrazy Docker przestały być publikowane w październiku 2025 [źródła wtórne, 2026; niezweryfikowane w repo MinIO].
  - **Garage** (lekki, rozproszony S3 od Deuxfleurs) to sensowna opcja **tylko** na drugą, niezależną kopię backupów na serwerze "ops" [niezweryfikowane: wymagania].
- **Werdykt: R2 zostaje (zarządzane, ale to "dysk", nie logika; łatwo wymienne przez API S3).**

## 9. Wideo: Mux / Cloudflare Stream → własny HLS

- Plan w `01` (FFmpeg + Shaka Packager, drabinka H.264, CMAF) i `02` (R2 + CDN Cloudflare, token HMAC w WAF, **wymaga planu Cloudflare Pro**, ok. 20-25 USD/mies.). Research **wstrzymany decyzją właściciela**, filmy testowe zostają na Mux.
- Na serwerze: worker FFmpeg na "ops" (`nice -n 19`, `MemoryMax=1500M`, jedno zadanie naraz, `01`), kolejka pg-boss (`04`). Transkodowanie na tej samej maszynie co aplikacja spowalnia SSR (limit CPU, `SERWEREK.md` §14), stąd drugi serwer.
- **Werdykt: zastąpić później**, po starcie, gdy właściciel wznowi temat. Przy kilku filmach i małym ruchu Mux jest tańszy niż Cloudflare Pro [niezweryfikowane: zależy od minut].

## 10. Monitoring, logi, błędy

| Potrzeba | Rekomendacja | RAM (szacunek) | Odrzucone |
|---|---|---|---|
| Czy strona żyje (z zewnątrz) | **Uptime Kuma** na serwerze "ops" pinguje "app" (i odwrotnie prosty `health.sh`); dodatkowo darmowy zewnętrzny pinger albo healthchecks.io dla crona/backupu | ok. 100-150 MB [niezweryfikowane] | monitorowanie z tej samej maszyny (padnie razem z nią, `SERWEREK.md` §11 pkt 11) |
| Błędy aplikacji | **GlitchTip** (zgodny z SDK Sentry, `@sentry/nextjs`); tryb all-in-one bez Redisa | 256-512 MB [źródła wtórne + GlitchTip README] | Sentry self-hosted (kilkanaście kontenerów, 16+ GB RAM [niezweryfikowane]); Sentry SaaS Developer (darmowy, ale zarządzany; dobra opcja przejściowa) |
| Logi | na start `docker logs` z rotacją (`json-file`, `max-size`) + journald; podgląd przez Dozzle (lekki) za Access | Dozzle ok. 20-50 MB [niezweryfikowane] | Grafana + Loki + Prometheus na start (ok. 0,5-1 GB, za ciężkie na 4 GB) |
| Metryki | `health.sh` (już jest) + ewentualnie Beszel albo node_exporter później | niewielki | pełny Prometheus na start |

Dziś repo **nie ma** Sentry ani innego zbierania błędów (brak `@sentry/*` w `package.json`; jest `instrumentation.ts`). **Werdykt:** GlitchTip i Uptime Kuma **później**, razem z serwerem "ops"; do tego czasu darmowy Sentry Developer (zarządzany) jako tymczasowy, bo SDK jest ten sam i przejście na GlitchTip to zmiana DSN.

## 11. Analityka: Vercel Analytics → Umami

- Poza Vercel `<Analytics />` nie zbiera danych (`03` §1).
- **Umami** (Node + Postgres, może użyć tej samej instancji Postgresa z osobną bazą), bez ciasteczek, ok. 150-300 MB RAM [niezweryfikowane]. Postawić na "ops" (wtedy osobny Postgres albo baza na "app" przez sieć prywatną Hetzner).
- Odrzucone: Plausible CE (wymaga ClickHouse, ok. 2 GB+ RAM [niezweryfikowane], za ciężkie); Matomo (PHP + MySQL, cięższy, bogatszy niż potrzeba).
- Tymczasowo: Cloudflare Web Analytics (darmowe, zarządzane, `03`). **Werdykt: później.**

## 12. Sekrety: SOPS + age

Jak w `04` §7 i `SERWEREK.md` §11 pkt 10: pliki `*.enc.env` zaszyfrowane SOPS + age w repo, klucz prywatny age tylko na serwerach i w `.ai-secrets`. Zero RAM, zero usług. Odrzucone: Vault/OpenBao (osobna usługa z odpieczętowywaniem, przesada dla jednej osoby), Infisical self-hosted (Node + Postgres + Redis [niezweryfikowane]). **Werdykt: teraz** (przy przenoszeniu, bo sekretów przybędzie: `BETTER_AUTH_SECRET`, Google OAuth, hasła Postgresa).

## 13. DNS, CDN, DDoS, Tunnel, Access, Turnstile: Cloudflare zostaje

Nie da się tego zastąpić na VPS: ochrona przed DDoS wymaga pojemności sieci, której nie mamy; CDN dla HLS (`02`) i R2 są u Cloudflare; Tunnel + Access dają zero otwartych portów (`SERWEREK.md` §4); Turnstile jest darmowy i Better Auth go wspiera. Własny DNS (PowerDNS/Knot + secondary) daje kontrolę bez zysku. Alternatywy (bunny.net, Fastly) to też usługi zarządzane. **Werdykt: zostaje.** Jedyny przewidywany koszt: Cloudflare Pro, gdy ruszy własny HLS (`02`).

## 14. Podsumowanie: tabela werdyktów

| Usługa | Zamiennik | Wysiłek (agent) | RAM na naszym serwerze | Ryzyko | Werdykt |
|---|---|---|---|---|---|
| Clerk | Better Auth + Prisma (w aplikacji) | 3-6 dni | ~0 (biblioteka) | średnie-wysokie (bezpieczeństwo logowania) | **teraz** |
| Vercel | Docker + Caddy + Tunnel, crony systemd | 2-4 dni | 2× 120-240 MiB + Caddy | średnie | **teraz** (razem z bazą) |
| Neon | Postgres 17 w Dockerze + pgBackRest do R2 | 1-2 dni | 70-300 MB | średnie (kopie są nasze) | **teraz** (razem z aplikacją) |
| Upstash | tabela UNLOGGED w Postgresie | 0,5 dnia | ~0 | niskie | **teraz** |
| Vercel Blob | R2 | 0,5-1 dnia | 0 | niskie | **teraz** |
| Mux / CF Stream | FFmpeg + Shaka → R2 + CDN | tygodnie (`01`, `02`) | worker ≤ 1,5 GB na "ops" | średnie | **później** (wstrzymane) |
| Resend (wysyłka) | — | — | — | — | **zostaje** (ewentualnie EU relay później) |
| Resend Audiences | własna tabela + `/unsubscribe` | 0,5-1 dnia | 0 | niskie | **później** |
| Resend inbound | Gmail API skrzynki `hello@` | 1 dzień | 0 | niskie | **później** |
| Google Workspace | — | — | — | — | **zostaje** |
| GitHub | lustro Forgejo na "ops" | 0,5 dnia (lustro) | 150-300 MB | niskie (lustro) / wysokie (przeprowadzka) | **zostaje + lustro później** |
| Monitoring/błędy | Uptime Kuma + GlitchTip (+ Dozzle) | 1 dzień | ~0,5 GB na "ops" | niskie | **później** |
| Vercel Analytics | Umami | 0,5 dnia | 150-300 MB na "ops" | niskie | **później** |
| Sekrety | SOPS + age | 0,5 dnia | 0 | niskie | **teraz** |
| Cloudflare | — | — | — | — | **zostaje** |
| Stripe | — | — | — | — | **zostaje** (decyzja) |

## 15. Kolejność zastępowania (rekomendowana)

1. **Vercel Blob → R2** (niezależne, można od razu na obecnej produkcji).
2. **SOPS + age** w repo (fundament pod resztę sekretów).
3. **Better Auth na gałęzi** (etapy 1-6 z §2.5), testowane lokalnie i na `apptest.pawelperfect.com` (serwerek, za Access) z testową bazą Postgres na serwerze.
4. **Limity na Postgresie** + `middleware.ts` → `proxy.ts` (ta sama gałąź albo zaraz po).
5. **Przeniesienie jednym oknem:** Postgres na serwerze (pusta baza z migracjami + ewentualnie dane treści z Neon przez `pg_dump`: filmy, kanał, ustawienia), aplikacja w Dockerze, crony systemd, przełączenie rekordu `www` w Cloudflare (`03` §7). Vercel i Neon zostają nietknięte 14 dni jako zapas.
6. **pgBackRest do R2 + próba odtworzenia** (`04` §4) zanim ktokolwiek się zarejestruje.
7. **Drugi serwer "ops"**: Uptime Kuma, GlitchTip, Umami, lustro Forgejo; później worker FFmpeg.
8. **Później:** własny HLS (gdy właściciel wznowi), Resend Audiences/inbound, ewentualnie EU relay.

## 16. Architektura docelowa

```
                  Internet
                     │
           ┌─────────▼──────────┐
           │     Cloudflare     │  DNS, CDN, DDoS, Turnstile,
           │ (Tunnel + Access)  │  R2 (miniatury, oryginały, HLS, backupy)
           └───┬───────────┬────┘
   www (publiczne)│           │ panele (Access: tylko właściciel)
   ┌──────────────▼───┐   ┌───▼─────────────────────┐
   │ serwer "app"     │   │ serwer "ops"            │
   │ cloudflared      │◄──┤ Uptime Kuma (pinguje app)│
   │ Caddy            │   │ GlitchTip, Umami, Dozzle │
   │ Next.js ×2       │   │ worker FFmpeg + pg-boss  │
   │  + Better Auth   │──►│  (czyta kolejkę z app    │
   │ Postgres 17      │   │   przez sieć prywatną)   │
   │ pgBackRest → R2  │   │ lustro Forgejo (opcja)   │
   └──────────────────┘   └──────────────────────────┘
        │ HTTPS API (zostają zarządzane)
        ├─ Stripe (płatności)
        ├─ Resend lub EU relay (wysyłka maili)
        ├─ Google (OAuth, Workspace hello@)
        └─ GitHub (repo, CI, GHCR)
```

- Sieć prywatna Hetzner między serwerami (darmowa [niezweryfikowane: cennik]); Postgres nasłuchuje tylko na niej i na `127.0.0.1`.
- Sekrety: "app" ma klucze aplikacji (Stripe, relay, Google OAuth, R2), "ops" tylko R2 + dostęp do kolejki. Pracownia agenta z wszystkimi kluczami to osobna sprawa (`serwerek.md` §D: nie na serwerze produkcyjnym).
- Rozmiary: "app" CPX22 wystarcza na start (`SERWEREK.md` §14), "ops" CPX22 albo większy, gdy ruszy transkodowanie.

## 17. Koszt miesięczny: dziś vs cel

| Pozycja | Dziś | Cel |
|---|---|---|
| Hetzner "serwerek"/"app" CPX22 | ok. €24,59 [zweryfikowane: `SERWEREK.md` §3] | ok. €24,59 |
| Hetzner "ops" | — | ok. €15-25 (CPX22 lub podobny) [niezweryfikowane: cena do sprawdzenia w konsoli, ceny zmieniały się w 2026] |
| Hetzner Backups (+20%) | — | ok. €5 (opcja) [niezweryfikowane] |
| Vercel | $0 (Hobby) | $0 (usunięty po 14 dniach) |
| Neon | $0 (Free) | $0 (usunięty) |
| Clerk | $0 (darmowy próg, `serwerek.md` §5) | $0 (usunięty) |
| Upstash | $0 (Free) [niezweryfikowane: plan] | $0 (usunięty) |
| Resend | $0 (Free) | $0, a przy broadcastach płatny plan relay ok. $20 [niezweryfikowane] |
| Cloudflare | $0 (Free; R2 w 10 GB) | $0, a z własnym HLS Pro ok. $20-25 (`02`) |
| Mux / Stream | ok. $0-5 [niezweryfikowane: faktury nie sprawdzone] | $0 po własnym HLS |
| Google Workspace | płatne, cena nie sprawdzona | bez zmian |
| GitHub | $0 | $0 |
| **Razem (bez Workspace)** | **ok. €25-30** | **ok. €40-55**, z Cloudflare Pro i płatnym relayem **ok. €80-95** |

Wniosek: przy obecnej skali własny stos **kosztuje więcej**, nie mniej, bo dziś prawie wszystko mieści się w darmowych planach. Zyskiem jest kontrola, brak limitów (Neon CU-h, Clerk MRU, Resend 100/dzień) i dane w UE; kosztem jest praca utrzymaniowa (aktualizacje, kopie, bezpieczeństwo logowania), którą wykonują agenci.

## 18. Co zostaje zarządzane i dlaczego

- **Stripe** — decyzja właściciela; płatności i zgodność PCI nie są do robienia samemu.
- **Cloudflare** — DDoS, CDN, R2 bez opłat za transfer, Tunnel/Access, Turnstile; niezastępowalne na VPS.
- **Relay pocztowy (Resend lub europejski)** — port 25 zablokowany na Hetznerze do miesiąca + faktury + zgłoszenia, reputacja IP, wymogi Gmail/Outlook; własny MTA to dużo pracy za gorszą dostarczalność.
- **Google Workspace** — skrzynka `hello@`, konto admina i konto serwisowe agentów; Google zostaje też jako dostawca logowania "przez Google".
- **GitHub** — przepływ pracy agentów (`gh`, PR, checks), GHCR, CI na mocnych runnerach; Forgejo najwyżej jako lustro.

## 19. Otwarte pytania do właściciela

1. **Czy zgoda na Better Auth teraz**, zanim ktokolwiek się zarejestruje? (Rekomendacja: tak; później będzie drożej.)
2. **Konta testowe:** czy porzucamy wszystkie obecne konta Clerk i dane testowe (komentarze, płatności testowe) przy przełączeniu, czy przenosimy treści (filmy, kanał, ustawienia) i czyścimy resztę?
3. **Pseudonim unikalny?** Plugin `username` wymusza unikalność w bazie; dziś świadomie jej nie ma (CLAUDE.md §4.12). Czy unikalny pseudonim jest OK?
4. **Logowanie:** zostaje Google + e-mail/hasło? Dodać passkeys, One Tap, kod e-mailem? 2FA obowiązkowe dla admina (rekomendacja: tak)?
5. **Drugi serwer "ops":** zgoda na ok. €15-25/mies., i kiedy (rekomendacja: przy uruchomieniu GlitchTip/Uptime Kuma albo workera)?
6. **E-mail:** zostaje Resend, czy przejść na europejskiego dostawcę (dane w UE)? Jaki wolumen broadcastów przewidujesz (wpływa na plan płatny)?
7. **GitHub:** wystarczy lustro na Forgejo jako kopia, czy jest powód, żeby się wyprowadzić całkiem?
8. **Podglądy PR** (dziś Vercel): czy są potrzebne po przeniesieniu? Jeśli tak, to na "ops" z osobną bazą.
9. **Hetzner Backups (+20%)** na serwerze "app", gdy będą prawdziwe dane?

## 20. Źródła (dostęp 2026-10-01)

- Better Auth — Prisma adapter: https://www.better-auth.com/docs/adapters/prisma [zweryfikowane]
- Better Auth — Next.js integration: https://www.better-auth.com/docs/integrations/next [zweryfikowane]
- Better Auth — Database (modelName, fields, additionalFields, generateId, secondaryStorage): https://www.better-auth.com/docs/concepts/database [zweryfikowane]
- Better Auth — CLI (`npx auth@latest generate`): https://www.better-auth.com/docs/concepts/cli [zweryfikowane]
- Better Auth — plugins: passkey https://www.better-auth.com/docs/plugins/passkey, captcha https://www.better-auth.com/docs/plugins/captcha, one-tap https://www.better-auth.com/docs/plugins/one-tap, username https://www.better-auth.com/docs/plugins/username, have-i-been-pwned https://www.better-auth.com/docs/plugins/have-i-been-pwned [zweryfikowane]
- npm registry: `better-auth` 1.7.7 i `@better-auth/passkey` 1.7.7 (modyfikacja 2026-09-30), `@better-auth/cli` 1.4.21 (2026-08-19), przez `npm view` [zweryfikowane]
- Next.js — proxy.js (Node.js runtime domyślnie od 16.0.0; middleware przestarzały), lastUpdated 2026-09-07: https://nextjs.org/docs/app/api-reference/file-conventions/proxy [zweryfikowane]
- Hetzner — Cloud Servers FAQ (porty 25/465): https://docs.hetzner.com/cloud/servers/faq/ [zweryfikowane]
- Google — Email sender guidelines: https://support.google.com/a/answer/81126 [zweryfikowane]
- Postal — Pre-requisites: https://docs.postalserver.io/getting-started/prerequisites/ [zweryfikowane przez wyniki wyszukiwania; strona nie otwarta bezpośrednio]
- Stalwart — wymagania: https://stalw.art/docs/install/requirements/ oraz dyskusja https://github.com/stalwartlabs/stalwart/discussions/2800 [źródła wtórne, niezweryfikowane bezpośrednio]
- Forgejo v16.0 (2026-07) i Runner v13.1.0 (2026-08-31): https://forgejo.org/news/, https://forgejo.org/2026-09-runner-release-v131/ [zweryfikowane przez wyniki wyszukiwania]
- MinIO w trybie utrzymania / archiwum: https://linuxiac.com/minio-ends-active-development/, https://www.stablebuild.com/blog/minio-images-disappeared-from-docker-hub [źródła wtórne]
- GlitchTip — wymagania: https://gitlab.com/glitchtip/glitchtip-backend/-/blob/master/README.md, https://glitchtip.com/blog/2025-11-13-glitchtip-5-2-released/ [źródła wtórne + README, niezweryfikowane dziś]
- Wcześniejsze dokumenty serii: `01`-`04` w tym katalogu, `docs/operations/SERWEREK.md`, `docs/architecture/serwerek.md`.

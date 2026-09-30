# Back-office (centrum dowodzenia): analiza i plan wdrożenia

Status: **ODŁOŻONE przez właściciela (2026-09-30)** jako przerost formy na obecną skalę; dokument zostaje jako referencja (Etap 0 z tego planu jest realizowany niezależnie). Brak zmian w kodzie w ramach tego dokumentu. Data: 2026-09-30. Podstawa: `main` @ `b664f6e`.

Jak czytać: **[V]** = zweryfikowane w kodzie (ścieżka podana), **[A]** = założenie lub wiedza spoza repo, do sprawdzenia przy wdrożeniu.

## 0. Streszczenie i rekomendacja

1. **Kierunek docelowy, który przyjąłeś, jest słuszny:** osobna aplikacja pod osobną domeną, własne logowanie pracowników (Google SSO), uprawnienia jako klucze, log audytowy wskazujący pracownika, monorepo z `CODEOWNERS`.
2. **Zmieniam jedno: kolejność.** Nie zaczynać od wydzielenia aplikacji. Największą wartość bezpieczeństwa (izolacja origin, własne sesje, RBAC, audyt, CSRF, limity) daje się dostarczyć **najpierw w obecnym repo i obecnym deployu**, obsługując panel na osobnym hoście (`panel.<nowa-domena>`) przez ten sam projekt Vercel. Fizyczna ekstrakcja do `apps/admin` staje się wtedy mechaniczna i niskiego ryzyka. Powód: dzisiejsza granica jest cienka w tożsamości (jeden punkt, `requireAdminActor`), ale gruba w danych i kodzie domenowym (`lib/modules/*`, Prisma). Rozcinanie tego jednocześnie ze zmianą logowania to dwa ryzykowne przedsięwzięcia naraz.
3. **Największa luka nie dotyczy architektury:** dziś **zwrot płatności nie zostawia śladu w audycie**, panel **nie ma ochrony CSRF ani limitów żądań**, a `AuditLog` nie zapisuje typu aktora, IP ani identyfikatora żądania. To warto naprawić niezależnie od podziału (Etap 0).
4. **Biblioteka logowania: Better Auth.** Auth.js (NextAuth) jest w trybie utrzymania (tylko poprawki bezpieczeństwa), a jego opiekunem jest zespół Better Auth, który sam poleca Better Auth dla nowych projektów ([ogłoszenie](https://better-auth.com/blog/authjs-joins-better-auth)). **[A]** Nie weryfikowałem w dokumentacji szczegółów wtyczek; to sprawdzam w Etapie 1 na prototypie.
5. **Repozytorium:** monorepo wystarcza. Osobne repo dopiero, gdy zewnętrzny wykonawca ma nie widzieć kodu backendu, albo względy prawne (sekcja 6 na końcu części 2).

## 1. Weryfikacja stanu obecnego

### 1.1 Skala i granice [V]

| Fakt | Źródło |
|---|---|
| 77 plików w `app/admin`, 55 tras w `app/api/admin`, 16 stron | `app/admin/**`, `app/api/admin/**` |
| Strona `/admin/videos/new` z CLAUDE.md §5 **nie istnieje** (jest `videos/layout`, `videos/[id]`, `videos/[id]/edit`) | `app/admin/videos/` |
| Zależność jest **jednokierunkowa**: żaden niezwiązany z adminem kod nie importuje `app/admin` | grep `@/app/admin` |
| `lib/modules/*` nie wolno importować `app/` (egzekwuje CI) | `scripts/check-architecture.ts` |
| Admin importuje z publicznego kodu tylko: `app/components/icons` (33 pliki), `Navbar` (13), `SafeAvatar` (2), `PremiumWrapper`+`VideoPlayer` (**tylko** `app/admin/videos/[id]/page.tsx`), `components/ui/*`, `components/skeletons/admin`, `app/hooks/useToast` (13) | mapa importów |
| `Navbar` ciągnie Clerk, `LanguageContext`, `AuthModalProvider`, `UserMenu`, `NotificationsMenu`, `/api/user/profile`, `/api/notifications` | `app/components/Navbar.tsx` |
| Admin zależy od głównego layoutu: `Providers` (React Query, Language, Toast, Motion), `ClerkLocalizationProvider`, `AuthModalProvider`, czcionki, `globals.css` (1206 linii, tokeny `--chan-*`, skórka `admin-visual-shell`) | `app/layout.tsx`, `app/components/Providers.tsx`, `app/globals.css` |
| Jedna aliasowa ścieżka `@/* -> ./*`, używana wszędzie (także `@/app/...`) | `tsconfig.json` |

**Sprzężenie odwrotne (publiczne → admin), tylko po URL-ach [V]:**
- `app/components/comments/components/CommentItem.tsx` wywołuje `/api/admin/comments/{id}/hide|restore|heart` z **publicznego** interfejsu komentarzy (akcje moderatora).
- `UserMenu.tsx`, `AccountModal.tsx` linkują do `/admin`; `app/robots.ts` blokuje `/admin/`; `middleware.ts` ma dla admina osobne reguły.

### 1.2 Tożsamość i autoryzacja [V]

- Wszystko przechodzi przez `requireAdminActor()` (`lib/api/auth.ts:97`) → `resolveDbBackedAdminActor` (`:52`): Clerk `auth()`, potem `User.role === "ADMIN"` **lub** identyfikator w `ADMIN_CLERK_USER_IDS` (`lib/admin-config.ts`). Usunięty użytkownik dostaje 403.
- Trzy konsumenty: `requireAdmin()` i `requireAdminForApi(scope)` (`lib/auth-utils.ts:51`, `:16`) oraz nieużywane `requireAdminSession()` (`lib/api/auth.ts:70`).
- **Wszystkie 55 tras** `app/api/admin/**` używają `requireAdminForApi(scope)`; `app/admin/layout.tsx:10` i `channel/page.tsx:18` używają `requireAdmin()`. Żadna trasa go nie pomija.
- `middleware.ts` (l.62, l.136-141): dla `/admin(.*)` i `/api/admin(.*)` tylko `auth.protect()` (jest zalogowany w Clerku). **Rola jest sprawdzana dopiero w handlerze/layoucie** (dwie warstwy).
- Typ `Actor` = `guest | user{userId} | admin{userId} | system{reason}` (`lib/modules/shared/actor.ts`); około 100 miejsc w `lib/modules` sprawdza `actor.type`.
- Publiczny kod też rozpoznaje admina po `actor.type==="admin"`: miniatury szkiców (`app/api/videos/[id]/thumbnail/route.ts:50`), obejście dostępu (`check-video-access.use-case.ts:61-89`), podgląd (`playback.service.ts:43`, `isAdminPreviewSession`), `app/api/user/profile/route.ts:25`.
- Znaczek "admin" w komentarzach i UI liczony z `User.role` (`lib/comments-public-author.ts:34`, `channel-layout.service.ts:55` i inne): to zależność **kosmetyczna**, nie autoryzacyjna.

### 1.3 Dane i audyt [V]

- `AuditLog` (`prisma/schema.prisma:138-151`): `actorUserId String?` (zwykły string, **bez relacji**), `action String` (tekst, nie enum), `targetType/targetId`, `metadata Json?`, `createdAt`. **Brak:** typu aktora, IP, user-agenta, requestId, różnicy przed/po, niezmienności.
- `lib/modules/audit`: `recordAuditEvent(ctx, {...}, tx?)`, około 60 wywołań w 44 plikach; odczyt tylko po celu lub użytkowniku (bez paginacji, bez filtra po akcji/dacie, bez UI). Aktorzy `guest` i `system` zapisują `actorUserId = null`, więc **powód systemowy ginie**.
- **Aktorzy akcji admina to zwykłe stringi, żaden nie jest kluczem obcym:** `PatronGrant.grantedById`, `AppSetting.updatedBy`, `NotificationTemplate.updatedBy`, `VideoDistributionPlan.createdByAdminId`, `Comment.pinnedById/deletedById/moderatedById`, `CommentReport.resolvedById`, `BroadcastEmail.createdById`, `AuditLog.actorUserId`. Tylko `PatronGrant.user` jest prawdziwym FK.
- **`Payment` nie zapisuje, kto/kiedy/dlaczego zrobił zwrot lub synchronizację sporu.** `PatronGrant` nie ma `revokedBy` ani powodu.
- **Mutacje admina bez zdarzenia audytu [V]:** zwrot (`payments/admin-refund.use-case.ts` → `handle-refund.use-case.ts`), `admin-dispute-sync`, broadcast powiadomień, szablony powiadomień (jedyne miejsce z `updatedBy`), aktualizacja skrzynki odbiorczej, resync subskrybentów, `make-source-primary`, `sync-cloudflare-status`, trasy `distribution-plan`, `provider-jobs/retry`, `reconcile`, `distribution-backfill`, `cover-upload`. Ustawienie miniatury domyślnej zapisuje `prisma.auditLog.create` **z pominięciem modułu**.

### 1.4 Bezpieczeństwo panelu dziś [V]

- **Brak ochrony CSRF** na trasach admina (brak tokenu, sprawdzenia Origin, wymogu nagłówka).
- **Brak limitów żądań** na jakiejkolwiek trasie `/api/admin`; `lib/rate-limit.ts` jest używany tylko na trasach publicznych.
- Walidacja wejścia niespójna: część tras z zod (`emails/broadcast`), część z ręcznymi strażnikami (`admin/videos`), część rzutuje `req.json()` bez schematu (`payments/refund`, `comments/delete`).
- Trasa awaryjna `/api/admin/health/clerk` omija `auth.protect()` przy tokenie `HEALTHCHECK_TOKEN` z nagłówka **lub `?token=` w URL** (trafia do logów), porównanie zwykłym `===` (`middleware.ts:71-76`, `health/clerk/route.ts:95-112`).
- Jedna globalna CSP dla wszystkiego (`lib/utils/security.ts:41`, `generateCSP()`), z `'unsafe-inline'` w script i style, zawiera hosty, których panel nie potrzebuje (YouTube, Vimeo, Unsplash, Dicebear, hosty obrazów komentarzy); **nie zawiera** `accounts.google.com`.
- `X-Frame-Options: DENY` globalnie (`next.config.mjs`), `typescript.ignoreBuildErrors: true` (jedyną bramką typów jest job CI `typecheck`).

### 1.5 Narzędzia i wdrożenie [V]

- Jeden pakiet `kraufanding`; `postinstall` = `prisma generate`; `vercel-build` uruchamia **migracje** (`prisma migrate deploy`) przy każdym deployu (`package.json`, `vercel.json`). Jeden projekt Vercela (`polutek.pl`), 3 crony w tym projekcie.
- CI (`.github/workflows/ci.yml`): 12 jobów zakładających jeden korzeń (typecheck, tests/coverage, lint, build, hotspots, architecture-boundaries, strict-escapes, control-plane-docs, integration-postgres, security, prisma-validation, environment-validation). Migracje produkcyjne: osobny workflow ręczny `production-db-migrations.yml`.
- Skrypty importujące kod aplikacji: `scripts/{backfill-video-assets-1n,check-architecture,ensure-required-emails,launch-diagnose,migrate-thumbnails-to-r2,reconcile-missing-clerk-users,resync-clerk-access,validate-env}.ts`.
- Testy dotykające admina: około 12 plików czyta pliki admina po ścieżkach (`tests/unit/admin-route-authorization-static.test.ts`, `admin-auth-actor-canonicalization.test.ts`, `admin-access.test.ts`, `api/admin/**` i inne), `tests/e2e/beta-smoke.spec.ts`.
- Brak `CODEOWNERS`; jest tylko `.github/pull_request_template.md`.

### 1.6 Założenia [A], nie zweryfikowane

Szczegóły konfiguracji Google `hd`/2SV w Better Auth; dostępność wtyczek Better Auth (2FA, role); zachowanie ciasteczek Clerka względem subdomen (zależy od konfiguracji instancji produkcyjnej); zasady ochrony gałęzi GitHub i role zespołowe Vercela dla Twojego planu (Hobby); wszystkie wywołania starszych pomocników `isAdmin`/`verifyAdmin`/`isAdminRequest` (znaleziono tylko definicje w `lib/auth-utils.ts`).

## 2. Architektura docelowa

### 2.1 Układ

```txt
apps/
  web/      # dzisiejsza publiczna aplikacja (strony, /api publiczne, webhooki, crony)
  admin/    # panel: strony, /api/admin, logowanie pracowników
packages/
  db/       # prisma/schema.prisma + migracje + klient  (JEDEN właściciel schematu)
  core/     # dzisiejsze lib/modules/* (przypadki użycia), bez zależności od apps/*
  ui/       # prymitywy shadcn, ikony, tokeny stylów, toasty
  playback-contract/  # TYLKO typy/DTO planu odtwarzania (bez sekretów i bez podpisywania)
```

- **Właściciel schematu i migracji:** `packages/db`, migracje uruchamia wyłącznie **jedno** miejsce (dzisiejszy `vercel-build` w `web` albo, lepiej, workflow `production-db-migrations.yml`). Drugi projekt Vercela nie uruchamia `migrate deploy` (uniknięcie wyścigu). CI dodaje kontrolę dryfu schematu, którą już masz dla jednej aplikacji.
- **Dostęp do danych:** admin używa `packages/core` **bezpośrednio** (ta sama baza). Osobne API między aplikacjami podwoiłoby pracę i wprowadziło nową powierzchnię ataku. Zmienia się to dopiero, gdy: (a) pojawi się zespół zewnętrzny bez dostępu do bazy, (b) admin ma działać na innej bazie/regionie, (c) ścieżki krytyczne (płatności) mają mieć jednego autora. Do tego czasu granicę wymuszają `check-architecture.ts` (rozszerzony o reguły `apps/web` ↛ `apps/admin`, `packages/*` ↛ `apps/*`) i uprawnienia `CODEOWNERS`.
- **Czego admin NIE dostaje:** webhooków, cronów, ścieżek ingestu dostawców wideo i `fulfillPayment` (nikt z panelu go nie woła, tylko webhook Stripe, cron i szybka ścieżka strony powrotnej: `handle-stripe-webhook.use-case.ts:67`, `get-payment-status.use-case.ts:59`). Zostają w `apps/web`.

### 2.2 Alternatywy rozważone

| Wariant | Ocena |
|---|---|
| A. Osobny deploy + monorepo od razu (Twoje założenie) | Cel końcowy poprawny. Ryzykowne jako pierwszy krok: równoczesna zmiana logowania, dostępu do danych, CSP, podglądu wideo, testów i CI. |
| **B. Ten sam deploy, osobny host (`panel.<domena>`), potem ekstrakcja (rekomendowane)** | Daje izolację origin (ciasteczka hostowe), własną CSP per host i własne logowanie już w Etapie 1, przy jednym projekcie Vercela i bez ruszania importów. Ekstrakcja (Etap 3) jest później mechaniczna. Ograniczenie: wspólny proces i wspólne sekrety do czasu Etapu 3. |
| C. Osobne repo dla panelu | Duplikacja schematu i kodu domenowego albo publikowane pakiety; wolniejsze zmiany. Patrz 2.6. |
| D. Panel jako SaaS (Retool itp.) | Odrzucone: uprawnienia i audyt musiałyby żyć poza Twoją bazą, a to jest sedno wymagań. |

### 2.3 Domena panelu

**Decyzja właściciela (2026-09-30): start na subdomenie `admin.pawelperfect.pl`** (osobne logowanie pracowników, niezależne od Clerk i od kont użytkowników strony). To jest akceptowalne, o ile spełnione są warunki: ciasteczka panelu z prefiksem `__Host-` (bez `Domain=`, nie do nadpisania z innej subdomeny), **ścisła równość `Origin`** z hostem panelu oraz wymagany nagłówek niestandardowy przy każdej mutacji (bo `www` i `admin` są dla przeglądarki *same-site*, więc `SameSite` sam nie chroni przed żądaniem z przejętej strony publicznej), osobna CSP per host, kontrola przejęcia subdomen (brak wiszących rekordów DNS). Słabszy punkt względem osobnej domeny rejestrowalnej: atak na `www` jest same-site względem panelu. Przeniesienie panelu na osobną domenę w przyszłości to zmiana konfiguracji i ponowne logowanie, nie przebudowa.

Pierwotna rekomendacja (osobna domena rejestrowalna, nie subdomena `pawelperfect.pl`): plik cookie z atrybutem `Domain=` ustawiony (przypadkowo) na domenie nadrzędnej albo przejęcie subdomeny nie sięga wtedy sesji admina. **[A]** Cookies Clerka na `pawelperfect.pl` są zakresowane hostem/domeną zgodnie z konfiguracją instancji; trzeba potwierdzić, że ich zasięg nie obejmuje nowej domeny. Wymóg dla nowej domeny: własne rekordy w Cloudflare, osobny host w Vercelu, ciasteczka z prefiksem `__Host-`. Decyzja o nazwie domeny jest Twoja (pytanie na końcu).

## 3. Model tożsamości i uprawnień

### 3.1 Schemat (propozycja)

```prisma
model StaffUser {
  id            String   @id @default(uuid())
  email         String   @unique          // dokładnie ten adres z Workspace
  googleSub     String?  @unique          // stały identyfikator konta Google, wiązany przy 1. logowaniu
  displayName   String
  status        StaffStatus @default(ACTIVE)   // ACTIVE | SUSPENDED | OFFBOARDED
  legacyUserId  String?  @unique          // mapowanie na dzisiejszy User.id (Clerk) właściciela
  createdAt     DateTime @default(now())
  createdById   String?
  lastLoginAt   DateTime?
  offboardedAt  DateTime?
  roles         StaffUserRole[]
}
model StaffRole {
  id          String @id @default(uuid())
  key         String @unique               // OWNER, CONTENT_EDITOR, SUPPORT, FINANCE, MODERATOR ...
  name        String
  permissions String[]                     // klucze z rejestru w kodzie, np. "payments.refund"
  users       StaffUserRole[]
}
model StaffUserRole { staffUserId String; roleId String; @@id([staffUserId, roleId]) }
```

- Tabele sesji i kont dostarcza Better Auth; mapujemy jego tabelę użytkownika na `StaffUser` (`modelName`). **[A]** do potwierdzenia na prototypie.
- **Rejestr uprawnień żyje w kodzie** (stałe TypeScript: `videos.view|edit|publish|delete`, `payments.view|refund|settings`, `patron.grant|revoke`, `users.view|export`, `comments.moderate`, `emails.broadcast`, `settings.edit`, `staff.manage`, `audit.view`). Baza mapuje **role na klucze**. Dzięki temu nowy moduł deklaruje swoje uprawnienia w kodzie, a test statyczny pilnuje, że każda trasa admina je deklaruje (analogicznie do `admin-route-authorization-static.test.ts`).
- `OWNER` ma wszystkie uprawnienia. **Na start jeden `StaffUser` = Ty** (`legacyUserId` = Twój dzisiejszy Clerk id), zakładany skryptem `staff:bootstrap`, nie przez UI.

### 3.2 `Actor` i wymiana źródła

1. Dodać `requireStaffActor()` i **podpiąć pod nie `requireAdminActor()`** (`lib/api/auth.ts:97`). Wrappery w `lib/auth-utils.ts` zachowują sygnatury, więc **55 tras i layout nie wymagają edycji** w tym kroku.
2. Zwracany aktor: `{ type: "admin", userId: <StaffUser.id>, staffId, permissions }` (zgodność wsteczna z około 100 miejscami `actor.type==="admin"`), z tym że kolejne kroki wprowadzają `requirePermission("payments.refund")` w trasach.
3. Tryb przejściowy `STAFF_AUTH_MODE = clerk | dual | staff` w konfiguracji: `dual` przyjmuje sesję pracownika **lub** dzisiejszego admina Clerk. Wycofanie = przełączenie zmiennej.

### 3.3 Logowanie (przepływ)

1. Przekierowanie do Google (OIDC, przepływ z przekierowaniem, bez skryptów zewnętrznych). Parametr `hd=<domena Workspace>` to **tylko podpowiedź UI**.
2. Callback po stronie serwera **zawsze** weryfikuje w tokenie ID: podpis i `aud`, `email_verified === true`, oraz `hd` równe domenie firmowej.
3. Następnie **lista dozwolonych**, nie sama domena: znajdź `StaffUser` po dokładnym `email`, wymagaj `status = ACTIVE`. Brak wpisu = odmowa. **Bez automatycznego zakładania kont.**
4. Przy pierwszym logowaniu zapisz `googleSub`; kolejne logowania wymagają zgodnego `sub` (adres e-mail w Workspace może zostać przypisany innej osobie).
5. **2FA:** wymuszone w Workspace (Admin → Zabezpieczenia → Weryfikacja dwuetapowa, wymuszona dla całej jednostki organizacyjnej). Aplikacja **nie zakłada**, że token ID zawiera dowód użycia 2SV; to gwarantuje polityka Workspace **[A]**.
6. Utworzyć sesję **w bazie** (możliwość natychmiastowego unieważnienia), rotować identyfikator po logowaniu.
7. **Ponowne uwierzytelnienie** (świeże logowanie w ciągu 10 minut) przed operacjami krytycznymi: zwrot, ustawienia płatności, nadawanie/odbieranie patrona, broadcast, aktywacja trasy odtwarzania.

### 3.4 Odejście pracownika

Ustaw `status = OFFBOARDED`, unieważnij wszystkie jego sesje, zawieś konto Workspace. **Wiersz `StaffUser` zostaje na zawsze** (audyt wskazuje na niego). Twarde usuwanie jest zabronione. Zdarzenie `staff.offboarded` trafia do audytu.

### 3.5 Akcje wskazujące dziś na `User`

- Kolumny aktorów pozostają zwykłymi stringami (nie są FK), więc **nie ma migracji danych wstecz**. Konwencja: nowe wpisy zapisują `StaffUser.id` (uuid), stare zawierają identyfikator Clerk (`user_...`); odróżnialne po formacie. Warstwa wyświetlania rozwiązuje oba przez `StaffUser.legacyUserId`.
- Pole `actorUserId` w `AuditLog` zostaje (kompatybilność), dochodzą: `actorType` (`staff|user|system|webhook|cron`), `actorStaffId` (FK do `StaffUser`), `systemReason`, `requestId`, `ip`, `userAgent`, `before/after` (JSON, opcjonalnie).
- **Do dodania, bo dziś ich nie ma:** `Payment.refundedById/refundedAt/refundReason`, `PatronGrant.revokedById/revokeReason`, ustawienie `Comment.pinnedById` przy przypinaniu (**[A]** wygląda na nieustawiane, nie sprawdzałem).
- `User.role = ADMIN` zostaje wyłącznie jako **kosmetyczny znaczek** w publicznym UI, a nie jako źródło autoryzacji (Etap 5 usuwa `ADMIN_CLERK_USER_IDS`).

### 3.6 Log audytowy

- **Nowe nazewnictwo** `obszar.czynność` (np. `payments.refund`, `videos.publish`) obok starego, z mapowaniem historycznych `NOUN_VERB`.
- **Wymuszenie pokrycia:** test statyczny "każda trasa POST/PUT/PATCH/DELETE w `app/api/admin` musi wywołać `recordAuditEvent` lub deklarować wyjątek z uzasadnieniem". Obecne luki (sekcja 1.3) są listą prac Etapu 0.
- **Niezmienność:** wyzwalacz w PostgreSQL blokujący `UPDATE` i `DELETE` na `AuditLog` (rola aplikacji nie ma tych uprawnień) plus, opcjonalnie później, łańcuch skrótów. Retencja i RODO: patrz pytania.
- **UI:** strona `audit` (uprawnienie `audit.view`) z filtrami po pracowniku, akcji, obiekcie, dacie i paginacją kursorem. Repozytorium przestaje używać `any`.

## 4. Bezpieczeństwo

| Obszar | Wymaganie |
|---|---|
| **Sesje i ciasteczka** | Nazwa z `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax` (wymagane przy powrocie z OAuth), bez `Domain=`. Sesja w bazie: bezwzględnie 8 h, bezczynność 30 min, unieważnianie przy odejściu i zmianie ról. |
| **CSRF** | Middleware panelu dla każdego non-GET: sprawdzenie `Origin`/`Sec-Fetch-Site` względem własnego hosta **oraz** wymagany nagłówek niestandardowy. Server Actions mają wbudowane sprawdzenie Origin **[A]**; trasy `route.ts` muszą je dostać. |
| **Limity żądań** | Upstash (już używane): okno przesuwne per pracownik i per IP na logowaniu i mutacjach; ostrzejsze na `payments.*`, `patron.*`, `emails.broadcast`. |
| **CSP panelu** | Osobna, oparta na nonce, **bez `'unsafe-inline'` w script**, `frame-ancestors 'none'`, `object-src 'none'`. `connect-src` tylko: własny host, R2 i `upload.cloudflarestream.com` (bezpośrednie wgrywanie z przeglądarki), Blob. `frame-src iframe.videodelivery.net` (podgląd). **Bez** YouTube/Vimeo/Unsplash/Dicebear/hostów komentarzy. Google nie jest potrzebne w `script-src` przy przepływie z przekierowaniem. |
| **Walidacja** | zod na wszystkich trasach admina, jeden wzorzec błędów (`handleApiError`); test wykrywający `await req.json()` bez schematu. |
| **Przejęcie konta** | 2SV wymuszone w Workspace, alert po nowym urządzeniu (Workspace), lista dozwolonych `StaffUser`, `sub` wiązane, sesje w bazie. |
| **Break-glass** | Zamiast tokenu w URL: **nagłówek** `x-health-token`, porównanie w stałym czasie, tylko odczyt diagnostyczny, wyłączony z logów. Awaryjny dostęp do panelu, gdy Google/Workspace nie działa: skrypt `staff:bootstrap` uruchamiany z poświadczeniami bazy przez właściciela (zapisane w runbooku), nie stałe konto zapasowe. |
| **Sekrety i środowiska** | Osobny zestaw zmiennych dla admina (baza, Stripe, Cloudflare API, R2, Resend, sekret Better Auth, klient Google). **Bez** kluczy podpisu odtwarzania (zostają w `web`). Środowisko `staging`: osobny projekt Vercela i **gałąź Neon** (`staging`), nigdy produkcyjna baza w previewach. Rotacja sekretów zapisana w runbooku. |
| **Operacje krytyczne** | Osobne uprawnienia i ponowne uwierzytelnienie; w Etapie 4 opcjonalnie zasada dwóch osób dla zwrotów powyżej progu. |
| **Zależności** | `npm audit` już jest bramką CI; dodać `dependabot`/renovate dla `apps/admin`. |

## 5. Rozplątanie zależności

- **`Navbar`:** nie przenosić. Panel dostaje własny `AdminTopbar` (bez Clerk, bez `LanguageContext`, bez powiadomień publicznych). To usuwa 13 importów i największe sprzężenie.
- **Ikony:** `app/components/icons` (własny zestaw SVG) → `packages/ui`. **Prymitywy shadcn** (`components/ui/*`), `components/skeletons/admin`, `useToast`/`ToastProvider` (framer-motion) i tokeny CSS (`--chan-*`, tokeny shadcn) → `packages/ui`. `globals.css` dzielimy: tokeny i baza we wspólnym pakiecie, skórka `admin-visual-shell` w `apps/admin`, style vidstack **zostają w `web`**. `SafeAvatar`: mała kopia lub `packages/ui`.
- **Podgląd wideo (najtrudniejszy punkt, niezmienniki z CLAUDE.md §4.3 zachowane):**
  - Dziś `app/admin/videos/[id]/page.tsx` montuje `PremiumWrapper`+`VideoPlayer`, polegające na ciasteczku sesji tego samego origin i publicznej trasie `/api/media-source/[videoId]` (`private, no-store`, limit 60/min, `playbackSessionId` związany z odciskiem żądającego). Na osobnym origin **przestaje działać**; publiczne strony nie mogą być osadzone (`X-Frame-Options: DENY`).
  - **Rekomendacja: wariant D.** `apps/web` udostępnia jedną wąską trasę wewnętrzną `POST /api/internal/staff-preview`. Admin (po uwierzytelnieniu pracownika i uprawnieniu `videos.preview`) wysyła żądanie podpisane HMAC (znacznik czasu ≤ 60 s, nonce, `staffId`, `videoId`); `web` sprawdza podpis i wystawia **krótkotrwały, podpisany URL iframe** Cloudflare Stream/Mux dla filmów `READY`. Panel osadza `iframe.videodelivery.net/<token>` (CSP `frame-src`), bez `vidstack`, bez `PlaybackService` w panelu.
  - Dlaczego nie kopiować `PlaybackService` do admina (wariant A): drugie miejsce z kluczami podpisu Cloudflare/Mux poszerza obszar ataku i wymaga przenoszenia testów niezmienników. Dlaczego nie wołać publicznego `/api/media-source` z panelu (wariant C): wymaga CORS z poświadczeniami i sesji admina widocznej na publicznym origin, czyli najgorszy kompromis.
  - Niezmienniki: brak `videoUrl`, odmowa dla planów nie-`READY`, brak logowania wyświetleń (`isAdminPreview`), tokeny krótkotrwałe. Test kontraktowy w `packages/playback-contract`.
  - **[A]** Wariant D ma jedną nową granicę zaufania (sekret HMAC między aplikacjami); rotacja sekretu ma być w runbooku.
- **Moderacja z publicznego UI** (`CommentItem` → `/api/admin/comments/*`): po podziale ta ścieżka przestanie działać cross-origin. **Rekomendacja:** usunąć inline-moderację z publicznego UI i moderować w panelu (kolejka `comments/reports` już istnieje). To decyzja produktowa, pytanie na końcu.
- **`syncClerkAccess`** (aktualizacja metadanych Clerk przy nadawaniu patrona, `users/[userId]/patron/route.ts`): to tylko podpowiedź dla UI (CLAUDE.md §4.5). Aby panel nie potrzebował sekretu Clerk, przenieść synchronizację do `web` (zadanie po zdarzeniu) albo zaakceptować sekret Clerk w panelu. Decyzja w Etapie 3.
- **Publiczne rozpoznawanie admina** (miniatury szkiców, obejście dostępu, podgląd): po ekstrakcji `web` nie zna sesji pracownika. Docelowo szkice są widoczne **tylko w panelu**; `checkVideoAccess` traci gałąź admina (Etap 5). W fazie przejściowej `dual` gałąź zostaje.

## 6. Plan etapowy

Każdy etap: niezależnie wdrażalny, kryteria akceptacji, wycofanie, wysiłek (osoba + agent AI, szacunek zgrubny) i ryzyko.

### Etap 0. Utwardzenie w obecnym repo (bez podziału)
- **Zakres:** (0.1) zdarzenia audytu dla wszystkich luk z 1.3, kierowanie zapisów przez moduł, rozszerzenie `AuditLog` o `actorType/systemReason/requestId/ip/userAgent` (migracja addytywna), test statyczny wymuszający pokrycie; (0.2) CSRF (Origin + nagłówek) i limity żądań w `/api/admin`, zod na trasach bez schematu, break-glass tylko nagłówkiem i w stałym czasie; (0.3) rejestr uprawnień i `requirePermission` na wszystkich 55 trasach (tylko OWNER = wszystko), test statyczny; (0.4) pola aktora na `Payment` i `PatronGrant` (migracja addytywna).
- **Akceptacja:** test statyczny "każda mutacja admina jest audytowana i ma uprawnienie" zielony; zwrot płatności zostawia wpis z aktorem; brak tras bez limitu i CSRF.
- **Wycofanie:** zmiany są addytywne; flagi na CSRF/limity.
- **Wysiłek:** 4 do 6 dni. **Ryzyko:** niskie (jedyne wrażliwe miejsce: CSRF może zablokować istniejące wywołania frontowe, więc najpierw tryb "loguj, nie blokuj" na 1 dzień).

### Etap 1. `StaffUser` + Better Auth + osobny host w tym samym deployu
- **Zakres:** modele z 3.1, migracja, `staff:bootstrap` (Ty jako OWNER), Better Auth z Google, `requireStaffActor` podpięty pod `requireAdminActor`, tryb `dual`, host `panel.<nowa-domena>` w tym samym projekcie Vercela z routingiem po hoście w `middleware.ts` (na hoście panelu tylko `/admin`, `/api/admin`, `/staff-auth`; na hostach publicznych po przełączeniu `/admin` zwraca 404), osobna CSP per host, ponowne uwierzytelnienie dla operacji krytycznych.
- **Akceptacja:** logowanie właściciela przez Google z 2SV; próba logowania konta spoza listy odrzucona; unieważnienie sesji działa natychmiast; wszystkie 55 tras działają na sesji pracownika; wpisy audytu mają `actorStaffId`.
- **Wycofanie:** `STAFF_AUTH_MODE=clerk` przywraca dzisiejszy admin bez zmian kodu.
- **Wysiłek:** 5 do 8 dni. **Ryzyko:** średnie (nowa powierzchnia logowania; zamykane przez tryb `dual`).

### Etap 2. Szkielet monorepo bez zmiany zachowania
- **Zakres:** npm workspaces (Turborepo opcjonalnie), `apps/web` jako dzisiejsza aplikacja, wydzielenie `packages/db`, `packages/core` (`lib/modules`), `packages/ui`; aliasy tak, by `@/` nadal działało; `check-architecture.ts` rozszerzony o nowe reguły; CI przepisany na ścieżki; `CODEOWNERS` dodany.
- **Akceptacja:** identyczne zachowanie i te same zielone joby CI po każdym kroku (jeden pakiet na PR).
- **Wycofanie:** każdy krok osobnym PR-em do cofnięcia.
- **Wysiłek:** 4 do 6 dni. **Ryzyko:** średnie (mechaniczne, ale dotyka 8 skryptów, testów statycznych czytających ścieżki i konfiguracji `vitest`/`tsconfig`).

### Etap 3. Ekstrakcja `apps/admin` i osobny deploy
- **Zakres:** przenieść `app/admin` i `app/api/admin`, własny layout, `AdminTopbar`, własny middleware i CSP, drugi projekt Vercela (Root Directory `apps/admin`, Ignored Build Step po ścieżkach, własne zmienne środowiskowe), wewnętrzna trasa podglądu (wariant D), usunięcie inline-moderacji z publicznego UI (decyzja), `web` traci reguły admina w `middleware.ts`.
- **Akceptacja:** panel działa w pełni pod nową domeną; publiczna strona nie zawiera już kodu ani tras admina; podgląd szkiców działa przez trasę wewnętrzną; brak kluczy podpisu odtwarzania w projekcie panelu.
- **Wycofanie:** host panelu przełączany z powrotem na projekt `web` (nadal zawiera trasy admina do końca Etapu 3, usuwane w osobnym, ostatnim PR-ze).
- **Wysiłek:** 8 do 12 dni. **Ryzyko:** wysokie (podgląd wideo, dwa deploye, parytet zmiennych). Dlatego dopiero po Etapach 0 do 2.

### Etap 4. Działy i uprawnienia
- **Zakres:** role (CONTENT_EDITOR, SUPPORT, FINANCE, MODERATOR), menu i strony per uprawnienie, UI audytu (filtry, paginacja), zasada dwóch osób dla zwrotów powyżej progu, zapraszanie i odejście pracownika w UI (`staff.manage`).
- **Akceptacja:** pracownik roli SUPPORT nie widzi płatności ani ustawień; zwrot wymaga zatwierdzenia drugiej osoby powyżej progu.
- **Wysiłek:** 6 do 10 dni. **Ryzyko:** niskie do średniego.

### Etap 5. Wygaszenie starego admina Clerk
- **Zakres:** usunąć `ADMIN_CLERK_USER_IDS`, gałąź admina w `checkVideoAccess`, tryb `dual`; `User.role=ADMIN` tylko jako kosmetyka albo usunięcie.
- **Akceptacja:** żadna ścieżka nie autoryzuje przez Clerk; testy zaktualizowane.
- **Wysiłek:** 2 do 3 dni. **Ryzyko:** niskie.

**Kolejność ma minimalizować ryzyko:** dzisiejszy admin na Clerku działa do końca Etapu 4 (tryb `dual` i wycofanie flagą), a niezmienniki z §4 (PatronGrant, `fulfillPayment`, playback) nie są modyfikowane w żadnym etapie poza tym, że panel przestaje je wywoływać bezpośrednio (`fulfillPayment` nigdy nie było wołane z admina).

### Jedno repo czy kilka (punkt 6 zadania)

- **Monorepo z `CODEOWNERS` wystarcza**, dopóki wszyscy współautorzy mogą widzieć kod backendu. Przykład reguł: `packages/core/**` i `packages/db/**` = właściciel; `apps/web/**` = zespół frontendu; `apps/admin/**` = właściciel/dział; `.github/**`, `middleware.ts`, `lib/utils/security.ts` = właściciel.
- Osoby pracujące **tylko nad publicznym frontendem** dostają: rolę bez dostępu do zmiennych produkcyjnych, wymagane przeglądy dla ścieżek spoza `apps/web/**` i `packages/ui/**`, podgląd preview na bazie `staging`.
- **Osobne repo warto dopiero wtedy, gdy:** wykonawca zewnętrzny nie może widzieć kodu backendu lub schematu, występuje wymóg prawny/kontraktowy separacji, albo zespoły mają niezależne cykle wydań. Koszt: publikowane pakiety i wersjonowanie schematu.
- **[A]** Wymuszanie `CODEOWNERS` i ochrony gałęzi wymaga odpowiedniego planu GitHub i, dla zespołu w Vercelu, planu Pro (na Hobby nie da się dodać współpracowników). To trzeba sprawdzić, zanim zespół dołączy.

## 7. Ryzyka i pytania otwarte

**Ryzyka:** (1) podgląd wideo na osobnym origin (mitygacja: wariant D, test kontraktowy); (2) wyścig migracji przy dwóch projektach Vercela (mitygacja: jedno miejsce uruchamiania migracji); (3) zablokowanie się poza panelem, gdy Google/Workspace jest niedostępny (mitygacja: `staff:bootstrap` z poświadczeniami bazy); (4) `ignoreBuildErrors: true` w `next.config.mjs`, więc job `typecheck` w każdym pakiecie musi być wymagany; (5) testy czytające pliki po ścieżkach wymagają aktualizacji przy każdym przeniesieniu.

**Pytania do Ciebie (decyzje):**
1. ~~**Domena panelu**~~ **Rozstrzygnięte:** `admin.pawelperfect.pl` (subdomena), z zabezpieczeniami z sekcji 2.3. Do potwierdzenia tylko nazwa hosta (`admin` jest łatwa do odgadnięcia, co nie jest zabezpieczeniem; można wybrać `panel`).
2. **Workspace:** ilu pracowników i czy każdy dostaje własne konto Workspace (licencja) oraz czy 2SV wymuszamy dla całej jednostki.
3. **Pierwsze działy** poza OWNER (np. treści, wsparcie, finanse, moderacja) i które strony każdy z nich ma widzieć.
4. **Moderacja komentarzy z publicznego UI:** usunąć (moderacja tylko w panelu, rekomendacja) czy zachować cross-origin.
5. **Zasada dwóch osób dla zwrotów:** od jakiej kwoty, czy od razu, czy w Etapie 4.
6. **Retencja audytu i RODO:** jak długo trzymać dane osobowe pracowników i IP w logach.
7. **Plany narzędzi:** czy planujesz płatne plany GitHub/Vercel, gdy dołączy zespół (potrzebne do `CODEOWNERS` i ról).
8. **Staging:** czy zakładamy osobną gałąź Neon i osobny projekt Vercela już w Etapie 1.
9. **`syncClerkAccess`:** przenieść do `web` (rekomendacja) czy dać panelowi sekret Clerk.

## 8. Sekcje CLAUDE.md do zaktualizowania po wdrożeniu

- **§1** (co to jest produkt): jedno zdanie o back-office'ie jako osobnej aplikacji.
- **§3** (mapa modułów): nowy układ `apps/*` i `packages/*`, zaktualizować drzewo.
- **§4.4, §4.5 i §4.6** (dostęp, Clerk tylko tożsamość, filtr odbiorców): dodać, że tożsamość pracownika jest niezależna od Clerk (`StaffUser`), a admin nie jest częścią `checkVideoAccess`.
- **§4.14** (czego nie robić): nie dodawać tras admina bez `requirePermission` i audytu; nie wystawiać sekretów podpisu odtwarzania poza `apps/web`.
- **§5** (panel admina) i **§5.1/§5.2**: przepisać (ścieżki, nowa domena, role, wzorzec listy); usunąć nieistniejące `/admin/videos/new`.
- **§6** (crony): zaznaczyć, że crony i webhooki pozostają w `apps/web`.
- **§7** (kluczowe pliki) i **§8** (zmienne): nowe pliki (`requireStaffActor`, rejestr uprawnień), nowe zmienne panelu, usunięcie `ADMIN_CLERK_USER_IDS` po Etapie 5; **§8.1** zaktualizować o sposób bootstrapu i o sekrety panelu.
- Dodatkowo: `docs/operations/` (runbook: bootstrap, break-glass, rotacja sekretu HMAC podglądu, odejście pracownika) i `docs/README.md` (odnośnik do tego dokumentu).

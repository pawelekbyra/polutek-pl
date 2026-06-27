# Polutek.pl — Refactoring Roadmap

> **Cel dokumentu:** Żywa roadmapa refaktoryzacji. Każdy AI-programista pracujący nad tym projektem powinien zacząć od przeczytania tego pliku. Dokument opisuje co jest, co jest zepsute, co jest niedokończone i w jakiej kolejności to naprawiać.
>
> **Ostatnia aktualizacja:** 2026-06-27 (pełny audyt 10 agentów równolegle)

---

## 1. Co to jest za aplikacja

**Polutek.pl** to prywatna platforma VOD (Video On Demand) — jeden kanał twórcy, treści z różnymi poziomami dostępu, system patronacki oparty na jednorazowych wpłatach Stripe.

**Stack:**
- Next.js 15.5, React 18, TypeScript 5.4
- PostgreSQL (Neon) + Prisma 6.19
- Clerk (autentykacja), Stripe (płatności), Cloudflare Stream (wideo)
- Vercel Blob (storage), Upstash Redis (rate limiting)
- Resend (email), shadcn/ui + Tailwind CSS
- Vitest (testy jednostkowe), Playwright (E2E)

**Model dostępu (trzy poziomy):**
1. `PUBLIC` — widoczne bez logowania
2. `LOGGED_IN` — wymaga konta
3. `PATRON` — wymaga aktywnego `PatronGrant` (wpłata ≥ próg)

**Źródło prawdy dla dostępu patronackiego:** tabela `PatronGrant` (nie `User.isPatron` — to cache)

---

## 2. Architektura

### 2.1 Struktura katalogów

```
app/
  api/           # Route handlers (Next.js API routes)
  admin/         # Panel administracyjny
  watch/[slug]/  # Strona odtwarzacza
  channel/[slug]/ # Strona kanału
  search/        # Wyszukiwarka
  page.tsx       # Strona główna

lib/
  modules/       # Nowa architektura (docelowa) — domain-driven
    access/      # Decyzje dostępowe (centralny punkt)
    audio/       # (jeśli istnieje)
    channel/     # Zarządzanie kanałem
    comments/    # System komentarzy
    email/       # Szablony, broadcasty, preferencje
    media/       # Polityki mediów, gating
    patron/      # Granty patronackie
    payments/    # Płatności Stripe
    subscriptions/ # Subskrypcje emailowe
    users/       # Tożsamość i profile
    video/       # CRUD filmów, assety, sesje odtwarzania
    shared/      # AppContext, Result<T,E>, Actor
  services/      # STARA architektura (legacy, do migracji)
  api/           # Helpery API (auth, context, błędy)
  utils/         # Narzędzia pomocnicze

components/      # Współdzielone komponenty shadcn/ui
prisma/          # Schema i migracje
tests/           # Vitest + Playwright
```

### 2.2 Wzorce architektoniczne (docelowe)

**Result<T,E>** — use cases zwracają `{ ok: true, data: T } | { ok: false, error: E }`, nie rzucają wyjątków.

**Actor Model** — trzy typy: `'admin'` (immutable lista z env), `'user'` (zalogowany), `'guest'`.

**Moduły** — każdy moduł ma `index.ts` jako publiczne API. Importy między modułami TYLKO przez `index.ts`, nigdy przez wewnętrzne ścieżki.

**Struktura modułu:**
```
lib/modules/video/
  application/   # Use cases (logika biznesowa)
  domain/        # Polityki, DTO, reguły
  infrastructure/ # Repozytoria, zewnętrzne serwisy
  index.ts       # Publiczne API modułu
```

---

## 3. Stan obecny — co działa, co jest zepsute

### 3.1 ✅ Działa poprawnie

- **Dostęp patronacki** — `checkVideoAccess()` zawsze odpytuje `PatronGrant`, nigdy cache `User.isPatron`. Bezpieczne.
- **Cykl życia płatności** — checkout → webhook → PatronGrant jest atomowy z idempotency (CAS + event lock).
- **Zwrot płatności** — pełny zwrot odwołuje PatronGrant; częściowy przelicza status.
- **Spory Stripe** — zawieszenie dostępu przy otwartym sporze, przywrócenie gdy wygrany.
- **Komentarze i reakcje** — operacje są w transakcjach, liki nie mogą zejść poniżej zera.
- **Trzy ścieżki unsubscribe email** — API, webhook Resend, signed token — wszystkie działają.
- **Heart komentarza** — kompletne (tylko admin, toggle, SQL atomowy).
- **Email transakcyjny** — welcome, thank-you-donation, become-patron — wysyłane poprawnie.
- **Webhook idempotency** — Stripe event lock + CAS na Payment zapobiega podwójnemu naliczeniu.
- **Admin preview** — flaga `isAdminPreview` poprawnie wyklucza admina z licznika wyświetleń.

### 3.2 🔴 Krytyczne bugi

#### BUG-001: Brak obsługi wyjątku gdy Redis pada
- **Plik:** `lib/modules/video/application/record-playback-event.use-case.ts:226`
- **Opis:** `await setNxEx(lockKey, '1', 86400)` — jeśli Redis rzuci wyjątek (np. chwilowy brak sieci), cały request wywala się z 500. Widok nie jest zliczony, a użytkownik dostaje błąd.
- **Fix:** Otoczyć try/catch, przy błędzie Redis przejść do zapisu DB (bez gwarancji deduplication, ale lepsze niż błąd).

#### BUG-002: Auth check po przetworzeniu danych w export
- **Plik:** `app/api/admin/users/export/route.ts:13-15`
- **Opis:** Kod sprawdza `ctx.actor.type !== 'admin'` DOPIERO po wywołaniu use case. Potencjalny wyciek danych jeśli use case rzuci błąd przed checkiem.
- **Fix:** Przenieść `requireAdminForApi()` na początek, przed jakimkolwiek przetwarzaniem.

#### BUG-003: Hardcoded 500 w route'ach komentarzy admin
- **Pliki:** `app/api/admin/comments/[commentId]/hide/route.ts:18`, `restore/route.ts:18`, `delete/route.ts:27`, `heart/route.ts:24`
- **Opis:** `return NextResponse.json({ error: result.error.message }, { status: 500 })` — zawsze 500, nawet gdy błąd ma własny statusCode (np. 404 NOT_FOUND).
- **Fix:** Zastąpić przez `fromUseCaseResult(result)`.

#### BUG-004: Klasyfikacja błędów przez string matching
- **Pliki:** `app/api/admin/payment-settings/route.ts:45`, `app/api/admin/payments/route.ts:20`
- **Opis:** `result.error.message.includes('Forbidden')` — kruche, podatne na błędy przy zmianie komunikatów.
- **Fix:** Używać `result.error.statusCode` lub `result.error.code`.

#### BUG-005: ThumbnailResponseService nie rozpoznaje custom domain Vercel Blob
- **Plik:** `lib/services/storage/thumbnail-response.service.ts:98`
- **Opis:** Sprawdza tylko `hostname.endsWith(".public.blob.vercel-storage.com")`. Jeśli ustawiono `NEXT_PUBLIC_BLOB_PUBLIC_HOST` z custom domain, proxy nie działa.
- **Fix:** Dodatkowo sprawdzać `env.NEXT_PUBLIC_BLOB_PUBLIC_HOST`.

#### BUG-006: Fallback /logo.png wstawiany do bazy zamiast przez walidację
- **Plik:** `lib/modules/video/infrastructure/video.repository.ts:239`
- **Opis:** `thumbnailUrl: input.thumbnailUrl || "/logo.png"` — walidacja publikacji w `get-admin-video-diagnostics` sprawdza null, ale nie sprawdza czy wartość to sentinel `/logo.png`.
- **Fix:** Nie ustawiać defaultu w repozytorium; walidacja przy publikacji powinna odrzucać `/logo.png`.

#### BUG-007: Brak try/catch przy req.json() w kilku route'ach
- **Pliki:** `app/api/admin/emails/broadcast/route.ts:18`, `app/api/admin/videos/[id]/actions/route.ts:27`
- **Opis:** Malformed JSON body spowoduje nieobsłużony wyjątek zamiast 400.
- **Fix:** Otoczyć `await req.json()` try/catch zwracającym 400.

### 3.3 🟡 Niedokończone funkcje

#### INCOMPLETE-001: HELD_FOR_REVIEW — status bez implementacji
- **Gdzie:** `prisma/schema.prisma:311` — enum istnieje, ale zero kodu go ustawia.
- **Brakuje:** Use case `hold-comment-for-review`, API endpoint, kolejka w UI admina, automatyczne triggerowanie (próg raportów).

#### INCOMPLETE-002: System referrali — backend bez frontendu
- **Gdzie:** Schema ma `Referral`, `User.referralCode`, `User.referralPoints` — ale frontend i API zostały celowo usunięte (patrz test `referral-decommissioning.test.ts`).
- **Stan:** Albo dokończyć (UI + API + integracja z PatronGrant), albo usunąć ze schematu.

#### INCOMPLETE-003: Spory Stripe — brak admin UI
- **Gdzie:** `app/admin/users/payments/page.tsx` — pokazuje status DISPUTED ale brak przycisków akcji.
- **Brakuje:** Endpoint `POST /api/admin/payments/[id]/dispute` (manualna synchronizacja), UI do oznaczania wyniku.
- **Ryzyko:** Jeśli webhook Stripe zginie, admin nie ma jak zsynchronizować stanu.

#### INCOMPLETE-004: Bounce/complaint email — brak auto-supresji
- **Gdzie:** `lib/modules/email/application/handle-resend-webhook.use-case.ts:118-123`
- **Opis:** Bounce i complaint są zapisywane w `BroadcastEmailRecipient`, ale użytkownik nadal będzie w liście odbiorców kolejnych broadcastów.
- **Fix:** Po bounce/complaint ustawiać `EmailPreference.marketingEmails = false`.

#### INCOMPLETE-005: Admin refund — brak endpointu
- **Gdzie:** `app/api/admin/payments/` — brak POST dla refundu.
- **Opis:** Admin musi używać Stripe Dashboard do zwrotów. Niesynchronizuje się automatycznie.
- **Fix:** Endpoint `POST /api/admin/payments/[id]/refund` + formularz w UI.

#### INCOMPLETE-006: Brak reconciliation job Stripe
- **Opis:** Jeśli webhook nie dotrze, stan Stripe i aplikacji może się rozjechać na dni.
- **Fix:** Cron job (np. co godzinę) który porównuje statusy płatności z Stripe API.

#### INCOMPLETE-007: Actor.isPatron — martwe pole
- **Pliki:** `lib/modules/shared/actor.ts:3`, kilka route'ów ustawiają je ale nikt nie czyta.
- **Fix:** Usunąć pole z definicji Actor i wszystkich konstruktorów.

#### INCOMPLETE-008: Podwójny null return w VideoPlayer
- **Pliki:** `app/components/VideoPlayer.tsx:457`, `app/components/PremiumWrapper.tsx`
- **Opis:** PremiumWrapper zwraca `PlayerLoadingState`, VideoPlayer zwraca `null` — dwa nakładające się stany ładowania.
- **Fix:** Jeden spójny stan ładowania zarządzany przez PremiumWrapper.

### 3.4 🟢 Czystość kodu (do posprzątania)

#### CLEANUP-001: Legacy service layer — mapa migracji
28 plików w `lib/services/` działa równolegle z `lib/modules/`. Pełna mapa:

| Priorytet | Pliki | Akcja |
|-----------|-------|-------|
| USUŃ (martwe) | `user.service.ts`, `content.service.ts`, `subscription.service.ts`, `payments-admin.service.ts` | Usunąć, zaktualizować importy |
| PRZENIEŚ (DTO) | `comment.dto.ts`, `playback.dto.ts`, `videos-admin.dto.ts`, `payments-admin.dto.ts` | Do `lib/modules/*/domain/` |
| PRZENIEŚ (utility) | `sidebar-order.ts`, `audit.service.ts`, `primary-playable-asset.ts` | Do odpowiednich modułów |
| ZREFAKTORYZUJ | `email.service.ts`, `user-access.service.ts`, `profile.service.ts` | Delegować do modułów |
| ZAPROJEKTUJ | `playback.service.ts`, `channel-layout.service.ts` | Nowe moduły `lib/modules/playback/`, `lib/modules/channel/` |

#### CLEANUP-002: Ujednolicenie error handling w API
63 route'y używają 4 różnych wzorców. Standard docelowy:
```typescript
// Route adminowy:
const { adminUserId, response } = await requireAdminForApi("OPERACJA");
if (response) return response;
try {
  const result = await useCase(input, ctx);
  return fromUseCaseResult(result);
} catch (error) {
  return handleApiError(error);
}
```

#### CLEANUP-003: Typo widoczne dla użytkowników
- **Plik:** `app/components/LanguageContext.tsx:76-80`
- `"Subskrajb"` → `"Subskrybuj"` (trzykrotnie)
- `"subskrajberów"` → `"subskrybentów"`

#### CLEANUP-004: Hardkodowany email w komponentach
- **Pliki:** `app/components/Footer.tsx:11`, `app/components/AccessLockOverlay.tsx`
- `pawel.perfect@gmail.com` widoczny dla wszystkich użytkowników
- **Fix:** Przenieść do zmiennej środowiskowej `NEXT_PUBLIC_SUPPORT_EMAIL`

#### CLEANUP-005: SearchPage — brak sizes w Image
- **Plik:** `app/search/page.tsx:63`
- Komponent `<Image>` bez `sizes` prop — Next.js nie może optymalizować
- **Fix:** Dodać `sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 100vw"`

#### CLEANUP-006: CoverImageUpload — zbędne unoptimized
- **Plik:** `app/admin/videos/components/CoverImageUpload.tsx:155`
- `<Image ... unoptimized />` wyłącza optymalizację CDN bez powodu
- **Fix:** Usunąć `unoptimized`

---

## 4. Roadmapa — fazy pracy

### FAZA 1: Bugfix krytyczny (1-2 sesje)
Naprawić rzeczy które wpływają na działanie lub bezpieczeństwo:

1. **BUG-002** — auth check przed przetwarzaniem w export
2. **BUG-003** — hardcoded 500 w route'ach komentarzy admin
3. **BUG-004** — string matching dla błędów
4. **BUG-007** — brak try/catch przy req.json()
5. **BUG-001** — Redis failure handling w view counter
6. **BUG-005** — ThumbnailResponseService custom domain
7. **BUG-006** — fallback /logo.png w bazie

### FAZA 2: Niedokończone funkcje (2-4 sesje)
Doprowadzić istniejące funkcje do końca:

1. **INCOMPLETE-007** — usunąć Actor.isPatron (dead code)
2. **INCOMPLETE-004** — auto-supresja po bounce/complaint email
3. **INCOMPLETE-003** — admin UI dla sporów Stripe
4. **INCOMPLETE-005** — admin refund endpoint
5. **CLEANUP-003** — typo w LanguageContext
6. **CLEANUP-004** — hardkodowany email
7. **INCOMPLETE-008** — podwójny loading state w VideoPlayer

### FAZA 3: Czyszczenie architektury (3-5 sesji)
Usunąć dług techniczny:

1. **CLEANUP-001** — migracja legacy services (etapami, zacząć od martwych plików)
2. **CLEANUP-002** — ujednolicenie error handling
3. **INCOMPLETE-001** — HELD_FOR_REVIEW albo usunąć z schematu albo zaimplementować
4. **INCOMPLETE-002** — referrals: decyzja (usunąć ze schematu lub zaimplementować)

### FAZA 4: Redesign admin panelu (3-5 sesji)
Panel admina jest funkcjonalny ale niespójny wizualnie z resztą aplikacji, nieintuicyjny i miejscami zagmatwany (np. flow dodawania/edycji filmów). Wymaga przeprojektowania od podstaw — nie tylko dodania brakujących funkcji.

**Problemy systemowe:**
- Wygląd odbiega od reszty aplikacji — brak spójnej estetyki
- Nawigacja nieintuicyjna, łatwo się zgubić
- Flow dodawania/edycji filmów chaotyczny — za wiele kroków, nielogiczna kolejność
- Część sekcji niepowiązana ze sobą (nested w dziwny sposób)
- Brak loading states, skeleton screens, pustych stanów (empty states)
- Część stron server components, część klient — bez logicznego podziału

**Co zrobić:**
1. Zaprojektować nowy layout admina (sidebar, nagłówki, breadcrumbs) spójny z resztą aplikacji
2. Przeprojektować flow dodawania/edycji filmów — jeden ekran, logiczne sekcje
3. Ujednolicić wszystkie formularze (walidacja, error handling, loading states)
4. Dodać brakujące funkcje:
   - Broadcast history — empty state
   - Dispute resolution UI w payments
   - Status filter w moderacji komentarzy
   - Bulk actions w komentarzach
   - Template preview modal
   - Video upload — pause/resume, ETA
   - Inline sidebar reorder z potwierdzeniem
5. Naprawić osierocone strony (layout, reports) — dodać do nawigacji

### FAZA 5: Dokumentacja (1 sesja)
1. Nowy `README.md` — aktualny, dla AI-programistów
2. Architecture Decision Records (ADR) per moduł
3. Usunąć stare/nieaktualne dokumenty
4. Zaktualizować `AGENTS.md`

---

## 5. Zasady dla przyszłych agentów

### Zawsze przed zmianą kodu:
1. Przeczytaj ten dokument
2. Sprawdź czy zmiana nie narusza granic modułów (`lib/modules/*/index.ts`)
3. Sprawdź czy zmieniasz właściwe źródło prawdy (PatronGrant, nie User.isPatron)

### Wzorce których UŻYWAĆ:
```typescript
// Wynik use case
return ok({ data });
return err({ code: 'NOT_FOUND', message: '...', statusCode: 404 });

// Route handler
return fromUseCaseResult(result);

// Obsługa błędów
} catch (error) {
  return handleApiError(error);
}

// Import z modułu
import { checkVideoAccess } from '@/lib/modules/access';
// NIE: import { checkVideoAccess } from '@/lib/modules/access/application/check-video-access.use-case';
```

### Wzorców których NIE UŻYWAĆ:
```typescript
// Nie czytaj User.isPatron dla decyzji dostępowych
user.isPatron // ❌ — to cache, może być przestarzałe

// Nie importuj z wnętrza modułu
import { ... } from '@/lib/modules/video/application/get-video.use-case' // ❌
import { ... } from '@/lib/modules/video' // ✅

// Nie zwracaj hardcoded 500
return NextResponse.json({ error: result.error.message }, { status: 500 }) // ❌
return fromUseCaseResult(result) // ✅
```

### Testowanie przed commitem:
```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest
npm run build        # Build check
```

---

## 6. Wymagania nienaruszalne (respektować w każdej sesji)

### Mobile-first — priorytet właściciela
Aplikacja musi zawsze działać i wyglądać dobrze na iPhone i różnych rozmiarach telefonów. To nie jest opcjonalne — sprawdzać przy każdej zmianie UI.

**Zasady:**
- Każdy nowy lub zmieniany komponent testować na: iPhone SE (375px), iPhone 14 (390px), duży Android (412px), tablet (768px)
- Żadnych elementów wychodzących poza ekran, żadnych overflow-x
- Przyciski i linki dotykalne — min. 44×44px (Apple HIG)
- Tekst czytelny bez zoomu — min. 16px dla treści, 14px dla etykiet
- Nawigacja dostępna jedną ręką — ważne akcje na dole ekranu (kciuk)
- Wideo player działający poprawnie na iOS Safari (specyfika: autoplay, fullscreen, controls)
- Admin panel: sprawdzać czy da się używać na tablecie (właściciel może zarządzać z iPada)

**Narzędzia do weryfikacji:**
```bash
# Przed commitem z UI:
# 1. Chrome DevTools → Toggle Device Toolbar → iPhone SE i iPhone 14
# 2. Sprawdzić czy brak horizontal scroll
# 3. Sprawdzić touch targets
```

---

## 7. Znane ograniczenia (nie naprawiać bez konsultacji)

- **Single-channel mode** — aplikacja jest zaprojektowana pod jeden kanał (MAIN_CREATOR_SLUG). Nie dodawać multi-channel bez decyzji właściciela.
- **HLS/DASH** — brak adaptive bitrate streaming. Cloudflare Stream dostarcza bezpośredni URL lub iframe embed. Zmiana wymaga inwestycji w infrastrukturę.
- **Fingerprint dla anonimowych** — SHA256(IP + UserAgent) = kolizje w sieciach firmowych. Znane ograniczenie, świadoma decyzja.
- **Referral system** — celowo wycofany (patrz `referral-decommissioning.test.ts`). Nie przywracać bez decyzji właściciela.
- **i18n** — tylko pl/en, bez routingu URL-based. Rozszerzenie wymaga przeprojektowania.

---

## 7. Zmienne środowiskowe — kompletna lista

Wymagane do uruchomienia:

```env
# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
ADMIN_CLERK_USER_IDS=          # Immutable lista adminów, comma-separated

# Baza danych (Neon/PostgreSQL)
DATABASE_URL=                  # Pooled
DATABASE_URL_UNPOOLED=         # Unpooled (dla migracji)

# Płatności (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
PATRON_MIN_TIP_AMOUNT=500      # W groszach (cent)
PATRON_MIN_TIP_CURRENCY=EUR
REFERRAL_PATRON_THRESHOLD=5

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_UNSUBSCRIBE_SIGNING_SECRET=

# Video (Cloudflare Stream)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_WEBHOOK_SECRET=
CLOUDFLARE_STREAM_SIGNING_KEY_ID=
CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY=
CLOUDFLARE_STREAM_SIGNED_TOKEN_TTL_SECONDS=3600

# Storage
BLOB_READ_WRITE_TOKEN=
MEDIA_BUCKET_HOST=
NEXT_PUBLIC_R2_PUBLIC_HOST=
NEXT_PUBLIC_BLOB_PUBLIC_HOST=
ALLOWED_MEDIA_HOSTS=
ALLOWED_THUMBNAIL_HOSTS=
ALLOWED_COMMENT_IMAGE_HOSTS=
ALLOWED_AVATAR_HOSTS=

# Rate limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Aplikacja
APP_ENV=development|staging|production
NEXT_PUBLIC_APP_URL=
MAIN_CREATOR_SLUG=
MAIN_CREATOR_NAME=
ENABLE_DEMO_FALLBACKS=false
HEALTHCHECK_TOKEN=
DISPLAY_EUR_TO_PLN_RATE=4.3
DISPLAY_USD_TO_PLN_RATE=4.0

# ZALECANE (brak = błąd dla użytkowników)
NEXT_PUBLIC_SUPPORT_EMAIL=     # Wyświetlany w Footer i AccessLockOverlay
```

---

*Ten dokument jest żywy — aktualizuj go po każdej fazie pracy.*

---

## 8. Wyniki audytu strefowego

### Strefa: app/api/ — Bezpieczeństwo

**KRYTYCZNE (naprawić natychmiast):**

| # | Plik | Problem |
|---|------|---------|
| S-001 | `app/api/admin/payment-settings/route.ts:17,32` | **Brak `requireAdminForApi()`** — GET i PATCH dostępne dla każdego zalogowanego użytkownika. Każdy może modyfikować limity płatności. |
| S-002 | `app/api/admin/payments/route.ts:10` | **Brak `requireAdminForApi()`** — lista wszystkich transakcji dostępna bez uprawnień admina. |

**WYSOKIE:**

| # | Plik | Problem |
|---|------|---------|
| S-003 | `app/api/admin/users/export/route.ts:9-15` | Auth check po przetworzeniu — kod buduje kontekst przed weryfikacją uprawnień. |
| S-004 | `app/api/admin/creator/route.ts` | Deprecated route nadal aktywny — powinien zwracać 301 redirect do `/api/admin/channel`. |
| S-005 | `app/api/admin/emails/broadcast/route.ts:93` | Fallback dla testRecipientEmail ukryty — może wysłać do złego adresata. |
| S-006 | Brak rate limitingu na: `admin/users/[id]/patron`, `admin/templates`, `admin/videos/actions`, `admin/subscribers/resync` | Skompromitowany token admina = spam operacjami. |

**WZORCE do standaryzacji:**
- 2 trasy adminowe bez `requireAdminForApi()` — pilne
- 4 różne wzorce auth w 63 route'ach — ujednolicić do jednego
- Brak try/catch przy `req.json()` w min. 3 trasach

---

### Strefa: app/admin/ — Jakość kodu

**Duplikacje do wyekstrahowania:**
- `cn()` zdefiniowane lokalnie w `comments/reports/page.tsx:207` i `users/payments/page.tsx:303` — zamiast importu z `@/lib/utils`
- Logika filter/search identycznie zduplikowana w 3+ stronach → wyciągnąć `useAdminListFilters()` hook
- `formatDate` helper zdefiniowany lokalnie w 5+ plikach → `app/admin/utils/formatDate.ts`
- Pattern submit+error handling zduplikowany w `ChannelSettingsForm` i `PaymentSettingsForm` → `useFormSubmit()` hook

**Niespójności wzorców:**
- Część stron admin to server components (`channel/`, `payments/`), część klient (`users/`, `comments/`) bez jasnego powodu
- Loading states: część skeleton, część blank screen, część brak
- Walidacja formularzy: patron actions najlepsza, payment settings brak w ogóle

**Osierocone strony (brak nawigacji do nich):**
- `/admin/videos/layout/page.tsx` — nikt do niej nie linkuje
- `/admin/comments/reports/page.tsx` — brak linku z `/admin/comments/`

**Prop drilling:**
- `AdminVideoEditView` przyjmuje 15+ props → context lub osobna strona
- `UserDetails` → dzieci → context `AdminUserDetailsContext`

---

### Strefa: components/ — Martwy kod i props

**Nieużywane komponenty (usunąć):**
- `app/components/VideoStory.tsx` — zero importów w całym projekcie
- `app/components/VideoTabs.tsx` — zero importów w całym projekcie

**Martwe props (usunąć z interfejsów):**
- `VideoPlaylist` — props: `videoId`, `videoSlug`, `onVideoSelect`, `currentVideoId` — zdefiniowane, nigdy nieużywane w ciele komponentu
- `CommentItem` — prop `onDislike` — przekazywany wszędzie jako pusta funkcja, nigdy nie wywoływany

**Hardkodowane wartości widoczne dla użytkowników:**
- `Footer.tsx:11` i `PremiumWrapper.tsx:391` i `AccessLockOverlay.tsx` — `pawel.perfect@gmail.com` → przenieść do `NEXT_PUBLIC_SUPPORT_EMAIL`
- `LanguageContext.tsx:76-80` — typo: `"Subskrajb"` (trzykrotnie) → `"Subskrybuj"`
- `ChannelHome.tsx:31` — `PATRON_PREMIERE_DATE = new Date("2026-10-13")` — data w przeszłości (teraz czerwiec 2026), licznik pokazuje "Premiera już dostępna"
- `Navbar.tsx:100-102` — badge "Beta" hardkodowany — czy projekt jest nadal w beta?

**Komponenty za duże (>200 linii, do podzielenia):**
- `VideoPlayer.tsx` — 621 linii → wyciągnąć `PlayerTimeScrubber`, `PlayerErrorOverlay`, `PlayerControls`
- `EmbeddedComments.tsx` — 480 linii → `CommentsList`, `CommentsHeader`
- `Hero.tsx` — 316 linii → `VideoInteractionButtons`, `DescriptionBox`

**Typy TS do poprawy:**
- `CommentComposer.tsx:12` — `userProfile: any` → właściwy typ
- `CommentItem.tsx:22` — `t: Record<string, string>` → za permisywny

---

### Strefa: Frontend publiczny — Przepływ i SEO

**KRYTYCZNE dla SEO:**
- `app/sitemap.ts:43` — **URL filmów to `/?v={id}` zamiast `/watch/{slug}`** — crawlery indeksują stronę główną zamiast strony filmów. Natychmiastowa naprawa.

**Brakujące stany ładowania:**
- `/app/watch/[slug]/loading.tsx` — nie istnieje
- `/app/search/loading.tsx` — nie istnieje

**Hydration mismatch:**
- `ChannelHome.tsx:34` — `Date.now()` podczas rendera → useEffect
- `CheckoutModal.tsx:112` — `new Date().getFullYear()` bez mounted check

**Brakujące canonical URLs:**
- `/watch/[slug]/page.tsx` — brak `canonical` w metadata
- `/channel/[slug]/page.tsx` — brak `canonical` w metadata

**Nieprzetłumaczone elementy:**
- `CheckoutModal.tsx:143` — "Wróć" hardkodowane
- `Footer.tsx:31` — tagline tylko po polsku
- `app/unsubscribe/page.tsx` — cała strona po angielsku bez obsługi języka

**Performance:**
- `app/search/page.tsx:7` — `force-dynamic` blokuje cache. Rozważyć `revalidate = 60`

---

### Strefa: Konfiguracja — wyniki oczekiwane

**Nieużywane paczki (usunąć):**
- `artplayer` — zera importów, projekt używa wyłącznie `@vidstack/react`
- `tw-animate-css` — duplikuje `tailwindcss-animate`
- `@react-email/render` — zero importów, email działa przez Resend
- `@base-ui/react` — zero importów
- `sharp` — zero importów (Next.js ma własną optymalizację obrazów)
- Kilka `@radix-ui/*` paczek (checkbox, dialog, dropdown-menu, label, select, tabs) — zero bezpośrednich importów
- `shadcn` — narzędzie CLI, powinno być w `devDependencies`, nie `dependencies`

**Zduplikowane funkcjonalności:**
- Dwa playery: `artplayer` + `vidstack` — usunąć artplayer
- Dwie biblioteki animacji: `tailwindcss-animate` + `tw-animate-css` — usunąć tw-animate-css

**Brakujące wpisy w `.env.example`:**
- `VERCEL_BLOB_ACCESS` (public/private)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY`
- `RESEND_WEBHOOK_SECRET`
- Zmienne `E2E_*` dla testów Playwright
- Feature flags: `ENABLE_DEBUG_LOGS`, `DEBUG_HOME_CONTENT`

**Konfiguracja TypeScript — brakujące opcje:**
- `noUnusedLocals: true` — nie włączone
- `noUnusedParameters: true` — nie włączone

**ESLint — brakujące reguły:**
- `@typescript-eslint/recommended` — nie skonfigurowane
- `no-console` — brak, kod produkcyjny ma `console.error/warn` zamiast strukturyzowanego loggera

**CI/CD — luki:**
- `npm audit --audit-level=high` jest **non-blocking** — powinno blokować build
- Brak Dependabot (`.github/dependabot.yml`)
- Brak CodeQL dla statycznej analizy bezpieczeństwa
- E2E testy nieobecne w CI pipeline

**Uwaga krytyczna dla testów:**
- `vitest.config.ts` — `environment: 'node'` zamiast `'jsdom'` — komponenty React testowane w środowisku Node mogą nie działać poprawnie jeśli korzystają z DOM API

---

### Strefa: lib/ + utils/ — wyniki oczekiwane

**Duplikacje do konsolidacji:**
- `parseMediaHosts()` — dwie definicje: `lib/blob.ts:26` i `lib/modules/media/domain/media-safety.ts:3` → używać tylko modułowej
- `parsePaginationParams()` — zduplikowana w `lib/api/admin-payments-query.ts` i `lib/services/admin/admin-query-parser.ts` → jedna kanoniczna implementacja
- `AdminPaymentListItemDto` — dwie definicje w module i w services → deprecate services version
- `formatCloudflareErrors()` — w dwóch plikach cloudflare client → `cloudflare-errors.ts`
- `PAYMENT_SORT_FIELDS` — stałe w module i w services

**Brakujące `index.ts`:**
- `lib/modules/shared/` — brak `index.ts` → wszyscy importują bezpośrednio z plików zamiast przez granicę modułu

**Naruszenia granic modułów:**
- `lib/api/admin-payments-query.ts:3` — API layer importuje bezpośrednio z domeny modułu zamiast przez `index.ts`
- Moduły `users`, `payments`, `email` importują `EmailService`, `UserAccessService` z legacy services — circular dependency risk

**Niespójne nazewnictwo:**
- Mix: `require*`, `get*`, `is*`, `verify*` dla funkcji auth → standaryzować na `require*` (throwing) / `get*` (safe)
- `auth-utils.ts` miesza `AuthError`, API-specific functions i deprecated code → rozbić na osobne pliki

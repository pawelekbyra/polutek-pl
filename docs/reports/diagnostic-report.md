# Raport diagnostyczny Polutek.pl: "Co jest chujowo"

**Status:** AUDYT STABILIZACJI
**Data:** 2026-06-30
**Autor:** Jules (AI Senior Engineer)

---

## Podsumowanie

Aplikacja przeszła potężną refaktoryzację w kierunku architektury modułowej. Fundamenty są solidne, a kluczowe inwarianty "Source of Truth" są w dużej mierze przestrzegane. Niemniej jednak, istnieje kilka obszarów "chujowości" — od długu technicznego, przez drobne rozbieżności w bezpieczeństwie, aż po utrudnienia w utrzymaniu.

### Skala dotkliwości
- **P0**: Krytyczne / Bloker wdrożenia / Ryzyko bezpieczeństwa
- **P1**: Wysokie / Rozbieżność funkcjonalna / Znaczący dług
- **P2**: Średnie / Utrzymanie / Jakość / Szlify UX

---

## 1. Kontrola dostępu i status Patrona

### [P1] Zależność od cache'u Patrona w module Email
Podczas gdy kontrola dostępu w backendzie (`checkVideoAccess`) poprawnie polega na autorytatywnym modelu `PatronGrant`, `EmailRepository` nadal odpytuje przestarzałe pole boolean `User.isPatron` przy wyborze odbiorców (np. wysyłka do wszystkich patronów).
- **Ryzyko:** Użytkownicy z cofniętymi lub wygasłymi grantami mogą nadal otrzymywać e-maile tylko dla patronów, jeśli cache nie jest idealnie zsynchronizowany.
- **Lokalizacja:** `lib/modules/email/infrastructure/email.repository.ts`
- **Naprawa:** Zaktualizować `findRecipientsForAudience`, aby używał zapytania typu `WHERE EXISTS (SELECT 1 FROM PatronGrant ... )`.

### [P2] Ręczna logika "Sync-Back" przy przeliczaniu
`recalculatePatronStatus` ręcznie aktualizuje `User.isPatron` i `User.patronSince` na podstawie grantów. Choć ma to służyć celom diagnostycznym, istnienie tego zduplikowanego stanu sprzyja powstawaniu rozbieżności (drift).
- **Status:** Częściowo rozwiązane przez `PatronDiagnosticsReadModel`, ale nadal "chujowo" jest mieć dwa miejsca dla tej samej prawdy.

---

## 2. Wideo i Media

### [P1] Rozbieżność w awaryjnym fallbacku (Emergency Fallback)
Istnieje niespójność w obsłudze flagi `ALLOW_LEGACY_PRIVATE_FALLBACK`.
- `PlaybackService` i jego polityka **ignorują** tę flagę (jest na sztywno ustawiona na `false` dla bezpieczeństwa startu).
- `app/api/media/[...path]/route.ts` (media proxy) **nadal próbuje ją odczytać** ze zmiennych środowiskowych.
- **Ryzyko:** Konfuzja podczas operacji awaryjnych. Proxy może wyglądać na gotowe do fallbacku, ale plan odtwarzania (playback plan) nigdy na to nie pozwoli.
- **Naprawa:** Ujednolicić politykę. Jeśli flaga jest wycofana, usunąć ją z proxy; jeśli jest przełącznikiem awaryjnym, musi działać w polityce.

### [P2] Niepełna integracja z Mux
System multi-source wideo obsługuje Mux w schemacie i `PlaybackService`, ale use case `addVideoSource` obsługuje go tylko częściowo w porównaniu do Cloudflare Stream.
- **Lokalizacja:** `lib/modules/video/application/add-video-source.use-case.ts`
- **Naprawa:** Doprowadzić dodawanie źródła Mux do parytetu z Cloudflare (automatyczna obsługa stanu przetwarzania, lepsza walidacja).

---

## 3. Płatności i Idempotentność

### [P1] Ręczna aktualizacja statusu w Cronie rozliczeniowym
Cron do rekonsyliacji Stripe wykonuje ręczny `tx.payment.updateMany`, aby ustawić status na `SUCCEEDED`, jeśli `PatronGrant` już istnieje, zamiast przejść przez use case `fulfillPayment`.
- **Ryzyko:** Ominięcie logów audytowych, metryk i potencjalnych efektów ubocznych (jak synchronizacja metadanych Clerk).
- **Lokalizacja:** `app/api/cron/stripe-reconciliation/route.ts`
- **Naprawa:** Upewnić się, że wszystkie udane intencje przechodzą przez standardową ścieżkę `fulfillPayment`; use case jest już bezpieczny pod kątem powtórzeń (replay-safe).

---

## 4. Jakość i Utrzymanie

### [P0] Regresje Typecheck w testach
Zestaw testów dla `VideoRepository` (relacja 1:N assetów) obecnie wywala się na typechecku, ponieważ mock `VideoAsset` nie posiada kilku pól niedawno dodanych do schematu Prisma (np. `fallbackPriority`, `mirrorSourceOriginalId`).
- **Lokalizacja:** `tests/unit/modules/video/video-repository-assets-1n.test.ts`
- **Naprawa:** Zaktualizować mocki testowe, aby pasowały do obecnego schematu.

### [P1] Regresja w kontraktach UX publicznego playera
Refaktoryzacja komponentów `VideoPlayer.tsx` i `PolutekVideoControls.tsx` zepsuła istniejące testy regresyjne sprawdzające konkretne ciągi znaków lub strukturę (np. obecność tekstu "Subtitles", konkretne klasy przycisków).
- **Lokalizacja:** `tests/unit/public-loading-state-ux.test.ts`
- **Naprawa:** Zaktualizować testy kontraktów UX, aby odzwierciedlały nowe wzorce UI "Najs" / "Rough".

### [P2] Niespójne logowanie błędów
Aplikacja używa mieszanki scentralizowanego `logger` oraz surowego `console.error`.
- **Lokalizacja:** Rozproszone w `lib/services/playback`, `lib/services/content`, itp.
- **Naprawa:** Migracja wszystkich `console.error` do `scopedLogger` lub globalnego `logger`, aby zapewnić poprawne formatowanie logów i potencjalną ingestję.

### [P2] Naruszenia "Cienkich Route'ów" (Thin Routes)
Niektóre route'y nadal zawierają drobną logikę (jak ekstrakcja IP/UserAgent czy mapowanie statusów), która mogłaby zostać wypchnięta głębiej do use case'ów lub serwisów pomocniczych.
- **Przykład:** `app/api/media/[...path]/route.ts` wykonuje ręczne sprawdzanie limitów (rate-limit) i flag środowiskowych.

---

## 5. Infrastruktura

### [P2] Pozostałości starych serwisów
Pliki `email.service.ts` i `profile.service.ts` nadal znajdują się w `lib/services`, mimo że większość ich logiki trafiła do modułów.
- **Status:** Odnotowane w `CLEANUP-001`, ale nadal wprowadza szum w katalogu `lib/`.

---

## Recepta na "Niebycie Chujowym"

1. **Naprawa bazy testowej:** Natychmiast skorygować błędy typów w `tests/`. Main nigdy nie powinien failować na typechecku.
2. **Ujednolicenie polityki Playbacku:** Albo całkowicie ubić `ALLOW_LEGACY_PRIVATE_FALLBACK`, albo uczynić ją pełnoprawnym elementem `PlaybackPolicy`.
3. **Audit "Twardości":** Zrefaktoryzować `EmailRepository`, aby odpytywało `PatronGrant` zamiast `User.isPatron`.
4. **Standaryzacja logowania:** Globalne "szukaj i zamień" dla `console.error` -> `logger.error`.
5. **Higiena rekonsyliacji:** Przebudować crona tak, by używał `fulfillPayment` dla wszystkich sukcesów.

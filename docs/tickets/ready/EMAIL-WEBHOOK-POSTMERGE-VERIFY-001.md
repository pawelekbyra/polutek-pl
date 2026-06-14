# EMAIL-WEBHOOK-POSTMERGE-VERIFY-001 — Independently verify merged Resend webhook idempotency implementation

Status: READY_FOR_CERTIFIER
Ticket ID: EMAIL-WEBHOOK-POSTMERGE-VERIFY-001
Launch impact: HIGH / LAUNCH_BLOCKER
Executive role: Reviewer / Certifier (Not Builder)

## Purpose
- Niezależnie sprawdzić aktualny main po merge #905.
- Wykonać pełny zestaw istniejących walidacji.
- Wykonać real PostgreSQL evidence.
- Udokumentować brakujące scenariusze.
- Nie naprawiać runtime w tym samym tickecie.
- Zwrócić MERGE_CERTIFIED, FIX_REQUIRED albo BLOCKED.

## Environment Requirements
- Node.js zgodny z `.nvmrc`.
- PostgreSQL 16.
- Clean database fixture.
- Upgrade database fixture (legacy `EmailEvent` rows).
- CI environment simulation:
  - `ADMIN_CLERK_USER_IDS=ci-admin`
  - `RESEND_WEBHOOK_SECRET=whsec_resend_ci`

## Verification Commands

### Environment and Architecture
```bash
npm ci
npm run env:validate:prod
npx prisma validate
npx prisma generate
npm run quality:architecture-boundaries
npm run quality:strict-escapes
npm run quality:hotspots
npm run typecheck
```

### Unit Tests
```bash
npx vitest run tests/unit/api/resend/resend-webhook-route.test.ts
npx vitest run tests/unit/modules/email/handle-resend-webhook.test.ts
npx vitest run tests/unit/modules/email/idempotency-hardening.test.ts
npx vitest run tests/unit/modules/email/email-event-lock.repository.test.ts
npx vitest run tests/unit/modules/email/concurrency-retries.test.ts
npx vitest run tests/unit/modules/email/reproduce-idempotency-race.test.ts
```

### Integration Tests (Real PostgreSQL)
```bash
RUN_INTEGRATION_TESTS=true \
npx vitest run tests/integration/email-event-idempotency.test.ts
```

### Build and Quality
```bash
npm run test:coverage
npm run lint
npm run build
npm audit --audit-level=high
```

## Migration Verification Matrix

### A. Fresh DB
- Create empty PostgreSQL 16 database.
- `npx prisma migrate deploy`
- `npx prisma generate`
- `npm run db:smoke`

### B. Upgrade DB
- Odtwórz schema sprzed migracji `20260614000000`.
- Wstaw legacy `EmailEvent` rows:
  - Różne `type`.
  - `resendEmailId`.
  - `email`.
  - `payload`.
  - Brak `providerEventId` / `status`.
- Uruchom `migrate deploy`.
- Sprawdź:
  - Stare rekordy zachowane.
  - Status ustawiony zgodnie z intencją (default PROCESSED).
  - `providerEventId` pozostaje nullable dla starych rzędów.
  - Unique index istnieje.
  - Nowe eventy mogą używać PROCESSING.
  - Stare eventy nie są przypadkowo reprocessowane.
  - Migracja nie niszczy danych.

## Required Concurrency Evidence Scenarios
1. Dwa równoległe requesty z tym samym `providerEventId`.
2. Pierwszy worker nadal PROCESSING -> drugi dostaje retryable conflict.
3. FAILED event może zostać ponowiony.
4. Stale PROCESSING może zostać przejęty.
5. Stary worker po takeover próbuje success release -> Oczekiwany wynik: Odrzucony (Ownership Loss).
6. Stary worker po takeover próbuje failure release -> Oczekiwany wynik: Odrzucony.
7. Ten sam `providerEventId`, inny event `type`.
8. Dwa różne `providerEventId` dla tego samego recipienta.
9. Równoległe SENT i DELIVERED (Counter integrity).
10. Równoległe DELIVERED i BOUNCED.
11. Crash po business mutation, przed `releaseWithSuccess`.
12. Błąd `acquireLock` inny niż P2002.
13. Błąd `releaseWithSuccess`.
14. Błąd `releaseWithFailure`.

## Expected Result for Current Code
- Jeśli current implementation nie spełnia invariantu ownership (co jest potwierdzonym gapem), ticket musi zakończyć się statusem **FIX_REQUIRED** i wskazać odpowiednie tickety naprawcze.

## Allowed Paths
- Read-only dostęp do całego repozytorium.
- Tworzenie `docs/reports/reconciliation/EMAIL-WEBHOOK-IDEMPOTENCY-VERIFICATION-001.md`.
- Opcjonalne redacted evidence files.
- Temporary uncommitted probes/scripts.

## Forbidden Paths
- Modyfikacja runtime code.
- Modyfikacja existing tests.
- Mergowanie knowingly failing tests do main.

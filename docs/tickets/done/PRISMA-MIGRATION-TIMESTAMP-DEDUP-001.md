Status: DONE — audited by PR #1503 (merged to `main`, commit `f90c481`).

Confirmed the duplicate-timestamp collisions are real but inert (the
duplicated `Payment.requestId` migrations are both `IF NOT EXISTS`, verified
idempotent by applying all 40 migrations cleanly on a from-scratch replay).
No migration folders were renamed or merged — doing so would break
`_prisma_migrations` tracking on any environment that already applied them,
which this ticket itself flags as a hard line not to cross. See
`docs/audit/2026-09-26-prisma-migration-drift-and-timestamp-audit.md` for the
full writeup.

---

# PRISMA-MIGRATION-TIMESTAMP-DEDUP-001 — Normalizacja duplikatów w historii migracji Prisma

Status: READY_FOR_BUILDER
Priority: LOW (nieszkodliwe dziś, ale myląca historia)

## Why

Audyt 2026-09-13 znalazł w `prisma/migrations/` dwie pary migracji z tym samym
20-cyfrowym timestampem (Prisma stosuje je w kolejności leksykalnej nazwy
katalogu — ten sam timestamp to niezamierzona kolizja, nie celowe
uporządkowanie):

- `20260620000000_add_comment_is_hearted`,
  `20260620000000_payment_request_id`,
  `20260620000000_video_publish_after_asset_ready` — kolizja 3-way.
- `20260628000000_add_mux_vimeo_pending_primary`,
  `20260628000000_remove_referral_system` — kolizja 2-way.

Dodatkowo `20260620000000_payment_request_id` i
`20260625121500_add_payment_request_id` **obie** dodają tę samą kolumnę
`Payment.requestId` + unique index (obie `IF NOT EXISTS`, więc idempotentne i
nieszkodliwe w praktyce), ale duplikacja wskazuje na bałagan/nieporozumienie
przy generowaniu migracji, które warto wyjaśnić zanim ktoś skopiuje ten wzorzec.

## Scope

1. Zweryfikować w realnym środowisku (staging/lokalna baza z pełną historią
   migracji), czy któraś z tych migracji już została zaaplikowana w
   kolejności innej niż dziś sugerowana przez katalog — `prisma migrate
   status` na środowisku z prawdziwym `DATABASE_URL`.
2. Jeśli wszystkie środowiska (dev/staging/prod) mają już całą historię
   zaaplikowaną identycznie, samo doprecyzowanie timestampów w nazwach
   katalogów nowych migracji **nie jest możliwe bez utraty integralności**
   (Prisma śledzi zaaplikowane migracje po nazwie katalogu w tabeli
   `_prisma_migrations`) — w takim wypadku to zostaje tylko wnioskiem
   historycznym, nie realną zmianą. Nie przemianowywać istniejących katalogów.
3. Jeśli jest już bezpieczna okazja (np. planowany reset bazy deweloperskiej,
   albo środowisko bez prod danych), rozważyć scalenie zduplikowanej migracji
   `requestId` w jedną, czystą migrację przy najbliższej okazji zmiany
   schematu w tym obszarze — nie robić tego w oderwaniu tylko po to, żeby
   "posprzątać historię".

## Invariants that must survive

- **Nigdy nie edytować istniejącego pliku migracji ani nie usuwać katalogu
  migracji, który mógł już zostać zaaplikowany na jakimkolwiek środowisku**
  (per `CLAUDE.md` §3: "Never edit existing migrations; always add new
  files"). To dotyczy też samego przemianowania katalogu.
- Schemat końcowy (`prisma/schema.prisma`) musi zostać identyczny — to zadanie
  porządkuje historię/dokumentację, nie zmienia docelowego stanu tabel.

## Non-goals

- Retroaktywne "naprawianie" historii migracji przez rebase/squash — migracje
  w Prisma to append-only log stosowany 1:1 na każdym środowisku; to nie jest
  git history do rebase'owania.

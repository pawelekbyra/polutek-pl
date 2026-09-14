# AUDIT-LOG-INDEX-001 — Brakujący indeks na AuditLog(targetType, targetId)

Status: READY_FOR_BUILDER
Priority: LOW (perf, rośnie z czasem, nie correctness bug)

## Why

Audyt 2026-09-13 (runda 3) znalazł: `prisma/schema.prisma`'s `AuditLog` ma
indeksy na `actorUserId`, `action`, `createdAt`, ale nie na
`(targetType, targetId)` — dokładnie ten predykat, po którym filtruje
`findManyByTarget()` w `lib/modules/audit/infrastructure/audit.repository.ts`,
używany przez strony szczegółów admina (wideo, użytkownik). Bez indeksu
zapytanie robi seq-scan po całej tabeli `AuditLog`, co jest niezauważalne
dziś, ale będzie rosło liniowo z wolumenem logów audytowych.

## Scope

1. Nowa migracja Prisma (nigdy nie edytować istniejących — dodać nowy plik)
   dodająca `@@index([targetType, targetId])` do modelu `AuditLog`.
2. Zweryfikować na środowisku z realnym `DATABASE_URL`, że migracja
   aplikuje się czysto (`prisma migrate deploy` na staging przed produkcją).

## Invariants that must survive

- Żadna zmiana zachowania `findManyByTarget`/`getAuditLogs` — to czysto
  indeks przyspieszający istniejące zapytanie, nie zmiana logiki.
- Migracja musi być no-op dla istniejących wierszy (tylko dodaje indeks).

## Non-goals

- Zmiana domyślnych limitów `findUserAuditLogs` (100) vs `findManyByTarget`
  (50) — audyt znalazł tę niespójność jako osobny, minor finding (oba
  callery i tak przekazują jawny limit, więc nie ma dziś aktywnego buga);
  nie w zakresie tego ticketu.

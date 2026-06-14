# ARCH-CI-001 — Make architecture and critical integration validation mandatory in CI

Status: CONFIRMED_GAP
Ticket ID: ARCH-CI-001
Launch impact: HIGH

## Purpose
- Wymusić walidację architektury i krytycznych testów integracyjnych w pipeline CI.
- Zapobiec merge'owaniu PR-ów, które skipują testy lub nie przechodzą `env:validate`.

## Requirements
- `quality` job musi posiadać kompletne środowisko (env simulation).
- `ADMIN_CLERK_USER_IDS` i `RESEND_WEBHOOK_SECRET` muszą być ustawione.
- `RUN_INTEGRATION_TESTS=true` musi być włączone dla joba integracyjnego.
- CI musi raportować liczbę skipped tests jako ostrzeżenie lub błąd.
- `npm audit failure` musi być naprawione lub formalnie sklasyfikowane (nie ignorowane).

## Acceptance Criteria
- [ ] Pipeline `.github/workflows/quality.yml` (lub odpowiednik) zaktualizowany.
- [ ] Testy EmailEventLockService są wykonywane w CI na realnym PostgreSQL.
- [ ] Przejście `npm run quality:architecture-boundaries` jest bramką do merge'u.

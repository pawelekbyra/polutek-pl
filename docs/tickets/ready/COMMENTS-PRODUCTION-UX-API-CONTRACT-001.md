# COMMENTS-PRODUCTION-UX-API-CONTRACT-001

Status: IMPLEMENTATION_MERGED / HISTORICAL
Role: Historical Builder ticket
Superseded by: none for current runtime; future comments polish requires a new ticket.

## Result

PR #984 merged the intended implementation: public comment read for guests, composer UX/API contract, optimistic posting, CTA, accessibility, and focused tests.

Do not start new runtime work from this file. It is retained as evidence only.

## Original scope

Productionize video comment public read, composer UX/API contract, optimistic posting, CTA, accessibility, and focused tests.

## Original allowed paths

- app/components/comments/**
- app/api/comments/route.ts
- app/api/videos/[id]/comments/route.ts
- lib/modules/comments/**
- tests/unit/comments-route.test.ts
- tests/unit/modules/comments/**
- tests/unit/comments-ui-contract.test.ts

## Historical validation target

- npm run typecheck
- npm run lint
- npm test -- comments
- npm run build

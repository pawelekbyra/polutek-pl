# COMMENTS-PRODUCTION-UX-API-CONTRACT-001

Status: READY_FOR_BUILDER
Role: Builder
Scope: productionize video comment public read, composer UX/API contract, optimistic posting, CTA, accessibility, and focused tests.

Allowed paths:
- app/components/comments/**
- app/api/comments/route.ts
- app/api/videos/[id]/comments/route.ts
- lib/modules/comments/**
- tests/unit/comments-route.test.ts
- tests/unit/modules/comments/**
- tests/unit/comments-ui-contract.test.ts

Validation:
- npm run typecheck
- npm run lint
- npm test -- comments
- npm run build

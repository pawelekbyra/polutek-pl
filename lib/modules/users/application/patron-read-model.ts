// The patron-truth derivation (PatronGrant rows -> isPatron/patronSince/patronSource)
// is patron-module domain logic (CLAUDE.md §4.1: PatronGrant is the sole source of
// truth), so the canonical implementation lives in
// `lib/modules/patron/domain/patron-read-model.ts`. This file re-exports it so
// existing imports of `@/lib/modules/users/application/patron-read-model` (admin
// user read models, tests) keep working unchanged.
//
// Imported from the deep `domain/` path rather than the patron module's public
// index (`@/lib/modules/patron`) deliberately: that index also re-exports
// grantPatron/revokePatron/etc., and several tests mock the whole `@/lib/modules/patron`
// barrel wholesale — routing this pure, no-side-effect derivation helper through
// that barrel would entangle it with those mocks. Allowlisted in
// scripts/check-architecture.ts.
export * from "@/lib/modules/patron/domain/patron-read-model";

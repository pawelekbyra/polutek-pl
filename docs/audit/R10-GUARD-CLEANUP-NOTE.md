# R10 Guard Cleanup Note

## Status

READY_WITH_GUARD_ALLOWLIST

## Co zmieniono

- Usunięto/odświeżono stare allowlisty route violations w `scripts/check-architecture.ts`.
- Direct route `@/lib/services/**` imports są teraz jawnie allowlisted z powodami.
- Guard failuje na nowym, niezatwierdzonym direct route service import.
- Legacy AccessPolicy/comment-service stale allowances zostały odświeżone: usunięto szeroki wzorzec `services/comments`, a jawny wyjątek pozostał tylko dla aktualnie wykrytego legacy bridge'a `lib/services/content/video.service.ts`.
- `PRISMA_ROUTES_ALLOWLIST` pozostaje pusty, bo `app/api/**` nie ma bezpośrednich importów `@/lib/prisma`.

## Aktualne jawne wyjątki

| Route | Import/service | Powód | Future ticket |
| --- | --- | --- | --- |
| `app/api/media-source/[videoId]/route.ts` | `@/lib/services/playback/playback.service` | Tymczasowy legacy playback service bridge. | Post-R media/provider cleanup; przenieść playback source planning do modułu/media provider boundary. |
| `app/api/channel/sidebar/route.ts` | `@/lib/services/channel/channel-layout.service` | Tymczasowy read-side bridge dla layoutu kanału. | Future content/channel module cleanup; przenieść read model do publicznego modułu. |
| `app/api/admin/users/[userId]/patron/route.ts` | `@/lib/services/user-access.service` | Tymczasowy user access bridge wokół patron/access synchronizacji. | PatronGrant/UserAccess cleanup; usunąć zależność route'a od legacy service. |
| `app/api/admin/users/route.ts` | `@/lib/services/admin/admin-query-parser` | Tymczasowy parser query dla admin users route. | Przenieść do route-local helpera albo module query DTO parsera. |
| `app/api/admin/videos/route.ts` | `@/lib/services/admin/admin-query-parser` | Tymczasowy parser query dla admin videos route. | Przenieść do route-local helpera albo module query DTO parsera. |

## Co to oznacza dla właściciela

- Route'y nie importują bezpośrednio `@/lib/prisma`.
- Pozostałe route-service importy są jawne, policzone i kontrolowane przez guard.
- Nowy direct route `@/lib/services/**` import bez wpisu w allowliście powinien zakończyć `npm run quality:architecture-boundaries` błędem.
- To nie aktywuje Post-R control plane.
- To nie tworzy root `AGENTS.md` i nie przenosi staged docs do root `docs/`.
- Po tym PR właściciel może rozważyć osobny activation PR albo najpierw zlecić runtime cleanup dla jednego z jawnych route-service wyjątków.

## Walidacja

- `git diff --check`: PASS
- `npm run quality:architecture-boundaries`: PASS
- `npm run typecheck`: PASS
- `rg -n "@/lib/prisma" app/api || true`: PASS — brak wyników.
- `rg -n "@/lib/services/" app/api || true`: INFO — 5 wyników, wszystkie jawnie allowlisted.

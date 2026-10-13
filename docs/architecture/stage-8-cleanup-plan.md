# Etap 8: migracja czyszcząca (plan, NIE wykonana)

Status: **przygotowany, wymaga zgody właściciela** (CLAUDE.md §0, §4.0: kopia zapasowa, zasada dwóch wdrożeń).
Nic w tym dokumencie nie zostało uruchomione na żadnej bazie.

## Co usuwamy i dlaczego
| Element | Zastąpiony przez | Warunek usunięcia |
|---|---|---|
| `Creator.isApproved` | `Creator.status` (`ACTIVE`/`LIMITED` = publiczny) | każdy odczyt przeniesiony na `MainChannelPolicy.isPubliclyVisible` |
| `Creator.isPrimary` | konfiguracja „kanał główny” (strona główna) + brak sprawdzeń `isPrimary` w uprawnieniach | strona główna czyta kanał z konfiguracji, nie z flagi |
| `MAIN_CREATOR_SLUG` | `ctx.channelId`; slug kanału głównego tylko jako ustawienie strony głównej | `MainChannelService` rozwiązuje kanał z kontekstu |
| Rola `ADMIN` jako bramka | `Actor.type = "admin"` z panelu (`AdminUser`) | żadna bramka nie czyta `User.role` |
| `AccessTier.PATRON` (martwa wartość enuma) | brak | migracja `20261005210000` już usunęła z danych; sprawdzić, czy enum jeszcze ją ma |

## Kolejność (zasada dwóch wdrożeń)
1. **Wdrożenie A** (kod): nowy kod przestaje czytać i zapisywać stare pola (nadal istnieją w bazie, mają wartości domyślne).
2. Obserwacja: dzień pracy bez błędów, `grep` w logach, test dymny Studio / panelu / strony kanału.
3. **Migracja**: kopia zapasowa, potem `ALTER TABLE ... DROP COLUMN` (osobny plik w `prisma/migrations`).
4. **Wdrożenie B** (kod): schemat Prisma bez pól.

## Użycia w kodzie do przeniesienia (stan na 2026-10-13)

### `isPrimary`
- apps/admin/app/(panel)/kanaly/[id]/page.tsx
- apps/admin/app/(panel)/kanaly/page.tsx
- apps/admin/components/channels/channel-forms.tsx
- lib/launch/content-diagnostics.ts
- lib/modules/access/application/check-video-access.use-case.ts
- lib/modules/channel/application/channel-lifecycle.use-cases.ts
- lib/modules/channel/application/channel-moderation.use-cases.ts
- lib/modules/channel/application/main-channel.service.ts
- lib/modules/channel/domain/channel.policy.ts
- lib/modules/channel/infrastructure/creator-content.service.ts
- lib/modules/health/application/check-health.use-case.ts
- lib/modules/playback/application/playback.service.ts
- lib/modules/playback/domain/playback.dto.ts
- lib/modules/playback/domain/primary-playable-asset.ts
- lib/modules/video-pipeline/application/channel-limits.ts
- lib/modules/video-pipeline/application/finalize-self-hls.ts
- lib/modules/video/application/video-playback-route.service.ts
- lib/modules/video/application/video-search.service.ts
- lib/modules/video/domain/video-asset-selection.ts
- lib/modules/video/domain/video.dto.ts
- lib/modules/video/domain/video.policy.ts
- lib/modules/video/infrastructure/video-content.service.ts
- lib/modules/video/infrastructure/video.repository.ts
- scripts/diagnose-home-content.ts

### `isApproved`
- lib/launch/content-diagnostics.ts
- lib/modules/access/application/check-video-access.use-case.ts
- lib/modules/channel/application/channel-lifecycle.use-cases.ts
- lib/modules/channel/application/channel-moderation.use-cases.ts
- lib/modules/channel/application/content-report.use-case.ts
- lib/modules/channel/application/main-channel.service.ts
- lib/modules/channel/domain/channel.policy.ts
- lib/modules/channel/infrastructure/creator-content.service.ts
- lib/modules/health/application/check-health.use-case.ts
- lib/modules/video/application/video-search.service.ts
- lib/modules/video/infrastructure/video-content.service.ts
- lib/modules/video/infrastructure/video.repository.ts
- scripts/diagnose-home-content.ts

### `MAIN_CREATOR_SLUG`
- apps/admin/app/(panel)/ustawienia/page.tsx
- lib/constants.ts
- lib/data/initial-content.ts
- lib/env/validation.ts
- lib/feature-flags.ts
- lib/launch/content-diagnostics.ts

## Czego NIE ruszać w tym etapie
- `Creator.slug` (stabilny adres `/channel/<slug>`), `Creator.userId` (konto właściciela, odpowiedzi „jako twórca”).
- Dane sprzedaży (`Order`, `LedgerEntry`): księgi są tylko do dopisywania.

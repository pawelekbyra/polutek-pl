# POST-929 Emergency Control-Plane Reconciliation

Status: READY_FOR_INDEPENDENT_REVIEW
Public launch: NO_GO
Date: 2026-06-17
Scope: documentation-only reconciliation after PRs #922-#929.

## Verified baseline

- Actual branch: `work`.
- Actual HEAD: `6162ed6b79d412856c02c4cb5c610f4f9f81b152`.
- Baseline verification method: Git ancestry and direct HEAD verification; expected PR #929 merge commit is HEAD and an ancestor of HEAD.
- Main advanced after PR #929: not in this workspace; no later commits are present after `6162ed6b79d412856c02c4cb5c610f4f9f81b152`.
- Working tree before editing: clean.
- Runtime/schema/workflows/tests/packages changed by this PR: none.

## PR / merge chronology

| PR | Merge SHA | Current-state classification |
| --- | --- | --- |
| #922 | `366390f310b22a0ee3bbf91231d2063505b88812` | Auth actor canonicalization implementation merged. |
| #923 | `f60b4b7a4815c63af960228161e62e7210bd2f1d` | Auth post-merge verification was useful but incomplete for current main. |
| #926 | `2a3a055e6de9155d99accaff15be54e7807b26c5` | Cloudflare-first admin video flow partially merged; provider runtime not verified. |
| #928 | `5e37e2de065e0d2b242a4cd415e54cb4f5301f95` | Admin channel UNAUTHORIZED classification added; root cause not verified. |
| #929 | `6162ed6b79d412856c02c4cb5c610f4f9f81b152` | Legacy AccessPolicy configured-admin bypass repaired; makes #923 PASS incomplete as full current-main certification. |

## Evidence taxonomy

- `REPOSITORY_EVIDENCE`: code/docs present in this workspace.
- `AUTOMATED_TEST_EVIDENCE`: test/guard output, when actually run.
- `MERGED_PR_EVIDENCE`: merge commit exists in current history.
- `AGENT_DECLARATION`: PR descriptions or agent reports; never sufficient alone.
- `PRODUCTION_RUNTIME_EVIDENCE`: production logs/behavior; not inspected here.
- `OPERATOR_EVIDENCE`: redacted provider/dashboard evidence; not inspected here.
- `UNKNOWN`: repository cannot prove the state.

## Implementation truth versus PR declarations

Merged code is implementation evidence only. It is not production certification and not a substitute for full GitHub CI. PR declarations that Cloudflare upload, signed provider privacy, admin channel root cause, or full auth certification are complete remain unproven unless backed by repository, CI, runtime, or operator evidence.

## Current-state classifications

### ADMIN-AUTH-ACTOR-CANONICALIZATION-001

Classification: `IMPLEMENTATION_MERGED / PREVIOUS_POSTMERGE_PASS_INCOMPLETE / REVERIFICATION_REQUIRED / HISTORICAL_IMPLEMENTATION_EVIDENCE`.

PR #923 verified the modular access path, but PR #929 later repaired an omitted legacy AccessPolicy playback path. Therefore the original PASS is not complete current-main certification. Future ticket: `ADMIN-AUTH-POSTMERGE-REVERIFY-001`.

### ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001

Classification: `PARTIAL_IMPLEMENTATION_MERGED_IN_PR_926 / PROVIDER_RUNTIME_NOT_VERIFIED / CORRECTIVE_WORK_REQUIRED / POSTMERGE_VERIFICATION_MISSING / HISTORICAL_UMBRELLA_SPEC`.

The precise original requirements remain historical umbrella specification evidence; they must not be deleted or weakened. Corrective work is split into bounded future tickets after CI signal restoration.

### ADMIN-CHANNEL-001

Classification: `SYMPTOM_PARTIALLY_HANDLED / ROOT_CAUSE_NOT_VERIFIED / TYPE_SAFETY_INCOMPLETE / PRODUCTION_DB_AND_LOG_EVIDENCE_MISSING`.

PRs #924, #925 and #927 were closed/unmerged attempts. PR #928 added UNAUTHORIZED classification but did not establish the production root cause. Current page still contains broad any casts, and current classifier does not distinguish DB schema/connection failures. Do not resurrect or merge old PR branches.

## Full risk register

| ID | Priority | Classification | Current truth / required handling |
| --- | --- | --- | --- |
| CI-001 | P0 | CONFIRMED | Last reviewed PR CI failed. |
| CI-002 | P0 | CONFIRMED | strict-escapes failure skips hotspots, typecheck, coverage, lint and build. |
| CI-003 | P0 | CONFIRMED | strict-escapes scans the entire production tree with no historical baseline or no-new-debt mode. |
| CI-004 | P0 | CONFIRMED | quality:architecture-boundaries exists but CI does not run it. |
| CI-005 | P0 | CONFIRMED | scripts/check-control-plane-docs.mjs exists but CI does not run it. |
| CI-006 | P0 | UNRESOLVED | npm audit high fails and security remediation is unresolved. |
| CI-007 | P0 | UNPROVEN | Merges occurred despite failed PR checks; branch protection enforcement is not proven. |
| CI-008 | P1 | EVIDENCE_BOUNDARY | Vercel READY is deployment evidence, not substitute evidence for full GitHub CI. |
| VIDEO-CF-001 | P0 | INFERRED_FROM_REPOSITORY | Cloudflare basic direct upload URL is passed to tus-js-client as a TUS creation endpoint; provider contract is not proven and appears mismatched. |
| VIDEO-CF-002 | P0 | CONFIRMED_GAP | Resume is not implemented; retry provisions another provider upload. |
| VIDEO-CF-003 | P0 | CONFIRMED_GAP | VideoAsset is one-to-one by video and upsert overwrites providerAssetId, risking orphan provider UIDs and late webhooks. |
| VIDEO-CF-004 | P0 | CONFIRMED_GAP | old Generate Upload URL, manual Attach UID, legacy import and new upload component coexist and bypass one another’s policies. |
| VIDEO-CF-005 | P1 | CONFIRMED_GAP | manual attach route reads request JSON twice. |
| VIDEO-CF-006 | P0 | CONFIRMED_GAP | manual attach can default an unverified UID to READY and primary. |
| VIDEO-CF-007 | P0 | CONFIRMED_GAP | legacy import creates a PENDING asset with isPrimary=true. |
| VIDEO-CF-008 | P1 | CONFIRMED_GAP | UI polling reads local DB state and does not perform provider sync. |
| VIDEO-CF-009 | P0 | CONFIRMED_GAP | providerPlaybackId is not reliably populated by webhook/status handling. |
| VIDEO-CF-010 | P0 | OPERATOR_EVIDENCE_REQUIRED | requireSignedURLs is claimed in docs but is not enforced or verified by repository code; production provider state is UNKNOWN. |
| VIDEO-CF-011 | P1 | CONFIRMED_GAP | UI advertises files up to 10 GB while VideoAsset.sizeBytes is Prisma Int. |
| VIDEO-CF-012 | P0 | CONFIRMED_GAP | upload metadata and file size/type inputs lack a strict server schema. |
| VIDEO-PUBLISH-001 | P0 | CONFIRMED_GAP | publication gate omits required thumbnail/source diagnostics and resets publishedAt on repeated publication. |
| VIDEO-HERO-001 | P0 | CONFIRMED_GAP | set-hero validates a PUBLISHED input, generic update removes the status, and a draft can remain draft while becoming Hero. |
| VIDEO-STATE-001 | P1 | CONFIRMED_GAP | archive/unpublish leave stale Hero/sidebar/publishedAt state without documented transition policy. |
| VIDEO-ADMIN-001 | P0 | CONFIRMED_GAP | create/update endpoints accept broad raw JSON without a strict allowlist. |
| VIDEO-ADMIN-002 | P1 | CONFIRMED_GAP | create form defaults to PUBLISHED/showInSidebar=true while persistence silently forces DRAFT/showInSidebar=false. |
| VIDEO-ADMIN-003 | P1 | CONFIRMED_GAP | legacy videoUrl remains required and reported as error in UI despite Cloudflare-first nullable videoUrl. |
| VIDEO-ADMIN-004 | P1 | CONFIRMED_GAP | sourceKind and needsAttention controls are visible but not enforced. |
| VIDEO-ADMIN-005 | P2 | CONFIRMED_GAP | MISSING_SOURCE filtering handles empty string but not null. |
| VIDEO-PLAYBACK-001 | P0 | CONFIRMED_GAP | new /api/media-source supports Cloudflare while legacy /api/media still expects videoUrl; contracts are not reconciled. |
| VIDEO-PLAYBACK-002 | P1 | CONFIRMED_GAP | Cloudflare token-resolution failure can return READY with canPlay=false. |
| VIDEO-VERIFY-001 | P0 | EVIDENCE_GAP | Tests mock provider responses and do not prove real TUS, resume, duplicate attempts, privacy config, attach route behavior or E2E flow. |
| ADMIN-CHANNEL-001 | P1 | SYMPTOM_PARTIALLY_HANDLED | ROOT_CAUSE_NOT_VERIFIED; TYPE_SAFETY_INCOMPLETE; PRODUCTION_DB_AND_LOG_EVIDENCE_MISSING. |
| CONTROL-001 | P0 | CONFIRMED_STALE_DOC | current queue still points to auth work already merged. |
| CONTROL-002 | P0 | CONFIRMED_STALE_DOC | video ticket still describes merged work as future/non-executable. |
| CONTROL-003 | P0 | CONFIRMED_STALE_DOC | root README points to POST-910 despite later PRs. |
| CONTROL-004 | P0 | CONFIRMED_STALE_DOC | Masterplan risk register and ordered work omit PR #922-#929 findings. |
| CONTROL-005 | P1 | GUARD_GAP | check-control-plane-docs validates formatting/current-pointer shape but not chronology against merged PR evidence. |
| CONTROL-006 | P1 | EVIDENCE_BOUNDARY | historical “current main” reports are point-in-time evidence and must not be used as current status. |
| CONTROL-007 | P1 | PRODUCT_SCOPE_CONFLICT | private-beta route guard conflicts with owner-approved public-launch and Cloudflare-upload direction. |
| CONTROL-008 | P0 | PROCESS_GAP | PR descriptions and automated-agent declarations were accepted as stronger evidence than full CI/provider/runtime evidence. |


## Known / inferred / unknown

### Known

- PRs #922, #923, #926, #928 and #929 are present in current history through HEAD `6162ed6b79d412856c02c4cb5c610f4f9f81b152`.
- The previous current queue was stale and pointed to already-merged auth work.
- Public launch remains NO_GO.

### Inferred

- The Cloudflare basic-upload/TUS mismatch appears likely from repository structure, but provider protocol behavior is not proven in production.
- Existing CI topology creates blind spots when early jobs fail.

### Unknown

- Production DB state, Cloudflare provider asset privacy, actual signed URL enforcement, real upload behavior, and admin channel production root cause were not inspected.

## Operator-evidence requirements

- Cloudflare dashboard evidence for `requireSignedURLs` and existing asset privacy.
- Production-safe admin channel logs and DB/schema evidence.
- Full provider E2E upload/webhook/playback evidence after runtime fixes.
- Vercel READY may be recorded as deployment evidence only, not test evidence.

## Ordered repair program

1. `CI-SIGNAL-RESTORATION-001`
2. `SECURITY-DEPENDENCY-REMEDIATION-001`
3. `ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001`
4. `CLOUDFLARE-PRODUCTION-ASSET-PRIVACY-VERIFY-001`
5. `ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001`
6. `ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001`
7. `ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001`
8. `ADMIN-VIDEO-POSTMERGE-VERIFY-001`
9. `ADMIN-AUTH-POSTMERGE-REVERIFY-001`
10. `LEGACY-ACCESS-POLICY-RETIREMENT-001`
11. `ADMIN-CHANNEL-ROOT-CAUSE-001`
12. `LEGACY-MEDIA-PROXY-RETIREMENT-001`
13. `CONTROL-PLANE-GUARD-HARDENING-001`
14. `BETA-SCOPE-GUARD-RECONCILIATION-001`

Cloudflare provider privacy verification may proceed as operator evidence collection, but must not be marked PASS without inspecting the actual provider configuration.

## Explicit non-claims

This reconciliation does not claim auth is fully verified, Cloudflare upload works in production, TUS resume is implemented, assets require signed URLs, admin channel root cause is known, full CI passed, Vercel READY means tests passed, public launch is ready, or production DB/provider state was inspected.

## Merge recommendation

No runtime merge recommendation. Documentation status only: READY_FOR_INDEPENDENT_REVIEW. Public launch remains NO_GO.

# X6-EX-001 UI Consistency Inventory

Status: `READY FOR REVIEW`
Ticket: `docs/tickets/ready/X6-EX-001-ui-consistency-inventory.md`
Date: 2026-06-12
Type: docs/inventory only
Scope: read-only evidence from `app/**` and `components/**`; no runtime, CSS, copy, layout, test, schema, package, provider, or config changes.

## Summary

This report inventories launch-critical user and admin UI surfaces for consistency risks that could affect payment/access clarity, denied-video player mounting, paid-but-locked support, dangerous admin actions, mobile completion of critical actions, and confusion between patronage and mailing subscription.

No X6 or public-launch readiness is certified by this report. `Target architecture != current implementation`; route/component evidence below reflects only the current implementation observed in the codebase.

## Shared classification

- `IMPLEMENTED_VERIFIED` — route/component exists and the relevant state handling is visible in the inspected implementation.
- `IMPLEMENTED_UNVERIFIED` — route/component exists, but runtime/manual behavior was not exercised in this docs-only pass.
- `PARTIAL` — route/component exists, but a launch-relevant UI state, explanation, or guard is inconsistent or incomplete.
- `MISSING` — required visible surface/state was not found in inspected route/component evidence.
- `OWNER_DECISION_REQUIRED` — the product choice, tone, or operational policy requires owner confirmation before implementation.
- `BLOCKED` — inventory cannot safely classify without unavailable evidence or active-PR dependency.
- `DEFERRED_POST_LAUNCH` — useful, but not launch-blocking for the stated invariants.
- `NOT_APPLICABLE` — surface/state does not apply to the current implementation.

## Evidence matrix

| Surface | Route/component evidence | States covered | Empty/loading/error/locked states | Mobile risk | Accessibility risk | Copy/trust risk | Status | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home/video listing | `app/page.tsx` returns a home error/empty shell before `ChannelHome`; `ChannelHome` chooses the selected/main video, renders mobile comments/videos tabs, desktop sidebar, and empty search copy. Evidence: `app/page.tsx:110-177`, `app/components/ChannelHome.tsx:69-73`, `app/components/ChannelHome.tsx:119-145`, `app/components/ChannelHome.tsx:153-166`. | Main video, selected video, sidebar/list, search query, comments/videos tab on mobile. | Empty/error home states exist; selected-video missing state exists; search empty exists. Loading is mostly via global route/skeleton rather than explicit in `ChannelHome`. Locked state delegated to player/paywall surface. | Medium: mobile requires switching between comments and videos tabs; critical action remains reachable, but comments/list context can be hidden behind the active tab. | Low/medium: tab buttons are native buttons but lack explicit ARIA tab semantics. | Medium: search empty copy uses stylized wording (`Brak zeznań...`) that may be unclear for support/debug contexts. | `IMPLEMENTED_UNVERIFIED` | X6 next pass should review mobile tab semantics and search-empty wording after higher-risk access/admin issues. |
| Video detail/player/paywall | `Hero` mounts `PremiumWrapper` around `VideoPlayer`; `PremiumWrapper` blocks anonymous non-public videos before fetching media, stores playback plan only when API says `hasAccess`, returns `PaywallOverlay` when denied, and renders children only after a playback plan exists. `VideoPlayer` renders error overlays for missing plan/URL/unsupported/load errors and sends playback events from mounted player callbacks. Evidence: `app/components/Hero.tsx:194-203`, `app/components/PremiumWrapper.tsx:67-100`, `app/components/PremiumWrapper.tsx:144-195`, `app/components/VideoPlayer.tsx:112-152`, `app/components/VideoPlayer.tsx:154-223`. | READY-like player, anonymous login-required, patron-required paywall, source/API error, no playback plan, no URL, unsupported source, load failure. | Loading skeleton exists; denied state is locked placeholder; multiple player error states exist; no explicit user-facing differentiation between `PROCESSING`, `NO_PRIMARY_ASSET`, `VIDEO_NOT_READY`, and generic source/plan errors in this UI layer. | Medium: paywall overlay uses container query text sizing and a `#donations` anchor; a separate pass should verify the donation entry remains discoverable on small screens. | Medium: paywall lock action is partly an icon-only/custom clickable wrapper and may need keyboard/name review. | Medium: paywall copy should keep one-time patron reward wording distinct from subscription. | `PARTIAL` | X6 next pass: map backend playback-plan denial codes to consistent UI labels without changing player behavior. |
| Comments and reports | `EmbeddedComments` computes comment permission from viewer/API and video tier, passes locked/commenting state to `CommentComposer`, and renders loading/error/empty states. `CommentComposer` gates sign-in vs patron-only commenting. `CommentItem` exposes report actions only when viewer can report and shows moderation actions for allowed users; `ReportDialog` captures reason and optional note. Evidence: `app/components/comments/EmbeddedComments.tsx:105-108`, `app/components/comments/EmbeddedComments.tsx:267-284`, `app/components/comments/EmbeddedComments.tsx:286-326`, `app/components/comments/components/CommentComposer.tsx:117-151`, `app/components/comments/components/ReportDialog.tsx:39-85`, `app/components/comments/components/CommentItem.tsx:238-270`. | Read comments, loading, API error with retry, empty, sign-in required, patron-required comment lock, report dialog, inline admin/moderator actions. | Loading/error/empty/comment-locked states are present. Report submission has dialog states; report mutation failures are not visibly inventoried here. | Medium: sticky comment header is fixed and centered; report/moderation menus require small tap targets in dense lists. | Medium: several icon/menu controls need accessible-label review; modal uses shared dialog primitives but report reason select needs manual keyboard verification. | Medium: patron-only comment lock says become patron; should remain distinct from newsletter subscription. | `IMPLEMENTED_UNVERIFIED` | X6 next pass: verify report and reaction failures show actionable feedback on mobile. |
| Donation/support checkout entry | `SupportBox` presents one-time voluntary tip/patron reward copy, min amount, currency selector, terms checkbox, terms error, disabled support button below minimum, and loading skeleton. `CheckoutModal` presents mobile/desktop checkout shells, Stripe loading, success/sync messaging. `CheckoutForm` shows Stripe payment element, submit loading, and Stripe error message. Evidence: `app/components/playlist/SupportBox.tsx:54-68`, `app/components/playlist/SupportBox.tsx:79-132`, `app/components/playlist/SupportBox.tsx:134-160`, `app/components/playlist/CheckoutModal.tsx:123-183`, `app/components/playlist/CheckoutModal.tsx:190-210`, `app/components/CheckoutForm.tsx:39-93`. | Support amount/currency, below-min disabled, terms required, checkout loading, payment processing, payment error, success, profile sync. | Loading/disabled/error/success states exist; no explicit paid-but-webhook-delayed support path beyond success copy and sync label. | Medium: full-screen modal is mobile-aware, but PaymentElement plus terms/return controls need manual small-screen verification. | Medium: currency select has label; amount input lacks visible `htmlFor` binding; Stripe element accessibility depends on Stripe. | Low/medium: generally good one-time tip wording; success copy correctly says Stripe webhook confirmation is needed. | `IMPLEMENTED_UNVERIFIED` | X6 next pass: add inventory of post-payment delayed-access support messaging and owner-approved support contact path. |
| Account/patron status surfaces | Public user profile status is derived in home from DB user fields and passed down; admin user detail displays grant-truth patron status, cache mismatch badge, grant list, payments, subscriptions, and audit log. Evidence: `app/page.tsx:96-108`, `app/admin/users/[userId]/page.tsx:59-90`, `app/admin/users/[userId]/page.tsx:262-285`, `app/admin/users/[userId]/page.tsx:314-335`. | Public patron boolean in page profile; admin grant truth; cache mismatch; active/revoked grants; payments/subscriptions/audit tabs. | Admin detail loading/error exist; grants/subscriptions/audit empty states exist. Public self-service paid-but-locked diagnostics surface was not found in inspected user-facing routes. | Medium: admin detail is two-column with tabs; paid-but-locked triage is likely desktop-admin-oriented and may be cramped on mobile. | Medium: tab keyboard semantics depend on UI primitive; code/ID strings may overflow. | High: public home still passes `userDb?.isPatron`; admin detail correctly names grant truth, but public account status may still look cache-derived to users. | `PARTIAL` | Include in follow-up ticket: admin access-impact actions and paid-but-locked diagnostic clarity should be reviewed together. |
| Newsletter/subscription/unsubscribe surfaces | `SubscribeButton` fetches subscription status, toggles POST/DELETE, shows a confirmation modal before subscribing, and language strings define subscription as email notification consent. API exposes GET/POST/DELETE for signed-in users. Evidence: `app/components/SubscribeButton.tsx:50-63`, `app/components/SubscribeButton.tsx:69-106`, `app/components/SubscribeButton.tsx:126-147`, `app/api/subscriptions/route.ts:59-114`, `app/components/LanguageContext.tsx:139-140`. | Signed-out prompts sign-in; subscribe confirmation; optimistic subscribe/unsubscribe; pending state. | Loading is button pending/opacity; no dedicated error message on failed toggle, only silent rollback; no public token-based unsubscribe UI found in `app/**`. | Medium: confirmation modal is centered and simple; signed-in unsubscribe is one click from subscribed button. | Medium: modal buttons are native; focus trapping depends on custom fixed overlay, not shared dialog primitive. | Medium/high: UI uses “Subskrajb/Subskrypcja” wording; confirmation clarifies email notifications but can still be confused with patronage unless consistently paired with mailing consent copy. | `PARTIAL` | Owner question: should launch include a visible email-link unsubscribe landing page, or is signed-in unsubscribe plus email-provider link sufficient for X6? |
| Admin payments/patrons/access diagnostics | Admin users list supports filters for patron, source, payments, subscriptions, deleted users, and CSV export. Admin payments list supports payment filters/status/date/refund summary. Admin user detail shows grant truth/cache mismatch and audit. `UserPatronActions` uses prompt-based grant/revoke reason and single-click action buttons. Payment settings copy says successful payment automatically grants patron status. Evidence: `app/admin/users/page.tsx:136-149`, `app/admin/users/page.tsx:152-203`, `app/admin/users/payments/page.tsx:83-106`, `app/admin/users/payments/page.tsx:109-180`, `app/admin/users/payments/page.tsx:223-284`, `app/admin/users/[userId]/page.tsx:59-90`, `app/admin/users/UserPatronActions.tsx:20-60`, `app/admin/payments/PaymentSettingsForm.tsx:54-65`. | Admin search/filter/list, payments loading/error/empty, refund summaries, grant truth/cache mismatch, manual grant/revoke, payment-threshold settings. | Loading/error/empty states exist for users/payments; user detail has skeleton/error. Access diagnostics exist as grant/cache/mismatch, but no dedicated paid-but-locked support workflow was found. Dangerous grant/revoke uses prompt and no explicit confirmation screen. | High: tables are horizontally dense; filters wrap, but admin paid-but-locked triage on mobile may be hard. | High: `prompt()` reason entry and icon/table controls need accessible confirmation/reason flow; dangerous revoke is unclear. | High: payment-settings copy risks compressing Payment -> PatronGrant policy into “successful payment automatically grants patron status”; admin needs clearer support/access language. | `PARTIAL` | **Launch-critical follow-up created/recommended:** `X6-FU-001-admin-access-actions-confirmation` for admin access-impact confirmation/reason/diagnostics clarity. |
| Admin video Cloudflare upload/import/status | Admin video list shows provider/source, migration status, missing/processing/failed badges, diagnostics count, empty state, and actions. Video detail has Cloudflare primary tab with attach UID, generate upload URL, import legacy-to-Cloudflare, asset state, failure reason, processing timestamps, and no-asset empty state. Evidence: `app/admin/videos/components/VideoTable.tsx:90-139`, `app/admin/videos/[id]/page.tsx:130-190`, `app/admin/videos/[id]/page.tsx:190-219`, `app/admin/videos/[id]/page.tsx:223-239`. | List status, migration status, diagnostics count, attach UID, create upload URL, import legacy, processing state, failure reason, no primary asset. | Loading/empty/list states exist; asset failure/no-asset states exist. Import/upload are toast-based and not visibly confirmed beyond toast. | Medium/high: Cloudflare action buttons are multiple inline controls; import/upload URL flow may overflow on narrow screens. | Medium: prompt-based UID attach and window-open upload URL need keyboard/screen-reader review. | Medium: “Legacy / Migration INTERNAL ONLY” copy helps; upload/import success depends on transient toast. | `IMPLEMENTED_UNVERIFIED` | X6 next pass: review Cloudflare operations on mobile and replace transient-only operation feedback with persistent status where needed. |
| Admin comments moderation | Admin comments page lists comments, status, loading skeletons, empty state, and hide/restore/delete actions. Reports page lists active reports, loading skeletons, empty state, report reason/note/status, video link, dismiss and hide-and-close actions. Evidence: `app/admin/comments/page.tsx:44-56`, `app/admin/comments/page.tsx:96-128`, `app/admin/comments/reports/page.tsx:39-63`, `app/admin/comments/reports/page.tsx:80-115`, `app/admin/comments/reports/page.tsx:117-190`. | List/search, loading, empty, hide/restore/delete, report dismiss, hide-and-close. | Loading/empty states exist. Error state is minimal/toast-only or console/log; dangerous delete/hide actions do not show reason/confirmation in these UI components. | High: dense tables and small icon buttons may make critical moderation actions error-prone on mobile. | High: icon-only moderation buttons lack visible labels; confirmation/reason flow is absent in UI. | High: actions like delete/hide are terse and English toast text on Polish admin page can reduce trust. | `PARTIAL` | Include in X6 next pass or same access-action pattern after owner prioritization; this is high-risk but less directly access-critical than patron revoke. |
| Health/support/incident surfaces where visible | API health endpoint exists but no user-visible health/support/incident page was found. Global app error and not-found pages provide retry/home actions and digest when present. Admin dashboard lists product sections, but no support/incident section. Evidence: `app/api/health/route.ts:10-24`, `app/error.tsx:12-49`, `app/not-found.tsx:5-24`, `app/admin/page.tsx:41-83`. | API health check; generic runtime error; 404; admin navigation. | Error and 404 states exist. No visible incident/support status surface or paid-but-locked support entry found. | Low/medium: error pages are simple and mobile-friendly. | Low: buttons/links are straightforward; digest text can be copied visually but no copy button. | Medium: “team notified” may overpromise unless monitoring is verified; no support route for payment/access disputes. | `PARTIAL` | Owner decision: whether launch requires a visible support/incident/contact surface for paid-but-locked cases. |

## Launch-critical findings

### LC-1 — Admin access-impact actions lack a clear confirmation workflow

Manual patron grant/revoke directly affects paid access. The current UI asks for a reason with `prompt()` and immediately PATCHes when the prompt returns, while the visible buttons are terse (`Nadaj Patrona`, `Cofnij Patrona`). Evidence: `app/admin/users/UserPatronActions.tsx:20-60`.

Why this is launch-critical:

- A mistaken revoke can lock a paying patron out of premium content.
- The action affects the domain invariant that access truth is an active `PatronGrant`.
- The UI does not present a structured dangerous-action confirmation, a summary of access impact, or a persistent paid-but-locked diagnostic checklist before changing access.
- The prompt can collect a reason, but it is not a clear, accessible, reviewable confirmation surface for a dangerous admin action.

Follow-up ticket created/recommended: `docs/tickets/ready/X6-FU-001-admin-access-actions-confirmation.md`.

## Should-have findings

1. **Playback denial/error labels are not fully mapped to target playback-plan states.** Generic source/plan errors exist, but the visible player/paywall layer does not consistently expose `PROCESSING`, `NO_PRIMARY_ASSET`, `VIDEO_NOT_READY`, or `UNAVAILABLE` as distinct user/admin support states.
2. **Newsletter subscription copy needs another trust pass.** Confirmation copy identifies email notifications, but the product uses “subscription/subskrypcja” language that should be consistently separated from patron access.
3. **Post-payment delayed-access support is thin.** Checkout success mentions webhook confirmation, but there is no obvious user-facing support/diagnostic route for “I paid but I am locked.”
4. **Admin comments moderation has high-risk dense controls.** Hide/restore/delete/report resolution are implemented, but confirmation/reason clarity and accessibility should be reviewed.
5. **Cloudflare upload/import operation feedback is transient.** Upload/import/attach flows rely heavily on toasts, prompts, and `window.open`; persistent status is available after refresh but should be clearer during operations.

## Deferred post-launch

1. Refine stylized empty/search copy on home/channel lists for clarity.
2. Add copy buttons for digest/error IDs and internal IDs where useful for support.
3. Improve table density and optional card views for admin lists on mobile after core launch-critical access actions are safe.

## Owner decision required

1. Should launch include a visible support/contact/incident surface specifically for paid-but-locked cases?
2. Is a tokenized email unsubscribe landing page required for launch, or is signed-in unsubscribe plus email-provider unsubscribe link sufficient?
3. Should admin payment-settings copy say “qualifying payment creates a PatronGrant after policy/webhook verification” instead of “successful payment automatically grants patron status”?
4. What exact Polish/English wording should replace “subscription/subskrypcja” where the intent is mailing consent only?

## Changed files

- `docs/reports/reconciliation/X6-EX-001-UI-CONSISTENCY-INVENTORY.md`
- `docs/tickets/ready/X6-FU-001-admin-access-actions-confirmation.md` (created because LC-1 was found)

## Docs-only confirmation

Confirmed: this ticket changed documentation/inventory files only. It did not change `app/**`, `components/**`, `lib/**`, tests, Prisma, scripts, public assets, package/build/config/provider/generated/workflow files, CSS, UI components, copy, layouts, routes, schema, or runtime behavior.

## Validation results

Validation requested by ticket only:

```bash
git diff --check
git status --short
git diff --name-only
rg -n "TODO|FIXME|placeholder|coming soon|lorem|test only" docs app components
```

Results are recorded in the PR report/final response after command execution.

## Next step

Review and merge this docs-only inventory, then schedule `X6-FU-001-admin-access-actions-confirmation` before any public-launch certification claim. If owner decides LC-1 is not launch-critical, run the next X6 pass on player denial labels, post-payment support messaging, and newsletter consent wording.

## Verdict

`MERGE`

# Auth flows behaviour audit (Better Auth), 2026-10-02

Scope: the Better Auth login merged 2026-10-02 (`lib/auth/*`, `app/api/auth`, `app/api/user/*`, `middleware.ts`,
`app/components/auth/*`, `app/components/subscriptions/*`, `/sso-callback`, `/reset-password`, e-mail module).
Method: code reading (including the installed `better-auth` 1.7.7 sources where behaviour is library-defined),
read-only `curl` against https://www.pawelperfect.com (no account created, no secrets printed, Turnstile not passed),
existing unit tests run, new unit tests added. **The audit itself changed no application code**; the fixes
followed in the PR "fix(auth): audit findings" (Status column below, 2026-10-02).

Severity: blocker (cannot use the product), high (a normal user hits it or it is a security hole), medium, low.
There are no blockers. Finding ids (F-xx) are referenced by `tests/unit/auth/auth-flows-audit.test.tsx` and
`tests/unit/auth/auth-provider-link-errors.test.tsx` (they were `it.fails` markers; every finding fixed or decided in the follow-up PR now has a plain `it`).

## 1. Findings by severity

| Id | Sev | Status | Finding | Proven by | Suggested fix |
|---|---|---|---|---|---|
| F-01 | high | fixed | `?next=` / return path is dead. The proxy sends `/admin` (and any gated page) to `/?signin=1&next=...`; the provider stores `next`, tidies the URL, but e-mail sign-in only closes the modal and refreshes (stays on `/`), and Google sign-in calls `rememberReturnPath(returnTo())` with the already-tidied URL (`/`), overwriting `next`. Live: `GET /admin` -> `307 /?signin=1&next=%2Fadmin`. | 2 x `it.fails` | In `AuthModal.finishSignedIn()` navigate to `readReturnPath()` (sanitised, already open-redirect safe); in `handleOAuth` do not overwrite an existing stored path (or store only when none). |
| F-02 | high | fixed (#1595: failure/retry message) | Turnstile failure is silent and fatal. If `api.js` is blocked (ad/tracker blockers, corporate DNS, offline) or `error-callback` fires, the token stays `null` and every form button is disabled forever (`waitingForCaptcha`), with no message, retry or fallback. Sign-in, sign-up, forgot password and resend all depend on it; only Google keeps working. | code only | Surface an inline "bot check could not load, retry / disable blockers" state with a retry button after ~8 s; keep Google as the visible alternative. |
| F-03 | high | fixed | Expired/invalid verification link is silent. Better Auth redirects to `<callbackURL>?error=TOKEN_EXPIRED` (expired) or `INVALID_TOKEN`; callbackURL is the page the sign-up started on (`/`, `/pl`, `/watch/...`) and nothing there reads `error`. Live: `verify-email?token=bogus&callbackURL=/pl` -> `302 /pl?error=INVALID_TOKEN`. A successful click also shows no "e-mail confirmed" message. A used link just redirects without a session. The original tab stays on "Check your inbox" (modal never closes when the session appears via the other tab). | `it.fails` (provider), error-map `it.fails` | Read `error` in `AuthModalProvider` (open modal on a "link expired, resend" view); show a success toast after verification (`?verified=1` via callbackURL); close the modal when `useAuth().isSignedIn` flips. |
| F-04 | high | fixed (decided: link onto unverified row + prune cron) | Google sign-in cannot claim an address that has an unverified password sign-up. Better Auth 1.7.7 defaults `accountLinking.requireLocalEmailVerified` to true, so linking is refused (`account not linked`) and `/sso-callback` shows the generic "Signing in with Google failed" for ever. The pre-hijack guard `beforeAccountCreate` is therefore unreachable (it only runs when linking is allowed). Unverified rows are never cleaned up, so anyone can squat an address (denying its owner Google sign-in; the owner can still use forgot-password) and a nickname. | code + library source | Set `account.accountLinking.requireLocalEmailVerified: false` (the guard then drops the squatter's password and sessions, which is its purpose) or delete unverified rows older than N days in a cron. Add a specific message for `account_not_linked`. |
| F-05 | medium | decided (freshAge kept; "sign in again" prompt) | `freshAge` is 1 day while sessions live 30 days. `list-sessions` and `unlink-account` use Better Auth's fresh-session middleware, so after day 1 the "Signed-in devices" list is silently empty (the UI ignores the error) and "Disconnect Google" fails with the generic text. `SESSION_NOT_FRESH` has no message in `errors.ts`. | 3 x `it.fails` | `freshAge: 0` (disables the check; sensitive endpoints already read the DB session) or re-auth prompt; map `SESSION_NOT_FRESH`; show list errors. |
| F-06 | medium | fixed | Per-e-mail lockout (`SIGN_IN_EMAIL_LIMIT` 10 / 15 min) counts every attempt, including successful ones and ones with a solved captcha from anyone: an attacker can lock a known address out for 15 min with 11 requests, and a user who signs in on many devices is throttled. Per-IP rule is 5/min on `/sign-in/email` (verified live: 6th request -> 429), which is tight for NAT/campus networks. | design (counter in `authBeforeHook`) | Count failures only (increment in the after hook on `INVALID_EMAIL_OR_PASSWORD`), key on e-mail + IP bucket, return the same 429 text. |
| F-07 | medium | decided (opt-in trust 7 d; Google/One Tap bypass accepted) | 2FA is bypassed by Google and One Tap (Better Auth's two-factor hooks only match `/sign-in/email|username|phone-number`), and `verifyTotp` is called with `trustDevice: true` hard-coded, giving a 30-day cookie that skips 2FA without asking. | `it.fails` (trustDevice) + library source | Document the Google bypass or require the TOTP step after social sign-in for accounts with `twoFactorEnabled`; make "trust this device" an unticked checkbox. |
| F-08 | medium | fixed | Backup codes are shown once at setup (plain text, no copy/download) and there is no way to view or regenerate them later (`generateBackupCodes` is not used). A lost device with used/lost codes means a database edit. Google-only users cannot enable 2FA at all. | code only | Add "Regenerate backup codes" (password required) and copy/download buttons. |
| F-09 | medium | fixed (hint + nickname onboarding; one-time mail still open) | Clerk-era users have no credential account. Typing e-mail + password gives "Incorrect e-mail or password" with no hint to use Google or "Forgot password" (the migration marked every old row `emailVerified = true`, so both routes work). Old rows may also have a null/duplicate/rule-breaking `name` and are never asked for a nickname (`onboardingPending` is false). | code + migration | One-time e-mail to existing users ("sign in with Google or set a password"); add a hint line under the sign-in error; optionally set `onboardingPending` for rows whose name fails `validateNickname`. |
| F-10 | medium | fixed (CSP host unverified in a real browser) | One Tap is requested for every signed-out visitor on every page load (all guests who only watch free videos), with a new `createAuthClient` per effect run; it can overlap the home entry gate. CSP `style-src(-elem)` lacks `https://accounts.google.com/gsi/style` (Google documents it as required for GSI; unverified in a browser). | code + live CSP | Only prompt after an intent signal (e.g. opening the sign-in modal, or once per session via sessionStorage); add the gsi style host to the CSP and test in Chrome. |
| F-11 | medium | open | Nickname uniqueness is only an application check (no DB unique index, as documented): two parallel sign-ups can take the same nickname; unverified rows hold nicknames. Also `onboardingPending` is enforced only by the client dialog: a Google user can call APIs (e.g. post a comment) under the provider placeholder name without finishing onboarding. | code | Unique index on `lower(name)` for non-deleted rows after de-duplicating legacy rows; reject nickname-bearing writes while `onboardingPending` (comments). |
| F-12 | medium | fixed | `DELETE /api/user/account` needs only a valid session (no re-authentication, no fresh session) plus typing DELETE; a hijacked session can erase the account, and an ADMIN can delete the last admin. (Known and documented; listed because it is irreversible.) | code | Require password / fresh Google re-auth; block deleting the last ADMIN. |
| F-13 | low | fixed | Onboarding in a second tab: submit gets `409 ONBOARDING_DONE`, mapped to the generic error; the second dialog stays until a session refetch. | code | Map `ONBOARDING_DONE` to "already done" and `refreshSession()`. |
| F-14 | low | fixed | `AuthLifecycleProvider.syncedOnce` is never reset: after sign-out + sign-in as another user in the same page session the new user's saved language is not applied/persisted correctly. | code | Reset `syncedOnce`/`persistedLanguage` when `user.id` changes. |
| F-15 | low | open | Change-e-mail: the verification mail to the new address is sent in the language looked up by the NEW address (not in DB) so Polish users get English; `afterEmailVerification` re-sends the welcome mail after an e-mail change; the "verify-sent" text ("If an account can be created...") is shown after a sign-in with an unverified account where it reads wrongly. | code | Pass the user's id/language into the mail helper; skip the welcome mail on e-mail change; separate copy for the sign-in case. |
| F-16 | low | open | `AUTH_SIGN_IN` is audited in `session.create.after`, i.e. also for the temporary session Better Auth creates before a 2FA code is verified. | code | Audit after 2FA success, or add `via`/`pending2fa` metadata. |
| F-17 | low | open | Consent prompt (already reworked in #1592, not duplicated here): the "fresh registration" window is 10 min from `createdAt`, so an e-mail sign-up verified later than that never sees it; the "dismissed" flag is set when it opens (lost if never answered); the error strings are hard-coded Polish. | code | Base freshness on `emailVerified` time / first session, translate strings. |
| F-18 | low | open | Misc: apex `pawelperfect.com` answers `301` (a POST there becomes a GET; harmless because the UI uses relative URLs and pages redirect first) so the apex trusted origin is unused; production HTML contains `data-build-id="development"`; `/api/user/sync` and its use case still carry Clerk-era logic. | live + code | Cosmetic; set the build id at deploy; delete the dead sync route when convenient. |

## 2. Flow by flow

Legend: Exp = expected, Act = actual per code. "OK" = matches expectation, no finding.

### 2.1 E-mail sign-up

| Step | Exp | Act |
|---|---|---|
| Nickname | 3-30 chars, letters/digits/space/-_., unique | Client: `validateNickname` + `GET /api/users/nickname-available` (20/min per IP, fails open on error). Server: same rules again in `beforeUserCreate` (`NICKNAME_TAKEN`). OK; race and squatting see F-11. |
| Turnstile | token before submit | Button disabled until token; load failure = dead form (F-02). Server rejects without token (live: `400 MISSING_RESPONSE`). |
| Submit | same answer for new and existing address | OK: generic response, existing address gets the "account exists" mail (hash is still computed to equalise timing). Password min 10 / max 128, haveIBeenPwned in prod (fails closed if its API is down). |
| Double submit | one account | UI disables the button (`loading`), token is single-use; server checks existing e-mail first. A true race can create two rows only if the e-mail differs in case (Better Auth lower-cases). OK. |
| Mail never arrives | "Send the link again" | Resend needs a fresh captcha, 5/h per IP; no countdown/"wrong address? change it" link; the view says "If an account can be created..." OK but thin. Sign-in with the correct password also re-sends the link (`sendOnSignIn`). |
| Link click | verified, signed in, welcome mail | OK in the same or another browser (`autoSignInAfterVerification`); no success message (F-03). Link valid 1 h. |
| Expired / used link | clear message and a way to resend | Expired: `?error=TOKEN_EXPIRED` ignored (F-03). Used again: plain redirect, no session, no message. Recovery works because sign-in re-sends a link. |
| Sign-in before verification | blocked with explanation | `403 EMAIL_NOT_VERIFIED` after the password is verified (no enumeration), new link sent, modal switches to "Check your inbox". OK. |

### 2.2 Google sign-in and One Tap

| Case | Exp | Act |
|---|---|---|
| First time | account + onboarding | `beforeUserCreate` (non-email path) sets `onboardingPending`, default avatar, language from `app-language` cookie. Lands on `/sso-callback` -> return path -> dialog. OK. |
| Returning | straight in | OK. |
| Existing verified e-mail row (incl. all Clerk-era rows) | link to that row | OK (`trustedProviders: ["google"]`, local row verified). Comments/payments stay. |
| E-mail registered with a password and verified | link, both methods work | OK. |
| E-mail registered with a password, never verified | link or clear explanation | Refused for ever, generic error (F-04). |
| Consent cancelled / error | message and way back | `errorCallbackURL=/sso-callback?error=1` -> "Signing in with Google failed" + home link. OK; message does not distinguish cancel from failure. |
| Popup blocked | n/a | Redirect flow (no popup). In-app browsers (Instagram/Facebook webviews) are refused by Google itself; no pre-check. iOS standalone PWA may return into Safari without the PWA session (sessionStorage return path lost, falls back to `/`). |
| One Tap | optional prompt | Shown to every guest on every load (F-10); failures swallowed; bypasses 2FA (F-07). |
| Open redirect | none | Live: `callbackURL=https://evil.example` -> `403 INVALID_CALLBACK_URL` on sign-in/social, verify-email and reset-password. `sanitizeReturnPath` rejects `//`, absolute URLs, backslashes, `/sso-callback` loops. OK. |

### 2.3 Onboarding dialog (Google users)

| Case | Exp | Act |
|---|---|---|
| Skip / close / Esc / outside click | not possible | `onOpenChange` is a no-op, no close button; only "Sign out". OK. |
| Refresh mid-way | dialog returns | OK: driven by `onboardingPending` from the session. |
| Back button | no escape | Dialog is not a route; page changes keep it. OK. |
| Second tab | one completes, other adapts | Other tab shows 409 as a generic error (F-13). |
| API bypass | blocked until done | Not enforced server-side (F-11). |
| Avatar | JPG/PNG/WebP <= 2 MB, resized to 256 px | Client + server validation (type, signature, size). OK. |
| Welcome mail | once | Sent after onboarding (`/api/user/first-sign-in`); the `afterEmailVerification` path covers e-mail sign-ups. |
| Consent question order | after onboarding | Fixed in #1592 (not touched here). |

### 2.4 Sign-in, 2FA, sessions, sign-out

| Case | Exp | Act |
|---|---|---|
| Wrong password | generic message | `INVALID_EMAIL_OR_PASSWORD`; unknown address burns an equal hash. OK. Clerk-era user: no hint (F-09). |
| Lockout | brute-force protection | Per IP 5/min + per e-mail 10/15 min (F-06). Message `TOO_MANY_ATTEMPTS`/429 mapped. |
| 2FA prompt | code or backup code | `twoFactorRedirect` -> code view; closing the modal returns to sign-in (10-min `two_factor` cookie). Google/One Tap bypass and forced trustDevice (F-07). |
| Remember me | user choice | None: always a persistent 30-day cookie, refreshed after 1 day; no "shared computer" option (info). |
| Multiple devices | listed and revocable | UI exists; broken after day 1 (F-05). |
| Sign-out | this device; all devices available | User menu / account panel sign out this device only (`authClient.signOut`); "Sign out other devices" in Security (F-05 applies). Cookie-cache means a revoked session can still pass `auth()` for up to 60 s; admin routes use `fresh: true`, other actor lookups re-read the DB row (`isDeleted`). |
| Soft-deleted user | never signs in | `beforeSessionCreate` throws `ACCOUNT_DELETED`; cleanup also deletes sessions/accounts. OK. |
| Cookies | HttpOnly, Secure, Lax | Live (`__Secure-pp.state`): `Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax`, host-only (www). OK. HTML is `private, no-cache, no-store`, so bfcache/back after sign-out re-fetches. |

### 2.5 Password reset, change password, change e-mail

| Case | Exp | Act |
|---|---|---|
| Request | same answer always, rate limited | OK (captcha, 5/h per IP, fire-and-forget mail). |
| Expired / invalid token | clear message | Live: `reset-password/bogus?callbackURL=/reset-password` -> `/reset-password?error=INVALID_TOKEN`; the page shows the INVALID_TOKEN text. OK. |
| Reuse | rejected | Token is consumed (`consumeVerificationValue`) -> INVALID_TOKEN. OK. |
| Effects | sessions revoked, notice mail | `revokeSessionsOnPasswordReset`, "password changed" mail, audit. Does not mark e-mail verified or trigger 2FA (by design). Google-only/Clerk-era accounts get a credential created. |
| Change password (signed in) | other devices out | Forced `revokeOtherSessions` in the before hook, mail + audit. OK. |
| Change e-mail | link to new address, change after click | Works with `sendVerificationEmail`; UI copy accurate. Language/welcome issues F-15. The admin bootstrap list is checked against the verified current e-mail only. |

### 2.6 2FA management

| Case | Exp | Act |
|---|---|---|
| Enable | password -> QR + codes -> confirm | OK; requires a password (Google-only cannot, documented). |
| Disable | password | OK. |
| Backup codes | view/regenerate | Not possible (F-08). |

### 2.7 Account deletion, re-registering, soft-deleted users

| Case | Exp | Act |
|---|---|---|
| Delete | irreversible, anonymised | Typed confirmation only (F-12). Row becomes `deleted_<uuid>@deleted.com`, name "Usunięty Użytkownik", sessions/accounts/2FA/avatar/subscriptions removed, grants revoked, mail sent to the old address. |
| Re-register same e-mail | allowed | Yes: the tombstone no longer holds the address, so sign-up/Google create a fresh account (new onboarding). |
| Same nickname | allowed | Yes: nickname checks ignore `isDeleted` rows. |
| Old session cookie | dead | Rows deleted; cookie cache <= 60 s but actor lookup rejects `isDeleted`. |

### 2.8 Language, admin, proxy, CSRF, rate limits

| Area | Act |
|---|---|
| Language | Stored in `User.language`; synced once per login (F-14); sign-up sends the UI language; Google uses the cookie. Mails use the stored language. |
| Admin bootstrap | Verified e-mail in `ADMIN_EMAILS` -> promoted on first actor resolution (audited); never-verified cannot. Non-admin visiting `/admin` is redirected silently to `/` by `app/admin/layout.tsx`. Unauthenticated: `/admin` -> sign-in redirect (F-01), `/api/admin/users` -> JSON 401 (live). |
| CSRF / origin | Better Auth origin check applies to cookie-bearing requests; `/api/user/*` uses `checkAdminCsrf` (live: evil `Origin` -> `403 Cross-origin request rejected.`, own origin -> 401 unauthenticated). Trusted origins: base URL + www/apex + extras; works behind the Cloudflare Tunnel because the base URL is fixed in env and `Host` is preserved. |
| Rate limits | Redis-backed (srh), per-IP from `CF-Connecting-IP` when `TRUST_CF_CONNECTING_IP=true`: sign-in 5/min, sign-up 10/h, reset 5/h, resend 5/h, change-password 10/h, nickname check 20/min, default 120/min. Verified live for sign-in. Captcha failures also count against the IP budget. |
| Public routes | `/api/auth/*`, `/reset-password`, `/sso-callback`, nickname check, avatars public; `/api/subscriptions`, `/api/notifications`, `/api/comments` POST, `/api/checkout/create-intent` return 401 JSON without a session (live). |

### 2.9 Comments, tipping, mobile/PWA

| Case | Act |
|---|---|
| Signed out | Composer, like, subscribe, tip gate and locked videos all open the sign-in modal (`useAuthModal`); nothing resumes automatically after sign-in (the user repeats the click; component state such as a typed comment survives because there is no reload). |
| Signed in | Normal. Tip creation requires a session (live 401 otherwise). |
| Mobile | Dialogs are `calc(100vw-1rem)` wide and scroll (`max-h-[100dvh-2rem]`); OAuth full-page redirect; `RotateDeviceGuard` is unrelated. Installed Android PWA is portrait-locked; iOS standalone OAuth return may open in Safari (see 2.2). |
| Back/forward | `no-store` HTML, so no stale signed-in page from bfcache. After the OAuth redirect `location.replace` keeps the history clean. |

## 3. Tests

Existing auth suite (`tests/unit/auth`, 11 files, 93 tests) passes. It covers config helpers, hooks (nickname, lockout,
pre-hijack guard, session guard), e-mail helpers, instance options, profile use cases, avatar validation, nickname rules,
proxy gating and `/sso-callback`.

Coverage gaps (no tests at all): `AuthModal` (all views), `OnboardingDialog`, `AccountSections` (change e-mail,
connections, deletion), `SecuritySection`, `AuthLifecycleProvider` (language sync, sign-in/out refresh),
`GoogleOneTapPrompt`, `TurnstileWidget` (load failure), `/reset-password` page, `AuthModalProvider` URL handling,
`AccountDeletionCleanupUseCase` re-registration path, route handlers `/api/user/{account,first-sign-in,avatar,nickname}`
(unauthenticated and error branches), and anything exercising Better Auth endpoints end to end (needs the
`integration-postgres` job).

Follow-up (2026-10-02): all `it.fails` markers were flipped to plain `it` (F-05's freshAge assertion was replaced by
the "sign in again" prompt tests, since `freshAge` was deliberately kept); new tests cover the return path, the
verification-link feedback, the lockout, backup codes, One Tap throttling, account-deletion re-authentication and
the nickname onboarding of old accounts.

Added (original audit): `tests/unit/auth/auth-flows-audit.test.tsx` (7 tests) and `tests/unit/auth/auth-provider-link-errors.test.tsx`
(1 test), all `it.fails`, each verified to fail for the stated reason when switched to `it`: F-01 (x2), F-03 (x2),
F-05 (x3), F-07.

## 4. Live checks performed (read-only)

| Request | Result |
|---|---|
| `GET /api/auth/get-session` (no cookie) | 200 `null`, `Cache-Control: no-store` |
| `POST sign-in/email`, sign-up, reset request, resend (no captcha) | 400 `MISSING_RESPONSE` for every origin (captcha enforced) |
| 6 x `POST sign-in/email` | 400 x5, then 429 with `x-retry-after` |
| `verify-email` / `reset-password` / `sign-in/social` with foreign `callbackURL` | 403 `INVALID_CALLBACK_URL` |
| `verify-email?token=bogus&callbackURL=/pl` | 302 `/pl?error=INVALID_TOKEN` (F-03) |
| `sign-in/social` google, `callbackURL=/sso-callback` | Google authorize URL with PKCE; state cookie HttpOnly/Secure/Lax |
| `/admin`, `/api/admin/users`, `/api/user/*`, `/api/auth/list-sessions`, `/api/subscriptions`, `/api/notifications` | redirect to `/?signin=1&next=%2Fadmin` / JSON 401 |
| `PATCH /api/user/nickname` with `Origin: https://evil.example` | 403 `Cross-origin request rejected.` |
| `https://pawelperfect.com/...` POST | 301 to www |
| `/en` HTML | `private, no-cache, no-store`; HTML contains `data-build-id="development"` |

## 5. Suggested order of work (done: F-01, F-03..F-10, F-12..F-14; open: F-11, F-15..F-18 and the one-time e-mail to Clerk-era users in F-09)

1. F-01, F-03, F-02 (what every user sees): return path, verification-link feedback, captcha failure state.
2. F-04 + F-05 (one-line config changes with real impact): `requireLocalEmailVerified: false`, `freshAge`.
3. F-06, F-07, F-08 (security hardening of lockout and 2FA).
4. F-09 (message to Clerk-era users) before the site is announced.
5. The rest as polish.

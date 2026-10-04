# Authentication: Better Auth (self-hosted)

Status: live from 2026-10-02 (replaces Clerk). The service was not public when it switched, so no user
migration was done; existing `User` rows keep their ids, e-mails, comments and payments and are linked
by e-mail on first Google sign-in.

Durable rules for agents live in `CLAUDE.md` (section 4.12). This file explains the decisions, the flows
and the operations.

## Shape

- Library: `better-auth` with the Prisma adapter (Prisma 6, our Postgres). No external identity service.
- Our `User` model **is** the Better Auth user. Mapped fields: `name` = nickname, `image` <-> `imageUrl`.
  Added columns: `emailVerified`, `twoFactorEnabled`, `onboardingPending` (migration
  `20261002100000_add_better_auth`, additive and idempotent). Extra fields used through
  `user.additionalFields`: `language` (input) and `onboardingPending` (server only).
- New tables: `Session`, `Account` (credential password hash, Google link), `Verification` (one-time
  tokens), `TwoFactor` (TOTP secret and backup codes), `Passkey` (WebAuthn public key, credential id, device
  name; migration `20261004180000_add_passkey`, `credentialID` unique across users). `ClerkEvent` stays in the schema as a dead table
  (migrations are additive only).
- Roles are ours: `User.role` (`USER` | `ADMIN`). The Better Auth `admin` plugin is **not** used (its string
  role and ban fields clash with `SystemRole` and with our soft delete). Disabled accounts are blocked in
  `databaseHooks.session.create.before` (`isDeleted`).
- `PatronGrant` and payments are untouched. Patron status is never read from the session.

## Files

| File | Role |
|---|---|
| `lib/auth/auth.ts` | The Better Auth instance (plugins, hooks, rate limits, cookies). |
| `lib/auth/config.ts` | Constants and pure helpers (base URL, trusted origins, admin e-mails). |
| `lib/auth/hooks.ts` | Hook bodies: placeholder name, default avatar, onboarding flag, EMAIL_TAKEN answer, sign-in lockout, session guard, pre-hijack guard, audit. |
| `lib/auth/emails.ts` | Fire-and-forget e-mails (verification, reset, password changed, the three e-mail-change mails; the welcome mail goes out from the onboarding route). |
| `lib/auth/rate-limit-storage.ts` | Better Auth `customStorage.consume` on our Redis REST store (atomic Lua INCR); fails open with an error log (see Security controls). |
| `lib/auth/passkey.ts` | Passkey rules on the server: name cleanup, fresh session for add/remove, user-verification check, audit events. |
| `lib/auth/passkey-signup.ts` | Passkey-first sign-up: `/passkey-signup/start`, the signed sign-up token, account creation after the ceremony, unverified-account check on passkey sign-in. |
| `lib/auth/passkey-support.ts` | Browser feature detection (`PublicKeyCredential`, autofill) and the default device name. |
| `lib/auth/reauth.ts` | `checkSensitiveReauth`: password, or a Google sign-in from the last 10 minutes (account deletion, e-mail change). |
| `lib/auth/server.ts` | `auth()`, `getAuth(req)`, `currentUser()`: the only server-side session readers. |
| `lib/api/auth.ts` | DB-backed actor (`getActorFromAuth`, `requireAdminActor`); admin bootstrap by `ADMIN_EMAILS`. |
| `lib/auth/client.ts`, `lib/auth/react.ts` | Browser client and `useAuth` / `useUser` hooks (the user object still uses the old Clerk-like field names `fullName`, `primaryEmailAddress`; see "Not done yet"). |
| `middleware.ts` | Optimistic session-cookie gate, public route list, CSRF, admin rate limit, CSP. |
| `app/api/auth/[...all]/route.ts` | Better Auth HTTP handler. |
| `app/api/user/{nickname,avatar,first-sign-in,account}` | Our own profile routes (Better Auth `/update-user` is disabled). |
| `app/components/auth/*` | `AuthModal`, `OnboardingDialog`, `AccountModal` sections, Turnstile widget, One Tap. |
| `app/sso-callback`, `app/reset-password` | Return pages for the Google redirect and the reset e-mail link. |

## Flows

**Email sign-up.** Modal asks e-mail, password (min 10, haveIBeenPwned checked in production) and "Repeat
password" (client-side match; the button stays disabled until both match and are long enough; show/hide toggle),
plus Turnstile. There is no nickname field: the server stores a neutral placeholder name derived from the
e-mail local part (`placeholderNameFromEmail`) and sets `onboardingPending = true`, exactly like Google users.
`requireEmailVerification` is on and `autoSignIn` off; a new address gets a verification link (valid 1 hour;
clicking it verifies and signs in). On that first signed-in page `OnboardingDialog` asks for the nickname (checked
for uniqueness in `completeOnboarding`) and an optional avatar, then `POST /api/user/first-sign-in` sends the welcome
e-mail (the single place it is sent, so exactly once; the subscription prompt waits for onboarding).

**Existing e-mail at sign-up (owner decision 2026-10-02).** Sign-up with an address that already has an account
answers HTTP 422 with code `EMAIL_TAKEN` (or `EMAIL_TAKEN_GOOGLE` when the account has a Google link and no password),
shown as "this e-mail already has an account" with "Sign in" and "Forgot password" actions (the e-mail stays
prefilled). This is a deliberate convenience-over-privacy trade-off: the sign-up form is now an e-mail enumeration
oracle. It is limited by Better Auth's per-IP rate limit and Turnstile (the check is an *after* hook in
`lib/auth/hooks.ts` precisely because `options.hooks.before` runs ahead of the captcha plugin; it compares the
stored user id with the synthetic id Better Auth returns for duplicates). Sign-in (`INVALID_EMAIL_OR_PASSWORD`) and
password reset ("if that account exists...") stay enumeration-safe. The old "account exists" e-mail and its
template were removed.

**Sign-in.** `signIn.email` (Turnstile, 10 requests/min per IP). Lockout (audit F-06): only FAILED attempts
(`INVALID_EMAIL_OR_PASSWORD`) count, 10 per 15 min per e-mail + client IP (so a third party cannot lock the owner
out from another address) and a high ceiling of 100 per 15 min per e-mail across IPs (distributed guessing; each
attempt costs a solved captcha). Counted in the after hook, checked read-only (`peek`) in the before hook.
Unverified accounts get a new verification link and a 403 `EMAIL_NOT_VERIFIED`. A user with TOTP enabled gets
`twoFactorRedirect` and finishes with a code or a backup code (`twoFactor.verifyTotp` / `verifyBackupCode`).
"Remember this device" is an unticked checkbox on that step (`trustDevice`, cookie `trustDeviceMaxAge` 7 days).
**Decision (F-07): 2FA applies to e-mail + password sign-in only.** Google and One Tap sign-in are trusted as
strong on their own (Google's own 2-step verification), as in Better Auth's defaults; the app never adds a TOTP
step on top. A wrong password shows a hint at Google / "Forgot password" for Clerk-era accounts without a password.

**Passkeys (2026-10-04).** `@better-auth/passkey` (same version as `better-auth`; see "Dependency note" below).
- Relying party: `getPasskeyRelyingParty()` in `lib/auth/config.ts`. RP ID = host of `BETTER_AUTH_URL` /
  `NEXT_PUBLIC_APP_URL` without `www.` (`pawelperfect.com`, `localhost` in development), so one passkey works on www and
  the apex. Accepted WebAuthn origins = the trusted origins on that domain (www and apex); the plugin never falls back to
  the request's own `Origin` header. RP name "Pawel Perfect". Attestation `none` (plugin default).
- Credentials are discoverable (`residentKey: "required"`, needed for the e-mail-less "Use a passkey" button and
  autofill); `userVerification: "preferred"` in the browser call (web.dev advice: `"required"` confuses some platforms)
  but the server **requires the UV flag** in `afterVerification` (`PASSKEY_USER_VERIFICATION_REQUIRED`): the plugin
  itself verifies with `requireUserVerification: false`, and a passkey sign-in replaces the password and TOTP.
- A signed-in user adds and removes passkeys in the account panel ("Klucze dostępu" tab). Both need a fresh session
  (`freshAge` 1 day), checked in our before hook (`assertFreshSessionIfSignedIn`, since registration runs with
  `requireSession: false` for the passkey-first sign-up below and delete only wants a session); an older session gets
  `SESSION_NOT_FRESH` and the usual "sign in again" notice. Renaming (`/passkey/update-passkey`) is disabled. The device
  name is normalized (one line, max 64 characters) and the WebAuthn user name stays the e-mail (`?name=` is blanked in
  the before hook). `createSession` on registration is forced off.
- **Decision (owner, 2026-10-04, reverses "a passkey never creates an account"): "Use a passkey" works like
  "Continue with Google".** See "Passkey-first sign-up" below.
- **Decision: a passkey sign-in counts as strong authentication**, like Google: no TOTP step after it (Better Auth's
  2FA hook only runs on `/sign-in/email`), because it already combines possession of the device key with biometrics or
  the device PIN (user verification enforced above) and is phishing-resistant.
- Sign-in UI (window titled "Zaloguj się lub załóż konto"): "Kontynuuj z Google" and "Użyj klucza dostępu",
  then "Nowy tutaj? Konto założymy automatycznie.", the e-mail/password form, and "Nie masz konta? Załóż konto" at the
  bottom. Passkeys are also offered in the e-mail field's autofill (`autocomplete="username webauthn"`, conditional
  mediation) while the window is open. Passkey parts are hidden where `PublicKeyCredential` is missing. Autofill shows
  only errors that follow picking a passkey.
- No Turnstile on passkey sign-in: the options request runs when the form opens (autofill), the challenge is
  single-use (5 min, `Verification` row + signed cookie `pp.better-auth-passkey`) and a signature needs the device key.
  Instead Better Auth's per-IP limits on our Redis store: options 20/min, verify 10/min, add/remove 20/h. The passkey
  sign-up step, where an e-mail is typed, does have Turnstile (below).
- A deleted account cannot sign in with a passkey: `beforeSessionCreate` refuses `isDeleted`, and account deletion
  removes the `Passkey` rows (also `ON DELETE CASCADE`).
- Audit: `AUTH_PASSKEY_ADDED`, `AUTH_PASSKEY_REMOVED`, `AUTH_PASSKEY_SIGN_IN` (user id + passkey id only); the sign-in
  also writes the usual `AUTH_SIGN_IN`.
- CSP: nothing new (WebAuthn is a browser API; requests go to our own `/api/auth`); `Permissions-Policy` does not
  restrict `publickey-credentials-*`. `/api/auth/passkey/*` is public in the proxy through `/api/auth(.*)`.
- Dependency note: `@better-auth/passkey` needs `@better-auth/core` and `better-call` at the top of `node_modules`;
  `better-call` lists `zod@^4` as an optional peer while the app uses zod 3, so `package.json` overrides that edge
  (`"better-call": { "zod": "$zod" }`). Only `better-call/openapi` imports zod, and nothing here uses it. Upgrade
  `@better-auth/passkey` together with `better-auth`.

**Passkey-first sign-up (2026-10-04).** `lib/auth/passkey-signup.ts`, UI `PasskeySignIn.tsx` + `PasskeySignupView.tsx`.
- Flow: the button tries a discoverable-passkey sign-in. If the browser offers no passkey of ours or the person picks
  nothing (WebAuthn reports both as the same `NotAllowedError`, on purpose), or the chosen key belongs to no account
  (`PASSKEY_NOT_FOUND`), the window shows "Konto z kluczem dostępu": e-mail + Turnstile -> `POST
  /api/auth/passkey-signup/start` -> the browser creates the passkey -> the account is created -> "check your inbox".
  The verification link signs the person in (`autoSignInAfterVerification`) and the first-sign-in dialog asks for the
  nickname, avatar and language, exactly as after an e-mail sign-up.
- Mechanism (chosen after the Better Auth passkey docs, "passkey-first registration"): `registration.requireSession:
  false` with `resolveUser` that accepts only our own signed token, and the account is created in
  `registration.afterVerification` (the docs' advice: "create or load the user in afterVerification"), so nothing is
  stored unless the WebAuthn ceremony succeeded and the device verified the user. The token comes from
  `/passkey-signup/start` (Turnstile, 10/h per IP like the e-mail sign-up): HMAC-SHA256 with a key derived from
  `BETTER_AUTH_SECRET`, carries the e-mail, language, return path and a 10-minute expiry; it is stateless, and reusing it
  fails because the address is taken by then. A taken address answers `EMAIL_TAKEN` / `EMAIL_TAKEN_GOOGLE`, the same
  owner decision (and the same enumeration trade-off, behind Turnstile and the rate limit) as the e-mail sign-up.
  Rejected alternatives: creating the user at "start" (rows for every abandoned attempt), a session-less account with
  an immediate session (an unverified address would be signed in), magic-link first (two round trips to the inbox).
- The account is unverified until the link is clicked: a passkey sign-in on it is refused with `EMAIL_NOT_VERIFIED` and
  a new link is mailed (limited per address, like the other mail forms); no session, so it cannot comment, react or tip;
  `/api/cron/prune-unverified-accounts` deletes it after 7 days (passkeys go with it, `ON DELETE CASCADE`).
- Threat: somebody starts a passkey sign-up with another person's address (pre-hijacking). Until the owner verifies, the
  account is useless (no sign-in) and is pruned. If the owner later signs in with Google, the pre-hijack guard
  (`beforeAccountCreate`) now drops the unverified account's passkeys too; if the owner resets the password ("forgot
  password" on `EMAIL_TAKEN`), `onPasswordReset` drops passkeys of a never-verified account. Accepted residual risk,
  the same as for the e-mail sign-up today: the owner clicks the verification mail that the other person's sign-up
  triggered, which verifies the account with that person's passkey on it. The mail is the standard verification mail.
- Passkey sign-in stays without TOTP (decision above).

**Shared computers.** Google redirect sign-in always shows the account chooser (`prompt: "select_account"`), One
Tap never auto-selects (`autoSelect: false`), and every sign-out goes through `signOutCompletely()`
(`lib/auth/sign-out.ts`): it ends the session, calls `google.accounts.id.disableAutoSelect()` and drops the remembered
return path, so the next person is not continued as the previous user. Nickname/onboarding is asked only at the
first sign-in of an account.

**Return path (F-01).** The proxy sends gated pages to `/?signin=1&next=/path`. `AuthModalProvider` remembers `next`
in `sessionStorage` (`lib/auth/sso-return.ts`, same-site relative paths only: `//`, absolute URLs, backslashes and
`/sso-callback` fall back to `/`); e-mail sign-in navigates there, Google keeps it through `/sso-callback`
(`rememberReturnPathIfNone`), and closing the modal clears it.

**E-mail links (F-03).** Sign-up/resend/sign-in pass `callbackURL = <return path>?verified=1`. Better Auth redirects
a good click there (the provider shows "Email confirmed" or, with no session in that browser, opens sign-in with the
same message) and a bad one to `?error=TOKEN_EXPIRED|INVALID_TOKEN` (the provider opens the modal on a "link
expired, send a new one" view). The "check your inbox" modal closes by itself when the session appears (the link
was opened in another tab).

**Google.** Redirect flow (`signIn.social`, callback `/api/auth/callback/google`, return page `/sso-callback`)
and One Tap (`oneTap` plugin; the client id is handed to the browser at runtime through
`AuthPublicConfigProvider`, so it is not baked into the bundle). Account linking is on with `google` as a trusted
provider: a Google sign-in whose e-mail matches an existing row signs into that row (comments and payments stay).
`requireLocalEmailVerified: false` (F-04), so this also works when the row only has a never-verified password
sign-up (see the pre-hijack guard below). One Tap is offered only while the sign-in window is open (sign-in and
sign-up views, `SignUpFooter` → `GoogleOneTapPrompt`, cancelled when the window closes): Google's script and its
`g_state` cookie never reach a visitor who did not ask to sign in (privacy policy § 6, 2026-10-04). Without FedCM
the prompt is drawn inside the dialog (`prompt_parent_id`). The CSP allows `https://accounts.google.com/gsi/style`.
Every way to create an account is in that window, next to the Terms / Privacy Policy notice; `beforeUserCreate`
records `User.termsAcceptedAt`/`termsVersion`.
A brand-new Google user (like every new e-mail sign-up) gets `onboardingPending = true` and must pick a nickname (and optionally an avatar) in
`OnboardingDialog`; the welcome e-mail is sent after that (`POST /api/user/first-sign-in`).

**Password reset / set a password.** `requestPasswordReset` always answers the same way. The e-mail link opens
`/reset-password?token=...`. Because a Google-only account has no credential, "forgot password" is also how it
gets a password; `resetPassword` creates the credential account. Resetting revokes all sessions.
**Pre-hijack guard:** if someone registered an address by e-mail and never verified it, and the real owner later
signs in with Google, `beforeAccountCreate` deletes the unverified password and sessions so the first registrant
cannot keep access. Unverified password or passkey sign-ups older than 7 days are deleted by
`/api/cron/prune-unverified-accounts` (systemd timer `polutek-cron-prune-unverified-accounts`, 03:30 UTC; only rows
with no payments, grants, channels or comments), so nobody can squat an address or nickname for long.

**Change e-mail (audit AUTH-02/03, 2026-10-03).** A valid session alone is not enough (a stolen cookie must not be able
to take the account over):
1. `POST /api/auth/change-email` carries the password in the body; the before hook `guardChangeEmail` (`lib/auth/hooks.ts`)
   checks it with `checkSensitiveReauth`. A Google-only account instead needs a sign-in from the last 10 minutes
   (`REAUTH_REQUIRED`; the UI offers "sign in again"). Limits: 5 requests per user per hour (wrong passwords count too)
   and 10 per IP per hour (`customRules`).
2. `changeEmail.sendChangeEmailConfirmation`: the CURRENT address gets "approve the change to <new>" (`change-email-confirm`).
3. Only after that click Better Auth sends the verification link to the NEW address (`change-email-verify`); the
   address changes when it is clicked.
4. `emailVerification.afterEmailVerification` (`onEmailVerified`) mails the OLD address "your address was changed"
   (`email-changed`) and writes `AUTH_EMAIL_CHANGED`.
All three mails use the account language (looked up by user id, the new address is not in the database yet). Other
sessions are not revoked by the change (the old address approved it); revoking them is a possible follow-up.

**Account deletion.** `DELETE /api/user/account` needs re-authentication (F-12): a password account sends its
password in the body (verified with Better Auth's hasher, rate limited 5 per 15 min per user), a Google-only account
must have a session created in the last 10 minutes (`REAUTH_REQUIRED`; the UI offers "Confirm with Google", which
signs in again), and the last remaining ADMIN cannot delete itself (`LAST_ADMIN`, 409). Then our anonymising cleanup
(`AccountDeletionCleanupUseCase`) deletes sessions, accounts, two-factor and passkey rows. The `User` row stays as an
anonymised tombstone.

**Sessions.** DB sessions, 30 days, refreshed daily, cookie cache 60 s, `freshAge` 1 day (kept on purpose, F-05). The
account panel lists devices and can revoke one or all others (`listSessions`, `revokeSession`,
`revokeOtherSessions`) and disconnect Google; Better Auth refuses these on a session older than a day with
`SESSION_NOT_FRESH`, and the UI then shows "sign in again" (`ReauthNotice`: signs out and reopens sign-in with the
current page as `next`) instead of an empty list. Password change revokes other sessions.

**2FA management (F-08, AUTH-13).** Backup codes are shown with copy/download after setup and can be regenerated (password
required, old codes stop working). Regenerating codes and turning 2FA off are two separate forms with their own password
fields, so Enter in one can never trigger the other. Turning it off needs the password (not a TOTP code). Google-only accounts must first set a password ("Forgot password" link) before
they can enable TOTP; the Security tab explains this.

**Old accounts (F-09).** At every sign-in, accounts whose name is missing, breaks the nickname rules or duplicates an
older account's name get `onboardingPending = true`, so the first-sign-in dialog asks for a nickname (the welcome
e-mail is only sent for accounts younger than a day).

**Onboarding on the server (F-11, AUTH-10/11).** While `onboardingPending` is true the name is only a placeholder: the
actor carries `onboardingPending` (`resolveDbBackedActor`), `CommentPolicy` refuses comments, reactions and edits, and a
comment attempt answers `ONBOARDING_REQUIRED` ("choose a nickname in the welcome window first"). Placeholders never
count as taken nicknames (`CheckNicknameAvailabilityUseCase`, `assertNicknameFree`). Nicknames of active, onboarded
accounts are unique case-insensitively in the database: partial index `User_name_lower_active_key` on `lower(name)`
(migration `20261003200000_user_nickname_unique_active`, which first sends duplicate holders except the oldest back to
onboarding); a lost race answers `NICKNAME_TAKEN`. The index is not expressible in `schema.prisma`.

## Admin

Admin is `User.role = ADMIN`. Bootstrap: set `ADMIN_EMAILS` (comma separated). A **verified** account with such an
e-mail is promoted when it resolves an actor (`lib/api/auth.ts`) and an `AUTH_ADMIN_BOOTSTRAP` audit event is written.
A never-verified address can never be promoted, so nobody can claim an admin e-mail by registering it first. The check
runs on every request (AUTH-27): while an address stays in `ADMIN_EMAILS`, a demotion in `/admin/users` is undone at
once, so empty the variable after the first sign-in and never list a shared (helpdesk) inbox there.

**MFA for the admin (proposal, not enabled).** Safe order: (1) the owner turns on TOTP in the account panel and stores
the backup codes; (2) only then `requireAdminActor` starts refusing `role=ADMIN` without `twoFactorEnabled`, and also an
admin session created by Google (decision F-07 lets Google skip TOTP), or adds a TOTP step-up for admin routes; (3) keep
the break-glass path below. Passkeys are now available to everybody (see "Passkeys"); making one mandatory for the
admin is the remaining step.
Admin routes keep the CSRF guard and rate limits in `middleware.ts`; admin API rate limiting is keyed by a hash of the
session cookie plus the IP (the proxy cannot read the user id without a database call).

## Security controls

- Cookies: prefix `pp`, `HttpOnly`, `SameSite=Lax`, `Secure` in production (`__Secure-` name).
- Rate limits: Better Auth's limiter uses `customStorage.consume` on `KV_REST_API_*` / `UPSTASH_*` (memory only
  outside production). Per-path rules in `lib/auth/auth.ts`; per-account sign-in lockout and per-user e-mail-change
  limit in `lib/auth/hooks.ts`; reset/verification mails are also limited to 5 per hour per target address (hashed
  key, counted only after Turnstile passed, AUTH-30).
- Redis outage (AUTH-12, deliberate): every gateway call has a 1.5 s timeout (`REDIS_COMMAND_TIMEOUT_MS`) and the auth
  counters FAIL OPEN with an error log, so sign-in keeps working. Turnstile, the database TOTP attempt counter and the
  password re-checks stay in force; only the failed-sign-in lockout is blind meanwhile (failing closed would lock
  everybody out of password sign-in).
- Captcha: Turnstile on `/sign-up/email`, `/sign-in/email`, `/request-password-reset`, `/send-verification-email`, `/passkey-signup/start`.
  Enabled when `TURNSTILE_SECRET_KEY` is set (required in production by `env:validate:prod`).
  The client widget (`app/components/auth/TurnstileWidget.tsx`) runs in `appearance: "interaction-only"` with the
  default `execution: "render"`: the check starts the moment a form opens, invisibly, in a collapsed grid row with no
  margin (no gap in the form). If Cloudflare needs a challenge the row expands smoothly to the widget
  (`size: "flexible"`) under "Confirm that you're not a bot". Submit buttons are visible and active from the start:
  `useCaptchaGate` (`app/components/auth/useCaptchaGate.tsx`) queues a click made before the token exists (spinner next
  to the unchanged label) and sends it as soon as the token arrives; it gives up after 15 s of non-interactive
  waiting (never while the visitor solves a challenge) with a PL/EN "taking too long, try again" message, drops a
  queued submit when the form unmounts, and a click after a failed check restarts it. After every request the used
  token is reset and a fresh one fetched in the background. Expiry/timeout refresh automatically; an error or a
  script that fails to load shows a message with "try again". The Cloudflare script still loads only when the
  sign-in window opens (privacy policy), with no preload on the page. The server verification and token header are
  unchanged. CSP already allows `challenges.cloudflare.com` for script, frame and connect (`lib/utils/security.ts`).
- IP: `cf-connecting-ip` when `TRUST_CF_CONNECTING_IP=true`, else `x-real-ip`.
- Origins: `NEXT_PUBLIC_APP_URL` host in www and apex form plus `BETTER_AUTH_TRUSTED_ORIGINS`.
- CSRF for `/api/user/*` mutations is checked in `middleware.ts` (same guard as admin).
- Audit events: `AUTH_SIGN_UP`, `AUTH_SIGN_IN`, `AUTH_SIGN_OUT`, `AUTH_PASSWORD_CHANGED`, `AUTH_EMAIL_CHANGED`, `AUTH_ADMIN_BOOTSTRAP`,
  `AUTH_PASSKEY_ADDED`, `AUTH_PASSKEY_REMOVED`, `AUTH_PASSKEY_SIGN_IN`, `USER_NICKNAME_CHANGED`. Metadata holds ids and flags only.
- Avatars: resized to 256 px JPEG in the browser, validated server side (type, signature, size <= 120k chars) and
  stored as bytes in the `UserAvatar` table (kept out of every `User` read); `User.imageUrl` points at the public
  `/api/avatars/[userId]?v=<timestamp>` route (immutable cache, 404 for deleted accounts). Older rows may still point at `img.clerk.com` (kept in the CSP `img-src` and the image optimizer until
  `SELECT count(*) FROM "User" WHERE "imageUrl" LIKE '%img.clerk.com%';` returns 0).
- CSP (SEC-06, decision 2026-10-03): `script-src` keeps `'unsafe-inline'`. A nonce + `'strict-dynamic'` policy needs every
  page rendered per request (Next.js injects nonces only during dynamic rendering: no static pages, no PPR) and a
  re-test of Stripe.js, Google Identity and Turnstile; plan it as its own change, starting in Report-Only.

## Operations

Environment (names only; never commit values): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_EMAILS`, optional `BETTER_AUTH_URL`,
`BETTER_AUTH_TRUSTED_ORIGINS`. Google redirect URI: `https://<host>/api/auth/callback/google` for each host in use.

Deploy: run the migration (`prisma migrate deploy` runs in `deploy.sh`), set the variables in `app.env`, restart.
Existing Clerk sessions stop working; everybody signs in again.

Rotating `BETTER_AUTH_SECRET` (AUTH-07):
- signs everybody out (session cookies are signed with it) and breaks pending e-mail verification and e-mail-change
  links (signed JWTs);
- does NOT break pending password-reset links (`Verification` rows in the database) or passwords (scrypt, independent
  of the secret);
- **locks every 2FA account out of password sign-in**: TOTP secrets AND backup codes are both encrypted with the secret
  (`storeBackupCodes: "encrypted"`), so neither works afterwards.
Procedure: ask 2FA users (and the admin) to turn 2FA off first, or re-encrypt the `TwoFactor` rows with the new secret in
a one-off script before switching; otherwise affected users need a password reset and their `TwoFactor` row removed.

Locked out of admin: set `ADMIN_EMAILS` to the owner's verified address and sign in, or
`UPDATE "User" SET role = 'ADMIN' WHERE email = '...'` on the database.

Adding a provider: configure it under `socialProviders` in `lib/auth/auth.ts`, add its id to `OAUTH_PROVIDERS`
(`app/components/auth/oauth-providers.tsx`), add its callback URL at the provider, and (if its e-mails are
trustworthy) to `account.accountLinking.trustedProviders`.

## Not done yet

- Mandatory admin MFA (TOTP or passkey): not added; proposal under "Admin" above.
- Passkeys: no "signal unknown credential" to the password manager after a deleted key, and no rename in the UI.
- `lib/auth/react.ts` still returns a Clerk-shaped user (`fullName`, `primaryEmailAddress`); a plain
  `{ id, nickname, email, ... }` shape touches the checkout/tip components and their tests, so it is left for a change
  coordinated with the payments work.
- Apple sign-in was dropped with Clerk (needs Apple credentials).
- Google-only accounts cannot enable TOTP until they set a password (explained in the UI).
- haveIBeenPwned is fail-closed: if its API is unreachable, sign-up and password changes return an error.
- Unauthenticated `/api/admin/*` and `/api/user/*` calls now get JSON 401 from the proxy.

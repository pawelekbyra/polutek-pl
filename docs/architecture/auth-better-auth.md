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
  tokens), `TwoFactor` (TOTP secret and backup codes). `ClerkEvent` stays in the schema as a dead table
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
| `lib/auth/emails.ts` | Fire-and-forget e-mails (verification, reset, password changed; the welcome mail goes out from the onboarding route). |
| `lib/auth/rate-limit-storage.ts` | Better Auth `customStorage.consume` on our Redis REST store (atomic Lua INCR). |
| `lib/auth/server.ts` | `auth()`, `getAuth(req)`, `currentUser()`: the only server-side session readers. |
| `lib/api/auth.ts` | DB-backed actor (`getActorFromAuth`, `requireAdminActor`); admin bootstrap by `ADMIN_EMAILS`. |
| `lib/auth/client.ts`, `lib/auth/react.ts` | Browser client and `useAuth` / `useUser` hooks (same shape the components already used). |
| `middleware.ts` | Optimistic session-cookie gate, public route list, CSRF, admin rate limit, CSP. |
| `app/api/auth/[...all]/route.ts` | Better Auth HTTP handler. |
| `app/api/user/{nickname,avatar,onboarding,account}` | Our own profile routes (Better Auth `/update-user` is disabled). |
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

**Sign-in.** `signIn.email` (Turnstile, 5/min per IP, 10 per 15 min per e-mail). Unverified accounts get a new
verification link and a 403 `EMAIL_NOT_VERIFIED`. A user with TOTP enabled gets `twoFactorRedirect` and
finishes with a code or a backup code (`twoFactor.verifyTotp` / `verifyBackupCode`).

**Google.** Redirect flow (`signIn.social`, callback `/api/auth/callback/google`, return page `/sso-callback`)
and One Tap (`oneTap` plugin; the client id is handed to the browser at runtime through
`AuthPublicConfigProvider`, so it is not baked into the bundle). Account linking is on with `google` as a trusted
provider: a Google sign-in whose e-mail matches an existing row signs into that row (comments and payments stay).
A brand-new Google user (like every new e-mail sign-up) gets `onboardingPending = true` and must pick a nickname (and optionally an avatar) in
`OnboardingDialog`; the welcome e-mail is sent after that (`POST /api/user/first-sign-in`).

**Password reset / set a password.** `requestPasswordReset` always answers the same way. The e-mail link opens
`/reset-password?token=...`. Because a Google-only account has no credential, "forgot password" is also how it
gets a password; `resetPassword` creates the credential account. Resetting revokes all sessions.
**Pre-hijack guard:** if someone registered an address by e-mail and never verified it, and the real owner later
signs in with Google, `beforeAccountCreate` deletes the unverified password and sessions so the first registrant
cannot keep access.

**Change e-mail.** `changeEmail` sends a verification link to the new address; the address changes after the click.

**Account deletion.** `DELETE /api/user/account` runs our anonymising cleanup (`AccountDeletionCleanupUseCase`),
then deletes sessions, accounts and two-factor rows. The `User` row stays as an anonymised tombstone.

**Sessions.** DB sessions, 30 days, refreshed daily, cookie cache 60 s, `freshAge` 1 day. The account panel lists
devices and can revoke one or all others (`listSessions`, `revokeSession`, `revokeOtherSessions`). Password change
revokes other sessions.

## Admin

Admin is `User.role = ADMIN`. Bootstrap: set `ADMIN_EMAILS` (comma separated). The first time a **verified**
account with such an e-mail resolves an actor (`lib/api/auth.ts`), it is promoted and an `AUTH_ADMIN_BOOTSTRAP`
audit event is written. A never-verified address can never be promoted, so nobody can claim an admin e-mail by
registering it first. Afterwards the variable can stay or be emptied; roles are managed in `/admin/users`.
Admin routes keep the CSRF guard and rate limits in `middleware.ts`; admin API rate limiting is keyed by a hash of the
session cookie plus the IP (the proxy cannot read the user id without a database call).

## Security controls

- Cookies: prefix `pp`, `HttpOnly`, `SameSite=Lax`, `Secure` in production (`__Secure-` name).
- Rate limits: Better Auth's limiter uses `customStorage.consume` on `KV_REST_API_*` / `UPSTASH_*` (memory only
  outside production). Per-path rules in `lib/auth/auth.ts`; per-account sign-in lockout in `lib/auth/hooks.ts`.
- Captcha: Turnstile on `/sign-up/email`, `/sign-in/email`, `/request-password-reset`, `/send-verification-email`.
  Enabled when `TURNSTILE_SECRET_KEY` is set (required in production by `env:validate:prod`).
- IP: `cf-connecting-ip` when `TRUST_CF_CONNECTING_IP=true`, else `x-real-ip`.
- Origins: `NEXT_PUBLIC_APP_URL` host in www and apex form plus `BETTER_AUTH_TRUSTED_ORIGINS`.
- CSRF for `/api/user/*` mutations is checked in `middleware.ts` (same guard as admin).
- Audit events: `AUTH_SIGN_UP`, `AUTH_SIGN_IN`, `AUTH_SIGN_OUT`, `AUTH_PASSWORD_CHANGED`, `AUTH_ADMIN_BOOTSTRAP`,
  `USER_NICKNAME_CHANGED`. Metadata holds ids and flags only.
- Avatars: resized to 256 px JPEG in the browser, validated server side (type, signature, size <= 120k chars) and
  stored as bytes in the `UserAvatar` table (kept out of every `User` read); `User.imageUrl` points at the public
  `/api/avatars/[userId]?v=<timestamp>` route (immutable cache, 404 for deleted accounts). Older rows may still point at `img.clerk.com` (kept in the CSP `img-src`).

## Operations

Environment (names only; never commit values): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_EMAILS`, optional `BETTER_AUTH_URL`,
`BETTER_AUTH_TRUSTED_ORIGINS`. Google redirect URI: `https://<host>/api/auth/callback/google` for each host in use.

Deploy: run the migration (`prisma migrate deploy` runs in `deploy.sh`), set the variables in `app.env`, restart.
Existing Clerk sessions stop working; everybody signs in again.

Rotating `BETTER_AUTH_SECRET` signs everybody out and invalidates pending verification/reset links; it does not
affect passwords (hashed with scrypt, independent of the secret) or TOTP secrets of users who enabled 2FA
(encrypted with the secret: **they would need backup codes**). Rotate only with a plan.

Locked out of admin: set `ADMIN_EMAILS` to the owner's verified address and sign in, or
`UPDATE "User" SET role = 'ADMIN' WHERE email = '...'` on the database.

Adding a provider: configure it under `socialProviders` in `lib/auth/auth.ts`, add its id to `OAUTH_PROVIDERS`
(`app/components/auth/oauth-providers.tsx`), add its callback URL at the provider, and (if its e-mails are
trustworthy) to `account.accountLinking.trustedProviders`.

## Not done yet

- Passkeys (`@better-auth/passkey`): not added; fits a separate change (needs a `Passkey` table and a UI section).
- Apple sign-in was dropped with Clerk (needs Apple credentials).
- Account deletion does not ask for the password again (typed confirmation only, as before).
- Google-only accounts cannot enable TOTP until they set a password.
- haveIBeenPwned is fail-closed: if its API is unreachable, sign-up and password changes return an error.
- Unauthenticated `/api/admin/*` and `/api/user/*` calls now get JSON 401 from the proxy.

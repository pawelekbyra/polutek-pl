# CLERK-CUSTOM-AUTH-UI-001 — Replace all Clerk UI with our own (Clerk stays backend only)

Status: IN_PROGRESS (started 2026-07-03)
Priority: MEDIUM (visual/brand consistency; not a correctness bug)
Owner: rolling — any agent may pick up the next unchecked phase below.

> **For future agents:** this is an ongoing, multi-session effort. Read this
> file before touching anything auth-related. Do **not** re-introduce default
> Clerk UI components (`<SignInButton>`, `<SignUp>`, `<UserButton>`,
> `openSignIn()`, the Clerk account portal, "Secured by Clerk") — we are
> deliberately removing them. Clerk stays as the **backend only** (auth,
> sessions, OAuth, user management) via its **headless hooks**
> (`useSignIn`, `useSignUp`, `useClerk`, `useUser`, `useAuth`, `useReverification`).

## Why

The default Clerk UI works functionally but is visually off-brand — it does not
use POLUTEK's typography, colours, `<Frame>` hand-drawn primitives, or
animations, and it exposes "Secured by Clerk". We want an interface where a user
cannot tell Clerk is involved.

## Architecture (unchanged)

Clerk remains responsible for: authentication, session management, OAuth
(Google + others), security, user management. We only replace the **presentation
layer** with headless-hook-driven components in our design system. No custom
auth backend.

Provider stays `app/components/ClerkLocalizationProvider.tsx` (`<ClerkProvider>`
+ localization + the sign-in/out refresh + language-sync logic). Keep it.

## Scope → phased plan

### Phase 1 — Custom auth modal (sign-in / sign-up / reset) — **DONE**
- `app/components/auth/AuthModal.tsx` — POLUTEK-styled modal built on
  `useSignIn` / `useSignUp`. Flows: email+password sign-in, Google OAuth,
  email+password sign-up with email-code verification, forgot/reset password
  (email code → new password). All error + success messages are ours, localized
  pl/en.
- `app/components/auth/AuthModalProvider.tsx` + `useAuthModal()` — context that
  any component calls to open the modal (`open('sign-in' | 'sign-up')`),
  replacing `openSignIn()` / `<SignInButton mode="modal">`.
- `app/sso-callback/page.tsx` — OAuth redirect landing (`<AuthenticateWithRedirectCallback>`).
- Wired into `Providers`; replaced call sites: Navbar, DonationBox,
  SubscribeButton, Hero, AccessLockOverlay, CommentComposer.

### Phase 2 — Custom user menu + account panel — **TODO**
- Replace `<UserButton>` in `app/components/Navbar.tsx` with our own avatar
  button + dropdown (patron ring styling preserved) and an "account" modal.
- Account panel sections (all via headless `useUser` / `user.update`, `useClerk`):
  profile (name, username), email address change + verification, connected
  accounts (Google) management, security (password change), sign out, delete
  account. Admin "Zarządzaj kanałem" link stays for admins.

### Phase 3 — Cleanup & guardrails — **TODO**
- Remove any remaining default Clerk UI imports across the app.
- Add a lightweight test that greps `app/` for forbidden Clerk UI symbols
  (`SignInButton`, `UserButton`, `openSignIn`, `SignUpButton`) so regressions
  are caught.
- Confirm no "Secured by Clerk" / Clerk branding renders anywhere.

## Invariants that must survive

- Clerk stays the source of truth for identity/sessions; the DB stays the source
  of truth for patron status (see CLAUDE.md §4.1). Do not couple auth UI to
  patron logic.
- Do **not** force a post-auth hard redirect to `/` (see the NOTE in
  `ClerkLocalizationProvider.tsx`: a forced nav to the PWA start_url makes the
  installed app "launch itself" on login). Let the existing
  `queryClient.clear()` + `router.refresh()` effect refresh session data
  in-place; the modal just closes on success.
- Language selection keeps working through `LanguageContext` (pl/en localization
  of all auth copy).
- Admins keep their `/admin` entry point from the account menu.

## Verification notes

The headless flows (email-code verification, OAuth redirect, password reset)
cannot be fully exercised without a live Clerk instance + real email, so each
phase must be smoke-tested against a real Clerk dev instance before it is
considered production-ready. Typecheck + unit tests only prove wiring, not the
end-to-end auth handshake.

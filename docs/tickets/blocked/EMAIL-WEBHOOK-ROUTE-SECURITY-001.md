# EMAIL-WEBHOOK-ROUTE-SECURITY-001 — Harden Resend webhook authentication and production contract

Status: **CONFIRMED_GAP**
Ticket ID: EMAIL-WEBHOOK-ROUTE-SECURITY-001
Security Classification: **CONFIRMED_SECURITY_GAP**
Launch impact: **BLOCKER**

## Purpose
Enforce strict Svix HMAC signature verification in production and ensure the environment contract is strictly validated.

## Verified Current Behavior
`app/api/webhooks/resend/route.ts` contains a fallback that allows `x-resend-webhook-secret` to bypass Svix verification if headers are missing, even in production, as long as the secret matches.

## Target Behavior
- Production REQUIRES Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`).
- Legacy fallback is restricted to `non-production` environments.
- Missing `RESEND_WEBHOOK_SECRET` in production triggers an immediate error in `env/validation.ts`.
- Malformed JSON returns a 400 response.

## Acceptance Criteria
- Svix verification failure in production returns 401.
- Missing Svix headers in production returns 401 (no legacy fallback).
- Production environment validation fails if secret is missing.

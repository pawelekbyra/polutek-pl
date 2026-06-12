# Ticket: production-healthcheck-hardening

## Status
Status: **READY**
Lane: Operations / Launch Readiness

## Context
The health check route at `/api/health` currently requires a `HEALTHCHECK_TOKEN` environment variable to expose detailed system information. This token needs to be generated, configured in production, and verified.

## Requirements
1. Generate a secure `HEALTHCHECK_TOKEN`.
2. Configure `HEALTHCHECK_TOKEN` in Vercel production environment.
3. Verify that `/api/health?token=...` returns detailed status in production.
4. Verify that unauthorized requests (wrong or missing token) do not leak sensitive env/content details.

## Definition of Done
- Detailed health check is accessible only with the correct token in production.
- Production evidence captured and redacted.

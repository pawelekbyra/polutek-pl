# EMAIL-WEBHOOK-FINAL-CERT-001 — Certify Resend webhook correctness after all repair tickets

Status: BLOCKED_BY_REPAIRS
Ticket ID: EMAIL-WEBHOOK-FINAL-CERT-001
Launch impact: LAUNCH_BLOCKER

## Purpose
- Ostateczna certyfikacja poprawności webhooków Resend po wykonaniu wszystkich napraw.

## Dependencies
- EMAIL-WEBHOOK-LOCK-OWNERSHIP-001
- EMAIL-WEBHOOK-TAKEOVER-INTEGRITY-001
- EMAIL-WEBHOOK-ROUTE-SECURITY-001
- EMAIL-WEBHOOK-ERROR-SAFETY-001
- EMAIL-WEBHOOK-PAYLOAD-VALIDATION-001
- EMAIL-WEBHOOK-MIGRATION-VERIFY-001
- ARCH-CI-001
- Counter semantics decision.
- Privacy/retention classification.

## Final Evidence Required
- Full green CI (z włączonymi testami integracyjnymi).
- PostgreSQL 16 fresh and upgrade proof.
- Real concurrency/fencing proof.
- Route security/signature proof.
- Error redaction proof.
- Counter ordering proof.
- Explicit Certifier verdict: MERGE_CERTIFIED.

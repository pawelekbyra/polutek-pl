# LAUNCH-LEGAL-002 — Publish owner-approved legal copy

## ID

LAUNCH-LEGAL-002

## Status

BLOCKED

## Lane

launch-ops

## Type

future implementation / legal-publication ticket

## Goal

Publish final owner-approved legal/privacy/terms/cookie/refund/support/community copy into the application only after the readiness blockers are resolved.

## Blocked on

This ticket must remain `BLOCKED` until all items below are completed and recorded in the repository:

- Completed owner questionnaire: `docs/operations/legal-owner-decision-questionnaire.md`.
- Final legal/privacy/terms/cookie/refund/support/community copy supplied or explicitly selected by the owner.
- Provider/data-processing inventory reviewed by the owner.
- Legal review decision recorded: professional legal review completed, or owner explicitly records a review path/waiver where appropriate.
- Publication locations confirmed, including footer, checkout/support/signup/login surfaces, and any cookie notice/preferences surfaces.
- Existing blocker `docs/tickets/blocked/LAUNCH-BLOCKED-001-owner-legal-privacy-terms-copy.md` updated by a future authorized task only if unblock evidence exists.

## Allowed future paths after unblock

A future owner-authorized implementation ticket may allow a focused subset of:

- `app/regulamin/page.tsx`
- `app/polityka-prywatnosci/page.tsx`
- a future cookie notice/page/component
- `app/components/Footer.tsx`
- checkout/support/signup/login disclosure components
- focused tests for legal links/disclosures where appropriate
- docs/reports reconciliation for the publication evidence

## Forbidden until unblock

- Do not publish legal copy from the readiness pack as final application copy.
- Do not invent controller identity, address, tax details, jurisdiction, governing law, age requirements, retention periods, refund rights, liability limits, statutory-right wording, or consent/legal-basis language.
- Do not mark public launch unblocked from this ticket alone.

## Required future validation

Future validation must be defined by the implementation ticket. At minimum it should include changed-path scope verification, route/link checks, and production evidence capture if publication proceeds.

## Relationship to LAUNCH-LEGAL-001

`LAUNCH-LEGAL-001` produced analysis, questions, draft structures, and a publication checklist. It did not approve or publish final legal copy.

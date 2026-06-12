# Legal/privacy/terms publication checklist

Status: BLOCKED until owner answers, final copy, provider inventory review, and legal review decision are recorded.

This checklist distinguishes content approval, implementation, and production evidence. It is not legal advice and does not mark any document approved or public-launch ready.

## A. Content approval readiness

| # | Item | Required evidence | Status |
| ---: | --- | --- | --- |
| 1 | Owner answers completed | `docs/operations/legal-owner-decision-questionnaire.md` filled with owner answers. | OWNER_DECISION_REQUIRED |
| 2 | Provider inventory verified | Owner-reviewed provider/data inventory with unknowns resolved or explicitly left as legal-review questions. | OWNER_DECISION_REQUIRED / LEGAL_REVIEW_REQUIRED |
| 3 | Legal review completed or explicitly waived by owner where appropriate | Repository evidence of legal review decision/path; no agent assumption. | LEGAL_REVIEW_REQUIRED |
| 4 | Final copy approved for publication | Owner-provided final terms, privacy, cookie, refund/support, and community copy. | OWNER_DECISION_REQUIRED |
| 5 | Routes defined | Exact public routes for terms, privacy, cookie notice/preferences, refund/support, contact/data requests, and community rules. | OWNER_DECISION_REQUIRED |
| 6 | Version and effective date | Document version/effective date supplied by owner/legal review. | OWNER_DECISION_REQUIRED / LEGAL_REVIEW_REQUIRED |
| 7 | Future review owner | Named person/role responsible for legal-copy maintenance. | OWNER_DECISION_REQUIRED |
| 8 | Review cadence | Owner-selected cadence and trigger events for reviewing legal copy. | OWNER_DECISION_REQUIRED |

## B. Implementation readiness

| # | Item | Required implementation evidence | Status |
| ---: | --- | --- | --- |
| 9 | Footer links | Footer includes legal/privacy/cookie/support/contact links after implementation ticket. | BLOCKED |
| 10 | Checkout disclosure | Payment/support UI links to final terms/privacy/refund/support copy before payment. | BLOCKED |
| 11 | Signup/login disclosure | Registration/login surfaces include required terms/privacy disclosures if required by final copy/legal review. | BLOCKED |
| 12 | Newsletter consent/unsubscribe | Newsletter/subscription UI and email templates disclose consent and unsubscribe without implying patron access. | BLOCKED |
| 13 | Cookie banner/preferences if required | Banner/preference mechanism exists only if owner/legal review requires it. | OWNER_DECISION_REQUIRED / LEGAL_REVIEW_REQUIRED |
| 14 | Support/refund contact | Public support/refund path exists and matches final copy. | OWNER_DECISION_REQUIRED / BLOCKED |
| 15 | Mobile readability | Legal pages/disclosures reviewed on representative mobile viewport. | BLOCKED |
| 16 | Accessibility | Legal pages/links/forms meet project accessibility expectations. | BLOCKED |
| 17 | Broken-link check | Internal/external links checked after implementation. | BLOCKED |
| 18 | Rollback procedure | Documented rollback for legal-copy deployment. | OWNER_DECISION_REQUIRED / BLOCKED |

## C. Production evidence readiness

| # | Item | Required production evidence | Status |
| ---: | --- | --- | --- |
| 19 | Production route verification | Terms/privacy/cookie/refund/support/community/contact routes load in production after deploy. | BLOCKED |
| 20 | Checkout/support/signup placement verified | Production screenshots/evidence show disclosures in required surfaces. | BLOCKED |
| 21 | Cookie/consent behavior verified | Production behavior matches final cookie/tracking decision and published copy. | BLOCKED |
| 22 | Newsletter unsubscribe verified | Production unsubscribe/preference path works and does not revoke PatronGrant. | BLOCKED |
| 23 | Screenshot/evidence capture | Screenshots or manual evidence stored in agreed evidence location. | BLOCKED |
| 24 | Future update process verified | Owner/reviewer can identify version, effective date, review owner, and next cadence. | BLOCKED |

## Publication gate

Final publication must not proceed until:

1. content approval evidence exists,
2. implementation ticket is authorized,
3. production evidence requirements are defined,
4. existing legal blocker is explicitly unblocked by owner-approved copy/publication instructions,
5. no document is described as legally compliant, counsel-approved, or launch-ready without signed evidence.

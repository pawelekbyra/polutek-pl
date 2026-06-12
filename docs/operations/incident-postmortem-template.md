# Incident Postmortem Template

**Incident ID:** [INC-YYYYMMDD-XXXX]
**Severity:** [SEV-0 / SEV-1 / SEV-2]
**Owner:** [Name]
**Date:** [YYYY-MM-DD]

## Summary
[One-paragraph summary of what happened, the impact, and the resolution.]

## Timeline (UTC)
- **HH:MM:** Incident detected via [Method].
- **HH:MM:** Response initiated by [Person].
- **HH:MM:** Root cause identified as [Cause].
- **HH:MM:** Containment achieved via [Action].
- **HH:MM:** Full recovery confirmed via [Verification].

## Impact
- **Affected Users:** [Approximate number or segment]
- **Affected Data:** [e.g., 5 missing PatronGrants, 1 leaked token identifier]
- **Service Downtime:** [Minutes/Hours]

## Root Cause
[Detailed technical explanation of why the incident occurred.]

## Containment & Recovery
[Steps taken to stop the bleeding and restore service.]

## Invariants Violated
- [x] [Invariant Name from AGENTS.md, e.g., "denied playback must emit no source"]
- [ ] [Other Invariant]

## Why Automated Checks Failed
[Explanation of why unit tests, CI, or health checks did not prevent this.]

## Corrective Actions
| Action Item | Owner | Deadline | Status |
| --- | --- | --- | --- |
| [e.g., Add negative test for X] | | | |
| [e.g., Automate reconciliation script] | | | |

## Evidence Links
[Links to redacted logs, screenshots, or dashboard views. **Redaction confirmed.**]

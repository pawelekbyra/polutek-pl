# AI Control Plane Staging Manifest

## 1. Purpose
This is a temporary staging folder for future activation. It contains converted and normalized documentation drafts, as well as newly generated operational templates and protocols.

## 2. Moved root draft files
The following root .txt files were moved into `_source-root-drafts/`:
- Active-Execution-Roadmap.txt
- agents.txt
- LANE-access.txt
- LANE-admin-cockpit.txt
- LANE-cleanup-legacy.txt
- LANE-comments.md.txt
- LANE-email-subscriptions.txt
- LANE-email-subscriptions (2).txt
- LANE-payments-patron.txt
- LANE-playback-player.txt
- LANE-video-provider.txt
- Parallel-Work-Matrix.txt
- Phase-Gates.txt
- README.txt

## 3. Missing root draft files
None. All expected files were found.

## 4. Generated markdown files
- README.md
- AGENTS.md
- docs/architecture/Product-Architecture-Blueprint.md
- docs/roadmap/Active-Execution-Roadmap.md
- docs/roadmap/Parallel-Work-Matrix.md
- docs/roadmap/Phase-Gates.md
- docs/roadmap/lanes/LANE-cleanup-legacy.md
- docs/roadmap/lanes/LANE-payments-patron.md
- docs/roadmap/lanes/LANE-access.md
- docs/roadmap/lanes/LANE-video-provider.md
- docs/roadmap/lanes/LANE-playback-player.md
- docs/roadmap/lanes/LANE-admin-cockpit.md
- docs/roadmap/lanes/LANE-comments.md
- docs/roadmap/lanes/LANE-email-subscriptions.md
- docs/tickets/README.md
- docs/reports/README.md
- docs/templates/TICKET_TEMPLATE.md
- docs/templates/PR_REPORT_TEMPLATE.md
- docs/templates/REVIEW_TEMPLATE.md
- docs/templates/CERTIFICATION_TEMPLATE.md
- docs/templates/RECONCILIATION_TEMPLATE.md
- docs/operations/Multi-Agent-Workflow.md
- docs/operations/Merge-Protocol.md
- docs/operations/Conflict-Prevention.md

## 5. Source mapping
- `README.md`: generated from `README.txt`
- `AGENTS.md`: generated from `agents.txt`
- `docs/architecture/Product-Architecture-Blueprint.md`: generated from `notatka`
- `docs/roadmap/*.md`: generated from corresponding `.txt` drafts
- `docs/roadmap/lanes/*.md`: generated from corresponding `.txt` drafts
- `docs/roadmap/lanes/LANE-email-subscriptions.md`: generated as merged/empty draft (sources were empty)
- All other files: generated as missing draft/template/protocol

## 6. Duplicate handling
- `LANE-email-subscriptions.txt` and `LANE-email-subscriptions (2).txt` were both found to be 0 bytes. A single empty `LANE-email-subscriptions.md` was created in the lanes directory.

## 7. Activation warning
**This staging folder is not the active source of truth yet.**
A later Integrator PR must copy reviewed files from staging into final repo paths.

## 8. Remaining activation steps
- Review staged files.
- Create Integrator PR to copy staged files into final paths.
- Replace or slim active README if approved.
- Reconcile docs/audit/roadmap.
- Create first ready tickets.
- Certify X0 control plane.

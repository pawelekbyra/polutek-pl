# AI Control Plane Staging Manifest

## 1. Purpose
This staging folder serves as a temporary, inactive environment for future AI control-plane activation. It contains converted documentation, operational protocols, and standardized templates.

## 2. Final Staged Structure
- `_source-root-drafts/`: Original source files moved from the root (if non-empty).
- `docs/architecture/`: Core architectural blueprints.
- `docs/roadmap/`: Strategic execution plans and lane definitions.
- `docs/tickets/`: Operational task management (ready, active, done, blocked).
- `docs/reports/`: Evidence of progress (PR reports, reviews, certifications).
- `docs/templates/`: Standardized documents for agents.
- `docs/operations/`: Rules of engagement and collaboration protocols.

## 3. Source Mapping
- `README.md`: Converted from root draft.
- `AGENTS.md`: Converted from root draft.
- `docs/architecture/Product-Architecture-Blueprint.md`: Converted from root `notatka`.
- `docs/roadmap/`: Converted from corresponding root `.txt` files.
- `docs/roadmap/lanes/`: Converted from corresponding root `.txt` files, or generated if source was missing/empty.

## 4. Files Copied from Root Drafts
All root `.txt` files were moved to `_source-root-drafts/`. Converted versions are in their respective `docs/` paths.

## 5. Files Generated as Missing/Fixed
- `docs/roadmap/lanes/LANE-email-subscriptions.md`: Regenerated with full content (sources were 0-byte duplicates).
- `docs/tickets/README.md`: Expanded with a detailed operational guide.
- `docs/reports/README.md`: Expanded with a detailed operational guide.
- All files in `docs/templates/`: Replaced with robust, specific versions.
- All files in `docs/operations/`: Expanded with detailed protocols and roles.

## 6. Removed Unnecessary Files
- `_tmp/ai-control-plane-staging/_source-root-drafts/LANE-email-subscriptions.txt`: Removed (0-byte duplicate).
- `_tmp/ai-control-plane-staging/_source-root-drafts/LANE-email-subscriptions (2).txt`: Removed (0-byte duplicate).

## 7. Activation Warning
**This staging folder is not the active source of truth yet.**
The control plane is currently in a "Staged" state. A later Integrator PR must move these files into their final repo paths to activate them.

## 8. Remaining Activation Steps
- Final human review of staged documentation.
- Integrator PR to copy/move files to root/docs/ etc.
- Deletion of `_tmp/` after successful activation.

## 9. Validation
- Staged markdown file count: 25.
- No empty `.md` files found.
- No accidental ChatGPT wrapper text detected.

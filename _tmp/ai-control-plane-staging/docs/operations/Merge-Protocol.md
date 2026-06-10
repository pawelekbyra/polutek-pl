# Merge Protocol

## Rules for Merging
- **Human Merges Only:** Only a human can perform the final merge into the `main` branch.
- **No Self-Certification:** A Builder agent cannot certify their own work or move their own ticket to `done/`.
- **Review Required:** Every PR must have a corresponding Review Report with a "MERGE" verdict.

## Merge Order
- Merges should be handled sequentially if they overlap.
- Critical infrastructure or schema changes must be merged and reconciled before dependent feature work proceeds.

## Conditions to Pause / Reject
- Failed architecture boundary checks.
- Vercel build failures.
- Unplanned changes to protected files.
- Conflicts with concurrent lanes.

## Documentation Staging PRs
- PRs that only modify files in `_tmp/` (like this cleanup) follow a simplified path but still require a review for accuracy and compliance with staging rules.

## Post-Merge Reconciliation
- Immediately after a merge, the Reconciler must check if the Roadmap, README, or any architecture guards need updating to reflect the new state.

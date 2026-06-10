# Reports & Evidence Guide

## Overview
Reports are the historical record of the project's evolution. They provide evidence of quality, compliance, and progress.

## Types of Reports
- **PR Reports (`pr-reports/`):** Written by the **Builder agent** for every Pull Request. It summarizes what was done and provides proof of validation.
- **Reviews (`reviews/`):** Written by the **Reviewer agent** or Human. It evaluates a PR against architectural and product standards.
- **Certification (`certification/`):** Written by the **Certifier** when a phase or lane reaches a significant milestone. It requires merged code, passed validation, and reconciled documentation.
- **Reconciliation (`reconciliation/`):** Written by the **Integrator/Reconciler** after a batch of merges. It ensures that the documentation (Roadmap, README, etc.) reflects the actual state of the codebase.

## Operational Rules
- **Evidence vs. Truth:** Report files are **evidence** of a process. They are not the source of truth by themselves. The code and the primary docs (README, Blueprint) are the truth.
- **PR Body:** While useful, the PR body is transient. Critical information must be captured in a persistent report file.
- **Reconciliation Timing:** Reconciliation should happen after every significant merge or batch of related PRs to prevent documentation rot.
- **Certification Requirements:** A phase cannot be marked as "Certified" until a Certification Report is filed, proving that all invariants are maintained and technical debt is managed.

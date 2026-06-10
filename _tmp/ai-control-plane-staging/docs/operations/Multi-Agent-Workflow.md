# Multi-Agent Workflow

## Roles
- **Human Owner:** The ultimate decision-maker and strategic director.
- **Planner:** An agent or human responsible for breaking goals into lanes and tickets.
- **Builder:** An agent responsible for executing a single ticket on a feature branch.
- **Reviewer:** An agent or human responsible for auditing a Builder's PR.
- **Integrator/Reconciler:** An agent or human who merges PRs and updates documentation/ticket status.
- **Certifier:** An agent or human who performs final validation on a completed phase.

## Process
1. **Batch Selection:** The Human Owner or Planner selects a set of related tickets from the `ready/` folder.
2. **Parallel Execution:** Multiple Builders can run in parallel, provided they are assigned tickets in different lanes or isolated domains.
3. **One Ticket Rule:** Each Builder agent is assigned exactly **one ticket** at a time to maintain focus and prevent scope creep.
4. **No Global Edits:** Builders are strictly forbidden from editing global documentation (README, AGENTS.md) unless explicitly required by their ticket.
5. **PR Review:** A Reviewer audits the PR against the ticket's goals and architecture rules.
6. **Integration:** After a successful review and merge, the Integrator moves tickets to `done/` and performs reconciliation.
7. **Certification:** Once a phase is complete, the Certifier runs full suite validation and files a Certification Report.

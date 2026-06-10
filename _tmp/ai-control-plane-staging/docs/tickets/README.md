# Ticket Management Guide

## Overview
Tickets are the **actual prompts** and instructions for Builder agents. They define the scope, constraints, and validation for a single unit of work.

## Tickets vs. Lane Files
- **Lane Files** are high-level guidance, strategic roadmaps, and domain-specific rules. They provide context but are not direct implementation commands.
- **Tickets** are granular, actionable, and specific. A Builder agent works on exactly **one ticket** at a time.

## Ticket Lifecycle
- **ready/**: Tickets that have been planned, reviewed, and are ready for execution.
- **active/**: Tickets currently assigned to and being worked on by an agent.
- **done/**: Completed tickets where the code has been merged and the work certified.
- **blocked/**: Tickets that cannot proceed. A blocked ticket **must** explain the blocker and the specific condition required to unblock it.

## Roles and Responsibilities
- **Human Owner / Planner:** Creates and approves tickets in the `ready/` folder.
- **Builder Agent:** Picks a ticket from `ready/`, moves it to `active/`, and executes the work. Builders **should not edit global docs** (README, AGENTS.md, etc.) unless the ticket explicitly requires it.
- **Integrator:** Moves the ticket from `active/` to `done/` (or `blocked/`) after the Pull Request is merged.

## Naming Conventions
Tickets should follow the pattern `[LANE_PREFIX]-[ID]`, e.g., `ES-001` for Email & Subscriptions or `AC-001` for Admin Cockpit.

## Required Ticket Metadata
Every ticket must include the following metadata in its header:

- **ID**: Unique ticket identifier.
- **Lane**: The lane this ticket belongs to.
- **Type**: e.g., Feature, Fix, Refactor, Documentation.
- **Parallel Safety**: Can this run with other agents?
- **Goal**: Clear statement of the desired outcome.
- **Allowed Files**: Strict list or pattern of files/directories that can be modified.
- **Forbidden Files**: Explicit list of files that must NOT be touched.
- **Conflicts with**: Other tickets or lanes that might overlap.
- **Validation**: Step-by-step instructions for verifying the work.
- **Definition of Done**: Specific criteria for completion.
- **Reporting Requirements**: What needs to be in the final report.

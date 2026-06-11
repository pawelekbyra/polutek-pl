# Ticket Management Guide

Status: STAGED ONLY — NIEAKTYWNE.

## Rule

```txt
one ticket = one agent task = one branch = one PR
```

## Ticket lifecycle

- `ready/` — approved tickets after activation.
- `active/` — assigned/in-progress tickets.
- `done/` — merged and reconciled tickets.
- `blocked/` — blocked tickets with unblock condition.

## Required metadata

Every ticket must include: ID, Status, Lane, Type, Goal, Scope, Allowed paths, Forbidden paths, Required changes, Validation, Definition of done, Expected PR report, Parallel safety.

## Staged tickets

Seed tickets in this folder use `Status: READY_AFTER_CONTROL_PLANE_ACTIVATION`. They are not active today.

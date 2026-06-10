# Review: [PR Link or ID]

- **PR**: [Link]
- **Ticket ID**: [ID]
- **Verdict**: [MERGE / FIX / REJECT / BLOCKED]

## Scope Check
- [ ] Did the agent stay within the `Allowed Files`?
- [ ] Were any `Forbidden Files` modified?

## Architecture Check
- [ ] Are modular boundaries respected?
- [ ] Is Prisma usage correct (no direct imports in routes)?

## Product Invariant Check
- [ ] Is "Subscription != Patron" maintained?
- [ ] Is "Payment is money / PatronGrant is access" respected?

## Security/Access Check
- [ ] Are access decisions server-side?
- [ ] Is sensitive data redacted?

## Tests/Validation Check
- [ ] Do provided test results look valid?
- [ ] Can the reviewer reproduce the validation?

## Parallel Safety Check
- [ ] Does this PR introduce conflicts with other active lanes?

## Files that should not have changed
- [List any files that were modified but were not in the ticket scope.]

## Required Fixes
1. [Fix 1]
2. [Fix 2]

## Merge Recommendation
[Final advice on whether to merge and what steps to take post-merge.]

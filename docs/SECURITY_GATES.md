# Security gates for private beta

Security scanning is a release gate for private beta. The repo-level quality commands are not enough by themselves; the hosting/GitHub environment must also enforce secret scanning and SAST before a release branch can be promoted.

## Required gates

- **GitHub secret scanning with push protection** must be enabled for this private repository/organization. Any finding must be triaged before merge or deployment.
- **GitHub CodeQL default setup** (or an equivalent organization-managed SAST job) must run on pull requests and the default branch for JavaScript/TypeScript.
- **Dependency audit** remains part of the in-repo security job/checklist via `npm audit --audit-level=high`.
- **Human review of security-sensitive diffs** is required for auth, payments, webhooks, media proxy, admin routes, and Prisma migrations.

## Release evidence to collect

For a beta release candidate, attach or link:

1. the latest passing secret scanning / push protection status,
2. the latest passing CodeQL/SAST run,
3. the latest dependency audit result,
4. notes for any accepted findings, including owner and expiration/review date.

If the organization runs SAST/secret scanning outside this repo, store the evidence link in the release notes and keep this document as the contract for what must be checked before beta promotion.

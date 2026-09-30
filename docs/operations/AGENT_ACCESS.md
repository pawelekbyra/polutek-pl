# Agent access to external services (local machine)

No secrets in this file. Last verified: 2026-09-30 (read-only checks only).

## Standing authorization from the owner

The owner runs Claude Code locally in bypass-permissions mode and wants agents to act without asking him each time. Using the credentials below, agents may, without asking first:

- Vercel: change environment variables, redeploy and promote deployments, manage domains of project `polutek.pl`.
- GitHub: open, update and merge PRs once CI is green (`gh pr merge --squash`).
- Cloudflare: edit DNS, rules, cache, SSL and R2/Stream settings in both zones (`pawelperfect.pl`, `pawelperfect.com`).
- Clerk: manage domains, instance settings, webhooks and users of the production instance.
- Resend: manage domains, webhooks and templates; send transactional/test mail.
- Stripe: manage settings, webhooks and payment methods (read and configure, see limits below).
- Google Workspace / Google Cloud: work through the service account and `gcloud` (see [GOOGLE_ACCESS.md](GOOGLE_ACCESS.md) for Google-specific limits).

Still owner-only (ask first, or give him the exact link to click):

- Spending money: plan upgrades, paid add-ons, domain purchases, billing changes, Stripe refunds/payouts.
- Passwords, 2FA, account recovery, creating or rotating personal login credentials.
- Deleting whole accounts, projects, Vercel projects, Cloudflare zones, Neon projects/branches with production data, or the production database.

Everything else follows CLAUDE.md: never print or commit secret values, keep changes small and reversible, record what you changed in the PR or the relevant doc.

## Where credentials live and how to load them

`%USERPROFILE%\.ai-secrets\` (outside the repo):

- `secrets.env`: `NAME=value` lines. Empty value = not provided.
- `google-ai-agent.json`: service-account key for Workspace (domain-wide delegation).
- `load-secrets.ps1`: loads `secrets.env` into the current PowerShell process.

Bash (the file has CRLF line endings, strip them):

```bash
set -a; . <(tr -d '\r' < "$USERPROFILE/.ai-secrets/secrets.env"); set +a
```

Never echo a value. When you must show one, mask it to the first 6 characters.

## What works (verified 2026-09-30)

| Service | Credential | Status | Can do |
|---|---|---|---|
| Vercel | `VERCEL_TOKEN` + `vercel` CLI logged in as `pawelperfect-5617` | works | Team `pawelperfect-5617s-projects`, project `polutek.pl`: read/write env (53 vars), deployments, domains (`pawelperfect.com`, `www.pawelperfect.com`, `pawelperfect.pl`, `www.pawelperfect.pl`). Also the Vercel MCP connector. |
| Cloudflare | `CLOUDFLARE_API_TOKEN` (account-owned `cfat_` token) + `CLOUDFLARE_ACCOUNT_ID` | works | Zone write on all account zones (DNS, settings, SSL, cache purge, rules, page rules, WAF, email routing), account-level R2, Stream, Workers, Pages, API tokens. Verify with the **account** endpoint; `/user/tokens/verify` says "Invalid" for account-owned tokens. Also the Cloudflare MCP connector (R2/KV/D1/Workers). |
| Clerk | `CLERK_SECRET_KEY` (live) | works | Backend API on the production instance; domain `pawelperfect.com` (`clerk.pawelperfect.com`, `accounts.pawelperfect.com`). |
| Resend | `RESEND_API_KEY` | **invalid** ("API key is invalid") | Use the Resend MCP connector instead: works, domain `pawelperfect.pl` verified (sending + receiving). `RESEND_WEBHOOK_SECRET` is set (only verifies incoming webhooks). |
| Stripe | `STRIPE_SECRET_KEY` | **empty** | Stripe MCP connector works on the live account "Paweł Perfect" (`livemode: true`). |
| Google Workspace | service account `ai-agent@pawelperfect-ai.iam.gserviceaccount.com` | works | Delegated as `hello@pawelperfect.pl`: `gmail.readonly`, `gmail.compose`. |
| Google Cloud | `gcloud` as `hello@pawelperfect.pl`, project `pawelperfect-ai` | **needs reauth** | Token refresh fails ("Reauthentication failed"). See gaps. |
| GitHub | `gh` logged in as `pawelekbyra` (keyring) | works | Scopes `repo`, `read:org`, `gist`: PRs, merges, issues, workflow runs. `GITHUB_TOKEN` in `secrets.env` is empty and not needed. |
| Neon | Neon MCP connector | works | Project `restless-glade-19830690` (NEON-krau, Postgres 17, free plan). `DATABASE_URL_UNPOOLED` in `secrets.env` is empty; use the connector or `vercel env pull`. |
| Browser | Claude in Chrome extension | connected | Fallback for consoles without an API. Can disconnect; prefer APIs. |

## Example commands

```bash
# Vercel: change an env var (value from stdin, never on the command line), then redeploy
printf '%s' "$NEW_VALUE" | vercel env add NAME production --force --scope pawelperfect-5617s-projects
vercel redeploy <deployment-url> --scope pawelperfect-5617s-projects
# after a NEXT_PUBLIC_* change, rebuild without build cache from the linked main checkout:
vercel deploy --prod --force --scope pawelperfect-5617s-projects

# Cloudflare DNS
CF=https://api.cloudflare.com/client/v4; H="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
curl -s -H "$H" "$CF/zones?name=pawelperfect.com"                                   # zone id
curl -s -H "$H" "$CF/zones/<zone_id>/dns_records?per_page=100"
curl -s -X POST -H "$H" -H 'content-type: application/json' "$CF/zones/<zone_id>/dns_records" \
  -d '{"type":"CNAME","name":"x","content":"cname.vercel-dns.com","proxied":false}'

# Clerk Backend API
curl -s -H "Authorization: Bearer $CLERK_SECRET_KEY" https://api.clerk.com/v1/domains

# Stripe (only once STRIPE_SECRET_KEY is set; otherwise use the Stripe MCP connector)
curl -s -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/webhook_endpoints

# GitHub
gh pr create --fill && gh pr checks --watch && gh pr merge --squash
```

Zone ids: `pawelperfect.pl` = `746be2887d179f7742171a605a9b797d`, `pawelperfect.com` = `02cb23af5c0000a110f6915b00bbb8ef`. Vercel ids: see [VERCEL_ACCESS.md](VERCEL_ACCESS.md).

## Gaps (what doesn't work yet and how the owner unlocks it)

1. **Resend API key invalid.** Resend → API Keys → create a "Full access" key → paste into `RESEND_API_KEY` in `secrets.env`. (The MCP connector covers most work until then.)
2. **Stripe secret key empty.** For direct API/CLI use: Stripe Dashboard → Developers → API keys → create a restricted key (webhooks, settings, read payments) → `STRIPE_SECRET_KEY`. The MCP connector works meanwhile.
3. **gcloud login expired.** An agent starts `gcloud auth login --update-adc` in the background and gives the owner the Google URL; he opens it and approves as `hello@` (steps in [GOOGLE_ACCESS.md](GOOGLE_ACCESS.md)).
4. **Stale Clerk publishable key in `secrets.env`.** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` there still encodes `clerk.pawelperfect.pl`, but the Clerk instance domain is now `pawelperfect.com`; a newer key sits in `.ai-secrets/pk_new.txt`. An agent can replace the value in `secrets.env` (local file, no owner click needed); Vercel's value is separate, check it via `/api/admin/health/clerk`.
5. **Workspace beyond Gmail.** The service account has only `gmail.readonly` and `gmail.compose`. Drive/Calendar/Admin Directory need scopes added in admin.google.com → Security → API controls → Domain-wide delegation (owner-only).
6. **`DATABASE_URL_UNPOOLED` / `GITHUB_TOKEN` empty.** Not needed: Neon MCP / `vercel env pull` and `gh` cover them.
7. **Claude Code classifier.** If a session runs in auto mode instead of bypass, env writes and prod redeploys may still be blocked; the owner can add allow rules in `%USERPROFILE%\.claude\settings.json` (agents must not add them).

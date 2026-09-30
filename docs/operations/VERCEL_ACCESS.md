# Vercel access for AI agents (local machine)

Durable how-to so any agent can manage Vercel for this project without re-discovering it. Contains **no secrets**; see CLAUDE.md §8.1 for where they live. Standing authorization and the cross-service capability table: [AGENT_ACCESS.md](AGENT_ACCESS.md).

## Fixed identifiers (not secrets)

- Team: `pawelperfect-5617s-projects` (id `team_sc16PptMTGc4ip47phctR79J`, Hobby plan)
- Project: `polutek.pl` (id `prj_e7YawXp53b22uIMsiyW2NkccZgMz`), production from `main` of `pawelekbyra/polutek-pl`
- Domains (2026-09-30): the app is served on `www.pawelperfect.com`. `pawelperfect.com` 301 → `www.pawelperfect.com`; `pawelperfect.pl` and `www.pawelperfect.pl` 308 → `www.pawelperfect.com` (path and query kept; project domain `redirect` + `redirectStatusCode`, set via `PATCH /v9/projects/<id>/domains/<name>`). A domain that another domain redirects to cannot itself redirect, so change a chain from the apex end first. DNS for both is on Cloudflare (zones `02cb23af5c0000a110f6915b00bbb8ef` .com, `746be2887d179f7742171a605a9b797d` .pl).
- Crons (daily, Hobby-compatible): `/api/cron/video-provider-jobs/reconcile`, `/prune-playback-sessions`, `/sync-public-thumbnails`. They authenticate with `CRON_SECRET`; without it every cron returns 401.

## Ways in, in order of preference

1. **Vercel connector tools** (`mcp__…__list_deployments`, `get_project`, `list_project_domains`, `filter_project_envs`, …). Work from any directory. Env values are encrypted/sensitive; do not decrypt without the owner's explicit request.
2. **Vercel CLI** (installed globally, v61+). Check with `vercel whoami`. Set `VERCEL_TELEMETRY_DISABLED=1`. If not logged in, run `vercel login` in the background writing to a file (`(timeout 120 vercel login --no-color > "$TEMP/vl.log" 2>&1 &)`), wait ~20s, read the log and give the owner the `https://vercel.com/oauth/device?user_code=…` URL to approve; the CLI cannot open a browser for them. Then link the checkout: `vercel link --yes --project polutek.pl --scope pawelperfect-5617s-projects`. `.vercel` and `.env*` are git-ignored and per-checkout.
3. **`VERCEL_TOKEN`** from `%USERPROFILE%\.ai-secrets\secrets.env` (load with `load-secrets.ps1`, pass as `--token`). May be empty; the owner creates it in the Vercel dashboard (Account Settings → Tokens) and pastes it into that file.

## Useful commands

`vercel env ls production`, `vercel crons ls`, `vercel crons run <path>`, `vercel logs`, `vercel inspect <url>`, `vercel domains inspect pawelperfect.pl`.

## Env changes and redeploys: standing permission

The owner has given agents standing permission to change env vars and redeploy production without asking (see [AGENT_ACCESS.md](AGENT_ACCESS.md)). Do it, then report what changed:

```bash
printf '%s' "$VALUE" | vercel env update NAME production --sensitive --yes --scope pawelperfect-5617s-projects --project polutek.pl
vercel ls polutek.pl --prod --scope pawelperfect-5617s-projects   # current prod URL
vercel redeploy <deployment-url> --scope pawelperfect-5617s-projects
```

Only if a session runs in auto mode (not bypass) can the permission classifier still refuse these. Then **do not work around it** with another tool or by splitting the command; tell the owner which action is blocked and let him run it in the dashboard or add an allow rule to `%USERPROFILE%\.claude\settings.json` (agents must never add such rules themselves).

## Gotchas

- `NEXT_PUBLIC_*` values are baked in at build: after changing one, redeploy **without** build cache.
- Hobby plan: crons run at most daily; functions storage was at its free limit at one point (preview builds from `claude/*` can fail).
- `NEXT_PUBLIC_R2_PUBLIC_HOST=thumbs.pawelperfect.pl` (Cloudflare R2 custom domain on bucket `polutek-thumbnails`) is what enables direct public thumbnails; see `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md`.

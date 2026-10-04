# Restore (serwerek backups)

Copy of this file on the server: `/opt/serwerek/backups/RESTORE.md`. Full runbook: `docs/operations/SERWEREK.md`, section 23.

## What exists

| Where | What | How long |
|---|---|---|
| `/opt/serwerek/backups` (server, root 600) | `pg-<container>-<ts>.sql.gz` (pg_dumpall), `configs-<ts>.tar.gz` (apps, docs, scripts, cron, our systemd units; no secrets), `pp-support-storage-<ts>.tar.gz` | 7 days |
| `/opt/serwerek/backups/pre-deploy-*.sql.gz` | `pg_dump` of the app database before every migration (deploy.sh) | last 10 |
| R2 bucket `serwerek-backups` | the same files **encrypted with age** (`*.age`) + `secrets-<ts>.tar.gz.age` (all env files, tunnel token, tokens) | 15 days (lifecycle); bucket lock 14 days: nobody can delete earlier |

The age private key is NOT on the server: owner's PC `%USERPROFILE%\.ai-secrets\age\serwerek-backups.agekey`
(keep a second copy offline, e.g. in a password manager). Public key: `AGE_RECIPIENT` in `/etc/serwerek/backup.env`.

## Restore the database on this server

    gunzip -c pg-polutek-db-1-<ts>.sql.gz | docker exec -i polutek-db-1 psql -U polutek postgres

Weekly proof that this works: `serwerek-restore-test.timer` (Sunday 03:30) restores the newest dump into a throwaway
container; result in `/var/lib/serwerek/restore-test-last` and `/var/log/serwerek/restore-test.log`.

## New server from R2

1. Base system, Docker, `rclone` >= 1.75 (official .deb, not the Ubuntu package: 1.60 fails against R2) and `age`.
2. R2 credentials (Cloudflare dashboard, R2, Manage API tokens; bucket `serwerek-backups`), then:

       export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
         RCLONE_CONFIG_R2_ACCESS_KEY_ID=... RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=... RCLONE_CONFIG_R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
       rclone copy R2:serwerek-backups ./restore --include "*<ts>*"

3. Bring the private key for a moment (never leave it on the server), decrypt, delete it:

       age -d -i serwerek-backups.agekey -o secrets.tar.gz restore/secrets-<ts>.tar.gz.age && tar xzf secrets.tar.gz -C /
       for f in restore/*.age; do age -d -i serwerek-backups.agekey -o "${f%.age}" "$f"; done
       shred -u serwerek-backups.agekey

4. `tar xzf configs-<ts>.tar.gz -C /`, `systemctl daemon-reload`, start the stacks (`docker compose up -d db` in each app dir),
   restore the dumps as above, then deploy the app (`deploy.sh`), tunnel (`cloudflared-serwerek`), timers.

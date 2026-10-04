/**
 * Static facts the panel cannot measure yet (phase 1): the scheduled jobs as defined in the repo,
 * domains and monthly costs as documented. Each list says where it comes from and as of when.
 * When the phase-0 collector starts writing `job_run`, RDAP and cost snapshots, these become defaults
 * for rows without data instead of the only source. Update together with deploy/serwerek/systemd/*.timer,
 * SERWEREK.md (sections 4 and 15) and STATUS.md.
 */
import type { CostFactDto, DomainFactDto } from "./types";

export const FACTS_AS_OF = "2026-10-04";

export type ScheduledJob = { name: string; kind: "timer" | "cron"; schedule: string; purpose: string };

/** 9 timers from deploy/serwerek/systemd + backup.sh and health.sh from the server crontab (SERWEREK.md §4). */
export const SCHEDULED_JOBS: ScheduledJob[] = [
  { name: "send-broadcasts", kind: "timer", schedule: "co minutę", purpose: "wysyła kolejkę rozsyłek e-mail" },
  { name: "stripe-reconciliation", kind: "timer", schedule: "co 15 min", purpose: "dopina wpłaty potwierdzone w Stripe, zamyka porzucone" },
  { name: "prune-unverified-accounts", kind: "timer", schedule: "codziennie 03:30 UTC", purpose: "usuwa niezweryfikowane konta starsze niż 7 dni" },
  { name: "prune-expired-auth", kind: "timer", schedule: "codziennie 03:45 UTC", purpose: "usuwa wygasłe sesje i tokeny z linków" },
  { name: "retention", kind: "timer", schedule: "codziennie 04:15 UTC", purpose: "czyści IP i dane przeglądarki starsze niż 90 dni" },
  { name: "abandon-stale-originals", kind: "timer", schedule: "codziennie 04:30 UTC", purpose: "porzuca niedokończone wgrywania oryginałów" },
  { name: "prune-playback-sessions", kind: "timer", schedule: "codziennie 05:00 UTC", purpose: "usuwa sesje odtwarzania bez obejrzenia (30 dni)" },
  { name: "purge-deleted-comments", kind: "timer", schedule: "codziennie 05:15 UTC", purpose: "kasuje treść komentarzy usuniętych przez autorów" },
  { name: "sync-public-thumbnails", kind: "timer", schedule: "codziennie 06:00 UTC", purpose: "synchronizuje publiczne miniatury w R2" },
  { name: "backup.sh", kind: "cron", schedule: "codziennie 02:30 (czas serwera)", purpose: "pg_dump wszystkich baz + konfiguracja, kopia w R2" },
  { name: "health.sh", kind: "cron", schedule: "co 5 min", purpose: "dysk, RAM, swap, usługi; alert e-mailem" },
];

export const DOMAIN_FACTS: DomainFactDto[] = [
  { name: "pawelperfect.com", kind: "domena (główna)", state: "ok", note: "strona, panel, wideo i poczta", source: "STATUS.md" },
  {
    name: "pawelperfect.pl",
    kind: "domena",
    state: "warn",
    note: "wygasła 3 paź 2026; do przywrócenia w home.pl do 2 lis 2026; nic nie może od niej zależeć",
    source: "STATUS.md, punkt 2",
  },
  { name: "*.pawelperfect.com", kind: "certyfikat", state: "ok", note: "Cloudflare Universal SSL, odnawiany automatycznie", source: "Cloudflare" },
];

export const COST_FACTS: CostFactDto[] = [
  { item: "Serwer Hetzner CPX22", monthly: "ok. 24,59 € z VAT", note: "stała; powiększenie przy starcie (decyzja właściciela)" },
  { item: "Cloudflare (Tunnel, Access, Workers, R2 do 10 GB)", monthly: "0 €", note: "plany darmowe; Workers Paid tylko za zgodą właściciela" },
  { item: "Resend (Free)", monthly: "0 €", note: "100 e-maili dziennie, 3000 miesięcznie" },
  { item: "Stripe", monthly: "prowizja od wpłat", note: "bez opłaty stałej" },
  { item: "Panel administratora", monthly: "0 €", note: "kontener na tym samym serwerze, limit 384 MB RAM" },
];

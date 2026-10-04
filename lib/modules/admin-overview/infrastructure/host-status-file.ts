/**
 * Host status file: the safe replacement for mounting docker.sock into the panel.
 * A small root job on the host (deploy/serwerek/admin/host-status.sh, systemd timer every minute) writes
 * one JSON file with container states, timer results and the newest backup; the panel container gets
 * that single directory read-only (`/host-status`). The panel can read it, never act on the host.
 * Missing, unreadable or malformed file = an explicit "no data" state, never zeros.
 * The phase-0 collector (pp-collector / job_run) may write the same file or replace it.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";

const isoOrNull = z.string().datetime({ offset: true }).nullable().optional().transform((v) => v ?? null);
const numOrNull = z.number().finite().nullable().optional().transform((v) => v ?? null);
const strOrNull = z.string().max(300).nullable().optional().transform((v) => v ?? null);

export const hostStatusSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  containers: z
    .array(
      z.object({
        name: z.string().max(120),
        state: z.string().max(40),
        health: strOrNull,
        memBytes: numOrNull,
        memLimitBytes: numOrNull,
        cpuPercent: numOrNull,
        restarts: numOrNull,
        image: strOrNull,
        startedAt: isoOrNull,
      }),
    )
    .max(100)
    .optional(),
  timers: z
    .array(
      z.object({
        name: z.string().max(120),
        lastRunAt: isoOrNull,
        lastResult: strOrNull,
        nextRunAt: isoOrNull,
      }),
    )
    .max(100)
    .optional(),
  backups: z
    .object({
      latestAt: isoOrNull,
      latestBytes: numOrNull,
      count: z.number().int().nonnegative(),
      offsite: strOrNull,
    })
    .optional(),
});

export type HostStatus = z.infer<typeof hostStatusSchema>;

export type HostStatusRead = { ok: true; status: HostStatus } | { ok: false; reason: string };

export const DEFAULT_HOST_STATUS_FILE = "/host-status/status.json";

export function parseHostStatus(raw: string): HostStatusRead {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Plik statusu hosta nie jest poprawnym JSON-em." };
  }
  const parsed = hostStatusSchema.safeParse(json);
  return parsed.success ? { ok: true, status: parsed.data } : { ok: false, reason: "Plik statusu hosta ma nieznany format (oczekiwana wersja 1)." };
}

export async function readHostStatus(path: string = process.env.ADMIN_HOST_STATUS_FILE || DEFAULT_HOST_STATUS_FILE): Promise<HostStatusRead> {
  try {
    const raw = await readFile(path, "utf8");
    if (raw.length > 512_000) return { ok: false, reason: "Plik statusu hosta jest za duży." };
    return parseHostStatus(raw);
  } catch {
    return { ok: false, reason: "Brak pliku statusu hosta (zadanie host-status nie jest włączone na serwerze)." };
  }
}

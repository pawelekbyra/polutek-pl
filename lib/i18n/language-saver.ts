import type { Locale } from "@/lib/i18n/routing";

/**
 * Saves a signed-in viewer's language choice on the account (PATCH /api/user/language) safely:
 *
 * - one request at a time, so an older answer can never land after a newer one (the last write wins
 *   on the server only because the client sends them in order);
 * - always ends on the latest choice: if it changed while a save was running, the newer one is sent next;
 * - a failed save is retried a few times with a pause, then reported (`onFailed`) and kept pending:
 *   it is sent again by `flush()` (connection back) or together with the next choice.
 *
 * Pure (no React, no fetch): the caller passes `save`, which must reject on any failure.
 */
export interface LanguageSaverOptions {
  save: (language: Locale) => Promise<void>;
  onSaved?: (language: Locale) => void;
  onFailed?: (language: Locale) => void;
  /** Pauses before each retry; the number of entries is the number of retries. */
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

export interface LanguageSaver {
  /** A new sign-in (or sign-out): `stored` is what the account holds now; anything pending is dropped. */
  reset(stored: Locale | null): void;
  /** The viewer chose `language`. No-op when the account already has it. */
  request(language: Locale): void;
  /** Sends a choice that is still pending (after a failure), e.g. when the connection is back. */
  flush(): void;
}

const DEFAULT_RETRY_DELAYS_MS = [1_000, 4_000] as const;

export function createLanguageSaver(options: LanguageSaverOptions): LanguageSaver {
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let stored: Locale | null = null;
  let wanted: Locale | null = null;
  let running = false;
  let epoch = 0;

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    const myEpoch = epoch;
    try {
      while (myEpoch === epoch && wanted !== null && wanted !== stored) {
        const value: Locale = wanted;
        let saved = false;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          try {
            await options.save(value);
            saved = true;
            break;
          } catch {
            if (myEpoch !== epoch || wanted !== value) break; // outdated: do not retry it
            if (attempt < delays.length) await sleep(delays[attempt]!);
            if (myEpoch !== epoch || wanted !== value) break; // chosen again during the pause
          }
        }
        if (myEpoch !== epoch) return;
        if (saved) {
          stored = value;
          options.onSaved?.(value);
        } else if (wanted === value) {
          options.onFailed?.(value);
          return; // stays pending until flush() or the next choice
        }
      }
    } finally {
      if (myEpoch === epoch) running = false;
    }
  }

  return {
    reset(known) {
      epoch += 1;
      running = false;
      stored = known;
      wanted = null;
    },
    request(language) {
      wanted = language;
      void run();
    },
    flush() {
      void run();
    },
  };
}

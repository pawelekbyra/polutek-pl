/**
 * Delivery results of our own Postfix, read from its log (docs/operations/MAIL-OWN-TRANSPORT.md). The lab domain
 * has no MX, so bounces never arrive as mail: the final result of every send is one `status=...` line.
 * Pure parsing and classification only; no I/O.
 */

export type PostfixDelivery = {
  /** Postfix queue id: the id the own transport returns from sendMail(). */
  queueId: string;
  to: string;
  status: "sent" | "deferred" | "bounced";
  dsn: string;
  detail: string;
  /** ISO timestamp from the log line, if present. */
  at: string | null;
};

const MAX_LINE = 2000;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)\s/;
const DELIVERY = /\bpostfix\/(?:smtp|lmtp|error)\[\d+\]:\s+([0-9A-Za-z]+):\s+to=<([^>]*)>,.*?\bdsn=(\d\.\d{1,3}\.\d{1,3}),\s+status=(sent|deferred|bounced)(?:\s+\((.*)\))?/;

export function parsePostfixLog(text: string): PostfixDelivery[] {
  const out: PostfixDelivery[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length > MAX_LINE) continue;
    const m = DELIVERY.exec(line);
    if (!m) continue;
    const to = m[2].trim().toLowerCase();
    if (!to.includes("@")) continue;
    out.push({
      queueId: m[1],
      to,
      status: m[4] as PostfixDelivery["status"],
      dsn: m[3],
      detail: (m[5] ?? "").slice(0, 300),
      at: TIMESTAMP.exec(line)?.[1] ?? null,
    });
  }
  return out;
}

/**
 * What a bounce says about the recipient:
 * - `address`: this address (or its domain) does not exist or is disabled; safe to stop mailing it.
 * - `block`: the receiving side refuses us (IP/domain reputation, policy, spam filter, rate limit). Says nothing about
 *   the address and must NEVER suppress it; it is a signal about our sending, so it raises an alert.
 * - `other`: anything else (mailbox full, message too large, ...): neither.
 */
export type BounceClass = "address" | "block" | "other";

const BLOCK_TEXT = /block|black ?list|spamhaus|barracuda|dnsbl|\brbl\b|reputation|rate.?limit|too many|spam|junk|policy|not authori[sz]ed|denied.*\b(ip|host|sender)\b|\b(ip|host|sender)\b.*denied/i;
const ADDRESS_DSN = new Set(["5.1.1", "5.1.2", "5.1.3", "5.1.6", "5.1.10", "5.2.1", "5.4.4"]);

export function classifyBounce(dsn: string, detail: string): BounceClass {
  if (dsn.startsWith("5.7.") || dsn.startsWith("4.7.") || BLOCK_TEXT.test(detail)) return "block";
  if (ADDRESS_DSN.has(dsn)) return "address";
  if (dsn === "5.4.1" && /recipient|user unknown|does not exist|no such/i.test(detail)) return "address";
  return "other";
}

/**
 * Cloudflare Email Worker: inbound support mail -> PP Support (self-hosted) + archive copy.
 *
 * Contract (docs/architecture/support-center.md):
 *  1. POST the raw RFC822 message to the PP Support Action Mailbox relay ingress
 *     (basic auth + Cloudflare Access service token, because the host sits behind Access).
 *  2. ALWAYS forward a copy to the archive address (verified destination), with the header
 *     X-Support-Ingest: ok | failed:<reason>, so a failed ingest still leaves the mail in the archive.
 *  3. Never bounce because PP Support is down: an Email Worker cannot send a temporary (4xx) failure,
 *     a reject would be permanent. The archive copy is the safety net; re-ingest is in the runbook.
 *
 * Bindings: SUPPORT_INGEST_URL, INGEST_PASSWORD (secret), ACCESS_CLIENT_ID,
 * ACCESS_CLIENT_SECRET (secret), ARCHIVE_TO.
 */
const MAX_RAW_BYTES = 25 * 1024 * 1024;

// Recipients that become PP Support conversations. Everything else that reaches the catch-all
// (guessed addresses, spam to random@...) is only forwarded to the archive, so the inbox stays clean.
// Replies to conversations arrive at reply+<uuid>@inbound.<domain> and the forward address at
// <uuid>@inbound.<domain>: any address on an `inbound.` subdomain is ingested.
const INGEST_LOCAL_PARTS = new Set(['support', 'hello']);

// PP Support matches a message to its inbox by the To/Cc addresses and the X-Original-To header
// (EmailChannelFinder). The inbox channel address is support@pawelperfect.com, so mail that arrived for
// hello@ or for the .pl aliases gets this header prepended; the stored message otherwise stays untouched.
export const CHANNEL_ADDRESS = 'support@pawelperfect.com';

export function withChannelHeader(raw) {
  const head = new TextEncoder().encode(`X-Original-To: ${CHANNEL_ADDRESS}
`);
  const body = new Uint8Array(raw);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, head.length);
  return out;
}

export function shouldIngest(to) {
  const at = String(to || '').toLowerCase().lastIndexOf('@');
  if (at < 1) return false;
  const local = String(to).toLowerCase().slice(0, at);
  const domain = String(to).toLowerCase().slice(at + 1);
  if (domain.startsWith('inbound.')) return true;
  return INGEST_LOCAL_PARTS.has(local);
}

async function ingest(env, raw) {
  const auth = 'Basic ' + btoa(`actionmailbox:${env.INGEST_PASSWORD}`);
  let last = 'no-attempt';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(env.SUPPORT_INGEST_URL, {
        method: 'POST',
        headers: {
          'content-type': 'message/rfc822',
          authorization: auth,
          'CF-Access-Client-Id': env.ACCESS_CLIENT_ID,
          'CF-Access-Client-Secret': env.ACCESS_CLIENT_SECRET,
        },
        body: raw,
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return 'ok';
      last = `http-${res.status}`;
      // 4xx other than 408/429 will not get better by retrying (bad credentials, malformed mail).
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break;
    } catch (e) {
      last = `error-${e && e.name ? e.name : 'unknown'}`;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return `failed:${last}`;
}

export default {
  async email(message, env) {
    let status;
    if (!shouldIngest(message.to)) {
      status = 'skipped:unlisted-recipient';
    } else if (message.rawSize > MAX_RAW_BYTES) {
      status = 'failed:too-large';
    } else {
      const raw = await new Response(message.raw).arrayBuffer();
      const domain = String(message.to || '').toLowerCase().split('@')[1] || '';
      status = await ingest(env, domain.startsWith('inbound.') ? raw : withChannelHeader(raw));
    }
    if (status.startsWith('failed')) console.error(`support-mail-ingest ${status} from=${message.from} to=${message.to}`);
    await message.forward(env.ARCHIVE_TO, new Headers({ 'X-Support-Ingest': status }));
  },
};

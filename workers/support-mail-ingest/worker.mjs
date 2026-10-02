/**
 * Cloudflare Email Worker: inbound support mail -> Chatwoot (self-hosted) + archive copy.
 *
 * Contract (docs/architecture/support-center.md):
 *  1. POST the raw RFC822 message to Chatwoot's Action Mailbox relay ingress
 *     (basic auth + Cloudflare Access service token, because the host sits behind Access).
 *  2. ALWAYS forward a copy to the archive address (verified destination), with the header
 *     X-Support-Ingest: ok | failed:<reason>, so a failed ingest still leaves the mail in the archive.
 *  3. Never bounce because Chatwoot is down: an Email Worker cannot send a temporary (4xx) failure,
 *     a reject would be permanent. The archive copy is the safety net; re-ingest is in the runbook.
 *
 * Bindings: CHATWOOT_INGEST_URL, CHATWOOT_INGEST_PASSWORD (secret), ACCESS_CLIENT_ID,
 * ACCESS_CLIENT_SECRET (secret), ARCHIVE_TO.
 */
const MAX_RAW_BYTES = 25 * 1024 * 1024;

async function ingest(env, raw) {
  const auth = 'Basic ' + btoa(`actionmailbox:${env.CHATWOOT_INGEST_PASSWORD}`);
  let last = 'no-attempt';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(env.CHATWOOT_INGEST_URL, {
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
    if (message.rawSize > MAX_RAW_BYTES) {
      status = 'failed:too-large';
    } else {
      const raw = await new Response(message.raw).arrayBuffer();
      status = await ingest(env, raw);
    }
    if (status !== 'ok') console.error(`support-mail-ingest ${status} from=${message.from} to=${message.to}`);
    await message.forward(env.ARCHIVE_TO, new Headers({ 'X-Support-Ingest': status }));
  },
};

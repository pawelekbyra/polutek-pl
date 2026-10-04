// Wykonawca działań PP Support NA SERWERZE. NIE uruchamiaj ręcznie: wysyła go lib.mjs (runSupportOperation):
//   ssh serwerek node --input-type=module - <parametry base64url>   (skrypt na stdin)
//
// Rozmawia wyłącznie z lokalnym API PP Support (http://127.0.0.1:3010) tokenem użytkownika „Agent AI” czytanym z
// pliku na serwerze (nigdy nie wypisywany). Operacje:
//   conversation.inspect  GET rozmowy i wiadomości (tylko odczyt)
//   conversation.note     POST wiadomości z private:true (notatka prywatna = szkic; klient jej NIE dostaje)
//   conversation.reply    POST wiadomości z private:false (wysyłka do klienta); przed wysłaniem sprawdza, że adres
//                         odbiorcy i odcisk treści są takie, jak w podglądzie zatwierdzonym przez właściciela
// Wynik: jedna linia `@@ops-result {json}` na stdout. Treść od klientów wychodzi stąd surowa, ale ucięta; oznaczanie
// jako niezaufanej robi lib.mjs na komputerze właściciela.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MARKER = '@@ops-result ';
const SUPPORT_API = 'http://127.0.0.1:3010';
const ACCOUNT = 1;
const TOKEN_FILE = '/opt/serwerek/secrets/pp-support-ai-agent.token';

function emit(result) {
  process.stdout.write(`\n${MARKER}${JSON.stringify(result)}\n`);
}

function cut(text, max) {
  if (typeof text !== 'string') return text ?? null;
  return text.length > max ? text.slice(0, max) : text;
}

function fingerprint(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex').slice(0, 12);
}

async function api(method, path, body) {
  const token = readFileSync(TOKEN_FILE, 'utf8').trim();
  const res = await fetch(`${SUPPORT_API}/api/v1/accounts/${ACCOUNT}${path}`, {
    method,
    headers: { api_access_token: token, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json };
}

async function loadConversation(id) {
  const conv = await api('GET', `/conversations/${id}`);
  if (conv.status === 404) return null;
  if (conv.status !== 200) throw new Error(`PP Support HTTP ${conv.status} dla rozmowy`);
  const msgs = await api('GET', `/conversations/${id}/messages`);
  const list = msgs.status === 200 ? (msgs.body?.payload ?? []) : [];
  const incoming = list.filter((m) => m.message_type === 0 && !m.private);
  const notes = list.filter((m) => m.private);
  const c = conv.body ?? {};
  const sender = c.meta?.sender ?? {};
  return {
    id: c.id ?? id,
    status: c.status ?? null,
    inboxId: c.inbox_id ?? null,
    senderName: cut(sender.name ?? null, 120),
    senderEmail: sender.email ?? null,
    subject: cut(c.additional_attributes?.mail_subject ?? null, 300),
    lastIncoming: incoming.length ? cut(String(incoming[incoming.length - 1].content ?? ''), 3000) : null,
    messagesCount: list.length,
    privateNotesCount: notes.length,
  };
}

function conversationId(params) {
  const id = Number(params.conversationId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('niepoprawny conversationId');
  return id;
}

function content(params) {
  const text = String(params.content ?? '');
  if (!text.trim() || text.length > 20000) throw new Error('pusta albo za długa treść');
  if (fingerprint(text) !== params.sha) throw new Error('odcisk treści nie zgadza się z przesłaną treścią');
  return text;
}

const OPS = {
  async 'conversation.inspect'(params) {
    const conversation = await loadConversation(conversationId(params));
    return { ok: true, conversation };
  },

  async 'conversation.note'(params) {
    const id = conversationId(params);
    const text = content(params);
    const before = await loadConversation(id);
    if (!before) return { ok: false, executed: false, error: 'Rozmowa nie istnieje.' };
    const res = await api('POST', `/conversations/${id}/messages`, { content: text, message_type: 'outgoing', private: true });
    const ok = res.status === 200 && res.body?.private === true;
    return { ok, executed: true, outcome: { code: ok ? 'OK' : `HTTP_${res.status}`, messageId: res.body?.id ?? null, private: res.body?.private ?? null } };
  },

  async 'conversation.reply'(params) {
    const id = conversationId(params);
    const text = content(params);
    const before = await loadConversation(id);
    if (!before) return { ok: false, executed: false, error: 'Rozmowa nie istnieje.' };
    const expected = String(params.expectEmail ?? '').toLowerCase();
    if (!before.senderEmail || before.senderEmail.toLowerCase() !== expected) {
      return { ok: false, executed: false, error: 'Adres odbiorcy rozmowy nie zgadza się z --to z podglądu. Nic nie wysłano.' };
    }
    const res = await api('POST', `/conversations/${id}/messages`, { content: text, message_type: 'outgoing', private: false });
    const ok = res.status === 200 && res.body?.private === false;
    return { ok, executed: true, outcome: { code: ok ? 'OK' : `HTTP_${res.status}`, messageId: res.body?.id ?? null, private: res.body?.private ?? null } };
  },
};

let params;
try {
  params = JSON.parse(Buffer.from(String(process.argv[2] ?? ''), 'base64url').toString('utf8'));
} catch {
  params = null;
}
if (!params || !OPS[params.op]) {
  emit({ ok: false, error: 'nieznana operacja albo nieczytelne parametry' });
} else {
  try {
    emit(await OPS[params.op](params));
  } catch (error) {
    emit({ ok: false, error: String(error?.message ?? error).slice(0, 300) });
  }
}

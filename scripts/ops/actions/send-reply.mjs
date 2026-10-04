#!/usr/bin/env node
// WYSYŁKA odpowiedzi do klienta z PP Support (wiadomość publiczna w rozmowie = e-mail do klienta).
// Domyślnie podgląd (nic nie wysyła): PEŁNY adres odbiorcy, temat, ostatnia wiadomość klienta (niezaufana) i PEŁNA treść
// odpowiedzi z odciskiem. Wysyłka wymaga --yes oraz --to=<adres> i --sha=<odcisk> dokładnie takich, jak w podglądzie,
// który właściciel zatwierdził w czacie: inna treść albo inny odbiorca = nic nie wychodzi.
//   node scripts/ops/actions/send-reply.mjs --conversation=<nr> --file=<plik z treścią>
//   node scripts/ops/actions/send-reply.mjs --conversation=<nr> --file=<plik> --to=<adres> --sha=<odcisk> --yes

import {
  OPERATOR_LABEL,
  assertNoSecrets,
  commandLine,
  contentFingerprint,
  conversationPreview,
  finishExecution,
  isAutomatedSender,
  isMainModule,
  isPlainEmail,
  loadSecretValues,
  makeResult,
  newOpId,
  parseSendArgs,
  recordExecution,
  runCli,
  runSupportOperation,
} from './lib.mjs';

export const HELP = `Wysyłka odpowiedzi do klienta z PP Support. Domyślnie podgląd (pełna treść i adresat), nic nie wysyła.
  node scripts/ops/actions/send-reply.mjs --conversation=<nr> --file=<plik.txt>
  node scripts/ops/actions/send-reply.mjs --conversation=<nr> --file=<plik.txt> --to=<adres> --sha=<odcisk> --yes
      wysyłka (tylko po zatwierdzeniu treści przez właściciela; --to i --sha z podglądu)
  --text="..."   zamiast --file
  --json         wynik jako JSON
Szkic bez wysyłki: draft-reply.mjs. Wykonuje: ${OPERATOR_LABEL}. Opis: docs/operations/DAILY-BRIEFING.md.`;

export async function sendAction({ opts, input }, deps = {}) {
  const runSupport = deps.runSupport ?? ((op, params) => runSupportOperation(op, params, { host: deps.host }));
  const record = deps.record ?? ((result) => recordExecution(result, { host: deps.host }));
  const action = 'support.send-reply';
  assertNoSecrets(input.text, deps.secretValues ?? loadSecretValues());
  const sha = contentFingerprint(input.text);
  const target = { conversation: input.conversationId, sha };

  const inspect = await runSupport('conversation.inspect', { conversationId: input.conversationId });
  if (!inspect.ok) return makeResult({ action, mode: opts.mode, ok: false, target, problems: [`Odczyt nieudany: ${inspect.error}`] });
  const conv = inspect.conversation;
  if (!conv) return makeResult({ action, mode: opts.mode, ok: false, target, problems: ['Rozmowa o tym numerze nie istnieje.'] });

  const recipient = conv.senderEmail ?? null;
  const problems = [];
  if (!recipient) problems.push('Rozmowa nie ma adresu e-mail odbiorcy.');
  else if (!isPlainEmail(recipient)) problems.push('Adres odbiorcy rozmowy wygląda nietypowo: wyślij ręcznie z panelu PP Support.');
  else if (isAutomatedSender(recipient)) problems.push('Odbiorca to adres automatyczny (no-reply, raporty, mailer-daemon): nie odpowiadam.');
  if (input.to && recipient && input.to.toLowerCase() !== recipient.toLowerCase()) problems.push('--to nie zgadza się z adresem odbiorcy tej rozmowy.');
  if (input.sha && input.sha !== sha) problems.push(`--sha=${input.sha} nie zgadza się z odciskiem tej treści (${sha}): treść zmieniła się od podglądu.`);

  const preview = {
    ODBIORCA: recipient ?? '(brak)',
    temat: conv.subject ? `Re: ${conversationPreview(conv).subject}` : '(bez tematu)',
    rozmowa: conversationPreview(conv, { revealEmail: true }),
    TREŚĆ_DO_WYSŁANIA: input.text,
    odcisk_treści: sha,
  };
  const checks = [
    { ok: Boolean(recipient), label: `odbiorca: ${recipient ?? 'brak'}` },
    { ok: !input.to || problems.every((p) => !p.startsWith('--to')), label: input.to ? `--to zgodne z odbiorcą rozmowy` : 'przy wykonaniu podaj --to (adres z podglądu)' },
    { ok: !input.sha || input.sha === sha, label: input.sha ? `--sha zgodne z treścią` : `przy wykonaniu podaj --sha=${sha}` },
  ];
  const effect = `e-mail do ${recipient ?? '?'} z treścią powyżej (wiadomość publiczna w rozmowie #${input.conversationId}); wysłanego maila NIE da się cofnąć`;

  if (opts.mode === 'dry-run') {
    const ok = problems.length === 0;
    const source = opts.values.file !== undefined ? `--file=${opts.values.file}` : `--text=${input.text}`;
    return makeResult({
      action, mode: 'dry-run', ok, target, preview, checks, problems, effect,
      next: ok ? commandLine('send-reply.mjs', [`--conversation=${input.conversationId}`, source, `--to=${recipient}`, `--sha=${sha}`, '--yes']) : null,
    });
  }

  if (problems.length) return makeResult({ action, mode: 'execute', ok: false, target, preview, checks, problems, executed: false });

  const opId = newOpId();
  const res = await runSupport('conversation.reply', { conversationId: input.conversationId, content: input.text, sha, expectEmail: input.to });
  return finishExecution({ action, opId, target, preview, checks, effect }, res, record);
}

export function sendCli(argv, deps) {
  return runCli({ argv, help: HELP, parse: (a) => parseSendArgs(a), execute: (parsed) => sendAction(parsed, { ...deps, host: parsed.opts.values.host }) });
}

if (isMainModule(import.meta.url)) {
  sendCli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

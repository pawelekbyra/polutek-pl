// Wspólny przebieg hide-comment.mjs i restore-comment.mjs (ukrycie / przywrócenie komentarza przez use case'y admina).

import {
  OPERATOR_LABEL,
  adminCandidatesNotes,
  commandLine,
  commentPreview,
  finishExecution,
  makeResult,
  newOpId,
  parseCommentArgs,
  planModeration,
  recordExecution,
  runAppOperation,
  runCli,
} from './lib.mjs';

const VERB = { hide: 'Ukrycie', restore: 'Przywrócenie' };
const SCRIPT = { hide: 'hide-comment.mjs', restore: 'restore-comment.mjs' };

export function helpText(action) {
  return `${VERB[action]} komentarza (use case ${action === 'hide' ? 'hideAdminComment' : 'restoreAdminComment'}, audyt). Domyślnie podgląd.
  node scripts/ops/actions/${SCRIPT[action]} --comment=<uuid> [--reason="..."]          podgląd (nic nie zmienia)
  node scripts/ops/actions/${SCRIPT[action]} --comment=<uuid> --reason="..." --yes      wykonanie (po zgodzie właściciela)
  --admin=<id>     konto admina właściciela, gdy jest więcej niż jedno
  --json           wynik jako JSON
Wykonuje: ${OPERATOR_LABEL}. Opis: docs/operations/DAILY-BRIEFING.md.`;
}

/**
 * @param {'hide'|'restore'} action
 * @param {{ opts: object, input: object }} parsed
 * @param {{ runApp?: Function, record?: Function, host?: string }} deps
 */
export async function commentAction(action, { opts, input }, deps = {}) {
  const runApp = deps.runApp ?? ((op, params) => runAppOperation(op, params, { host: deps.host }));
  const record = deps.record ?? ((result) => recordExecution(result, { host: deps.host }));
  const name = `comment.${action}`;
  const target = { comment: input.commentId };

  const inspect = await runApp('comment.inspect', { commentId: input.commentId, adminUserId: input.adminUserId });
  if (!inspect.ok) {
    return makeResult({ action: name, mode: opts.mode, ok: false, target, problems: [`Odczyt nieudany: ${inspect.error}`] });
  }
  if (!inspect.comment) {
    return makeResult({ action: name, mode: opts.mode, ok: false, target, problems: ['Komentarz o tym id nie istnieje.'] });
  }

  const plan = planModeration(action, inspect.comment.status);
  const policyAllows = inspect.policyAllows?.[action];
  const checks = [
    { ok: plan.allowed, label: plan.noop ? `komentarz już ma status ${plan.to} (nic do zrobienia)` : `przejście ${plan.from} -> ${plan.to} dozwolone przez CommentPolicy` },
    { ok: Boolean(inspect.admin), label: inspect.admin ? `aktor: konto admina właściciela ${inspect.admin.id}` : `konto admina: ${inspect.adminError}` },
    { ok: Boolean(input.reason), label: input.reason ? `powód: ${input.reason}` : 'brak --reason (wymagany do wykonania)' },
  ];
  const problems = [];
  if (!plan.allowed) problems.push(action === 'restore' && plan.from === 'DELETED' ? 'Usuniętego komentarza nie da się przywrócić.' : `Ze statusu ${plan.from} nie można wykonać tego działania.`);
  if (policyAllows !== undefined && policyAllows !== plan.allowed && !plan.noop) problems.push('Polityka aplikacji ocenia to przejście inaczej niż skrypt: nie wykonuję, zgłoś to.');
  if (!inspect.admin) problems.push(inspect.adminError);
  if (!input.reason) problems.push('Podaj --reason="..." (trafi do audytu).');
  const notes = adminCandidatesNotes(inspect);

  const preview = commentPreview(inspect.comment);
  const effect = plan.noop
    ? 'brak zmian (status już docelowy)'
    : !plan.allowed ? null : `status ${plan.from} -> ${plan.to}; wpisy audytu ${action === 'hide' ? 'COMMENT_HIDE' : 'COMMENT_RESTORE'} i OPERATOR_ACTION (wspólne requestId)`;

  if (opts.mode === 'dry-run') {
    const ok = problems.length === 0 && !plan.noop;
    return makeResult({
      action: name, mode: 'dry-run', ok, target, preview, checks, problems, effect, notes,
      next: ok ? commandLine(SCRIPT[action], [`--comment=${input.commentId}`, `--reason=${input.reason}`, input.adminUserId ?`--admin=${input.adminUserId}` : null, '--yes']) : null,
    });
  }

  if (problems.length || plan.noop) {
    return makeResult({ action: name, mode: 'execute', ok: false, target, preview, checks, problems: plan.noop ? ['Nic do zrobienia: status już docelowy.'] : problems, executed: false, notes });
  }

  const opId = newOpId();
  const res = await runApp(name, { commentId: input.commentId, reason: input.reason, opId, adminUserId: input.adminUserId });
  return finishExecution({ action: name, opId, target, preview, checks, effect, notes }, res, record);
}

export function commentCli(action, argv, deps) {
  return runCli({ argv, help: helpText(action), parse: parseCommentArgs, execute: (parsed) => commentAction(action, parsed, { ...deps, host: parsed.opts.values.host }) });
}

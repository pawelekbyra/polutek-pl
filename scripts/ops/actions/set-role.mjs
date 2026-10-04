#!/usr/bin/env node
// Nadanie albo zdjęcie roli ADMIN przez istniejący use case changeUserRoleAsAdmin (blokada „admin-roster”, nigdy
// ostatni admin, ADMIN tylko ze zweryfikowanym e-mailem, audyt ADMIN_USER_ROLE_CHANGED + OPERATOR_ACTION).
// Nie usuwa kont, zmienia tylko rolę. Domyślnie podgląd: konto, lista adminów teraz i po zmianie.
// Wykonanie z --yes WYŁĄCZNIE po wyraźnej zgodzie właściciela w czacie.
//   node scripts/ops/actions/set-role.mjs --user=<id> --role=USER --reason="..." [--yes] [--json]
// Wymóg świeżego logowania (< 10 min) sprawdza trasa HTTP panelu, nie use case: skrypt operatora nie ma sesji
// przeglądarki i działa jako audytowane narzędzie na polecenie właściciela (docs/operations/DAILY-BRIEFING.md).

import {
  OPERATOR_LABEL,
  accountLine,
  adminCandidatesNotes,
  commandLine,
  finishExecution,
  isMainModule,
  makeResult,
  newOpId,
  parseRoleArgs,
  planRoleChange,
  recordExecution,
  runAppOperation,
  runCli,
} from './lib.mjs';

export const HELP = `Zmiana roli konta (use case changeUserRoleAsAdmin, audyt). Domyślnie podgląd.
  node scripts/ops/actions/set-role.mjs --user=<id> --role=USER|ADMIN [--reason="..."]          podgląd
  node scripts/ops/actions/set-role.mjs --user=<id> --role=USER|ADMIN --reason="..." --yes      wykonanie (po zgodzie)
  --admin=<id>     konto admina właściciela, w imieniu którego działa operator (domyślnie OPS_ADMIN_USER_ID)
  --json           wynik jako JSON
Nie usuwa kont. Wykonuje: ${OPERATOR_LABEL}. Opis: docs/operations/DAILY-BRIEFING.md.`;

export async function setRoleAction({ opts, input }, deps = {}) {
  const runApp = deps.runApp ?? ((op, params) => runAppOperation(op, params, { host: deps.host }));
  const record = deps.record ?? ((result) => recordExecution(result, { host: deps.host }));
  const action = 'user.set-role';
  const target = { user: input.userId, role: input.role };

  const inspect = await runApp('user.inspect', { userId: input.userId, adminUserId: input.adminUserId });
  if (!inspect.ok) return makeResult({ action, mode: opts.mode, ok: false, target, problems: [`Odczyt nieudany: ${inspect.error}`] });

  const plan = planRoleChange({ user: inspect.user, admins: inspect.admins ?? [], actorId: inspect.admin?.id ?? null, role: input.role });
  const problems = [...plan.problems];
  if (!inspect.admin) problems.push(inspect.adminError);
  if (!input.reason) problems.push('Podaj --reason="..." (trafi do audytu).');
  const byId = new Map((inspect.admins ?? []).map((a) => [a.id, a]));
  if (inspect.user) byId.set(inspect.user.id, inspect.user);

  const preview = {
    konto: accountLine(inspect.user),
    rola_teraz: inspect.user?.role ?? '—',
    admini_teraz: (inspect.admins ?? []).map(accountLine),
    admini_po_zmianie: plan.adminsAfter.map((id) => accountLine(byId.get(id))),
    operator_działa_jako: inspect.admin ? inspect.admin.id : '—',
  };
  const checks = [
    { ok: plan.allowed, label: plan.noop ? `konto już ma rolę ${input.role} (nic do zrobienia)` : `zmiana ${plan.from ?? '?'} -> ${input.role} dozwolona` },
    { ok: Boolean(inspect.admin) && plan.adminsAfter.includes(inspect.admin?.id), label: inspect.admin ? `konto operatora ${inspect.admin.id} zostaje adminem` : `konto admina: ${inspect.adminError}` },
    { ok: plan.adminsAfter.length >= 1, label: `po zmianie adminów: ${plan.adminsAfter.length}` },
    { ok: Boolean(input.reason), label: input.reason ? `powód: ${input.reason}` : 'brak --reason (wymagany do wykonania)' },
  ];
  if (inspect.admin && !plan.adminsAfter.includes(inspect.admin.id)) problems.push('Po zmianie konto operatora nie byłoby adminem.');
  const effect = plan.allowed && !plan.noop
    ? `rola ${plan.from} -> ${input.role}; konto NIE jest usuwane ani wylogowywane (rola czytana z bazy przy każdym żądaniu); audyt ADMIN_USER_ROLE_CHANGED i OPERATOR_ACTION`
    : plan.noop ? 'brak zmian' : null;
  const notes = adminCandidatesNotes(inspect);

  if (opts.mode === 'dry-run') {
    const ok = problems.length === 0 && !plan.noop;
    return makeResult({
      action, mode: 'dry-run', ok, target, preview, checks, problems, effect, notes,
      next: ok ? commandLine('set-role.mjs', [`--user=${input.userId}`, `--role=${input.role}`, `--reason=${input.reason}`, input.adminUserId ? `--admin=${input.adminUserId}` : null, '--yes']) : null,
    });
  }

  if (problems.length || plan.noop) {
    return makeResult({ action, mode: 'execute', ok: false, target, preview, checks, problems: plan.noop ? ['Nic do zrobienia: konto już ma tę rolę.'] : problems, executed: false, notes });
  }

  const opId = newOpId();
  const res = await runApp(action, { userId: input.userId, role: input.role, reason: input.reason, opId, adminUserId: input.adminUserId });
  const result = await finishExecution({ action, opId, target, preview, checks, effect, notes }, res, record);
  if (Array.isArray(res.admins)) result.outcome = { ...(result.outcome ?? {}), admini_po: res.admins.map(accountLine) };
  return result;
}

export function setRoleCli(argv, deps) {
  return runCli({ argv, help: HELP, parse: parseRoleArgs, execute: (parsed) => setRoleAction(parsed, { ...deps, host: parsed.opts.values.host }) });
}

if (isMainModule(import.meta.url)) {
  setRoleCli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

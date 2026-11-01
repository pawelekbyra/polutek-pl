// Static inventory only. A guard name is a review hint, never proof of authorization.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
if (!fs.existsSync(path.join(root, 'prisma/schema.prisma'))) throw new Error('Run from the repository root');
function gitRead(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Git inventory failed (${error.code ?? 'unknown'}); check local process permissions and repository access.`);
  }
}
const files = gitRead(['ls-files', '-z']).split('\0').filter(Boolean).sort();
const auditRoot = 'docs/audit/2026-11-01-platform-research/';
const httpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const guardNames = /^(?:auth|currentUser|getAuth|getActorFromAuth|requireActorFromAuth|requireAdminActor|requireAdmin|requireStepUp|withStudio|resolveStudioSession|assertAuthorized|authorize|checkVideoAccess|verifyAccessRequest|rateLimit|checkCronAuth|verifyCronSecret|requireCronSecret|requireChannel|checkAdminCsrf|checkPanelCsrf)$/;
const result = {
  schema_version: 1,
  source_sha: gitRead(['rev-parse', 'HEAD']).trim(),
  application_baseline_sha: 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
  method: 'TypeScript AST for exported route methods, Server Actions, imports, calls and static process.env names; filesystem and schema declarations for other assets.',
  limitations: [
    'Static discovery is not a completed security or runtime review.',
    'Catch-all route methods do not enumerate every internal framework endpoint.',
    'Calls and guard hints are syntactic, not a call graph or proof that a guard runs on every path.',
    'Environment variable names accessed indirectly or through worker env bindings are not all enumerated.',
    'Filesystem page paths are normalized before middleware rewrites and localized aliases.',
    'Operator scripts, framework callbacks and external services need manual mapping beyond this inventory.'
  ],
  routes: [], server_actions: [], pages: [], layouts: [],
  modules: [], workers: [], services: [], timers: [], operator_actions: [],
  prisma_models: [], prisma_enums: [], migrations: [], environment_names: {}, parse_diagnostics: []
};

function lineOf(sf, node) { return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1; }
function exported(node) { return node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword); }
function bindingNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap(e => ts.isBindingElement(e) ? bindingNames(e.name) : []);
}
function directive(statements, value) {
  return statements.some(s => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === value);
}
function routePath(file, prefix, leaf) {
  const parts = file.slice(prefix.length).replace(new RegExp(`(?:^|/)${leaf}\\.[^.]+$`), '').split('/');
  return '/' + parts.filter(p => p && !(p.startsWith('(') && p.endsWith(')')) && !p.startsWith('@')).join('/');
}
function metadata(sf, node = sf) {
  const calls = new Set();
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const text = n.expression.getText(sf);
      if (text.length < 140) calls.add(text);
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return { calls: [...calls].sort(), guard_hints: [...calls].filter(n => guardNames.test(n)).sort(), review_status: 'NOT_REVIEWED' };
}

for (const file of files) {
  if (file.startsWith(auditRoot)) continue;
  if (file.startsWith('lib/modules/') && /^lib\/modules\/[^/]+\/index\.ts$/.test(file)) result.modules.push({ name: file.split('/')[2], file });
  if (file.startsWith('workers/') && file.endsWith('/worker.mjs')) result.workers.push({ name: file.split('/')[1], file });
  if (/^services\/[^/]+\/src\/main\.ts$/.test(file)) result.services.push({ name: file.split('/')[1], file });
  if (/^scripts\/ops\/actions\//.test(file) && /\.(?:ts|mjs|sh)$/.test(file)) result.operator_actions.push(file);
  if (/^prisma\/migrations\/[^/]+\/migration\.sql$/.test(file)) result.migrations.push(file);
  if (file.startsWith('deploy/') && file.endsWith('.timer')) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    result.timers.push({ file, schedules: [...text.matchAll(/^(On\w+)=(.*)$/gm)].map(m => ({ kind: m[1], value: m[2] })), unit: text.match(/^Unit=(.*)$/m)?.[1] ?? null });
  }
  if (!/\.(?:ts|tsx|mjs|js)$/.test(file) || file.startsWith('tests/') || file.startsWith('docs/')) continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  for (const d of sf.parseDiagnostics) result.parse_diagnostics.push({ file, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
  const imports = sf.statements.filter(ts.isImportDeclaration).map(s => s.moduleSpecifier.text);
  const worker = result.workers.find(w => w.file === file);
  if (worker) {
    const declaration = sf.statements.find(s => ts.isExportAssignment(s) && ts.isObjectLiteralExpression(s.expression));
    worker.handlers = declaration?.expression.properties.map(p => p.name?.getText(sf)).filter(Boolean) ?? [];
    worker.imports = imports;
  }
  const prefix = file.startsWith('apps/admin/app/') ? 'apps/admin/app/' : file.startsWith('app/') ? 'app/' : null;
  const surface = file.startsWith('apps/admin/') ? 'admin' : 'public_site';
  if (prefix && file.endsWith('/route.ts')) {
    const methods = [];
    for (const node of sf.statements) {
      if (ts.isFunctionDeclaration(node) && exported(node) && node.name && httpMethods.has(node.name.text)) methods.push({ method: node.name.text, line: lineOf(sf, node), ...metadata(sf, node) });
      if (ts.isVariableStatement(node) && exported(node)) {
        for (const declaration of node.declarationList.declarations) for (const name of bindingNames(declaration.name)) {
          if (httpMethods.has(name)) methods.push({ method: name, line: lineOf(sf, declaration), ...metadata(sf, declaration) });
        }
      }
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) if (httpMethods.has(element.name.text)) methods.push({ method: element.name.text, line: lineOf(sf, element), ...metadata(sf, node) });
      }
    }
    result.routes.push({ file, surface, path: routePath(file, prefix, 'route'), imports, methods });
  }
  if (prefix && file.endsWith('/page.tsx')) result.pages.push({ file, surface, path: routePath(file, prefix, 'page'), imports, ...metadata(sf) });
  if (prefix && file.endsWith('/layout.tsx')) result.layouts.push({ file, surface, imports, ...metadata(sf) });
  const serverFile = directive(sf.statements, 'use server');
  function actions(node) {
    if (ts.isFunctionDeclaration(node) && node.body && ((serverFile && exported(node)) || directive(node.body.statements, 'use server'))) {
      result.server_actions.push({ file, name: node.name?.text ?? '<anonymous>', line: lineOf(sf, node), imports, ...metadata(sf, node) });
    }
    if (serverFile && ts.isVariableStatement(node) && exported(node)) {
      for (const d of node.declarationList.declarations) if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
        for (const name of bindingNames(d.name)) result.server_actions.push({ file, name, line: lineOf(sf, d), imports, ...metadata(sf, d) });
      }
    }
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isBlock(node.body) && directive(node.body.statements, 'use server') && !serverFile) {
      const name = ts.isVariableDeclaration(node.parent) ? node.parent.name.getText(sf) : '<inline>';
      result.server_actions.push({ file, name, line: lineOf(sf, node), imports, ...metadata(sf, node) });
    }
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(sf) === 'process' && node.expression.name.text === 'env') {
      (result.environment_names[node.name.text] ??= new Set()).add(file);
    }
    if (ts.isElementAccessExpression(node) && node.expression.getText(sf) === 'process.env' && ts.isStringLiteral(node.argumentExpression)) {
      (result.environment_names[node.argumentExpression.text] ??= new Set()).add(file);
    }
    ts.forEachChild(node, actions);
  }
  actions(sf);
}
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
for (const m of schema.matchAll(/^(model|enum)\s+(\w+)\s*\{/gm)) {
  result[m[1] === 'model' ? 'prisma_models' : 'prisma_enums'].push({ name: m[2], line: schema.slice(0, m.index).split('\n').length });
}
result.environment_names = Object.fromEntries(Object.entries(result.environment_names).sort(([a], [b]) => a.localeCompare(b)).map(([name, paths]) => [name, [...paths].sort()]));
result.counts = Object.fromEntries(['routes', 'server_actions', 'pages', 'layouts', 'modules', 'workers', 'services', 'timers', 'operator_actions', 'prisma_models', 'prisma_enums', 'migrations'].map(k => [k, result[k].length]));
result.counts.route_methods = result.routes.reduce((n, r) => n + r.methods.length, 0);
result.counts.environment_names = Object.keys(result.environment_names).length;
const output = fileURLToPath(new URL('../evidence/system-map.json', import.meta.url));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ counts: result.counts, parse_diagnostics: result.parse_diagnostics }, null, 2));

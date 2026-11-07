/* Read-only static runtime-import SCC probe for the current lib/modules TypeScript sources. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = process.cwd();
const modulesRoot = path.join(root, 'lib/modules');
const files = [];

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
}

collect(modulesRoot);
files.sort();
const fileSet = new Set(files);
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  baseUrl: root,
  paths: { '@/*': ['./*'] },
};
const cache = ts.createModuleResolutionCache(root, (name) => name, options);
const graph = new Map(files.map((file) => [file, new Set()]));
const sourceHashes = {};
const parseDiagnostics = [];

function runtimeSpecifiers(sourceFile) {
  const values = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      values.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') values.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return values;
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  sourceHashes[file] = crypto.createHash('sha256').update(source).digest('hex');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  parseDiagnostics.push(...parsed.parseDiagnostics.map((diagnostic) => ({
    file,
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  })));
  const emitted = ts.transpileModule(source, { fileName: file, compilerOptions: options }).outputText;
  const runtimeFile = ts.createSourceFile(file, emitted, ts.ScriptTarget.Latest, true, kind);
  for (const specifier of runtimeSpecifiers(runtimeFile)) {
    const resolved = ts.resolveModuleName(specifier, path.join(root, file), options, ts.sys, cache).resolvedModule;
    if (!resolved) continue;
    const target = path.relative(root, resolved.resolvedFileName).split(path.sep).join('/');
    if (fileSet.has(target)) graph.get(file).add(target);
  }
}

let nextId = 0;
const ids = new Map();
const low = new Map();
const stack = [];
const onStack = new Set();
const cycles = [];

function visit(file) {
  ids.set(file, nextId);
  low.set(file, nextId++);
  stack.push(file);
  onStack.add(file);
  for (const target of graph.get(file)) {
    if (!ids.has(target)) {
      visit(target);
      low.set(file, Math.min(low.get(file), low.get(target)));
    } else if (onStack.has(target)) low.set(file, Math.min(low.get(file), ids.get(target)));
  }
  if (low.get(file) !== ids.get(file)) return;
  const component = [];
  let current;
  do {
    current = stack.pop();
    onStack.delete(current);
    component.push(current);
  } while (current !== file);
  if (component.length > 1 || graph.get(file).has(file)) cycles.push(component.sort());
}

for (const file of files) if (!ids.has(file)) visit(file);
const orderedCycles = cycles.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
const largestComponent = new Set(orderedCycles[0] ?? []);
let cycleWitness = [];
const active = new Map();
const done = new Set();
const walkCycle = (file, route) => {
  active.set(file, route.length);
  route.push(file);
  for (const target of graph.get(file)) {
    if (!largestComponent.has(target)) continue;
    if (active.has(target)) {
      cycleWitness = [...route.slice(active.get(target)), target];
      return true;
    }
    if (!done.has(target) && walkCycle(target, route)) return true;
  }
  route.pop();
  active.delete(file);
  done.add(file);
  return false;
};
for (const file of files) if (largestComponent.has(file) && !done.has(file) && walkCycle(file, [])) break;
const result = {
  date: new Date().toISOString(),
  method: 'TypeScript transpileModule ESNext output; static imports/re-exports and literal require only; TypeScript Bundler resolver; SCC over lib/modules files only.',
  scope: 'Current tracked and untracked .ts/.tsx source files below lib/modules, excluding .d.ts; node_modules internals, dynamic imports and computed imports are not followed.',
  files: files.length,
  parse_diagnostics: parseDiagnostics,
  file_cycles: orderedCycles,
  cycle_witness: cycleWitness,
  source_sha256: sourceHashes,
};
const target = process.argv[2];
if (target) fs.writeFileSync(path.resolve(root, target), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ files: result.files, parse_diagnostics: parseDiagnostics.length, file_cycle_count: cycles.length, largest_component_files: result.file_cycles[0]?.length ?? 0, cycle_witness: cycleWitness }));

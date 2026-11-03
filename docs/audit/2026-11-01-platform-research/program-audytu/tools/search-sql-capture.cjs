/* Research only: actual unchanged SQL builder, official Prisma SQL-template runtime.
 * No generated Prisma client, DB adapter, HTTP, or replacement installed in node_modules.
 * Captures SQL for local EXPLAIN, not whole search latency. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const ts = require('typescript');
const runtime = require('@prisma/client/runtime/library');
const root = process.cwd();
const base = path.join(root, 'docs/audit/2026-11-01-platform-research/program-audytu');
const inventory = Object.fromEntries(fs.readFileSync(path.join(base, 'INWENTARZ-PLIKOW.csv'), 'utf8').trim().split('\n').slice(1).map(line => {
  // Inventory fields contain no embedded commas in these source paths; verify below using git too.
  const values = line.split(',').map(x => x.replace(/^"|"$/g, ''));
  return [values[0], values[4]];
}));
const sources = {};
const cache = new Map();
const stubs = {
  '@prisma/client': { Prisma: { sql: runtime.sqltag, join: runtime.join, raw: runtime.raw, empty: runtime.empty } },
  '@/lib/prisma': { prisma: new Proxy({}, { get() { throw Error('DB boundary must not execute'); } }) },
  '@/lib/modules/video/infrastructure/video-content.service': { VideoContentService: {} },
};
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  if (hash !== inventory[relative]) throw Error('Baseline inventory changed: ' + relative);
  sources[relative] = hash;
  const loadedModule = { exports: {} }; cache.set(relative, loadedModule.exports);
  const localRequire = name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === 'crypto') return crypto;
    if (!name.startsWith('@/')) throw Error('Unexpected import: ' + name);
    return load(name.slice(2) + '.ts');
  };
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + js + '\n})', { filename: relative })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const search = load('lib/modules/video/application/public-search.service.ts');
const domain = load('lib/modules/video/domain/search-query.ts');
const now = new Date('2026-11-01T00:00:00Z');
const cases = [
  ['rare_fts', { q: 'uniquerare' }, 'fts'],
  ['common_fts', { q: 'popular' }, 'fts'],
  ['missing_fts', { q: 'missingword' }, 'fts'],
  ['substring_like', { q: 'dlewor' }, 'like'],
  ['missing_like', { q: 'missingword' }, 'like'],
  ['browse_newest', {}, 'fts'],
  ['browse_views', { sort: 'views' }, 'fts'],
  ['category_newest', { category: 'science', sort: 'newest' }, 'fts'],
].map(([id, raw, mode]) => {
  const params = domain.parsePublicSearchParams(raw);
  const sql = search.buildSearchSql({ params, viewer: { signedIn: false }, mode, cursor: null, channelIds: new Map(), now });
  return { id, raw, mode, text: sql.text, values: sql.values };
});
const clientHash = load('lib/modules/privacy/domain/client-hash.ts');
const ua = 'pp-loadtest/1';
const plain = crypto.createHash('sha256').update(ua).digest('hex');
const current = clientHash.hashClientValue(ua, { IP_HASH_SECRET: 'synthetic-research-key-no-production-secret' });
if (plain === current) throw Error('Expected distinct current HMAC and historical cleanup SHA');
const output = { date: '2026-11-01', actual_sources_sha256: sources, boundary: 'Official installed Prisma SQL template runtime only; DB/client/DTO not executed; channel token lookup excluded (empty ids); no full HTTP', cases,
  loadtest_cleanup_observation: { user_agent: ua, synthetic_key_only: true, cleanup_sha256: plain, current_hmac_sha256: current, match: false, finding: 'R11' } };
fs.writeFileSync(path.join(base, 'evidence/search-sql-capture.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ cases: cases.length, actual_modules: Object.keys(sources).length, cleanup_hash_match: false }));

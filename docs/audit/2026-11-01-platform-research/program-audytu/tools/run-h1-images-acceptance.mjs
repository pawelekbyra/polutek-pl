// Explicit Node 22 acceptance runner; never invokes deployment, merge or npm audit.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseWorkflowEnv } from '/workspace/polutek-pl/scripts/ops/local-ci-lib.mjs';

const root = '/workspace/polutek-pl';
const output = '/workspace/.cloud-setup/h1-images-final/acceptance';
const node = '/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin/node';
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
const sha256 = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const workflowEnv = parseWorkflowEnv(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
const env = { ...process.env, ...workflowEnv,
  PATH: path.dirname(node) + ':' + process.env.PATH,
  DATABASE_URL: process.env.DATABASE_URL, DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  ADMIN_DEV_FIXTURES: '0', ADMIN_DEV_BYPASS_AUTH: '0', ADMIN_DEV_BYPASS_ACCESS: '0',
  CI: 'true', NEXT_TELEMETRY_DISABLED: '1', FORCE_COLOR: '0', NO_COLOR: '1', CIRCLE_NODE_TOTAL: '5',
};
const report = {
  started_at: new Date().toISOString(), node: spawnSync(node, ['--version'], {encoding:'utf8'}).stdout.trim(),
  code_sha: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), base_main: git('merge-base', 'HEAD', 'origin/main'),
  clean_start: git('status', '--porcelain') === '',
  inputs: Object.fromEntries(['package.json','package-lock.json','prisma/schema.prisma','next.config.mjs',
    'apps/admin/next.config.mjs','tsconfig.json','tsconfig.typecheck.json','vitest.config.ts','vitest.postgres.config.ts','scripts/test-critical-path.mjs',
    'scripts/check-hotspots.ts','scripts/check-strict-escapes.ts','scripts/strict-escapes-baseline.jsonc',
    'deploy/serwerek/Dockerfile','deploy/serwerek/Dockerfile.admin','.dockerignore']
    .map(file => [file,sha256(file)])),
  environment: 'CI workflow synthetic values; owned local H1 DB; development fixtures/auth bypasses disabled; no production provider credentials',
  worker_budget: {vitest:2, postgres:1, next_workers:4}, checks:[],
  deliberately_unrun: [{check:'npm audit / audit-high / local-ci audit gate',reason:'Prior automatic approval rejected private dependency graph upload; not retried or bypassed.'},
    {check:'production deployment, merge, paid resources, real Stripe/R2/OAuth',reason:'Outside authorized H1 local verification scope.'}],
};
const save = () => writeFileSync(output + '/acceptance-run.json', JSON.stringify(report,null,2)+'\n');
save();
async function check(id, args, extra={}) {
  const started = Date.now();
  const result = await new Promise(resolve=>{
    const child=spawn(node,args,{cwd:root,env:{...env,...extra},stdio:['ignore','pipe','pipe']});
    let log='';
    child.stdout.on('data',chunk=>log+=chunk);
    child.stderr.on('data',chunk=>log+=chunk);
    child.on('error',error=>log+='\n'+error.message);
    child.on('close',(exit,signal)=>resolve({exit,signal,log}));
  });
  const filename=id+'-final.log';
  writeFileSync(output+'/'+filename,result.log);
  const item={id,exit:result.exit,signal:result.signal,seconds:Math.round((Date.now()-started)/1000),log:filename};
  const resultFile=output+'/'+id+'-final.json';
  if(existsSync(resultFile)) {
    const json=JSON.parse(readFileSync(resultFile,'utf8'));
    item.vitest={success:json.success,files:json.testResults.length,total:json.numTotalTests,passed:json.numPassedTests,
      failed:json.numFailedTests,pending:json.numPendingTests,todo:json.numTodoTests};
  }
  report.checks.push(item);save();
  process.stdout.write(`${id}: exit ${item.exit} (${item.seconds}s)${item.vitest?' '+JSON.stringify(item.vitest):''}\n`);
}
const vitest='node_modules/vitest/vitest.mjs';
await check('critical-path',['scripts/test-critical-path.mjs','--maxWorkers=2','--report-json='+output+'/critical-path-final.json']);
await check('unit',[vitest,'run','--maxWorkers=2','--reporter=json','--outputFile='+output+'/unit-final.json']);
await check('postgres',[vitest,'run','--config','vitest.postgres.config.ts','--maxWorkers=1','--reporter=json','--outputFile='+output+'/postgres-final.json']);
await check('architecture',['--import','tsx','scripts/check-architecture.ts']);
await check('typecheck',['node_modules/typescript/bin/tsc','-p','tsconfig.typecheck.json','--noEmit']);
await check('typecheck-all',['node_modules/typescript/bin/tsc','-p','tsconfig.json','--noEmit']);
await check('lint',['node_modules/eslint/bin/eslint.js','.']);
await check('hotspots',['--import','tsx','scripts/check-hotspots.ts']);
await check('strict-escapes',['--import','tsx','scripts/check-strict-escapes.ts']);
await check('env-production',['--import','tsx','scripts/validate-env.ts','--mode=production']);
await check('public-build',['node_modules/next/dist/bin/next','build'],{NEXT_OUTPUT:'standalone',APP_ENV:'production',NODE_ENV:'production'});
await check('admin-build',['node_modules/next/dist/bin/next','build','apps/admin'],{NEXT_OUTPUT:'standalone',APP_ENV:'production',NODE_ENV:'production'});
report.finished_at=new Date().toISOString();
report.clean_end=git('status','--porcelain')==='';
report.changed_paths=git('status','--porcelain');
report.all_executed_checks_passed=report.checks.every(item=>item.exit===0);
report.release_ready=false;
save();
process.exitCode=report.all_executed_checks_passed?0:1;

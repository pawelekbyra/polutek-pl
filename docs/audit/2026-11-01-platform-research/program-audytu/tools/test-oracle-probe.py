"""Diagnostic mutation probes of existing tests in disposable source copies.
Never edits application/tests in the repository, never substitutes an installed Prisma client.
Not a whole-project mutation score. A red baseline prevents conclusions about its mutations.
"""
import csv,hashlib,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu';NODE='/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin/node'
VITEST=ROOT/'node_modules/vitest/vitest.mjs';VITEST_VERSION=json.loads((ROOT/'node_modules/vitest/package.json').read_text())['version']
inventory={r['path']:r['sha256']for r in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())}
source_hashes={}
def read(p):
 s=(ROOT/p).read_text();h=hashlib.sha256((ROOT/p).read_bytes()).hexdigest();assert h==inventory[p];source_hashes[p]=h;return s
health=read('lib/api/health-token.ts');health_test=read('tests/unit/api/health-token.test.ts')
ops={p:read(p)for p in ['tests/unit/ops/serwerek-scripts.test.ts','scripts/serwerek/backup.sh','deploy/serwerek/deploy.sh','deploy/serwerek/deploy-admin.sh','scripts/ops/mergedeploy.sh']}
verify={p:read(p)for p in ['tests/unit/operations/verify-restored-database.test.ts','scripts/verify-restored-database.ts']}
cases=[
 ('health_baseline',{'lib/api/health-token.ts':health,'tests/unit/api/health-token.test.ts':health_test},None),
 ('health_wrong_equality_accepts',{'lib/api/health-token.ts':health.replace('return diff === 0;','return true;'),'tests/unit/api/health-token.test.ts':health_test},None),
 ('health_missing_token_accepts',{'lib/api/health-token.ts':health.replace('if (!expected || !provided) return false;','if (!expected || !provided) return true;'),'tests/unit/api/health-token.test.ts':health_test},None),
 ('health_plain_equality_same_boolean_semantics',{'lib/api/health-token.ts':health.replace('return constantTimeEqual(provided, expected);','return provided === expected;'),'tests/unit/api/health-token.test.ts':health_test},None),
 ('ops_static_baseline',ops,'serwerek scripts: static'),
 ('ops_static_deploy_early_success',{**ops,'deploy/serwerek/deploy.sh':ops['deploy/serwerek/deploy.sh'].replace('set -euo pipefail','exit 0 # SYNTHETIC MUTATION ONLY\nset -euo pipefail',1)},'serwerek scripts: static'),
 ('restore_helper_existing_test_baseline',verify,None),
 ('restore_helper_verification_body_disabled',{**verify,'scripts/verify-restored-database.ts':verify['scripts/verify-restored-database.ts'].replace('  try {\n    // A. Connectivity','  return; // SYNTHETIC MUTATION ONLY: all verification bypassed\n\n  try {\n    // A. Connectivity',1)},None)
]
observations=[]
for name,files,title in cases:
 with tempfile.TemporaryDirectory(prefix='audit-test-oracle-')as directory:
  r=Path(directory);(r/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
  (r/'package.json').write_text('{"name":"synthetic-test-oracle","type":"module"}\n')
  for p,s in files.items():(r/p).parent.mkdir(parents=True,exist_ok=True);(r/p).write_text(s)
  (r/'vitest.config.mjs').write_text("import {defineConfig} from 'vitest/config';export default defineConfig({root:"+json.dumps(str(r))+",test:{environment:'node',include:['tests/**/*.test.ts'],alias:{'@':"+json.dumps(str(r))+"}}});\n")
  args=[NODE,str(VITEST),'run','--config',str(r/'vitest.config.mjs'),'--maxWorkers=1','--reporter=json','--outputFile='+str(r/'result.json')]
  if title:args+=['-t',title]
  run=subprocess.run(args,cwd=r,env={'PATH':str(Path(NODE).parent)+':/usr/bin:/bin','CI':'true','TZ':'UTC'},capture_output=True,text=True,timeout=25)
  assert(r/'result.json').is_file(),(name,run.stdout[-1500:],run.stderr[-1500:])
  report=json.loads((r/'result.json').read_text());assert run.returncode in [0,1]
  # Preserve the runner's real output and flags; do not erase unhandled errors or skipped tests.
  artifact=BASE/'evidence'/('oracle-'+name+'.json');artifact.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  logpath=BASE/'evidence'/('oracle-'+name+'.log');logpath.write_text(run.stdout+run.stderr)
  observations.append({'case':name,'process_exit':run.returncode,'runner_success':report['success'],'registered':report['numTotalTests'],'passed_assertions':report['numPassedTests'],'failed_assertions':report['numFailedTests'],'pending_or_filtered':report['numPendingTests'],'unhandled_errors':report.get('numUnhandledErrors',None),'artifact':'evidence/'+artifact.name,'log':'evidence/'+logpath.name,'mutated_source_paths':[p for p,s in files.items()if p in inventory and hashlib.sha256(s.encode()).hexdigest()!=inventory[p]],'production_or_real_network_access':False})
obs={o['case']:o for o in observations}
assert obs['health_baseline']['process_exit']==0 and obs['health_baseline']['passed_assertions']==6
for n in ['health_wrong_equality_accepts','health_missing_token_accepts']:assert obs[n]['process_exit']==1 and obs[n]['failed_assertions']>0
assert obs['health_plain_equality_same_boolean_semantics']['process_exit']==0
for n in ['ops_static_baseline','ops_static_deploy_early_success']:assert obs[n]['process_exit']==0 and obs[n]['passed_assertions']==7 and obs[n]['pending_or_filtered']==17
for n in ['restore_helper_existing_test_baseline','restore_helper_verification_body_disabled']:assert obs[n]['process_exit']==0 and obs[n]['passed_assertions']==4
result={'date':'2026-11-02','method':f'Existing unchanged test files, actual Vitest {VITEST_VERSION}, temporary minimal node config and source/dependency symlink; no application working-tree mutation','actual_vitest_version':VITEST_VERSION,'source_sha256':source_hashes,'observations':observations,'full_project_mutation_score':None,'interpretation':['Health token wrong-accept mutations detected by existing six tests','Plain equality mutation preserves boolean outputs; surviving this probe does not demonstrate a timing exploit or weakness of actual unchanged comparator','Text-only static filter accepts a synthetic early-success deploy copy; full behavior suite was intentionally not run and cannot be declared blind','Existing restore-helper baseline is green; all four tests also pass with verification body disabled. They cover preflight logging/mocked exit/redaction, not completed DB checks.'],'real_app_DB_provider_or_production_access':False,'installed_Prismaclient_changed':False}
(BASE/'evidence/test-oracle-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'runs':len(observations),'outcomes':[{k:o[k]for k in ['case','process_exit','passed_assertions','failed_assertions','pending_or_filtered','unhandled_errors']}for o in observations]},ensure_ascii=False))

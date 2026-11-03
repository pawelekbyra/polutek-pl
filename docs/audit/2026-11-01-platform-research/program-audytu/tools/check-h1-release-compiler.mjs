// Genuine TypeScript, isolated control repository; partial reports are never release eligible.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { releaseControl } from '/workspace/polutek-pl/tests/fixtures/release-control.mjs';
import { sha256 } from '/workspace/polutek-pl/scripts/ops/release/source.mjs';
const root='/workspace/polutek-pl',out='/workspace/.cloud-setup/h1-release-core';
const baseline='9824bb0abba7ed3672935845dedc328ae94ad8ff';
const command=(program,args,cwd=root)=>{const r=spawnSync(program,args,{cwd,encoding:'utf8',timeout:30000});if(r.error)throw r.error;return r;};
const git=(...args)=>{const r=command('git',args);if(r.status!==0)throw new Error(r.stderr);return r.stdout;};
const code=git('rev-parse','HEAD').trim();if(git('status','--porcelain').trim())throw new Error('Expected clean source');
const f=releaseControl();
const result={code_sha:code,baseline_sha:baseline,control_only:true,real_compiler:true,application_acceptance:false,cases:[]};
try{
 for(const name of ['scripts/ops/local-ci-lib.mjs','scripts/ops/release/source.mjs','scripts/ops/release/policy.mjs','.github/workflows/ci.yml']){
  mkdirSync(path.dirname(path.join(f.repo,name)),{recursive:true});copyFileSync(path.join(root,name),path.join(f.repo,name));
 }
 mkdirSync(path.join(f.repo,'node_modules/.bin'),{recursive:true});
 symlinkSync(path.join(root,'node_modules/typescript'),path.join(f.repo,'node_modules/typescript'),'junction');
 mkdirSync(path.join(f.repo,'.next'));
 writeFileSync(path.join(f.repo,'.next/invalid.ts'),'const value: string = 42;\n');
 writeFileSync(path.join(f.repo,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,types:[],skipLibCheck:true},include:['.next/**/*.ts']}));
 for(const [phase,source,exit,status]of [['before',git('show',baseline+':scripts/ops/local-ci.mjs'),0,'PASS'],['after',readFileSync(root+'/scripts/ops/local-ci.mjs','utf8'),1,'FAIL']]){
  writeFileSync(path.join(f.repo,'scripts/ops/local-ci.mjs'),source);
  command('git',['add','.'],f.repo);
  const committed=command('git',['-c','user.name=Release Control','-c','user.email=control@example.invalid','commit','--quiet','-m',phase+' control'],f.repo);
  if(committed.status!==0)throw new Error(committed.stderr);
  const run=command(process.execPath,[path.join(f.repo,'scripts/ops/local-ci.mjs'),'--only=typecheck-all','--skip=prisma','--jobs=1'],f.repo);
  const report=JSON.parse(readFileSync(path.join(f.repo,'.claude/local-ci-last.json'),'utf8'));
  const log=readFileSync(path.join(f.repo,'.claude/local-ci-logs/typecheck-all.log'),'utf8');
  writeFileSync(out+'/compiler-'+phase+'.log',run.stdout+run.stderr);
  writeFileSync(out+'/compiler-'+phase+'-tsc.log',log);
  writeFileSync(out+'/compiler-'+phase+'-report.json',JSON.stringify(report,null,2)+'\n');
  const gate=report.results.find(g=>g.id==='typecheck-all');
  const observed={phase,exit:run.status,gate,runner_sha256:sha256(source),actual_TS2322:log.includes('TS2322'),actual_next_path:log.includes('.next/invalid.ts')};
  result.cases.push(observed);writeFileSync(out+'/compiler-regression-run.json',JSON.stringify(result,null,2)+'\n');
  if(run.status!==exit || gate.status!==status || !observed.actual_TS2322 || !observed.actual_next_path)throw new Error('Unexpected '+phase+' result');
 }
 result.all_expectations_passed=true;writeFileSync(out+'/compiler-regression-run.json',JSON.stringify(result,null,2)+'\n');
 console.log('Real compiler control: baseline ignored TS2322 and exited0; candidate rejects it and exits1.');
}finally{rmSync(f.directory,{recursive:true,force:true});}

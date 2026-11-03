/* Actual unchanged verification script in VM inside a child process per scenario.
 * Real process.exit, explicit query fixtures; no generated client/DB/network. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),ts=require('typescript'),{spawnSync}=require('child_process');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const file='scripts/verify-restored-database.ts',source=fs.readFileSync(path.join(root,file),'utf8');
const hash=crypto.createHash('sha256').update(source).digest('hex');
const hashes=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8')).source_sha256;
if(hash!==hashes[file])throw Error('Baseline changed');
const assert=(v,l)=>{if(!v)throw Error(l);};
function childScenario(mode){
 const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');
 const env={RESTORE_DATABASE_URL:'postgresql://synthetic.invalid/research-restored',DATABASE_URL:'postgresql://synthetic.invalid/research-main',ALLOW_RESTORE_VERIFICATION:'true'};
 if(mode==='missing_URL')delete env.RESTORE_DATABASE_URL;
 if(mode==='missing_opt_in')delete env.ALLOW_RESTORE_VERIFICATION;
 if(mode==='same_URL')env.RESTORE_DATABASE_URL=env.DATABASE_URL;
 if(mode==='count_failure_with_manifest'||mode==='manifest_mismatch')env.RESTORE_EXPECTED_MANIFEST_PATH='/synthetic/manifest.json';
 class ResearchPrisma{
  constructor(){emit({kind:'constructor'});for(const model of ['user','creator','video','videoAsset','payment','userPaymentTotal','patronGrant','stripeEvent','comment','commentReport','subscription','auditLog'])this[model]={count:async()=>{if(model==='payment'&&mode.startsWith('count_failure'))throw Error('Synthetic count failed');return 1;},findMany:async()=>model==='patronGrant'&&mode==='orphan_grant'?[{userId:'synthetic-missing-user',paymentId:null}]:[]};}
  async $connect(){}async $disconnect(){}
  async $queryRaw(q){if(q[0].includes('SELECT NOW()'))return[{now:new Date('2026-11-02T04:00:00Z')}];if(mode==='migration_query_failure')throw Error('Synthetic migration table query failed');if(mode==='unfinished_migration')return[{finished_at:null,rolled_back_at:null,logs:null}];if(mode==='failed_migration_logs')return[{finished_at:null,rolled_back_at:null,logs:'synthetic failure'}];return[];}
 }
 const context=vm.createContext({exports:{},require(name){if(name==='@prisma/client')return{PrismaClient:ResearchPrisma};if(name==='fs')return{readFileSync(p){assert(p==='/synthetic/manifest.json','Unexpected read');return JSON.stringify({counts:{Payment:mode==='manifest_mismatch'?99:1}});}};throw Error('Unexpected dependency '+name);},process:{env,exit(code){emit({kind:'exit',code});process.exit(code);}},console:Object.fromEntries(['log','error','warn'].map(level=>[level,(...a)=>emit({kind:'log',level,text:a.join(' ')})]))});
 const compiled=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 Promise.resolve(vm.runInContext(compiled,context,{filename:file})).catch(e=>{console.error(e);process.exitCode=2;});
}
if(process.argv[2]==='--child'){childScenario(process.argv[3]);}
else{
 const observations=[];
 for(const mode of ['missing_URL','missing_opt_in','same_URL','healthy','count_failure','count_failure_with_manifest','migration_query_failure','unfinished_migration','failed_migration_logs','manifest_mismatch','orphan_grant']){
  const run=spawnSync(process.execPath,[__filename,'--child',mode],{cwd:root,encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin'}});
  assert(!run.error&&!run.signal&&[0,1].includes(run.status),'Child execution '+mode+': '+run.stderr);
  const events=run.stdout.trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)),logs=events.filter(e=>e.kind==='log');
  const success=logs.some(r=>r.text.includes('VERIFICATION SUCCESSFUL'));
  const expected=['healthy','count_failure','count_failure_with_manifest','migration_query_failure','unfinished_migration'].includes(mode);
  assert(success===expected&&(run.status===0)===expected,'Unexpected outcome '+mode);
  const constructors=events.filter(e=>e.kind==='constructor').length;
  if(['missing_URL','missing_opt_in','same_URL'].includes(mode))assert(constructors===0,'Safety before constructor');
  observations.push({case:mode,script_exit:run.status,verification_success_message:success,synthetic_Prismaconstructor_calls:constructors,finding:['count_failure','count_failure_with_manifest','migration_query_failure','unfinished_migration'].includes(mode)?'R37':null,logs});
 }
 const result={date:'2026-11-02',actual_source:file,sha256:hash,observations,real_network_calls:0,real_DB_queries:0,installed_Prismaclient_modified:false,boundaries:['Actual unchanged verification script transpiled in VM inside a real subprocess per case; process.exit truly terminates it','Explicit constructor and per-query/model fixtures, not generated client or restored schema','Count failure witnesses a rejected count followed by successful later queries, not a claimed missing whole table','Optional manual helper, NOT weekly restore-test.sh; production usage unverified'],independent_review:'PENDING'};
 fs.writeFileSync(path.join(base,'evidence/restore-verifier-experiment.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({observations:observations.length,findings:['R37'],real_DB_queries:0}));
}

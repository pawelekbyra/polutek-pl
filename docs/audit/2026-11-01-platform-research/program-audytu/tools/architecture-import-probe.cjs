/* Actual unchanged pure helpers/AppContext/prisma wiring with a constructor probe.
 * PrismaClient is an explicit external-boundary stub in a fresh VM, never installed.
 * No engine, database query, HTTP, Next bundling or whole barrel evaluation. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript'),cp=require('child_process');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const graph=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8'));
const sourceHashes={};
function sandbox(){
  const constructors=[];const cache=new Map();
  const context=vm.createContext({process:{env:{NODE_ENV:'test'}},console});
  const PrismaClient=class PrismaClientConstructorProbe {constructor(options){constructors.push({log_options:options.log});this.researchProbeOnly=true;this.$transaction=async fn=>fn(this);}};
  function load(relative){
    if(cache.has(relative))return cache.get(relative).exports;
    const source=fs.readFileSync(path.join(root,relative),'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
    const baseline=graph.source_sha256[relative];
    const changedSinceBaseline=cp.spawnSync('git',['diff','--quiet','c397b9e548ca2c628e21457ac69d66e54b12ddbd','HEAD','--',relative]).status!==0||cp.spawnSync('git',['diff','--quiet','--',relative]).status!==0;
    if(baseline&&!changedSinceBaseline&&hash!==baseline)throw Error('Unexpected baseline change '+relative);
    sourceHashes[relative]=hash;
    const loadedModule={exports:{}};cache.set(relative,loadedModule);
    const requireLocal=name=>{
      if(name==='@prisma/client')return {PrismaClient};
      let next;
      if(name.startsWith('@/'))next=name.slice(2);
      else if(name.startsWith('.'))next=path.posix.normalize(path.posix.join(path.posix.dirname(relative),name));
      else throw Error('Unexpected external boundary: '+name);
      const resolved=[next+'.ts',next+'/index.ts',next].find(p=>fs.existsSync(path.join(root,p)));
      if(!resolved)throw Error('Unexpected local import: '+name);
      return load(resolved);
    };
    const output=ts.transpileModule(source,{fileName:relative,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    vm.runInContext('(function(require,module,exports){'+output+'\n})',context,{filename:relative})(requireLocal,loadedModule,loadedModule.exports);
    return loadedModule.exports;
  }
  return {load,constructors};
}
(async()=>{
const observations=[];
{
  const s=sandbox(),pure=s.load('lib/modules/video/pure.ts');
  if(typeof pure.compareSidebarItems!=='function'||s.constructors.length)throw Error('Narrow video pure entry constructed infrastructure');
  observations.push({case:'narrow_video_pure_entry_stays_in_domain',compare_sidebar_exported:true,prisma_constructor_calls:0});
}
{
  const s=sandbox(),v=s.load('lib/modules/video/domain/video-visibility.ts');
  const results=[v.isListedStatus('PUBLISHED'),v.isListedStatus('UNLISTED'),v.isLinkAccessibleStatus('UNLISTED'),v.isAdultVideo({moderationStatus:'AGE_RESTRICTED'})];
  if(JSON.stringify(results)!=='[true,false,true,true]'||s.constructors.length)throw Error('Pure helper control');
  observations.push({case:'direct_pure_visibility_helper',results,prisma_constructor_calls:0});
}
{
  const s=sandbox(),a=s.load('lib/modules/authz/index.ts');
  if(!a.CHANNEL_ROLES.includes('OWNER')||s.constructors.length)throw Error('Authz barrel control');
  observations.push({case:'authz_public_index_remains_isolated',owner_role_present:true,authorize_function_exported:typeof a.authorize==='function',prisma_constructor_calls:0});
}
{
  const s=sandbox(),a=s.load('lib/modules/shared/app-context.ts');
  const atImport=s.constructors.length;
  const injected={researchInjectedDb:true};
  const c=a.createAppContext({actor:{type:'user',userId:'synthetic-user'},prisma:injected,now:()=>new Date('2026-11-01T00:00:00Z')});
  if(atImport!==0||c.prisma!==injected||s.constructors.length!==0)throw Error('Injected context must not create the default Prisma client');
  observations.push({case:'context_import_and_injected_db_do_not_create_default_client',prisma_constructor_calls_at_import:atImport,prisma_constructor_calls_after_injection:s.constructors.length,injected_db_preserved:true,real_database_queries:0});
  const defaultContext=a.createAppContext();
  if(defaultContext.actor.type!=='guest'||s.constructors.length!==0)throw Error('Default context should remain lazy before its first DB operation');
  const transactionDb=await defaultContext.db.writeTransaction(async tx=>tx);
  if(!transactionDb.researchProbeOnly||s.constructors.length!==1)throw Error('Production context did not lazily construct and use the default client');
  observations.push({case:'default_context_lazily_constructs_client_for_transaction',default_actor:'guest',prisma_constructor_calls_before_transaction:0,prisma_constructor_calls_after_transaction:s.constructors.length,client_used_by_transaction:true,real_database_queries:0});
}
const result={date:'2026-11-06',repository_head_sha:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),actual_source_sha256:sourceHashes,observations,
  boundaries:['PrismaClient is a constructor probe supplied to VM only; no generated client or network','No Next/SWC optimization, production DB query, or full public video/channel barrel execution','The selected video→channel→layout→video-barrel cycle is broken through the pure entry; unrelated cycles remain','Does not measure bundle size, request latency or production outage','No authorization result claimed from mere import of authz module']};
fs.writeFileSync(path.join(base,'evidence/architecture-import-probe.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({observations:observations.length,actual_source_files:Object.keys(sourceHashes).length,constructor_calls_after_injected_context:0,constructor_calls_after_default_transaction:1}));
})().catch(error=>{console.error(error);process.exitCode=1;});

/* Actual unchanged pure helpers/AppContext/prisma wiring with a constructor probe.
 * PrismaClient is an explicit external-boundary stub in a fresh VM, never installed.
 * No engine, database query, HTTP, Next bundling or whole barrel evaluation. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const graph=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8'));
const sourceHashes={};
function sandbox(){
  const constructors=[];const cache=new Map();
  const context=vm.createContext({process:{env:{NODE_ENV:'test'}},console});
  const PrismaClient=class PrismaClientConstructorProbe {constructor(options){constructors.push({log_options:options.log});this.researchProbeOnly=true;}};
  function load(relative){
    if(cache.has(relative))return cache.get(relative).exports;
    const source=fs.readFileSync(path.join(root,relative),'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
    if(hash!==graph.source_sha256[relative])throw Error('Baseline changed '+relative);sourceHashes[relative]=hash;
    const loadedModule={exports:{}};cache.set(relative,loadedModule);
    const requireLocal=name=>{
      if(name==='@prisma/client')return {PrismaClient};
      let next;
      if(name.startsWith('@/'))next=name.slice(2);
      else if(name.startsWith('.'))next=path.posix.normalize(path.posix.join(path.posix.dirname(relative),name));
      else throw Error('Unexpected external boundary: '+name);
      const resolved=[next+'.ts',next+'/index.ts',next].find(p=>Object.hasOwn(graph.source_sha256,p));
      if(!resolved)throw Error('Unexpected local import: '+name);
      return load(resolved);
    };
    const output=ts.transpileModule(source,{fileName:relative,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    vm.runInContext('(function(require,module,exports){'+output+'\n})',context,{filename:relative})(requireLocal,loadedModule,loadedModule.exports);
    return loadedModule.exports;
  }
  return {load,constructors};
}
const observations=[];
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
  if(atImport!==1||c.prisma!==injected||s.constructors.length!==1)throw Error('Context injection observation');
  observations.push({case:'context_import_initializes_default_before_injection',prisma_constructor_calls_before_createContext:atImport,prisma_constructor_calls_after_injection:s.constructors.length,injected_db_preserved:true,real_database_queries:0});
  const defaultContext=a.createAppContext();
  if(!defaultContext.prisma.researchProbeOnly||defaultContext.actor.type!=='guest')throw Error('Default context control');
  observations.push({case:'default_context_reuses_singleton_probe',default_actor:'guest',reuses_import_time_client:true,prisma_constructor_calls:s.constructors.length,real_database_queries:0});
}
const result={date:'2026-11-01',actual_source_sha256:sourceHashes,observations,
  boundaries:['PrismaClient is a constructor probe supplied to VM only; no generated client or network','No Next/SWC optimization or full public video/channel barrel execution','Does not measure bundle size, request latency or production outage','No authorization result claimed from mere import of authz module']};
fs.writeFileSync(path.join(base,'evidence/architecture-import-probe.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({observations:observations.length,actual_source_files:Object.keys(sourceHashes).length,constructor_observation:1}));

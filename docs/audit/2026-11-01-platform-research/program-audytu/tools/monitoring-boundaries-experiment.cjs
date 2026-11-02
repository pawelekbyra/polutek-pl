/* Actual health/probe/encoder-summary/logger functions, explicit DB/channel facts.
 * No generated Prisma, Next HTTP, services, credentials or real messages/network. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'evidence/architecture-graph.json'),'utf8')).source_sha256;
const sources={},cache=new Map(),logs=[];
const schema=fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
const enumText=schema.match(/enum VideoStatus\s*\{([\s\S]*?)\}/)[1];
const VideoStatus=Object.fromEntries(enumText.split('\n').map(x=>x.trim()).filter(x=>/^[A-Z_]+$/.test(x)).map(x=>[x,x]));
const syntheticEnv={NODE_ENV:'production',HEALTHCHECK_TOKEN:'synthetic-health-token-not-live',ALLOWED_MEDIA_HOSTS:'public.example.invalid'};
const context=vm.createContext({process:{env:syntheticEnv},Date,URL,Headers,Response,Request,TextEncoder,AbortController,setTimeout,clearTimeout,Error,
 console:Object.fromEntries(['error','warn','info','debug','log'].map(level=>[level,(...args)=>logs.push({level,args})]))});
let mainChannel={id:'synthetic-main',status:'ACTIVE',deletedAt:null};
function load(relative){
 if(cache.has(relative))return cache.get(relative).exports;
 const source=fs.readFileSync(path.join(root,relative),'utf8'),hash=crypto.createHash('sha256').update(source).digest('hex');
 if(hash!==inventory[relative])throw Error('Baseline changed '+relative);sources[relative]=hash;
 const record={exports:{}};cache.set(relative,record);
 const requireLocal=name=>{
  if(name==='@prisma/client')return{VideoStatus};
  if(name==='@/lib/modules/media')return load('lib/modules/media/domain/media.policy.ts');
  if(name==='@/lib/modules/channel')return{...load('lib/modules/channel/domain/channel.policy.ts'),MainChannelService:{getOptional:async()=>mainChannel}};
  if(name.startsWith('node:'))return require(name);
  const next=name.startsWith('@/')?name.slice(2):name.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(relative),name)):null;
  if(!next)throw Error('Unexpected dependency '+name);
  const resolved=[next+'.ts',next+'/index.ts',next].find(p=>inventory[p]);if(!resolved)throw Error('Unresolved '+name);
  return load(resolved);
 };
 const compiled=ts.transpileModule(source,{fileName:relative,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 vm.runInContext('(function(require,module,exports){'+compiled+'\n})',context,{filename:relative})(requireLocal,record,record.exports);
 return record.exports;
}
const assert=(v,label)=>{if(!v)throw Error(label);};
(async()=>{
 const health=load('lib/modules/health/application/check-health.use-case.ts');
 const probes=load('lib/modules/admin-overview/infrastructure/probes.ts');
 const checks=load('lib/modules/admin-overview/application/collect-health.ts');
 const rules=load('lib/modules/admin-overview/domain/rules.ts');
 const logger=load('lib/logger.ts');
 const observations=[],now=new Date('2026-11-02T03:00:00Z');
 let rawQueries=0;const ctx={actor:{type:'guest'},now:()=>now,prisma:{$queryRaw:async()=>{rawQueries++;throw Error('Synthetic DB unavailable');}}};
 let result=await health.checkHealth(ctx,null);assert(result.ok&&rawQueries===0,'Public liveness does not query DB');
 observations.push({case:'public_health_ok_without_DB_query',result,raw_queries:0,finding:'R18'});
 result=await health.checkHealth(ctx,'wrong-synthetic-token');assert(result.ok&&rawQueries===0,'Wrong token liveness control');
 observations.push({case:'wrong_health_token_no_diagnostic_data_control',result,raw_queries:0});
 result=await health.checkHealth(ctx,syntheticEnv.HEALTHCHECK_TOKEN);assert(!result.ok&&result.database==='failed'&&rawQueries===1,'Authorized DB failure');
 observations.push({case:'authorized_health_detects_DB_failure',result,raw_queries:rawQueries});
 ctx.prisma={$queryRaw:async()=>1,creator:{findFirst:async()=>null},video:{count:async()=>0,findFirst:async()=>null}};mainChannel=null;
 result=await health.checkHealth(ctx,syntheticEnv.HEALTHCHECK_TOKEN);assert(result.ok&&result.database==='ok'&&result.content.mainFeaturedVideoExists===false,'Content facts not global failure');
 observations.push({case:'authorized_health_reports_missing_content_but_top_ok_true',ok:result.ok,database:result.database,content:result.content,finding:'R18',limit:'The consumer may inspect content fields; no full route executed.'});
 result=await probes.probePublicApp('http://synthetic-app.invalid',async()=>new Response('{"ok":false,"database":"failed"}',{status:200}));
 assert(result.ok,'Status-only public probe');
 observations.push({case:'admin_app_probe_200_failed_body_still_ok',ok:result.ok,detail:result.detail,finding:'R18'});
 const p404=await probes.probePublicApp('http://synthetic-app.invalid',async()=>new Response(null,{status:404}));
 const p502=await probes.probePublicApp('http://synthetic-app.invalid',async()=>new Response(null,{status:502}));
 assert(p404.ok&&!p502.ok,'Probe status boundary');
 observations.push({case:'admin_app_probe_404_ok_502_critical_boundary',status404ok:p404.ok,status502ok:p502.ok});
 const requests=[];result=await probes.probeHlsWorker('https://synthetic-video.invalid',async(url,init)=>{requests.push({url,method:init.method});return new Response(null,{status:404});});
 assert(result.ok&&requests.length===1&&requests[0].method==='HEAD','HLS liveness probe');
 observations.push({case:'HLS_probe_checks_only_root_HEAD',ok:result.ok,requests,finding:'R18'});
 const redisGood=await probes.probeRedis('http://synthetic-redis.invalid','synthetic-token',async()=>new Response('{"result":"PONG"}',{status:200}));
 const redisBad=await probes.probeRedis('http://synthetic-redis.invalid','synthetic-token',async()=>new Response('{"result":"BROKEN"}',{status:200}));
 assert(redisGood.ok&&!redisBad.ok,'Redis semantic response check');
 observations.push({case:'redis_requires_PONG_positive_and_negative_control',good:redisGood.ok,bad:redisBad.ok});
 const job={id:'synthetic-job',status:'RUNNING',heartbeatAt:new Date(now.getTime()-3*60000),progressPercent:0,createdAt:new Date(now.getTime()-15*60000),video:{title:'Synthetic video'}};
 const stale=checks.encoderCheck([job],now),queued=checks.encoderCheck([{...job,status:'QUEUED'}],now),fresh=checks.encoderCheck([{...job,heartbeatAt:now}],now);
 assert(stale.kind==='crit'&&queued.kind==='warn'&&fresh.kind==='ok','Encoder checks controls');
 observations.push({case:'encoder_stale_heartbeat_queue_and_fresh_controls',stale_kind:stale.kind,old_queue_kind:queued.kind,fresh_kind:fresh.kind});
 const info={id:'synthetic',label:'Not measured',kind:'info',detail:'No configuration',measuredAt:null,source:'fixture',everyMin:1};
 const summary=rules.summarizeHealth([info],now);assert(summary.kind==='ok'&&summary.counts.info===1,'Declared unknown classification');
 observations.push({case:'unmeasured_info_does_not_raise_summary_alarm',kind:summary.kind,headline:summary.headline,counts:summary.counts,classification:'DECLARED_POLICY_TRADEOFF_NOT_NEW_FAILURE'});
 logs.length=0;
 logger.logger.error('synthetic failure',new Error('Failed https://name:password@media.example.invalid/object?token=synthetic-query'),{authorization:'Bearer synthetic-marker',nested:{token:'synthetic-sensitive-value',url:'https://media.example.invalid/x?signature=synthetic-query'}});
 const serialized=JSON.stringify(logs);
 assert(!serialized.includes('synthetic-query')&&!serialized.includes('synthetic-sensitive-value')&&!serialized.includes('name:password'),'Redaction controls');
 observations.push({case:'logger_redacts_sensitive_keys_query_and_URL_userinfo_control',sensitive_key_redacted:true,query_redacted:true,userinfo_redacted:true});
 logs.length=0;
 logger.logger.warn('synthetic URL example','https://video.example.invalid/h/syntheticPathMarker/video-id/v1/master.m3u8');
 assert(JSON.stringify(logs).includes('syntheticPathMarker'),'Path marker remains');
 observations.push({case:'logger_preserves_URL_path_marker_open_question',path_marker_preserved:true,classification:'NO_VALID_TOKEN_OR_ACTUAL_APPLICATION_LOG_CALL_WITNESS;NO_NEW_FINDING'});
 logs.length=0;
 logger.createScopedLogger('synthetic-request-id').info('first');logger.createScopedLogger('synthetic-request-id').error('second');
 assert(logs.length===2&&logs.every(r=>JSON.stringify(r).includes('synthetic-request-id')),'RID correlation control');
 observations.push({case:'scoped_logger_retains_same_correlation_control',messages:2,same_request_id:true});
 const resultFile={date:'2026-11-02',actual_source_sha256:sources,observations,real_network_calls:0,real_DB_queries:0,real_messages_sent:0,
  boundaries:['Real TS functions with enum names checked against schema; no generated Prisma client','DB/query/channel lookup are explicit synthetic fixtures','Probe fetches entirely injected; no service or local HTTP server','Logger probe uses synthetic markers, no actual secrets or valid signed URL','VM env is synthetic; production configuration and full route/schedulers not read or executed']};
 fs.writeFileSync(path.join(base,'evidence/monitoring-boundaries-experiment.json'),JSON.stringify(resultFile,null,2)+'\n');
 console.log(JSON.stringify({observations:observations.length,actual_source_files:Object.keys(sources).length,real_network_calls:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});

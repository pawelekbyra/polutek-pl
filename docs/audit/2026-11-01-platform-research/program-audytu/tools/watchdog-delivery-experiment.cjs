/* Actual unchanged Cloudflare Worker, explicit in-memory D1 and total fetch stub.
 * Never calls network or sends e-mail. D1 storage/SQL, clock, probes and provider are fixtures. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript');
const root=process.cwd(),base=path.join(root,'docs/audit/2026-11-01-platform-research/program-audytu');
const file='workers/pp-watchdog/worker.mjs',source=fs.readFileSync(path.join(root,file),'utf8');
const hash=crypto.createHash('sha256').update(source).digest('hex');
const inventory=fs.readFileSync(path.join(base,'INWENTARZ-PLIKOW.csv'),'utf8');
if(!inventory.split('\n').some(line=>line.startsWith(file+',')&&line.includes(hash)))throw Error('Baseline changed');
const assert=(value,label)=>{if(!value)throw Error(label);};
const start=Date.parse('2026-11-02T03:00:00Z'),MIN=60000;
function setup(){
 let clock=start;
 const db={states:new Map(),ping:null,days:new Map(),queries:0,
  prepare(sql){const normalized=sql.replace(/\s+/g,' ').trim();let args=[];
   const statement={sql:normalized,bind(...a){args=a;return statement;},
    async first(){db.queries++;
     if(normalized.startsWith('SELECT at, status, warn_since FROM ping'))return db.ping?structuredClone(db.ping):null;
     if(normalized.startsWith('SELECT sent FROM alert_day'))return db.days.has(args[0])?{sent:db.days.get(args[0])}:null;
     if(normalized.startsWith('SELECT * FROM check_state WHERE name'))return structuredClone(db.states.get(args[0])??null);
     throw Error('Unexpected D1 first '+normalized);
    },
    async run(){db.queries++;
     if(normalized.startsWith('INSERT INTO check_state')){const[name,ok,fails,since,last_alert,detail,checked_at]=args;db.states.set(name,{name,ok,fails,since,last_alert,detail,checked_at});}
     else if(normalized.startsWith('INSERT INTO alert_day'))db.days.set(args[0],(db.days.get(args[0])??0)+1);
     else if(normalized.startsWith('DELETE FROM alert_day')){for(const key of db.days.keys())if(key<args[0])db.days.delete(key);}
     else if(normalized.startsWith('INSERT INTO ping')){const[at,status]=args;db.ping={at,status,warn_since:status.startsWith('WARN')?(db.ping?.warn_since??at):null};}
     else throw Error('Unexpected D1 run '+normalized);
     return {success:true};
    },
    async all(){db.queries++;if(normalized==='SELECT * FROM check_state ORDER BY name')return {results:[...db.states.values()].sort((a,b)=>a.name.localeCompare(b.name))};if(normalized==='SELECT * FROM ping')return{results:db.ping?[db.ping]:[]};throw Error('Unexpected D1 all');}
   };return statement;
  },
  async batch(statements){assert(statements.every(x=>x.sql.startsWith('CREATE TABLE IF NOT EXISTS')),'Unexpected D1 batch');return statements.map(()=>({success:true}));}
 };
 const transport={www:200,video:404,support:302,mailMode:'success',calls:[],mailAttempts:[]};
 const fetchStub=async(url,init={})=>{
  const address=String(url);transport.calls.push(address);
  if(address==='https://www.pawelperfect.com/api/health')return new Response('{"ok":true}',{status:transport.www});
  if(address==='https://video.pawelperfect.com/')return new Response(null,{status:transport.video});
  if(address==='https://support.pawelperfect.com/')return new Response(null,{status:transport.support,headers:{location:'https://example.cloudflareaccess.com/login'}});
  if(address==='https://api.resend.com/emails'){
   const body=JSON.parse(init.body);transport.mailAttempts.push({subject:body.subject,mode:transport.mailMode});
   if(transport.mailMode==='throw')throw Error('synthetic provider network error');
   return new Response('{}',{status:transport.mailMode==='success'?200:503});
  }
  throw Error('Unexpected network boundary '+address);
 };
 class ResearchDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const moduleRecord={exports:{}};
 // .mjs forces ESM preservation in this TS version; a virtual .ts parser filename
 // permits CJS evaluation of the exact same source bytes without rewriting logic.
 const compiled=ts.transpileModule(source,{fileName:'watchdog-research.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext('(function(module,exports){'+compiled+'\n})',{fetch:fetchStub,Response,Request,Headers,URL,AbortSignal,Date:ResearchDate,console})(moduleRecord,moduleRecord.exports);
 const worker=moduleRecord.exports.default;
 const env={DB:db,PING_TOKEN:'synthetic-monitor-token-not-live',RESEND_API_KEY:'synthetic-no-provider-key',ALERT_FROM:'research@example.invalid',ALERT_TO:'owner@example.invalid'};
 const request=(route,method='POST',body)=>new Request('https://watchdog.example.invalid'+route,{method,headers:{authorization:'Bearer '+env.PING_TOKEN},body});
 async function run(){db.ping={at:clock,status:'OK',warn_since:null};const r=await worker.fetch(request('/run'),env);assert(r.status===200,'Worker /run response');return r.json();}
 return {db,transport,worker,env,request,run,advance(ms=5*MIN){clock+=ms;},now:()=>clock};
}
(async()=>{
 const observations=[];
 {
  const s=setup();const r=await s.worker.fetch(new Request('https://watchdog.example.invalid/run',{method:'POST'}),s.env);
  assert(r.status===404&&s.db.queries===0&&!s.transport.calls.length,'Unauthorized control');
  observations.push({case:'unauthorized_control_no_probe_or_provider',status:r.status,DB_queries:0,fetch_calls:0});
 }
 {
  const s=setup();const states=await s.run();
  assert(states.every(r=>r.ok===1)&&!s.transport.mailAttempts.length,'Healthy liveness control');
  observations.push({case:'liveness_healthy_without_any_manifest_or_segment_probe',all_ok:true,probe_urls:s.transport.calls,mail_attempts:0,finding:'R18',limit:'No media object was requested; real R2/manifest state not modeled or tested.'});
 }
 {
  const s=setup();s.transport.www=502;await s.run();assert(!s.transport.mailAttempts.length,'First failure ignored');
  observations.push({case:'first_failed_check_no_alert',fails:s.db.states.get('www').fails,mail_attempts:0});
  s.advance();await s.run();assert(s.transport.mailAttempts.length===1,'Second failure alerts');
  observations.push({case:'second_failed_check_delivers_down_control',attempt:s.transport.mailAttempts[0],last_alert_set:!!s.db.states.get('www').last_alert});
  s.advance();s.transport.www=200;s.transport.mailMode='503';await s.run();const after=structuredClone(s.db.states.get('www'));
  assert(s.transport.mailAttempts.length===2&&after.ok===1&&after.last_alert===null,'Non-2xx recovery state observation');
  s.advance();s.transport.mailMode='success';await s.run();
  assert(s.transport.mailAttempts.length===2,'Recovery was not retried');
  observations.push({case:'recovery_http_503_is_not_retried_next_healthy_run',finding:'R36',attempts:s.transport.mailAttempts,stored_state_after_failed_delivery:after,later_healthy_mail_attempts:0});
 }
 {
  const s=setup();s.transport.www=502;await s.run();s.advance();s.transport.mailMode='503';await s.run();
  assert(s.db.states.get('www').last_alert===null,'Failed DOWN retains no timestamp');
  s.advance();s.transport.mailMode='success';await s.run();
  assert(s.transport.mailAttempts.length===2&&s.transport.mailAttempts.every(r=>r.subject.includes('DOWN')),'DOWN retries control');
  observations.push({case:'down_http_503_retries_on_next_failed_run_control',attempts:s.transport.mailAttempts,last_alert_set:!!s.db.states.get('www').last_alert});
 }
 {
  const s=setup();s.transport.www=502;await s.run();s.advance();await s.run();s.advance();s.transport.www=200;s.transport.mailMode='throw';let rejected=false;
  try{await s.run();}catch(error){rejected=error.message==='synthetic provider network error';}
  assert(rejected&&s.db.states.get('www').ok===0,'Thrown transport keeps prior state');
  s.advance();s.transport.mailMode='success';await s.run();
  assert(s.transport.mailAttempts.filter(x=>x.subject.includes('OK again')).length===2,'Thrown recovery retried');
  observations.push({case:'recovery_network_throw_retries_control',attempts:s.transport.mailAttempts,final_ok:s.db.states.get('www').ok===1,limit:'Transport exceptions and non-2xx are observably different; no real provider delivery.'});
 }
 {
  const s=setup();s.transport.www=502;await s.run();s.advance();await s.run();
  s.db.days.set(new Date(s.now()).toISOString().slice(0,10),20);s.advance();s.transport.www=200;await s.run();
  const attempts=s.transport.mailAttempts.length;s.advance(24*60*MIN);await s.run();
  assert(attempts===1&&s.transport.mailAttempts.length===1&&s.db.states.get('www').ok===1,'Capped recovery never retried');
  observations.push({case:'recovery_daily_cap_not_retried_next_day',finding:'R36',delivered_down_attempts:1,recovery_provider_attempts:0,stored_ok:true});
 }
 {
  const s=setup();s.transport.www=502;s.db.days.set(new Date(s.now()).toISOString().slice(0,10),20);await s.run();s.advance();await s.run();
  assert(!s.transport.mailAttempts.length&&s.db.states.get('www').last_alert===null,'Daily cap respects DOWN');
  s.advance(24*60*MIN);await s.run();assert(s.transport.mailAttempts.length===1,'DOWN eligible next day');
  observations.push({case:'down_daily_cap_retries_next_day_control',attempts:s.transport.mailAttempts});
 }
 const result={date:'2026-11-02',actual_source:file,sha256:hash,observations,real_network_calls:0,real_messages_sent:0,
  boundaries:['Actual Worker.fetch/runChecks/nextState/sendMail with explicit in-memory D1 model','Fetch is completely stubbed and rejects every unknown URL; provider modes 200/503/throw are synthetic','Clock is simulated; no real 5-minute cron, Cloudflare/D1 SQL, Resend or delivery inbox','Storage atomicity/concurrent schedules/timeouts and production occurrence unverified'],independent_review:'PENDING'};
 fs.writeFileSync(path.join(base,'evidence/watchdog-delivery-experiment.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({observations:observations.length,real_messages_sent:0,real_network_calls:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});

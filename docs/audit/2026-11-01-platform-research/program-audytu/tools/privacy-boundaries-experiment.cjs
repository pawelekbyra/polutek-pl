/* Research: actual export/deletion/retention/public-header/collector functions.
 * Explicit schema-checked in-memory DB and transaction rollback; fake providers,
 * audit and mail. No generated Prisma, HTTP, real users or external connections.
 */
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto');
const assert=require('node:assert/strict'), ts=require('typescript');
const base='docs/audit/2026-11-01-platform-research/program-audytu';
const inventory=new Map(fs.readFileSync(`${base}/INWENTARZ-PLIKOW.csv`,'utf8').trim().split('\n').slice(1).map(line=>{const c=line.split(',');return[c[0],c[4]];}));
const hashes={}, loaded=new Map(), boundary=new Set();
function checked(file){const b=fs.readFileSync(file);hashes[file]=crypto.createHash('sha256').update(b).digest('hex');assert.equal(hashes[file],inventory.get(file),`Changed source: ${file}`);return b.toString();}
const schema=checked('prisma/schema.prisma'), modelFields={};
for(const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g))modelFields[m[1]]=new Set(m[2].split('\n').map(x=>x.trim().split(/\s+/)[0]).filter(x=>/^\w+$/.test(x)));
const enums={};
for(const name of ['BroadcastRecipientStatus','CommentDeletedReason','CommentStatus','VideoStatus']){
 const body=schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1];enums[name]=Object.fromEntries(body.split('\n').map(s=>s.trim()).filter(s=>/^[A-Z][A-Z_0-9]*$/.test(s)).map(s=>[s,s]));
}
let current, failAudit=false, failProvider=false;
const providers={contacts:0,stripe:0,emails:0}, audits=[];
const stubs={
 '@prisma/client':()=>enums,
 '@/lib/prisma':()=>Object.defineProperty({},'prisma',{get:()=>current.db}),
 '@/lib/logger':()=>({logger:{info(){},warn(){},error(){}}}),
 '@/lib/observability':()=>({recordAlert(){}}),
 '@/lib/modules/audit':()=>({recordAuditEvent:async(_ctx,event)=>{if(failAudit)throw new Error('SYNTHETIC_AUDIT_FAILURE');audits.push(event.action);}}),
 '@/lib/modules/email':()=>({resolveEmailLanguage:x=>x==='pl'?'pl':'en',sendAccountDeletedEmail:async()=>{providers.emails++;}}),
 '@/lib/modules/subscriptions':()=>load('lib/modules/subscriptions/application/contact-removal.use-case.ts'),
 '@/lib/modules/payments':()=>load('lib/modules/payments/application/stripe-customer-anonymization.use-case.ts'),
 '../infrastructure/resend-audience.gateway':()=>({ResendAudienceGateway:class{async removeContact(){providers.contacts++;return failProvider?'FAILED':'SYNCED';}}}),
 '../infrastructure/stripe-client':()=>({getStripeClient:()=>({customers:{update:async()=>{providers.stripe++;if(failProvider)throw new Error('SYNTHETIC_PROVIDER_OFFLINE');return{};}}})}),
 '@/lib/data/initial-content':()=>({INITIAL_VIDEOS:[],DEFAULT_CREATOR:{slug:'unused-demo'}}),
 '@/lib/feature-flags':()=>({canUseDemoFallbacks:()=>false}),
 '@/lib/modules/video/infrastructure/video-content.service':()=>({VideoContentService:{},findMainCreatorAdminAvatar:async()=>null,publicVideoListOmit:{},publicVideoOrderBy:[]}),
 '@/lib/modules/channel/application/main-channel.service':()=>({MainChannelService:{},isMainChannelId:async()=>false,resolveMainChannelId:async()=>null}),
 '@/lib/modules/shared/app-context':()=>({createAppContext:()=>({prisma:current.db})}),
};
const allowed=new Set([
 'lib/modules/users/application/account-deletion-cleanup.use-case.ts','lib/modules/users/application/export-own-data.use-case.ts',
 'lib/modules/privacy/application/anonymize-technical-data.use-case.ts','lib/modules/privacy/domain/retention.ts',
 'lib/modules/subscriptions/application/contact-removal.use-case.ts','lib/modules/subscriptions/domain/email-address.ts',
 'lib/modules/payments/application/stripe-customer-anonymization.use-case.ts',
 'lib/modules/shared/result.ts','lib/modules/channel/infrastructure/creator-content.service.ts',
 'lib/modules/channel/domain/channel-avatar.ts','lib/modules/channel/domain/channel-about.ts','lib/modules/channel/domain/channel-banner-limits.ts',
 'lib/modules/channel/domain/channel.policy.ts','lib/modules/channel/domain/channel.errors.ts','lib/modules/shared/app-error.ts',
 'services/pp-collector/src/handler.ts','services/pp-collector/src/classify.ts','services/pp-collector/src/visitor.ts',
 'lib/telemetry/beacon-contract.ts','lib/telemetry/beacon-constants.ts',
]);
function load(file){
 if(loaded.has(file))return loaded.get(file).exports;assert(allowed.has(file),`Unexpected source: ${file}`);
 const mod={exports:{}};loaded.set(file,mod);
 const js=ts.transpileModule(checked(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const localRequire=spec=>{if(stubs[spec]){boundary.add(`${file} => ${spec}`);return stubs[spec]();}if(spec==='zod'||spec==='crypto'||spec.startsWith('node:'))return require(spec);
   return load(spec.startsWith('@/')?spec.slice(2)+'.ts':path.posix.normalize(path.posix.join(path.posix.dirname(file),spec))+'.ts');};
 new vm.Script(`(function(require,module,exports){${js}\n})`,{filename:file}).runInThisContext()(localRequire,mod,mod.exports);return mod.exports;
}
const {AccountDeletionCleanupUseCase}=load('lib/modules/users/application/account-deletion-cleanup.use-case.ts');
const {ExportOwnDataUseCase}=load('lib/modules/users/application/export-own-data.use-case.ts');
const {anonymizeOldTechnicalData}=load('lib/modules/privacy/application/anonymize-technical-data.use-case.ts');
const {processContactRemovals}=load('lib/modules/subscriptions/application/contact-removal.use-case.ts');
const {processStripeCustomerAnonymizations}=load('lib/modules/payments/application/stripe-customer-anonymization.use-case.ts');
const {CreatorContentService}=load('lib/modules/channel/infrastructure/creator-content.service.ts');
const {processBeacon}=load('services/pp-collector/src/handler.ts');
const clone=x=>structuredClone(x), NOW=new Date('2026-11-01T12:00:00.000Z'), DAY=86400000;
function matches(row,where={}){return Object.entries(where).every(([k,c])=>{
 if(c===undefined)return true;if(k==='OR')return c.some(w=>matches(row,w));if(k==='AND')return c.every(w=>matches(row,w));
 const v=row[k];if(c===null)return v==null;if(c instanceof Date)return v?.getTime()===c.getTime();
 if(c&&typeof c==='object'&&!Array.isArray(c)){if('in'in c&&!c.in.includes(v))return false;if('not'in c&&(c.not===null?v!=null:v!==c.not)===false)return false;
  if('lt'in c&&!(v<c.lt)||'lte'in c&&!(v<=c.lte)||'gt'in c&&!(v>c.gt)||'gte'in c&&!(v>=c.gte))return false;return true;}
 return v===c;
});}
function fixture(){
 failProvider=false;failAudit=false;for(const k of Object.keys(providers))providers[k]=0;audits.length=0;
 const db={},queries=[];
 function table(model){const rows=[];const fields=modelFields[model];assert(fields,model);
  function data(row,input){for(const[k,v]of Object.entries(input)){assert(fields.has(k),`Unknown ${model}.${k}`);if(v!==undefined)row[k]=clone(v);}}
  function select(row,args={}){if(!row)return null;let value=clone(row);if(args.include?.user)value.user=clone(db.user.rows.find(u=>u.id===row.userId));
    return args.select?Object.fromEntries(Object.keys(args.select).filter(k=>args.select[k]).map(k=>[k,value[k]])):value;}
  return{rows,async findUnique(a){queries.push({model,operation:'findUnique',args:a});return select(rows.find(r=>matches(r,a.where)),a);},
   async findFirst(a){return select(rows.find(r=>matches(r,a.where)),a);},
   async findMany(a={}){queries.push({model,operation:'findMany',args:a});let r=rows.filter(r=>matches(r,a.where));if(a.take)r=r.slice(0,a.take);return r.map(r=>select(r,a));},
   async count(a){return rows.filter(r=>matches(r,a.where)).length;},
   async updateMany(a){const hit=rows.filter(r=>matches(r,a.where));for(const r of hit)data(r,a.data);return{count:hit.length};},
   async update(a){const r=rows.find(r=>matches(r,a.where));assert(r,`Missing ${model}`);data(r,a.data);return select(r,a);},
   async deleteMany(a){const hit=rows.filter(r=>matches(r,a.where));for(const r of hit)rows.splice(rows.indexOf(r),1);return{count:hit.length};},
   async upsert(a){let r=rows.find(r=>matches(r,a.where));if(r)data(r,a.update);else{r={id:`fixture-${model}-${rows.length}`,attempts:0};data(r,a.create);rows.push(r);}return clone(r);},
  };}
 for(const model of ['User','PatronGrant','Session','Account','TwoFactor','Passkey','UserAvatar','Subscription','Creator','EmailPreference','Comment','Notification','BroadcastEmailRecipient','EmailEvent','ResendContactRemoval','StripeCustomerAnonymization','AppSetting','VideoLike','VideoDislike','CommentReaction','Payment','VideoProgress','VideoFavorite','AuditLog','VideoPlaybackSession','VideoView','Video','ChannelMember'])db[model[0].toLowerCase()+model.slice(1)]=table(model);
 db.video.aggregate=async()=>({_count:{_all:0},_sum:{views:0}});
 const ctx={prisma:db,actor:{type:'system',reason:'synthetic privacy research'},now:()=>new Date(NOW),db:{writeTransaction:async fn=>{
   const before=Object.fromEntries(Object.entries(db).map(([k,t])=>[k,clone(t.rows)]));
   try{return await fn(db);}catch(error){for(const[k,values]of Object.entries(before))db[k].rows.splice(0,db[k].rows.length,...values);throw error;}
 }}};
 db.user.rows.push({id:'owner',email:'owner@example.invalid',name:'Fixture Owner',username:'fixture-owner',isDeleted:false,language:'pl',imageUrl:'https://fixture.invalid/avatar.jpg',stripeCustomerId:'cus_synthetic',createdAt:NOW},{id:'other',email:'other@example.invalid',isDeleted:false});
 db.creator.rows.push({id:'owned-channel',userId:'owner',name:'Fixture Owner Channel',slug:'fixture-channel',handle:'fixture',bio:'Personal fixture biography',publicContactEmail:'owner@example.invalid',links:[],status:'ACTIVE',deletedAt:null,createdAt:NOW,subscribersCount:0});
 db.channelMember.rows.push({id:'membership',channelId:'owned-channel',userId:'owner',role:'OWNER'});
 db.comment.rows.push({id:'own-comment',authorId:'owner',text:'Private fixture text',imageUrl:'/fixture',status:'VISIBLE',videoId:'v'},{id:'other-comment',authorId:'other',text:'Keep foreign reply',status:'VISIBLE',videoId:'v'});
 for(const key of ['session','account','twoFactor','passkey','userAvatar','notification'])db[key].rows.push({id:'own',userId:'owner'});
 db.emailPreference.rows.push({id:'ep',userId:'owner',email:'owner@example.invalid',marketingEmails:true});
 db.broadcastEmailRecipient.rows.push({id:'br',userId:'owner',email:'owner@example.invalid',status:'PENDING'});
 db.emailEvent.rows.push({id:'ee',userId:'owner',email:'owner@example.invalid',payload:{email:'owner@example.invalid'}});
 db.payment.rows.push({id:'payment',userId:'owner',amountMinor:1499,currency:'PLN',status:'SUCCEEDED',metadata:{purpose:'premium_pass',productId:'ACCESS_30D',consents:{termsVersion:'fixture-consent'}}});
 db.appSetting.rows.push({key:'xp.premium_pass:owner',value:JSON.stringify({fixturePass:true,consents:'fixture-consent'})});
 db.videoProgress.rows.push({id:'vp',userId:'owner',videoId:'v',positionSeconds:10});
 db.videoFavorite.rows.push({id:'vf',userId:'owner',videoId:'v'});
 current={db,ctx,queries};return current;
}
const observations=[];function record(name,values){observations.push({name,...values});}
async function main(){
 {
  const s=fixture();s.db.comment.rows[0].secretFixture='never selected';
  const data=await ExportOwnDataUseCase.execute(s.ctx,'owner');
  assert.equal(data.comments.length,1);assert(!JSON.stringify(data).includes('Keep foreign reply'));assert(!JSON.stringify(data).includes('secretFixture'));
  record('own_export_filters_and_allowlists',{own_comments:data.comments.length,foreign_comment_present:false,unselected_fixture_field_present:false,queries:s.queries.length});
  assert(!Object.hasOwn(data,'channels')&&!Object.hasOwn(data,'premiumPass'));assert(!JSON.stringify(data).includes('fixture-consent'));assert.equal(s.db.creator.rows.length,1);
  record('export_omits_channel_and_pass_records',{finding:'R16',channel_in_db:true,pass_in_db:true,channel_section_present:false,pass_section_present:false,payment_consents_present:false,export_keys:Object.keys(data)});
  const many=s.queries.filter(q=>q.operation==='findMany');assert(many.every(q=>q.args.take===undefined&&q.args.cursor===undefined));
  record('export_unbounded_find_many_queries',{finding:'R16',query_count:many.length,all_without_take_or_cursor:true,limit:'No memory exhaustion or large-account capacity benchmark'});
 }
 {
  const s=fixture();const result=await AccountDeletionCleanupUseCase.execute(s.ctx,{userId:'owner',source:'APP_ACCOUNT_DELETION'});
  const user=s.db.user.rows[0];assert(result.cleaned&&user.isDeleted&&user.email.endsWith('@deleted.invalid'));
  assert.equal(s.db.comment.rows[0].text,'');assert.equal(s.db.comment.rows[1].text,'Keep foreign reply');
  for(const key of ['session','account','twoFactor','passkey','userAvatar','notification','emailPreference'])assert.equal(s.db[key].rows.length,0);
  assert.equal(s.db.broadcastEmailRecipient.rows[0].status,'SKIPPED');assert.equal(s.db.emailEvent.rows[0].email,null);
  record('deletion_cleans_legacy_account_data',{deleted_user:true,login_rows:0,own_comment_erased:true,foreign_reply_preserved:true,email_event_redacted:true,provider_queues_empty:s.db.resendContactRemoval.rows.length+s.db.stripeCustomerAnonymization.rows.length===0});
  const header=await CreatorContentService.getCreatorHeaderBySlug('fixture-channel');
  assert(header&&header.about.contactEmail==='owner@example.invalid'&&header.name==='Fixture Owner Channel');
  record('deleted_owner_channel_header_still_public',{finding:'R33',owner_is_deleted:true,channel_status:s.db.creator.rows[0].status,public_header_returned:!!header,old_contact_email_present:header.about.contactEmail==='owner@example.invalid',personal_bio_present:header.bio==='Personal fixture biography',membership_rows:s.db.channelMember.rows.length});
  record('additional_account_data_retained',{pass_rows:s.db.appSetting.rows.length,progress_rows:s.db.videoProgress.rows.length,favorite_rows:s.db.videoFavorite.rows.length,payment_rows:s.db.payment.rows.length,classification:'Lifecycle policy gaps for review, not automatically unlawful retention'});
  s.db.creator.rows[0].status='DELETED';s.db.creator.rows[0].deletedAt=NOW;
  assert.equal(await CreatorContentService.getCreatorHeaderBySlug('fixture-channel'),null);
  record('explicitly_deleted_channel_hidden_control',{public_header_returned:false});
 }
 {
  const s=fixture();failAudit=true;
  await assert.rejects(()=>AccountDeletionCleanupUseCase.execute(s.ctx,{userId:'owner',source:'APP_ACCOUNT_DELETION'}),/SYNTHETIC_AUDIT_FAILURE/);
  assert(!s.db.user.rows[0].isDeleted&&s.db.account.rows.length===1&&s.db.resendContactRemoval.rows.length===0);assert.equal(providers.contacts+providers.stripe+providers.emails,0);
  record('deletion_audit_failure_model_rolls_back',{deleted_user:false,login_preserved:true,provider_calls:0,limit:'Rollback is an explicit model, not actual PostgreSQL/Prisma'});
 }
 {
  const s=fixture();failProvider=true;await AccountDeletionCleanupUseCase.execute(s.ctx,{userId:'owner',source:'APP_ACCOUNT_DELETION'});
  assert(s.db.user.rows[0].isDeleted&&s.db.resendContactRemoval.rows.length===1&&s.db.stripeCustomerAnonymization.rows.length===1);
  assert.equal(s.db.resendContactRemoval.rows[0].attempts,1);assert.equal(s.db.stripeCustomerAnonymization.rows[0].attempts,1);
  record('provider_failure_keeps_deletion_and_retry_queues',{deleted_user:true,contact_attempts:1,stripe_attempts:1,queues_retained:true});
  failProvider=false;for(const key of ['resendContactRemoval','stripeCustomerAnonymization'])s.db[key].rows[0].nextAttemptAt=NOW;
  await processContactRemovals(s.ctx);await processStripeCustomerAnonymizations(s.ctx);
  assert.equal(s.db.resendContactRemoval.rows.length+s.db.stripeCustomerAnonymization.rows.length,0);
  record('provider_retry_success_drains_queues',{remaining_queue_rows:0});
 }
 {
  const s=fixture(), old=new Date(NOW.getTime()-91*DAY), recent=new Date(NOW.getTime()-DAY);
  for(const [key,timeField,data]of [['auditLog','createdAt',{ip:'192.0.2.1',userAgent:'fixture'}],['session','createdAt',{ipAddress:'192.0.2.1',userAgent:'fixture'}],['videoPlaybackSession','startedAt',{ipHash:'fixture-hash',userAgentHash:'fixture-hash'}],['videoView','createdAt',{ipHash:'fixture-hash'}]]){
   s.db[key].rows.length=0;s.db[key].rows.push({id:'old',[timeField]:old,...data},{id:'recent',[timeField]:recent,...data});
  }
  const denied=await anonymizeOldTechnicalData({...s.ctx,actor:{type:'user',userId:'owner'}});assert(!denied.ok);
  const result=await anonymizeOldTechnicalData(s.ctx);assert(result.ok&&result.data.auditLogs===1&&result.data.views===1);
  assert.equal(s.db.auditLog.rows[0].ip,null);assert.equal(s.db.auditLog.rows[1].ip,'192.0.2.1');
  const replay=await anonymizeOldTechnicalData(s.ctx);assert(replay.ok&&replay.data.auditLogs===0&&replay.data.sessions===0);
  record('technical_retention_cutoff_and_replay',{user_actor_denied:true,older_fields_cleared:true,recent_fields_preserved:true,rows_preserved:true,replay_updates:0});
 }
 const salt=crypto.randomBytes(32), policy={allowedHosts:['fixture.invalid'],take:()=>true};
 const request={body:JSON.stringify({v:1,pageView:{path:'/pl/watch',referrer:'https://source.invalid/private?q=fixture'},signedIn:true,userId:'NEVER_STORE_ACCOUNT_ID'}),ip:'192.0.2.10',userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36',origin:'https://fixture.invalid',doNotTrack:false};
 const result=processBeacon(request,salt,NOW,policy);assert.equal(result.status,204);assert.equal(result.reason,'accepted');
 const text=JSON.stringify(result.rows);assert(!text.includes('192.0.2.10')&&!text.includes('NEVER_STORE_ACCOUNT_ID')&&!text.includes('private?q=fixture'));
 record('collector_minimizes_request_identifiers',{accepted:true,raw_ip_present:false,account_id_present:false,full_referrer_present:false,referrer_host:result.rows.pageViews[0].referrer_host,signed_in:result.rows.pageViews[0].signed_in});
 for(const[name,changes,reason]of [['dnt',{doNotTrack:true},'dnt'],['foreign_origin',{origin:'https://foreign.invalid'},'origin'],['automated',{body:JSON.stringify({v:1,automated:true})},'automated']]){
  const value=processBeacon({...request,...changes},salt,NOW,policy);assert.equal(value.reason,reason);assert(!Object.hasOwn(value,'rows'));record(`collector_${name}_drops`,{reason,no_rows:true});
 }
 console.log(JSON.stringify({date:'2026-11-01',actual_source_sha256:hashes,explicit_boundaries:[...boundary].sort(),observations,
  limits:['Schema-checked in-memory scalar fields/filter/select and transaction rollback, not Prisma/SQL/FK enforcement.','Actual public channel header function executed; video aggregate and non-main-channel resolution are explicit fakes; no browser/HTTP/cache.','Synthetic identities/providers only; no production, actual Stripe/Resend or email delivery.','Retention update counts use modeled rows, not actual AuditLog trigger privileges or scheduled execution.','Collector processBeacon executed, not collector HTTP/Next proxy/PostgreSQL or real daily salt deletion.','R16 is parse/query architecture evidence, not a measured memory exhaustion result.','Export omissions describe functionality and scope, not a legal finding of GDPR violation.']},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

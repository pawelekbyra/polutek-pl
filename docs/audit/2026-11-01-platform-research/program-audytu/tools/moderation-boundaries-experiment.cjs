/** Scoped actual-source experiments, not full application HTTP or PostgreSQL validation.
 * Checks comment/appeal/translation boundaries and reproduces stale-decision rollback after a status cycle.
 * Run with Node 22 from the repository root. Fake DB, audit, notifications, and EN sync are explicit boundaries.
 */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), assert = require('node:assert/strict'), ts = require('typescript');
const inventory = new Map(fs.readFileSync('docs/audit/2026-11-01-platform-research/program-audytu/INWENTARZ-PLIKOW.csv','utf8')
  .trim().split(/\r?\n/).slice(1).map(row => { const c = row.split(','); return [c[0], c[4]]; }));
const actual = new Set([
  'lib/modules/shared/app-error.ts','lib/modules/shared/result.ts',
  'lib/modules/authz/application/authorize.ts','lib/modules/authz/domain/actions.ts','lib/modules/authz/domain/policy.ts',
  'lib/modules/authz/domain/principal.ts','lib/modules/authz/domain/matrix.ts',
  'lib/modules/comments/application/authorize-comments.ts',
  'lib/modules/comments/application/channel-ban.use-cases.ts','lib/modules/comments/application/comment-write-guard.ts',
  'lib/modules/comments/domain/comment.errors.ts',
  'lib/modules/channel/application/moderation-appeals.use-cases.ts','lib/modules/channel/domain/moderation-appeal.policy.ts',
  'lib/modules/channel/application/main-channel.service.ts','lib/modules/channel/infrastructure/channel.repository.ts',
  'lib/modules/channel/domain/main-channel-setting.ts','lib/modules/channel/domain/channel.policy.ts','lib/modules/channel/domain/channel.errors.ts',
  'lib/modules/translations/application/translations.ts','lib/modules/translations/domain/languages.ts','lib/modules/translations/domain/slug.ts',
]);
const loaded = new Map(), boundaries = new Set();
const stubs = {
  '@/lib/modules/authz': () => load('lib/modules/authz/application/authorize.ts'),
  '@/lib/modules/channel': () => load('lib/modules/channel/application/main-channel.service.ts'),
  '@/lib/modules/video': () => ({ updateAdminVideo: async () => ({ ok:true,data:{} }) }),
  '@/lib/modules/audit': () => ({ recordAuditEvent: async () => {}, recordAuditEventSafe: async () => {} }),
  'lib/modules/channel/infrastructure/moderation-notice.ts': () => ({ notifyChannelOwnerOfDecision: async () => {} }),
  '@prisma/client': () => ({}),
  '@/lib/logger': () => ({logger:{error(){},warn(){},info(){}}}),
};
function load(file) {
  if (loaded.has(file)) return loaded.get(file).exports;
  assert(actual.has(file), `Unapproved source ${file}`);
  const bytes=fs.readFileSync(file), sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256,inventory.get(file),`Changed baseline ${file}`);
  const mod={exports:{},sha256};loaded.set(file,mod);
  const localRequire=spec => {
    const resolved=spec.startsWith('@/')?`${spec.slice(2)}.ts`:`${path.posix.normalize(path.posix.join(path.posix.dirname(file),spec))}.ts`;
    const stub=stubs[spec]??stubs[resolved];
    if(stub){boundaries.add(spec);return stub();}
    if(spec==='react')return require(spec);
    return load(resolved);
  };
  const js=ts.transpileModule(bytes.toString(),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:file}).outputText;
  new vm.Script(`(function(require,module,exports){${js}\n})`,{filename:file}).runInThisContext()(localRequire,mod,mod.exports);
  return mod.exports;
}
const now=new Date('2026-11-01T12:00:00Z');
const context=(db,actor,extras={})=>({prisma:db,actor,now:()=>now,db:{writeTransaction:fn=>fn(db)},...extras});

async function main(){
  const appeal=load('lib/modules/channel/application/moderation-appeals.use-cases.ts');
  const comments=load('lib/modules/comments/application/authorize-comments.ts');
  const translations=load('lib/modules/translations/application/translations.ts');
  const bans=load('lib/modules/comments/application/channel-ban.use-cases.ts');
  const writeGuard=load('lib/modules/comments/application/comment-write-guard.ts');
  const observations=[];
  for(const type of ['CHANNEL','VIDEO']){
    for(const history of ['original_still_in_force','later_different_status','status_cycle_with_new_decision']){
      const originalStatus=type==='CHANNEL'?'SUSPENDED':'REMOVED';
      const restoredStatus=type==='CHANNEL'?'ACTIVE':'VISIBLE';
      const differentStatus=type==='CHANNEL'?'BANNED':'LIMITED';
      const field=type==='CHANNEL'?'status':'moderationStatus';
      let current={id:'target', [field]:history==='later_different_status'?differentStatus:originalStatus,
        statusChangedAt:new Date(history==='original_still_in_force'?'2026-10-01T00:00:00Z':'2026-10-20T00:00:00Z')};
      const decisions=[{id:'decision-old',targetType:type,targetId:'target',channelId:'channel-a',
        action:`${type}_${originalStatus}`,createdAt:new Date('2026-10-01T00:00:00Z')}];
      if(history==='status_cycle_with_new_decision')decisions.push(
        {id:'decision-restored',action:`${type}_${restoredStatus}`,createdAt:new Date('2026-10-10T00:00:00Z')},
        {id:'decision-new-independent',action:`${type}_${originalStatus}`,createdAt:new Date('2026-10-20T00:00:00Z')});
      if(history==='later_different_status')decisions.push({id:'decision-new-independent',action:`${type}_${differentStatus}`});
      const queries=[],writes=[];
      const targetDelegate={
        findUnique:async args=>{queries.push({delegate:type,args});return Object.fromEntries(Object.keys(args.select).map(k=>[k,current[k]]));},
        updateMany:async args=>{
          queries.push({delegate:type,args});
          if(Object.entries(args.where).some(([k,v])=>current[k]!==v))return {count:0};
          current={...current,...args.data};writes.push(args.data);return {count:1};
        },
      };
      const db={
        moderationAppeal:{findUnique:async()=>({id:'appeal-old',status:'PENDING',userId:'owner-a',decision:decisions[0]}),
          updateMany:async()=>({count:1}),update:async()=>({})},
        moderationDecision:{create:async({data})=>{decisions.push({id:'outcome',...data});return{id:'outcome'};}},
        creator:targetDelegate,video:targetDelegate,
        auditLog:{findFirst:async()=>({metadata:{before:{[field]:restoredStatus}}})},
      };
      const before=current[field];
      const result=await appeal.resolveModerationAppeal(context(db,{type:'admin',userId:'staff'}),
        {appealId:'appeal-old',outcome:'UPHELD',reasonPublic:'Original decision was incorrect.'});
      assert(result.ok);
      assert.equal(current[field],history==='later_different_status'?differentStatus:restoredStatus);
      observations.push({kind:'appeal_outcome',type,history,appealedDecision:'decision-old',
        laterIndependentDecisionPresent:history!=='original_still_in_force',before,after:current[field],
        reportedReverted:result.data.reverted,writeCount:writes.length,queries,
        reproducesNewerRestrictionBeingUndone:history==='status_cycle_with_new_decision'});
    }
  }
  const channels={a:{id:'a',name:'A',userId:'owner-a',status:'SUSPENDED',members:[{userId:'mod-a',role:'MODERATOR'}]},
    b:{id:'b',name:'B',userId:'owner-b',status:'ACTIVE',members:[]}};
  const decision={id:'decision-a',channelId:'a',action:'CHANNEL_SUSPENDED',createdAt:new Date('2026-10-01T00:00:00Z'),
    targetType:'CHANNEL',targetId:'a',reasonPublic:'Public reason',reasonInternal:'INTERNAL-FIXTURE-MARKER',appeals:[]};
  let created=0;
  const db={creator:{findUnique:async({where})=>channels[where.id]??null},
    moderationDecision:{findUnique:async()=>decision,findMany:async()=>[decision]},
    moderationAppeal:{findFirst:async()=>null,create:async()=>{created++;return{id:'new-appeal'};}},
    channelMember:{findMany:async({where})=>(channels[where.channelId]?.members??[]).filter(m=>m.userId===where.userId)},
    comment:{findMany:async({where})=>where.id.in.map(id=>({id,video:{creatorId:id==='comment-a'?'a':'b',creator:id==='comment-a'?channels.a:channels.b}}))},
  };
  for(const [scenario,actor,expected]of[
    ['suspended owner can appeal',{type:'user',userId:'owner-a'},true],
    ['foreign owner cannot appeal',{type:'user',userId:'owner-b'},false],
    ['moderator cannot appeal',{type:'user',userId:'mod-a'},false],
  ]){
    const before=created,result=await appeal.createModerationAppeal(context(db,actor),{decisionId:'decision-a',text:'The original decision should be reviewed.'});
    assert.equal(result.ok,expected);assert.equal(created-before,expected?1:0);
    observations.push({kind:'creator_boundary',scenario,accepted:result.ok,status:result.ok?null:result.error.statusCode,createdDelta:created-before});
  }
  const listed=await appeal.listDecisionsForCreator(context(db,{type:'user',userId:'owner-a'}),{channelId:'a'});
  assert(listed.ok);assert(!JSON.stringify(listed.data).includes('INTERNAL-FIXTURE-MARKER'));
  observations.push({kind:'creator_boundary',scenario:'explicit creator DTO omits internal reason even if fake DB returns it',internalReasonAbsent:true});
  channels.a.status='ACTIVE';
  for(const [ids,expected]of[[['comment-a'],false],[['comment-a','comment-b'],true]]){
    const result=await comments.authorizeComments(context(db,{type:'user',userId:'mod-a'}),'comment.moderate',ids);
    assert.equal(Boolean(result),expected);
    observations.push({kind:'comment_boundary',ids,denied:Boolean(result),limit:'Authorization helper only; bulk write not executed'});
  }
  let banWrites=0;
  channels.a.members.push({userId:'editor-a',role:'EDITOR'});
  db.user={findUnique:async({where})=>({id:where.id,role:where.id==='staff-target'?'ADMIN':'USER',isDeleted:false})};
  db.channelBan={upsert:async()=>{banWrites++;},findUnique:async()=>null};
  for(const [scenario,actor,channelId,userId,expected]of[
    ['moderator bans a viewer in own channel',{type:'user',userId:'mod-a'},'a','viewer',true],
    ['moderator cannot ban in foreign channel',{type:'user',userId:'mod-a'},'b','viewer',false],
    ['editor cannot ban',{type:'user',userId:'editor-a'},'a','viewer',false],
    ['owner cannot ban a member',{type:'user',userId:'owner-a'},'a','mod-a',false],
    ['owner cannot ban themselves',{type:'user',userId:'owner-a'},'a','owner-a',false],
    ['owner cannot ban platform admin',{type:'user',userId:'owner-a'},'a','staff-target',false],
  ]){
    const before=banWrites,result=await bans.banViewerFromChannel(context(db,actor),{channelId,userId});
    assert.equal(result.ok,expected);assert.equal(banWrites-before,expected?1:0);
    observations.push({kind:'ban_boundary',scenario,accepted:result.ok,writeDelta:banWrites-before});
  }
  for(const [scenario,until,expected]of[
    ['permanent ban blocks writing',null,true],
    ['expired ban permits writing',new Date('2026-10-01T00:00:00Z'),false],
  ]){
    db.channelBan.findUnique=async()=>({until,reason:'PRIVATE-BAN-REASON-FIXTURE'});
    const result=await writeGuard.channelBanError(context(db,{type:'user',userId:'viewer'}),'a','viewer',false);
    assert.equal(Boolean(result),expected);assert(!JSON.stringify(result).includes('PRIVATE-BAN-REASON-FIXTURE'));
    observations.push({kind:'ban_boundary',scenario,denied:Boolean(result),privateReasonAbsent:true});
  }
  const video={id:'v1',creatorId:'a',slug:'fixture',title:'Original',description:null,subtitleUrlPl:null,subtitleUrlEn:null,updatedAt:now};
  let writes=0;
  const translationDb={
    creator:{findUnique:async({where})=>channels[where.id]??null},
    video:{findFirst:async({where})=>where.creatorId===video.creatorId&&where.OR.some(x=>x.id===video.id||x.slug===video.slug)?video:null},
    videoTranslation:{findUnique:async()=>({id:'tr1',slug:'fixture-de'}),upsert:async()=>{writes++;},updateMany:async()=>{writes++;return{count:1};}},
  };
  for(const [scenario,grants,language,expected]of[
    ['granted DE can be saved',['de'],'de',true],
    ['ungranted FR is denied',['de'],'fr',false],
    ['empty grants deny DE',[],'de',false],
  ]){
    const before=writes,result=await translations.saveFilmTranslation({videoId:'v1',language,title:'Fixture translation'},
      context(translationDb,{type:'admin',userId:'translator'},{channelId:'a',allowedLanguages:grants}));
    assert.equal(result.ok,expected);assert.equal(writes-before,expected?1:0);
    observations.push({kind:'language_boundary',scenario,accepted:result.ok,writeDelta:writes-before});
  }
  for(const [scenario,grants,expected]of[
    ['translator cannot approve',['de'],false],['empty grants cannot approve',[],false],['owner can approve',undefined,true],
  ]){
    const before=writes,result=await translations.approveFilmTranslations({videoId:'v1'},context(translationDb,
      {type:'admin',userId:grants?'translator':'owner'},{channelId:'a',allowedLanguages:grants}));
    assert.equal(result.ok,expected);assert.equal(writes-before,expected?1:0);
    observations.push({kind:'language_boundary',scenario,accepted:result.ok,writeDelta:writes-before});
  }
  console.log(JSON.stringify({kind:'ISOLATED_ACTUAL_SOURCE_WITH_FAKE_IO',application_baseline_sha:'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
    actual_source_sha256:Object.fromEntries([...loaded].map(([file,mod])=>[file,mod.sha256])),stub_import_boundaries:[...boundaries].sort(),
    limits:'No real PostgreSQL, HTTP, Next Server Action dispatch, Access JWT, or role-to-context construction. Gate and grant loading reviewed separately. No claim of real audit/notification execution.',observations},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

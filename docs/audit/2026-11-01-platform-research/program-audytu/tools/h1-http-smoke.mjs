// Actual local Next HTTP + genuine PostgreSQL smoke, using only task-owned synthetic rows.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import PrismaPackage from '/workspace/polutek-pl/node_modules/@prisma/client/default.js';
const { PrismaClient } = PrismaPackage;
const root='/workspace/polutek-pl', out='/workspace/.cloud-setup/h1-real';
const node='/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin/node';
const meta=JSON.parse(readFileSync('/workspace/.cloud-setup/h1-db.json','utf8'));
const database=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost'].includes(database.hostname)||database.pathname!=='/'+meta.database||!meta.database.startsWith('polutek_h1_')) throw new Error('Refuse unowned database');
const prisma=new PrismaClient();
const token='httph1'+randomBytes(5).toString('hex');
const common={...process.env,PATH:node.slice(0,node.lastIndexOf('/'))+':'+process.env.PATH,
  ADMIN_DEV_FIXTURES:'0',ADMIN_DEV_BYPASS_ACCESS:'0',ADMIN_DEV_BYPASS_AUTH:'0',
  UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',KV_REST_API_URL:'',KV_REST_API_TOKEN:'',
  NEXT_TELEMETRY_DISABLED:'1',NEW_USER_NOTIFY_EMAIL:'off',TELEMETRY_BEACON:'off'};
const children=[];
const report={code_sha:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),date_utc:new Date().toISOString(),cases:[],
  scope:'Actual local public Next dev + built admin standalone; genuine Prisma/PostgreSQL, synthetic fixture only; memory limiter, no providers.',limitations:['Public dev smoke is not a production build or HLS/encoder E2E.','Admin checks deny access when Cloudflare configuration is missing; no successful admin login is claimed.']};
function start(args,env,name){
  const log=createWriteStream(out+'/'+name+'.log');
  const child=spawn(node,args,{cwd:root,env,stdio:['ignore','pipe','pipe'],detached:true});
  child.stdout.pipe(log);child.stderr.pipe(log);children.push(child);return child;
}
async function request(url){return fetch(url,{signal:AbortSignal.timeout(5000),redirect:'manual'});}
async function ready(url){
  for(let i=0;i<45;i++){
    try {const r=await request(url);await r.arrayBuffer();if(r.status===200)return;}catch{}
    await delay(1000);
  }
  throw new Error('Local server did not become ready');
}
function assertCase(id,condition,observed){report.cases.push({id,passed:Boolean(condition),observed});if(!condition)throw new Error(id+' failed');}
try {
  await prisma.$transaction(async tx=>{
    await tx.user.create({data:{id:token,email:token+'@example.test',name:token}});
    await tx.creator.create({data:{id:token+'-channel',userId:token,slug:token,name:token}});
    for(const status of ['PUBLISHED','DRAFT']) await tx.video.create({data:{id:token+'-'+status,creatorId:token+'-channel',title:token,slug:token+'-'+status.toLowerCase(),thumbnailUrl:'',status}});
  });
  start(['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3811'],{...common,NODE_ENV:'development',APP_ENV:'development'},'public-http-server');
  await ready('http://127.0.0.1:3811/api/health');
  const response=await request('http://127.0.0.1:3811/api/search?q='+token);
  const body=await response.json();
  assertCase('public-search-returns-owned-published-fixture',response.status===200&&body.items?.some(x=>x.id===token+'-PUBLISHED'),{status:response.status,items:body.items?.length});
  assertCase('public-search-hides-owned-draft',Array.isArray(body.items)&&!body.items.some(x=>x.id===token+'-DRAFT'),{draft_visible:body.items?.some(x=>x.id===token+'-DRAFT')});
  assertCase('search-private-no-store',response.headers.get('cache-control')==='private, no-store',{cache_control:response.headers.get('cache-control')});
  for(const child of children.splice(0))process.kill(-child.pid,'SIGTERM');
  await delay(1000);
  start(['apps/admin/.next/standalone/apps/admin/server.js'],{...common,NODE_ENV:'production',APP_ENV:'production',HOSTNAME:'127.0.0.1',PORT:'3812',ADMIN_AUTH_MODE:'access',CF_ACCESS_TEAM_DOMAIN:'',CF_ACCESS_AUD:''},'admin-http-server');
  await ready('http://127.0.0.1:3812/api/health');
  const denied=await request('http://127.0.0.1:3812/tresci');
  await denied.arrayBuffer();
  assertCase('built-admin-refuses-without-cloudflare-config',denied.status===503,{status:denied.status});
} catch(error){report.error=error.message;process.exitCode=1;}
finally {
  for(const child of children){try{process.kill(-child.pid,'SIGTERM');}catch{}}
  await prisma.video.deleteMany({where:{id:{in:[token+'-PUBLISHED',token+'-DRAFT']}}});
  await prisma.creator.deleteMany({where:{id:token+'-channel'}});
  await prisma.user.deleteMany({where:{id:token}});
  report.fixture_cleaned_up=await prisma.user.count({where:{id:token}})===0;
  await prisma.$disconnect();
  report.success=!report.error&&report.cases.length===4&&report.cases.every(x=>x.passed)&&report.fixture_cleaned_up;
  writeFileSync(out+'/http-smoke.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}

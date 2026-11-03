// Real Docker, but deliberately synthetic control images/quality receipts. Never application acceptance.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { releaseControl } from '/workspace/polutek-pl/tests/fixtures/release-control.mjs';
import { expectedLabels, IMAGE_KINDS } from '/workspace/polutek-pl/scripts/ops/release/policy.mjs';
import { hashJson } from '/workspace/polutek-pl/scripts/ops/release/source.mjs';
const root='/workspace/polutek-pl', out='/workspace/.cloud-setup/h1-release-core';
const cli=root+'/scripts/ops/release-proof.mjs';
const env={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};
for(const key of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
const docker=['--host=unix:///var/run/docker.sock'];
function command(program,args,input){const r=spawnSync(program,args,{cwd:root,env,encoding:'utf8',input,maxBuffer:16*1024*1024,timeout:120000});if(r.error)throw r.error;return r;}
const git=(...args)=>{const r=command('git',args);if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
if(git('status','--porcelain'))throw new Error('Use a clean committed candidate');
const report={code_sha:git('rev-parse','HEAD'),control_only:true,application_acceptance:false,published:false,started_at:new Date().toISOString(),checks:[],images:[]};
const save=()=>writeFileSync(out+'/docker-control-run.json',JSON.stringify(report,null,2)+'\n');save();
const f=releaseControl();
function check(name,args,expectedExit=0){
 const r=command(process.execPath,[cli,...args]);
 writeFileSync(out+'/'+name+'.log',r.stdout+r.stderr);
 report.checks.push({name,exit:r.status,expected_exit:expectedExit,signal:r.signal,matched:r.status===expectedExit});save();
 if(r.status!==expectedExit)throw new Error('Unexpected control result: '+name+' '+r.stderr);
 return r.stdout.trim()?JSON.parse(r.stdout):null;
}
function build(kind,reference,scratch=false){
 const labels=expectedLabels(f.report,f.inputs,f.revision,kind);
 const args=[...docker,'build','--network=none','--platform='+f.inputs.platform,'--progress=plain','-f','-','-t',reference];
 for(const [key,value]of Object.entries(labels))args.push('--label',key+'='+value);
 args.push(f.archive);
 const r=command('docker',args,'FROM '+(scratch?'scratch':f.inputs.bases.node)+'\nCOPY app.txt /control-source.txt\n');
 writeFileSync(out+'/build-'+kind+(scratch?'-wrong-base':'')+'.log',r.stdout+r.stderr);
 if(r.status!==0)throw new Error('Control build failed: '+r.stderr);
 const inspected=command('docker',[...docker,'image','inspect','--format','{{.Id}}',reference]);
 if(inspected.status!==0)throw new Error('Cannot inspect built control image');
 report.images.push({kind,reference,id:inspected.stdout.trim(),wrong_base:scratch});save();
}
try{
 const base=command('docker',[...docker,'image','inspect','--format','{{json .RepoDigests}}','node:22-bookworm-slim']);
 if(base.status!==0)throw new Error('Expected already-owned Node base image');
 const pinned=JSON.parse(base.stdout)[0];
 f.inputs.bases={node:pinned,ffmpeg:pinned,collector:pinned};
 report.control_revision=f.revision;report.control_source_fingerprint=f.source.fingerprint;report.pinned_node_base=pinned;save();
 const quality=out+'/control-quality.json',inputs=out+'/control-inputs.json',refs=out+'/control-images.json',proof=out+'/control-proof.json';
 writeFileSync(quality,JSON.stringify(f.report,null,2)+'\n');writeFileSync(inputs,JSON.stringify(f.inputs,null,2)+'\n');
 const prefix=['--revision='+f.revision,'--source='+f.archive];
 check('source-and-quality',['check-ci','--report='+quality,...prefix]);
 for(const kind of IMAGE_KINDS){f.references[kind]='polutek-release-control-'+kind+':'+f.revision.slice(0,12);build(kind,f.references[kind]);}
 writeFileSync(refs,JSON.stringify(f.references,null,2)+'\n');
 const sealed=check('seal',['seal','--report='+quality,...prefix,'--inputs='+inputs,'--images='+refs,'--out='+proof]);
 const approvedHash=sealed.proof_sha256;
 if(approvedHash!==hashJson(JSON.parse(readFileSync(proof,'utf8'))))throw new Error('Incorrect seal receipt hash');
 const verify=['verify','--proof='+proof,'--proof-sha256='+approvedHash,...prefix,'--inputs='+inputs];
 check('verify-all',verify);check('verify-app',[...verify,'--scope=app']);check('verify-admin',[...verify,'--scope=admin']);
 const original=JSON.parse(readFileSync(proof,'utf8'));const originalId=original.images.app.id;
 const retag=command('docker',[...docker,'tag',pinned,f.references.app]);if(retag.status!==0)throw new Error('Cannot retag owned control reference');
 const afterRetag=check('mutable-tag-does-not-redirect',verify);
 if(afterRetag.images.app!==originalId)throw new Error('Verifier followed a mutable tag');
 const changed=structuredClone(original);changed.images.app.id='sha256:'+'e'.repeat(64);writeFileSync(out+'/edited-proof.json',JSON.stringify(changed));
 check('edited-proof-rejected',['verify','--proof='+out+'/edited-proof.json','--proof-sha256='+approvedHash,...prefix,'--inputs='+inputs],1);
 check('wrong-approval-hash',['verify','--proof='+proof,'--proof-sha256='+'e'.repeat(64),...prefix,'--inputs='+inputs],1);
 check('wrong-revision',['verify','--proof='+proof,'--proof-sha256='+approvedHash,'--revision='+'f'.repeat(40),'--source='+f.archive,'--inputs='+inputs],1);
 const altered=structuredClone(f.inputs);altered.public_args.NEXT_PUBLIC_APP_NAME='changed after checks';writeFileSync(out+'/edited-inputs.json',JSON.stringify(altered));
 check('changed-inputs',['verify','--proof='+proof,'--proof-sha256='+approvedHash,...prefix,'--inputs='+out+'/edited-inputs.json'],1);
 writeFileSync(f.archive+'/app.txt','changed after approval');check('changed-source',verify,1);copyFileSync(f.repo+'/app.txt',f.archive+'/app.txt');
 for(const [name,id,status]of [['failed-type','typecheck','FAIL'],['failed-test','unit','FAIL'],['skipped-security','audit','SKIP']]){
  const bad={...f.report,results:f.report.results.map(g=>g.id===id?{...g,status}:g)};const badPath=out+'/'+name+'-quality.json';writeFileSync(badPath,JSON.stringify(bad));
  const destination=out+'/'+name+'-proof.json';
  check(name,['seal','--report='+badPath,...prefix,'--inputs='+inputs,'--images='+refs,'--out='+destination],1);
  if(existsSync(destination))throw new Error('Invalid control created a proof');
 }
 const wrongBase='polutek-release-control-wrongbase:'+f.revision.slice(0,12);build('app',wrongBase,true);
 const wrongRefs={...f.references,app:wrongBase};writeFileSync(out+'/wrong-base-images.json',JSON.stringify(wrongRefs));
 check('wrong-base-ancestry',['seal','--report='+quality,...prefix,'--inputs='+inputs,'--images='+out+'/wrong-base-images.json','--out='+out+'/wrong-base-proof.json'],1);
 report.finished_at=new Date().toISOString();report.all_control_expectations_passed=report.checks.every(c=>c.matched);report.release_ready=false;save();
 process.stdout.write('Real Docker control: '+report.checks.length+' expected results matched; six synthetic images, no application release.\n');
}finally{rmSync(f.directory,{recursive:true,force:true});}

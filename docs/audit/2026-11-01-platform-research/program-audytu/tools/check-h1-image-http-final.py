"""Exercise local HTTP inside the exact public/admin images, with no network or published ports."""
from pathlib import Path
import datetime,json,os,subprocess
OUT=Path('/workspace/.cloud-setup/h1-images-final')
r=json.loads((OUT/'images-run.json').read_text()); assert r['all_executed_checks_passed']
env=dict(os.environ)
for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(name,None)
docker=['docker','--host=unix:///var/run/docker.sock']
report=dict(code_sha=r['code_sha'],started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),network='none',published_ports=False,real_database=False,production_credentials=False,images=[])
for item in r['images']:
 if item['kind']=='worker':continue
 kind=item['kind']; name='polutek-h1-image-http-'+kind+'-'+r['code_sha'][:12]; port=3000 if kind=='public' else 3100
 cache='/app/.next/cache' if kind=='public' else '/app/apps/admin/.next/cache'
 args=docker+['run','--detach','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=1g','--cpus=2',
 '--tmpfs','/tmp:rw,nosuid,size=64m','--tmpfs',cache+':rw,nosuid,size=64m,uid=1000,gid=1000',
 '-e','DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/no_database','-e','BETTER_AUTH_SECRET=h1-synthetic-image-runtime-secret-not-production',item['image_id']]
 subprocess.run(args,env=env,check=True,stdout=subprocess.DEVNULL)
 try:
  script="""
const assert=require('node:assert/strict');
const sharp=require('sharp');
(async()=>{
 const base='http://127.0.0.1:PORT';
 let ready=false;
 for(let n=0;n<80;n++){try{await fetch(base+'/api/health');ready=true;break;}catch{} await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'server did not listen');
 const checks=[];
 async function expectStatus(path,status,name){ const res=await fetch(base+path); const bytes=Buffer.from(await res.arrayBuffer());assert.equal(res.status,status,name+': '+bytes.toString().slice(0,120));checks.push({name,status:res.status});return {res,bytes}; }
 await expectStatus('/api/health',200,'health-process-only');
 PUBLIC_CHECKS
 process.stdout.write(JSON.stringify({checks})+'\\n');
})().catch(e=>{process.stderr.write(e.stack+'\\n');process.exitCode=1;});
""".replace('PORT',str(port))
  public="""
 await expectStatus('/logo.png',200,'local-static-png');
 const {res,bytes}=await expectStatus('/_next/image?url=%2Flogo.png&w=64&q=75',200,'actual-next-image-optimizer');
 assert.ok(res.headers.get('content-type').startsWith('image/'));
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,64);
 await expectStatus('/_next/image?url=https%3A%2F%2Fexample.invalid%2Fimage.png&w=64&q=75',400,'unlisted-remote-host-rejected');
 await expectStatus('/_next/image?url=http%3A%2F%2F127.0.0.1%3A3000%2Flogo.png&w=64&q=75',400,'private-remote-host-rejected');
 await expectStatus('/_next/image?url=%2Ficon-brand.svg&w=64&q=75',400,'svg-optimizer-rejected');
 await expectStatus('/_next/image?url=%2Flogo.png&w=64&q=0',400,'invalid-quality-rejected');
"""
  admin="await expectStatus('/api/videos',503,'admin-fails-closed-without-access-config');"
  script=script.replace('PUBLIC_CHECKS',public if kind=='public' else admin)
  result=subprocess.run(docker+['exec',name,'node','-e',script],env=env,capture_output=True,text=True)
  (OUT/(kind+'-http-probe.log')).write_text(result.stdout+result.stderr)
  report['images'].append(dict(kind=kind,image_id=item['image_id'],exit=result.returncode,result=json.loads(result.stdout) if result.returncode==0 else None))
  (OUT/'http-run.json').write_text(json.dumps(report,indent=2)+'\n')
  if result.returncode:raise SystemExit('Image HTTP probe failed: '+kind)
  print(kind+': HTTP_PASS '+str(len(report['images'][-1]['result']['checks']))+' checks',flush=True)
 finally:
  logs=subprocess.run(docker+['logs','--tail=150',name],env=env,capture_output=True,text=True)
  (OUT/(kind+'-http-container.log')).write_text(logs.stdout+logs.stderr)
  subprocess.run(docker+['rm','--force',name],env=env,check=True,stdout=subprocess.DEVNULL)
report['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();report['all_executed_checks_passed']=True
(OUT/'http-run.json').write_text(json.dumps(report,indent=2)+'\n')

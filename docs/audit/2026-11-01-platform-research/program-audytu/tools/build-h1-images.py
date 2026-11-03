"""Build the committed candidate locally from git archive; never push images or deploy."""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, tarfile
ROOT=Path('/workspace/polutek-pl')
OUT=Path('/workspace/.cloud-setup/h1-images')
CTX=OUT/'context'
DOCKER=['docker','--host=unix:///var/run/docker.sock']
env=dict(os.environ)
for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']: env.pop(name,None)
def command(args,**kwargs):return subprocess.check_output(args,cwd=ROOT,env=env,text=True,**kwargs).strip()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
code=command(['git','rev-parse','HEAD'])
assert command(['git','branch','--show-current'])=='fix/polutek-h1-acceptance'
assert not command(['git','status','--porcelain'])
assert not CTX.exists(),'Use a new output directory; never overwrite an earlier candidate'
ca=Path(os.environ['CODEX_PROXY_CERT']); assert ca.is_file()
archive=OUT/'source.tar'
with archive.open('wb') as f:subprocess.run(['git','archive','--format=tar',code],cwd=ROOT,stdout=f,check=True)
CTX.mkdir()
with tarfile.open(archive) as t:t.extractall(CTX,filter='data')
args={'NEXT_PUBLIC_APP_URL':'http://127.0.0.1:3000','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY':'','NEXT_PUBLIC_R2_PUBLIC_HOST':'','NEXT_PUBLIC_BLOB_PUBLIC_HOST':''}
inputs=dict(code_sha=code,source_archive_sha256=digest(archive),public_build_args=args,
 files={f:digest(CTX/f) for f in ['package-lock.json','package.json','deploy/serwerek/Dockerfile','deploy/serwerek/Dockerfile.admin','.dockerignore','next.config.mjs','apps/admin/next.config.mjs']})
input_hash=hashlib.sha256(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode()).hexdigest()
report=dict(started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),code_sha=code,clean_source=True,inputs=inputs,inputs_sha256=input_hash,
 build_ca='Optional ephemeral BuildKit secret, no TLS bypass, never copied into image',
 image_id_type='Local Docker image configuration digest, not a pushed registry manifest digest',
 enforced_release_paths=False,release_ready=False,images=[],
 note='Local artifact evidence only. Existing server/GHCR/manual publication paths still need enforced source/input/test/digest verification.')
def save(): (OUT/'images-run.json').write_text(json.dumps(report,indent=2)+'\n')
save()
for kind,target,dockerfile in [('public','runner','deploy/serwerek/Dockerfile'),('admin','admin','deploy/serwerek/Dockerfile.admin'),('worker','worker','deploy/serwerek/Dockerfile')]:
 tag='polutek-h1-'+kind+':'+code[:12]
 build=DOCKER+['build','--progress=plain','--secret','id=proxy_ca,src='+str(ca),'-f',str(CTX/dockerfile),'--target',target,
 '--label','org.opencontainers.image.revision='+code,'--label','org.polutek.build.inputs='+input_hash,
 '--iidfile',str(OUT/(kind+'-image-id.txt')),'-t',tag]
 if kind=='public':
  for k,v in args.items():build += ['--build-arg',k+'='+v]
 build += [str(CTX)]
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (OUT/(kind+'-build.log')).open('w') as log:
  result=subprocess.run(build,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
 item=dict(kind=kind,target=target,tag=tag,started_at=started,build_exit=result.returncode,build_log=kind+'-build.log')
 report['images'].append(item);save()
 if result.returncode:raise SystemExit('Build failed: '+kind+'; see captured log')
 image=json.loads(command(DOCKER+['image','inspect',tag]))[0]
 assert image['Id']==(OUT/(kind+'-image-id.txt')).read_text().strip()
 assert image['Config']['Labels']['org.opencontainers.image.revision']==code
 assert image['Config']['Labels']['org.polutek.build.inputs']==input_hash
 item.update(image_id=image['Id'],repo_digests=image['RepoDigests'],architecture=image['Architecture'],os=image['Os'],image_user=image['Config']['User'],size_bytes=image['Size'])
 probe=DOCKER+['run','--rm','--network=none','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=128','--memory=1g','--cpus=2','--entrypoint=node',image['Id'],'-e',(OUT/'runtime-probe.cjs').read_text()]
 result=subprocess.run(probe,cwd=ROOT,env=env,capture_output=True,text=True)
 (OUT/(kind+'-probe.log')).write_text(result.stdout+result.stderr)
 item.update(probe_exit=result.returncode,probe_log=kind+'-probe.log');save()
 if result.returncode:raise SystemExit('Runtime probe failed: '+kind)
 parsed=json.loads(result.stdout)
 lock=json.loads((CTX/'package-lock.json').read_text())['packages']
 assert parsed['next']==lock['node_modules/next']['version']
 assert parsed['sharp']['sharp']==lock['node_modules/sharp']['version']
 assert tuple(map(int,parsed['sharp']['rsvg'].split('.'))) >= (2,63,2)
 assert tuple(map(int,parsed['sharp']['vips'].split('.'))) >= (8,18,7)
 item['runtime']=parsed;save()
 print(kind+': BUILD_AND_RUNTIME_PASS '+image['Id'],flush=True)
report.update(finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),all_executed_checks_passed=True)
save()

"""Actual deploy.sh control flow with total Docker/curl/host-mutation stubs.
No deployment, image build/pull, database, host directories, SSH or provider access.
"""
import csv,gzip,hashlib,json,subprocess,tempfile
from pathlib import Path
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
SOURCE='deploy/serwerek/deploy.sh';raw=(ROOT/SOURCE).read_bytes()
inventory={r['path']:r['sha256']for r in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())};assert hashlib.sha256(raw).hexdigest()==inventory[SOURCE]
DISPATCH=r'''#!/usr/bin/python3
import json,os,sys
from pathlib import Path
cmd=Path(sys.argv[0]).name;a=sys.argv[1:];r=Path(os.environ['RESEARCH_ROOT']);mode=os.environ['RESEARCH_MODE']
entry={'command':cmd,'args':a,'app_image':os.environ.get('APP_IMAGE'),'worker_image':os.environ.get('ENCODER_IMAGE')}
with (r/'commands.jsonl').open('a')as f:f.write(json.dumps(entry)+'\n')
if cmd in ['mkdir','chown','sleep']:sys.exit(0)
if cmd=='flock':sys.exit(1 if mode=='lock_busy'else 0)
if cmd=='curl':
 sys.stdin.read()
 print('{"ok":false,"database":"failed"}'if mode=='readiness_failure'else '{"ok":true,"database":"ok"}')
 sys.exit(0)
if cmd!='docker':raise SystemExit('Unknown command')
if a[0]=='image'and a[1]=='inspect':sys.exit(0)
if a[0]=='inspect':
 print('healthy'if 'Health.Status'in a[2]else 'running');sys.exit(0)
if a[0]=='images':sys.exit(0)
if a[0]in ['rmi','builder']:sys.exit(0)
if a[0]=='image'and a[1]=='prune':sys.exit(0)
if a[0]=='compose':
 q=a[1:]
 if q[:2]==['--profile','tools']:q=q[2:]
 if q[0]=='ps':print('cid-'+q[-1]);sys.exit(0)
 if q[0]=='exec':
  print('-- SYNTHETIC pre-deploy SQL prefix')
  sys.exit(44 if mode=='predeploy_dump_failure'else 0)
 if q[0]=='run':sys.exit(12 if mode=='migration_failure'else 0)
 if q[0]=='up':
  svc=q[-1]
  if (mode=='new_app_start_failure'and svc=='app'and os.environ.get('APP_IMAGE')=='polutek-app:new')or(mode=='worker_start_failure'and svc=='encoder'):sys.exit(13)
  sys.exit(0)
 if q[0]=='logs':print('synthetic container log, no production data');sys.exit(0)
raise SystemExit('Unmodeled Docker boundary '+repr(a))
'''
observations=[]
for mode in ['healthy','predeploy_dump_failure','migration_failure','new_app_start_failure','readiness_failure','worker_start_failure','lock_busy','manual_rollback']:
 with tempfile.TemporaryDirectory(prefix='audit-deploy-')as directory:
  r=Path(directory);app=r/'app';app.mkdir();(r/'bin').mkdir();(r/'backups').mkdir()
  (app/'deploy.sh').write_bytes(raw)
  for name,value in {'app.env':'HEALTHCHECK_TOKEN=synthetic-diagnostic-token\n','db.env':'POSTGRES_USER=synthetic\n','docker-compose.yml':'services: {}\n','.current-image':'polutek-app:old','.previous-image':'polutek-app:older','.current-worker-image':'polutek-worker:old'}.items():(app/name).write_text(value)
  if mode=='worker_start_failure':(app/'worker.env').write_text('SYNTHETIC=1\n')
  (r/'common.sh').write_text('job_run() { printf "%s|%s|%s\\n" "$1" "$2" "$4" >> "$RESEARCH_ROOT/jobs.log"; }\n')
  (r/'dispatch.py').write_text(DISPATCH);(r/'dispatch.py').chmod(0o755)
  for command in ['docker','curl','mkdir','chown','sleep','flock']:(r/'bin'/command).symlink_to(r/'dispatch.py')
  env={'PATH':str(r/'bin')+':/usr/bin:/bin','RESEARCH_ROOT':str(r),'RESEARCH_MODE':mode,'BACKUP_DIR':str(r/'backups'),'SERWEREK_COMMON':str(r/'common.sh'),'HEALTH_TIMEOUT':'2','START_SETTLE':'0'}
  args=['new','--rollback']if mode=='manual_rollback'else ['new']
  run=subprocess.run(['/bin/bash',str(app/'deploy.sh'),*args],cwd=app,env=env,capture_output=True,text=True,timeout=20)
  commands=[json.loads(s)for s in(r/'commands.jsonl').read_text().splitlines()]
  expected=75 if mode=='lock_busy'else 1 if mode in ['predeploy_dump_failure','migration_failure','new_app_start_failure']else 0
  assert run.returncode==expected,(mode,run.stdout,run.stderr)
  current=(app/'.current-image').read_text();migrations=[c for c in commands if c['command']=='docker'and'migrate'in c['args']]
  starts=[c['app_image']for c in commands if c['command']=='docker'and c['args'][:2]==['compose','up']and c['args'][-1]=='app']
  if mode in ['healthy','readiness_failure','worker_start_failure']:assert current=='polutek-app:new'
  if mode in ['predeploy_dump_failure','migration_failure','lock_busy']:assert not starts and current=='polutek-app:old'
  if mode=='predeploy_dump_failure':assert not migrations and not list((r/'backups').glob('*.gz'))
  if mode=='new_app_start_failure':assert starts==['polutek-app:new','polutek-app:old']and current=='polutek-app:old'
  if mode=='lock_busy':assert not[c for c in commands if c['command']=='docker']
  if mode=='manual_rollback':assert current=='polutek-app:older'and not migrations and not list((r/'backups').glob('*.gz'))
  if mode in ['readiness_failure','worker_start_failure']:assert 'OK (WITH WARNINGS)'in run.stdout
  if mode=='worker_start_failure':assert(app/'.current-worker-image').read_text()=='polutek-worker:old'
  for p in(r/'backups').glob('*.gz'):assert gzip.decompress(p.read_bytes()).startswith(b'-- SYNTHETIC')
  assert 'synthetic-diagnostic-token'not in run.stdout+run.stderr
  observations.append({'case':mode,'script_exit':run.returncode,'current_app_image':current,'app_start_attempts':starts,'migration_attempts':len(migrations),'warning_outcome':'OK (WITH WARNINGS)'in run.stdout,'real_Docker_calls':0,'real_network_calls':0,'log':run.stdout+run.stderr,'classification':'EXPLICIT_WARNING_POLICY_R18'if mode=='readiness_failure'else 'POSITIVE_CONTROL_OR_DECLARED_OPTIONAL_SERVICE_POLICY'})
result={'date':'2026-11-02','actual_source':SOURCE,'sha256':inventory[SOURCE],'observations':observations,'real_Docker_calls':0,'real_network_calls':0,'production_access':False,'boundaries':['Full unchanged deploy.sh from temporary copy; fake common.sh only records local job status','All Docker/curl/flock/sleep and host mkdir/chown commands stubbed; real file state/gzip only inside temp tree','No real images, migrations, container health, lock contention, application, database, services, SSH or production','Rollback demonstrates image control flow only; no restored schema or migration atomicity guarantee']}
(BASE/'evidence/deployment-boundaries-experiment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'observations':len(observations),'real_deployments':0,'real_network_calls':0}))

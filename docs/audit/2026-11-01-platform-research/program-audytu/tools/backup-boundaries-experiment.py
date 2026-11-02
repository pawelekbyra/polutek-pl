"""Unchanged backup.sh in a temp tree. All service/archive/provider commands are fakes.
Only gzip/stat/hash/local-file operations are real. Never reads real env files or sends data.
"""
import csv,gzip,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
SOURCE='scripts/serwerek/backup.sh';raw=(ROOT/SOURCE).read_bytes()
inventory={r['path']:r['sha256']for r in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())}
assert hashlib.sha256(raw).hexdigest()==inventory[SOURCE]
DISPATCH=r'''#!/usr/bin/python3
import hashlib,json,os,subprocess,sys
from pathlib import Path
cmd=Path(sys.argv[0]).name;a=sys.argv[1:];r=Path(os.environ['RESEARCH_ROOT']);mode=os.environ['RESEARCH_MODE']
with (r/'commands.jsonl').open('a') as f:f.write(json.dumps({'cmd':cmd,'operation':a[:3]})+'\n')
if cmd=='docker':
 if a[0]=='ps':
  if mode=='missing_required':print('')
  else:print('research-db postgres:synthetic')
  sys.exit(0)
 if a[:3]==['exec','research-db','printenv']:print('synthetic');sys.exit(0)
 if a[:3]==['exec','research-db','pg_dumpall']:
  if mode!='empty_dump_failure':
   print('-- Synthetic prefix, not a complete database backup')
   for i in range(400):print('-- '+hashlib.sha256(str(i).encode()).hexdigest())
  sys.exit(42 if mode in ['partial_dump_failure','empty_dump_failure'] else 0)
 raise SystemExit('Unexpected docker command')
if cmd=='tar':
 key='czf' if 'czf'in a else '-czf';target=a[a.index(key)+1]
 if target=='-':
  sys.stdout.buffer.write(b'SYNTHETIC_ARCHIVE_STREAM_NO_REAL_SECRETS')
  sys.exit(7 if mode=='secrets_tar_failure'else 0)
 p=Path(target);assert p.is_relative_to(r);p.write_bytes(b'SYNTHETIC_CONFIG_ARCHIVE_NOT_A_REAL_TAR');sys.exit(0)
if cmd=='age':
 target=Path(a[a.index('-o')+1]);assert target.is_relative_to(r)
 if mode=='encryption_failure':sys.exit(8)
 source=a[-1] if a[-1]!=str(target)else None
 data=Path(source).read_bytes() if source else sys.stdin.buffer.read()
 target.write_bytes(b'FAKE_ENCRYPTION_NOT_AGE:'+data);sys.exit(0)
if cmd=='rclone':sys.exit(9 if mode=='offsite_check_failure'and a[0]=='check'else 0)
if cmd in ['find','ls']:
 if a and (a[0].startswith('/opt/')or a[0].startswith('/etc/')):sys.exit(0)
 sys.exit(subprocess.run(['/usr/bin/'+cmd,*a]).returncode)
raise SystemExit('Unexpected fake command')
'''
observations=[]
for mode in ['healthy','missing_required','empty_dump_failure','partial_dump_failure','secrets_tar_failure','offsite_check_failure','encryption_failure']:
 with tempfile.TemporaryDirectory(prefix='audit-backup-')as directory:
  r=Path(directory);(r/'bin').mkdir();(r/'backups').mkdir()
  (r/'backup.sh').write_bytes(raw)
  (r/'common.sh').write_text('write_status() { printf "%s %s\\n" "$2" "$3" > "$RESEARCH_ROOT/status.txt"; }\njob_run() { printf "%s|%s\\n" "$1" "$2" >> "$RESEARCH_ROOT/jobs.txt"; }\n')
  (r/'backup.env').write_text('AGE_RECIPIENT=synthetic-public-key\nR2_ACCESS_KEY_ID=synthetic\nR2_SECRET_ACCESS_KEY=synthetic\nR2_ENDPOINT=https://example.invalid\n')
  (r/'dispatch.py').write_text(DISPATCH);(r/'dispatch.py').chmod(0o755)
  for name in ['docker','tar','age','rclone','find','ls']:(r/'bin'/name).symlink_to(r/'dispatch.py')
  env={'PATH':str(r/'bin')+':/usr/bin:/bin','RESEARCH_ROOT':str(r),'RESEARCH_MODE':mode,'BACKUP_DIR':str(r/'backups'),'BACKUP_LOG':str(r/'backup.log'),'BACKUP_ENV_FILE':str(r/'backup.env'),'BACKUP_REQUIRED_DBS':'research-db'}
  run=subprocess.run(['/bin/bash',str(r/'backup.sh')],cwd=r,env=env,capture_output=True,text=True,timeout=25)
  assert run.returncode in [0,1],(mode,run.stderr)
  log=(r/'backup.log').read_text();manifest=next((r/'backups').glob('manifest-*')).read_text()
  dumps=list((r/'backups').glob('pg-*.gz'));valid=all(gzip.decompress(p.read_bytes()).startswith(b'-- Synthetic')for p in dumps)
  status=(r/'status.txt').read_text().split()[0]
  expected_ok=mode=='healthy'
  assert(run.returncode==0)==expected_ok,(mode,log,run.stderr)
  assert(status=='ok')==expected_ok and ('complete=yes'in manifest)==(mode not in ['missing_required','empty_dump_failure','partial_dump_failure'])
  if mode=='partial_dump_failure':assert not dumps and 'pg dump FAILED: research-db'in log
  if mode=='empty_dump_failure':assert not dumps and 'pg dump FAILED'in log
  if mode=='secrets_tar_failure':assert 'secrets FAILED'in log
  commands=[json.loads(s)for s in(r/'commands.jsonl').read_text().splitlines()]
  observations.append({'case':mode,'script_exit':run.returncode,'recorded_status':status,'manifest_complete_before_offsite':'complete=yes'in manifest,'local_dump_files':len(dumps),'gzip_checked_real':bool(dumps)and valid,'synthetic_producer_exit':42 if mode in ['partial_dump_failure','empty_dump_failure']else 7 if mode=='secrets_tar_failure'else 0,'finding':None,'classification':'POSITIVE_CONTROL_PIPEFAIL_AND_FAILURE_STATUS','log':log,'fake_command_count':len(commands),'real_network_calls':0})
result={'date':'2026-11-02','actual_source':SOURCE,'sha256':inventory[SOURCE],'observations':observations,'real_network_calls':0,'real_Docker_calls':0,'real_secrets_read':False,'real_encryption_or_upload_verified':False,'boundaries':['Full unchanged backup script executed from temp copy; common.sh is an explicit local status/job fixture','Docker/tar/age/rclone are total command stubs; /opt and /etc find/ls paths suppressed','Real gzip/file size/hash and pipeline exit semantics, synthetic producer bytes and failures','No actual PostgreSQL dump, encryption, R2, provider, production data or restoration; production incidence unverified']}
(BASE/'evidence/backup-boundaries-experiment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'observations':len(observations),'new_findings':[],'real_network_calls':0}))

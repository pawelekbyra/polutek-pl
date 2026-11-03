"""Real LOCAL PostgreSQL dump/gzip/restore of baseline migrations and synthetic rows.
Creates and drops only two own databases with a random research prefix. No app/Prisma/R2.
"""
import csv,gzip,hashlib,json,os,subprocess,time,uuid
from pathlib import Path
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
ENV=dict(os.environ)
for k in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:ENV.pop(k,None)
DOCKER=['docker','--host=unix:///var/run/docker.sock'];CONTAINER='polutek-cloud-db'
prefix='polutek_audit_restore_'+uuid.uuid4().hex[:12];source_db=prefix+'_source';target_db=prefix+'_target'
assert all(n.startswith('polutek_audit_restore_')and n.replace('_','').isalnum()for n in [source_db,target_db])
inventory={r['path']:r['sha256']for r in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())}
migrations=sorted((ROOT/'prisma/migrations').glob('*/migration.sql'));hashes={}
for p in migrations:
 rel=str(p.relative_to(ROOT));h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==inventory[rel];hashes[rel]=h
def docker(args,data=None,check=True):
 r=subprocess.run(DOCKER+['exec','-i',CONTAINER,*args],input=data,capture_output=True,env=ENV,timeout=45)
 if check and r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-1400:])
 return r
def sql(db,text,check=True):return docker(['sh','-c','exec psql -U "$POSTGRES_USER" -d "$1" -X -qAt -v ON_ERROR_STOP=1','sh',db],text.encode(),check)
snapshot_sql='''SELECT json_build_object(
 'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
 'constraints',(SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
 'indexes',(SELECT count(*) FROM pg_indexes WHERE schemaname='public'),
 'triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
 'user',(SELECT row_to_json(x) FROM (SELECT id,email FROM "User")x),
 'video',(SELECT row_to_json(x) FROM (SELECT id,"creatorId",title,slug,status,"updatedAt" FROM "Video")x),
 'asset',(SELECT row_to_json(x) FROM (SELECT id,"videoId",provider,"objectKey" FROM "VideoAsset")x),
 'payment',(SELECT row_to_json(x) FROM (SELECT id,"userId","amountMinor",currency,status FROM "Payment")x),
 'grant',(SELECT row_to_json(x) FROM (SELECT id,"userId","paymentId",source FROM "PatronGrant")x));'''
created=[];result=None
try:
 for db in [source_db,target_db]:sql('postgres','CREATE DATABASE "'+db+'";');created.append(db)
 t=time.monotonic();sql(source_db,'\n'.join(p.read_text()for p in migrations));migration_seconds=time.monotonic()-t
 sql(source_db,'''INSERT INTO "User"(id,email,"updatedAt") VALUES ('research-user','restore@example.invalid',now());
 INSERT INTO "Creator"(id,"userId",slug,name,"updatedAt") VALUES ('research-channel','research-user','research-channel','Synthetic channel',now());
 INSERT INTO "Video"(id,"creatorId",title,slug,"thumbnailUrl","updatedAt") VALUES ('research-video','research-channel','Synthetic restored video','research-video','/synthetic-thumb',now());
 INSERT INTO "VideoAsset"(id,"videoId",provider,"objectKey","updatedAt") VALUES ('research-asset','research-video','SELF_HLS','synthetic/no-real-objects/master.m3u8',now());
 INSERT INTO "Payment"(id,"userId","amountMinor",currency,status,"updatedAt") VALUES ('research-payment','research-user',1000,'PLN','SUCCEEDED',now());
 INSERT INTO "PatronGrant"(id,"userId","paymentId",source) VALUES ('research-grant','research-user','research-payment','PAYMENT');''')
 before=json.loads(sql(source_db,snapshot_sql).stdout)
 t=time.monotonic();dump=docker(['sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges','sh',source_db]).stdout
 compressed=gzip.compress(dump);assert gzip.decompress(compressed)==dump;dump_seconds=time.monotonic()-t
 t=time.monotonic();sql(target_db,gzip.decompress(compressed).decode());restore_seconds=time.monotonic()-t
 after=json.loads(sql(target_db,snapshot_sql).stdout);assert before==after
 invalid_fk=sql(target_db,'''INSERT INTO "VideoAsset"(id,"videoId",provider,"objectKey","updatedAt") VALUES ('research-bad','missing-video','SELF_HLS','synthetic',now());''',False)
 assert invalid_fk.returncode!=0 and b'foreign key constraint'in invalid_fk.stderr
 duplicate=sql(target_db,'''INSERT INTO "User"(id,email,"updatedAt") VALUES ('research-other','restore@example.invalid',now());''',False)
 assert duplicate.returncode!=0 and b'unique constraint'in duplicate.stderr
 assert json.loads(sql(target_db,snapshot_sql).stdout)==after
 version=sql(target_db,'SHOW server_version;').stdout.decode().strip()
 result={'date':'2026-11-02','kind':'REAL_LOCAL_POSTGRES_DUMP_GZIP_RESTORE_SYNTHETIC_BASELINE_SCHEMA','server_version':version,'migration_files_applied':len(migrations),'migration_source_sha256':hashes,'snapshot_before':before,'snapshot_after':after,'observations':[{'case':'baseline_schema_and_synthetic_relations_restored','result':'EXACT_SELECTED_SNAPSHOT_MATCH'},{'case':'restored_foreign_key_rejects_orphan','result':'REJECTED'},{'case':'restored_unique_rejects_duplicate','result':'REJECTED'}],'dump_bytes':len(dump),'gzip_bytes':len(compressed),'dump_sha256':hashlib.sha256(dump).hexdigest(),'timings_seconds_local_only':{'apply_migrations':round(migration_seconds,3),'dump_and_gzip':round(dump_seconds,3),'restore':round(restore_seconds,3)},'raw_dump_saved':False,'real_network_provider_or_production_calls':0,'boundaries':['Actual PostgreSQL in existing local container over explicitly selected local Unix Docker socket','All baseline SQL migrations applied directly to a new empty database; NOT Prisma migration engine/history','Synthetic account/channel/video/asset/payment/grant only, no real video objects or money','pg_dump of database with --no-owner --no-privileges; NOT production pg_dumpall/roles or the weekly restore script','No age/R2/private key/offsite retrieval, Next application, functional playback, production RPO/RTO, large dataset or owner recovery proof']}
finally:
 for db in reversed(created):sql('postgres','DROP DATABASE "'+db+'" WITH (FORCE);')
 if created:
  remaining=sql('postgres',"SELECT count(*) FROM pg_database WHERE datname IN ("+','.join("'"+n+"'"for n in created)+");").stdout.decode().strip();assert remaining=='0'
if result:
 result['own_databases_removed']=True
 (BASE/'evidence/database-restore-drill.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'migrations':len(migrations),'observations':3,'snapshot_equal':True,'own_databases_removed':True,'version':version}))

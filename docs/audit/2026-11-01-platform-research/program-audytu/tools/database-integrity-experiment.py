"""Research against the existing LOCAL PostgreSQL migration-test database, via its Docker socket.

No Prisma replacement, production credentials, schema fixes, or application server.
Integrity probes use temporary functions and an outer ROLLBACK. Quota fixtures have
random IDs; only their exact channel/user rows are cleaned up after committed probes.
Quota statements reproduce the inspected COUNT -> INSERT transaction protocol;
they do not execute the TypeScript use case, audit insertion, or HTTP authorization.
Run from repository root: python3 <this file>.
"""
import hashlib
import csv
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import uuid

ROOT = Path.cwd()
BASE = ROOT / 'docs/audit/2026-11-01-platform-research/program-audytu'
DATABASE = json.loads((BASE.parent / 'migrations-sql.json').read_text())['database']
assert DATABASE.startswith('polutek_research_') and DATABASE.replace('_', '').isalnum()
LOCAL_ENV = dict(os.environ)
for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
    LOCAL_ENV.pop(key, None)
CMD = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', 'polutek-cloud-db',
       'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$1" -X -qAt -v ON_ERROR_STOP=1', 'sh', DATABASE]


class Session:
    def __init__(self):
        self.p = subprocess.Popen(CMD, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, bufsize=1, env=LOCAL_ENV)
        self.out = queue.Queue()
        self.errors = []
        self.counter = 0
        def pump():
            for line in self.p.stdout:
                self.out.put(line.rstrip('\n'))
            self.out.put(None)
        def errors():
            for line in self.p.stderr:
                self.errors.append(line.rstrip('\n'))
        threading.Thread(target=pump, daemon=True).start()
        threading.Thread(target=errors, daemon=True).start()

    def query(self, sql):
        self.counter += 1
        marker = f'AUDIT_QUERY_END_{self.counter}'
        self.p.stdin.write(sql.rstrip(';\n') + ';\n\\echo ' + marker + '\n')
        self.p.stdin.flush()
        lines = []
        while True:
            line = self.out.get(timeout=25)
            if line == marker:
                return [x for x in lines if x]
            if line is None:
                raise RuntimeError('Local psql exited: ' + '\n'.join(self.errors[-8:]))
            lines.append(line)

    def one(self, sql):
        rows = self.query(sql)
        assert rows, 'Expected a scalar result'
        # PostgreSQL json_agg(record) can include embedded newlines inside one scalar cell.
        return '\n'.join(rows)

    def close(self):
        if self.p.poll() is None:
            try:
                self.p.stdin.write('\\q\n')
                self.p.stdin.flush()
                self.p.wait(timeout=4)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self.p.kill()
                self.p.wait(timeout=4)


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def user_sql(prefix):
    return f'''INSERT INTO "User" ("id","email","updatedAt") VALUES ({q(prefix+'-u')},{q(prefix+'@example.invalid')},now());'''


def channel_sql(prefix, suffix='a'):
    return f'''INSERT INTO "Creator" ("id","userId","slug","name","updatedAt")
      VALUES ({q(prefix+'-c-'+suffix)},{q(prefix+'-u')},{q(prefix+'-'+suffix)},'Research fixture',now());'''


def main():
    inventory={row['path']:row['sha256'] for row in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())}
    source_paths=['prisma/schema.prisma','lib/modules/playlists/application/playlist-manage.use-cases.ts',
                  'lib/modules/playlists/infrastructure/playlist.repository.ts','lib/modules/playlists/domain/playlist-rules.ts',
                  'lib/modules/video-pipeline/application/original-upload.use-cases.ts','lib/modules/video-pipeline/application/encode-queue.use-cases.ts']
    for source_path in source_paths:
        assert hashlib.sha256((ROOT/source_path).read_bytes()).hexdigest()==inventory[source_path], 'Application baseline changed: '+source_path
    admin = Session()
    try:
        metadata = json.loads(admin.one("SELECT json_build_object('database',current_database(),'server_version',current_setting('server_version'),'transaction_isolation',current_setting('transaction_isolation'))"))
        assert metadata['database'] == DATABASE
        tables = ['User', 'Creator', 'Video', 'VideoAsset', 'VideoOriginal', 'VideoEncodeJob',
                  'VideoPlaybackRoute', 'Playlist', 'PlaylistItem', 'ModerationDecision', 'AuditLog', 'LedgerEntry', 'DurableJob']
        names = ','.join(q(x) for x in tables)
        catalog = {'database_metadata': metadata}
        for label, sql in {
            'constraints': f'''SELECT coalesce(json_agg(x),'[]'::json) FROM (
                SELECT c.relname AS table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) AS definition
                FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
                JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ({names})
                ORDER BY c.relname,k.conname) x''',
            'indexes': f'''SELECT coalesce(json_agg(x),'[]'::json) FROM (
                SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
                AND tablename IN ({names}) ORDER BY tablename,indexname) x''',
            'triggers': f'''SELECT coalesce(json_agg(x),'[]'::json) FROM (
                SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
                FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN ({names}) ORDER BY c.relname,t.tgname) x''',
        }.items():
            catalog[label] = json.loads(admin.one(sql))
        (BASE / 'evidence/database-catalog-batch05.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
        prefix = 'audit-d06-' + uuid.uuid4().hex[:12]
        a, b = prefix+'-v-a', prefix+'-v-b'
        ca, cb = prefix+'-c-a', prefix+'-c-b'
        aa, ab = prefix+'-asset-a', prefix+'-asset-b'
        oa, ob = prefix+'-original-a', prefix+'-original-b'
        ra, rb = prefix+'-route-a', prefix+'-route-b'
        pa = prefix+'-playlist-a'
        admin.query("BEGIN; SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='3s';" + user_sql(prefix) + channel_sql(prefix) + channel_sql(prefix, 'b') + f'''
          INSERT INTO "Video" ("id","creatorId","title","slug","thumbnailUrl","updatedAt") VALUES
          ({q(a)},{q(ca)},'Fixture A',{q(a)},'/fixture',now()),({q(b)},{q(cb)},'Fixture B',{q(b)},'/fixture',now());
          INSERT INTO "VideoAsset" ("id","videoId","provider","objectKey","updatedAt") VALUES
          ({q(aa)},{q(a)},'SELF_HLS','fixture/a',now()),({q(ab)},{q(b)},'SELF_HLS','fixture/b',now());
          INSERT INTO "VideoOriginal" ("id","videoId","bucket","objectKey","version","updatedAt") VALUES
          ({q(oa)},{q(a)},'fixture','a',1,now()),({q(ob)},{q(b)},'fixture','b',1,now());
          INSERT INTO "VideoPlaybackRoute" ("id","videoId","assetId","provider","updatedAt") VALUES
          ({q(ra)},{q(a)},{q(aa)},'SELF_HLS',now()),({q(rb)},{q(b)},{q(ab)},'SELF_HLS',now());
          INSERT INTO "VideoEncodeJob" ("id","videoId","originalId","versionNumber","idempotencyKey","updatedAt")
          VALUES ({q(prefix+'-job')},{q(a)},{q(oa)},1,{q(prefix+'-idem')},now());
          INSERT INTO "Playlist" ("id","channelId","title","slug","updatedAt") VALUES ({q(pa)},{q(ca)},'Fixture','fixture',now());
          INSERT INTO "PlaylistItem" ("id","playlistId","videoId","position") VALUES ({q(prefix+'-item')},{q(pa)},{q(a)},0);
          INSERT INTO "ModerationDecision" ("id","targetType","targetId","action","reasonCode","reasonPublic")
          VALUES ({q(prefix+'-decision')},'VIDEO',{q(a)},'VIDEO_REMOVED','FIXTURE','Research fixture');
          INSERT INTO "AuditLog" ("id","action","ip","userAgent") VALUES ({q(prefix+'-audit')},'RESEARCH_FIXTURE','192.0.2.1','fixture');
        ''')
        # Always roll successful test mutations back inside the function as well as rolling back all fixtures.
        admin.query('''CREATE FUNCTION pg_temp.audit_probe(label text, statement text) RETURNS jsonb LANGUAGE plpgsql AS $$
          DECLARE state text; constraint_name text;
          BEGIN
            BEGIN
              EXECUTE statement;
              RAISE EXCEPTION USING ERRCODE='PZ001', MESSAGE='probe accepted; rollback successful mutation';
            EXCEPTION
              WHEN SQLSTATE 'PZ001' THEN RETURN jsonb_build_object('id',label,'database_accepted',true,'sqlstate',null);
              WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,constraint_name=CONSTRAINT_NAME;
                RETURN jsonb_build_object('id',label,'database_accepted',false,'sqlstate',state,'constraint',constraint_name);
            END;
          END; $$''')
        probes = [
            ('D06-01','Foreign key rejects missing video', False,
             f'''INSERT INTO "VideoAsset" ("id","videoId","provider","objectKey","updatedAt") VALUES ({q(prefix+'-bad')},'missing','SELF_HLS','x',now())'''),
            ('D06-02','Original version unique per video',False,
             f'''INSERT INTO "VideoOriginal" ("id","videoId","bucket","objectKey","version","updatedAt") VALUES ({q(prefix+'-bad')},{q(a)},'fixture','other',1,now())'''),
            ('D06-03','Encode idempotency key unique',False,
             f'''INSERT INTO "VideoEncodeJob" ("id","videoId","originalId","versionNumber","idempotencyKey","updatedAt") VALUES ({q(prefix+'-bad')},{q(a)},{q(oa)},2,{q(prefix+'-idem')},now())'''),
            ('D06-04','Playlist item video unique within playlist',False,
             f'''INSERT INTO "PlaylistItem" ("id","playlistId","videoId","position") VALUES ({q(prefix+'-bad')},{q(pa)},{q(a)},1)'''),
            ('D06-05','Active original can reference another video at DB level',True,
             f'''UPDATE "Video" SET "activeOriginalId"={q(ob)} WHERE "id"={q(a)}'''),
            ('D06-06','Active playback route can reference another video at DB level',True,
             f'''UPDATE "Video" SET "activePlaybackRouteId"={q(rb)} WHERE "id"={q(a)}'''),
            ('D06-07','Route can bind asset of another video at DB level',True,
             f'''INSERT INTO "VideoPlaybackRoute" ("id","videoId","assetId","provider","updatedAt") VALUES ({q(prefix+'-bad')},{q(a)},{q(ab)},'SELF_HLS',now())'''),
            ('D06-08','Job can bind original of another video at DB level',True,
             f'''INSERT INTO "VideoEncodeJob" ("id","videoId","originalId","versionNumber","idempotencyKey","updatedAt") VALUES ({q(prefix+'-bad')},{q(a)},{q(ob)},2,{q(prefix+'-other-idem')},now())'''),
            ('D06-09','Playlist can bind video of another channel at DB level',True,
             f'''INSERT INTO "PlaylistItem" ("id","playlistId","videoId","position") VALUES ({q(prefix+'-bad')},{q(pa)},{q(b)},1)'''),
            ('D06-10','More than one ACTIVE route per video is allowed at DB level',True,
             f'''INSERT INTO "VideoPlaybackRoute" ("id","videoId","assetId","provider","updatedAt") VALUES ({q(prefix+'-bad')},{q(a)},{q(aa)},'SELF_HLS',now())'''),
            ('D06-11','Moderation decision UPDATE refused by trigger',False,
             f'''UPDATE "ModerationDecision" SET "reasonPublic"='changed' WHERE "id"={q(prefix+'-decision')}'''),
            ('D06-12','Moderation decision DELETE refused by trigger',False,
             f'''DELETE FROM "ModerationDecision" WHERE "id"={q(prefix+'-decision')}'''),
            ('D06-13','Audit content UPDATE refused by trigger',False,
             f'''UPDATE "AuditLog" SET "action"='changed' WHERE "id"={q(prefix+'-audit')}'''),
            ('D06-14','Recent audit DELETE refused by trigger',False,
             f'''DELETE FROM "AuditLog" WHERE "id"={q(prefix+'-audit')}'''),
            ('D06-15','Audit anonymization allowed by documented exception',True,
             f'''UPDATE "AuditLog" SET "ip"=null,"userAgent"=null WHERE "id"={q(prefix+'-audit')}'''),
        ]
        results=[]
        for ident,title,expected,sql in probes:
            result=json.loads(admin.one(f'SELECT pg_temp.audit_probe({q(ident)},{q(sql)})'))
            assert result['database_accepted']==expected,(ident,result)
            expected_state = '23503' if ident == 'D06-01' else '23505' if ident in ['D06-02','D06-03','D06-04'] else 'P0001' if ident in ['D06-11','D06-12','D06-13','D06-14'] else None
            assert result['sqlstate']==expected_state,(ident,result)
            expected_constraints={'D06-01':'VideoAsset_videoId_fkey','D06-02':'VideoOriginal_videoId_version_key',
                                  'D06-03':'VideoEncodeJob_idempotencyKey_key','D06-04':'PlaylistItem_playlistId_videoId_key'}
            if ident in expected_constraints:
                assert result['constraint']==expected_constraints[ident],(ident,result)
            result.update(title=title,expected_database_accepted=expected,expected_sqlstate=expected_state,scope='Direct SQL only; accepted cross-links are not demonstrated HTTP exploits')
            results.append(result)
        admin.query('ROLLBACK')

        # Real concurrent transactions on two independent connections; distinct slugs avoid the unrelated unique key.
        # Statements are the inspected COUNT/INSERT subset, not the entire createPlaylist TypeScript function.
        limit=100
        quota=[]
        for mode in ['sequential_control','overlapping_transactions']:
            pre='audit-quota-'+uuid.uuid4().hex[:12]
            channel=pre+'-c-a'
            admin.query(user_sql(pre)+channel_sql(pre)+f'''
              INSERT INTO "Playlist" ("id","channelId","title","slug","updatedAt")
              SELECT {q(pre+'-seed-')}||n,{q(channel)},'Fixture','seed-'||n,now() FROM generate_series(1,99) n''')
            a_session,b_session=Session(),Session()
            steps=[]
            def count(session,label):
                value=int(session.one(f'''SELECT count(*) FROM "Playlist" WHERE "channelId"={q(channel)} AND "deletedAt" IS NULL'''))
                steps.append({'operation':label+'_count','value':value});return value
            def insert(session,label):
                session.query(f'''INSERT INTO "Playlist" ("id","channelId","title","slug","updatedAt") VALUES
                  ({q(pre+'-'+label)},{q(channel)},'Fixture',{q('different-'+label)},now())''')
                steps.append({'operation':label+'_insert'})
            try:
                a_session.query("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='10s'")
                count_a=count(a_session,'A')
                if mode=='overlapping_transactions':
                    b_session.query("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='10s'")
                    count_b=count(b_session,'B')
                if count_a<limit:insert(a_session,'A')
                a_session.query('COMMIT');steps.append({'operation':'A_commit'})
                if mode=='sequential_control':
                    b_session.query("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='10s'")
                    count_b=count(b_session,'B')
                if count_b<limit:insert(b_session,'B')
                b_session.query('COMMIT');steps.append({'operation':'B_commit','inserted':count_b<limit})
                final=int(admin.one(f'''SELECT count(*) FROM "Playlist" WHERE "channelId"={q(channel)} AND "deletedAt" IS NULL'''))
                assert final==(101 if mode=='overlapping_transactions' else 100)
                quota.append({'mode':mode,'isolation':'READ COMMITTED','limit':limit,'initial':99,'observed_A':count_a,
                              'observed_B':count_b,'final':final,'steps':steps,'reproduces_limit_bypass':final>limit})
            finally:
                a_session.close();b_session.close()
                admin.query(f'''DELETE FROM "Creator" WHERE "id"={q(channel)}; DELETE FROM "User" WHERE "id"={q(pre+'-u')}''')
                assert int(admin.one(f'''SELECT count(*) FROM "Playlist" WHERE "channelId"={q(channel)}'''))==0
        # Reproduce the inspected READY-retry / new-completion interleaving, using two real connections.
        # The retry's first read is outside a transaction in the inspected application code.
        pre='audit-retry-'+uuid.uuid4().hex[:12]
        channel,video,old,new=pre+'-c-a',pre+'-video',pre+'-old',pre+'-new'
        admin.query(user_sql(pre)+channel_sql(pre)+f'''
          INSERT INTO "Video" ("id","creatorId","title","slug","thumbnailUrl","updatedAt")
          VALUES ({q(video)},{q(channel)},'Retry fixture',{q(video)},'/fixture',now());
          INSERT INTO "VideoOriginal" ("id","videoId","bucket","objectKey","version","status","updatedAt") VALUES
          ({q(old)},{q(video)},'fixture','old',1,'READY',now()),
          ({q(new)},{q(video)},'fixture','new',2,'UPLOADING',now());
          UPDATE "Video" SET "activeOriginalId"={q(old)} WHERE "id"={q(video)}''')
        retry,completion=Session(),Session()
        def pointer():
            return json.loads(admin.one(f'''SELECT json_build_object('active_version',o."version",'active_status',o."status")
              FROM "Video" v JOIN "VideoOriginal" o ON o."id"=v."activeOriginalId" WHERE v."id"={q(video)}'''))
        try:
            stale_read=retry.one(f'''SELECT "status" FROM "VideoOriginal" WHERE "id"={q(old)} AND "videoId"={q(video)}''')
            assert stale_read=='READY'
            # Positive control: retry while the same original is still active makes no pointer change.
            retry.query(f'''UPDATE "Video" SET "activeOriginalId"={q(old)} WHERE "id"={q(video)}
                AND ("activeOriginalId" IS NULL OR "activeOriginalId"<>{q(old)})''')
            control=pointer();assert control=={'active_version':1,'active_status':'READY'}
            completion.query(f'''BEGIN;
              UPDATE "VideoOriginal" SET "status"='READY',"updatedAt"=now() WHERE "id"={q(new)} AND "status"='UPLOADING';
              UPDATE "VideoOriginal" SET "status"='SUPERSEDED',"supersededAt"=now(),"updatedAt"=now()
                WHERE "videoId"={q(video)} AND "status"='READY' AND "id"<>{q(new)};
              UPDATE "Video" SET "activeOriginalId"={q(new)},"updatedAt"=now() WHERE "id"={q(video)};
              COMMIT''')
            after_new=pointer();assert after_new=={'active_version':2,'active_status':'READY'}
            # The delayed READY branch uses the earlier row and only checks the current pointer differs.
            retry.query(f'''UPDATE "Video" SET "activeOriginalId"={q(old)},"updatedAt"=now() WHERE "id"={q(video)}
                AND ("activeOriginalId" IS NULL OR "activeOriginalId"<>{q(old)})''')
            after_retry=pointer();assert after_retry=={'active_version':1,'active_status':'SUPERSEDED'}
            enqueue_read=retry.one(f'''SELECT "status" FROM "VideoOriginal" WHERE "id"={q(old)} AND "videoId"={q(video)}''')
            assert enqueue_read=='SUPERSEDED'
            retry_result={'kind':'INSPECTED_SQL_PROTOCOL_TWO_CONNECTIONS','retry_initial_status':stale_read,
              'control_without_new_completion':control,'after_new_completion':after_new,'after_delayed_retry':after_retry,
              'original_status_at_enqueue_check':enqueue_read,'application_source_enqueue_requires':'READY',
              'reproduces_pointer_to_superseded_original':True,
              'limit':'Actual completeOriginalMultipart/enqueueEncode/Prisma/HTTP not executed; read, promotion, pointer repair, and enqueue-check SQL preserve inspected ordering/conditions.'}
        finally:
            retry.close();completion.close()
            admin.query(f'''DELETE FROM "Video" WHERE "id"={q(video)};
              DELETE FROM "Creator" WHERE "id"={q(channel)}; DELETE FROM "User" WHERE "id"={q(pre+'-u')}''')
            assert int(admin.one(f'''SELECT count(*) FROM "User" WHERE "id"={q(pre+'-u')}'''))==0
        remaining=int(admin.one(f'''SELECT count(*) FROM "User" WHERE "id"={q(prefix+'-u')}'''))
        assert remaining==0
        result={'kind':'REAL_LOCAL_POSTGRESQL_DIRECT_SQL_AND_TRANSACTION_PROTOCOL','application_baseline_sha':'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
                'database_metadata':metadata,'migration_origin':'Existing isolated database from archived 81/81 SQL migration run; not Prisma migration engine or production upgrade',
                'integrity_probes':results,'quota_protocol_experiments':quota,'completion_retry_protocol':retry_result,'fixtures_removed':True,
                'limits':'No actual TypeScript/Prisma/Next HTTP execution. COUNT/INSERT protocol omits auth, audit and slug selection, whose source was reviewed. No production role/permission or existing-data verification.',
                'application_source_sha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in source_paths}}
        print(json.dumps(result,ensure_ascii=False,indent=2))
    finally:
        admin.close()


if __name__=='__main__':
    main()

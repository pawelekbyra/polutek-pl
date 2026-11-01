"""Real local PostgreSQL FK/commit protocols; not TypeScript, Prisma, HTTP or R2.

Reuses the archived local psql session helper. Random fixture IDs are removed;
no persistent schema changes or trigger disabling. Two independent connections
control the activation/cleanup ordering. Fault injection in the component harness
is separate: this script checks the database consequence of deleting the asset.
"""
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid

ROOT = Path.cwd()
BASE = ROOT / 'docs/audit/2026-11-01-platform-research/program-audytu'
spec = importlib.util.spec_from_file_location('local_psql_helper', BASE / 'tools/database-integrity-experiment.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def main():
    inventory = {row['path']: row['sha256'] for row in csv.DictReader((BASE / 'INWENTARZ-PLIKOW.csv').open())}
    sources = ['prisma/schema.prisma', 'lib/modules/video/application/video-playback-route.service.ts',
               'lib/modules/video-pipeline/application/finalize-self-hls.ts',
               'lib/modules/video-pipeline/application/output-cleanup.use-cases.ts']
    for file in sources:
        assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == inventory[file], file
    admin, activation = helper.Session(), helper.Session()
    observations = []
    try:
        metadata = json.loads(admin.one("SELECT json_build_object('database',current_database(),'server_version',current_setting('server_version'),'transaction_isolation',current_setting('transaction_isolation'))"))
        for mode in ['activation_control', 'post_commit_asset_delete', 'cleanup_check_before_activation']:
            prefix = 'audit-cascade-' + uuid.uuid4().hex[:12]
            user, channel, video = prefix+'-u', prefix+'-c-a', prefix+'-v'
            old, new, old_route, new_route = [prefix + suffix for suffix in ['-old', '-new', '-r-old', '-r-new']]
            q = helper.q
            try:
                admin.query(helper.user_sql(prefix) + helper.channel_sql(prefix) + f'''
                  INSERT INTO "Video" ("id","creatorId","title","slug","thumbnailUrl","status","updatedAt")
                    VALUES ({q(video)},{q(channel)},'Fixture',{q(video)},'/fixture','PUBLISHED',now());
                  INSERT INTO "VideoAsset" ("id","videoId","provider","objectKey","isPrimary","updatedAt") VALUES
                    ({q(old)},{q(video)},'SELF_HLS',{q('videos/'+video+'/v/v1')},true,now()),
                    ({q(new)},{q(video)},'SELF_HLS',{q('videos/'+video+'/v/v2')},false,now());
                  INSERT INTO "VideoPlaybackRoute" ("id","videoId","assetId","provider","status","updatedAt")
                    VALUES ({q(old_route)},{q(video)},{q(old)},'SELF_HLS','ACTIVE',now());
                  UPDATE "Video" SET "activePlaybackRouteId"={q(old_route)} WHERE "id"={q(video)}''')

                def state():
                    return json.loads(admin.one(f'''SELECT json_build_object(
                      'active_points_new',v."activePlaybackRouteId"={q(new_route)},
                      'active_pointer_is_null',v."activePlaybackRouteId" IS NULL,
                      'new_asset_exists',EXISTS(SELECT 1 FROM "VideoAsset" WHERE "id"={q(new)}),
                      'new_route_exists',EXISTS(SELECT 1 FROM "VideoPlaybackRoute" WHERE "id"={q(new_route)}),
                      'old_route_status',(SELECT "status" FROM "VideoPlaybackRoute" WHERE "id"={q(old_route)}),
                      'old_asset_primary',(SELECT "isPrimary" FROM "VideoAsset" WHERE "id"={q(old)}))
                      FROM "Video" v WHERE "id"={q(video)}'''))

                old_check = int(admin.one(f'''SELECT count(*) FROM "VideoPlaybackRoute" WHERE "videoId"={q(video)} AND "assetId"={q(new)} AND "status"='ACTIVE' '''))
                assert old_check == 0
                activation.query(f'''BEGIN; SET LOCAL statement_timeout='10s';
                  UPDATE "VideoPlaybackRoute" SET "status"='PREVIOUS',"deactivatedAt"=now() WHERE "videoId"={q(video)} AND "status"='ACTIVE';
                  INSERT INTO "VideoPlaybackRoute" ("id","videoId","assetId","provider","status","activatedBy","updatedAt")
                    VALUES ({q(new_route)},{q(video)},{q(new)},'SELF_HLS','ACTIVE','POLICY',now());
                  UPDATE "Video" SET "activePlaybackRouteId"={q(new_route)},"updatedAt"=now() WHERE "id"={q(video)};
                  UPDATE "VideoAsset" SET "isPrimary"=false,"updatedAt"=now() WHERE "videoId"={q(video)};
                  UPDATE "VideoAsset" SET "isPrimary"=true,"updatedAt"=now() WHERE "id"={q(new)};
                  COMMIT''')
                committed = state()
                assert committed['active_points_new'] and committed['new_route_exists'] and not committed['old_asset_primary']
                if mode != 'activation_control':
                    admin.query(f'''DELETE FROM "VideoAsset" WHERE "id"={q(new)}''')
                final = state()
                if mode == 'activation_control':
                    assert not final['active_pointer_is_null'] and final['new_asset_exists']
                else:
                    assert final['active_pointer_is_null'] and not final['new_asset_exists'] and not final['new_route_exists']
                    assert final['old_route_status'] == 'PREVIOUS' and not final['old_asset_primary']
                observations.append({'mode': mode, 'initial_active_new_route_count': old_check,
                                     'after_activation_commit': committed, 'final': final})
            finally:
                admin.query(f'''DELETE FROM "Video" WHERE "id"={q(video)};
                  DELETE FROM "Creator" WHERE "id"={q(channel)}; DELETE FROM "User" WHERE "id"={q(user)}''')
                assert int(admin.one(f'''SELECT count(*) FROM "VideoAsset" WHERE "videoId"={q(video)}''')) == 0
                assert int(admin.one(f'''SELECT count(*) FROM "User" WHERE "id"={q(user)}''')) == 0
        print(json.dumps({'kind': 'REAL_LOCAL_POSTGRESQL_INSPECTED_ACTIVATION_DELETE_PROTOCOL',
                          'database_metadata': metadata, 'application_baseline_sha': 'c397b9e548ca2c628e21457ac69d66e54b12ddbd',
                          'observations': observations, 'fixtures_removed': True,
                          'application_source_sha256': {file: inventory[file] for file in sources},
                          'limits': 'Actual SQL COMMIT/FK cascades, not actual TypeScript/Prisma/HTTP/R2. No real audit failure injected here; its reachability is separate component/source evidence.'}, indent=2))
    finally:
        admin.close()
        activation.close()


if __name__ == '__main__':
    main()

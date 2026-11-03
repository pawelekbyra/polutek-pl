"""Verify the real restore checker against a restored, task-owned PostgreSQL database.

No production access, fake Prisma, schema-history fabrication or database resets.
Credentials stay in this process and local mode-0600 files; logs contain redacted URLs.
"""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote
import datetime
import hashlib
import json
import os
import secrets
import subprocess

ROOT = Path('/workspace/polutek-pl')
SETUP = Path('/workspace/.cloud-setup')
OUT = SETUP / 'h1-real'
NODE = str(SETUP / 'tools/node-v22.23.4-linux-x64/bin/node')
meta = json.loads((SETUP / 'h1-db.json').read_text())
assert meta['container'] == 'polutek-cloud-db'
assert meta['database'].startswith('polutek_h1_')
values = dict(line.split('=', 1) for line in (SETUP / 'h1.env').read_text().splitlines()
              if '=' in line and not line.startswith('#'))
url = urlsplit(values['DATABASE_URL'])
assert url.hostname in ('localhost', '127.0.0.1') and url.port == 5432
assert url.path == '/' + meta['database'] and values['APP_ENV'] == 'development'
docker_env = dict(os.environ)
for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
    docker_env.pop(key, None)

def docker(*args, data=None):
    return subprocess.run(['docker', '--host=unix:///var/run/docker.sock', *args],
        env=docker_env, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout

def sql(database, text):
    return docker('exec', '-i', meta['container'], 'psql', '--host=/var/run/postgresql',
        '--username=polutek', '--dbname=' + database, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
        data=text.encode()).decode().strip()

docker('info', '--format', '{{.ServerVersion}}')
assert sql(meta['database'], 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL') == '81'
run_id = secrets.token_hex(5)
database = 'polutek_h1_restore_' + run_id
reader = 'h1_ro_' + run_id
password = secrets.token_hex(24)

# Nonempty, wholly synthetic fixture in the owned source, via the actual generated client.
seed = r'''
const {PrismaClient} = require('/workspace/polutek-pl/node_modules/@prisma/client');
const p = new PrismaClient();
const id = process.env.H1_FIXTURE_ID;
(async()=>{try {
  await p.$transaction(async tx=>{
    await tx.user.create({data:{id, email:id+'@example.test', name:id}});
    await tx.creator.create({data:{id:id+'-channel', userId:id, slug:id, name:'Synthetic restore fixture'}});
    await tx.video.create({data:{id:id+'-video', creatorId:id+'-channel', slug:id, title:'Synthetic restore fixture', thumbnailUrl:''}});
    await tx.videoAsset.create({data:{id:id+'-asset',videoId:id+'-video',provider:'SELF_HLS',objectKey:'synthetic-only/master.m3u8'}});
    await tx.payment.create({data:{id:id+'-payment',userId:id,creatorId:id+'-channel',amountMinor:1000,currency:'PLN',status:'SUCCEEDED'}});
    await tx.patronGrant.create({data:{id:id+'-grant',userId:id,paymentId:id+'-payment',source:'PAYMENT'}});
    await tx.userPaymentTotal.create({data:{userId:id,currency:'PLN',amountMinor:1000}});
  });
} finally {await p.$disconnect();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
'''
seed_env = dict(os.environ, H1_FIXTURE_ID='h1restore' + run_id)
subprocess.run([NODE, '--env-file=' + str(SETUP / 'h1.env'), '-e', seed], cwd=ROOT, env=seed_env,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

dump = docker('exec', meta['container'], 'pg_dump', '--host=/var/run/postgresql',
    '--username=polutek', '--dbname=' + meta['database'], '--format=custom')
dump_path = OUT / ('restore-source-' + run_id + '.dump')
dump_path.write_bytes(dump)
dump_path.chmod(0o600)
docker('exec', meta['container'], 'createdb', '--host=/var/run/postgresql', '--username=polutek', database)
docker('exec', '-i', meta['container'], 'pg_restore', '--host=/var/run/postgresql',
    '--username=polutek', '--dbname=' + database, '--exit-on-error', data=dump)
sql(database, f"CREATE ROLE {reader} LOGIN PASSWORD '{password}';\n"
    f'ALTER ROLE {reader} SET default_transaction_read_only = on;\n'
    f'GRANT CONNECT ON DATABASE {database} TO {reader};\n'
    f'GRANT USAGE ON SCHEMA public TO {reader};\n'
    f'GRANT SELECT ON ALL TABLES IN SCHEMA public TO {reader};')
restore_url = urlunsplit((url.scheme, quote(reader) + ':' + quote(password) + '@127.0.0.1:5432', '/' + database, '', ''))
env = dict(os.environ, DATABASE_URL=values['DATABASE_URL'], DATABASE_URL_UNPOOLED=values['DATABASE_URL'],
    RESTORE_DATABASE_URL=restore_url, ALLOW_RESTORE_VERIFICATION='true')
env.pop('RESTORE_EXPECTED_MANIFEST_PATH', None)

tables = ['User', 'Creator', 'Video', 'VideoAsset', 'Payment', 'UserPaymentTotal', 'PatronGrant',
    'StripeEvent', 'Comment', 'CommentReport', 'Subscription', 'AuditLog']
counts = {name: int(sql(database, f'SELECT count(*) FROM "{name}"')) for name in tables}
source_counts = {name: int(sql(meta['database'], f'SELECT count(*) FROM "{name}"')) for name in tables}
assert counts == source_counts and all(counts[k] > 0 for k in ['User', 'Creator', 'Video', 'Payment', 'PatronGrant'])
cases = []

def verify(name, should_pass, manifest=None, change_env=None):
    local_env = dict(env)
    if manifest is not None:
        path = OUT / ('restore-manifest-' + name + '.json')
        path.write_text(json.dumps(manifest) + '\n')
        local_env['RESTORE_EXPECTED_MANIFEST_PATH'] = str(path)
    if change_env:
        local_env.update(change_env)
    result = subprocess.run([NODE, '--import', 'tsx', 'scripts/verify-restored-database.ts'],
        cwd=ROOT, env=local_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=40)
    output = result.stdout.replace(password, 'REDACTED').replace(url.password or '\x00', 'REDACTED')
    path = OUT / ('restore-' + name + '.log')
    path.write_text(output)
    success_message = 'VERIFICATION SUCCESSFUL' in output
    ok = result.returncode == 0 and success_message if should_pass else result.returncode != 0 and not success_message
    cases.append(dict(id=name, expected='SUCCESS' if should_pass else 'NONZERO_WITHOUT_SUCCESS',
        exit=result.returncode, success_message=success_message, passed=ok, log=path.name))
    print(name + ': ' + ('PASS' if ok else 'FAIL'), flush=True)

verify('valid-restored-db', True)
verify('matching-manifest', True, {'counts': counts})
verify('unknown-manifest-aggregate', False, {'counts': {'NotAModel': 1}})
verify('mismatched-manifest-count', False, {'counts': {'User': counts['User'] + 1}})
verify('invalid-manifest-shape', False, {'counts': []})
sql(database, f'REVOKE SELECT ON _prisma_migrations FROM {reader}')
verify('migration-read-denied', False)
sql(database, f'GRANT SELECT ON _prisma_migrations TO {reader}')
sql(database, f'REVOKE SELECT ON "Payment" FROM {reader}')
verify('required-model-read-denied', False)
sql(database, f'GRANT SELECT ON "Payment" TO {reader}')
sql(database, "INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,applied_steps_count) "
    "VALUES ('h1-synthetic-unfinished','synthetic-only','h1_synthetic_unfinished',now(),0)")
verify('unfinished-migration', False)
sql(database, "UPDATE _prisma_migrations SET rolled_back_at=now() WHERE id='h1-synthetic-unfinished'")
verify('resolved-rollback-history', True)
verify('same-database-url-guard', False, change_env={'RESTORE_DATABASE_URL': values['DATABASE_URL']})
verify('missing-explicit-enable', False, change_env={'ALLOW_RESTORE_VERIFICATION': 'false'})
sql(database, "DELETE FROM _prisma_migrations WHERE id='h1-synthetic-unfinished'")
after_counts = {name: int(sql(database, f'SELECT count(*) FROM "{name}"')) for name in tables}
assert after_counts == counts
role_state = sql(database, f"SELECT rolconfig::text FROM pg_roles WHERE rolname='{reader}'")
assert 'default_transaction_read_only=on' in role_state

report = dict(date_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    code_sha=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    source='owned H1 PostgreSQL 17 database with synthetic rows; actual pg_dump/pg_restore; genuine Prisma client',
    database=database, source_database=meta['database'], read_only_role=reader,
    dump_sha256=hashlib.sha256(dump).hexdigest(), counts=counts,
    restored_counts_equal_source=True, counts_unchanged_after_verification=True,
    verifier_role_default_transaction_read_only=True, cases=cases,
    passed=sum(c['passed'] for c in cases), failed=sum(not c['passed'] for c in cases),
    limitations=['No production backup, R2 objects, off-host recovery, Stripe API or whole-product disaster recovery.',
        'Migration fault row exists only in the disposable restored clone and is explicitly removed.',
        'Does not prove every schema constraint or guarantee identity guards against equivalent URL spellings.'])
(OUT / 'real-restore-summary.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k:report[k] for k in ['database','passed','failed','code_sha']}, indent=2))
raise SystemExit(1 if report['failed'] else 0)

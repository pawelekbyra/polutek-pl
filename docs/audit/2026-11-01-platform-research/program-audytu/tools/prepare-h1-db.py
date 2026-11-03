"""Prepare or recheck a task-owned empty database without touching existing research data."""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import datetime
import json
import os
import secrets
import subprocess

ROOT = Path('/workspace/polutek-pl')
SETUP = Path('/workspace/.cloud-setup')
META = SETUP / 'h1-db.json'
CONFIG = SETUP / 'h1.env'
CONTAINER = 'polutek-cloud-db'
docker_env = dict(os.environ)
for key in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
    docker_env.pop(key, None)

def docker(*args):
    return subprocess.check_output(['docker', '--host=unix:///var/run/docker.sock', *args], env=docker_env, text=True).strip()

def query(database, sql):
    return docker('exec', CONTAINER, 'psql', '--host=/var/run/postgresql', '--port=5432', '--username=polutek', '--dbname='+database, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-c', sql)

assert docker('info', '--format', '{{.ServerVersion}}')
created = False
if META.exists():
    meta = json.loads(META.read_text())
    assert meta['container'] == CONTAINER and meta['database'].startswith('polutek_h1_')
    assert CONFIG.is_file(), 'Existing task metadata must retain its local config'
else:
    assert not CONFIG.exists(), 'Refuse to replace an unowned existing config'
    source = (ROOT / '.env.local').read_text()
    values = dict(line.split('=', 1) for line in source.splitlines() if '=' in line and not line.startswith('#'))
    assert values.get('APP_ENV') == 'development', 'Only a development config may be copied'
    for key in ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']:
        u = urlsplit(values[key])
        assert u.hostname in ['127.0.0.1', 'localhost'] and u.port == 5432 and u.username == 'polutek', 'Refuse nonlocal database configuration'
    database = 'polutek_h1_' + secrets.token_hex(5)
    docker('exec', CONTAINER, 'createdb', '--host=/var/run/postgresql', '--port=5432', '--username=polutek', database)
    replacements = {}
    for key in ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']:
        u = urlsplit(values[key])
        replacements[key] = urlunsplit((u.scheme, u.netloc, '/'+database, u.query, u.fragment))
    replacements.update(PREMIUM_PASS_EXPERIMENT='off', PREMIUM_PASS_PAYMENTS='demo',
        PLATFORM_GATE_CHANNEL_CREATION='off', PLATFORM_GATE_SALES='off', PLATFORM_GATE_PAYOUTS='off',
        TELEMETRY_BEACON='off', NEW_USER_NOTIFY_EMAIL='off')
    lines = []
    used = set()
    for line in source.splitlines():
        key = line.split('=', 1)[0]
        if key in replacements:
            lines.append(key+'='+replacements[key])
            used.add(key)
        else:
            lines.append(line)
    lines.extend(key+'='+value for key, value in replacements.items() if key not in used)
    descriptor = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as f:
        f.write('\n'.join(lines)+'\n')
    meta = dict(container=CONTAINER, database=database, config_path=str(CONFIG), created_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), origin='task-owned new isolated development database')
    META.write_text(json.dumps(meta, indent=2)+'\n')
    created = True

database = meta['database']
actual = query(database, 'SELECT current_database()')
assert actual == database
version = query(database, 'SHOW server_version')
tables = int(query(database, "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')"))
history = query(database, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL") == 't'
if created:
    assert tables == 0 and not history, 'New DB must be empty; do not create raw SQL schema'
assert CONFIG.stat().st_mode & 0o777 == 0o600
print(json.dumps(dict(container=CONTAINER, database=database, server_version=version, created_new=created,
    application_tables=tables, prisma_migration_history_present=history, config_path=str(CONFIG), config_mode='0600',
    result='EMPTY_DB_REACHABLE_NOT_MIGRATED' if not tables else 'EXISTING_TASK_DB_PRESERVED',
    note='No Prisma generation or migrations executed. Existing dev/research databases and config left unchanged.'), indent=2))

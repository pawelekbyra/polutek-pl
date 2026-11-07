#!/usr/bin/env python3
"""Exercise current Prisma migrations and a synthetic PostgreSQL dump/restore locally.

Requires Docker, Node dependencies installed from the lockfile, and the locally cached
postgres:17 image. Creates one disposable loopback-only container and always removes it.
Never reads project env files or connects to an existing database/service.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[5]
DEFAULT_OUT_DIR = Path(__file__).resolve().parents[1] / "evidence"
OUT = Path(os.environ.get("K32_EVIDENCE_PATH", str(DEFAULT_OUT_DIR / f"k32-synthetic-restore-{secrets.token_hex(5)}.json")))
if not OUT.is_absolute():
    OUT = ROOT / OUT
if not OUT.resolve().is_relative_to(ROOT):
    raise SystemExit("K32_EVIDENCE_PATH must stay inside the repository")
IMAGE = "postgres:17"
RUN = secrets.token_hex(5)
CONTAINER = "k32-restore-" + RUN
DB_PASSWORD = secrets.token_urlsafe(24)
SOURCE_DB = "k32_source"
RESTORE_DB = "k32_restored"
FIXTURE = "k32" + RUN
RESULT: dict[str, object] = {"cases": []}


def run(args: list[str], *, env: dict[str, str] | None = None, input: str | None = None,
        check: bool = True, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=ROOT, env=env, input=input, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=timeout, check=False)
    if check and result.returncode:
        raise RuntimeError(f"command failed ({result.returncode}): {args[0]} {args[1:2]}\n{result.stdout[-4000:]}")
    return result


def docker(*args: str, check: bool = True, timeout: int = 120,
           input: str | None = None) -> subprocess.CompletedProcess[str]:
    return run(["docker", *args], check=check, timeout=timeout, input=input)


def docker_binary(*args: str, input: bytes | None = None, timeout: int = 120) -> bytes:
    result = subprocess.run(["docker", *args], cwd=ROOT, input=input, text=False,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=timeout, check=False)
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"binary docker command failed ({result.returncode}): {args[1:3]}\n{detail}")
    if result.stderr:
        raise RuntimeError("binary docker command wrote diagnostics to stderr; refusing a potentially contaminated dump")
    return result.stdout


def record(name: str, passed: bool, detail: str) -> None:
    RESULT["cases"].append({"name": name, "passed": passed, "detail": detail})
    if not passed:
        raise RuntimeError(f"acceptance case failed: {name}: {detail}")


def main() -> None:
    scratch_root = Path("/dev/shm")
    scratch_free = shutil.disk_usage(scratch_root).free
    RESULT["tmpfs_preflight"] = {
        "root": str(scratch_root),
        "available_bytes": scratch_free,
        "required_bytes": 2 * 1024**3,
    }
    if scratch_free < 2 * 1024**3:
        raise RuntimeError(f"tmpfs has {scratch_free} free bytes; at least 2 GiB is required")

    image = docker("image", "inspect", IMAGE, "--format", "{{.Id}}\t{{.RepoDigests}}")
    image_id, _, repo_digests = image.stdout.strip().partition("\t")
    RESULT.update({
        "recorded_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "code_sha": run(["git", "rev-parse", "HEAD"]).stdout.strip(),
        "tool": str(Path(__file__).resolve().relative_to(ROOT)),
        "tool_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "source": "synthetic-only PostgreSQL; current Prisma migrations; local pg_dump/pg_restore",
        "status": "running",
        "postgres_image": IMAGE,
        "postgres_image_id": image_id,
        "postgres_repo_digests": repo_digests,
        "limitations": [
            "Does not use or prove recovery from any production/offsite backup, object storage, age key or external service.",
            "Does not measure approved RPO/RTO or test Support attachments, payment reconciliation, host provisioning or media recovery.",
            "Constraint probes cover only the synthetic video foreign key and channel membership uniqueness."
        ],
    })

    docker("run", "--detach", "--name", CONTAINER,
           "--publish", "127.0.0.1::5432",
           "--tmpfs", "/var/lib/postgresql/data:rw,size=1536m",
           "--tmpfs", "/tmp/k32:rw,size=512m",
           "--env", "POSTGRES_PASSWORD=" + DB_PASSWORD,
           "--env", "POSTGRES_DB=" + SOURCE_DB, IMAGE)
    try:
        mapped = docker("port", CONTAINER, "5432/tcp").stdout.strip().splitlines()[0]
        port = mapped.rsplit(":", 1)[1]
        url = f"postgresql://postgres:{DB_PASSWORD}@127.0.0.1:{port}/{SOURCE_DB}?schema=public"
        env = dict(os.environ, DATABASE_URL=url, DATABASE_URL_UNPOOLED=url,
                   APP_ENV="development", CI="true")

        last_ready = ""
        for attempt in range(60):
            ready = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", SOURCE_DB,
                           "-c", "SELECT 1", check=False)
            last_ready = ready.stdout.strip()
            process = docker("exec", CONTAINER, "cat", "/proc/1/comm", check=False)
            if ready.returncode == 0 and last_ready == "1" and process.stdout.strip() == "postgres":
                break
            running = docker("inspect", CONTAINER, "--format", "{{.State.Running}}", check=False)
            if running.returncode != 0 or running.stdout.strip() != "true":
                logs = docker("logs", CONTAINER, check=False).stdout
                raise RuntimeError("disposable PostgreSQL exited during startup: " + logs[-3000:] + last_ready[-1000:])
            time.sleep(1)
        else:
            logs = docker("logs", CONTAINER, check=False).stdout
            raise RuntimeError("disposable PostgreSQL did not become query-ready: " + logs[-3000:] + last_ready[-1000:])
        version = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", SOURCE_DB,
                         "-c", "SHOW server_version").stdout.strip()
        record("fresh-disposable-postgres-loopback", True, f"PostgreSQL {version}; bound only to 127.0.0.1")

        migrate = run(["npm", "run", "db:migrate:deploy"], env=env, timeout=600)
        migration_names = sorted(p.parent.name for p in (ROOT / "prisma/migrations").glob("*/migration.sql"))
        applied = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", SOURCE_DB,
                         "-c", "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name").stdout.splitlines()
        if applied != migration_names:
            raise RuntimeError(f"applied migration inventory mismatch: expected {len(migration_names)}, got {len(applied)}")
        record("current-prisma-migrations", True, f"Prisma migrate deploy applied {len(applied)} current migrations")

        seed = r'''const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient(); const x = process.env.K32_FIXTURE;
(async()=>{try{await p.$transaction(async t=>{
 await t.user.create({data:{id:x+'-owner',email:x+'-owner@example.test',name:x+' owner'}});
 await t.user.create({data:{id:x+'-editor',email:x+'-editor@example.test',name:x+' editor'}});
 await t.creator.create({data:{id:x+'-channel',userId:x+'-owner',slug:x+'-channel',name:'Synthetic K32 channel'}});
 await t.channelMember.create({data:{id:x+'-member',channelId:x+'-channel',userId:x+'-editor',role:'EDITOR',acceptedAt:new Date('2026-11-07T00:00:00Z')}});
 await t.video.create({data:{id:x+'-video',creatorId:x+'-channel',slug:x+'-video',title:'Synthetic K32 video',thumbnailUrl:'synthetic-only'}});
 await t.videoAsset.create({data:{id:x+'-asset',videoId:x+'-video',provider:'SELF_HLS',objectKey:'synthetic-only/master.m3u8',bucket:'synthetic-only'}});
});}finally{await p.$disconnect()}})().catch(e=>{console.error(e.message);process.exit(1)});'''
        run(["node", "-e", seed], env=dict(env, K32_FIXTURE=FIXTURE), timeout=120)
        snapshot_sql = """SELECT jsonb_build_object(
          'users',(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY id) FROM \"User\" WHERE id LIKE '%FIXTURE%'),
          'creators',(SELECT jsonb_agg(jsonb_build_object('id',id,'userId',\"userId\",'slug',slug) ORDER BY id) FROM \"Creator\" WHERE id LIKE '%FIXTURE%'),
          'members',(SELECT jsonb_agg(jsonb_build_object('id',id,'channelId',\"channelId\",'userId',\"userId\",'role',role) ORDER BY id) FROM \"ChannelMember\" WHERE id LIKE '%FIXTURE%'),
          'videos',(SELECT jsonb_agg(jsonb_build_object('id',id,'creatorId',\"creatorId\",'slug',slug) ORDER BY id) FROM \"Video\" WHERE id LIKE '%FIXTURE%'),
          'assets',(SELECT jsonb_agg(jsonb_build_object('id',id,'videoId',\"videoId\",'provider',provider,'objectKey',\"objectKey\") ORDER BY id) FROM \"VideoAsset\" WHERE id LIKE '%FIXTURE%'))"""
        # Fixture IDs are substituted as SQL literals only from the locally generated hex identifier.
        fixture_sql = snapshot_sql.replace("%FIXTURE%", FIXTURE + "%")
        source_snapshot = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", SOURCE_DB,
                                 "-c", fixture_sql).stdout.strip()
        if not source_snapshot or "null" in source_snapshot:
            raise RuntimeError("synthetic relation snapshot is incomplete")
        record("synthetic-owner-channel-membership-video-asset", True, "actual generated Prisma client seeded six rows across the five related models")

        dump = docker_binary("exec", CONTAINER, "pg_dump", "-U", "postgres", "-Fc", "-d", SOURCE_DB)
        dump_hash = hashlib.sha256(dump).hexdigest()
        docker("exec", CONTAINER, "createdb", "-U", "postgres", RESTORE_DB)
        docker_binary("exec", "-i", CONTAINER, "pg_restore", "-U", "postgres", "-d", RESTORE_DB,
                      "--exit-on-error", input=dump)
        restored_snapshot = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", RESTORE_DB,
                                   "-c", fixture_sql).stdout.strip()
        source_migrations = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", SOURCE_DB,
                                   "-c", "SELECT migration_name||':'||checksum||':'||finished_at::text FROM _prisma_migrations ORDER BY migration_name").stdout
        restored_migrations = docker("exec", CONTAINER, "psql", "-XAt", "-U", "postgres", "-d", RESTORE_DB,
                                     "-c", "SELECT migration_name||':'||checksum||':'||finished_at::text FROM _prisma_migrations ORDER BY migration_name").stdout
        if source_snapshot != restored_snapshot or source_migrations != restored_migrations:
            raise RuntimeError("restored data relationship snapshot or Prisma migration history differs")
        record("pg-dump-restore-data-and-migration-history", True,
               f"source and empty target snapshots match; dump SHA-256 {dump_hash}")

        restore_url = f"postgresql://postgres:{DB_PASSWORD}@127.0.0.1:{port}/{RESTORE_DB}?schema=public"
        restored_env = dict(env, DATABASE_URL=restore_url, DATABASE_URL_UNPOOLED=restore_url)
        verify = r'''const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); const x=process.env.K32_FIXTURE;
(async()=>{try{const video=await p.video.findUniqueOrThrow({where:{id:x+'-video'},include:{creator:{include:{user:true,members:true}},assets:true}});
 if(video.creator.user.id!==x+'-owner'||video.creator.members[0].userId!==x+'-editor'||video.assets[0].id!==x+'-asset') throw Error('restored Prisma relation mismatch');
 await p.$queryRaw`SELECT 1`; console.log('RESTORED_PRISMA_RELATIONS_OK');}finally{await p.$disconnect()}})().catch(e=>{console.error(e.message);process.exit(1)});'''
        prisma_check = run(["node", "-e", verify], env=dict(restored_env, K32_FIXTURE=FIXTURE), timeout=120)
        if "RESTORED_PRISMA_RELATIONS_OK" not in prisma_check.stdout:
            raise RuntimeError("restored database was not readable through generated Prisma client")
        record("restored-generated-prisma-client", True, "Prisma traversed Video → Creator → User/Members and loaded VideoAsset")

        invalid_fk = ("INSERT INTO \"VideoAsset\" (id,\"videoId\",provider,\"objectKey\",\"updatedAt\") "
                      "VALUES ('" + FIXTURE + "-bad-fk','missing-video','SELF_HLS','synthetic-only','now()')")
        fk = docker("exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
                    "-d", RESTORE_DB, "-c", invalid_fk, check=False)
        if fk.returncode == 0 or "foreign key" not in fk.stdout.lower():
            raise RuntimeError("restored database accepted VideoAsset with missing Video FK")
        record("restored-foreign-key-enforced", True, "PostgreSQL rejected a VideoAsset referencing a missing video")

        duplicate_member = ("INSERT INTO \"ChannelMember\" (id,\"channelId\",\"userId\",role) VALUES ('" +
                           FIXTURE + "-dup','" + FIXTURE + "-channel','" + FIXTURE + "-editor','EDITOR')")
        unique = docker("exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres",
                        "-d", RESTORE_DB, "-c", duplicate_member, check=False)
        if unique.returncode == 0 or "unique" not in unique.stdout.lower():
            raise RuntimeError("restored database accepted duplicate channel membership")
        record("restored-channel-membership-unique-enforced", True, "PostgreSQL rejected duplicate (channelId,userId)")

        RESULT["dump_sha256"] = dump_hash
        RESULT["source_database"] = SOURCE_DB
        RESULT["restore_database"] = RESTORE_DB
    finally:
        docker("rm", "--force", CONTAINER, check=False, timeout=30)

    RESULT["status"] = "passed"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(RESULT, indent=2) + "\n")
    OUT.chmod(0o600)
    print(json.dumps({"evidence": str(OUT.relative_to(ROOT)),
                      "passed": sum(case["passed"] for case in RESULT["cases"]),
                      "failed": 0}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        RESULT["status"] = "blocked_or_failed"
        RESULT["error"] = str(error)
        RESULT.setdefault("recorded_at_utc", datetime.datetime.now(datetime.timezone.utc).isoformat())
        try:
            RESULT.setdefault("code_sha", run(["git", "rev-parse", "HEAD"]).stdout.strip())
            RESULT.setdefault("tool", str(Path(__file__).resolve().relative_to(ROOT)))
            RESULT.setdefault("tool_sha256", hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(RESULT, indent=2) + "\n")
            OUT.chmod(0o600)
        except Exception:
            pass
        print(f"K32 acceptance failed: {error}", file=sys.stderr)
        sys.exit(1)

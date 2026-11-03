"""Run the existing three real encoder tests inside the exact built worker, including HDR with no skips."""
from pathlib import Path
import json,os,subprocess
OUT=Path('/workspace/.cloud-setup/h1-images'); r=json.loads((OUT/'images-run.json').read_text());assert r['all_executed_checks_passed']
image=next(x for x in r['images'] if x['kind']=='worker')
assert image['runtime']['ffmpeg']['zscale'] and image['runtime']['ffmpeg']['tonemap']
env=dict(os.environ)
for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(name,None)
cpu_ids=','.join(map(str,sorted(os.sched_getaffinity(0))[:2]))
script="""
import {startVitest} from 'vitest/node';
import {readFileSync} from 'node:fs';
const ctx=await startVitest('test',['tests/unit/hls/encode-hls.ffmpeg.test.ts'],
 {config:false,watch:false,maxWorkers:1,reporters:['json'],outputFile:'/tmp/ffmpeg-report.json',alias:{'@':'/app'}},
 {cacheDir:'/tmp/vite-cache'});
if(!ctx) throw new Error('Vitest did not start');
await ctx.close();
const report=JSON.parse(readFileSync('/tmp/ffmpeg-report.json','utf8'));
process.stdout.write('H1_FFMPEG_REPORT:'+JSON.stringify(report)+'\\n');
if(report.success!==true || report.numPassedTests!==3 || report.numPendingTests!==0 || report.numFailedTests!==0) process.exitCode=1;
"""
args=['docker','--host=unix:///var/run/docker.sock','run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=512','--memory=2g','--cpuset-cpus='+cpu_ids,
 '--tmpfs','/tmp:rw,nosuid,size=512m','--mount','type=bind,src='+str(OUT/'context/tests')+',dst=/app/tests,readonly',
 '-e','ENCODE_SMOKE=1','-e','CI=true','--entrypoint=node',image['image_id'],'--input-type=module','-e',script]
result=subprocess.run(args,env=env,capture_output=True,text=True)
(OUT/'worker-ffmpeg.log').write_text(result.stdout+result.stderr)
summary=dict(code_sha=r['code_sha'],image_id=image['image_id'],exit=result.returncode,cpuset=cpu_ids,network='none',read_only_image=True,production_credentials=False,app_source='Built image; unchanged test fixture mounted read-only from the matching git archive')
line=next((line for line in result.stdout.splitlines() if line.startswith('H1_FFMPEG_REPORT:')),None)
if line:
 report=json.loads(line.split(':',1)[1]);(OUT/'worker-ffmpeg-vitest.json').write_text(json.dumps(report,indent=2)+'\n')
 summary.update(passed=report['numPassedTests'],failed=report['numFailedTests'],pending=report['numPendingTests'])
(OUT/'worker-ffmpeg-run.json').write_text(json.dumps(summary,indent=2)+'\n')
if result.returncode:raise SystemExit('Worker FFmpeg test failed; captured log retained')
print('Worker FFmpeg: 3/3 PASS, zero skips',flush=True)

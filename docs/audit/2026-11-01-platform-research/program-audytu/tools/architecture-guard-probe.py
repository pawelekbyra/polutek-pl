"""Run unchanged existing static guard on tiny synthetic temporary trees.
Fixtures are policy examples, not exploitable app routes or runtime auth tests.
No mutations to real app, no npm install, network or production.
"""
import hashlib,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
NODE=Path('/workspace/.cloud-setup/tools/node-v22.23.4-linux-x64/bin/node')
GUARD=ROOT/'scripts/check-architecture.ts'
command=[str(NODE),str(ROOT/'node_modules/tsx/dist/cli.mjs'),str(GUARD)]
env=dict(os.environ);env['PATH']=str(NODE.parent)+os.pathsep+env.get('PATH','')
cases=[
 ('allowed_module_barrel',{'lib/modules/a/application/a.ts':"import { x } from '@/lib/modules/b'; export const y=x;",'lib/modules/b/index.ts':'export const x=1;'},0),
 ('forbidden_static_next_cache',{'lib/modules/a/application/a.ts':"import { revalidatePath } from 'next/cache'; export const y=revalidatePath;"},1),
 ('forbidden_dynamic_next_cache_not_detected',{'lib/modules/a/application/a.ts':"export async function y(){return import('next/cache');}"},0),
 ('forbidden_static_admin_public_auth',{'apps/admin/app/api/probe/route.ts':"import { auth } from '@/lib/auth/server'; export const x=auth;"},1),
 ('forbidden_dynamic_admin_public_auth_not_detected',{'apps/admin/app/api/probe/route.ts':"export async function x(){return import('@/lib/auth/server');}"},0),
 ('authz_missing_marker',{'lib/modules/video/application/probe.ts':'export const action=()=>42;'},1),
 ('authz_comment_marker_accepted',{'lib/modules/video/application/probe.ts':'// authorize( is mentioned but never called\nexport const action=()=>42;'},0),
 ('authz_syntax_call_marker_control',{'lib/modules/video/application/probe.ts':'declare function authorize():unknown; export const action=()=>authorize();'},0),
 ('mutual_public_module_cycle_not_detected',{'lib/modules/a/index.ts':"export {b} from '@/lib/modules/b'; export const a=1;",'lib/modules/b/index.ts':"export {a} from '@/lib/modules/a'; export const b=2;"},0)
]
observations=[]
for case,files,expected in cases:
 with tempfile.TemporaryDirectory(prefix='polutek-architecture-research-')as tmp:
  directory=Path(tmp)
  for p,text in files.items():
   target=directory/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text+'\n')
  run=subprocess.run(command,cwd=directory,env=env,capture_output=True,text=True,timeout=30)
  assert run.returncode==expected,(case,run.returncode,run.stdout,run.stderr)
  observations.append({'case':case,'fixture_files':files,'exit_code':run.returncode,'stdout':run.stdout,'stderr':run.stderr})
result={'date':'2026-11-01','source':'scripts/check-architecture.ts','source_sha256':hashlib.sha256(GUARD.read_bytes()).hexdigest(),
 'observations':observations,'limits':['Guard scans synthetic temp trees; real app is unchanged','Call/comment/import fixtures do not execute app logic or prove authorization bypass','Passing guard is a policy heuristic, not type checking, cycle analysis or security proof'],'cleanup':'TemporaryDirectory removed each synthetic tree'}
(BASE/'evidence/architecture-guard-probe.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'observations':len(observations),'exit_codes':[r['exit_code']for r in observations]}))

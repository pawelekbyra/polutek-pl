"""Mechanical source/config inventory, not execution of CI, images or deployment."""
import csv,hashlib,json,re
from pathlib import Path
import yaml
ROOT=Path.cwd();BASE=ROOT/'docs/audit/2026-11-01-platform-research/program-audytu'
inventory={r['path']:r['sha256']for r in csv.DictReader((BASE/'INWENTARZ-PLIKOW.csv').open())};hashes={}
def read(p):
 s=(ROOT/p).read_text();h=hashlib.sha256((ROOT/p).read_bytes()).hexdigest();assert h==inventory[p];hashes[p]=h;return s
ci=yaml.load(read('.github/workflows/ci.yml'),Loader=yaml.BaseLoader);images=yaml.load(read('.github/workflows/images.yml'),Loader=yaml.BaseLoader)
docker=read('deploy/serwerek/Dockerfile');admin=read('deploy/serwerek/Dockerfile.admin');ignore=read('.dockerignore')
package=json.loads(read('package.json'));compose=yaml.load(read('deploy/serwerek/docker-compose.yml'),Loader=yaml.BaseLoader)
read('deploy/serwerek/docker-compose.override.yml');deploy=read('deploy/serwerek/deploy.sh');read('deploy/serwerek/deploy-admin.sh')
read('next.config.mjs');read('apps/admin/next.config.mjs');read('scripts/ops/local-ci.mjs');read('scripts/ops/local-ci-lib.mjs')
buildsteps=[s for s in images['jobs']['build']['steps']if s.get('uses','').startswith('docker/build-push-action@')]
steps=[]
for s in buildsteps:
 options=s['with'];args=[line.split('=')[0]for line in options.get('build-args','').splitlines()if'='in line]
 steps.append({'name':s['name'],'target':options.get('target'),'build_argument_names':args,'explicit_provenance_option':options.get('provenance'),'explicit_sbom_option':options.get('sbom'),'push':options.get('push')})
args=re.findall(r'^ARG\s+(NEXT_PUBLIC_[A-Z0-9_]+)',docker,re.M);passed=steps[0]['build_argument_names']
result={'date':'2026-11-02','method':'PyYAML BaseLoader and bounded regex source inventory, no runtime/workflow execution','parser_version':yaml.__version__,'source_sha256':hashes,
 'CI':{'triggers':ci['on'],'jobs':[{'id':name,'needs':j.get('needs',[]),'run_commands':[s['run']for s in j['steps']if'run'in s]}for name,j in ci['jobs'].items()],'workflow_env_variable_names':sorted(ci.get('env',{}))},
 'images':{'triggers':images['on'],'jobs':list(images['jobs']),'needs':images['jobs']['build'].get('needs',[]),'build_steps':steps,'CI_workflow_dependency_declared':False,'builder_default_provenance_or_registry_attestations_verified':False},
 'Dockerfile':{'FROM_references':sorted(set(re.findall(r'^FROM\s+(\S+)',docker+'\n'+admin,re.M))),'public_ARG_names':args,'public_ARG_not_passed_by_images_app_step':sorted(set(args)-set(passed)),'lockfile_used_for_deps':True,'quality_typecheck_tests_in_build_stage':False,'build_context_exclusions':ignore.splitlines()},
 'runtime_compose':{'service_names':list(compose['services']),'published_ports':{k:v.get('ports',[])for k,v in compose['services'].items()},'hardening_keys':{k:[x for x in ['read_only','security_opt','cap_drop','pids_limit','mem_limit','logging']if x in v]for k,v in compose['services'].items()}},
 'package_gate_definitions':{k:package['scripts'][k]for k in ['quality','typecheck','predeploy:prod','test:integration:postgres']},
 'deployment_readiness_policy':'Warning only after app image promotion; diagnostic database body checked when token configured. No real deployment here.',
 'boundaries':['Declared workflow jobs != jobs passed or required branch protection','Image job has no dependency on the separate CI workflow in inspected YAML; external approvals/required checks unknown','BuildKit/build-push-action may generate default attestations; registry/defaults not inspected. No SLSA level awarded.','Tag named after source SHA != immutable digest or proof of exact tested artifact','Build config argument gaps are recorded for investigation, not demonstrated checkout failure or new finding']}
(BASE/'evidence/release-evidence-map.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'source_files':len(hashes),'CI_jobs':len(ci['jobs']),'image_targets':len(steps),'unmapped_public_args':result['Dockerfile']['public_ARG_not_passed_by_images_app_step']}))

from pathlib import Path
import json,os,re,subprocess
OUT=Path('/workspace/.cloud-setup/h1-images-final');r=json.loads((OUT/'images-run.json').read_text())
env=dict(os.environ)
for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(name,None)
def metadata(ref):
 output=subprocess.check_output(['docker','--host=unix:///var/run/docker.sock','image','inspect',ref,'--format','{"id":{{json .Id}},"repo_digests":{{json .RepoDigests}},"layers":{{json .RootFS.Layers}}}'],env=env,text=True)
 return json.loads(output)
base=metadata('node:22-bookworm-slim')
for image in r['images']:
 actual=metadata(image['image_id']);assert actual['layers'][:len(base['layers'])]==base['layers']
r['observed_node_base']=base
r['node_base_layer_prefix_verified_for_all_three_images']=True
r['other_resolved_build_sources']=sorted({match for log in OUT.glob('*-build.log') for match in re.findall(r'docker.io/[A-Za-z0-9_./:-]+@sha256:[0-9a-f]{64}',log.read_text())})
r['inputs_sha256_scope']='Source git archive and explicitly listed files/public build arguments. Base tag remains floating in Dockerfiles; observed base ID/digests and verified layer ancestry are recorded separately. This hash is not a complete build attestation.'
r['unbuilt_targets']=['migrator','collector']
r['registry_manifest_digest']='NOT_PUBLISHED; image_id is the local configuration digest'
(OUT/'images-run.json').write_text(json.dumps(r,indent=2)+'\n')
print('Node base ancestry verified; floating-reference and input-hash limits recorded.')

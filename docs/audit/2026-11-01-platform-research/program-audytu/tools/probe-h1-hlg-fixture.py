from pathlib import Path
import json,os,subprocess
OUT=Path('/workspace/.cloud-setup/h1-images');r=json.loads((OUT/'images-run.json').read_text());image=next(x for x in r['images'] if x['kind']=='worker')
env=dict(os.environ)
for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(name,None)
script="""
const {execFileSync}=require('node:child_process');
const variants={original:[],explicitVui:['-x264-params','colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc'],setparams:['-vf','setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc']};
for(const [name,extra] of Object.entries(variants)){
 const file='/tmp/'+name+'.mp4';
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=128x72:rate=25:duration=0.2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-color_primaries','bt2020','-color_trc','arib-std-b67','-colorspace','bt2020nc',...extra,file]);
 const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-print_format','json','-show_streams',file],{encoding:'utf8'})).streams[0];
 console.log(JSON.stringify({name,transfer:stream.color_transfer,primaries:stream.color_primaries,matrix:stream.color_space,pix_fmt:stream.pix_fmt}));
}
"""
result=subprocess.run(['docker','--host=unix:///var/run/docker.sock','run','--rm','--network=none','--read-only','--tmpfs','/tmp:rw,nosuid,size=64m','--cap-drop=ALL','--security-opt=no-new-privileges','--cpuset-cpus='+','.join(map(str,sorted(os.sched_getaffinity(0))[:2])),'--memory=512m','--pids-limit=128','--entrypoint=node',image['image_id'],'-e',script],env=env,capture_output=True,text=True)
(OUT/'hlg-fixture-probe.log').write_text(result.stdout+result.stderr)
print(result.stdout);print('exit',result.returncode)
raise SystemExit(result.returncode)

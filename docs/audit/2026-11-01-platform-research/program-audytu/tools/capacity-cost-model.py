"""Transparent conditional R2+Workers model; no cloud API, credentials or real invoice.
GB=1e9 bytes, GiB=2**30. R2 billable units rounded up after one shared allowance.
Workers examples use proportional overage. All compute/RTF/cache inputs unmeasured.
"""
import json
import math
from pathlib import Path

BASE = Path.cwd() / 'docs/audit/2026-11-01-platform-research/program-audytu'
config = json.loads((BASE / 'ZALOZENIA-KOSZTOW.json').read_text())


def calculate(scale, assumptions=None, creators=None):
    a = config['assumptions'] | (assumptions or {})
    creators = config['creators_main_approximation'] if creators is None else creators
    p = config['prices_usd']
    watch_seconds = a['video_seconds'] * a['watch_fraction']
    watch_hours = scale * a['average_to_peak_concurrent_viewers'] * 24 * a['days']
    plays = watch_hours * 3600 / watch_seconds
    requests = plays * (math.ceil(watch_seconds / a['segment_seconds']) + a['requests_overhead_per_play']) * a['prefetch_request_multiplier']
    r2_b = requests * (1-a['r2_request_cache_hit_fraction'])
    original_bytes = a['video_seconds'] * a['original_mbps'] * 1e6 / 8
    hls_bytes = a['video_seconds'] * a['all_rungs_average_mbps'] * 1e6 / 8
    storage_gb_month = creators * a['catalogue_videos_per_creator'] * (original_bytes+hls_bytes) / 1e9 * a['additional_storage_multiplier']
    uploads = creators * a['new_videos_per_creator_month']
    # Parts + create + complete; segment writes plus variant/master manifests.
    a_per_upload = math.ceil(original_bytes/a['multipart_part_bytes']) + 2 + a['rungs'] * math.ceil(a['video_seconds']/a['segment_seconds']) + a['rungs'] + 1
    r2_a = uploads * a_per_upload
    storage_cost = math.ceil(max(0, storage_gb_month-p['r2_free_gb'])) * p['r2_gb_month']
    a_cost = math.ceil(max(0, r2_a-p['r2_free_a'])/1e6) * p['r2_a_million']
    b_cost = math.ceil(max(0, r2_b-p['r2_free_b'])/1e6) * p['r2_b_million']
    worker_cost = p['worker_base'] + max(0, requests-p['worker_included_requests'])/1e6*p['worker_request_million'] + max(0, requests*a['worker_cpu_ms_per_request']-p['worker_included_cpu_ms'])/1e6*p['worker_cpu_million_ms']
    encoding_busy_hours = uploads*a['video_seconds']/3600*a['encoding_wall_hours_per_source_hour']
    serial_available = a['days']*24*a['encoding_available_fraction']
    return {'creators':creators,'peak_viewers_assumed':scale,'monthly_watch_hours':watch_hours,'monthly_plays_estimated':plays,
            'worker_requests':requests,'average_requests_day':requests/a['days'],'r2_b_operations_estimated':r2_b,'r2_a_operations_estimated':r2_a,
            'catalogue_storage_GB_month':storage_gb_month,'catalogue_storage_GiB':storage_gb_month*1e9/(2**30),
            'viewer_transfer_TB':watch_hours*3600*a['viewer_average_mbps']*1e6/8/1e12,
            'r2_storage_usd':storage_cost,'r2_a_usd':a_cost,'r2_b_usd':b_cost,'workers_usd':worker_cost,
            'partial_r2_workers_monthly_usd':storage_cost+a_cost+b_cost+worker_cost,
            'source_upload_hours_month':uploads*a['video_seconds']/3600,'encoding_busy_hours_assumed':encoding_busy_hours,
            'one_serial_encoder_available_hours_assumed':serial_available,'serial_encoder_budget_ratio':encoding_busy_hours/serial_available,
            'free_worker_daily_request_budget_exceeded_on_average':requests/a['days']>p['worker_free_requests_day']}


main = calculate(config['main_scenario_peak_viewers'])
checks = {
    'gb_gib_conversion': abs(main['catalogue_storage_GB_month']*1e9-main['catalogue_storage_GiB']*2**30)<0.01,
    'no_r2_reads_when_all_hits': calculate(1000, {'r2_request_cache_hit_fraction':1})['r2_b_operations_estimated']==0,
    'worker_requests_unchanged_by_r2_hit_ratio': calculate(1000, {'r2_request_cache_hit_fraction':1})['worker_requests']==calculate(1000, {'r2_request_cache_hit_fraction':0})['worker_requests'],
    'double_catalogue_doubles_bytes': calculate(10000, {'additional_storage_multiplier':2})['catalogue_storage_GB_month']==main['catalogue_storage_GB_month']*2,
    'larger_catalogue_increases_cost': calculate(10000,creators=19)['partial_r2_workers_monthly_usd']>main['partial_r2_workers_monthly_usd']>calculate(10000,creators=10)['partial_r2_workers_monthly_usd'],
    'double_rtf_doubles_busy_hours': calculate(10000, {'encoding_wall_hours_per_source_hour':4})['encoding_busy_hours_assumed']==main['encoding_busy_hours_assumed']*2,
    'shorter_segments_increase_requests': calculate(10000, {'segment_seconds':4})['worker_requests']>main['worker_requests'],
    'allowance_once_not_per_creator': main['r2_storage_usd']==math.ceil(396-10)*0.015,
    'r2_a_rounding_boundary': math.ceil(max(0, 1000001-1000000)/1e6)*4.5==4.5,
    'official_workers_example_15m_7ms': abs((5+5*0.3+(15*7-30)*0.02)-8)<1e-10
}
assert all(checks.values()), checks
output = {'date':config['date'],'status':'CONDITIONAL_MODEL_NOT_CAPACITY_BENCHMARK_OR_FULL_BUDGET','main_scenario_status':config['main_scenario_status'],
          'main_scenario': main, 'scenarios':[calculate(n) for n in config['scenarios']],
          'creator_sensitivity':[calculate(10000,creators=n)for n in [10,15,19]],
          'sensitivity': {key:[{'value':v,'result':calculate(10000,{key:v})} for v in values] for key,values in {
              'r2_request_cache_hit_fraction':[0,0.9,0.99], 'segment_seconds':[4,6,10],
              'encoding_wall_hours_per_source_hour':[1,2,4], 'additional_storage_multiplier':[1,2,3],
              'average_to_peak_concurrent_viewers':[0.05,0.25,1], 'worker_cpu_ms_per_request':[0.5,2,7]}.items()},
          'arithmetic_checks':checks,'excluded_unpriced':config['excluded_unpriced']}
(BASE/'evidence/capacity-cost-model.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'arithmetic_checks_passed':len(checks),'scenarios':len(output['scenarios']),'partial_usd':[round(x['partial_r2_workers_monthly_usd'],2) for x in output['scenarios']]}))

#!/usr/bin/env python3
"""Turns one k6 summary JSON into a TSV row and an exit code for run-steps.sh.

usage: summarize.py <summary.json> <target> <rate> [stop_p95_ms]
exit:  0 ok | 10 p95 above stop_p95_ms | 11 >2% 5xx/timeouts | 12 saturated (<90% of the target rate served)
"""
import json
import sys

path, target, rate = sys.argv[1], sys.argv[2], float(sys.argv[3])
stop_p95 = float(sys.argv[4]) if len(sys.argv) > 4 else 2000.0
m = json.load(open(path))["metrics"]


def v(name, key, default=0.0):
    return float(m.get(name, {}).get("values", {}).get(key, default))


iters = v("iterations", "count")
iter_rate = v("iterations", "rate")
dropped = v("dropped_iterations", "count")
reqs = v("http_reqs", "count")
req_rate = v("http_reqs", "rate")
err = v("server_errors", "rate")
unexpected = v("unexpected_status", "count")
d = "http_req_duration"
p50, p95, p99, mx = v(d, "med"), v(d, "p(95)"), v(d, "p(99)"), v(d, "max")

eps = []
for ep in ("home", "sidebar", "comments", "media", "thumb"):
    key = f"{d}{{ep:{ep}}}"
    if key in m and m[key]["values"].get("max", 0) > 0:
        e = m[key]["values"]
        eps.append(f"{ep}:{e['med']:.0f}/{e['p(95)']:.0f}/{e['p(99)']:.0f}")

served = iters / (iters + dropped) if iters + dropped else 0.0
row = [target, f"{rate:g}", f"{iter_rate:.2f}", f"{req_rate:.1f}", f"{int(reqs)}", f"{int(dropped)}",
       f"{p50:.0f}", f"{p95:.0f}", f"{p99:.0f}", f"{mx:.0f}", f"{err*100:.2f}", f"{int(unexpected)}", " ".join(eps)]
print("\t".join(row))

if err > 0.02:
    sys.exit(11)
if served < 0.9 or iter_rate < 0.8 * rate:
    sys.exit(12)
if p95 > stop_p95:
    sys.exit(10)
sys.exit(0)

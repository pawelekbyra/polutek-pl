#!/usr/bin/env python3
"""Write an immutable description of one guest load-test series."""
import hashlib
import json
import sys
from pathlib import Path


TARGETS = {
    "journey": {
        "iteration_unit": "new_guest_journey",
        "rate_metric": "new_guest_journeys_per_second",
        "requests_per_iteration": 5,
        "routes": [
            {"route": "home", "count": 1, "execution": "first"},
            {"route": "sidebar", "count": 1, "execution": "parallel"},
            {"route": "comments", "count": 1, "execution": "parallel"},
            {"route": "media", "count": 1, "execution": "parallel"},
            {"route": "thumb", "count": 1, "execution": "parallel"},
        ],
    },
    "home": {"iteration_unit": "single_endpoint_request", "route": "/<locale>", "requests_per_iteration": 1},
    "sidebar": {"iteration_unit": "single_endpoint_request", "route": "/api/channel/sidebar", "requests_per_iteration": 1},
    "comments": {"iteration_unit": "single_endpoint_request", "route": "/api/comments", "requests_per_iteration": 1},
    "media": {"iteration_unit": "single_endpoint_request", "route": "/api/media-source/<id>", "requests_per_iteration": 1},
    "thumb": {"iteration_unit": "single_endpoint_request", "route": "/api/videos/<id>/thumbnail", "requests_per_iteration": 1},
}


def main() -> int:
    if len(sys.argv) not in (11, 13):
        print("usage: profile-metadata.py <output> <target> <start> <max> <step-seconds> <rest-seconds> <stop-p95-ms> <label> <k6-image> <script-dir> [executor iterations]", file=sys.stderr)
        return 2

    output, target, start_text, maximum_text, step_text, rest_text, p95_text, label, image, script_dir = sys.argv[1:11]
    executor = sys.argv[11] if len(sys.argv) == 13 else "constant-arrival-rate"
    fixed_iterations = sys.argv[12] if len(sys.argv) == 13 else None
    if target not in TARGETS:
        print(f"unknown target: {target}", file=sys.stderr)
        return 2

    try:
        start, maximum = int(start_text), int(maximum_text)
        step, rest, stop_p95 = int(step_text), int(rest_text), int(p95_text)
    except ValueError:
        print("rates and limits must be integers", file=sys.stderr)
        return 2
    if executor not in ("constant-arrival-rate", "per-vu-iterations"):
        print(f"unsupported executor: {executor}", file=sys.stderr)
        return 2
    if start < 1 or maximum < start or (executor == "constant-arrival-rate" and step < 1) or rest < 0 or stop_p95 < 1:
        print("invalid rate schedule or limits", file=sys.stderr)
        return 2
    if executor == "per-vu-iterations":
        try:
            fixed_iterations = int(fixed_iterations or "")
        except ValueError:
            print("fixed-count executor requires a positive iteration count", file=sys.stderr)
            return 2
        if fixed_iterations < 1:
            print("fixed-count executor requires a positive iteration count", file=sys.stderr)
            return 2
    else:
        fixed_iterations = None

    rates = []
    rate = start
    while rate <= maximum:
        rates.append(rate)
        rate *= 2

    source_files = ("k6-guest.js", "response-contract.mjs", "summarize.py", "run-steps.sh", "profile-metadata.py", "count-queries.sh", "cleanup.sh", "preflight.sh", "guard.sh")
    source_hashes = {}
    for name in source_files:
        source = Path(script_dir) / name
        if not source.is_file():
            print(f"missing profile source: {source}", file=sys.stderr)
            return 2
        source_hashes[name] = hashlib.sha256(source.read_bytes()).hexdigest()

    target = TARGETS[target]
    iteration_unit = target["iteration_unit"]
    profile = {
        "schema_version": 1,
        "profile_id": "polutek-guest-read-only-v1",
        "label": label,
        "target": sys.argv[2],
        "executor": executor,
        "rate_metric": (
            target.get("rate_metric", "single_endpoint_requests_per_second")
            if executor == "constant-arrival-rate" else "fixed_request_count"
        ),
        "iteration_unit": iteration_unit,
        "requests_per_iteration": target["requests_per_iteration"],
        "routes": target["routes"] if "routes" in target else [{"route": target["route"], "count": 1, "execution": "one_request"}],
        "rate_schedule_per_second": rates if executor == "constant-arrival-rate" else None,
        "fixed_iteration_count": fixed_iterations,
        "step_duration_seconds": step if executor == "constant-arrival-rate" else None,
        "rest_between_steps_seconds": rest,
        "stop_p95_ms": stop_p95,
        "viewer_concurrency_measured": False,
        "interpretation": (
            "Exactly N sequential fixed-count iterations; this is not throughput or concurrent viewers."
            if executor == "per-vu-iterations"
            else "Rate is new guest journeys per second, not concurrent viewers."
            if iteration_unit == "new_guest_journey"
            else "Rate is requests per second to one endpoint, not viewers or concurrent sessions."
        ),
        "cache_state": "unspecified; label is descriptive and does not prove cache state",
        "generator_image_reference": image,
        "source_sha256": source_hashes,
    }
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(profile, indent=2, sort_keys=True) + "\n"
    if output_path.exists():
        if output_path.read_text(encoding="utf-8") != serialized:
            print(f"profile already exists with different content: {output_path}; choose a new LABEL or OUT_DIR", file=sys.stderr)
            return 2
        return 0
    output_path.write_text(serialized, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

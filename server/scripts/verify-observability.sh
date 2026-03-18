#!/usr/bin/env bash
set -euo pipefail

prometheus_url="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
payload="$(curl -fsS "${prometheus_url}/api/v1/targets")"

python3 - <<'PY' "${payload}"
import json
import sys

payload = json.loads(sys.argv[1])
active_targets = payload.get("data", {}).get("activeTargets", [])

required_jobs = {"aiworld-production-api"}
seen = {}

for target in active_targets:
    job = target.get("labels", {}).get("job")
    if job in required_jobs:
        seen[job] = target.get("health")

missing = [job for job in sorted(required_jobs) if seen.get(job) != "up"]
if missing:
    raise SystemExit(f"Observability check failed. Targets not healthy: {', '.join(missing)}")

print("Observability targets healthy:", ", ".join(f"{job}=up" for job in sorted(required_jobs)))
PY

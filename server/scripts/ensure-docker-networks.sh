#!/usr/bin/env bash
set -euo pipefail

for network in aiworld-edge aiworld-observability; do
  if ! docker network inspect "${network}" >/dev/null 2>&1; then
    docker network create "${network}" >/dev/null
  fi
done

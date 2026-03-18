#!/usr/bin/env bash
set -euo pipefail

rollback_tag="${1:?Usage: rollback-stack.sh <image-tag>}"

REGISTRY="${REGISTRY:?Missing REGISTRY}" IMAGE_TAG="${rollback_tag}" \
  "$(dirname "$0")/deploy-stack.sh"

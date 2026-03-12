#!/usr/bin/env bash
set -euo pipefail

stack="${1:?Usage: rollback-stack.sh <production|staging> <image-tag>}"
rollback_tag="${2:?Usage: rollback-stack.sh <production|staging> <image-tag>}"

REGISTRY="${REGISTRY:?Missing REGISTRY}" IMAGE_TAG="${rollback_tag}" \
  "$(dirname "$0")/deploy-stack.sh" "${stack}"

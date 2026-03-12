#!/usr/bin/env bash
set -euo pipefail

stack="${1:?Usage: deploy-stack.sh <production|staging>}"

case "${stack}" in
  production)
    project_name="aiworld-production"
    compose_file="docker-compose.prod.yml"
    stack_env_file=".env.production"
    ;;
  staging)
    project_name="aiworld-staging"
    compose_file="docker-compose.staging.yml"
    stack_env_file=".env.staging"
    ;;
  *)
    echo "Unsupported stack: ${stack}" >&2
    exit 1
    ;;
esac

: "${REGISTRY:?Missing REGISTRY}"
: "${IMAGE_TAG:?Missing IMAGE_TAG}"

load_stack_env_file() {
  local env_file_path="${1}"
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"

    case "${line}" in
      ""|\#*)
        continue
        ;;
    esac

    local key="${line%%=*}"
    local value="${line#*=}"

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "${key}=${value}"
  done < "${env_file_path}"
}

if [ -f "${stack_env_file}" ]; then
  load_stack_env_file "./${stack_env_file}"
fi

"$(dirname "$0")/ensure-docker-networks.sh"

docker compose -p "${project_name}" -f "${compose_file}" up -d postgres redis
if [ "${REGISTRY}" != "local" ] && [ "${SKIP_PULL:-0}" != "1" ]; then
  docker compose -p "${project_name}" -f "${compose_file}" pull api worker web
fi
docker compose -p "${project_name}" -f "${compose_file}" run --rm api npx prisma migrate deploy
docker compose -p "${project_name}" -f "${compose_file}" up -d api worker web

for _ in $(seq 1 30); do
  if docker compose -p "${project_name}" -f "${compose_file}" exec -T api wget -q --spider http://localhost:3000/ready; then
    exit 0
  fi
  sleep 2
done

echo "Stack ${stack} did not become ready in time." >&2
exit 1

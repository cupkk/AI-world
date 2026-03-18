#!/usr/bin/env bash
set -euo pipefail

aiworld_require_stack() {
  local stack="${1:-}"
  case "$stack" in
    production) ;;
    *)
      echo "Unsupported stack: ${stack}. Use production." >&2
      exit 1
      ;;
  esac
}

aiworld_stack_project_name() {
  local stack="${1}"
  aiworld_require_stack "$stack"
  echo "aiworld-${stack}"
}

aiworld_stack_postgres_container() {
  local stack="${1}"
  aiworld_require_stack "$stack"
  echo "aiworld-${stack}-postgres-1"
}

aiworld_stack_default_db_name() {
  local stack="${1}"
  aiworld_require_stack "$stack"
  echo "aiworld"
}

aiworld_stack_default_base_url() {
  local stack="${1}"
  aiworld_require_stack "$stack"
  echo "https://ai-world.asia"
}

aiworld_stack_default_backup_dir() {
  local stack="${1}"
  aiworld_require_stack "$stack"
  echo "/opt/aiworld/backups/${stack}"
}

aiworld_container_env_or_default() {
  local container="${1}"
  local key="${2}"
  local default_value="${3}"
  local value

  value="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${container}" \
    | awk -F= -v target="${key}" '$1 == target { print substr($0, index($0, "=") + 1); exit }')"

  if [ -n "${value}" ]; then
    echo "${value}"
  else
    echo "${default_value}"
  fi
}

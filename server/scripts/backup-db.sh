#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./stack-env.sh
source "${script_dir}/stack-env.sh"

stack="${1:-${STACK:-production}}"
aiworld_require_stack "${stack}"

CONTAINER_NAME="${CONTAINER_NAME:-$(aiworld_stack_postgres_container "${stack}")}"
OUTPUT_DIR="${OUTPUT_DIR:-$(aiworld_stack_default_backup_dir "${stack}")}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$OUTPUT_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Postgres container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

DB_NAME="${DB_NAME:-$(aiworld_container_env_or_default "${CONTAINER_NAME}" POSTGRES_DB "$(aiworld_stack_default_db_name "${stack}")")}"
DB_USER="${DB_USER:-$(aiworld_container_env_or_default "${CONTAINER_NAME}" POSTGRES_USER "aiworld")}"

timestamp="$(date +%Y%m%d_%H%M%S)"
output_file="$OUTPUT_DIR/${DB_NAME}_${timestamp}.dump"
checksum_file="$output_file.sha256"

docker exec "$CONTAINER_NAME" sh -lc "pg_dump -U '$DB_USER' -d '$DB_NAME' -Fc" > "$output_file"
sha256sum "$output_file" > "$checksum_file"

find "$OUTPUT_DIR" -type f \( -name '*.dump' -o -name '*.sha256' \) -mtime "+$RETENTION_DAYS" -delete

echo "Backup created: $output_file"
echo "Target stack: $stack"

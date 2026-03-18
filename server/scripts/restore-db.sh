#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./stack-env.sh
source "${script_dir}/stack-env.sh"

usage() {
  cat <<'EOF'
Usage:
  restore-db.sh [backup-file] [--force] [--dry-run]

Examples:
  ./scripts/restore-db.sh --dry-run
  ./scripts/restore-db.sh /opt/aiworld/backups/production/aiworld_20260312_120000.dump --force
EOF
}

stack="${STACK:-production}"
backup_file="${BACKUP_FILE:-}"
force="${FORCE:-0}"
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    production)
      stack="$1"
      shift
      ;;
    --backup-file)
      backup_file="${2:?Missing value for --backup-file}"
      shift 2
      ;;
    --force)
      force=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -z "${backup_file}" ]; then
        backup_file="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

aiworld_require_stack "${stack}"

container_name="${CONTAINER_NAME:-$(aiworld_stack_postgres_container "${stack}")}"
output_dir="${OUTPUT_DIR:-$(aiworld_stack_default_backup_dir "${stack}")}"

if ! docker ps --format '{{.Names}}' | grep -qx "${container_name}"; then
  echo "Postgres container '${container_name}' is not running" >&2
  exit 1
fi

db_name="${DB_NAME:-$(aiworld_container_env_or_default "${container_name}" POSTGRES_DB "$(aiworld_stack_default_db_name "${stack}")")}"
db_user="${DB_USER:-$(aiworld_container_env_or_default "${container_name}" POSTGRES_USER "aiworld")}"

if [ -z "${backup_file}" ]; then
  backup_file="$(find "${output_dir}" -maxdepth 1 -type f -name '*.dump' | sort | tail -n 1)"
fi

if [ -z "${backup_file}" ] || [ ! -f "${backup_file}" ]; then
  echo "Backup file not found. Pass a dump path explicitly or place one under ${output_dir}." >&2
  exit 1
fi

checksum_file="${backup_file}.sha256"
if [ -f "${checksum_file}" ]; then
  sha256sum --check "${checksum_file}"
fi

if [ "${dry_run}" = "1" ]; then
  cat "${backup_file}" | docker exec -i "${container_name}" sh -lc "pg_restore --list >/dev/null"
  echo "Dry run OK for ${backup_file}"
  echo "Target stack: ${stack}"
  echo "Target container: ${container_name}"
  echo "Target database: ${db_name}"
  exit 0
fi

if [ "${force}" != "1" ]; then
  printf "This will REPLACE database '%s' on stack '%s'. Type YES to continue: " "${db_name}" "${stack}"
  read -r confirmation
  if [ "${confirmation}" != "YES" ]; then
    echo "Restore aborted."
    exit 1
  fi
fi

terminate_sql="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}' AND pid <> pg_backend_pid();"

docker exec "${container_name}" sh -lc "psql -U '${db_user}' -d postgres -c \"${terminate_sql}\"" >/dev/null
docker exec "${container_name}" sh -lc "dropdb -U '${db_user}' --if-exists '${db_name}'"
docker exec "${container_name}" sh -lc "createdb -U '${db_user}' '${db_name}'"
cat "${backup_file}" | docker exec -i "${container_name}" sh -lc "pg_restore -U '${db_user}' -d '${db_name}' --no-owner --no-privileges"

table_count="$(docker exec "${container_name}" sh -lc "psql -U '${db_user}' -d '${db_name}' -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\"")"
echo "Restore completed."
echo "Target stack: ${stack}"
echo "Target database: ${db_name}"
echo "public schema table count: ${table_count}"

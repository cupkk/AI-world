#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  issue-certificate.sh [--dry-run] [--email ops@example.com] [--cert-name ai-world.asia] [--webroot-volume ops_certbot-webroot] domain [domain...]

Examples:
  ./scripts/issue-certificate.sh --dry-run ai-world.asia www.ai-world.asia staging.ai-world.asia
  ./scripts/issue-certificate.sh --email ops@ai-world.asia ai-world.asia www.ai-world.asia staging.ai-world.asia
EOF
}

dry_run=0
cert_name="${CERT_NAME:-ai-world.asia}"
webroot_volume="${CERTBOT_WEBROOT_VOLUME:-ops_certbot-webroot}"
edge_container="${EDGE_CONTAINER_NAME:-aiworld-edge}"
email="${CERTBOT_EMAIL:-}"
domains=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run=1
      shift
      ;;
    --email)
      email="${2:?Missing value for --email}"
      shift 2
      ;;
    --cert-name)
      cert_name="${2:?Missing value for --cert-name}"
      shift 2
      ;;
    --webroot-volume)
      webroot_volume="${2:?Missing value for --webroot-volume}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      domains+=("$1")
      shift
      ;;
  esac
done

if [ "${#domains[@]}" -eq 0 ]; then
  usage >&2
  exit 1
fi

webroot_path="/var/lib/docker/volumes/${webroot_volume}/_data"

if [ ! -d "${webroot_path}" ]; then
  echo "Certbot webroot volume path not found: ${webroot_path}" >&2
  exit 1
fi

cmd=(
  certbot certonly
  --webroot
  -w "${webroot_path}"
  --cert-name "${cert_name}"
  --expand
  -n
  --agree-tos
)

if [ "${dry_run}" = "1" ]; then
  cmd+=(--dry-run)
fi

if [ -n "${email}" ]; then
  cmd+=(-m "${email}")
fi

for domain in "${domains[@]}"; do
  cmd+=(-d "${domain}")
done

"${cmd[@]}"
docker restart "${edge_container}" >/dev/null

echo "Certificate ready for: ${domains[*]}"
if [ "${dry_run}" = "1" ]; then
  echo "Dry run completed."
fi

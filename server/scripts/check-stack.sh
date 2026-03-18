#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-}"

if [ -z "${base_url}" ]; then
  base_url="https://ai-world.asia"
fi

base_url="$(printf '%s' "${base_url}" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
case "${base_url}" in
  \"*\")
    base_url="${base_url#\"}"
    base_url="${base_url%\"}"
    ;;
esac
case "${base_url}" in
  \'*\')
    base_url="${base_url#\'}"
    base_url="${base_url%\'}"
    ;;
esac
base_url="${base_url%/}"

if [ -z "${base_url}" ]; then
  echo "Base URL is empty after trimming." >&2
  exit 1
fi

case "${base_url}" in
  http://*|https://*)
    ;;
  *)
    echo "Base URL must start with http:// or https://. Current value: ${base_url}" >&2
    exit 1
    ;;
esac

case "${base_url}" in
  *" "*)
    echo "Base URL must not contain spaces. Current value: ${base_url}" >&2
    exit 1
    ;;
esac

echo "Checking production readiness at ${base_url}"
curl -fsS "${base_url}/ready" >/dev/null
curl -fsS "${base_url}/health" >/dev/null

redirect_location="$(curl -fsSI https://www.ai-world.asia/ | awk 'BEGIN{IGNORECASE=1} /^location:/ {gsub("\r",""); print $2; exit}')"
if [ "${redirect_location}" != "https://ai-world.asia/" ]; then
  echo "Unexpected production canonical redirect: ${redirect_location}" >&2
  exit 1
fi

echo "Production stack is healthy."

#!/usr/bin/env bash
# ============================================================================
# validate-migrations.sh
# Run in CI or manually to verify Prisma migrations apply cleanly
# against a fresh PostgreSQL instance.
#
# Usage:
#   DATABASE_URL='postgresql://...' bash scripts/validate-migrations.sh
# ============================================================================

set -euo pipefail

echo "==> Checking Prisma schema validity..."
npx prisma validate

echo "==> Generating Prisma Client..."
npx prisma generate

echo "==> Applying all migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "==> Checking for migration drift (prisma migrate diff)..."
diff_output="$(npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --exit-code 2>&1 || true)"

if [ -n "${diff_output}" ]; then
  echo "Schema drift detected. Run 'npx prisma migrate dev' to generate a new migration:"
  echo "${diff_output}"
  exit 1
fi

echo "All migrations applied successfully. Schema is in sync."

# AI-World Ops Runbook

## Scope

This runbook covers the Linux server operations for the dual-stack deployment:

- production: `aiworld-production`
- staging: `aiworld-staging`
- edge: `aiworld-edge`
- observability: `aiworld-prometheus` and `aiworld-alertmanager`

## Common Commands

```bash
cd /opt/aiworld/server
chmod +x ./scripts/*.sh
./scripts/ensure-docker-networks.sh
docker compose -f ./ops/docker-compose.edge.yml up -d
docker compose -f ./ops/docker-compose.observability.yml up -d
```

## Deploy

```bash
cd /opt/aiworld/server
REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh staging
./scripts/check-stack.sh staging

REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh production
./scripts/check-stack.sh production
```

## Rollback

```bash
cd /opt/aiworld/server
REGISTRY=<registry> ./scripts/rollback-stack.sh production <previous-tag>
./scripts/check-stack.sh production
```

## Certificates

```bash
cd /opt/aiworld/server
./scripts/issue-certificate.sh --dry-run ai-world.asia www.ai-world.asia staging.ai-world.asia
./scripts/issue-certificate.sh ai-world.asia www.ai-world.asia staging.ai-world.asia
```

## Backups

```bash
cd /opt/aiworld/server
npm run ops:backup
npm run ops:backup:staging
```

## Restore

Dry-run:

```bash
cd /opt/aiworld/server
./scripts/restore-db.sh production --dry-run
./scripts/restore-db.sh staging --dry-run
```

Restore:

```bash
cd /opt/aiworld/server
npm run ops:restore
npm run ops:restore:staging
```

## Observability

Prometheus listens on `127.0.0.1:9090`.

Validate scrape targets:

```bash
cd /opt/aiworld/server
./scripts/verify-observability.sh
```

Expected targets:

- `aiworld-production-api`
- `aiworld-staging-api`

## Post-Deploy Validation

```bash
cd /opt/aiworld/server
./scripts/check-stack.sh production
./scripts/check-stack.sh staging
```

Root repository live checks:

```bash
set PRODUCTION_BASE_URL=https://ai-world.asia
set PLAYWRIGHT_BASE_URL=https://ai-world.asia
npm run test:live:prod-smoke

set STAGING_BASE_URL=https://staging.ai-world.asia
set PLAYWRIGHT_BASE_URL=https://staging.ai-world.asia
set LIVE_ALLOW_MUTATIONS=1
npm run test:live:staging-mutation
```

Recommended release order:

1. `CI`
2. `Deploy Staging`
3. Complete the checklist in `docs/上线运营清单.md`
4. `Promote Production`
5. Fill `docs/发布记录模板.md`

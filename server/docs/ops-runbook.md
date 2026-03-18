# Server Ops Runbook

Updated: 2026-03-17

## Scope

This runbook covers the current production-only deployment on the ECS host.

- Host: `47.238.143.212`
- App root: `/opt/aiworld`
- Stack: `aiworld-production`

## Deploy

Run from `/opt/aiworld/server`:

```bash
chmod +x ./scripts/*.sh
./scripts/ensure-docker-networks.sh
docker compose -f ./ops/docker-compose.edge.yml up -d
docker compose -f ./ops/docker-compose.observability.yml up -d
REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh
./scripts/check-stack.sh
./scripts/verify-observability.sh
```

If images are built locally on the host:

```bash
REGISTRY=<registry> IMAGE_TAG=<tag> SKIP_PULL=1 ./scripts/deploy-stack.sh
```

## Rollback

```bash
REGISTRY=<registry> ./scripts/rollback-stack.sh <previous-tag>
./scripts/check-stack.sh
```

## Certs

```bash
./scripts/issue-certificate.sh ai-world.asia www.ai-world.asia
```

## Backup

```bash
npm run ops:backup
```

## Restore

Dry run:

```bash
./scripts/restore-db.sh --dry-run
```

Execute:

```bash
npm run ops:restore
```

## Smoke

Run from repo root on an operator machine:

```bash
set PRODUCTION_BASE_URL=https://ai-world.asia
set PLAYWRIGHT_BASE_URL=https://ai-world.asia
set LIVE_ENABLE_ASSISTANT=0
set LIVE_ENABLE_KNOWLEDGE_BASE=0
npm run test:live:prod-smoke
```

## Critical release gates

- `SESSION_SECRET` must be rotated from any default value
- `ENABLE_PUBLIC_SAMPLE_INVITES=false`
- `ENABLE_DEMO_INVITES=false`
- Assistant / KB flags must be intentionally set
- `/api/auth/invite/samples` must not expose public invite codes

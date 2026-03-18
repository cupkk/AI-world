# AI-World

AI-World is a community platform for learners, experts, and enterprise leaders. This repository contains the React frontend, NestJS API, background worker, knowledge-base pipeline, and the production deployment assets used on the live server.

## Stack

- Frontend: Vite + React + TypeScript
- Backend: NestJS + Prisma + PostgreSQL + Redis
- Worker: Python task runner for knowledge-base processing
- Observability: Prometheus + Alertmanager

## Repository Layout

- `src/`: frontend application
- `server/`: API, Prisma schema, Docker Compose, ops scripts
- `worker/`: asynchronous file-processing worker
- `tests/e2e/`: local mocked Playwright tests
- `tests/live/`: production live smoke tests
- `docs/`: deployment and acceptance documentation

## Local Development

### Frontend

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

### Backend

```bash
cd server
npm install
cp .env.example .env.local
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Default URL: `http://localhost:3000`

### Worker

```bash
cd worker
pip install -r requirements.txt
python -m celery_app
```

## Environment Files

Local development uses:

- `.env.example`
- `server/.env.example`

Production uses:

- frontend build-time flags: `.env.production.example`
- API and worker runtime envs: `server/.env.production.example`

Production must set:

- `REQUIRE_OSS=true`
- `REQUIRE_SMTP=true`
- `ENABLE_DEMO_INVITES=false`
- `ENABLE_PUBLIC_SAMPLE_INVITES=false`
- `SEED_INCLUDE_DEMO_DATA=false`

Frontend builds must disable demo mode and public sample invite UI:

- `VITE_ENABLE_DEMO_MODE=false`
- `VITE_ALLOW_DEMO_PREFILL=false`
- `VITE_ENABLE_PUBLIC_SAMPLE_INVITES=false`

Production must set assistant / knowledge-base flags explicitly on both sides:

- frontend: `VITE_ENABLE_ASSISTANT`, `VITE_ENABLE_KNOWLEDGE_BASE`
- backend: `ENABLE_ASSISTANT`, `ENABLE_KNOWLEDGE_BASE`

If assistant is enabled for release, also set:

- `REQUIRE_LLM=true`

Run preflight before deploying:

```bash
npm run release:preflight:production
```

Point the preflight script at real env files when needed:

```bash
node ./scripts/release-preflight.mjs --mode production --frontend-file .env.production --backend-file server/.env.production
```

## Testing

### Frontend

```bash
npm exec tsc --noEmit
npm run build
npx playwright test --project=chromium
```

### Backend

```bash
cd server
npm exec tsc --noEmit
npm test -- --runInBand
```

### Live Smoke

```bash
set PRODUCTION_BASE_URL=https://ai-world.asia
set PLAYWRIGHT_BASE_URL=https://ai-world.asia
set LIVE_ENABLE_ASSISTANT=0
set LIVE_ENABLE_KNOWLEDGE_BASE=0
set LIVE_ADMIN_EMAIL=<admin-email>
set LIVE_ADMIN_PASSWORD=<admin-password>
set LIVE_LEARNER_EMAIL=<learner-email>
set LIVE_LEARNER_PASSWORD=<learner-password>
set LIVE_EXPERT_EMAIL=<expert-email>
set LIVE_EXPERT_PASSWORD=<expert-password>
set LIVE_ENTERPRISE_EMAIL=<enterprise-email>
set LIVE_ENTERPRISE_PASSWORD=<enterprise-password>
npm run test:live:prod-smoke
```

Set `LIVE_ENABLE_ASSISTANT=1` and/or `LIVE_ENABLE_KNOWLEDGE_BASE=1` only when those modules are intentionally opened in production.

## Deployment Model

The repository uses a single ECS host with one production Compose stack:

- `server/docker-compose.prod.yml`: production application stack
- `server/ops/docker-compose.edge.yml`: edge nginx for `ai-world.asia` and `www.ai-world.asia`
- `server/ops/docker-compose.observability.yml`: Prometheus and Alertmanager

Public exposure is limited to:

- `/ready`
- `/health`

`/metrics` is private and scraped only over the Docker network.

## Deployment Scripts

Run from `server/` on the Linux host:

```bash
chmod +x ./scripts/*.sh
./scripts/ensure-docker-networks.sh
docker compose -f ./ops/docker-compose.edge.yml up -d
docker compose -f ./ops/docker-compose.observability.yml up -d
REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh
./scripts/check-stack.sh
./scripts/verify-observability.sh
```

Rollback:

```bash
REGISTRY=<registry> ./scripts/rollback-stack.sh <previous-tag>
```

Certificate management:

```bash
./scripts/issue-certificate.sh ai-world.asia www.ai-world.asia
```

Database backup and restore:

```bash
npm --prefix server run ops:backup
./server/scripts/restore-db.sh --dry-run
```

## CI

The repository keeps a single CI workflow:

- `ci.yml`: type checks, builds, unit tests, mocked E2E, Docker build checks

Recommended release sequence:

1. Run local/browser regression and `npm run release:preflight:production`.
2. Build and deploy directly to the production server.
3. Run `npm run test:live:prod-smoke`.
4. Record the release.

## Shared Contracts

- shared enums and status values: `server/src/common/contracts.ts`
- frontend reuse entrypoint: `src/lib/contracts.ts`

When contract values change, update the shared definition first and then the frontend and backend callers.

## Assistant Contract

`POST /api/assistant/recommend`

- success: returns the recommendation payload
- failure: returns HTTP `503`
- machine-readable code: `errorCode: "ASSISTANT_UNAVAILABLE"`

The frontend no longer falls back to fake local recommendations.

## External Prerequisites

The repository does not manage these cloud resources automatically:

- fixed EIP for the ECS instance
- DNS for `ai-world.asia` and `www.ai-world.asia`
- TLS certificate issuance and renewal
- rotated SMTP, OSS, and LLM credentials

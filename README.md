# AI-World

AI-World is a community platform for learners, experts, and enterprise leaders. The repository contains the React frontend, NestJS API, background worker, knowledge-base pipeline, and the Docker Compose deployment model used for `staging` and `production`.

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
- `tests/live/`: staging and production live smoke tests
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

Deployments use dedicated environment files:

- frontend build-time flags: `.env.production.example`, `.env.staging.example`
- API and worker runtime envs: `server/.env.production.example`, `server/.env.staging.example`

Production and staging must both set:

- `REQUIRE_OSS=true`
- `REQUIRE_SMTP=true`
- `REQUIRE_LLM=true`
- `ENABLE_DEMO_INVITES=false`
- `SEED_INCLUDE_DEMO_DATA=false`

Frontend builds must disable demo mode:

- `VITE_ENABLE_DEMO_MODE=false`
- `VITE_ALLOW_DEMO_PREFILL=false`

## Testing

### Frontend

```bash
npm exec tsc --noEmit
npm run build
npx playwright test --project=chromium
```

Local mocked E2E runs in fail-fast mode for unmocked `/api/**` traffic.

### Backend

```bash
cd server
npm exec tsc --noEmit
npm test -- --runInBand
```

### Live Smoke

Production smoke:

```bash
set PRODUCTION_BASE_URL=https://ai-world.asia
set PLAYWRIGHT_BASE_URL=https://ai-world.asia
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

Staging smoke:

```bash
set STAGING_BASE_URL=https://staging.ai-world.asia
set PLAYWRIGHT_BASE_URL=https://staging.ai-world.asia
set LIVE_ADMIN_EMAIL_STAGING=<admin-email>
set LIVE_ADMIN_PASSWORD_STAGING=<admin-password>
set LIVE_LEARNER_EMAIL_STAGING=<learner-email>
set LIVE_LEARNER_PASSWORD_STAGING=<learner-password>
set LIVE_EXPERT_EMAIL_STAGING=<expert-email>
set LIVE_EXPERT_PASSWORD_STAGING=<expert-password>
set LIVE_ENTERPRISE_EMAIL_STAGING=<enterprise-email>
set LIVE_ENTERPRISE_PASSWORD_STAGING=<enterprise-password>
npm run test:live:staging-smoke
```

Staging mutation:

```bash
set STAGING_BASE_URL=https://staging.ai-world.asia
set PLAYWRIGHT_BASE_URL=https://staging.ai-world.asia
set LIVE_ALLOW_MUTATIONS=1
set LIVE_ADMIN_EMAIL_STAGING=<admin-email>
set LIVE_ADMIN_PASSWORD_STAGING=<admin-password>
set LIVE_LEARNER_EMAIL_STAGING=<learner-email>
set LIVE_LEARNER_PASSWORD_STAGING=<learner-password>
set LIVE_EXPERT_EMAIL_STAGING=<expert-email>
set LIVE_EXPERT_PASSWORD_STAGING=<expert-password>
set LIVE_ENTERPRISE_EMAIL_STAGING=<enterprise-email>
set LIVE_ENTERPRISE_PASSWORD_STAGING=<enterprise-password>
npm run test:live:staging-mutation
```

## Deployment Model

The repository uses a single ECS host with multiple Compose stacks:

- `server/docker-compose.prod.yml`: production application stack
- `server/docker-compose.staging.yml`: staging application stack
- `server/ops/docker-compose.edge.yml`: edge nginx for `ai-world.asia`, `www.ai-world.asia`, and `staging.ai-world.asia`
- `server/ops/docker-compose.observability.yml`: Prometheus and Alertmanager

Public exposure is limited to:

- `/ready`
- `/health`

`/metrics` is private and is scraped only over the Docker network.

## Deployment Scripts

Run from `server/` on the Linux host:

```bash
chmod +x ./scripts/*.sh
./scripts/ensure-docker-networks.sh
REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh staging
REGISTRY=<registry> IMAGE_TAG=<tag> ./scripts/deploy-stack.sh production
REGISTRY=<registry> ./scripts/rollback-stack.sh production <previous-tag>
./scripts/check-stack.sh production
./scripts/verify-observability.sh
```

Certificate management:

```bash
./scripts/issue-certificate.sh ai-world.asia www.ai-world.asia staging.ai-world.asia
```

Database backup and restore:

```bash
npm run ops:backup
npm run ops:backup:staging
./scripts/restore-db.sh production --dry-run
./scripts/restore-db.sh staging --dry-run
```

## GitHub Actions

The release chain is split into three workflows:

- `ci.yml`: type checks, builds, unit tests, mocked E2E, Docker build checks
- `deploy-staging.yml`: deploys `main` to staging and runs staging live smoke
- `promote-production.yml`: promotes an image tag that already passed staging

Required secrets are documented in [GitHub_Actions_Secrets.md](/d:/github/AI-world/docs/GitHub_Actions_Secrets.md).

Recommended release sequence:

1. Merge to `main` and wait for `CI` to pass.
2. Run `Deploy Staging`.
3. Complete the automated and manual checks in [上线运营清单.md](/d:/github/AI-world/docs/%E4%B8%8A%E7%BA%BF%E8%BF%90%E8%90%A5%E6%B8%85%E5%8D%95.md).
4. Run `Promote Production` with the same commit SHA as `image_tag`.
5. Record the release in [发布记录模板.md](/d:/github/AI-world/docs/%E5%8F%91%E5%B8%83%E8%AE%B0%E5%BD%95%E6%A8%A1%E6%9D%BF.md).

## Shared Contracts

- shared enums and status values: `server/src/common/contracts.ts`
- frontend reuse entrypoint: `src/lib/contracts.ts`

When contract values change, update the shared definition first and then the frontend and backend callers.

## Assistant Contract

`POST /api/assistant/recommend`

- success: returns the recommendation payload
- failure: returns HTTP `503`
- machine-readable code: `errorCode: "ASSISTANT_UNAVAILABLE"`

The frontend no longer falls back to a fake "local mode".

## External Prerequisites

The repository does not manage these cloud resources automatically:

- fixed EIP for the ECS instance
- DNS for `ai-world.asia`, `www.ai-world.asia`, `staging.ai-world.asia`
- TLS certificate issuance and renewal
- rotated SMTP, OSS, and LLM credentials

Operational details are documented in [运维手册.md](/d:/github/AI-world/docs/%E8%BF%90%E7%BB%B4%E6%89%8B%E5%86%8C.md).

# GitHub Actions Secrets 清单

以下 secrets 需要配置在仓库的 GitHub Actions `staging` / `production` environment 中。

## 1. 通用部署 Secrets

这组 secrets 由 `deploy-staging.yml` 和 `promote-production.yml` 共用。

| Secret | 说明 |
| --- | --- |
| `DEPLOY_HOST` | ECS 公网 IP 或堡垒机出口地址。只填裸 IP/主机名，例如 `47.238.143.212`，不要带 `https://`、端口、路径、引号或空格。 |
| `DEPLOY_USER` | 服务器登录用户，当前生产环境通常为 `root`。 |
| `DEPLOY_SSH_KEY` | 部署专用 SSH 私钥。不要复用个人开发机私钥。 |

## 2. 镜像仓库 Secrets

当前 workflow 支持两种模式：

1. 推荐：不配置任何 `DOCKER_REGISTRY*` secrets，自动使用 `GHCR`。
2. 可选：如果已经有 ACR 或其他私有 registry，再显式配置下面 4 个 secrets。

| Secret | 是否必需 | 说明 |
| --- | --- | --- |
| `DOCKER_REGISTRY` | 可选 | 镜像前缀，例如 `registry.example.com/team`。 |
| `DOCKER_REGISTRY_HOST` | 可选 | registry host，例如 `registry.example.com`。 |
| `DOCKER_REGISTRY_USER` | 可选 | registry 用户名。 |
| `DOCKER_REGISTRY_PASS` | 可选 | registry 密码或 token。 |

约束：

- 只要启用自定义 registry，就必须把这 4 个值配齐。
- 如果不配置这 4 个值，workflow 会自动回退到 `ghcr.io/<owner>/<repo>`。
- 使用 GHCR 时，workflow 使用当前 job 的 `GITHUB_TOKEN` 登录。

## 3. Staging Environment

| Secret | 说明 |
| --- | --- |
| `STAGING_BASE_URL` | `https://staging.ai-world.asia` |
| `LIVE_ADMIN_EMAIL_STAGING` | staging 管理员账号 |
| `LIVE_ADMIN_PASSWORD_STAGING` | staging 管理员密码 |
| `LIVE_LEARNER_EMAIL_STAGING` | staging 学员账号 |
| `LIVE_LEARNER_PASSWORD_STAGING` | staging 学员密码 |
| `LIVE_EXPERT_EMAIL_STAGING` | staging 专家账号 |
| `LIVE_EXPERT_PASSWORD_STAGING` | staging 专家密码 |
| `LIVE_ENTERPRISE_EMAIL_STAGING` | staging 企业账号 |
| `LIVE_ENTERPRISE_PASSWORD_STAGING` | staging 企业密码 |

## 4. Production Environment

| Secret | 说明 |
| --- | --- |
| `PRODUCTION_BASE_URL` | `https://ai-world.asia` |
| `LIVE_ADMIN_EMAIL` | production 管理员 smoke 账号 |
| `LIVE_ADMIN_PASSWORD` | production 管理员 smoke 密码 |
| `LIVE_LEARNER_EMAIL` | production 学员 smoke 账号 |
| `LIVE_LEARNER_PASSWORD` | production 学员 smoke 密码 |
| `LIVE_EXPERT_EMAIL` | production 专家 smoke 账号 |
| `LIVE_EXPERT_PASSWORD` | production 专家 smoke 密码 |
| `LIVE_ENTERPRISE_EMAIL` | production 企业 smoke 账号 |
| `LIVE_ENTERPRISE_PASSWORD` | production 企业 smoke 密码 |

## 5. 配置建议

- `production` smoke 账号只用于只读冒烟，不要复用 staging mutation 账号。
- staging mutation 用例已经会自动注册新的 learner 测试账号，管理员账号仍需要单独配置。
- `DEPLOY_HOST` 和 `*_BASE_URL` 都会在 workflow 中做格式校验，但仍建议手工检查是否有空格、换行或引号。
- 如需切换到新的部署私钥，先更新服务器 `authorized_keys`，再替换 `DEPLOY_SSH_KEY`。
- 凭据轮换后，要同步更新 GitHub secrets、服务器环境变量和供应商控制台配置。

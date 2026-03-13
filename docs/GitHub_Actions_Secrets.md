# GitHub Actions Secrets 清单

以下 secrets 需要配置在仓库的 GitHub Actions `staging` / `production` environment 中。

## 1. 通用部署 Secrets

这些是 `deploy-staging` 和 `promote-production` 都必须存在的。

| Secret | 说明 |
| --- | --- |
| `DEPLOY_HOST` | ECS 公网 IP 或堡垒机出口地址。只填裸 IP/主机名，例如 `47.238.143.212`，不要带 `https://`、端口、路径、引号或空格。 |
| `DEPLOY_USER` | 服务器登录用户，当前生产环境通常为 `root` |
| `DEPLOY_SSH_KEY` | 用于部署的 SSH 私钥 |

## 2. 镜像仓库 Secrets

现在 workflow 默认支持两种模式：

1. 推荐：不配置任何 `DOCKER_REGISTRY_*`，直接使用 GitHub Container Registry (`ghcr.io`)。
2. 可选：如果你已经有阿里云 ACR / 私有 registry，再显式配置以下 secrets。

| Secret | 是否必需 | 说明 |
| --- | --- | --- |
| `DOCKER_REGISTRY` | 可选 | 镜像前缀，例如 `registry.example.com/team` |
| `DOCKER_REGISTRY_HOST` | 可选 | registry host，例如 `registry.example.com` |
| `DOCKER_REGISTRY_USER` | 可选 | registry 用户名 |
| `DOCKER_REGISTRY_PASS` | 可选 | registry 密码或 token |

说明：
- 如果 4 个都不配，workflow 会自动回退到 `ghcr.io/<owner>/<repo>`。
- 如果只配了 `DOCKER_REGISTRY`，`DOCKER_REGISTRY_HOST` 会优先从前缀自动推断。
- 如果走 GHCR，workflow 使用当前 job 的 `GITHUB_TOKEN` 自动登录。

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

- `production` 的 smoke 账号只用于只读冒烟，不要复用 staging mutation 账号。
- staging mutation 账号建议与人工测试账号分开，避免数据互相覆盖。
- `DEPLOY_SSH_KEY` 不要复用个人开发机私钥，单独创建部署专用密钥。
- 如果使用阿里云 ACR，优先使用机器人账号或访问令牌，不要直接使用个人主账号密码。
- 如果切到 GHCR，仓库需要保留 workflow 默认的 `packages` 权限，不要在组织层面额外收紧到不可读写。

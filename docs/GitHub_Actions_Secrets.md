# GitHub Actions Secrets 清单

以下 secrets 需要配置在仓库的 GitHub Actions `staging` / `production` environment 中。

## 通用

| Secret | 说明 |
| --- | --- |
| `DOCKER_REGISTRY_HOST` | 镜像仓库 Host，例如 `registry.example.com` |
| `DOCKER_REGISTRY` | 镜像仓库前缀，例如 `registry.example.com/team` |
| `DOCKER_REGISTRY_USER` | 镜像仓库用户名 |
| `DOCKER_REGISTRY_PASS` | 镜像仓库密码或 token |
| `DEPLOY_HOST` | ECS 公网地址或堡垒机出口地址 |
| `DEPLOY_USER` | 服务器登录用户，当前生产环境为 `root` |
| `DEPLOY_SSH_KEY` | 用于部署的私钥 |

## Staging Environment

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

## Production Environment

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

## 建议

- production smoke 账号只用于只读冒烟，不用于 staging mutation。
- staging mutation 账号建议独立于人工测试账号，避免真实内容被测试覆盖。
- `DEPLOY_SSH_KEY` 不要复用个人开发机私钥，单独创建部署密钥。
- 如果镜像仓库使用阿里云 ACR，优先使用机器人账号而不是个人账号密码。

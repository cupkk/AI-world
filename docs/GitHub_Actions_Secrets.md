# GitHub Actions Secrets

更新时间：2026-03-17

当前仓库只保留 `CI` 工作流，不再通过 GitHub Actions 直接部署生产环境。

## 1. 当前状态

- 不再需要 `staging` / `production` environment secrets
- 不再需要 `DEPLOY_SSH_KEY`
- 不再需要 staging 账号类 live test secrets

## 2. 现有 CI 说明

当前 `ci.yml` 只执行：

- 前端类型检查与构建
- Playwright mocked E2E
- 后端构建与单测
- Docker build check

这些步骤不依赖生产服务器密钥。

## 3. 安全建议

以下生产敏感信息不要放入 GitHub repository secrets，除非以后重新引入自动化部署且经过单独审查：

- 生产服务器 root SSH 私钥
- 生产数据库备份访问凭据
- SMTP 凭据
- OSS 凭据
- LLM API Key

当前发布方式为人工连接服务器执行，敏感配置仅保存在受控运维环境中。

# SSH 密钥轮换清单

更新时间：2026-03-13

## 1. 背景

- 旧的部署私钥已经在交互窗口中暴露，必须按已泄露处理。
- 轮换范围至少包括：
  - 服务器 `~/.ssh/authorized_keys`
  - GitHub Actions `staging` environment 的 `DEPLOY_SSH_KEY`
  - GitHub Actions `production` environment 的 `DEPLOY_SSH_KEY`
  - 本机旧 PEM 文件与所有临时副本

## 2. 生成新部署密钥

建议在可信任的管理员机器上生成新的部署专用密钥，不要复用个人开发密钥：

```powershell
ssh-keygen -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\aiworld-deploy-2026-03" -C "github-actions-deploy@ai-world.asia"
```

如果当前环境不支持 `ed25519`，再退回到 `rsa 4096`。

## 3. 把新公钥加到服务器

先保留旧 key，不要先删，避免把自己锁在门外。

```powershell
Get-Content "$env:USERPROFILE\.ssh\aiworld-deploy-2026-03.pub" |
  ssh -i "C:\Users\18103\Downloads\AIworld (1).pem" root@47.238.143.212 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
```

也可以手工 SSH 上服务器，把 `.pub` 内容追加到：

```bash
/root/.ssh/authorized_keys
```

## 4. 验证新密钥可用

```powershell
ssh -i "$env:USERPROFILE\.ssh\aiworld-deploy-2026-03" root@47.238.143.212 "hostname && docker --version"
```

通过标准：

- 能正常登录
- 能执行 `docker --version`
- 不再依赖旧 PEM

## 5. 更新 GitHub Actions Secrets

在 GitHub 仓库中分别更新：

- `Settings -> Environments -> staging -> DEPLOY_SSH_KEY`
- `Settings -> Environments -> production -> DEPLOY_SSH_KEY`

值填写新私钥完整内容，格式如下：

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## 6. 用新密钥做一次发布验证

按顺序执行：

1. `Deploy Staging`
2. 确认 staging health / smoke 全绿
3. `Promote Production`

只要 GitHub workflow 还能正常 SSH 上服务器，这把新 key 就算切换成功。

## 7. 删除旧密钥

确认新 key 已经工作正常后，再做这一步：

1. 从服务器 `authorized_keys` 删除旧公钥
2. 从 GitHub secrets 中确认只保留新私钥
3. 删除本机旧 PEM 文件和临时副本

建议至少清理这些位置：

- `C:\Users\18103\Downloads\AIworld (1).pem`
- 工作区里曾经复制过的 `.tmp-aiworld.pem`
- 任何聊天记录、便签、脚本里残留的私钥文本

## 8. 轮换后的收尾

- 更新 [GitHub_Actions_Secrets.md](/d:/github/AI-world/docs/GitHub_Actions_Secrets.md) 中的实际维护说明
- 在发布记录里注明“旧部署私钥已完成轮换”
- 如果 SMTP / OSS / LLM 等密钥也曾暴露，同步执行供应商侧轮换

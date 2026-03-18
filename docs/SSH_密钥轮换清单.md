# SSH 密钥轮换清单

更新时间：2026-03-17

当前只维护服务器人工运维登录密钥，不再维护 GitHub Actions 自动部署密钥。

## 1. 适用范围

- 生产服务器：`root@47.238.143.212`
- 本地运维机：当前 Codex / 开发机使用的 `.pem` 或 `~/.ssh` 私钥

## 2. 轮换步骤

1. 在本地生成新密钥对，不覆盖旧密钥。
2. 登录服务器，备份当前 `/root/.ssh/authorized_keys`。
3. 将新公钥追加到 `/root/.ssh/authorized_keys`。
4. 开新终端使用新私钥登录服务器。
5. 确认可以正常执行：
   - `ssh root@47.238.143.212`
   - `docker ps`
   - `cd /opt/aiworld && docker compose -p aiworld-production -f server/docker-compose.prod.yml ps`
6. 删除旧公钥。
7. 安全销毁旧私钥及其副本。

## 3. 注意事项

- 不要直接替换唯一可用密钥，先并存再切换。
- 轮换前确认服务器控制台可用，避免把自己锁在外面。
- 如果后续重新引入 GitHub 自动部署，再单独设计 deploy key，不要复用人工运维密钥。

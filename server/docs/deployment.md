# AI-World 生产部署指南

## 目录

1. [前置条件](#前置条件)
2. [环境变量清单](#环境变量清单)
3. [Docker 全栈部署](#docker-全栈部署)
4. [手动部署](#手动部署)
5. [HTTPS/域名配置](#https域名配置)
6. [扩缩容策略](#扩缩容策略)
7. [上线检查清单](#上线检查清单)

---

## 前置条件

- Docker 20.10+ / Docker Compose v2+
- Node.js 20 LTS（手动部署时）
- PostgreSQL 16+ + pgvector 扩展
- Redis 7+
- 阿里云 OSS Bucket（知识库文件存储）
- 域名 + SSL 证书

## 环境变量清单

所有变量均在 `server/.env.example` 中有文档说明。**生产必须配置**以下项：

| 变量 | 说明 | 示例 |
|---|---|---|
| `NODE_ENV` | **必须**设为 `production` | `production` |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/aiworld` |
| `REDIS_URL` | Redis 连接串 | `redis://:password@host:6379` |
| `SESSION_SECRET` | 64 位随机字符串 | `openssl rand -hex 32` |
| `CORS_ORIGIN` | 前端域名 | `https://aiworld.com` |
| `OSS_BUCKET` | 阿里云 OSS Bucket | `aiworld-kb-prod` |
| `OSS_ACCESS_KEY_ID` | AK | - |
| `OSS_ACCESS_KEY_SECRET` | SK | - |
| `OSS_REGION` | OSS 区域 | `oss-cn-shanghai` |
| `SENTRY_DSN` | Sentry 异常追踪（可选） | `https://xxx@sentry.io/yyy` |

## Docker 全栈部署

```bash
# 1. 构建镜像
docker build -t aiworld-web:latest .
docker build -t aiworld-api:latest --target production ./server

# 2. 启动全栈
docker compose -f server/docker-compose.yml up -d

# 3. 执行数据库迁移
docker exec aiworld-api npx prisma migrate deploy

# 4. 初始化种子数据（首次）
docker exec aiworld-api npx prisma db seed

# 5. 验证
curl http://localhost/health
curl http://localhost/metrics
```

## 手动部署

### 后端

```bash
cd server
npm ci --production
npx prisma generate
npx prisma migrate deploy
npm run build
NODE_ENV=production node dist/main
```

### 前端

```bash
npm ci
npm run build
# 产出在 dist/，使用 nginx 或 CDN 托管
```

## HTTPS/域名配置

建议使用 **反向代理** 方案：

- Nginx（推荐）+ Let's Encrypt 证书
- 参考 `nginx.conf` 模板已包含 API/WS 代理规则
- 生产需添加：

```nginx
listen 443 ssl http2;
ssl_certificate     /etc/nginx/certs/fullchain.pem;
ssl_certificate_key /etc/nginx/certs/privkey.pem;
ssl_protocols       TLSv1.2 TLSv1.3;
```

## 扩缩容策略

| 层 | 策略 |
|---|---|
| 前端 | CDN 静态托管，无状态 |
| API | 多实例水平扩展（session 已用 Redis 共享），最少 2 实例 |
| PostgreSQL | 主从 + 读写分离，定期备份（见 ops-runbook） |
| Redis | Sentinel 或 Cluster |

## 上线检查清单

- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` 已设置为高强度随机值
- [ ] `CORS_ORIGIN` 仅允许生产域名
- [ ] OSS 凭证已配置
- [ ] PostgreSQL 迁移已执行（`prisma migrate deploy`）
- [ ] 种子数据已导入（首次）
- [ ] HTTPS 已配置
- [ ] `/health` 返回 `healthy`
- [ ] `/metrics` 可被 Prometheus 抓取
- [ ] Sentry DSN 已配置（可选但强烈建议）
- [ ] 备份脚本已加入 cron（建议每日）
- [ ] 告警通道已验证（webhook/企业微信/钉钉）
- [ ] 首次恢复演练已完成

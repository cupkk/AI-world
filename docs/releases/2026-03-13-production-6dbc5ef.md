# 发布记录：2026-03-13 production promote

## 基本信息

- 发布名称：2026-03-13 production promote
- 发布时间：2026-03-13 19:04 CST
- 发布人：待补
- commit SHA：`6dbc5efeeae0eaa32a1107cc32615e7576e94133`
- image tag：`6dbc5efeeae0eaa32a1107cc32615e7576e94133`
- GitHub Actions 运行链接：
  - CI：https://github.com/cupkk/AI-world/actions/runs/23047465183
  - Deploy Staging：https://github.com/cupkk/AI-world/actions/runs/23047627689
  - Promote Production：https://github.com/cupkk/AI-world/actions/runs/23047961365

## Staging 自动验收

- [x] readiness / health
- [x] observability
- [x] prod-smoke（`5 passed`）
- [x] staging-mutation（`4 passed`）

## Staging 人工验收

- [x] 注册页邀请码展示与注册流程
- [x] learner 发布内容
- [x] learner 上传知识库
- [x] AI Assistant 返回真实结果
- [x] admin 审核队列可见新内容
- [x] 消息页可进入
- [x] 企业工作台可进入

## Production 验收

- [x] `/ready`
- [x] `/health`
- [x] production smoke（Promote Production workflow 通过）
- [x] 首页 / 登录页 / 邀请页 / 发布页 / 知识库页可访问

补充核验：

- `https://ai-world.asia/health` -> `200 OK`
- `https://ai-world.asia/ready` -> `200 OK`
- `https://ai-world.asia/` -> `200`
- `https://ai-world.asia/login?tab=register` -> `200`
- `https://ai-world.asia/invite` -> `200`
- `https://ai-world.asia/publish` -> `200`
- `https://ai-world.asia/settings/knowledge-base` -> `200`

## 回滚信息

- 上一个稳定 tag：待补
- 是否执行回滚：否
- 回滚时间：无
- 回滚后 smoke 结果：无

## 24 小时观测

| 时间 | 容器状态 | Prometheus targets | AI Assistant 503 | 关键 4xx/5xx | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-03-13 19:24 CST | 发布后健康 | `aiworld-production-api=up` `aiworld-staging-api=up` | 待观察 | 待观察 | `/ready`、`/health` 和关键页面 HTTP 200 |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

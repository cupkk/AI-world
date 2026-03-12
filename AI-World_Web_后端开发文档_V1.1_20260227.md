# AI-World Web 后端开发文档（V1.1）

日期：2026-02-27
适用：Web API + WebSocket（部署阿里云 ECS/ACK）

---

## 0. 关键约束（最终口径）

1. **全站必须登录**：除 `/auth/*` 外所有 API 需要鉴权；未登录用户无法访问任何业务接口。
2. **主页不放微信二维码**：移除二维码字段与上传逻辑；联系方式统一为「站内私信 + 邮箱」。
3. **站内私信**：支持一对一即时聊天 + 未读计数 + 消息幂等 + 反骚扰机制（消息请求/拉黑/举报）。
4. **审核流**：发布/需求/科研项目提交后进入审核队列；通过后才可在列表/知识枢纽中对其他用户可见。
5. **邀请制**：注册入口必须基于邀请码或管理员分配账号。
6. **角色枚举**：EXPERT / LEARNER / ENTERPRISE_LEADER / ADMIN。

---

## 1. 后端目标与边界（Web 端）

### 1.1 目标

为 Web 前端提供稳定 API：登录/邀请、角色权限、个人主页、人才库、知识枢纽、发布与审核流、知识库上传与检索、AI 推荐、站内私信。

支撑"强门槛"运营：邀请码/手动分配账号 + 人工审核身份 + 发布审核上墙。

### 1.2 明确不做（MVP）

- 不做复杂的推荐闭环（先做可解释的检索+排序；后续再上学习排序/在线反馈）。
- 不做群聊（MVP 只做一对一私信）。

---

## 2. 推荐技术架构（MVP 单体 + worker）

### 2.1 架构选型

MVP 推荐：单体 API + 异步任务（最省人力、最稳）

- API 服务：NestJS（Node）或 FastAPI（Python）任选
- WebSocket：Socket.IO（推荐，用于站内私信实时推送）
- DB：PostgreSQL（推荐）
- 对象存储：阿里云 OSS（头像、知识库文件）
- 向量库：pgvector（随 PostgreSQL）或 Milvus/ES 向量
- 异步任务：BullMQ（Redis）或 Celery（Redis）
- 缓存：Redis
- 搜索（可选）：Postgres FTS / Elasticsearch（后期再上）

知识库检索 + AI 推荐天然需要异步：文件解析、切片、Embedding、入库。

### 2.2 服务模块划分（单体内按模块组织）

- Auth & Invite（邀请/登录/会话）
- RBAC（角色权限）
- User/Profile（个人主页、标签、邮箱联系）
- Talent（人才库检索/筛选）
- Hub（知识枢纽内容：赛事/论文/政策/项目/工具）
- Publish & Review（发布与审核流）
- KnowledgeBase（知识库文件上传/解析/检索）
- Messaging（站内私信：一对一聊天 + 消息请求 + 反骚扰）
- Assistant（AI 推荐：人/项目）
- Admin（审核队列、内容管理、用户管理）

---

## 3. 核心业务规则（后端必须强约束）

### 3.1 角色与术语（写死）

EXPERT / LEARNER / ENTERPRISE_LEADER / ADMIN

### 3.2 邀请制与身份审核（写死）

- 注册入口必须基于邀请码或管理员分配账号。
- 用户资料可"提交审核"，管理员通过后才能进入完整功能。
- 未审核用户仅能浏览公共内容，不能发布、申请或使用私信。

### 3.3 全站登录（写死）

- 除 `/auth/*` 外所有 API 必须校验登录态。
- 未登录请求统一返回 401 并引导至登录页。

### 3.4 发布审核上墙（写死）

- 三类用户发布内容/项目需求/科研需求必须先进入审核，通过后才展示到知识枢纽。
- 状态机固定：`draft -> pending_review -> published | rejected`。

### 3.5 企业需求可见范围（写死）

- 企业发布项目化需求并可选择可见范围（至少两档：`public_all` / `experts_and_learners`）。
- 后端需要在查询层强制过滤：用户角色不满足则不可见（不仅仅前端隐藏）。

### 3.6 联系方式（写死）

- 用户可通过站内私信直接联系对方。
- 用户可在个人主页展示邮箱，其他用户可通过邮箱联系。
- AI 助手推荐时返回用户名片卡（含邮箱与"发送私信"入口），便于直接联系。
- 不存储微信二维码，不做微信相关功能。

---

## 4. 数据模型（数据库表设计）

下面是 MVP 最小闭环表（字段可按 PRD 扩展）。建议所有表带：`id(uuid) / created_at / updated_at / deleted_at`（软删）。

### 4.1 用户与权限

**users**
- id
- email（必填，用于登录与联系）
- password_hash（若走短信/第三方可为空）
- role（枚举：EXPERT / LEARNER / ENTERPRISE_LEADER / ADMIN）
- status：pending_identity_review | active | suspended
- last_login_at

**invites**
- id
- code（唯一）
- issued_by_admin_id（可空：系统生成）
- bound_user_id（使用后绑定）
- status：unused | used | revoked
- expires_at（可选）

**permissions**（可选，若用硬编码 RBAC 可不建表）
- code（例如 hub:write）
- description

**role_permissions**（可选）

### 4.2 个人主页与人才库

**profiles**
- user_id (pk/fk)
- display_name
- avatar_url
- headline（一句话简介）
- bio
- org / title / location
- contact_email（可与 users.email 分离，用于主页展示的联系邮箱）
- email_visibility（public / masked / hidden；MVP 先做 visible/hidden）
- public_tags（冗余：便于搜索）

**tags**
- id, name（唯一）

**profile_tags**
- profile_user_id
- tag_id

人才库"按标签分类筛选"：查询要支持 tags IN (...) + 关键词（姓名/机构/方向）。

### 4.3 知识枢纽（Hub）

**hub_items**
- id
- type：contest | paper | policy | project | tool
- title
- summary
- content_rich（markdown/html）
- cover_url
- tags（建议用关联表）
- author_user_id（用户发布）或 admin_user_id（管理员更新）
- review_status：draft / pending_review / published / rejected
- published_at

**hub_item_tags**
- hub_item_id, tag_id

### 4.4 企业战略与项目化需求

**enterprise_profiles**
- user_id（ENTERPRISE_LEADER）
- ai_strategy_text（企业 AI 战略展示）
- cases_text / achievements_text（可选）
- generated_by_ai（bool，可选；可通过 AI 辅助生成）

**enterprise_needs**
- id
- enterprise_user_id
- title
- background / goal / deliverables（建议）
- required_roles（json：需要科学家/工程师等）
- visibility：public_all | experts_and_learners（至少两档）
- review_status（同审核流）

### 4.5 科研项目（专家）

**research_projects**
- id
- expert_user_id
- title
- summary
- needed_support（需要的企业类型或技术人才需求）
- tags
- review_status（同审核流）

### 4.6 项目申请（对接参与）

**applications**
- id
- applicant_user_id
- target_type：enterprise_need | research_project | hub_project
- target_id
- message
- status：submitted | accepted | rejected
- created_at

后端需提供申请接口与企业/专家查看申请列表的接口。

### 4.7 站内私信（核心新增）

**conversations**
- id
- type（dm：一对一私信）
- last_message_at
- last_message_id

**conversation_members**
- conversation_id
- user_id
- last_read_message_id / last_read_at
- muted（是否静音）

**messages**
- id
- conversation_id
- sender_id
- body_text
- client_msg_id（客户端幂等 ID，防止重复发送）
- created_at

**message_requests**（强建议）
- from_user_id
- to_user_id
- conversation_id
- status：pending | accepted | rejected

> 设计说明：当用户 A 首次向用户 B 发消息时，不直接创建对话，而是先创建一条消息请求。B 可以选择接受（后续正常聊天）或拒绝。这样防止骚扰。

**user_blocks**
- blocker_id
- blocked_id

**reports**
- reporter_id
- target_type（user / message）
- target_id
- reason
- status（pending / resolved / dismissed）

### 4.8 知识库（上传 + 切片 + 向量）

**kb_files**
- id
- owner_user_id
- oss_key / file_url
- file_name
- mime_type
- size_bytes
- status：uploaded | parsing | embedded | ready | failed
- error_message

**kb_chunks**
- id
- kb_file_id
- owner_user_id
- chunk_index
- text
- embedding（向量类型：pgvector / 外部向量库引用）
- meta（页码、标题等）

**assistant_sessions**（可选）
- id, user_id, created_at

**assistant_messages**（可选）
- session_id
- role：user / assistant
- content

---

## 5. API 设计（Web 后端，REST + OpenAPI）

建议统一前缀：`/api/v1`；返回统一 envelope：

```json
{ "code": 0, "message": "ok", "data": {...} }
```

错误统一：HTTP 4xx/5xx + 业务 code。

### 5.1 Auth & Invite

- `POST /auth/invite/verify`：验证邀请码是否可用
- `POST /auth/register`：使用邀请码注册（创建用户 status=pending_identity_review）
- `POST /auth/login`：登录（cookie session）
- `POST /auth/logout`
- `GET /me`：当前用户信息（role/status）

> Web 端优先 cookie session：后端签发 HttpOnly; Secure; SameSite=Lax 的 session cookie，避免 token 被 XSS 拿走。

### 5.2 Profile & Talent

- `GET /users/:id`：用户基础信息
- `GET /profiles/:userId`：个人主页详情（含标签、联系邮箱）
- `PATCH /profiles/me`：更新我的主页（含 contact_email、email_visibility）
- `GET /talent`：人才库检索（q=关键词&tags=多选&role=角色筛选）

### 5.3 Hub（知识枢纽）

- `GET /hub`：列表（type=contest/paper/policy/project/tool）
- `GET /hub/:id`：详情
- `POST /hub`：创建（用户发布 -> draft）
- `POST /hub/:id/submit`：提交审核（-> pending_review）
- `PATCH /hub/:id`：草稿编辑
- `DELETE /hub/:id`：软删除

### 5.4 Enterprise（战略 + 需求）

- `GET /enterprise/me`：我的企业战略信息
- `PATCH /enterprise/me`：更新战略展示
- `POST /enterprise/needs`：创建项目化需求（draft，含 visibility）
- `POST /enterprise/needs/:id/submit`：提交审核
- `GET /enterprise/needs`：列表（服务端按 visibility + role 过滤）
- `GET /enterprise/needs/:id`：详情（同过滤）
- `GET /enterprise/needs/:id/applications`：查看申请列表

> "禁止招聘信息"：后端建议加一层 content_policy_check（关键词/正则/LLM classifier）作为风控辅助，最终仍以人工审核为准。

### 5.5 Expert（科研项目）

- `POST /expert/research-projects`：创建科研项目（draft）
- `POST /expert/research-projects/:id/submit`：提交审核
- `GET /expert/research-projects`：我的科研项目列表
- `GET /expert/research-projects/:id/applications`：申请列表（招募助手）

### 5.6 Applications（对接参与）

- `POST /applications`：提交申请（target_type + target_id + message）
- `GET /applications/mine`：我提交的申请
- `PATCH /applications/:id`：被申请方更新状态（accepted/rejected）

### 5.7 Messaging（站内私信 —— 核心新增）

**基础聊天：**
- `GET /messages/conversations`：我的对话列表（含未读计数、最后一条消息预览）
- `POST /messages/conversations`：创建/获取一对一对话（入参：peerUserId）
- `GET /messages/conversations/:cid/messages?cursor=&limit=`：消息历史（游标分页）
- `POST /messages/conversations/:cid/messages`：发送消息（入参含 clientMsgId 幂等）
- `POST /messages/conversations/:cid/read`：标记已读

**消息请求（防骚扰）：**
- `POST /messages/requests`：向陌生人发起聊天请求
- `GET /messages/requests`：我收到的待处理聊天请求
- `POST /messages/requests/:id/accept`：接受请求
- `POST /messages/requests/:id/reject`：拒绝请求

**安全与管控：**
- `POST /safety/block`：拉黑用户
- `DELETE /safety/block/:userId`：解除拉黑
- `POST /safety/report`：举报用户或消息

### 5.8 Knowledge Base

- `POST /kb/files/presign`：获取 OSS 直传签名（推荐直传）
- `POST /kb/files/complete`：通知上传完成（入库 kb_files，触发异步解析）
- `GET /kb/files`：我的文件列表
- `DELETE /kb/files/:id`

### 5.9 Assistant（AI 推荐）

- `POST /assistant/recommend`：输入 prompt，返回推荐名片/项目列表
  - 入参：`{ prompt, mode: "people"|"projects", filters? }`
  - 出参：`{ recommendations: [{type, id, reason, highlights}] }`

推荐实现（MVP 可落地）：
1. 取当前用户 profile + kb_chunks（检索 topK）
2. 生成 query embedding / 或关键词 query
3. 在人才库/项目库做相似度检索 + 标签/可见范围过滤
4. 返回结果 + reason（可解释：匹配了哪些标签/哪些知识库片段）

### 5.10 Admin（审核与运营）

- `GET /admin/review-queue`：待审核列表（hub_items/enterprise_needs/research_projects）
- `POST /admin/reviews/:id/approve`
- `POST /admin/reviews/:id/reject`（带 reason）
- `POST /admin/hub-items`：管理员直接创建上墙内容（管理员负责实时更新）
- `POST /admin/invites`：生成邀请码
- `PATCH /admin/users/:id/status`：管理用户状态（激活/封禁）

---

## 6. WebSocket（站内私信实时推送）

推荐使用 Socket.IO。

- namespace：`/ws`
- 鉴权：基于 session cookie（握手时验证）
- rooms：`conversation:{cid}`（用户加入自己参与的对话 room）
- events：
  - `message:send`（client -> server）
  - `message:ack`（server -> client，确认发送成功）
  - `message:new`（server -> 对话成员，实时推送新消息）
  - `conversation:update`（server -> 成员，对话元数据更新如未读数变化）
  - `typing:start` / `typing:stop`（可选，打字状态指示）

---

## 7. 异步任务与处理流程（必须有）

### 7.1 知识库文件处理流水线

1. 用户上传 pdf/word/ppt 到 OSS
2. kb_files.status = uploaded
3. Job：parse → chunk → embed → upsert vector store
4. 成功：ready；失败：failed + error_message

### 7.2 审核流

1. submit 时写入 review_status = pending_review
2. Admin approve：写 published，必要时同步到 hub（例如 enterprise_need 也可在 hub/project 类呈现）
3. Admin reject：写 rejected + reject_reason

---

## 8. 安全、合规与风控（Web 必做）

- **RBAC**：所有写接口与 admin 接口强校验 role。
- **全站鉴权**：除 `/auth/*` 外全部接口必须校验 session。
- **可见范围**：企业需求查询必须在 SQL 层过滤。
- **对象存储访问**：知识库文件用 OSS 私有桶 + CDN 鉴权。
- **审计日志**：关键操作（审核、封禁、可见范围变更）写入 audit_logs。
- **限流**：登录、发消息、assistant/recommend、上传 complete 接口加 rate limit（Redis）。
- **内容风控**：企业需求"禁止招聘信息"，后端做关键词/分类器辅助拦截。
- **邮箱反爬**：
  - 仅登录用户可见邮箱。
  - 默认脱敏返回（如 `z***@example.com`）；点击"查看完整邮箱"时调接口换取明文。
  - 查看/复制完整邮箱限频 + 审计记录。
- **消息安全**：
  - sender + client_msg_id 唯一约束（幂等）。
  - 消息请求机制防骚扰。
  - 拉黑后双向不可发消息。
  - 新建对话 / 发送频率限制。

---

## 9. 阿里云部署方案（两套，建议先 ECS 后 ACK）

### 9.1 MVP：ECS + Docker Compose（最快落地）

**资源**
- 1 台 ECS（2c4g 起步）
- RDS（PostgreSQL）
- Redis（云数据库 Tair 或自建）
- OSS（存文件）
- SLB（负载均衡，可选：后期扩容）
- 域名 + HTTPS（证书）

**运行容器**
- api：后端服务（含 WebSocket）
- worker：异步任务（解析/embedding）
- redis
- 可选 nginx：反代 + 静态资源

**环境变量（示例）**
- DATABASE_URL
- REDIS_URL
- OSS_BUCKET / OSS_ENDPOINT / OSS_ACCESS_KEY / OSS_SECRET
- SESSION_SECRET
- LLM_PROVIDER / LLM_API_KEY
- EMBEDDING_MODEL
- CORS_ORIGIN（Web 域名）

### 9.2 进阶：ACK（K8s）+ ACR + ARMS

- 镜像入 ACR
- ACK 部署 api/worker（HPA，WebSocket 需 sticky session）
- Ingress + WAF
- ARMS（APM/链路追踪）
- 日志：SLS

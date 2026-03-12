# AI-World Web 前端开发文档（V1.1）

日期：2026-02-27

---

## 0. 关键约束（最终口径）

1. **全站必须登录**：未登录用户无法访问任何页面，统一跳转至登录页。
2. **主页不放微信二维码**：联系方式统一为「站内私信 + 邮箱」。移除所有微信二维码相关组件与字段。
3. **站内私信**：前端需实现一对一聊天界面（WebSocket 实时推送 + 消息列表 + 未读计数）。
4. **审核流**：发布/需求/科研项目提交后进入审核；通过后才展示到知识枢纽。

---

## 1. 交付目标（Definition of Done）

前端交付一个可运行的 Web（含 mock 数据），满足：

- 公共界面统一（所有**登录**用户可见）：知识枢纽/广场（含赛事/论文/政策/项目/工具导航分类） + 人才库（按标签筛选）。
- 登录后按身份进入不同工作台：
  - LEARNER：学习/成长 + 项目机会 + 展示声誉（发文章/作品）
  - EXPERT：发布科研项目 + 找合作 + 招募助手
  - ENTERPRISE：展示AI战略 + 发布项目化需求（可见范围）
- 三类用户共用能力：
  - 个人主页（Bonjour 卡片风格）
  - 邮箱联系 + 站内私信
  - 个人知识库上传（pdf/word/ppt）
  - AI 助手基于资料+知识库推荐人/项目
- 内容/项目/需求发布后进入"待审核"，审核通过才展示到知识枢纽。

---

## 2. 技术栈与工程约束

### 推荐栈（默认）

- Next.js（App Router）+ React + TypeScript
- TailwindCSS + shadcn/ui（组件）
- TanStack Query（数据请求/缓存，mock 也能用）
- Zustand（轻量全局状态：用户、角色、布局）
- React Hook Form + Zod（表单与校验）
- Socket.IO Client（站内私信实时通信）
- 统一 mock：/src/mocks（开发阶段不依赖后端）

### 工程硬约束

- 所有页面必须有：Loading / Empty / Error 三态组件。
- 所有列表页必须支持：搜索 + 标签筛选。
- RBAC（角色权限）必须在前端路由与数据层都做一层保护（避免"只靠隐藏按钮"）。
- 发布内容必须带状态机：`draft -> pending_review -> published | rejected`。
- **全站登录保护**：所有页面组件必须在顶层 Layout 校验登录态，未登录一律跳转 `/auth/login`。

---

## 3. 角色模型与权限矩阵（RBAC）

角色枚举：EXPERT / LEARNER / ENTERPRISE_LEADER / ADMIN

### 3.1 权限原则

- 公共界面（知识枢纽/人才库）仅对已登录注册用户开放，**不允许未登录访问**。
- 企业"项目化需求"可设置可见范围（全员 / 仅科学家&技术人才等）—— 前端需要根据当前用户角色过滤展示。
- 企业发布内容禁止出现"招聘信息"（前端可做强提示+关键词校验，但最终以审核为准）。

### 3.2 权限矩阵（MVP）

**所有登录用户：**
- 浏览知识枢纽（含赛事/论文/政策/项目/工具导航）
- 浏览人才库 + 标签筛选
- 维护个人主页（Bonjour 卡片化）
- 设置联系邮箱
- 站内私信（一对一聊天）
- 上传个人知识库文件（pdf/word/ppt）
- AI 助手推荐人/项目（基于资料+知识库）
- 发布内容/需求进入审核流

**LEARNER 特有**：学习成长、项目参与、声誉展示
**EXPERT 特有**：发布科研项目、找合作、招募助手
**ENTERPRISE 特有**：展示AI战略、发布项目化需求（可见范围）
**ADMIN（建议 MVP）**：维护知识枢纽资源、审核发布（"管理员负责实时更新"是内容来源之一）

---

## 4. 信息架构（IA）与路由规划

### 4.1 全站两层结构

- 公共界面（所有**登录**用户可见）：知识枢纽/广场 + 人才库
- 身份工作台（登录后不同）：LEARNER / EXPERT / ENTERPRISE_LEADER 各自 Dashboard

### 4.2 路由清单（MVP）

**登录/引导**
- `/auth/login`
- `/auth/invite`（邀请码入口）
- `/onboarding`（选择身份+完善资料）

**公共区（统一 UI，需登录）**
- `/hub` 知识枢纽（Tab：赛事/论文/政策/项目/工具导航）
- `/hub/[type]` 分类列表页（type=contest|paper|policy|project|tool）
- `/hub/[type]/[id]` 详情页（统一详情模板）
- `/talent` 人才库（搜索 + 标签筛选）
- `/u/[id]` 个人主页（Bonjour 卡片化 + 邮箱联系 + 私信入口）

**工作台（按角色重定向）**
- `/app`（自动重定向到对应工作台）
- `/app/learner`（LEARNER 工作台）
- `/app/expert`（EXPERT 工作台）
- `/app/enterprise`（ENTERPRISE 工作台）

**通用个人中心（登录后）**
- `/settings/profile`（编辑主页：Bonjour 卡片化）
- `/settings/contacts`（联系邮箱设置与隐私选项）
- `/settings/knowledge-base`（知识库文件管理：pdf/word/ppt）
- `/messages`（站内私信：对话列表 + 聊天界面）
- `/assistant`（AI助手：输入 prompt -> 输出推荐名片卡）
- `/publish`（发布中心：文章/项目/科研需求/企业需求 -> 待审核）
- `/publish/[id]`（发布详情：状态、审核结果）

**管理后台**
- `/admin/review`（审核队列）
- `/admin/hub`（知识枢纽内容管理）

---

## 5. 统一布局与导航（公共一致 + 工作台分化）

### 5.1 Layout 组件分层

- **AuthLayout**：登录/注册/邀请码页面专用（无导航栏）
- **MainLayout**：顶部导航（知识枢纽 / 人才库 / 私信 / AI助手入口）+ 用户菜单；**包含全局登录校验**
- **AppLayout**：侧边栏（随角色变化）+ 主区
- **ProfileLayout**：个人主页展示（卡片化信息栅格）

### 5.2 导航规则

- 公共导航永远可见：知识枢纽、人才库、私信（公共广场 + 行业雷达）
- 工作台侧边栏按角色显示：
  - LEARNER：学习资源、项目机会、我的声誉（文章/作品）
  - EXPERT：科研项目、招募助手、合作对接
  - ENTERPRISE：AI战略、发布项目化需求、可见范围管理

---

## 6. 核心页面规格（给 AI 按页实现）

下面按"页面 -> 组件 -> 数据 -> 交互 -> 状态"写清楚，可逐页生成。

### 6.1 /hub 知识枢纽 / 广场

**目标**：公共内容聚合，覆盖赛事/论文/政策/项目/工具导航。

**页面结构**
- 顶部：分类 Tabs（5类）
- 左侧（可选）：筛选（标签、时间、来源：平台/企业/科学家）
- 主区：卡片列表（统一 ContentCard）
- 右侧（可选）：本周推荐/热门

**ContentCard 字段（建议）**
- title、summary、type、tags、author（可选）、publishedAt、cover
- CTA：查看详情

**状态**
- Loading：骨架屏
- Empty：提示"暂无内容，管理员会持续更新"
- Error：重试按钮

### 6.2 /talent 人才库

**目标**：展示全站用户，可按标签筛选。

**页面结构**
- 搜索框（姓名/机构/方向）
- 标签筛选器（多选）
- 人才列表（ProfileMiniCard）

**ProfileMiniCard（必须）**
- avatar、name、role、headline、topTags、所在地/机构（可选）
- CTA1：查看主页 /u/[id]
- CTA2：发送私信（跳转至 /messages 并打开对话）

### 6.3 /u/[id] 个人主页（Bonjour 卡片化）

**目标**：让别人快速理解你 + 方便联系。

**页面结构（建议 12 栅格）**
- 顶部 Hero：头像、姓名、身份、标签、简介
- 卡片区（Bonjour 风格"引导卡"）
  - 卡1：我在做什么（当前项目/课题/需求）
  - 卡2：我能提供什么（技能/资源）
  - 卡3：我在找什么（合作/助手/项目）
  - 卡4：联系方式（邮箱 + "发送私信"按钮）
- 动态区：文章/项目/科研课题/企业需求（按角色展示）

**联系方式交互**
- 点击"发送私信" → 跳转至 `/messages`，自动创建/打开与该用户的对话。
- 展示联系邮箱（根据隐私设置：完整显示 / 脱敏显示 / 隐藏）。

### 6.4 /messages 站内私信（核心新增）

**目标**：支持一对一即时聊天，替代微信二维码的联系方式。

**页面结构（经典双栏聊天布局）**
- 左栏：对话列表
  - 对方头像/昵称、最后一条消息预览、未读计数
  - 消息请求区（陌生人首次发来的请求，需接受/拒绝）
- 右栏：聊天区
  - 消息气泡（自己/对方区分）
  - 输入框 + 发送按钮
  - 对方信息栏（头像、名字、角色标签、"查看主页"按钮）

**关键交互**
- WebSocket 实时推送新消息（Socket.IO）
- 未读计数顶部导航栏实时更新（红点/数字 badge）
- 消息请求：陌生人首次联系时，接收方可选择"接受"或"拒绝"
- 拉黑/举报入口（对话设置中）

**MVP 策略**
- 前端先做 UI + mock：对话列表、聊天历史、发送消息
- 未来接后端：WebSocket + REST API

### 6.5 /assistant AI 助手

**目标**：基于个人资料 + 知识库，按提示词推荐人才/项目。

**页面结构**
- 左侧：历史会话/快捷指令（可选）
- 主区：对话流（UserPromptBubble / AssistantBubble）
- 推荐结果区：RecommendationCard（名片卡片形式，点击去主页/发私信）

**MVP 策略**
- 前端先做 UI + mock：提交 prompt -> 返回一组推荐卡片（静态/随机）
- 未来接后端：POST /api/assistant/recommend

### 6.6 /settings/knowledge-base 知识库管理

**目标**：上传 pdf/word/ppt 等文件。

**页面结构**
- 上传区：拖拽上传（限制类型 & 大小）
- 文件列表：文件名、类型、上传时间、状态（处理中/可用）
- 说明：知识库将用于 AI 推荐

### 6.7 /settings/contacts 联系方式设置

**目标**：设置主页展示的联系邮箱及隐私选项。

**页面结构**
- 联系邮箱输入（可与登录邮箱不同）
- 邮箱展示策略选择：完整展示 / 脱敏展示 / 仅站内私信
- 保存后在个人主页 /u/[id] 的"联系方式"卡片中生效

### 6.8 /publish 发布中心（审核流）

**目标**：三类用户发布内容/项目需求/科研需求需审核，通过后展示到知识枢纽。

**发布类型（MVP）**
- 通用内容：文章/资源（进入知识枢纽）
- 项目：企业/科学家/平台发布（进入知识枢纽的"项目"类）
- 科研项目（EXPERT）：发布科研课题/创新项目
- 企业项目化需求（ENTERPRISE）：发布项目化需求 + 可见范围（并对"招聘信息"强提示）

**状态机**
- Draft（草稿）
- Pending Review（待审核）
- Published（已发布，上墙到知识枢纽）
- Rejected（驳回：展示原因，支持再次提交）

---

## 7. 三类工作台（差异化界面）——页面规格 + 组件清单

### 7.1 LEARNER 工作台 /app/learner

依据：技术人才核心需求是学习成长 + 项目机会 + 展示声誉；并可基于知识库被 AI 推荐项目/人，还能上传个人知识库。

**页面模块（从上到下）**

**Quick Actions（快速操作）**
- 按钮：上传知识库、发布文章/项目、打开 AI 助手、完善主页
- 提示：AI 推荐依赖资料+知识库

**Learning（学习与成长）**
- 卡片：课程/公开课入口（先用链接集合实现；内容来源未来可扩）
- 卡片：学习路径（MVP 用静态列表）

**Opportunities（项目与机会）**
- 列表：企业项目、科学家课题、赛事（从知识枢纽"项目/赛事"聚合）
- 筛选：标签、难度、是否可申请（MVP 只做标签+搜索）
- CTA：申请加入（提交申请表单）

**Reputation（展示与声誉）**
- 列表：我发布的文章/项目（带审核状态：草稿/待审核/已发布/驳回）
- 指引：在知识枢纽发文积累"社交货币值"

**数据结构（MVP 前端类型）**
- ContentItem[]（文章/论文解读/行业见解…）
- ProjectItem[]（企业/科学家/平台发布的项目）
- Application[]（申请加入项目的记录）

### 7.2 EXPERT 工作台 /app/expert

依据：科学家发布科研课题/创新项目、找合作伙伴、招募项目助手，也可通过人才库或 AI 推荐找人。

**页面模块**

**Quick Actions**
- 发布科研项目（重点入口）
- 打开 AI 助手（推荐企业/工程师）
- 上传知识库（论文/报告/PPT）

**My Research Projects（我的科研项目）**
- 列表：科研课题/创新项目（状态 + 标签 + "需要的合作企业类型/技术人才"）
- CTA：查看申请者 / 查看联系方式（MVP：列表展示申请者卡片）

**Collaboration Feed（合作机会流）**
- 聚合：企业项目化需求（按可见范围过滤）
- CTA：去需求详情，发送私信联系

**Assistants（招募助手）**
- 列表：申请成为助手的 LEARNER
- CTA：查看主页 / 发送私信

### 7.3 ENTERPRISE 工作台 /app/enterprise

依据：企业要展示 AI 战略、发布项目化需求（不是招聘广告），并能设置需求可见范围。

**页面模块**

**AI Strategy Showcase（AI战略展示）**
- 表单/编辑器：业务场景、转型方向、已有案例
- 展示页：用于吸引科学家/工程师理解要做什么

**Post Needs（发布项目化需求）**
- 表单：需求标题、问题背景、目标、交付预期、所需角色（科学家/工程师）、时间周期
- 必填：可见范围（全员 / 仅科学家&技术人才）
- 强提示：禁止发招聘信息（前端做提示+关键词拦截：如"薪资/简历/入职/五险一金"等；但以审核为准）

**Inbound（对接申请/意向）**
- 列表：对需求感兴趣的人（卡片）
- CTA：查看对方主页 / 发送私信联系

### 7.4 ADMIN（可选但强建议 MVP）

依据：内容"管理员负责实时更新"，且发布需要平台审核。

- `/admin/review`：审核队列（文章/项目/科研需求/企业需求）
- `/admin/hub`：知识枢纽内容管理（创建/编辑/下架）

---

## 8. 设计系统（UI 统一规则）

### 8.1 核心视觉与布局

- 全站卡片化（呼应 Bonjour 引导卡片）
- 列表页统一：Header（标题+描述） → Filters（搜索/标签） → List（卡片）
- 详情页统一：Hero（标题/标签/作者/时间） → Body（内容） → Sidebar（相关推荐/联系入口）

### 8.2 必备通用组件（先做这些，再做页面）

- AppShell（MainLayout / AppLayout）
- AuthGuard（全局登录校验组件）
- PageHeader（标题+描述+操作按钮位）
- SearchBar
- TagFilter（多选）
- ContentCard（知识枢纽卡片）
- ProfileMiniCard（人才库卡片）
- StatusBadge（draft/pending/published/rejected）
- ContactCard（联系方式卡片：邮箱展示 + "发送私信"按钮）
- ChatWindow（私信聊天窗口组件）
- MessageBadge（未读消息计数 badge）
- EmptyState / ErrorState / LoadingSkeleton

---

## 9. 数据模型（前端 TypeScript Types）

下面字段中，凡未在文档里"写死"的，标注为建议字段。

```typescript
export type Role = "EXPERT" | "LEARNER" | "ENTERPRISE_LEADER" | "ADMIN";

export type ReviewStatus = "draft" | "pending_review" | "published" | "rejected";

export type HubType = "contest" | "paper" | "policy" | "project" | "tool";

export type Visibility = "public_all" | "experts_and_learners";

export type EmailVisibility = "public" | "masked" | "hidden";

export interface UserProfile {
  id: string;
  role: Role;
  name: string;
  avatarUrl?: string;
  headline?: string;        // 一句话介绍
  bio?: string;
  tags: string[];            // 人才库按标签筛选
  org?: string;
  location?: string;
  contactEmail?: string;     // 联系邮箱
  emailVisibility?: EmailVisibility; // 邮箱展示策略
}

export interface KnowledgeBaseFile {
  id: string;
  ownerId: string;
  fileName: string;
  fileType: "pdf" | "doc" | "ppt" | "other";
  sizeBytes: number;
  createdAt: string;
  status: "processing" | "ready" | "failed";
}

export interface ContentItem {
  id: string;
  type: HubType;
  title: string;
  summary?: string;
  tags: string[];
  coverUrl?: string;
  authorId?: string;
  publishedAt?: string;
  reviewStatus: ReviewStatus;
}

export interface EnterpriseNeed {
  id: string;
  enterpriseId: string;
  title: string;
  background?: string;
  goal?: string;
  requiredRoles?: Array<"EXPERT" | "LEARNER">;
  visibility: Visibility;
  reviewStatus: ReviewStatus;
}

export interface ResearchProject {
  id: string;
  expertId: string;
  title: string;
  summary?: string;
  need?: string;             // 需要的企业类型/人才需求
  tags: string[];
  reviewStatus: ReviewStatus;
}

export interface Application {
  id: string;
  targetType: "EnterpriseNeed" | "ResearchProject" | "Project";
  targetId: string;
  applicantId: string;
  message?: string;
  createdAt: string;
  status: "submitted" | "accepted" | "rejected";
}

// ========== 站内私信相关类型（新增） ==========

export interface Conversation {
  id: string;
  peerId: string;            // 对方用户 ID
  peerName: string;
  peerAvatarUrl?: string;
  peerRole?: Role;
  lastMessage?: string;      // 最后一条消息预览
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  bodyText: string;
  clientMsgId: string;       // 幂等 ID
  createdAt: string;
}

export interface MessageRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatarUrl?: string;
  conversationId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}
```

---

## 10. API 合约（MVP：前端 mock；后端接入时保持同接口）

建议以 REST + JSON，路径如下（先用 Next Route Handlers 或纯 mock service）：

### 10.1 公共内容

- `GET /api/hub?type=project&q=&tags=...`
- `GET /api/hub/:id`
- `GET /api/talent?q=&tags=...`（人才库按标签筛选）
- `GET /api/users/:id`

### 10.2 登录与身份（邀请制）

- `POST /api/auth/login`
- `POST /api/auth/invite/verify`（邀请码验证）
- `GET /api/me`（返回 role，决定进入哪个工作台）

### 10.3 知识库与 AI 助手

- `GET /api/knowledge-base`
- `POST /api/knowledge-base/upload`（pdf/word/ppt）
- `POST /api/assistant/recommend`（基于资料+知识库推荐人/项目）

#### 10.3.1 `POST /api/assistant/recommend`

用途：根据用户输入 + 最近会话 + 用户资料/知识库，返回助手回复与可选推荐对象。

请求体（JSON）：

```json
{
  "query": "帮我找 NLP 专家",
  "userId": "u2",
  "locale": "zh-CN",
  "history": [
    { "role": "user", "content": "我在做检索增强问答" },
    { "role": "assistant", "content": "明白，你更关注 RAG 与向量检索。" }
  ]
}
```

字段约束：

- `query`：必填，字符串，1-2000 字符
- `userId`：可选，字符串（建议传，便于后端做个性化）
- `locale`：可选，`zh-CN | en-US`，默认 `zh-CN`
- `history`：可选，最近会话数组（建议最多 6-10 条）
  - `role`：`user | assistant`
  - `content`：字符串

成功响应（200，JSON）：

```json
{
  "reply": "我推荐你优先联系 Alice Chen，她在 LLM 与检索方向经验较深。",
  "recommendedUserId": "u1",
  "recommendedContentId": "c1"
}
```

说明：

- `reply`：可选，助手文本回复
- `recommendedUserId`：可选，推荐用户 ID（前端可据此展示名片卡）
- `recommendedContentId`：可选，推荐内容 ID（前端可据此展示内容卡）
- 三者至少返回一个，推荐后端尽量返回 `reply`

错误响应：

- `400`：请求参数不合法（如 `query` 为空）
- `401`：未授权
- `429`：限流
- `500`：服务异常

#### 10.3.2 `POST /api/knowledge-base/upload`

用途：上传知识库文件，触发解析/切片/向量化流程。

请求格式：`multipart/form-data`

- 表单字段：`file`
- 支持类型：`pdf/doc/docx/ppt/pptx`
- 建议限制：单文件 `<= 50MB`

成功响应（200，JSON）：

```json
{
  "id": "kb_f_20260301_001",
  "name": "RAG-Notes.pdf",
  "size": 1048576,
  "type": "application/pdf",
  "status": "PROCESSING",
  "uploadedAt": "2026-03-01T08:00:00.000Z"
}
```

字段约束：

- `status`：`PROCESSING | READY | FAILED`
- `id`：文件主键（前端用于列表状态更新）

错误响应：

- `400`：文件类型/大小不合法
- `401`：未授权
- `413`：文件过大
- `500`：服务异常

#### 10.3.3 `GET /api/knowledge-base`

用途：获取当前用户知识库文件列表。

成功响应（200，JSON）：

```json
{
  "items": [
    {
      "id": "kb_f_20260301_001",
      "name": "RAG-Notes.pdf",
      "size": 1048576,
      "type": "application/pdf",
      "status": "READY",
      "uploadedAt": "2026-03-01T08:00:00.000Z"
    }
  ]
}
```

### 10.4 发布与审核流

- `POST /api/publish`（创建草稿）
- `POST /api/publish/:id/submit`（进入 pending_review；审核后进知识枢纽）
- `GET /api/publish/mine`
- `GET /api/admin/review`（管理员审核队列）
- `POST /api/admin/review/:id/approve`
- `POST /api/admin/review/:id/reject`

### 10.5 站内私信（新增）

- `GET /api/messages/conversations`（对话列表）
- `POST /api/messages/conversations`（创建/获取与某用户的对话）
- `GET /api/messages/conversations/:cid/messages?cursor=&limit=`（消息历史）
- `POST /api/messages/conversations/:cid/messages`（发送消息）
- `POST /api/messages/conversations/:cid/read`（标记已读）
- `GET /api/messages/requests`（消息请求列表）
- `POST /api/messages/requests/:id/accept`
- `POST /api/messages/requests/:id/reject`

### 10.6 WebSocket 事件（Socket.IO）

- namespace：`/ws`
- events：
  - `message:new`（server -> client，实时新消息）
  - `conversation:update`（server -> client，对话更新如未读数变化）

---

## 11. 前端目录结构

```
src/
  app/
    (auth)/
      auth/login/
      auth/invite/
      onboarding/
    (main)/                    # 需登录才能访问的主区域
      hub/
      talent/
      u/[id]/
      messages/                # 站内私信（新增）
    (app)/
      app/
        page.tsx               # 根据 role 重定向
        learner/
        expert/
        enterprise/
    (settings)/
      settings/profile/
      settings/contacts/       # 联系邮箱设置（替代微信二维码上传）
      settings/knowledge-base/
      assistant/
      publish/
    (admin)/admin/
      review/
      hub/
  components/
    shell/                     # AuthGuard, MainLayout, AppLayout
    cards/                     # ContentCard, ProfileMiniCard, ContactCard
    chat/                      # ChatWindow, MessageBubble, ConversationList
    forms/
    ui/                        # shadcn/ui
  lib/
    rbac/
    api/
    ws/                        # Socket.IO client 封装
    validators/
    utils/
  mocks/
    data/
    handlers/
  store/
    useAuthStore.ts
    useMessageStore.ts         # 私信状态管理（新增）
```

---

## 12. RBAC（前端强约束：路由 + 组件两层）

- **全局登录守卫**：在 `(main)` / `(app)` / `(settings)` 等 Layout 中校验 session，未登录跳转 `/auth/login`。
- **路由守卫**：进入 `/app/expert` 必须 role=EXPERT；企业同理；角色来自 `/api/me`。
- **组件守卫**：比如企业发布需求的"可见范围"字段必须存在；否则表单不允许提交。

建议实现：
- `withAuth(Page)`（登录守卫 HOC）
- `withRole(Page, allowedRoles)`（角色守卫 HOC）
- `useCan(permission)`（更细粒度时用）

---

## 13. 关键交互与状态机

### 13.1 发布审核状态机（强制）

- 草稿：可编辑、不可出现在知识枢纽
- 待审核：只读 + 展示"审核中"
- 已发布：出现在知识枢纽列表/详情
- 驳回：展示原因 + 允许修改后重新提交

### 13.2 企业需求可见范围过滤（强制）

实现规则（前端）：
- `public_all`：所有登录用户可见
- `experts_and_learners`：仅 EXPERT、LEARNER 可见；ENTERPRISE 看不到其他企业的该需求（避免互抄）

### 13.3 站内私信交互流（新增）

1. 用户 A 在人才库/个人主页/AI 推荐卡片中点击"发送私信"
2. 前端调用 `POST /api/messages/conversations` 创建或获取对话
3. 跳转至 `/messages` 聊天界面
4. 如果 A 与 B 此前未聊过，则 B 侧显示为"消息请求"，需 B 主动接受后方可正常对话
5. WebSocket 实时推送新消息与未读计数更新

---

## 14. 执行清单

下面是"一步一产物"的任务序列。

**Step 1 — 初始化工程**
- 创建 Next.js + TS + Tailwind
- 安装 shadcn/ui、Socket.IO Client
- 配置 eslint + prettier
- 验收：首页能跑，Tailwind 生效

**Step 2 — 基础 types + mock 数据**
- 建 `src/lib/types.ts`（Role/ContentItem/UserProfile/Conversation/Message…）
- 建 `src/mocks/data`（用户、内容、项目、需求、对话 mock）
- 验收：能在任意页面 import mock 并渲染

**Step 3 — Layouts 与导航 + AuthGuard**
- MainLayout：hub/talent/messages/assistant 入口；全局登录校验
- AppLayout：侧边栏随角色变化（learner/expert/enterprise）
- 验收：导航可切换，未登录自动跳转登录页

**Step 4 — Auth stub + RBAC**
- `/api/me` mock 返回不同 role（用 query 或 localStorage 切换）
- 路由守卫：`/app/*` 根据 role 拦截/重定向
- 验收：切换 role，访问无权限页面会跳走；未登录跳登录页

**Step 5 — 知识枢纽 /hub**
- Tabs：contest/paper/policy/project/tool
- 列表：ContentCard
- 三态：loading/empty/error
- 验收：筛选/搜索生效（mock）

**Step 6 — 人才库 /talent**
- 搜索 + 标签筛选（多选）
- ProfileMiniCard + 进主页 + 发私信按钮
- 验收：标签筛选正确过滤

**Step 7 — 个人主页 /u/[id]**
- Bonjour 卡片引导布局
- 联系方式卡片（邮箱 + 发送私信按钮）
- 验收：不同角色用户主页展示不同"我在找什么/我能提供什么"推荐卡

**Step 8 — 站内私信 /messages（新增）**
- 双栏布局：对话列表 + 聊天区
- 消息请求 UI（接受/拒绝）
- 未读 badge 显示在导航栏
- 验收：能发送 mock 消息、切换对话、未读计数更新

**Step 9 — 知识库 /settings/knowledge-base**
- 上传控件（pdf/doc/ppt）
- 文件列表 + 状态（processing/ready）
- 验收：能新增 mock 文件记录，列表刷新

**Step 10 — AI 助手 /assistant**
- 对话 UI（输入 prompt -> 返回推荐名片卡）
- 推荐卡 CTA：去主页 / 发送私信
- 验收：至少 3 条示例 prompt + 推荐结果 mock

**Step 11 — 发布中心 /publish**
- 支持：文章/项目/科研项目/企业需求（同页 Tab）
- 提交后进入 pending_review；列表显示状态机
- 企业需求：必须选择可见范围；显示"禁止招聘信息"提示
- 验收：能创建草稿、提交审核、看到状态变化（mock）

**Step 12 — 三类工作台**
- learner：学习/机会/声誉模块
- expert：科研项目/找合作/招募助手
- enterprise：AI战略展示/发布项目化需求
- 验收：不同 role 登录进入不同首页

**Step 13 — Admin 审核**
- 审核队列：approve/reject
- 审核通过后，内容出现在 /hub 对应分类
- 验收：审核动作会影响 hub 列表

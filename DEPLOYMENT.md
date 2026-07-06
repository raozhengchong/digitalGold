# Fashion Starter 生产环境部署指南

本文档说明如何将 **Fashion Starter**（Medusa 2 + Next.js Storefront）部署到服务器或云平台。

## 目录

- [架构概览](#架构概览)
- [Docker 一键部署（推荐）](#docker-一键部署推荐)
- [项目目录结构](#项目目录结构)
- [服务器推荐目录布局](#服务器推荐目录布局)
- [部署前准备](#部署前准备)
- [基础设施](#基础设施)
- [后端 Medusa 部署](#后端-medusa-部署)
- [前端 Storefront 部署](#前端-storefront-部署)
- [反向代理与 HTTPS](#反向代理与-https)
- [环境变量清单](#环境变量清单)
- [上线检查清单](#上线检查清单)
- [常见问题](#常见问题)

---

## 架构概览

本项目为 **Headless 电商** 架构：前后端分离，依赖多套基础服务。

```text
用户浏览器
    │
    ├─ HTTPS ──► Storefront (Next.js :8000)
    │              ├─ Server Actions / SSR → Medusa Store API
    │              └─ 搜索页直连 → MeiliSearch（只读）
    │
    ├─ HTTPS ──► Medusa API + Admin (:9000, /app)
    │              ├─ Postgres（主数据）
    │              ├─ Redis（事件 / 缓存 / 工作流 / 锁）
    │              ├─ S3 / MinIO（商品图片）
    │              ├─ MeiliSearch（索引写入）
    │              ├─ Stripe（支付）
    │              └─ Resend（邮件）
    │
    └─ 图片 URL ──► MinIO 或云对象存储
```

### 仓库结构（概览）

| 目录                        | 说明                                                     | 默认端口 |
| --------------------------- | -------------------------------------------------------- | -------- |
| `medusa/`                   | Medusa v2 后端 + Admin 扩展                              | 9000     |
| `storefront/`               | Next.js 15 商城前端                                      | 8000     |
| `medusa/docker-compose.yml` | 仅基础设施（Postgres、Redis、MinIO、MeiliSearch）        | 见下文   |
| `docker-compose.yml`        | **全栈**：基础设施 + Medusa + Storefront                 | 见下文   |

### 常见部署方案

| 方案               | 适用场景           | 说明                                                      |
| ------------------ | ------------------ | --------------------------------------------------------- |
| **Docker Compose** | 自建、快速上线     | 根目录 `docker compose up`，前后端 + 基础设施一键启动     |
| **单机 VPS**       | 自建、成本可控     | Docker 或 Nginx + Node 进程 + Docker 基础设施             |
| **前后端拆分**     | 需要 CDN、边缘渲染 | Storefront 部署到 Vercel；Medusa + DB 在 VPS/云主机       |

推荐域名划分：

- `https://shop.example.com` → Storefront
- `https://api.example.com` → Medusa（Store API + Admin `/app`）
- Postgres、Redis、MinIO、MeiliSearch：**仅内网访问**，勿暴露公网

---

## Docker 一键部署（推荐）

仓库提供 **前后端 Docker 镜像** 与根目录 **全栈 Compose**，可在单机上一键启动 Postgres、Redis、MinIO、MeiliSearch、Medusa、Storefront。

### 文件说明

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 全栈编排（基础设施 + `medusa` + `storefront` 服务） |
| `.env.docker.example` | Compose 环境变量模板（复制为根目录 `.env`） |
| `medusa/Dockerfile` | Medusa 多阶段构建；启动前自动执行 `db:migrate` |
| `medusa/docker-entrypoint.sh` | 容器入口：迁移 → `yarn start` |
| `storefront/Dockerfile` | Next.js standalone 多阶段构建 |
| `medusa/docker-compose.yml` | 仅基础设施（本地开发、不启动应用时使用） |

### 快速开始

```bash
# 1. 在仓库根目录准备环境变量
cp .env.docker.example .env
# 编辑 .env：至少填写 NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY、NEXT_PUBLIC_STRIPE_KEY 等

# 2. 构建并启动全栈
docker compose up -d --build

# 3. 查看日志
docker compose logs -f medusa storefront
```

也可以使用根目录 `Makefile` 的环境区分命令：

```bash
# 本地开发模式（HTTP 场景，Admin 登录更稳定）
make up-dev

# 生产模式（HTTPS 场景）
make up-prod

# 只启动后端 medusa
make up-dev-medusa
make up-prod-medusa
```

启动后默认地址：

| 服务 | 地址 |
|------|------|
| Storefront | http://localhost:8000 |
| Medusa API + Admin | http://localhost:9000（Admin：`/app`） |
| MinIO Console | http://localhost:9001 |
| MeiliSearch | http://localhost:7700 |

### 首次部署：数据与管理员

Medusa 容器启动时会自动执行数据库迁移。**`yarn seed` 不会创建 Admin 账号**，首次部署建议：

```bash
# 导入演示数据
docker compose run --rm medusa yarn seed

# 创建管理员（README 默认凭据）
docker compose run --rm medusa yarn medusa user -e "admin@medusa.local" -p "supersecret"
```

登录 Admin（http://localhost:9000/app）后，在 **Settings → Publishable API Keys** 复制 Publishable Key，写入根目录 `.env` 的 `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`，然后**重新构建** Storefront：

```bash
docker compose up -d --build storefront
```

后端单独部署步骤见 [`medusa/DOCKER.md`](medusa/DOCKER.md)。

> `NEXT_PUBLIC_*` 在 **镜像构建时** 打入前端 bundle，修改后必须 `docker compose build storefront`（或 `up --build`）。

### MeiliSearch API Key

```bash
curl -H "Authorization: Bearer yoursecretmasterkey" http://localhost:7700/keys
```

将 **Default Admin API Key** 写入 `.env` → `MEILISEARCH_API_KEY`；**Default Search API Key** 写入 `NEXT_PUBLIC_SEARCH_API_KEY`，然后重启 / 重建相关服务。

### 仅启动基础设施

与在 `medusa/` 目录执行 `docker compose up -d` 等效，适合本地用 `yarn dev` 开发：

```bash
docker compose up -d postgres redis minio createbuckets meilisearch
```

### Docker 内网与浏览器 URL

Compose 中服务通过 **Docker 网络服务名** 互连；浏览器访问需使用 **宿主机端口**：

| 变量 | 容器内（Medusa → 依赖） | 浏览器 / 前端构建 |
|------|-------------------------|-------------------|
| `DATABASE_URL` | `postgresql://...@postgres:5432/medusa` | — |
| `REDIS_URL` | `redis://redis:6379` | — |
| `S3_ENDPOINT` | `http://minio:9000` | — |
| `S3_FILE_URL` | — | `http://localhost:9090/medusa`（或生产 CDN 域名） |
| `MEILISEARCH_HOST` | `http://meilisearch:7700` | — |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | — | `http://localhost:9000` 或 `https://api.example.com` |
| `NEXT_PUBLIC_SEARCH_ENDPOINT` | — | `http://localhost:7700` 或反代域名 |

生产环境将 `BACKEND_URL`、`STOREFRONT_URL`、`NEXT_PUBLIC_*` 等改为 **HTTPS 公网域名**，并在 Nginx 反代到容器端口 `9000` / `8000`。

### 常用运维命令

```bash
# 停止
docker compose down

# 停止并删除数据卷（清空数据库 / MinIO / 索引）
docker compose down -v

# 仅重建某一服务
docker compose up -d --build medusa

# 进入 Medusa 容器执行脚本
docker compose exec medusa yarn medusa exec ./src/scripts/index-products.ts

# 查看服务状态
docker compose ps
```

### 生产环境建议

1. 使用 **Nginx / Caddy** 在宿主机做 HTTPS 反代（见 [反向代理与 HTTPS](#反向代理与-https)），容器端口仅绑定 `127.0.0.1` 时可改 compose 的 `ports` 为 `"127.0.0.1:9000:9000"`。
2. 将 `.env` 中的 `JWT_SECRET`、`COOKIE_SECRET`、`MEILISEARCH_MASTER_KEY` 等改为强随机值。
3. 对象存储生产环境推荐 **AWS S3**，在 `.env` 中配置 `S3_*` 并清空 / 调整 `S3_ENDPOINT`。
4. 使用外部托管 Postgres / Redis 时，可从 `docker-compose.yml` 中移除对应服务，并修改 `DATABASE_URL`、`REDIS_URL`。

### Docker 拓扑

```text
                    docker compose (宿主机)
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
 :8000 storefront        :9000 medusa              :5432 postgres
 (Next.js)               (Medusa API+Admin)        :6379 redis
    │                         │                    :9090 minio
    │                         ├────────────────────:7700 meilisearch
    └────────────────────────►│
                              │
                    Docker bridge network
```

---

## 项目目录结构

以下为 Git 仓库克隆后的目录说明，部署时需将 `medusa/` 与 `storefront/` 分别构建、分别启动进程。

### 根目录

```text
fashion-starter/
├── DEPLOYMENT.md          # 本部署文档
├── docker-compose.yml     # 全栈 Docker Compose（基础设施 + 前后端）
├── .env.docker.example    # Docker Compose 环境变量模板
├── system.md              # 架构说明
├── README.md              # 本地快速启动
├── LICENSE
├── media/                 # README 截图等资源（不参与运行时）
├── medusa/                # 后端（Medusa 2）
├── storefront/            # 前端（Next.js 15）
└── .github/workflows/     # CI（lint 等）
```

### 后端 `medusa/`

| 路径 | 说明 |
|------|------|
| `medusa-config.js` | Medusa 主配置：支付、S3、Redis、MeiliSearch、自定义模块 |
| `docker-compose.yml` | 基础设施：Postgres、Redis、MinIO、MeiliSearch |
| `Dockerfile` | 生产镜像（多阶段构建） |
| `docker-entrypoint.sh` | 容器入口：自动迁移 + 启动 |
| `DOCKER.md` | **后端 Docker 分步部署指南** |
| `.env` / `.env.template` | 后端环境变量（生产部署必配） |
| `package.json` | 脚本：`build`、`start`、`seed`、`db:migrate` |
| `instrumentation.js` | 可观测性（可选） |
| `src/modules/fashion/` | 自定义模块：材质 / 颜色数据模型与迁移 |
| `src/modules/meilisearch/` | 自定义搜索服务：索引同步 |
| `src/modules/resend/` | 邮件通知：React Email 模板 + Resend Provider |
| `src/api/` | 自定义 HTTP 路由（Admin / Store） |
| `src/api/middlewares.ts` | API 中间件（认证、查询校验等） |
| `src/admin/` | Medusa Admin UI 扩展（widgets、routes、hooks） |
| `src/subscribers/` | 事件订阅：索引同步、订单邮件、欢迎邮件等 |
| `src/workflows/` | 工作流：批量索引、欢迎事件 |
| `src/scripts/` | CLI 脚本：`seed.ts`、`index-products.ts` |
| `integration-tests/` | HTTP 集成测试 |
| `.medusa/` | **构建产物**（`yarn build` 后生成，勿提交 Git） |

**构建后关键产物：**

```text
medusa/
├── .medusa/server/        # 编译后的服务端代码
├── .medusa/admin/         # 编译后的 Admin 静态资源
└── node_modules/
```

### 前端 `storefront/`

| 路径 | 说明 |
|------|------|
| `package.json` | 脚本：`dev`、`build`、`start`（端口 8000） |
| `Dockerfile` | Next.js standalone 生产镜像 |
| `.env.local` / `.env.template` | 前端环境变量（`NEXT_PUBLIC_*` 在 build 时打入） |
| `next.config.js` | Next 配置：远程图片域名等 |
| `check-env-variables.js` | 构建时校验必填环境变量 |
| `src/middleware.ts` | 国家码路由中间件（`/` → `/us` 等） |
| `src/app/` | App Router 页面路由 |
| `src/app/[countryCode]/(main)/` | 商城主站：首页、商品、购物车、账户、搜索等 |
| `src/app/[countryCode]/(checkout)/` | 结账流程 |
| `src/lib/config.ts` | Medusa JS SDK 初始化 |
| `src/lib/data/` | Server Actions 数据层（调 Medusa Store API） |
| `src/lib/search-client.ts` | MeiliSearch 客户端 |
| `src/modules/` | 按业务拆分的 UI 模块（cart、checkout、products 等） |
| `src/components/` | 共享组件（Header、Footer、SearchField 等） |
| `public/` | 静态资源（本地图片等） |
| `e2e/` | Playwright E2E 测试（生产可不部署） |

**构建后关键产物：**

```text
storefront/
├── .next/                 # Next.js 构建输出（yarn build 后生成）
├── node_modules/
└── public/
```

### 基础设施数据卷（Docker Compose）

使用 `medusa/docker-compose.yml` 时，持久化数据默认落在 Docker 命名卷中：

| Docker Volume | 挂载内容 |
|---------------|----------|
| `medusa-postgres-data` | PostgreSQL 数据 |
| `medusa-minio-data` | MinIO 对象（商品图片） |
| `meili-data` | MeiliSearch 索引数据 |

---

## 服务器推荐目录布局

单机 VPS 部署时，推荐在服务器上按以下方式组织目录（路径可按团队规范调整）。

### 推荐文件系统结构

```text
/opt/fashion-starter/                    # 应用根目录（Git 克隆或发布包）
├── medusa/
│   ├── .env                             # 生产环境变量（勿提交 Git）
│   ├── medusa-config.js
│   ├── package.json
│   ├── yarn.lock
│   ├── src/                             # 源码
│   ├── .medusa/                         # yarn build 产物
│   └── node_modules/
│
├── storefront/
│   ├── .env.local                       # 生产环境变量（勿提交 Git）
│   ├── package.json
│   ├── yarn.lock
│   ├── src/
│   ├── public/
│   ├── .next/                           # yarn build 产物
│   └── node_modules/
│
└── infra/                               # 可选：将 compose 单独放一层
    └── docker-compose.yml               # 可从 medusa/ 复制或软链

/etc/nginx/
├── sites-available/
│   ├── shop.example.com.conf            # Storefront 反代 → :8000
│   └── api.example.com.conf             # Medusa 反代 → :9000
└── ssl/                                 # Let's Encrypt 或自有证书

/var/log/fashion-starter/                # 可选：应用日志
├── medusa.log
└── storefront.log

/var/lib/docker/volumes/                 # Docker 数据卷（compose 默认）
├── medusa_medusa-postgres-data/
├── medusa_medusa-minio-data/
└── medusa_meili-data/
```

### 进程与端口对应

| 服务 | 监听地址 | 对外域名（经 Nginx） |
|------|----------|----------------------|
| Storefront | `127.0.0.1:8000` | `https://shop.example.com` |
| Medusa API + Admin | `127.0.0.1:9000` | `https://api.example.com`（Admin：`/app`） |
| Postgres | `127.0.0.1:5432` | 仅内网 |
| Redis | `127.0.0.1:6379` | 仅内网 |
| MinIO API | `127.0.0.1:9090` | 建议内网；公网需另配 CDN/域名 |
| MinIO Console | `127.0.0.1:9001` | 仅内网或 VPN |
| MeiliSearch | `127.0.0.1:7700` | 建议内网；前端通过公网反代时需单独配置 |

### 部署时需要上传 / 保留的文件

**Medusa（`medusa/`）**

| 必须 | 可选（开发/测试） |
|------|-------------------|
| `src/`、`medusa-config.js`、`package.json`、`yarn.lock` | `integration-tests/` |
| `.env`（服务器单独创建） | `jest.config.js` |
| 构建后：`.medusa/`、`node_modules/` | `.vscode/` |

**Storefront（`storefront/`）**

| 必须 | 可选（开发/测试） |
|------|-------------------|
| `src/`、`public/`、`next.config.js`、`package.json`、`yarn.lock` | `e2e/` |
| `.env.local`（服务器单独创建） | `playwright.config.ts` |
| 构建后：`.next/`、`node_modules/` | `eslint.config.cjs` |

**不需要部署到生产机**

- `media/`（文档截图）
- `.git/`（若使用 CI 发布包而非裸 Git）
- 各目录下的 `*.md`（除运维文档外）
- `storefront/e2e/`、`medusa/integration-tests/`

### 典型发布流程（目录视角）

```bash
# 1. 拉代码到服务器
cd /opt/fashion-starter
git pull origin main

# 2. 基础设施（在 medusa 或 infra 目录）
cd medusa && docker compose up -d

# 3. 后端构建与迁移
cd /opt/fashion-starter/medusa
yarn install --frozen-lockfile
yarn build
yarn medusa db:migrate
# PM2: pm2 start "yarn start" --name medusa --cwd /opt/fashion-starter/medusa

# 4. 前端构建
cd /opt/fashion-starter/storefront
yarn install --frozen-lockfile
yarn build
# PM2: pm2 start "yarn start" --name storefront --cwd /opt/fashion-starter/storefront
```

### 前后端拆分部署时的目录

若 Storefront 部署在 **Vercel**，服务器上通常只需保留：

```text
/opt/fashion-starter/medusa/     # 仅后端 + .env
/opt/fashion-starter/infra/      # Docker compose（Postgres / Redis / MinIO / MeiliSearch）
/etc/nginx/api.example.com.conf  # 仅 Medusa 反代
```

Vercel 侧项目根目录设为 `storefront/`，环境变量在 Vercel 控制台配置，无需在 VPS 上保留 `storefront/` 目录。

---

## 部署前准备

### 软件要求

- **Node.js** ≥ 20
- **Yarn**：`medusa/` 使用 Yarn 4；`storefront/` 使用 Yarn 1
- **Docker & Docker Compose**（若使用 compose 启动基础设施）
- 可选：**Nginx / Caddy**（HTTPS 与反代）
- 第三方账号：**Stripe**、**Resend**（邮件）、对象存储（S3 或 MinIO）

### 构建命令速查

```bash
# 基础设施（在 medusa 目录）
cd medusa && docker compose up -d

# 后端
cd medusa
yarn install --frozen-lockfile
yarn build
yarn medusa db:migrate
NODE_ENV=production yarn start

# 前端
cd storefront
yarn install --frozen-lockfile
yarn build
yarn start
```

---

## 基础设施

`medusa/docker-compose.yml` 提供以下服务（**不含** Medusa / Next 应用本身）：

| 服务              | 端口                         | 用途                              |
| ----------------- | ---------------------------- | --------------------------------- |
| Postgres 16       | 5432                         | 业务数据库                        |
| Redis             | 6379                         | Event bus、缓存、工作流、分布式锁 |
| MinIO             | 9090（API）、9001（Console） | S3 兼容对象存储                   |
| MeiliSearch v1.12 | 7700                         | 商品搜索索引                      |

### 启动基础设施

```bash
cd medusa
cp .env.template .env
# 按生产环境修改 DATABASE_URL、REDIS_URL、MEILISEARCH_*、S3_* 等
docker compose up -d
```

### MinIO 默认凭据（仅本地 compose）

- Console：`http://localhost:9001`
- 用户名：`medusaminio`
- 密码：`medusaminio`
- Bucket：`medusa`（由 `createbuckets` 服务自动创建并设为 public）

### 生产环境建议

| 组件        | 本地   | 生产建议                                        |
| ----------- | ------ | ----------------------------------------------- |
| Postgres    | Docker | RDS、Cloud SQL 或自建 Postgres                  |
| Redis       | Docker | ElastiCache、云 Redis 或自建                    |
| 文件存储    | MinIO  | **AWS S3** 或其它兼容 S3 的服务                 |
| MeiliSearch | Docker | 独立容器或托管，使用强 `MEILISEARCH_MASTER_KEY` |

---

## 后端 Medusa 部署

### 步骤

```bash
cd medusa

# 1. 环境变量
cp .env.template .env
# 编辑 .env（见「环境变量清单」）

# 2. 安装与构建
yarn install --frozen-lockfile
yarn build

# 3. 数据库迁移
yarn medusa db:migrate

# 4. 首次部署可选：导入演示数据
yarn seed

# 5. 创建管理员（若未 seed）
yarn medusa user -e "admin@example.com" -p "your-strong-password"

# 6. 启动（生产）
NODE_ENV=production yarn start
```

建议使用 **PM2** 或 **systemd** 守护进程，监听 `9000`（或由 Nginx 反代到内网端口）。

### 部署后必做

1. 访问 `https://api.example.com/app` 登录 Admin。
2. 进入 **Settings → Publishable API Keys**，复制 Publishable Key，配置到 Storefront 的 `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`。
3. 配置 MeiliSearch API Key（见下文 [MeiliSearch](#meilisearch-配置)）。
4. 若使用 Stripe Webhook，在 Stripe Dashboard 配置回调 URL（参考 [Medusa Stripe 文档](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe)）。

### MeiliSearch 配置

使用 Master Key 获取 API Keys：

```bash
# 将 yoursecretmasterkey 替换为 MEILISEARCH_MASTER_KEY
curl -H "Authorization: Bearer yoursecretmasterkey" http://localhost:7700/keys
```

| Key 类型                   | 配置位置                                               | 用途                |
| -------------------------- | ------------------------------------------------------ | ------------------- |
| **Default Admin API Key**  | `medusa/.env` → `MEILISEARCH_API_KEY`                  | 后端写入 / 更新索引 |
| **Default Search API Key** | `storefront/.env.local` → `NEXT_PUBLIC_SEARCH_API_KEY` | 前端只读搜索        |

> 切勿将 Admin Key 暴露在前端环境变量中。

商品变更会通过 `src/subscribers/index-products.ts` 自动同步索引。全量重建可调用 Admin API `POST /admin/custom/index-products`，或执行：

```bash
yarn medusa exec ./src/scripts/index-products.ts
```

---

## 前端 Storefront 部署

### 步骤

```bash
cd storefront

# 1. 环境变量
cp .env.template .env.local
# 编辑 .env.local（见「环境变量清单」）
# 注意：所有 NEXT_PUBLIC_* 在 yarn build 时打入客户端，构建前必须设对

# 2. 安装与构建
yarn install --frozen-lockfile
yarn build

# 3. 启动（生产）
yarn start
# 默认端口 8000，见 package.json "start": "next start -p 8000"
```

`check-env-variables.js` 在 **build 时** 校验以下变量，缺失会导致构建失败：

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_DEFAULT_REGION`
- `NEXT_PUBLIC_STRIPE_KEY`

### Vercel 部署要点

1. 项目根目录选择 **`storefront/`**。
2. 构建命令：`yarn build`；框架预设：Next.js。
3. 在 **Environment Variables** 中配置全部 `NEXT_PUBLIC_*` 及 `REVALIDATE_SECRET`。
4. `NEXT_PUBLIC_MEDUSA_BACKEND_URL` 必须为公网可访问的 Medusa API 地址。
5. 国家路由：在 Vercel 上会读取 `x-vercel-ip-country`；否则使用 `NEXT_PUBLIC_DEFAULT_REGION`。

### Next.js 图片域名

商品图片来自 S3/MinIO 时，需在 `storefront/next.config.js` 的 `images.remotePatterns` 中加入生产环境的 **https** 主机名。当前默认仅包含：

- `localhost`
- `fashion-starter-demo.s3.eu-central-1.amazonaws.com`

生产使用自有 bucket 时务必追加，否则 `next/image` 会报错或显示破图。

示例：

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "your-bucket.s3.eu-central-1.amazonaws.com" },
    // 若使用 MinIO 公网域名
    { protocol: "https", hostname: "cdn.example.com" },
  ],
},
```

---

## 反向代理与 HTTPS

对外服务应统一使用 **HTTPS**。以下为 Nginx 配置思路（需自行配置 SSL 证书，如 Let's Encrypt）。

```nginx
# Storefront
server {
    listen 443 ssl;
    server_name shop.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Medusa API + Admin
server {
    listen 443 ssl;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

环境变量中的 URL 必须与对外域名一致：

- `BACKEND_URL`、`ADMIN_CORS`、`AUTH_CORS` → `https://api.example.com`
- `STOREFRONT_URL`、`STORE_CORS` → `https://shop.example.com`
- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` → `https://api.example.com`
- `NEXT_PUBLIC_BASE_URL` → `https://shop.example.com`

---

## 环境变量清单

### 后端 `medusa/.env`

```env
# 对外 URL（必须与 HTTPS 域名一致）
BACKEND_URL=https://api.example.com
STOREFRONT_URL=https://shop.example.com
STORE_CORS=https://shop.example.com
ADMIN_CORS=https://api.example.com
AUTH_CORS=https://api.example.com

# 数据库与缓存
DATABASE_URL=postgresql://user:password@db-host:5432/medusa
REDIS_URL=redis://redis-host:6379

# 安全（生产环境请使用强随机字符串）
JWT_SECRET=<random-long-string>
COOKIE_SECRET=<random-long-string>

# Stripe
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# 对象存储 — 生产推荐使用 AWS S3
S3_FILE_URL=https://your-bucket.s3.region.amazonaws.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=eu-central-1
S3_BUCKET=your-bucket
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false

# 本地 MinIO 示例（仅开发 / 自建）
# S3_FILE_URL=http://localhost:9090/medusa
# S3_ENDPOINT=http://localhost:9090
# S3_FORCE_PATH_STYLE=true

# 邮件（Resend）
RESEND_API_KEY=re_...
RESEND_FROM="Your Shop <noreply@your.com>"

# MeiliSearch
MEILISEARCH_MASTER_KEY=<strong-master-key>
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=<admin-api-key>
```

### 前端 `storefront/.env.local`

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_BASE_URL=https://shop.example.com
NEXT_PUBLIC_DEFAULT_REGION=us

NEXT_PUBLIC_STRIPE_KEY=pk_live_...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=

NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true
NEXT_PUBLIC_SEARCH_ENDPOINT=https://search.example.com
NEXT_PUBLIC_SEARCH_API_KEY=<search-only-api-key>

REVALIDATE_SECRET=<random-long-string>
NEXT_PUBLIC_ENABLE_WEBMCP=
```

---

## 上线检查清单

| #   | 检查项            | 说明                                                           |
| --- | ----------------- | -------------------------------------------------------------- |
| 1   | 基础设施可达      | Postgres、Redis、S3、MeiliSearch 连通（`docker compose ps`）   |
| 2   | Medusa 构建与迁移 | 镜像构建成功；容器日志中 `db:migrate` 无报错                   |
| 3   | Medusa 进程常驻   | `docker compose ps` 中 `medusa` 为 running                     |
| 4   | Admin 可访问      | `https://api.example.com/app` 可登录                           |
| 5   | Publishable Key   | 已写入 Storefront 环境变量                                     |
| 6   | CORS              | `STORE_CORS` 包含商城域名                                      |
| 7   | Storefront 构建   | `docker compose build storefront` 通过且 `NEXT_PUBLIC_*` 齐全    |
| 8   | 图片加载          | 浏览器可打开图片 URL；`next.config.js` 已配置 `remotePatterns` |
| 9   | 搜索              | MeiliSearch 索引存在；前端搜索有结果                           |
| 10  | 支付              | Stripe 生产密钥与 Webhook（若启用）                            |
| 11  | 邮件              | Resend API Key 有效，下单 / 注册邮件可发送                     |
| 12  | HTTPS             | 全站 HTTPS，无混合内容警告                                     |

---

## 常见问题

### 1. 图片请求 200 但页面显示破图

MinIO/S3 中的文件可能在上传时被错误编码（例如 seed 脚本使用 `toString('binary')` 而非 base64）。合法 PNG 文件头应为 `89 50 4E 47`，若出现 `c2 89 50 4e 47` 则说明内容已损坏。需修复上传逻辑后**重新 seed 或重新上传**图片。

### 2. `NEXT_PUBLIC_*` 修改后不生效

`NEXT_PUBLIC_*` 在 **`yarn build` 时** 打入客户端 bundle。修改后必须重新执行 `yarn build` 并重启 Storefront。

### 3. 浏览器报 CORS 错误

检查 `medusa/.env` 中 `STORE_CORS`、`ADMIN_CORS`、`AUTH_CORS` 是否包含实际访问的前端 / Admin 域名（含 `https://`，无尾部斜杠）。

### 4. Next.js 报 “isn't a valid image”

- 确认图片 URL 返回的 `Content-Type` 正确且内容为合法图片。
- 在 `next.config.js` 中添加图片主机名。
- 开发环境下 MinIO 未就绪时，Next 图片优化可能短暂失败，可刷新或重启 dev server。

### 5. 搜索无结果

- 确认 `MEILISEARCH_API_KEY`（后端）与 `NEXT_PUBLIC_SEARCH_API_KEY`（前端）配置正确。
- 执行全量索引：`yarn medusa exec ./src/scripts/index-products.ts`。
- 确认 `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true`。

### 6. Medusa 与 Storefront 使用不同 Yarn 版本

分别在 `medusa/` 与 `storefront/` 目录内执行 `yarn install`，不要混用 lockfile。

---

## 相关文档

- 项目架构说明：[`system.md`](./system.md)
- 本地快速启动：[`README.md`](./README.md)
- 服务器 Docker 生产部署（前后端）：[`DEPLOYMENT_SERVER_DOCKER.md`](./DEPLOYMENT_SERVER_DOCKER.md)
- Medusa 官方部署文档：[Medusa Deployment](https://docs.medusajs.com/learn/deployment)
- Next.js 生产部署：[Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)

---

## 附录：推荐生产拓扑图

```text
                         Internet
                             │
                    [ Nginx / Caddy ]
                    SSL + 反向代理
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
  shop.example.com    api.example.com      (内网)
         │                   │                   │
    Next.js :8000      Medusa :9000      MeiliSearch :7700
         │                   │                   │
         │             ┌─────┴─────┐             │
         │             │           │             │
         └────────────►│ Postgres  │◄────────────┘
                       │ Redis     │
                       │ S3/MinIO  │
                       └───────────┘
```

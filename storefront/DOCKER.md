# Storefront 前端 Docker 部署指南

本文档只讲 **Next.js 商城前端（`storefront/`）** 的 Docker 部署，按步骤操作即可。

> **前提**：Medusa 后端已可访问（本地 `http://localhost:9000` 或生产 `https://api.example.com`），且已在 Admin 中创建 **Publishable API Key**。

---

## 目录

1. [部署前准备](#1-部署前准备)
2. [方式 A：Compose 启动（推荐）](#2-方式-acompose-启动推荐)
3. [方式 B：单独构建镜像](#3-方式-b单独构建镜像)
4. [验证是否成功](#4-验证是否成功)
5. [修改配置后如何更新](#5-修改配置后如何更新)
6. [生产环境注意点](#6-生产环境注意点)
7. [常见问题](#7-常见问题)

---

## 1. 部署前准备

### 1.1 安装软件

| 软件 | 版本要求 |
|------|----------|
| Docker | 20.10+ |
| Docker Compose | v2（`docker compose` 命令） |

确认 Docker 已启动：

```bash
docker info
```

### 1.2 确认 Medusa 后端可用

前端依赖 Medusa Store API，请先保证后端已运行并可访问：

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/health
# 期望返回 200（若后端在其他地址，替换 URL）
```

### 1.3 获取 Publishable API Key

1. 打开 Medusa Admin：`http://localhost:9000/app`（或你的生产 Admin 地址）
2. 进入 **Settings → Publishable API Keys**
3. 复制 Key（形如 `pk_...`），后面写入环境变量

### 1.4 理解两类环境变量

| 类型 | 变量前缀 | 何时生效 | 修改后需要 |
|------|----------|----------|------------|
| **构建时** | `NEXT_PUBLIC_*` | `docker build` / `yarn build` 时打入客户端 bundle | **重新构建镜像** |
| **运行时** | `REVALIDATE_SECRET` 等 | 容器启动时读取 | **重启容器**即可 |

构建时**必填**（缺失会导致 `yarn build` 失败）：

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_DEFAULT_REGION`
- `NEXT_PUBLIC_STRIPE_KEY`

---

## 2. 方式 A：Compose 启动（推荐）

适用于：仓库根目录已有 `docker-compose.yml`，与 Medusa、基础设施一起编排。

### 步骤 1：进入仓库根目录

```bash
cd /path/to/fashion-starter
```

### 步骤 2：创建环境变量文件

```bash
cp .env.docker.example .env
```

### 步骤 3：编辑 `.env` 中的前端相关项

至少填写以下内容（本地 Docker 示例）：

```env
# 浏览器访问 Medusa API 的地址（不是容器内网地址）
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000

# Admin 中复制的 Publishable Key
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxx

# 浏览器访问商城的地址
NEXT_PUBLIC_BASE_URL=http://localhost:8000

NEXT_PUBLIC_DEFAULT_REGION=us

# Stripe 公钥（测试环境可用 pk_test_...）
NEXT_PUBLIC_STRIPE_KEY=pk_test_xxxxxxxx

# 搜索（可选，不用搜索可设 false）
NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true
NEXT_PUBLIC_SEARCH_ENDPOINT=http://localhost:7700
NEXT_PUBLIC_SEARCH_API_KEY=your-search-only-key

# 运行时变量（不需重建镜像）
REVALIDATE_SECRET=请改为随机长字符串
```

> **注意**：`NEXT_PUBLIC_*` 必须是**用户浏览器能访问到的 URL**，不要用 Docker 内网服务名（如 `http://medusa:9000`）。

### 步骤 4：构建并启动前端服务

**若 Medusa 已在 Compose 中一起跑：**

```bash
docker compose up -d --build storefront
```

**若全栈首次启动（基础设施 + 后端 + 前端）：**

```bash
docker compose up -d --build
```

### 步骤 5：查看启动日志

```bash
docker compose logs -f storefront
```

正常应看到 Next.js 监听 `0.0.0.0:8000`，无报错退出。

### 步骤 6：访问商城

浏览器打开：**http://localhost:8000**

---

## 3. 方式 B：单独构建镜像

适用于：Medusa 不在同一 Compose 中，或只想部署前端容器。

### 步骤 1：进入 storefront 目录

```bash
cd /path/to/fashion-starter/storefront
```

### 步骤 2：构建镜像（传入构建参数）

```bash
docker build \
  --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000 \
  --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_xxxxxxxx \
  --build-arg NEXT_PUBLIC_BASE_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_DEFAULT_REGION=us \
  --build-arg NEXT_PUBLIC_STRIPE_KEY=pk_test_xxxxxxxx \
  --build-arg NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true \
  --build-arg NEXT_PUBLIC_SEARCH_ENDPOINT=http://localhost:7700 \
  --build-arg NEXT_PUBLIC_SEARCH_API_KEY= \
  -t fashion-starter-storefront:latest \
  .
```

构建过程约 3～10 分钟（视网络与机器而定），成功结束无 `exit code: 1`。

### 步骤 3：启动容器

```bash
docker run -d \
  --name storefront \
  -p 8000:8000 \
  -e REVALIDATE_SECRET=your-random-secret \
  --restart unless-stopped \
  fashion-starter-storefront:latest
```

### 步骤 4：查看日志

```bash
docker logs -f storefront
```

### 步骤 5：访问商城

浏览器打开：**http://localhost:8000**

---

## 4. 验证是否成功

按顺序检查：

| # | 检查项 | 命令 / 操作 | 期望结果 |
|---|--------|-------------|----------|
| 1 | 容器在运行 | `docker compose ps storefront` 或 `docker ps` | Status 为 `running` |
| 2 | 端口监听 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000` | `200` 或 `307`（地区重定向） |
| 3 | 首页可打开 | 浏览器访问 `http://localhost:8000` | 跳转到 `/us` 等并显示商城 |
| 4 | API 连通 | 浏览器 DevTools → Network，刷新页面 | 对 Medusa 的请求无 CORS 错误 |
| 5 | 商品图 | 打开商品详情页 | 图片正常（需 `next.config.js` 配置图片域名） |

---

## 5. 修改配置后如何更新

### 改了 `NEXT_PUBLIC_*`（构建时变量）

必须重新构建并启动：

```bash
# Compose 方式（在仓库根目录）
docker compose up -d --build storefront

# 单独镜像方式
docker build ... -t fashion-starter-storefront:latest .
docker stop storefront && docker rm storefront
docker run -d ... fashion-starter-storefront:latest
```

### 只改了 `REVALIDATE_SECRET`（运行时变量）

重启即可，无需重建：

```bash
docker compose up -d storefront
# 或
docker restart storefront
```

---

## 6. 生产环境注意点

### 6.1 URL 全部改为 HTTPS 公网域名

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_BASE_URL=https://shop.example.com
NEXT_PUBLIC_SEARCH_ENDPOINT=https://search.example.com
```

同时确保 Medusa 的 `STORE_CORS` 包含 `https://shop.example.com`。

### 6.2 图片域名

商品图来自 S3/MinIO 时，在 `next.config.js` 的 `images.remotePatterns` 中加入生产 bucket 主机名，修改后需**重新构建镜像**。

### 6.3 反向代理

生产建议在宿主机用 Nginx/Caddy 做 HTTPS，反代到容器 `127.0.0.1:8000`：

```nginx
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
```

### 6.4 端口仅绑定本机（可选）

在 `docker-compose.yml` 中将：

```yaml
ports:
  - "8000:8000"
```

改为：

```yaml
ports:
  - "127.0.0.1:8000:8000"
```

避免 8000 端口直接暴露公网。

---

## 7. 常见问题

### 构建失败：Missing required environment variables

**原因**：`NEXT_PUBLIC_*` 未传入构建阶段。

**解决**：检查根目录 `.env` 或 `docker build --build-arg` 是否包含全部必填项（见 [1.4](#14-理解两类环境变量)）。

---

### 页面打开但接口报 CORS 错误

**原因**：Medusa 的 `STORE_CORS` 未包含前端域名。

**解决**：在 Medusa 环境变量中设置：

```env
STORE_CORS=https://shop.example.com
```

本地 Docker：

```env
STORE_CORS=http://localhost:8000
```

修改后重启 Medusa 容器。

---

### 改了环境变量但页面没变化

**原因**：`NEXT_PUBLIC_*` 在构建时已固化进 bundle。

**解决**：执行 `docker compose up -d --build storefront` 重新构建。

---

### 商品图片显示破图

**原因**：`next.config.js` 未允许图片主机名，或 MinIO/S3 URL 不可达。

**解决**：

1. 在 `images.remotePatterns` 添加图片域名
2. 确认 `S3_FILE_URL` 是浏览器可访问的地址
3. 重新构建前端镜像

---

### 搜索无结果

1. 确认 `NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true`
2. 确认 `NEXT_PUBLIC_SEARCH_API_KEY` 为 MeiliSearch **Search API Key**（不是 Admin Key）
3. 确认 Medusa 已完成商品索引

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `storefront/Dockerfile` | 多阶段构建：deps → build → standalone 运行 |
| `storefront/.dockerignore` | 构建上下文排除项 |
| `storefront/next.config.js` | 含 `output: "standalone"` |
| `storefront/check-env-variables.js` | 构建时校验必填环境变量 |
| 根目录 `docker-compose.yml` | `storefront` 服务定义 |
| 根目录 `.env.docker.example` | Compose 环境变量模板 |

完整全栈部署见根目录 [`DEPLOYMENT.md`](../DEPLOYMENT.md)。

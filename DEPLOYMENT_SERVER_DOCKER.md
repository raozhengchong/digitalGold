# Fashion Starter 服务器 Docker 部署手册（前后端）

本文档面向**服务器生产部署**，覆盖 `medusa` 后端、`storefront` 前端、基础设施（Postgres/Redis/MinIO/MeiliSearch）、Nginx 反向代理与 HTTPS。

---

## 1. 目标架构

- `https://api.example.com` -> Medusa (`localhost:9000`)
- `https://shop.example.com` -> Storefront (`localhost:8000`)
- Postgres/Redis/MinIO/MeiliSearch 仅内网或本机访问

---

## 2. 服务器准备

## 2.1 基础软件

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release git nginx
```

安装 Docker 与 Compose（按官方文档），完成后验证：

```bash
docker --version
docker compose version
```

## 2.2 防火墙建议

- 放行 `80`、`443`（公网）
- 不放行 `5432`、`6379`、`7700`、`9001`、`9090`（仅内网）

---

## 3. 代码与目录

```bash
sudo mkdir -p /opt/fashion-starter
sudo chown -R $USER:$USER /opt/fashion-starter
cd /opt/fashion-starter
git clone <你的仓库地址> .
```

---

## 4. 生产环境变量

在项目根目录：

```bash
cp .env.docker.example .env
```

编辑 `.env`，至少修改以下关键项（示例）：

```env
# 关键：服务器生产模式
MEDUSA_NODE_ENV=production
MEDUSA_PORT=9000

# 对外域名（必须是 HTTPS 域名）
BACKEND_URL=https://api.example.com
STOREFRONT_URL=https://shop.example.com
STORE_CORS=https://shop.example.com
ADMIN_CORS=https://api.example.com
AUTH_CORS=https://api.example.com

# 安全密钥（必须改成随机长字符串）
JWT_SECRET=<random-long-secret>
COOKIE_SECRET=<random-long-secret>
REVALIDATE_SECRET=<random-long-secret>

# 前端 build 时注入
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.com
NEXT_PUBLIC_BASE_URL=https://shop.example.com
NEXT_PUBLIC_DEFAULT_REGION=us
NEXT_PUBLIC_STRIPE_KEY=pk_live_or_test_...
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...

# 搜索（若启用）
NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=true
NEXT_PUBLIC_SEARCH_ENDPOINT=https://search.example.com
NEXT_PUBLIC_SEARCH_API_KEY=<search-key>

# Medusa 搜索写入
MEILISEARCH_MASTER_KEY=<strong-master-key>
MEILISEARCH_API_KEY=<admin-key>
```

> 说明：`NEXT_PUBLIC_*` 在前端构建时写入 bundle，修改后要重建 `storefront` 镜像。

---

## 5. 启动服务（生产）

根目录执行：

```bash
make up-prod
```

等价命令：

```bash
MEDUSA_NODE_ENV=production docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f medusa storefront
```

---

## 6. 首次初始化

## 6.1 导入演示数据（可选）

```bash
docker compose run --rm medusa yarn seed
```

## 6.2 创建管理员

```bash
docker compose run --rm medusa yarn medusa user -e "admin@medusa.local" -p "supersecret"
```

访问 `https://api.example.com/app` 登录后台。

## 6.3 获取 Publishable Key 给前端

在 Admin -> Settings -> Publishable API Keys 复制 `pk_...`，填到 `.env` 的：

- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

然后重建前端：

```bash
docker compose up -d --build storefront
```

---

## 7. Nginx 反向代理

创建 `/etc/nginx/sites-available/fashion-starter.conf`：

```nginx
server {
    listen 80;
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

server {
    listen 80;
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

启用配置：

```bash
sudo ln -sf /etc/nginx/sites-available/fashion-starter.conf /etc/nginx/sites-enabled/fashion-starter.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com -d shop.example.com
```

完成后自动续期检查：

```bash
sudo certbot renew --dry-run
```

---

## 9. 上线后验证

```bash
curl -I https://api.example.com/health
curl -I https://shop.example.com
```

检查项：

- `https://api.example.com/app` 可登录
- 后台改商品后前端可见（若未立即可见，先重建 storefront）
- 图片加载正常（S3/MinIO 域名允许）
- 下单/支付流程（Stripe）可用

---

## 10. 更新发布流程

```bash
cd /opt/fashion-starter
git pull

# 后端有改动
docker compose up -d --build medusa

# 前端有改动或 NEXT_PUBLIC_* 变更
docker compose up -d --build storefront
```

全栈更新：

```bash
make up-prod
```

---

## 11. 回滚建议

最稳妥是：

1. 每次发布前打 Git tag
2. 失败时 `git checkout <old-tag>` 回旧代码
3. 执行 `docker compose up -d --build`

---

## 12. 备份建议

## 12.1 数据库备份

```bash
docker compose exec -T postgres pg_dump -U postgres medusa > medusa_$(date +%F_%H%M).sql
```

## 12.2 对象存储备份

若用 MinIO，请定期备份对应 volume 或用 `mc mirror` 到远端存储。

---

## 13. 常用运维命令

```bash
make ps
make logs
make down

# 仅后端
make up-prod-medusa

# 仅前端
docker compose up -d --build storefront
```

---

## 14. 常见问题

### 14.1 登录成功但 `/admin/users/me` 401

- 本地 HTTP 场景请用 `make up-dev-medusa`
- 服务器生产请使用 HTTPS + `make up-prod-medusa`

### 14.2 后台改商品后前端还是旧数据

- 确认 storefront 已重建：`docker compose up -d --build storefront`
- 若需“改完立即更新”，增加 revalidate webhook/订阅器联动

### 14.3 Admin 页面请求了奇怪高位端口（如 40xxx）

这是 dev 模式下 Vite HMR websocket 端口。生产模式不应出现。

---

## 15. 推荐配套文档

- `DEPLOYMENT.md`
- `medusa/DOCKER.md`
- `storefront/DOCKER.md`

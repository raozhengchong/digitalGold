# Fashion Starter 项目前后端架构说明

## 1. 项目整体架构

该项目是一个 Headless Commerce 架构，采用前后端分离：

- `storefront/`：Next.js 15 前端商城，负责用户浏览、搜索、购物车、结账、账户等页面。
- `medusa/`：Medusa v2 后端，负责商品、订单、支付、文件、搜索索引、邮件、Admin 扩展等能力。
- `docker-compose.yml`：本地基础设施，包括 Postgres、Redis、MinIO、MeiliSearch。

整体调用关系：

```text
Browser
  -> Storefront Next.js :8000
    -> Medusa Store API :9000
      -> Postgres
      -> Redis
      -> MinIO
      -> MeiliSearch
    -> MeiliSearch :7700
```

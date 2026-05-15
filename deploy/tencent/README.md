# SummitLink CN 节点部署指南

> 腾讯云上海 (ap-shanghai) | 2核4GB | TencentOS Server 3.3

---

## 快速开始

### 前置要求

- 服务器已通过 `init-server.sh` 完成初始化（Docker + 防火墙 + fail2ban）
- 已配置 5 个 GitHub Secrets（见下文）
- 域名 `summitlink.app` 已购买，DNS 已配置（见 `docs/DNS_GEO_ROUTING.md`）

---

## 一、首次手动部署

```bash
# 1. SSH 登录服务器
ssh root@49.234.163.103

# 2. 初始化服务器（只需一次）
curl -fsSL https://raw.githubusercontent.com/your-org/desktop-tutorial/main/deploy/tencent/init-server.sh | bash

# 3. 克隆代码
git clone https://github.com/your-org/desktop-tutorial.git /opt/summitlink
cd /opt/summitlink

# 4. 配置环境变量
cp deploy/tencent/.env.example .env
vim .env  # 填写真实 secrets

# 5. 启动服务
bash deploy/tencent/deploy.sh
```

---

## 二、CI/CD 自动部署

推送代码到 `main` 分支后，`.github/workflows/deploy-tencent.yml` 会自动触发：

1. 通过 SCP 同步代码到服务器
2. SSH 执行 `docker compose up -d --build`
3. 健康检查 `curl http://localhost:8080/api/health` 返回 200

### 需要配置的 GitHub Secrets

| Secret 名称 | 值 | 必需 |
|------------|-----|------|
| `TENCENT_HOST` | `49.234.163.103` | ✅ |
| `TENCENT_SSH_PORT` | `22` | ✅ |
| `TENCENT_SSH_USER` | `root` | ✅ |
| `TENCENT_SSH_KEY` | SSH 私钥内容（`~/.ssh/id_rsa` 的完整内容）| ✅ |
| `TENCENT_DEPLOY_PATH` | `/opt/summitlink` | ✅ |

**配置路径**：GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret

---

## 三、目录结构

```
deploy/tencent/
├── docker-compose.yml    # 服务定义：backend + postgres + nginx
├── nginx.conf            # 反向代理 + gzip + 限流 + HSTS
├── Dockerfile.backend    # Node.js 20-alpine 多阶段构建
├── .env.example          # 环境变量模板（不含真实值）
├── init-server.sh        # 首次部署初始化脚本
├── deploy.sh             # CI/CD 调用的部署脚本
└── README.md             # 本文件
```

---

## 四、服务架构

```
Internet (CN 用户)
      │
      ▼
  Nginx :80/:443
      │
      ├─ /api/* ──────→ Backend :8080 (Node.js)
      │                    │
      │                    ▼
      │               PostgreSQL :5432
      │
      └─ 静态资源 ──→ 腾讯云 COS CDN
```

---

## 五、内存使用规划（4GB 机器）

| 服务 | 配置上限 | 典型用量 |
|------|---------|---------|
| Node.js backend | `mem_limit: 1.5g`，heap=1024MB | ~400-600MB |
| PostgreSQL | `mem_limit: 768m`，shared_buffers=512MB | ~600MB |
| Nginx | `mem_limit: 128m` | ~20MB |
| 操作系统 | — | ~300MB |
| **合计** | ~2.4GB | 剩余 ~1.6GB 缓冲 |

---

## 六、常用运维命令

```bash
cd /opt/summitlink

# 查看服务状态
docker compose ps

# 查看后端日志（最新 100 行）
docker compose logs backend --tail=100 -f

# 健康检查
curl http://localhost:8080/api/health

# 重启后端（不重建镜像）
docker compose restart backend

# 完整重部署
bash deploy/tencent/deploy.sh

# 查看 PostgreSQL 连接数
docker compose exec postgres psql -U summitlink -c "SELECT count(*) FROM pg_stat_activity;"

# 备份数据库
docker compose exec postgres pg_dump -U summitlink summitlink > backup-$(date +%Y%m%d).sql
```

---

## 七、SSL 证书（ICP 备案完成后）

```bash
# 申请证书（需要 80 端口可访问）
certbot --nginx -d summitlink.app -d www.summitlink.app -d api-cn.summitlink.app

# 设置自动续签（cron）
echo "0 3 * * 1 certbot renew --quiet && docker compose -f /opt/summitlink/docker-compose.yml restart nginx" | crontab -
```

> ⚠️ **备案期间**：nginx.conf 中 HTTPS server block 因无证书会报错，
> 请临时注释掉 HTTPS server block，仅保留 HTTP 监听，等备案完成 + 证书申请后再启用。

---

## 八、故障排查

| 现象 | 排查命令 |
|------|---------|
| 后端无响应 | `docker compose logs backend --tail=50` |
| 数据库连接失败 | `docker compose logs postgres --tail=20` |
| nginx 502 Bad Gateway | `docker compose ps` 确认 backend 健康 |
| 磁盘满了 | `docker system prune -f && docker volume prune -f` |
| 内存 OOM | `docker stats` 查看各容器用量 |

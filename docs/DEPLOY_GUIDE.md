# SummitLink 5 分钟部署手册

## 1) 一键部署

```bash
./deploy/tencent/deploy.sh
```

## 2) 必配最小环境变量（5 个）

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- `PII_ENCRYPTION_KEY`
- `API_BASE`

## 3) 常见故障排查

### Prisma 连接失败

- 确认 `DATABASE_URL` 是可访问的 PostgreSQL 连接串
- 检查数据库白名单与网络连通性
- 重新执行：`npm run prisma:generate`

### Nginx 502

- 确认 backend 容器已启动并监听 8080
- 检查 `deploy/tencent/docker-compose.yml` 服务健康状态
- 查看日志：`docker compose logs -f backend nginx`

### 健康检查失败

- 先请求：`/api/health`
- 再检查关键配置接口：`/api/config/map`
- 若是环境变量缺失，按 `scripts/check-env.js` 提示补齐后重启服务

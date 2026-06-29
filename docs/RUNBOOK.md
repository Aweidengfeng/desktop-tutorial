# SummitLink 运维手册 (RUNBOOK)

> 维护人：项目负责人  
> 更新时间：2026-04-20

---

## 1. 数据库损坏 / 磁盘满

### 症状
- 后端启动报错 `SQLITE_IOERR` 或 `disk I/O error`
- 所有 API 返回 500
- Railway Volume 使用率达到 100%

### 排查步骤
```bash
# 检查磁盘占用
df -h /data

# 检查数据库完整性
sqlite3 /data/summitlink.db "PRAGMA integrity_check;"

# 查看数据库大小
ls -lh /data/summitlink.db
```

### 恢复步骤
1. **磁盘满**：清理 `/data/uploads` 中的旧文件，或扩容 Railway Volume
2. **数据库损坏**：
   ```bash
   # 停止服务（Railway → Settings → Stop Service）
   # 从备份恢复
   gunzip -c /data/backups/summitlink-YYYYMMDDHHII.db.gz > /data/summitlink_restore.db
   # 验证
   sqlite3 /data/summitlink_restore.db "PRAGMA integrity_check;"
   # 替换
   mv /data/summitlink.db /data/summitlink.db.broken
   mv /data/summitlink_restore.db /data/summitlink.db
   # 重启服务
   ```
3. 若无可用备份，联系云服务商查看是否有快照

---

## 2. 高德 AMap 配额超限

### 症状
- 前端地图显示"配额超限"或空白
- 浏览器控制台出现 AMap API 错误

### 排查步骤
- 登录 [高德开放平台控制台](https://console.amap.com/) 查看当日调用量
- 检查是否有爬虫/异常请求（访问日志）

### 处理步骤
1. **临时**：在 Railway 环境变量中清空 `AMAP_KEY`，前端将显示配置提示（不崩溃）
2. **升级配额**：在高德控制台申请提升日调用量
3. **长期**：对地图渲染添加前端缓存（localStorage TTL），减少重复加载

---

## 3. OpenWeather 速率限制

### 症状
- `/api/weather/*` 接口返回 503 或 `weather unavailable`
- OpenWeather API 返回 HTTP 429

### 排查步骤
```bash
# 检查天气接口状态
curl https://YOUR_RAILWAY_URL/api/weather/popular-peaks
```

### 处理步骤
1. **立即**：天气接口已内置 mock fallback，服务不中断
2. **排查**：检查 `OPENWEATHER_API_KEY` 是否有效；确认当月请求量
3. **升级**：访问 [OpenWeatherMap](https://openweathermap.org/price) 升级到付费套餐（Standard: 60次/分钟）
4. **缓存**：使用 `backend/utils/weatherCache.js` 对高频请求缓存 15 分钟

---

## 4. Sentry 不可用

### 症状
- 错误无法上报到 Sentry Dashboard
- 后端日志出现 Sentry 连接失败警告

### 处理说明
- Sentry 采用**条件初始化**：若 DSN 无效或 Sentry 服务不可达，**后端服务正常运行**，只是错误无法上报
- 不影响用户访问

### 处理步骤
1. 检查 [Sentry Status](https://status.sentry.io/) 查看是否平台故障
2. 若为配置问题，在 Railway 重新设置 `SENTRY_DSN`
3. 确认 Sentry 项目配额未超限

---

## 5. Railway 部署失败

### 症状
- GitHub push 后 Railway 构建失败
- 服务健康检查不通过

### 排查步骤
1. 检查 Railway Dashboard → Deployments → 查看构建日志
2. 确认 `railway.toml` 中 `buildCommand` 正确
3. 检查 `/api/health` 是否可访问

### 回滚步骤
```
Railway Dashboard → Deployments → 选择上一个成功的 deployment → Rollback
```

### 常见原因
- `npm install` 失败：检查 `backend/package.json` 依赖版本
- 环境变量缺失：在 Railway → Variables 检查必要变量
- 端口冲突：确认 `PORT` 环境变量已设置或使用默认 8080
- 启动安全校验失败：生产环境需设置 `JWT_SECRET` 和 `ADMIN_PASSWORD`（非默认值）
- `expedition_orders.order_no` 唯一约束冲突：先运行 `node backend/scripts/fix-duplicate-order-no.js --dry-run` 预检，再运行 `node backend/scripts/fix-duplicate-order-no.js` 修复重复值，随后 redeploy

---

## 6. 支付回调失败

### 症状
- 用户支付后订单状态未更新（仍为 `pending_payment`）
- 管理后台看到订单停留在待支付状态

### 排查步骤
1. 检查支付回调日志（Sentry / Railway 日志）
2. 确认回调 URL 是否可从外网访问（`/api/pay/callback`）
3. 检查 `WECHAT_*` / `ALIPAY_*` 环境变量配置

### 处理步骤
1. **手动更新订单**（紧急情况）：
   ```
   POST /api/orders/admin/:id/transition
   Body: { "newStatus": "paid" }
   Authorization: Bearer <admin_token>
   ```
2. **联系用户**：通知用户支付已收到，人工处理
3. **修复回调**：检查防火墙、CORS、支付平台白名单 IP

### 联系支付平台
- 微信支付：[微信支付商户平台](https://pay.weixin.qq.com/)
- 支付宝：[支付宝开放平台](https://open.alipay.com/)

---

## 附：紧急联系

| 角色 | 联系方式 |
|------|---------|
| 项目负责人 | hello@unsummit.cn |
| Railway 支持 | https://railway.app/help |
| 高德技术支持 | https://lbs.amap.com/support |

---

## Prisma unique 约束 data-loss 警告导致部署崩溃

### 症状
- Railway 部署日志出现：`Error: Use the --accept-data-loss flag`
- 服务状态：Crashed

### 根因
Prisma 检测到 schema 中新增 `@unique` 约束时，无论目标表是否为空，都会保守地发出 data-loss 警告并拒绝 `db push`。

### 处理步骤
1. **检查** `backend/scripts/fix-duplicate-order-no.js` 中的 `TARGETS` 数组是否包含所有受影响的 (表, 列)。
2. 如有遗漏，追加一行并合并 PR，Railway 自动重新部署。
3. 部署成功后验证服务：
   ```bash
   curl -s https://desktop-tutorial-production-182a.up.railway.app/api/health | jq .
   ```

### 教训
> 未来在 Prisma schema 中添加 `@unique` 约束时，必须在 PR 描述中列出**所有受影响的 (表, 列)**，并在 `TARGETS` 数组中同步更新。

## 🛡️ Stripe 优雅降级

### 何时使用
- Stripe Live 密钥尚未拿到/激活
- Stripe 服务大面积故障
- 临时停止收单（运营决策）

### 启用步骤
1. Railway → Variables → 新增 `STRIPE_DISABLED=true`
2. 服务自动 redeploy（~2 分钟）
3. 验证：`curl https://.../api/health` → 200；`curl -X POST https://.../api/payment/create-payment-intent` → 503
4. 前端会显示“支付暂未开放”，其他功能正常

### 解除步骤
1. 确认 `STRIPE_SECRET_KEY=sk_live_*` 已在 Variables 中
2. 确认 `STRIPE_WEBHOOK_SECRET` 已配置生产 endpoint
3. 删除 `STRIPE_DISABLED` 变量（或设为 false）
4. 自动 redeploy → 启动日志应显示 `Stripe: ✅ Enabled (live mode)`

# Payments Gating Plan (5/15 → 6/1)

## EN

### Purpose
For the 5/15 submission (v1.0 free tier), all payment entry points are intentionally disabled while keeping payment code paths ready for v1.1.

### Feature Flag
- Env var: `PAYMENTS_ENABLED`
- Default: `false`
- Effective rule: only `PAYMENTS_ENABLED=true` enables payment UI and payment APIs.

### v1.0 (5/15) behavior
1. Frontend:
   - Payment-related buttons are hidden.
   - Replacement text is shown: `即将上线 (Coming Soon)`.
2. Backend:
   - Payment endpoints return:
     - `503`
     - `{ "error": "payments_disabled", "message": "Payments are not yet available in this region. Please check back soon." }`
3. Admin/ops visibility:
   - Payment-related metrics use graceful fallback where needed.

### v1.1 (target: 6/1) enablement checklist
1. Confirm HK entity payment processor approval is complete.
2. Configure production payment variables.
3. Set `PAYMENTS_ENABLED=true`.
4. Run API + E2E regression tests.
5. Deploy and verify `/api/config` reports `paymentsEnabled: true`.

---

## 中文

### 目的
5/15 提审版本（v1.0 免费版）要求支付功能全部关闭，但保留代码路径，待 v1.1 再开启。

### 开关变量
- 环境变量：`PAYMENTS_ENABLED`
- 默认值：`false`
- 生效规则：仅当 `PAYMENTS_ENABLED=true` 时，前端支付入口与后端支付接口才启用。

### v1.0（5/15）行为
1. 前端：
   - 所有付费相关按钮隐藏。
   - 显示替代文案：`即将上线 (Coming Soon)`。
2. 后端：
   - 付费接口统一返回：
     - `503`
     - `{ "error": "payments_disabled", "message": "Payments are not yet available in this region. Please check back soon." }`
3. 管理端：
   - 相关支付字段在禁用时做降级显示，避免报错。

### v1.1（目标 6/1）切换步骤
1. 确认香港主体支付通道审批完成。
2. 配置生产支付环境变量。
3. 将 `PAYMENTS_ENABLED` 设置为 `true`。
4. 运行 API + E2E 回归测试。
5. 发布后检查 `/api/config` 返回 `paymentsEnabled: true`。

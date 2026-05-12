# 🚦 SummitLink Gradual Rollout Plan

## 1. 目标
- 通过分阶段放量降低生产风险，确保 v1.3.0 发布稳定。

## 2. 放量节奏
- Stage 1：5%（2-4 小时）
- Stage 2：20%（4-8 小时）
- Stage 3：50%（12-24 小时）
- Stage 4：100%（确认稳定后）

## 3. 回滚触发条件
- Crash-free session < 99%
- API 5xx 持续升高
- 支付成功率显著下降

## 4. 监控与决策指标
- Sentry 主看板：`<SENTRY_DASHBOARD_URL_PLACEHOLDER>`
- Health Check：`/api/health`
- 支付成功率：Stripe Dashboard + 业务日志

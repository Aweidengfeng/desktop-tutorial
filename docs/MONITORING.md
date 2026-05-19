# Monitoring / Sentry 配置

## 1. 创建 Sentry 项目

1. 登录 Sentry（https://sentry.io/）
2. 创建 Organization 与 Project（推荐平台：Node.js + Browser）
3. 在 Project Settings → Client Keys (DSN) 复制 DSN

## 2. 配置环境变量

在后端环境中配置：

```env
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
NODE_ENV=production
```

前端无需单独写死 DSN。后端会在 HTML 中注入 `window.__SENTRY_DSN__`，仅注入后前端才初始化 Sentry。

## 3. 告警建议

建议至少配置以下告警规则：

- 新错误事件（New Issue）立即通知
- 5 分钟内错误数突增（error spike）
- `payment.*`、`sos.*`、`withdrawal.*` 相关事件单独告警

## 4. 关键事件

当前系统会在以下路径主动上报自定义事件：

- 支付失败（`payment.create_intent.failed`、`payment.wechat_qrcode.failed`）
- SOS 告警创建（`sos.alert.created`）
- 提现审批（`withdrawal.reviewed`）

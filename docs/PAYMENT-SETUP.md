# PAYMENT SETUP

## 微信支付接入

```env
WECHAT_MCH_ID=              # 微信商户号
WECHAT_APP_ID=              # 微信 AppID（公众号/小程序）
WECHAT_API_V3_KEY=          # API v3 密钥（32位）
WECHAT_CERT_SERIAL=         # 商户证书序列号
WECHAT_PRIVATE_KEY=         # 商户私钥（PKCS#8，Base64 或 PEM，换行用 \n）
WECHAT_NOTIFY_URL=          # 支付回调地址（如 https://your-domain.com/api/payment/callback/wechat）
WECHAT_SPLIT_ENABLED=true   # 开启分账（可选）
```

## 支付宝接入

```env
ALIPAY_APP_ID=              # 支付宝 APPID
ALIPAY_PRIVATE_KEY=         # 应用私钥（PKCS8）
ALIPAY_PUBLIC_KEY=          # 支付宝公钥（用于验签）
ALIPAY_NOTIFY_URL=          # 异步通知地址
ALIPAY_RETURN_URL=          # 同步跳转地址
ALIPAY_SANDBOX=false        # true=沙箱环境
```

## Stripe 接入

```env
STRIPE_SECRET_KEY=sk_live_xxx       # 或 sk_test_xxx（测试）
STRIPE_PUBLISHABLE_KEY=pk_live_xxx  # 前端用
STRIPE_WEBHOOK_SECRET=whsec_xxx     # Webhook 签名密钥
```

## 默认行为

- 对应支付方式缺少关键环境变量时，会自动降级为 mock
- `NODE_ENV=production` 时 mock 支付页禁用（`/api/payment/mock-pay` 返回 404）

# SummitLink 上线前最终检查清单

## A. 基础设施
- [ ] 腾讯云服务器 SSH 密钥已配置到 GitHub Secrets
- [ ] DATABASE_URL 指向生产 PostgreSQL（非 SQLite）
- [ ] JWT_SECRET 已设置（32+ 字符随机字符串）
- [ ] PII_ENCRYPTION_KEY 已设置（32+ 字符）
- [ ] SSL 证书已签发（Let's Encrypt 或商业证书）
- [ ] ICP 备案完成，ICP_NUMBER 已配置
- [ ] 域名 DNS 解析已指向腾讯云 IP

## B. 支付
- [ ] 微信商户号已申请，WECHAT_MCH_ID / WECHAT_APP_ID / WECHAT_API_V3_KEY / WECHAT_CERT 已配置
- [ ] 支付宝商户号已申请，ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY 已配置
- [ ] Stripe 账户已开通，STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET 已配置（国际用户）
- [ ] 支付回调 URL 已在微信商户后台/支付宝后台配置
- [ ] PAYMENTS_ENABLED=true（生产环境）

## C. 第三方服务
- [ ] 高德地图 Web Key 已申请，AMAP_KEY / AMAP_SECURITY_CODE 已配置
- [ ] 腾讯云短信已开通，TENCENT_SMS_* 已配置
- [ ] 微信公众号/小程序 WECHAT_APPID + WECHAT_SECRET 已配置
- [ ] Apple Sign-In：APPLE_CLIENT_ID / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY 已配置
- [ ] Google Sign-In：GOOGLE_CLIENT_ID 已配置
- [ ] FCM：FCM_SERVER_KEY 已配置
- [ ] Sentry：SENTRY_DSN 已配置
- [ ] 腾讯云 COS：COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET 已配置

## D. 安全
- [ ] CORS ALLOWED_ORIGINS 已配置为生产域名
- [ ] Rate Limit 已启用
- [ ] HTTPS 强制跳转已启用（nginx.conf HTTP→HTTPS）
- [ ] 敏感日志脱敏已开启
- [ ] 数据库定期备份策略已配置

## E. 功能验收
- [ ] 用户注册/登录（手机号 + 短信验证码）
- [ ] 微信/支付宝/Stripe 支付（沙盒测试通过）
- [ ] SOS 报警（GPS 入库 + 管理员告警）
- [ ] 向导申请/审核流程
- [ ] 提现申请/审批流程
- [ ] 数据导出/账号注销（GDPR）
- [ ] 地图加载正常（AMap/OSM fallback）
- [ ] PWA 离线基本功能可用
- [ ] E2E 全绿（GitHub Actions）

## F. 移动端
- [ ] iOS App Store 提审材料准备完毕
- [ ] Android Google Play 提审材料准备完毕
- [ ] App 内支付 IAP（若适用）配置完毕

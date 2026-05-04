# SummitLink App Store 提交清单

## ✅ 代码已完成（无需再改）
- [x] 品牌统一（SummitLink）
- [x] 隐私政策页面（/legal/privacy）
- [x] 用户条款页面（/legal/terms）
- [x] GDPR 合规接口
- [x] Apple Sign In 后端
- [x] Google OAuth 后端
- [x] 邮箱注册/登录
- [x] PII 字段加密
- [x] HTTP 安全头
- [x] App 图标 SVG 源文件
- [x] iOS 权限描述（Info.plist）
- [x] Android 权限声明（AndroidManifest）
- [x] Stripe 支付（测试模式）
- [x] 多货币显示

## ⏳ 等你完成（人工任务）
- [ ] A-01 Apple 开发者账号（$99/年）
- [ ] A-02 Google Play 账号（$25）
- [ ] 本地运行 `npx cap add ios && npx cap add android`
- [ ] 运行 `npx @capacitor/assets generate` 生成图标
- [ ] 截图 5 张（iPhone 6.5寸）
- [ ] App Store Connect 填写信息

## 📱 本地出包命令
```bash
# iOS
npx cap sync ios
npx cap open ios   # 用 Xcode 打包

# Android
npx cap sync android
npx cap open android   # 用 Android Studio 打包
```

## 🔗 快速链接
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- 隐私政策 URL: https://summitlink.app/legal/privacy
- 用户条款 URL: https://summitlink.app/legal/terms

# 📱 SummitLink 移动端打包指南

## 前提条件

- Node.js 20+
- Android Studio（Android 打包）
- Xcode 15+（iOS 打包，仅 macOS）
- Apple 开发者账号（iOS 上架）
- Google Play 开发者账号（Android 上架）

## 本地开发

### 初始化 Capacitor

```bash
# 安装依赖
cd backend && npm install
cd ..

# 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# 添加平台（首次）
npx cap add android
npx cap add ios

# 同步代码
npx cap sync
```

### Android 调试

```bash
npx cap open android
# 在 Android Studio 中选择设备运行
```

### iOS 调试

```bash
npx cap open ios
# 在 Xcode 中选择设备运行
```

## CI/CD 自动构建

### Android（GitHub Actions）

触发方式：推送 `v*` tag 或手动触发
```bash
git tag v1.0.0
git push origin v1.0.0
```

需要设置的 GitHub Secrets：
| Secret | 说明 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | keystore 文件 base64 编码 |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key 密码 |
| `ANDROID_STORE_PASSWORD` | store 密码 |

生成 keystore：
```bash
keytool -genkey -v -keystore summitlink.keystore \
  -alias summitlink -keyalg RSA -keysize 2048 -validity 10000
# 然后 base64 编码
base64 -i summitlink.keystore | pbcopy
```

### iOS（GitHub Actions）

触发方式：推送 `v*` tag 或手动触发

需要设置的 GitHub Secrets：
| Secret | 说明 |
|--------|------|
| `IOS_CERTIFICATE_P12_BASE64` | 发布证书 p12 base64 |
| `IOS_CERTIFICATE_PASSWORD` | 证书密码 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Provisioning Profile base64 |

> ⚠️ iOS 证书需要 Apple 开发者账号审核通过后才能获取

## App Store 上架步骤

1. 在 App Store Connect 创建应用
2. 填写应用信息（参考 `APP_STORE_COPY.md`）
3. 上传截图（5张，iPhone 6.5寸）
4. 上传 IPA（通过 Xcode Organizer 或 Transporter）
5. 提交审核

## Google Play 上架步骤

1. 在 Google Play Console 创建应用
2. 上传 AAB 文件（从 Actions artifacts 下载）
3. 填写商店信息
4. 完成内容分级
5. 发布到内部测试 → 封闭测试 → 正式发布

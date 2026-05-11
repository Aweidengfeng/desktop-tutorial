# 🔐 GitHub Secrets 配置指南

> SummitLink CI/CD 所需的所有密钥配置说明
> 路径：GitHub → 仓库 Settings → Secrets and variables → Actions

---

## Railway 部署

| Secret 名称 | 获取方式 | 必需 |
|------------|---------|------|
| `RAILWAY_TOKEN` | Railway Dashboard → Account Settings → Tokens → New Token | ✅ |
| `PRODUCTION_API_URL` | Railway 项目 → 你的服务 URL（如 `https://xxx.railway.app`）| ✅ |

---

## iOS 构建

| Secret 名称 | 获取方式 |
|------------|---------|
| `APPLE_CERTIFICATE_BASE64` | `base64 -i Certificates.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | 导出证书时设置的密码 |
| `APPLE_PROVISIONING_PROFILE_BASE64` | `base64 -i profile.mobileprovision \| pbcopy` |
| `APPLE_TEAM_ID` | developer.apple.com → 账号 → 看右上角（10位字母数字）|
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect → 用户与访问 → 密钥 → Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | 同页面的 Issuer ID |
| `APP_STORE_CONNECT_API_KEY_BASE64` | `base64 -i AuthKey_XXXXXX.p8 \| pbcopy` |

---

## Android 构建

| Secret 名称 | 获取方式 |
|------------|---------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i summitlink-release-key.jks \| pbcopy` |
| `ANDROID_KEY_ALIAS` | 创建 keystore 时设置（如 `summitlink`）|
| `ANDROID_KEY_PASSWORD` | 创建 keystore 时设置的密码 |
| `ANDROID_STORE_PASSWORD` | 同上（通常与 key password 相同）|

---

## 如何添加 Secret

```bash
# 方法1：GitHub 网页
# Settings → Secrets and variables → Actions → New repository secret
# 粘贴名称和值 → Add secret

# 方法2：GitHub CLI
gh secret set RAILWAY_TOKEN --body "你的token值"
gh secret set PRODUCTION_API_URL --body "https://your-app.railway.app"
```

---

## 验证 Secret 是否生效

push 任意代码到 main 分支后，查看：
- GitHub → Actions → Deploy to Railway (Production)
- 如果 Secrets 正确，deploy job 应该成功

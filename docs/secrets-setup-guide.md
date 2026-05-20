# 🔐 GitHub Secrets 配置指南

> SummitLink CI/CD 所需的所有密钥配置说明
> 路径：GitHub → 仓库 Settings → Secrets and variables → Actions

---

## Railway 部署（Deploy Workflow）

对应 workflow：`.github/workflows/deploy-railway.yml`

| Secret 名称 | 获取方式 | 必需 |
|------------|---------|------|
| `RAILWAY_TOKEN` | Railway Dashboard → Account Settings → Tokens → New Token | 可选（用于 CLI 触发部署） |
| `PRODUCTION_API_URL` | Railway 项目 → 你的服务 URL（如 `https://xxx.railway.app`） | 可选（配置后会执行生产冒烟测试） |

## 健康检查（Health Check Workflow）

对应 workflow：`.github/workflows/health-check.yml`

| Variable 名称 | 获取方式 | 必需 |
|---------------|---------|------|
| `PRODUCTION_URL` | 生产环境基础 URL（如 `https://xxx.railway.app`） | ✅ |

---

## iOS 构建

| Secret 名称 | 获取方式 |
|------------|---------|
| `IOS_CERTIFICATE_P12_BASE64` | `Certificates.p12` 的 base64（见下方跨平台命令） |
| `IOS_CERTIFICATE_PASSWORD` | 导出证书时设置的密码 |
| `IOS_PROVISIONING_PROFILE_BASE64` | `profile.mobileprovision` 的 base64（见下方跨平台命令） |

---

## Android 构建

| Secret 名称 | 获取方式 |
|------------|---------|
| `ANDROID_KEYSTORE_BASE64` | `summitlink-release-key.jks` 的 base64（见下方跨平台命令） |
| `ANDROID_KEY_ALIAS` | 创建 keystore 时设置（如 `summitlink`）|
| `ANDROID_KEY_PASSWORD` | 创建 keystore 时设置的密码 |
| `ANDROID_STORE_PASSWORD` | 同上（通常与 key password 相同）|

---

## base64 跨平台命令（复制到剪贴板/终端）

```bash
# macOS（复制到剪贴板）
base64 -i Certificates.p12 | pbcopy

# Linux（输出到终端，复制整行结果）
base64 -w 0 Certificates.p12

# Windows PowerShell（输出到终端）
[Convert]::ToBase64String([IO.File]::ReadAllBytes("Certificates.p12"))
```

---

## 如何添加 Secret

```bash
# 方法1：GitHub 网页
# Settings → Secrets and variables → Actions → New repository secret
# 粘贴名称和值 → Add secret

# 方法2：GitHub CLI
gh secret set RAILWAY_TOKEN --body "你的token值"
gh secret set PRODUCTION_API_URL --body "https://your-app.railway.app"
gh variable set PRODUCTION_URL --body "https://your-app.railway.app"
```

---

## 验证 Secret 是否生效

push 任意代码到 main 分支后，查看：
- GitHub → Actions → Deploy to Railway (Production)
- GitHub → Actions → Health Check
- 如果 `PRODUCTION_API_URL`/`PRODUCTION_URL` 配置正确，冒烟测试与健康检查应通过

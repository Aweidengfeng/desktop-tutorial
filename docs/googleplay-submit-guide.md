# 🤖 Google Play Console 提交指南

> SummitLink v1.0.0 — Google Play Store 上架操作手册
> 前置条件：A-02 Google Play 开发者账号已注册（$25 一次性）

---

## 第一步：创建应用

1. 打开 [Google Play Console](https://play.google.com/console)
2. **创建应用** → 填写：
   - **应用名称**：SummitLink
   - **默认语言**：中文（简体）
   - **应用类型**：应用（非游戏）
   - **免费或付费**：免费
3. 接受开发者计划政策 → **创建应用**

---

## 第二步：应用内容声明

左侧菜单 → **政策** → **应用内容**，逐项完成：

### 隐私权政策
- URL：`https://your-app.railway.app/legal/privacy`

### 广告
- 选择：**此应用不含广告**

### 应用访问权限
- 选择：**全部或部分功能受限**
- 添加说明：邮箱 `demo@summitlink.app`，密码 `Demo1234!`

### 内容分级
- 点击**开始问卷**
- 类别选：**实用工具**
- 所有问题选**否**
- 提交 → 获得**所有人**分级

### 目标受众
- 目标年龄：18 岁及以上

### 新闻应用
- 选择：**否**

---

## 第三步：商店信息

### 主要商品详情
| 字段 | 内容 |
|------|------|
| 应用名称 | SummitLink |
| 简短说明（≤80字）| 连接全球攀登者，发现路线，预约向导 |
| 完整说明（≤4000字）| 从 `APP_STORE_COPY.md` 复制 Android 版 |

### 图形资产（必需）
| 类型 | 尺寸 | 说明 |
|------|------|------|
| 应用图标 | 512×512 px PNG | 从 `assets/` 导出 |
| 功能图片 | 1024×500 px | 横幅图（可用模板制作）|
| 手机截图 | 至少 2 张，最多 8 张 | 16:9 或 9:16 |

### 截图要求
- 最小：320px 宽
- 最大：3840px（长边）
- 格式：JPEG 或 PNG（无 alpha 通道）
- 内容：与 App Store 相同的 5 张

---

## 第四步：应用版本（APK/AAB）

### 构建 Release AAB
```bash
# 方法1：在 GitHub Actions 中手动触发 Android workflow（推荐）
# 打开 Actions → 选择 Android / PR-17 相关 workflow
# 使用 workflow_dispatch 手动运行，并选择需要构建的分支/版本
# 构建完成后，从 Artifacts 下载 AAB

# 注意：如果 iOS/Android 两个 workflow 都使用 on.push.tags: 'v*'
# 不要使用 git tag v1.0.0-android 这类方式仅构建 Android，
# 否则会同时触发 iOS 和 Android workflow，造成额外 macOS 构建消耗
# 只有在 tag pattern 已拆分为 v*-android / v*-ios 时，才建议使用平台后缀 tag

# 方法2：本地构建
cd android
./gradlew bundleRelease
# 输出：android/app/build/outputs/bundle/release/app-release.aab
```

### 签名配置
在 Android Studio 或 CI 中配置签名：
```bash
# 生成签名密钥（只需一次）
keytool -genkey -v -keystore summitlink-release-key.jks \
  -alias summitlink -keyalg RSA -keysize 2048 -validity 10000
```

将以下 Secrets 添加到 GitHub：
| Secret | 内容 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | keystore 文件 base64 |
| `ANDROID_KEY_ALIAS` | `summitlink` |
| `ANDROID_KEY_PASSWORD` | 你设置的密码 |
| `ANDROID_STORE_PASSWORD` | 你设置的密码 |

### 上传到 Play Console
1. 左侧 → **测试** → **内部测试** → **创建新版本**
2. 上传 AAB 文件
3. 填写版本说明（发行说明）
4. **保存** → **推出版本**

---

## 第五步：正式发布

内部测试 → 封闭测试 → 开放测试 → 正式发布

| 阶段 | 说明 | 建议时间 |
|------|------|---------|
| 内部测试 | 最多 100 名测试员，即时发布 | Day 1 |
| 封闭测试 | 邀请测试，收集反馈 | 1 周 |
| 开放测试 | 公开，任何人可加入 | 1 周 |
| 正式发布 | 按比例推出（20% → 50% → 100%）| 审核后 |

### 正式发布步骤
1. **正式发布** → **创建新版本**
2. 选择已测试的 AAB
3. 选择推出范围：**所有国家/地区**
4. 点击**发布**（Google 审核通常 1–3 天）

---

## 常见拒绝原因 & 对策

| 拒绝原因 | 对策 |
|---------|------|
| 隐私政策不合规 | 确认 `/legal/privacy` 包含所有 Google 要求条款 |
| 权限声明不足 | 在应用说明中解释位置权限用途 |
| 目标 API 级别过低 | 确认 `targetSdkVersion >= 34`（Android Gradle 设置）|
| 内容分级未完成 | 完成内容分级问卷 |
| AAB 未签名 | 确保使用 Release 签名构建 |

---

## Android 环境配置清单

确认 `android/app/build.gradle` 包含：
```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

---

## 完成标志

- [ ] 应用已创建
- [ ] 所有内容声明已完成（隐私/广告/分级/受众）
- [ ] 商店信息已填写（名称/描述/截图/图标）
- [ ] AAB 已上传到内部测试
- [ ] 内部测试已推出并验证
- [ ] 已提交正式发布审核

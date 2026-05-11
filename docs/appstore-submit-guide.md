# 📱 App Store Connect 提交指南

> SummitLink v1.0.0 — iOS App Store 上架操作手册
> 前置条件：A-01 Apple 开发者账号已注册（$99/年）

---

## 第一步：创建 App 记录

1. 打开 [App Store Connect](https://appstoreconnect.apple.com)
2. 点击 **我的 App** → **+** → **新建 App**
3. 填写信息：
   - **平台**：iOS
   - **名称**：SummitLink
   - **主要语言**：简体中文（或 English）
   - **Bundle ID**：`app.summitlink`（需在 Apple Developer 后台先注册）
   - **SKU**：`summitlink-v1`（唯一标识，不公开）
4. 点击**创建**

---

## 第二步：填写 App 信息

### 基本信息
| 字段 | 填写内容 |
|------|---------|
| 名称 | SummitLink |
| 副标题（可选）| Connect. Climb. Conquer. |
| 类别（主）| 运动 (Sports) |
| 类别（副）| 旅游 (Travel) |
| 内容分级 | 4+ |

### 描述文案
从 `APP_STORE_COPY.md` 复制：
- **App 描述**（简体中文版）
- **推广文字**（170 字以内）
- **关键词**（100 字以内，逗号分隔）

关键词建议：
```
登山,攀岩,户外,路线,探险,向导,俱乐部,GPS,轨迹,SummitLink,hiking,climbing,outdoor
```

---

## 第三步：截图上传

### 必需尺寸
| 设备 | 尺寸 | 数量 |
|------|------|------|
| iPhone 6.7"（仓库模板已提供） | 1290×2796 px | 3–10 张 |
| iPhone 6.5"（可选补充） | 1284×2778 px | 3–10 张 |
| iPad Pro 12.9" (可选) | 2048×2732 px | 3–10 张 |

> 说明：仓库 `screenshots/template-ios.html` 当前按 1290×2796 输出; 最终以 App Store Connect 当次版本页面要求为准。

### 截图内容建议（5张）
1. **首页** — 地图 + 附近路线
2. **路线详情** — GPS 轨迹 + 难度/距离
3. **向导列表** — 专业向导卡片
4. **AI 教练** — 对话界面
5. **个人中心** — 徽章 + 完成记录

### 使用模板生成截图
```bash
# 使用 PR-18 提供的截图工具
node screenshots/capture.js
# 或手动打开 screenshots/template-ios.html 逐张截图
```

---

## 第四步：隐私政策配置

| 字段 | 填写内容 |
|------|---------|
| 隐私政策 URL | `https://your-app.railway.app/legal/privacy` |
| 数据收集 | 选择收集的数据类型（见下） |

### 数据收集声明（App 隐私）
在 App Store Connect → App 隐私 → 数据类型 中选择：

| 数据类型 | 是否收集 | 用途 |
|---------|---------|------|
| 姓名 | ✅ 是 | App 功能 |
| 电子邮件地址 | ✅ 是 | 账户管理 |
| 位置（精确）| ✅ 是 | App 功能（GPS 轨迹）|
| 位置（粗略）| ✅ 是 | App 功能（地图切换）|
| 使用数据 | ✅ 是 | 分析（Sentry）|
| 崩溃数据 | ✅ 是 | App 功能改进 |
| 支付信息 | ❌ 否 | 由 Stripe 直接处理 |

---

## 第五步：年龄分级

点击**年龄分级** → **编辑** → 问卷全部选**否** → 提交 → 结果：**4+**

---

## 第六步：定价与销售范围

| 字段 | 建议 |
|------|------|
| 价格 | 免费（应用内购买）|
| 销售范围 | 全部国家和地区 |

---

## 第七步：构建版本上传

### 使用 Xcode Archive 上传
```bash
# 1. 打开 Xcode
open ios/App/App.xcworkspace

# 2. 选择 Generic iOS Device
# 3. Product → Archive
# 4. Distribute App → App Store Connect → Upload
```

### 使用 CI 自动构建 IPA 产物（可选加速）
PR-17 已配置 `.github/workflows/build-ios.yml`，push tag 时自动构建 IPA artifact：
```bash
git tag v1.0.0
git push origin v1.0.0
```

> 注意：该 workflow 目前是 **构建并上传 artifact**，不直接上传到 App Store Connect；最终仍需使用 Xcode/Transporter 手动提交。

### 配置所需 Secrets（GitHub → Settings → Secrets）
| Secret | 获取方式 |
|--------|---------|
| `IOS_CERTIFICATE_P12_BASE64` | Xcode → Keychain → 导出 `.p12` → base64 |
| `IOS_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Apple Developer → Profiles → 下载 `.mobileprovision` → base64 |

---

## 第八步：提交审核

1. 选择刚上传的构建版本
2. 填写**审核信息**：
   - 联系电话：你的手机号
   - 联系邮箱：你的邮箱
   - 演示账号：创建一个测试账号填入（邮箱+密码）
3. 选择**自动发布**或**手动发布**
4. 点击**提交以供审核**

### 审核时间
- 首次提交：通常 1–3 个工作日
- 后续版本：通常 24 小时内

---

## 常见拒绝原因 & 对策

| 拒绝原因 | 对策 |
|---------|------|
| 缺少演示账号 | 在审核信息中填写测试账号 |
| 隐私政策无法访问 | 确认 Railway 部署正常，`/legal/privacy` 可访问 |
| App 功能不完整 | 确保演示账号有完整数据 |
| 截图与实际不符 | 使用真实 App 截图 |
| 位置权限说明不足 | 在 `Info.plist` 中补充说明文字 |

---

## C-04 任务完成标志

- [ ] App 记录已创建
- [ ] 所有文案已填写
- [ ] 截图已上传（至少 iPhone 6.7"）
- [ ] 隐私政策 URL 已填写并可访问
- [ ] 数据收集声明已完成
- [ ] 年龄分级已完成
- [ ] 构建版本已上传
- [ ] 已提交审核

完成以上所有步骤后，告知我，我将 C-04 标记为 ✅。

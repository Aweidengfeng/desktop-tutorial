# 📸 SummitLink App Store 截图指南

## 快速生成截图（推荐方法）

### 方法1：浏览器截图（最简单）

1. 用 Chrome 打开 `template-ios.html`
2. 按 F12 打开开发者工具
3. 点击设备模拟图标（手机图标）
4. 设置尺寸为 `1290 x 2796`（iPhone 6.7" 显示规格）
5. 对每个 `#screen1` 到 `#screen5` 滚动到位置后截图
6. 保存为 PNG

### 方法2：命令行（推荐，需 Chrome）

```bash
# 安装 puppeteer
npm install -D puppeteer

# 运行截图脚本
node screenshots/capture.js
```

### 所需尺寸规格

| 平台 | 尺寸 | 数量 | 格式 |
|------|------|------|------|
| iPhone 6.7"（iPhone 15 Pro Max） | 1290×2796 | 5张 | PNG/JPG |
| iPad Pro 13" | 2064×2752 | 5张 | PNG/JPG（可选）|
| Android Phone | 1080×1920 | 5张 | PNG/JPG |
| Android Tablet | 1200×1600 | 5张 | PNG/JPG（可选）|

> 当前仓库已提供的 iPhone 模板文件为 `template-ios.html`（1290×2796，6.7" 显示规格 / iPhone 15 Pro Max 可用）；如后续需要其他 iPhone 显示规格，可在此模板基础上调整导出尺寸。

### 5张截图内容建议

| # | 标题 | 展示功能 |
|---|------|---------|
| 1 | Explore Routes Worldwide | 地图 + GPS路线 |
| 2 | Book Certified Local Guides | 向导预约 + 评价 |
| 3 | Join Climbing Communities | 俱乐部 + 社区 |
| 4 | Secure Global Payments | Stripe支付 + 多货币 |
| 5 | Track Your Adventures | 个人成就 + 统计 |

### 提交要求

**App Store Connect：**
- 最少 1 张，最多 10 张
- 必须包含 iPhone 6.7" 或 6.9" 尺寸
- 格式：PNG 或 JPG，RGB 色彩空间
- 不能包含 Apple 设备真实照片框（用模拟UI即可）

**Google Play Console：**
- 最少 2 张，最多 8 张
- 推荐 16:9 比例
- 格式：PNG 或 JPG，最大 8MB

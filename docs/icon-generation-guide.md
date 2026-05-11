# 🎨 App 图标生成指南

> 从单一源图片自动生成所有平台所需的图标尺寸

---

## 快速开始

### 第一步：准备源图片

需要一张 **1024×1024 px** 的 PNG 图片作为源文件：

**选项 A：使用现有图片**
```bash
cp your-logo.png assets/icon-source.png
```

**选项 B：从 SVG 转换**
```bash
# 先将占位符 SVG 转为 PNG（可在 Figma/Sketch 中替换为真实设计）
node scripts/convert-svg-to-png.js assets/icon-source-placeholder.svg assets/icon-source.png
```

**选项 C：在 Figma 导出**
1. 设计 1024×1024 的图标（无圆角，系统会自动添加）
2. 导出为 PNG，保存到 `assets/icon-source.png`

### 第二步：安装依赖

```bash
# 在项目根目录
npm install sharp --save-dev
```

### 第三步：运行生成脚本

```bash
node scripts/generate-icons.js
# 或指定自定义源图片
node scripts/generate-icons.js path/to/my-icon.png
```

### 第四步：同步到 Capacitor

```bash
npx cap sync
```

---

## 生成的文件列表

### iOS（15 个尺寸）
```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
├── Icon-20.png          (20×20)
├── Icon-20@2x.png       (40×40)
├── Icon-20@3x.png       (60×60)
├── Icon-29.png          (29×29)
├── Icon-29@2x.png       (58×58)
├── Icon-29@3x.png       (87×87)
├── Icon-40.png          (40×40)
├── Icon-40@2x.png       (80×80)
├── Icon-40@3x.png       (120×120)
├── Icon-60@2x.png       (120×120)
├── Icon-60@3x.png       (180×180)
├── Icon-76.png          (76×76)
├── Icon-76@2x.png       (152×152)
├── Icon-83.5@2x.png     (167×167)
├── Icon-1024.png        (1024×1024) ← App Store 提交用
└── Contents.json
```

### Android（10 个尺寸 + 圆形变体）
```
android/app/src/main/res/
├── mipmap-mdpi/ic_launcher.png         (48×48)
├── mipmap-mdpi/ic_launcher_round.png   (48×48)
├── mipmap-hdpi/ic_launcher.png         (72×72)
├── mipmap-hdpi/ic_launcher_round.png   (72×72)
├── mipmap-xhdpi/ic_launcher.png        (96×96)
├── mipmap-xhdpi/ic_launcher_round.png  (96×96)
├── mipmap-xxhdpi/ic_launcher.png       (144×144)
├── mipmap-xxhdpi/ic_launcher_round.png (144×144)
├── mipmap-xxxhdpi/ic_launcher.png      (192×192)
└── mipmap-xxxhdpi/ic_launcher_round.png(192×192)
```

### PWA（8 个尺寸）
```
assets/icons/
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
└── icon-512x512.png
```

### App Store / Play Store
```
assets/
├── icon-source.png              (1024×1024 源文件)
└── play-store-icon-512.png      (512×512 Google Play 用)
```

---

## 图标设计建议

| 要求 | 说明 |
|------|------|
| 不加圆角 | iOS/Android 会自动添加 |
| 避免透明边距 | 图标应填满整个画布 |
| 简洁高辨识度 | 小尺寸（20px）时仍需清晰 |
| 避免文字 | 小尺寸下不可读 |
| 高对比度 | 深色/浅色主题都需要清晰 |

---

## 替换为真实设计

当你有了真实 Logo 后：
1. 将 1024×1024 PNG 保存为 `assets/icon-source.png`
2. 重新运行 `node scripts/generate-icons.js`
3. 运行 `npx cap sync`
4. 重新构建 App

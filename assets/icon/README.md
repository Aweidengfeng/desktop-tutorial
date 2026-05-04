# SummitLink App Icons

## 生成步骤
使用 `npx @capacitor/assets generate` 自动从 icon.svg 和 splash.svg 生成所有尺寸。

## iOS 需要的尺寸（已由 Capacitor 自动生成）
- 1024x1024 (App Store)
- 180x180 (@3x iPhone)
- 120x120 (@2x iPhone)
- 87x87, 80x80, 60x60, 58x58, 40x40, 29x29, 20x20

## Android 需要的尺寸
- 192x192 (xxxhdpi)
- 144x144 (xxhdpi)
- 96x96 (xhdpi)
- 72x72 (hdpi)
- 48x48 (mdpi)
- 36x36 (ldpi)

## 手动生成命令
```bash
npm install -g @capacitor/assets
capacitor-assets generate --ios --android
```

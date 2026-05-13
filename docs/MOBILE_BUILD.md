# Mobile Build Secrets & Release Trigger

## GitHub Secrets (Settings → Secrets and variables → Actions)

配置以下 Secrets（签名发布必需）：

- `IOS_CERTIFICATE_P12_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

## 生成 Base64（macOS）

```bash
# iOS certificate (.p12)
base64 -i cert.p12 -o cert.p12.b64

# iOS provisioning profile
base64 -i profile.mobileprovision -o profile.mobileprovision.b64

# Android keystore (.jks)
base64 -i release.keystore -o release.keystore.b64
```

把生成的 `.b64` 文件内容完整复制到对应 GitHub Secret。

## 触发发布签名构建

发布 tag 会触发签名构建流程：

```bash
git tag v1.4.0
git push origin v1.4.0
```

## 构建策略

- PR / 普通 push：无签名验证构建（用于编译验证，不依赖 secrets）
- `v*` tag：签名发布构建（有 secrets 时产出可发布 IPA / AAB）

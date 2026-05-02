# CDN 加速配置指南

本文档说明如何为 SummitLink 配置阿里云 CDN 加速，覆盖加速域名设置、OSS 联合加速、缓存规则、HTTPS 证书及回源鉴权。

---

## 1. 阿里云 CDN 控制台配置步骤

### 1.1 添加加速域名

1. 登录 [阿里云 CDN 控制台](https://cdn.console.aliyun.com)
2. 点击 **域名管理** → **添加域名**
3. 填写加速域名，例如 `cdn.summitlink.com`
4. 业务类型选择 **图片小文件**
5. 加速区域选择 **全球**（海外用户也可加速）

### 1.2 源站设置

| 源站类型 | 配置值 | 备注 |
|---------|--------|------|
| OSS 域名 | `summitlink-prod.oss-cn-hangzhou.aliyuncs.com` | 替换为实际 Bucket + Region |
| 自定义源站 | `https://summitlink.up.railway.app` | 直接回源到 Railway（非 OSS 场景） |

> **推荐方案**：图片存 OSS，CDN 以 OSS 为源站；API 仍走 Railway。

---

## 2. OSS + CDN 联合加速方案

```
用户请求 cdn.summitlink.com/uploads/xxx.jpg
        ↓
  阿里云 CDN 节点（就近命中缓存）
        ↓ 未命中
  OSS Bucket（summitlink-prod, oss-cn-hangzhou）
        ↓
  返回图片并在 CDN 节点缓存
```

### 配置步骤

1. 在 OSS Bucket 控制台开启 **绑定自定义域名**，绑定 `cdn.summitlink.com`
2. 在 CDN 域名管理中将源站配置为该 OSS Bucket 的默认域名
3. 在后端环境变量中设置：
   ```env
   OSS_BUCKET=summitlink-prod
   OSS_REGION=oss-cn-hangzhou
   OSS_CDN_HOST=https://cdn.summitlink.com
   ```
4. 上传图片后，`ossUpload.js` 中间件会自动生成 CDN URL

---

## 3. 缓存规则配置

| 资源类型 | 缓存时长 | Cache-Control |
|---------|---------|---------------|
| 图片（jpg/png/webp/gif） | 365 天 | `public, immutable` |
| JS / CSS / 字体 | 30 天 | `public, max-age=2592000` |
| HTML 页面 | 不缓存 | `no-cache, must-revalidate` |
| API 接口 | 不缓存 | `no-store, no-cache` |

在 CDN 控制台 → **缓存配置** → **缓存过期规则** 中配置：

```
规则1: 文件后缀 jpg,jpeg,png,gif,webp,svg,ico  →  过期时间 365天
规则2: 文件后缀 js,css,woff,woff2,ttf,eot      →  过期时间 30天
规则3: 目录 /api/                               →  过期时间 0秒（不缓存）
```

---

## 4. HTTPS 证书申请

### 方案 A：阿里云免费 DV 证书（推荐）

1. 进入 [阿里云 SSL 证书控制台](https://yundun.console.aliyun.com/?p=cas)
2. 购买 **免费证书**（每个账号每年 20 张）
3. 填写域名 `cdn.summitlink.com`，完成 DNS 验证
4. 签发后在 CDN 域名 → **HTTPS 配置** 中上传证书

### 方案 B：Let's Encrypt（自动续期）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d cdn.summitlink.com

# 自动续期（crontab）
0 3 * * * certbot renew --quiet
```

---

## 5. 回源鉴权配置

防止未经授权的直接访问 OSS 源站（绕过 CDN）：

1. 在 OSS Bucket → **防盗链** 中开启 **Referer 白名单**：
   ```
   https://cdn.summitlink.com
   https://summitlink.up.railway.app
   https://summitlink.com
   ```

2. 在 CDN 控制台 → **访问控制** → **URL 鉴权** 中启用 A 类型鉴权：
   - 生成鉴权 Key（保存到环境变量 `OSS_CDN_AUTH_KEY`）
   - 有效时长建议设为 1800 秒

3. OSS Bucket 权限改为**私有**，仅允许 CDN 回源 IP 段访问（在 Bucket Policy 中配置）

---

## 6. 性能优化建议

- 开启 **智能压缩**（CDN 控制台 → 性能优化）：Gzip + Brotli 双压缩
- 开启 **图片处理**（阿里云图片处理 IMG 服务）：自动 WebP 转换、缩略图
- 开启 **HTTP/2**（CDN 控制台 → HTTPS 配置）
- 配置 **预热**：部署后批量预热热门图片 URL，避免首次回源慢

---

## 7. 监控与告警

在阿里云 CDN 控制台 → **数据监控** 中配置：

| 监控指标 | 建议阈值 | 告警方式 |
|---------|---------|---------|
| 命中率 | < 90% 时告警 | 短信 + 邮件 |
| 带宽峰值 | > 1Gbps 时告警 | 短信 |
| 4xx/5xx 错误率 | > 1% 时告警 | 钉钉机器人 |
| 回源流量 | 突增 > 50% 时告警 | 短信 |

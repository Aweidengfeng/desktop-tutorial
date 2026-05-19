# 末登峰（中国大陆）腾讯云部署指南

## 主体信息
- 公司：末登峰（北京）科技有限公司
- 英文名：Modengfeng (Beijing) Technology Co., Ltd.
- 统一社会信用代码：91110112MAKCMPQ75F
- 注册地址：北京市通州区玉桥北里47号1层A2247号
- 法人：金洪源
- 经营范围：高危险性体育运动（攀岩）+ 互联网信息服务

## 腾讯云账号准备
1. 注册腾讯云账号（建议使用法人手机号 + 公司专用邮箱）
2. 完成企业实名认证（营业执照 + 法人微信扫脸），等待审核通过
3. 登录控制台确认账号类型显示为“企业用户”

## 域名 unsummit.cn
- ✅ 已在腾讯云购买
- 域名实名认证：使用末登峰企业主体，通常 1-3 天审核
- ICP 备案：需在购买中国大陆服务器后通过腾讯云备案系统提交

## 服务器购买（CVM）
- 控制台入口：https://console.cloud.tencent.com/cvm
- 推荐地域：北京三区
- 推荐规格：SA2.MEDIUM4（2核4G）
- 系统：Ubuntu 22.04 LTS
- 公网带宽：5Mbps 起，按实际峰值扩容
- 系统盘：50GB SSD
- 安全组：开放 `80/443/22`
- 预算：约 ¥130 / 月

## 数据库（TencentDB for PostgreSQL）
- 控制台入口：https://console.cloud.tencent.com/postgres
- 推荐规格：通用型 SA2 / 2核4G / 100GB SSD
- 数据库版本：PostgreSQL 14
- 连接地址格式：`postgresql://user:pass@host.tencentdb.com:5432/dbname`
- 网络建议：与 CVM 放在**同一 VPC + 同一子网**，仅走内网访问
- 安全组：只放行来自应用 CVM / 容器节点的 5432
- 备份策略：腾讯云默认 7 天自动备份，建议保留默认并开启慢查询监控
- 起步建议：先用单机版节省成本，后续再平滑升级高可用

## 对象存储（COS）
- 控制台入口：https://console.cloud.tencent.com/cos
- 创建 Bucket：`unsummit-cn-{APPID}`
- 推荐地域：北京（`ap-beijing`）或上海（`ap-shanghai`）
- 权限建议：**公有读 / 私有写** 或全私有 + CDN 回源鉴权（更稳妥）
- 推荐绑定 CDN 自定义域名：如 `cdn.unsummit.cn`
- API 密钥：访问管理 → API 密钥管理 → 创建仅限 COS 权限的子账号密钥
- 默认源站域名：`https://{bucket}.cos.{region}.myqcloud.com`
- 生产建议：优先配置 `COS_CDN_DOMAIN`，未配置时系统自动回退到源站域名

## ICP 备案
- 备案系统：https://console.cloud.tencent.com/beian
- 前提：已购买腾讯云中国大陆服务器 / 负载均衡产品
- 提交流程：
  1. 填写主体信息（末登峰）
  2. 填写网站信息（`unsummit.cn` / `www.unsummit.cn` / `api.unsummit.cn`）
  3. 上传营业执照、法人身份证、负责人信息等材料
  4. 完成腾讯云初审（通常 1-3 个工作日）
  5. 等待北京管局审核（通常 15-20 个工作日）
- 备案通过后，将备案号写入 `ICP_NUMBER`

## 公安网安备案
- ICP 备案号下发后 30 天内办理
- 网址：https://www.beian.gov.cn
- 主体信息、负责人信息需与 ICP 备案保持一致

## 部署步骤
1. 登录 CVM：`ssh ubuntu@your-cvm-ip`
2. 安装 Docker Engine 与 Docker Compose Plugin
3. 克隆仓库并进入项目目录
4. 创建 `.env.cn`，填写下方中国区环境变量
5. 启动服务：
   ```bash
   docker compose -f docker-compose.cn.yml --env-file .env.cn pull
   docker compose -f docker-compose.cn.yml --env-file .env.cn up -d
   ```
6. 在后端容器内执行 Prisma 迁移：
   ```bash
   docker compose -f docker-compose.cn.yml exec backend npx prisma migrate deploy --schema backend/prisma/schema.prisma
   ```
7. 按备案状态切换 Nginx 模式（见下方“ICP 备案期间 / 备案通过后切换”）
8. 将 `api.unsummit.cn` / `www.unsummit.cn` 解析到 CVM 公网 IP 或腾讯云 CLB
9. 验证 `/api/health`、`/api/region`、上传接口与备案号展示

## ICP 备案期间 / 备案通过后切换

- `deploy/tencent/.env.example` 默认提供：
  - `SSL_ENABLED=false`
  - `COMPOSE_PROFILES=${SSL_ENABLED}`（自动跟随 `SSL_ENABLED`，通常无需手改）

### 备案期间（HTTP）

1. 在 `.env` 中确认：
   ```env
   SSL_ENABLED=false
   ```
2. 重启服务：
   ```bash
   docker compose up -d --build --remove-orphans
   ```
3. 此模式只监听 `80`，且不会重定向到 HTTPS（满足 ICP 核查）。

### 备案通过后（HTTPS）

1. 在 `.env` 中改一行：
   ```env
   SSL_ENABLED=true
   ```
2. 重启服务：
   ```bash
   docker compose up -d --build --remove-orphans
   ```
3. 此模式会启用 `80 -> 443` 跳转，并监听 `443` 提供 HTTPS。

## 环境变量清单（CN）

### 基础运行
- `NODE_ENV=production`
- `PORT=8080`
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- `DATABASE_PROVIDER=postgresql`
- `DATABASE_URL_CN=postgresql://user:pass@host.tencentdb.com:5432/dbname`
- `DATABASE_URL`（兼容旧逻辑，可直接与 `DATABASE_URL_CN` 相同）
- `UPLOADS_DIR=/app/uploads`

### 腾讯云 COS
- `COS_BUCKET=unsummit-cn-1234567890`
- `COS_REGION=ap-beijing`
- `COS_SECRET_ID`
- `COS_SECRET_KEY`
- `COS_CDN_DOMAIN=https://cdn.unsummit.cn`（可选）
- `TENCENT_CLOUD_APPID=1234567890`
- `TENCENT_CLOUD_REGION=ap-beijing`

### 海外对象存储（保持原有 US 路径）
- `S3_BUCKET_US`
- `S3_REGION_US`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 中国大陆业务配置
- `API_BASE_URL_CN=https://api.unsummit.cn`
- `ICP_NUMBER`
- `ICP_POLICE_NUMBER`
- `WECHAT_APP_ID`
- `WECHAT_MCH_ID`
- `WECHAT_API_KEY_V3`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `DEPLOY_TARGET=tencent-cloud`

## Docker Compose 规划（当前 P0）
- 应用镜像：`ccr.ccs.tencentyun.com/unsummit/backend:latest`
- Nginx 镜像：`ccr.ccs.tencentyun.com/library/nginx:stable-alpine`
- 推荐部署形态：一台 CVM 自建 Docker，后续再评估迁移到 TKE
- 如需使用腾讯云容器镜像仓库：优先开通 **TCR / CCR**，并为拉取节点配置登录凭证

## TKE（P1 follow-up）
后续如切换到腾讯云 Kubernetes，可在 `k8s/cn/` 中补充以下清单：
- `deployment.yaml`
- `service.yaml`
- `ingress.yaml`（对接腾讯云 CLB）
- `configmap.yaml`

当前阶段先以 `docker-compose.cn.yml` 为准，不在本次变更中新增 K8s 清单。

## 监控与日志
- 腾讯云云监控（CM）：监控 CVM / CLB / PostgreSQL 指标
- 腾讯云 CLS：采集 Nginx 与应用日志
- 告警渠道：企业微信机器人 / 短信 / 邮件

## 灾备建议
- TencentDB 自动备份：保留默认 7 天
- COS 跨区域复制：按需开启（可选）
- 应用层：升级前手动保留数据库快照 + `.env.cn` 备份

## 腾讯云资源与预算

| 资源 | 配置 | 月费 |
|---|---|---:|
| CVM（云服务器） | SA2.MEDIUM4（2核4G）/ 北京三区 | 约 ¥130 |
| TencentDB for PostgreSQL | 通用型 2核4G 100GB | 约 ¥350 |
| COS（对象存储） | 标准存储 100GB + 100GB 流量 | 约 ¥20 |
| CLB（负载均衡） | 应用型 | 约 ¥150 |
| CDN | 按量计费 | ¥0.21 / GB |
| SSL 证书 | DV 免费版 | ¥0 |
| 域名 `.cn`（已买） | unsummit.cn | ¥29 / 年 |
| ICP 备案 | 免费 | ¥0 |
| **月度合计** |  | **约 ¥650 / 月起** |

## 上线前检查
- [ ] 腾讯云企业实名认证通过
- [ ] `unsummit.cn` 实名认证通过
- [ ] CVM / TencentDB / COS / CDN 已创建并位于正确地域
- [ ] `.env.cn` 已填写并仅保存在安全位置
- [ ] COS 自定义 CDN 域名已完成 CNAME 与 HTTPS
- [ ] `DATABASE_URL_CN` 可从应用容器内通过内网连通
- [ ] ICP 备案号、公安备案号已补齐到生产环境变量
- [ ] `/api/health`、图片上传、微信/支付宝配置已手工验收

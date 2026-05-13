# 中国大陆部署指南（阿里云）

## 主体信息
- 公司：未登峰（北京）科技有限公司
- 统一社会信用代码：91110112MAKCMPQ75F
- 注册地址：北京市通州区玉桥北里47号1层A2247号
- 法人：金洪源
- 经营范围（关键）：高危险性体育运动（攀岩）+ 互联网信息服务

## ICP 备案准备
- [ ] 域名 `unsummit.cn` 在阿里云完成企业实名认证（1-3 天）
- [ ] 准备材料：营业执照、法人身份证、法人手持身份证照、企业座机、网站负责人手机
- [ ] 阿里云寄幕布拍照（3-5 天）
- [ ] 提交备案到北京管局（15-20 工作日）
- [ ] 拿到 ICP 备案号 → 填入 `ICP_NUMBER` 环境变量
- [ ] 公安部网安备案（拿到 ICP 后 30 天内）

## 阿里云资源清单
- ECS（建议 2核4G / 北京可用区F）：约 ¥120/月
- RDS PostgreSQL 14（基础版 2核4G）：约 ¥400/月
- OSS（标准存储 100GB）：约 ¥12/月
- SLB（应用型 1）：约 ¥210/月
- CDN（按流量）：约 ¥0.24/GB
- 域名 .cn：¥38/年
- SSL 证书（免费版 DV）：¥0

预算：约 ¥750/月起

## 部署步骤（备案下来后）
1. 采购 ECS、RDS、OSS、SLB、CDN 并完成安全组放行（80/443/22）。
2. 在 ECS 上安装 Docker 与 Docker Compose，并拉取仓库代码。
3. 配置 `.env.cn`（见下方变量清单），确保 `DATABASE_URL_CN` 指向阿里云 RDS。
4. 执行：
   ```bash
   docker compose -f docker-compose.cn.yml --env-file .env.cn pull
   docker compose -f docker-compose.cn.yml --env-file .env.cn up -d
   ```
5. 进入后端容器执行 Prisma 迁移：
   ```bash
   docker compose -f docker-compose.cn.yml exec backend npx prisma migrate deploy --schema backend/prisma/schema.prisma
   ```
6. 反向代理层（Nginx/SLB）配置 HTTPS 与 `X-Forwarded-*` 头，并开启访问日志留存 60 天。
7. 验证：
   - `/api/health` 返回 `region=cn`
   - `/api/region` 返回微信/支付宝可用
   - `X-Region` 响应头正确

## 环境变量（CN 必需）
- `DATABASE_URL_CN`：中国区数据库连接（RDS PostgreSQL）
- `DATABASE_URL_US`：海外数据库连接（可选，默认回落 `DATABASE_URL`）
- `DATABASE_URL`：默认数据库连接（兼容旧逻辑）
- `API_BASE_URL_CN`：中国区 API 域名
- `OSS_BUCKET` / `OSS_REGION` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`
- `OSS_CDN_HOST`：OSS CDN 域名
- `WECHAT_APP_ID` / `WECHAT_MCH_ID` / `WECHAT_API_KEY_V3`
- `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY`
- `ICP_NUMBER` / `ICP_POLICE_NUMBER`
- `DEPLOY_TARGET=aliyun`

> 说明：本 PR 合并后，在未设置 `DATABASE_URL_CN` 时会自动回落到现有 `DATABASE_URL`，生产行为保持不变。

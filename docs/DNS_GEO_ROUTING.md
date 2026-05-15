# DNS 智能分流配置指南

> **文档目的**：说明如何为 SummitLink 配置智能 DNS，将大陆 IP 路由到腾讯云上海节点，将海外 IP 路由到 Railway 节点。

---

## 一、架构总览

```
用户访问 summitlink.app
         │
         ▼
   Cloudflare DNS
         │
    ┌────┴────┐
    │ IP 检测  │
    └────┬────┘
         │
   ┌─────┴──────┐
   ▼            ▼
CN 用户       海外用户
49.234.163.103  Railway URL
（腾讯云上海）  （海外节点）
```

---

## 二、方案 A：Cloudflare Workers 免费方案（推荐）

### 前置条件
- 域名已转入 Cloudflare（NS 记录指向 Cloudflare）
- 免费计划即可（Workers 每日 100k 次请求免费额度）

### 步骤 1：创建 DNS A 记录

在 Cloudflare Dashboard → DNS → Records 中添加：

| 类型 | 名称 | 值 | 代理状态 |
|------|------|-----|--------|
| A | `@` (summitlink.app) | `49.234.163.103` | 🟠 已代理 |
| A | `api-cn` | `49.234.163.103` | 🟠 已代理 |
| CNAME | `www` | `summitlink.app` | 🟠 已代理 |

> ⚠️ **重要**：Railway 的 IP 不需要单独配置 A 记录，Workers 会动态转发。

### 步骤 2：创建 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create application** → **Create Worker**
3. 命名为 `summitlink-geo-router`
4. 将 `scripts/cloudflare-worker-geo-router.js` 的内容粘贴到编辑器
5. 点击 **Save and Deploy**

### 步骤 3：配置 Worker 路由

在 **Workers & Pages** → 选择你的 Worker → **Settings** → **Triggers** → **Add Route**：

| 路由 | Worker |
|------|--------|
| `summitlink.app/*` | `summitlink-geo-router` |
| `www.summitlink.app/*` | `summitlink-geo-router` |

### 步骤 4：设置 Worker 环境变量

在 Worker **Settings** → **Variables** → **Environment Variables**：

| 变量名 | 值 |
|--------|-----|
| `CN_BACKEND` | `http://49.234.163.103` |
| `RAILWAY_BACKEND` | `https://your-app.railway.app`（替换为实际 URL）|

---

## 三、方案 B：Cloudflare Geo Steering（Pro Plan，$20/月）

如果升级到 Cloudflare Pro，可以用 Traffic Steering + Geo Routing 无需 Workers：

1. Dashboard → DNS → 开启 **Load Balancing**（额外 $5/月）
2. 创建 **Load Balancer**，添加两个 Origin Pool：
   - Pool CN：`49.234.163.103`，Health Check on `/api/health`
   - Pool Global：Railway URL，Health Check on `/api/health`
3. **Traffic Steering** 选择 **Geo**：
   - 中国大陆 → Pool CN
   - 其他所有地区 → Pool Global

---

## 四、方案 C：腾讯 DNSPod 智能解析（免费备用）

> **适用场景**：不想用 Cloudflare，或域名在腾讯 DNSPod 管理。

### 前提
- 域名 NS 已切换到 DNSPod（ns1.dnsv5.com / ns2.dnsv5.com）
- 需要 DNSPod 免费版或以上（免费版已支持境内/境外线路）

### 配置步骤

1. 登录 [DNSPod 控制台](https://console.dnspod.cn/dns)
2. 选择域名 `summitlink.app` → **添加记录**

| 主机记录 | 记录类型 | 线路类型 | 记录值 | TTL |
|---------|---------|---------|-------|-----|
| `@` | A | 境内 | `49.234.163.103` | 600 |
| `@` | A | 境外（默认） | `1.2.3.4`（Railway IP） | 600 |
| `api-cn` | A | 默认 | `49.234.163.103` | 600 |

> 💡 Railway 不直接提供静态 IP。如需 A 记录可先在 Cloudflare 代理，或使用 CNAME（DNSPod 企业版支持 CNAME 境外线路）。

---

## 五、ICP 备案说明（重要）

### 法规要求
根据《互联网信息服务管理办法》：
> **境内服务器提供服务的，域名须完成 ICP 备案**，否则工信部有权要求 ISP 关闭端口。

### 当前策略（备案期间）

| 域名 | 用途 | 是否需要备案 |
|------|------|------------|
| `summitlink.app` | 主域名（境外用户访问 Railway） | ❌ 无需（境外服务器） |
| `api-cn.summitlink.app` | 境内临时入口（备案期间） | ✅ 需要（指向境内服务器） |

**备案期间临时方案**：
- 将 `summitlink.app` 全部流量先走 Railway（境外），不经腾讯云
- 使用 `api-cn.summitlink.app` 作为境内入口（三级域名无需单独 ICP 证，复用主域名备案号）
- 待 ICP 备案下来（约 20 个工作日）后，再切换智能分流

### ICP 备案申请流程
1. 登录 [腾讯云 ICP 备案](https://console.cloud.tencent.com/beian)
2. 选择"新增网站"→ 填写主域名 `summitlink.app`
3. 上传境内公司营业执照 + 法人身份证
4. 腾讯云初审 → 工信部终审（合计约 10-20 个工作日）
5. 取得备案号（格式：粤ICP备XXXXXXXX号）后，在 Footer 显示

---

## 六、健康检查 URL

| 节点 | 健康检查 URL |
|------|-------------|
| 腾讯云上海 | `http://49.234.163.103/api/health` |
| Railway 海外 | `https://your-app.railway.app/api/health` |
| 临时 CN 入口 | `https://api-cn.summitlink.app/api/health` |

---

## 七、自动化脚本

本目录提供两个脚本：

- `scripts/cloudflare-geo-dns.sh` — 用 Cloudflare API 自动创建 DNS 记录
- `scripts/cloudflare-worker-geo-router.js` — Cloudflare Worker 地理分流脚本

使用方法见各脚本文件顶部的说明注释。

---

> 📝 **维护注意**：Railway URL 变更后需同步更新 Worker 的 `RAILWAY_BACKEND` 环境变量。

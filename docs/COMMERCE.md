# SummitLink 商业化功能指南

> **适用版本：** B2 阶段（商业资质审核 + 向导服务 + 俱乐部活动报名）
> **更新日期：** 2026-04-20

---

## 一、整体架构

SummitLink 商业化模块分为三个层次：

```
平台（管理员）
  ├─ 审核向导 / 俱乐部商业资质
  │    └─ 通过后解锁收费服务发布权限
  │
向导 / 俱乐部
  ├─ 向导：发布"向导服务"（带队攀登、培训、远征、咨询）
  └─ 俱乐部：发布"俱乐部活动 / 商业套餐"
       └─ 活动状态管理 + 报名列表查看
  │
用户（消费者）
  ├─ 浏览向导服务 → 预约 → 支付 → 订单管理
  └─ 浏览俱乐部活动 → 报名 → 支付 → 订单管理
```

---

## 二、商业资质认证

### 2.1 向导商业资质

**流程：**
1. 向导在个人资料页面或向导详情页点击"申请商业资质认证"
2. 提交材料：营业执照 URL、营业执照号、保险证书 URL、银行账户信息
3. 调用 `POST /api/guides/:id/commercial-apply`
4. 管理员在 admin.html → "向导商业资质" 页面审核
5. 审核通过后，向导的 `commercial_verified = 1`，可发布收费服务

**API：**
```
POST /api/guides/:id/commercial-apply
Authorization: Bearer <token>
Body: {
  business_license_url: string,   // 营业执照图片 URL
  business_license_no: string,    // 营业执照号
  insurance_cert_url: string,     // 保险证书 URL
  bank_account_name: string,      // 银行账户名
  bank_account_no: string,        // 银行账号
  bank_name: string               // 开户银行
}
```

### 2.2 俱乐部商业资质

与向导类似，调用 `POST /api/clubs/:id/commercial-apply`，由俱乐部创始人发起，管理员在 admin.html → "俱乐部商业资质" 页面审核。

**状态流转：**
```
none → pending（申请后）→ approved（审核通过）
                        → rejected（审核驳回）
                        → need_info（需补充材料）
```

---

## 三、向导服务

### 3.1 向导发布服务

向导（已通过商业资质认证）可在向导详情页发布服务：
- **服务类型：** `guided_climb`（带队攀登）、`training`（培训）、`expedition`（远征）、`consult`（咨询）
- **计价方式：** `per_day`（按天）、`per_person`（按人）、`per_session`（按次）
- **限制：** 价格 > 0 的服务需 `commercial_verified = 1`，否则返回 `422 { error: "commercial_not_verified" }`

**发布 API：**
```
POST /api/guides/:guideId/services
Authorization: Bearer <token>
Body: {
  title: string,             // 服务标题
  type: string,              // guided_climb / training / expedition / consult
  mountain: string,          // 主要山峰
  region: string,            // 地区
  price: number,             // 价格（0 = 免费）
  price_unit: string,        // per_day / per_person / per_session
  duration_days: number,     // 服务天数
  max_clients: number,       // 最多客户数
  difficulty: string,        // 难度
  description: string        // 详细描述
}
```

### 3.2 用户预约服务

1. 用户打开向导详情页 → 查看"服务与价格"区块
2. 点击"立即预约" → 弹出预约表单
3. 填写紧急联系人（姓名 + 电话）+ 勾选免责协议
4. 提交 → 系统创建 `guide_service_orders` 记录（状态：`pending_payment`）
5. 用户前往"我的订单 → 向导服务"完成支付

**预约 API：**
```
POST /api/guides/:guideId/services/:id/book
Authorization: Bearer <token>
Body: {
  emergency_contact_name: string,
  emergency_contact_phone: string,
  agreed_waiver: true,
  waiver_version: "1.0",
  notes: string  // 可选备注
}
Response: { order_no, order }
```

---

## 四、俱乐部活动

### 4.1 俱乐部发布活动

俱乐部创始人可在俱乐部详情页管理活动：
- **活动类型：** `activity`（普通活动）/ `package`（商业套餐）
- **商业套餐：** 价格 > 0 时需俱乐部通过商业资质认证

**俱乐部管理面板（创始人专属）：**
- 发布活动/套餐（`+ 发布活动/套餐` 按钮）
- 活动列表与报名管理（查看每个活动的报名名单 + 上/下线操作）
- 申请商业资质认证

### 4.2 用户报名活动

1. 用户打开俱乐部详情页 → 活动卡片点击"立即报名"
2. 弹出报名表单：活动信息 + 紧急联系人 + 免责协议
3. 提交 → 创建 `activity_orders` 记录（状态：`pending_payment`）
4. 用户前往"我的订单 → 俱乐部活动"完成支付

**报名 API：**
```
POST /api/clubs/:clubId/activities/:actId/enroll
Authorization: Bearer <token>
Body: {
  emergency_contact_name: string,
  emergency_contact_phone: string,
  agreed_waiver: true,
  waiver_version: "1.0"
}
Response: { order_no, order }
```

---

## 五、订单管理

### 5.1 用户端"我的订单"三个子 Tab

| Tab | 数据来源 | API |
|-----|--------|-----|
| 攀峰订单 | `expedition_orders` | `/api/orders` |
| 俱乐部活动 | `activity_orders` | `/api/activity-orders/my` |
| 向导服务 | `guide_service_orders` | `/api/guide-service-orders/my` |

### 5.2 订单状态机（通用）

```
pending_payment
    ↓ pay
  paid
    ↓ cancel / refund-request
cancelled / refund_requested
    ↓ (退款完成)
refunded
```

### 5.3 可用操作

| 当前状态 | 可执行操作 |
|---------|----------|
| `pending_payment` | 支付、取消 |
| `paid` | 取消、申请退款 |
| `refund_requested` | — （等待处理）|
| `cancelled` / `refunded` | — |

---

## 六、平台手续费

| 订单类型 | 手续费率 | 备注 |
|---------|--------|------|
| 攀峰订单 | 1.5% | mock 支付，B3 阶段对接真实支付 |
| 俱乐部活动 | 1.5% | 同上 |
| 向导服务 | 1.5% | 同上 |

---

## 七、管理后台（admin.html）

新增两个审核 Tab：

| Tab | 路由 | 数据源 |
|-----|------|------|
| 俱乐部商业资质 | `page = 'club-commercial'` | `GET /api/admin/clubs/commercial` |
| 向导商业资质 | `page = 'guide-commercial'` | `GET /api/admin/guides/commercial` |

审核操作通过"商业资质审核抽屉"完成，支持三种操作：
- ✅ **通过**（`approve`）：设置 `commercial_verified = 1`，发送通知
- ❌ **驳回**（`reject`）：设置 `commercial_verified = 0`，填写原因
- 📋 **需补充**（`need_info`）：保留申请，通知补充材料

---

## 八、数据库表（参考）

| 表名 | 说明 |
|------|------|
| `guide_services` | 向导服务项目 |
| `guide_service_orders` | 向导服务预约订单 |
| `club_activities` | 俱乐部活动 |
| `activity_orders` | 俱乐部活动报名订单 |
| `guides.commercial_status` | 向导商业资质状态（none/pending/approved/rejected/need_info）|
| `clubs.commercial_status` | 俱乐部商业资质状态 |

详见 `backend/db/database.js` 迁移代码。

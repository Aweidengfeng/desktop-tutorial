# Merchant Onboarding Guide  
# 商家入驻指南

**Platform:** Unsummit / 末登峰  
**Version:** 1.0  
**Last Updated:** 2026-05

---

## Table of Contents

1. [Overview / 概述](#overview)
2. [Who Can Apply / 申请资格](#who-can-apply)
3. [Registration Flow / 注册流程](#registration-flow)
4. [KYC & Document Requirements / KYC 和材料要求](#kyc)
5. [Review Process & SLA / 审核流程与时效](#review-process)
6. [After Approval / 审核通过后](#after-approval)
7. [Required Qualifications by Type / 各类型资质要求](#qualifications)
8. [FAQ / 常见问题](#faq)

---

## 1. Overview / 概述

Unsummit / 末登峰 is a two-sided marketplace connecting climbers with certified mountain guides and clubs. Guides and clubs list their own routes and set their own prices — the platform provides transaction infrastructure, KYC verification, and escrow payment.

末登峰是连接攀登者与认证向导/俱乐部的双边市场。向导和俱乐部**自主**上架路线、自主定价，平台只提供交易撮合、KYC 资质审核和资金托管服务。

**Two legal entities / 双主体运营：**
- 🇺🇸 International: **Unsummit Technology Limited**
- 🇨🇳 Mainland China: **末登峰（北京）科技有限公司** | 统一社会信用代码：`91110112MAKCMPQ75F`

---

## 2. Who Can Apply / 申请资格

### Guides / 向导

| Region | Requirements |
|--------|-------------|
| 🇺🇸 US/International | IFMGA / UIAGM / AMGA / BMG / ACMG / NZMGA certification **or** documented high-altitude experience |
| 🇨🇳 China | 中国登山协会（CMA）认证 L3+ / 高山协作员资格证 / 省级登山协会认证 |

### Clubs / 俱乐部

| Region | Requirements |
|--------|-------------|
| 🇺🇸 US/International | Business registration in country of operation |
| 🇨🇳 China | 营业执照（经营范围含体育服务/户外运动） + 法人身份证 |

---

## 3. Registration Flow / 注册流程

```
Step 1  →  Step 2  →  Step 3  →  Step 4  →  Step 5  →  Step 6
Register    Select      Fill        Upload      Submit      Wait for
Account     Region      Profile     Documents   for KYC     Approval
           (CN/US)                             Review     (24-72 hrs)
```

### Step 1 — Register / 注册账号

- Email or phone registration
- Verify via OTP (email / SMS)
- Optional: enter invite code (automatically tags as `seed` tier + 0% commission for first 3 orders)

### Step 2 — Select Region / 选择区域

- **CN** — routes primarily for Chinese domestic market, WeChat Pay, CNY pricing
- **US** — routes for international market, Stripe, USD pricing

### Step 3 — Fill Profile / 完善资料

**Guides / 向导：**
- Full legal name / 真实姓名
- Nationality & resident country / 国籍和常驻地
- Languages spoken / 使用语言
- Years of guiding experience / 从业年限
- Climbing résumé (peaks summited, notable expeditions) / 攀登履历
- Short bio (zh + en) / 中英简介

**Clubs / 俱乐部：**
- Club legal name / 俱乐部正式名称
- Founded year / 成立年份
- Main operating region / 主营山域
- Contact information / 联系方式

### Step 4 — Upload Documents / 上传材料

See [Section 4](#kyc) for full requirements.

### Step 5 — Submit / 提交审核

After document upload:
1. Click **"Submit for Review"**
2. Status changes to `kyc_review`
3. You will receive an email confirmation

### Step 6 — Wait / 等待结果

- Standard SLA: **24–72 hours** (business days)
- Complex cases (overseas certs needing verification): up to **5 business days**
- Notification: email + in-platform notification

---

## 4. KYC & Document Requirements / KYC 和材料要求

### All Applicants / 所有申请者

| Document | Format | Notes |
|----------|--------|-------|
| Government-issued ID / 政府颁发的证件 | JPG/PNG/PDF ≤ 10 MB | Passport preferred for international guides; 居民身份证 for CN |
| Photo with ID (selfie) / 手持证件自拍 | JPG/PNG ≤ 5 MB | Face clearly visible, same day |

### Guides / 向导追加材料

| Document | Required? | Notes |
|----------|-----------|-------|
| Mountain guide certification / 向导资质证书 | ✅ Required | IFMGA card, CMA certificate, etc. |
| First-aid / WFR / WEMT certificate / 急救资质 | ✅ Required | Valid (not expired) |
| Insurance certificate / 职业责任险证明 | ✅ Strongly recommended | Platform may waive for new applicants with invite code |
| Health certificate / 体检证明 | Optional | Recommended for 8000 m+ specialists |

### Clubs / 俱乐部追加材料

| Document | Required? | Notes |
|----------|-----------|-------|
| Business license / 营业执照 | ✅ Required | Valid and within scope |
| Legal representative ID / 法人身份证 | ✅ Required | Both sides |
| Bank account (corporate) / 对公银行账户 | ✅ Required | For payout binding |
| Club roster (guide members) / 旗下向导名单 | Optional | Can be added after approval |

---

## 5. Review Process & SLA / 审核流程与时效

```
Submitted  →  Admin Queue  →  Document Check  →  Cert Verification  →  Decision
                              (auto-OCR assist)   (manual cross-check)   ↓         ↓
                                                                        Pass    Reject
                                                                          ↓         ↓
                                                                        Active   Email with
                                                                                 reason +
                                                                                 resubmit link
```

### SLA Targets

| Case | Target |
|------|--------|
| Standard guide (domestic cert) | 24 hours |
| International guide (IFMGA/UIAGM) | 48 hours |
| Club application | 48–72 hours |
| Resubmission after rejection | 24 hours |

### Rejection Reasons

Common rejection reasons (with suggested fixes):

| Reason | Fix |
|--------|-----|
| Certificate expired / 证书过期 | Renew and upload new cert |
| Document unclear / 材料不清晰 | Re-photograph with better lighting |
| Business scope mismatch / 营业范围不符 | Provide scope extension documentation |
| Missing emergency contact / 缺少紧急联系人 | Complete profile and resubmit |

---

## 6. After Approval / 审核通过后

Once approved (`status = active`):

1. **Set up payout account / 绑定收款账户**
   - US: Complete Stripe Connect Express onboarding (takes ~10 min)
   - CN: Bind WeChat merchant number / Alipay account

2. **Create your first route / 创建第一条路线**
   - Go to Route Management → New Route
   - Routes are in `draft` status until submitted for route review

3. **Route review / 路线审核**
   - Platform reviews all new routes before publishing (usually ≤ 24 hours)
   - Modifications to published routes also require re-review

4. **Start receiving bookings / 开始接单**
   - Platform will notify you via email + app notification

---

## 7. Required Qualifications by Type / 各类型资质要求

### 7.1 International Certifications / 国际认证

| Cert | Issuing Body | Notes |
|------|-------------|-------|
| IFMGA | International Federation of Mountain Guides Associations | Highest international standard |
| UIAGM | Union Internationale des Associations de Guides de Montagne | Equivalent to IFMGA |
| AMGA | American Mountain Guides Association | US-specific |
| BMG | British Mountain Guides | UK-specific |
| ACMG | Association of Canadian Mountain Guides | Canada-specific |
| NZMGA | New Zealand Mountain Guides Association | NZ-specific |

### 7.2 China Certifications / 中国认证

| Cert | Issuing Body | Level |
|------|-------------|-------|
| CMA Guide (中登协向导) | Chinese Mountaineering Association | L3 minimum, L5 for "certified" rate |
| 高山协作员 (Alpine Expedition Assistant) | CMA | 高级 (Senior) for "certified" rate |
| Provincial Level | Provincial mountaineering associations | Accepted, standard rate |

---

## 8. FAQ / 常见问题

**Q: Can I apply without a formal certification?**  
A: Yes, for the "standard" tier. You will need documented experience (expedition logs, references). Certified tier requires formal certification.

**Q: 我没有 IFMGA 证书，可以申请吗？**  
A: 可以，这属于标准向导层级。需要提供可证实的攀登经历（远征记录、推荐信）。认证向导层级需要正式资质证书。

**Q: How long does payout take?**  
A: US (Stripe Connect): weekly automatic transfer. CN (WeChat split): upon trip completion confirmation.

**Q: Can I apply for both CN and US regions?**  
A: Currently separate applications. Cross-region listing coming in a future update.

**Q: What happens if my certification expires?**  
A: You will receive a 30-day advance warning. After expiry, account status changes to `suspended` until you upload a valid renewed cert.

**Q: Is there a listing fee?**  
A: No. The platform earns commission on completed bookings only. See [COMMISSION_POLICY.md](./COMMISSION_POLICY.md) for rates.

---

*For support: guides@unsummit.com (EN) | guides@modengfeng.cn (中文)*

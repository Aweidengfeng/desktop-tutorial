# Commission Policy / 佣金政策

**Platform:** Unsummit / 末登峰  
**Effective:** 2026-05  
**Policy Version:** 1.0

---

> **Transparency Commitment / 透明承诺**  
> We publish our commission rates openly to build trust with guides and clubs.  
> 我们公开佣金费率，以建立与向导和俱乐部的信任关系。

---

## Table of Contents

1. [Rate Summary / 费率汇总](#rates)
2. [How Tiers Work / 层级说明](#tiers)
3. [New Guide Promotion / 新手向导优惠](#new-guide)
4. [Certified Guide Discount / 认证向导折扣](#certified)
5. [Club Rates / 俱乐部费率](#club)
6. [Custom Rates / 个性化费率](#custom)
7. [How Commission Is Calculated / 佣金计算方式](#calculation)
8. [Temporary Promotional Rates / 临时活动费率](#promo)
9. [Rate Change Policy / 费率变更政策](#changes)

---

## 1. Rate Summary / 费率汇总

### 🇺🇸 US / International Region

| Merchant Type | Tier | Commission Rate | Notes |
|--------------|------|----------------|-------|
| Guide | New (first 3 orders) | **0%** | Automatic, no application needed |
| Guide | Standard | **12%** | Default after 3 completed orders |
| Guide | Certified (IFMGA/UIAGM/AMGA/BMG/ACMG/NZMGA) | **10%** | Automatically applied after cert verification |
| Club | All | **8%** | Applied to all club bookings |

**Payment gateway:** Stripe  
**Payout schedule:** Weekly automatic transfer  
**Minimum payout:** $100 USD  
**Currency:** USD

### 🇨🇳 CN / China Region

| Merchant Type | Tier | Commission Rate | Notes |
|--------------|------|----------------|-------|
| Guide | New (first 3 orders) | **0%** | Automatic, no application needed |
| Guide | Standard | **8%** | Default after 3 completed orders |
| Guide | Certified (CMA L5 / 高山协作员高级) | **10%** | Note: certified rate is higher in CN due to platform promotion value |
| Club | All | **6%** | Applied to all club bookings |

**Payment gateway:** WeChat Pay (primary) / Alipay (backup)  
**Payout schedule:** Upon trip completion confirmation  
**Minimum payout:** ¥100 CNY  
**Currency:** CNY

---

## 2. How Tiers Work / 层级说明

Commission tiers are **automatically determined** based on:

1. **Merchant type** (`guide` or `club`)
2. **Completed orders** (determines new/standard)
3. **Verified certifications** (determines certified tier)
4. **Admin override** (for special partnership agreements)

Priority order (highest to lowest):

```
admin custom_rate  →  club rate  →  guide_new (< 3 orders)  →  guide_certified  →  guide_standard
```

If a guide has both `completed_orders < 3` AND a certified credential, the `guide_new` rate (0%) applies — the promotion takes priority.

---

## 3. New Guide Promotion / 新手向导优惠

**Applies to:** All new guides in both regions  
**Duration:** First **3 completed** bookings  
**Rate:** 0% commission  
**Activation:** Automatic — no application required

This promotion exists to help guides establish their profile with their first reviews before the standard commission applies.

新手向导优惠自动适用于所有新注册向导，覆盖最初 **3 单已完成订单**，无需申请。鼓励向导积累首批评价。

---

## 4. Certified Guide Discount / 认证向导折扣

### US Region (10% vs. 12% standard)

Guides holding any of the following active, unexpired certifications:

| Certification | Issuing Body |
|--------------|-------------|
| IFMGA | International Federation of Mountain Guides Associations |
| UIAGM | Union Internationale des Associations de Guides de Montagne |
| AMGA | American Mountain Guides Association |
| BMG | British Mountain Guides |
| ACMG | Association of Canadian Mountain Guides |
| NZMGA | New Zealand Mountain Guides Association |

### CN Region (10% vs. 8% standard)

> Note: In the CN region, the certified rate (10%) is **higher** than the standard rate (8%). This reflects the platform's commitment to promoting safety — highly certified guides receive premium placement and marketing support, offsetting the higher rate.

| Certification | Level Required |
|--------------|---------------|
| 中国登山协会 (CMA) 向导证书 | L5 (最高级) |
| 高山协作员资格证 | 高级 |

---

## 5. Club Rates / 俱乐部费率

Clubs benefit from lower commission rates reflecting:
- Higher booking values (group orders)
- Lower per-transaction customer acquisition cost
- Established brand recognition

| Region | Club Rate |
|--------|----------|
| US | 8% |
| CN | 6% |

The club rate applies to all bookings through a club's listed routes, regardless of how many guides are assigned to the trip.

---

## 6. Custom Rates / 个性化费率

For strategic partnerships and high-volume merchants, the platform may offer custom commission rates:

- Negotiated with platform operations team
- Set per-merchant via admin console
- Applies in addition to any other tier logic (custom rate always wins if set)
- Disclosed in the merchant's individual agreement

To inquire: business@unsummit.com

---

## 7. How Commission Is Calculated / 佣金计算方式

For each completed booking:

```
gross_amount   = Total paid by user (before gateway fee)
platform_fee   = gross_amount × commission_rate  (rounded to 2 decimal places)
gateway_fee    = paid by platform (Stripe ~2.9% + $0.30; WeChat ~0.6%)
merchant_payout = gross_amount - platform_fee
```

**Example (US, standard guide, $1,000 expedition):**

| Item | Amount |
|------|--------|
| User pays | $1,000.00 |
| Platform commission (12%) | -$120.00 |
| Stripe gateway fee (est.) | paid by platform |
| **Guide receives** | **$880.00** |

**Example (CN, standard guide, ¥5,000 expedition):**

| Item | Amount |
|------|--------|
| User pays | ¥5,000.00 |
| Platform commission (8%) | -¥400.00 |
| WeChat fee (est.) | paid by platform |
| **Guide receives** | **¥4,600.00** |

---

## 8. Temporary Promotional Rates / 临时活动费率

During platform-wide promotions, reduced commission rates may apply:

- **例：** 11.11 双十一 — CN guides receive 0% for one week
- **例：** Black Friday — US guides and clubs receive 50% off standard rate
- Promotional periods and eligible merchants notified via in-platform announcement
- Promotions are funded by platform marketing budget, not by reducing merchant income
- The `commission_rate` recorded on each order reflects the actual rate applied

---

## 9. Rate Change Policy / 费率变更政策

- Any rate changes will be announced **30 days in advance**
- Existing confirmed bookings keep the rate at the time of booking
- Guides/clubs will receive email notification + in-platform banner
- Rates cannot be changed retroactively on completed orders

---

*For questions about your specific rate: finance@unsummit.com (EN) | caiwu@modengfeng.cn (中文)*

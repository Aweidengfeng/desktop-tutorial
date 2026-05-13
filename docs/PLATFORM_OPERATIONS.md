# Platform Operations Manual / 平台运营手册

**Platform:** Unsummit / 末登峰  
**Audience:** Platform Operations Team / 平台运营团队  
**Version:** 1.0  
**Last Updated:** 2026-05

---

## Table of Contents

1. [Admin Console Access / 后台访问](#access)
2. [Merchant KYC Review SOP / 商家 KYC 审核 SOP](#kyc-sop)
3. [Route Review SOP / 路线审核 SOP](#route-sop)
4. [Complaint & Dispute SOP / 投诉纠纷处理 SOP](#dispute-sop)
5. [Invite Code Management / 邀请码管理](#invite-codes)
6. [Featured Slots Management / 推荐位管理](#featured)
7. [GMV & Finance Metrics / GMV 和财务指标定义](#metrics)
8. [Commission Configuration / 佣金配置](#commission-config)
9. [Incident Response / 事故响应](#incidents)
10. [On-Call Checklist / 值班检查清单](#oncall)

---

## 1. Admin Console Access / 后台访问

**URL:** `/admin.html`  
**Authentication:** Admin account (is_admin = true in users table)

Default admin credentials are set via environment variables:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set in Railway / Tencent Cloud secrets>
```

⚠️ Change default password immediately on first login.

### Access Levels

| Role | Access |
|------|--------|
| Super Admin | Full access including commission config, user ban |
| Operations | KYC review, route review, dispute handling |
| Finance | GMV reports, payout records, read-only |

---

## 2. Merchant KYC Review SOP

### 2.1 Daily Review Queue

1. Open **Admin → Merchant Management → Pending KYC**
2. Queue is sorted by `created_at` ASC (first-come-first-served)
3. Target: clear queue daily within SLA (see below)

### 2.2 Review Steps

For each application:

1. **Identity Verification**
   - Open ID document image
   - Verify: name matches application, document not expired, photo clearly legible
   - For passport: check machine-readable zone (MRZ)

2. **Certification Verification**
   - Open certification document image
   - Verify: cert number, issuing body, expiry date
   - For IFMGA: check against https://www.ifmga.com/members (if accessible)
   - For CMA: check against CMA official registry

3. **Selfie Check**
   - Face matches ID document
   - Same person, not a photocopy

4. **Decision**
   - ✅ **Approve:** Click "Activate" → status → `active` → automated email sent
   - ❌ **Reject:** Select rejection reason → add custom note → click "Reject" → automated email with reason + resubmit link

### 2.3 Rejection Reason Templates

| Code | Template |
|------|---------|
| `id_expired` | 您提交的证件已过期，请上传有效期内的证件 |
| `id_unclear` | 证件照片不清晰，请在光线充足的环境下重新拍摄 |
| `cert_expired` | 您提交的资质证书已过期，请上传有效证书 |
| `cert_unrecognized` | 该认证机构不在我们的认可列表中，请联系support@modengfeng.cn |
| `selfie_mismatch` | 手持证件照与证件照片不符，请重新拍摄 |
| `biz_scope_mismatch` | 营业执照经营范围不包含户外运动/体育服务，请提供范围扩项证明 |

### 2.4 SLA Targets

| Application Type | Target |
|-----------------|--------|
| Standard guide (CN cert) | 24 hours |
| International guide | 48 hours |
| Club | 48–72 hours |
| Resubmission | 24 hours |

Escalate to team lead if unable to verify within SLA.

---

## 3. Route Review SOP

### 3.1 Review Queue

Admin → Route Review → Pending Review

Priority order: seed merchants first, then FIFO.

### 3.2 Review Checklist

For each route submission:

| Check | Pass Criteria |
|-------|--------------|
| **Price reasonableness** | Within ±3× market range for similar routes in same region |
| **Description accuracy** | No false claims about difficulty, altitude, includes |
| **Risk disclosure** | Altitude, weather risks, fitness requirements clearly stated |
| **Equipment list** | At minimum: helmet, harness, crampons for technical routes |
| **Image quality** | Min 3 images, ≥ 800px wide, no watermark violations |
| **Cancellation policy** | Must include at least "no refund within 7 days of departure" |

### 3.3 Rejection Reason Templates

| Code | Message |
|------|---------|
| `price_unreasonable` | 标价明显超出市场合理范围，请说明定价依据 |
| `description_misleading` | 路线描述含有不实信息（具体问题：___），请修正后重新提交 |
| `missing_risk_disclosure` | 缺少必要风险提示（高度/天气/体能要求），请补充 |
| `incomplete_equipment` | 装备清单不完整，请至少列出技术攀登必备装备 |
| `image_quality` | 图片质量不达标（模糊/数量不足/疑似侵权），请重新上传 |
| `no_cancellation_policy` | 缺少退订政策，最低要求：出发前 7 天内不退款 |

### 3.4 Batch Review

For high-volume periods, use batch approval for routes from verified high-reputation merchants (tier=seed, rating≥4.8, zero complaints).

---

## 4. Complaint & Dispute SOP

### 4.1 Incoming Complaint Types

| Type | Source | Priority |
|------|--------|---------|
| Safety incident | User | P0 — Respond within 1 hour |
| Guide no-show | User | P1 — Respond within 4 hours |
| Description mismatch | User | P2 — Respond within 24 hours |
| Payment dispute | User/Guide | P1 — Respond within 4 hours |
| Review gaming | System | P3 — Respond within 72 hours |

### 4.2 Dispute Resolution Flow

```
1. Complaint received → auto-acknowledge to user (email + notification)
2. Ops reviews both user complaint and guide response
3. Request evidence from both parties (photos, chat logs, booking records)
4. Decision (within SLA):
   - Full refund to user
   - Partial refund
   - No refund (close with explanation)
5. Arbitration actions (if applicable):
   - Guide warning (1st offense)
   - Commission penalty
   - Route suspension
   - Guide suspension / ban
6. Close ticket → notify both parties
```

### 4.3 Arbitration Tools

Available in Admin → Dispute Handling:

- **Partial Refund:** Set refund amount → trigger Stripe refund / WeChat refund
- **Warning:** Records warning on merchant profile; 3 warnings → auto-suspend
- **Route Suspend:** Sets expedition status to `paused`
- **Merchant Suspend:** Sets merchant status to `suspended`
- **Merchant Ban:** Sets merchant status to `banned` (irreversible, requires team lead approval)

---

## 5. Invite Code Management

### 5.1 Generating Codes

Admin → Invite Codes → Generate

Fields:
- **Code:** 6–8 uppercase alphanumeric (e.g., `IFMGA-001`, `SEED-EVE-2026`)
- **Region:** CN or US
- **Tier:** `seed` or `normal`
- **Expiry:** Optional
- **Notes:** Who is this for? (internal tracking)

Batch generation: up to 50 codes at once; export as CSV.

### 5.2 Seed Guide Benefits

Merchants who register with a `seed`-tier invite code automatically receive:
- `tier = 'seed'`
- `is_seed = true`
- First 3 orders at 0% commission (same as all guides)
- Priority placement in homepage seed guide slots

### 5.3 Featured Homepage Slots

- **US region:** 6 seed guide slots on homepage
- **CN region:** 6 seed guide slots on homepage
- Total: 12 slots across two regions
- Configured in Admin → Traffic → Featured Slots

---

## 6. Featured Slots Management

### 6.1 Slot Configuration

Admin → Traffic → Featured Slots

- Drag-and-drop ordering within each region
- Each slot: select merchant, show/hide, optional expiry date
- Changes take effect immediately (no cache to clear)

### 6.2 Banner Management

Admin → Traffic → Banners

- Title, subtitle, image URL, link target, gradient colors
- Active/inactive toggle
- Sort order (lower number = higher position)

### 6.3 Search Weight Configuration

Weights applied to route search ranking:

| Factor | Default Weight | Adjustable Range |
|--------|---------------|-----------------|
| Rating | 0.4 | 0.1–0.7 |
| Completion count | 0.3 | 0.1–0.6 |
| Platform recommendation | 0.2 | 0–0.5 |
| Recency | 0.1 | 0–0.3 |

---

## 7. GMV & Finance Metrics

### 7.1 Key Metrics Definitions

| Metric | Definition |
|--------|-----------|
| **GMV** | Gross Merchandise Value = sum of all `gross_amount` for completed orders in period |
| **Platform Revenue** | Sum of `platform_fee` for completed orders |
| **Net Platform Revenue** | Platform Revenue − gateway fees − refunds |
| **Payout Total** | Sum of `merchant_payout` transferred to merchants |
| **Pending Payout** | Orders in `payout_status = 'pending'` or `'scheduled'` |
| **Refund Rate** | Refunded orders / Total orders × 100% |
| **Dispute Rate** | Orders with dispute / Total completed orders × 100% |

### 7.2 Alert Thresholds

| Metric | Alert Trigger |
|--------|--------------|
| Daily GMV drop | >50% vs. same day last week |
| Dispute rate | >5% in any 7-day period |
| Payout failure rate | >1% |
| Failed payments | >10% in any hour |

### 7.3 Financial Reconciliation

Monthly reconciliation checklist:
- [ ] Stripe balance matches sum of pending platform fees
- [ ] WeChat MCH balance matches sum of unfrozen platform fees
- [ ] All `payout_status = 'paid'` have `payout_transfer_id`
- [ ] No orphaned `pending` payouts older than 30 days

---

## 8. Commission Configuration

### 8.1 Viewing Current Rates

Admin → Commission Config → Rate Table

Displays the current `COMMISSION_RATES` from `backend/lib/commission.js`.

### 8.2 Per-Merchant Override

Admin → Merchant → [Merchant] → Custom Rate

- Set `custom_rate` field on merchant record
- Enter as decimal: 0.05 for 5%
- Leave blank to use tier-based automatic rate
- Changes take effect on next new order

### 8.3 Bulk Rate Promotions

For temporary promotions:
1. Create promotion record with start/end dates and eligible merchant types
2. `getEffectiveRate()` checks for active promotions before returning rate
3. Admin logs all bulk rate changes (moderation_logs)

---

## 9. Incident Response

### 9.1 P0: Payment System Down

1. Check Stripe status: https://status.stripe.com
2. Check WeChat Pay status: https://pay.weixin.qq.com
3. If gateway down: enable maintenance mode banner
4. Notify affected merchants (automated if >30 min downtime)
5. After recovery: process any queued payout retries

### 9.2 P0: Data Breach Suspected

1. Immediately disable admin console external access
2. Notify CTO + legal
3. For CN: notify PIPL officer within 24 hours (if PII involved)
4. For US: notify legal for GDPR/CCPA assessment
5. Preserve logs, do not delete anything

### 9.3 P1: High Dispute Volume

Trigger: dispute rate >5% in any region in 7-day window

1. Identify top merchants by dispute count
2. Review recent route submissions from those merchants
3. Pause suspected routes pending re-review
4. Send warning to merchants

---

## 10. On-Call Checklist / 值班检查清单

Daily:
- [ ] Check pending KYC queue (target: 0 items older than 24h)
- [ ] Check pending route review queue (target: 0 items older than 24h)
- [ ] Check open dispute tickets (P0 and P1)
- [ ] Review failed payout records
- [ ] Spot-check GMV vs. previous day

Weekly:
- [ ] Review refund rate trend
- [ ] Review seed slot occupancy (all 12 slots filled?)
- [ ] Commission configuration audit (no unexpected custom rates)
- [ ] Financial reconciliation checklist

---

*Escalation: ops@unsummit.com | yunying@modengfeng.cn*

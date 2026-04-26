# Business Model

## Revenue Streams

SummitLink（巅峰探索）的商业逻辑是“内容社区获客 → 向导/俱乐部供给 → 商业攀登交易 → 保险/装备/救援/定制服务增收 → 数据与安全能力形成壁垒”。

### 1. Commission on Expeditions
- Guides and clubs earn `publisher_income` per order
- Platform takes `(1 - commission_rate)` of each transaction
- Default commission rate: 15% (`commission_rate = 0.15`)

### 2. Guide Services
- Guides list expeditions via `/api/expeditions` (`publisher_type='guide'`)
- Earnings tracked monthly via `/api/guide-console/earnings`
- Withdrawal requests via `/api/guide-console/withdraw`

### 3. Club Activities
- Clubs post activities via `/api/club-console/activities`
- Revenue tracked via `/api/club-console/finance`

### 4. Insurance & Customs
- Ancillary revenue from `/api/insurance` and `/api/customs` modules

## Investor Metrics
Access via `/investor` dashboard or `/api/investor/*` endpoints with `x-investor-token`.

Investor narrative APIs:
- `GET /api/investor/personas` — returns investor persona summaries.
- `GET /api/investor/narrative?persona=vc` — returns the selected persona narrative plus positioning, value proposition, highlights, risks, and milestones.

Key KPIs:
- **DAU/WAU/MAU** — engagement depth
- **GMV** — gross merchandise value
- **Order Completion Rate** — conversion quality
- **Summit Conversions** — unique product metric (users who actually summited)
- **SOS Response Count** — safety feature utilization

## Investor Personas

The same product should be explained differently depending on investor type:

### Angel Investors
- **Focus:** founding team, early users, niche opportunity, product prototype maturity.
- **Narrative:** SummitLink proves an underserved high-ticket outdoor market with a working product and early transaction loop.
- **Key proof:** registered users, community content, guide/club supply, complete user journey.

### Venture Capital
- **Focus:** market size, growth path, network effects, scalable marketplace economics.
- **Narrative:** SummitLink is an outdoor content community plus high-ticket service marketplace; more users, guides, clubs, routes, and safety data improve matching efficiency and trust.
- **Key proof:** DAU/WAU/MAU, GMV, order completion rate, summit conversions.

### Strategic Investors
- **Focus:** outdoor, tourism, insurance, gear, rescue, and club ecosystem synergy.
- **Narrative:** SummitLink can become the digital channel connecting high-intent outdoor users with industry partners.
- **Key proof:** GMV, top peaks/guides, insurance and gear conversion, SOS utilization.

### Government / Tourism Funds
- **Focus:** regional mountain tourism, safety infrastructure, local industry development, compliant operations.
- **Narrative:** SummitLink helps destinations manage routes, visitors, guides, clubs, rescue, and mountain tourism consumption in a measurable way.
- **Key proof:** regional users, popular peaks, SOS response count, local guide/club supply.

### PE / Later-stage Investors
- **Focus:** revenue structure, margin potential, fulfillment quality, risk control.
- **Narrative:** SummitLink can become a profitable vertical marketplace if core destinations show repeatable GMV, commission revenue, and controlled risk.
- **Key proof:** GMV, take rate, order completion, fulfillment and safety incident metrics.

## Unit Economics
- Average expedition price: CNY 5,000–50,000
- Platform take rate: ~15%
- Target: 1,000 paid expeditions/month = CNY 7.5M+ GMV

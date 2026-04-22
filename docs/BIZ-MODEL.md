# Business Model

## Revenue Streams

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

Key KPIs:
- **DAU/WAU/MAU** — engagement depth
- **GMV** — gross merchandise value
- **Order Completion Rate** — conversion quality
- **Summit Conversions** — unique product metric (users who actually summited)
- **SOS Response Count** — safety feature utilization

## Unit Economics
- Average expedition price: CNY 5,000–50,000
- Platform take rate: ~15%
- Target: 1,000 paid expeditions/month = CNY 7.5M+ GMV

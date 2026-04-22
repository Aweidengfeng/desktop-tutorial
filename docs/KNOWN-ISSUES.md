# Known Issues — SummitLink Pre-Launch

_Last updated: 2026-04-16_

## P2 — Should Fix Before Launch

| # | Location | Description | Impact |
|---|----------|-------------|--------|
| P2-01 | `backend/routes/auth.js` | SMS OTP is logged to console instead of sent via SMS gateway | Users cannot receive real verification codes |
| P2-02 | `backend/routes/auth.js` | WeChat/Apple OAuth return mock tokens | Social login non-functional in production |
| P2-03 | `backend/routes/expeditions.js` | `/mock-pay` endpoint is publicly accessible via API | Allows test payment bypass in production |
| P2-04 | `backend/routes/guides.js` | Guide booking payment generates mock order ID | No real payment processing |
| P2-05 | `backend/routes/clubs.js` | Club certification payment generates mock order ID | No real payment processing |
| P2-06 | `investor.html` | Investor token hardcoded as `process.env.INVESTOR_TOKEN` — returns 503 if env not set | Investor dashboard unavailable without env config |

## P3 — Nice to Fix / Future Work

| # | Location | Description | Impact |
|---|----------|-------------|--------|
| P3-01 | `backend/routes/assistant.js` | AI assistant uses random preset replies instead of real LLM | Poor AI coach UX |
| P3-02 | `backend/routes/weather.js` | Falls back to mock weather data when API key absent | Weather forecast unavailable without OpenWeather API key |
| P3-03 | `backend/routes/climbingLog.js` | PDF export endpoint is a placeholder returning 501 | Gear list export non-functional |
| P3-04 | `backend/db/database.js` | `routes_json`, `stories_json`, `contour_svg` columns added to peaks but not yet populated with structured data | Peak detail pages lack route overlay data |
| P3-05 | Multiple routes | TODOs for payment gateway integration (Alipay/WeChat Pay) | All in-app purchases rely on mock order IDs |
| P3-06 | `backend/routes/investor.js` | Investor metrics DAU/WAU/MAU count from posts table only — not true active user sessions | Metrics undercount actual usage |

## Deferred (Post-Launch)

- Real-time SOS push notification via APNS/FCM
- Offline map tile caching (PWA service worker)
- Multi-language (EN/ES/FR) content translation
- Guide background verification API integration

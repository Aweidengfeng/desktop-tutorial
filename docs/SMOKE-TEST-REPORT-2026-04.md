# Smoke Test Report — April 2026

**Date:** 2026-04-16  
**Environment:** Railway staging (Node 20 + better-sqlite3)  
**Tester:** Copilot automated inspection  

## Summary

| Category | Findings | Status |
|----------|----------|--------|
| Mock/TODO residuals | 6 items found | ⚠️ Addressed |
| Error handling | Consistent try/catch in all routes | ✅ Pass |
| Test suite (133 tests) | All pass | ✅ Pass |
| Seed data | Expanded and idempotent | ✅ Pass |
| API endpoints | Core paths functional | ✅ Pass |

## Mock/Placeholder Residuals Found

### P1 - Fixed
1. **`backend/routes/clubs.js` line ~107**: Featured clubs endpoint fell back to hardcoded `mockClubs` array when DB had fewer than 3 entries. **Fixed**: Removed fallback, now returns DB data directly.

### P2 - Intentional / Acceptable Mocks
2. **`backend/routes/auth.js`**: SMS verification code is mocked (prints to console). Intentional — real SMS gateway not yet integrated.
3. **`backend/routes/auth.js`**: WeChat and Apple OAuth are mocked. Intentional — third-party OAuth pending.
4. **`backend/routes/expeditions.js`**: `/mock-pay` endpoint exists for internal testing. Intentional — real payment gateway is B2 phase.
5. **`backend/routes/guides.js`**: Payment order ID generation uses `GUIDE_PAY_` prefix mock. Intentional — same as above.
6. **`backend/routes/weather.js`**: Falls back to mock weather data when OpenWeather API key is absent. Intentional graceful degradation.
7. **`backend/routes/assistant.js`**: AI assistant uses preset mock replies. Intentional — GPT integration is B2 phase.

## Error Handling Assessment

All backend route handlers wrap logic in `try/catch` blocks returning `{ error: '服务器错误' }` with HTTP 500. Pattern is consistent across all route files.

## Seed Data Status

- **Peaks**: 14 eight-thousanders + 7 continental + 16 world classics + 10 technical peaks = **47 peaks**
- **Posts**: 25 varied social posts across 6 months of topics
- **Guides**: 11 approved guides with specialties and ratings
- **Clubs**: 9 active clubs with region coverage
- **AI Glossary**: 100+ terms across 5 categories
- **Badges**: 22 achievement badges

## Test Results

```
Test Suites: 4 passed, 4 total
Tests:       133 passed, 133 total
```

## Recommendations

See `docs/KNOWN-ISSUES.md` for P2/P3 items.

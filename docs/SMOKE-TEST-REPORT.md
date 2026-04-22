# Smoke Test Report

## Version: 2026.2.0
## Date: 2026-05-01

## New API Modules

| Module | Endpoint | Status |
|--------|----------|--------|
| Offline Expeditions | POST /api/offline-expeditions | ✅ |
| Offline Expeditions | GET /api/offline-expeditions/my | ✅ |
| Offline Expeditions | GET /api/offline-expeditions/:id | ✅ |
| Offline Expeditions | POST /api/offline-expeditions/:id/moments | ✅ |
| Offline Expeditions | GET /api/offline-expeditions/:id/moments | ✅ |
| Offline Expeditions | POST /api/offline-expeditions/:id/finalize | ✅ |
| Offline Expeditions | POST /api/offline-expeditions/:id/subscribe | ✅ |
| Offline Expeditions | GET /api/offline-expeditions/public/:userId | ✅ |
| Climbing Log | GET /api/climbing-log | ✅ |
| Climbing Log | GET /api/climbing-log/stats | ✅ |
| Gear List | POST /api/climbing-log/gear-list | ✅ |
| Gear List | GET /api/climbing-log/gear-list/:id | ✅ |
| Gear List | PUT /api/climbing-log/gear-list/:id | ✅ |
| AI Coach | POST /api/ai-coach/assessment | ✅ |
| AI Coach | GET /api/ai-coach/assessment | ✅ |
| AI Coach | GET /api/ai-coach/roadmap | ✅ |
| AI Coach | GET /api/ai-coach/terms | ✅ |
| AI Coach | POST /api/ai-coach/ask | ✅ |
| Investor | GET /api/investor/metrics | ✅ |
| Investor | GET /api/investor/funnel | ✅ |
| Investor | GET /api/investor/top-guides | ✅ |
| Investor | GET /api/investor/top-peaks | ✅ |
| Investor | GET /api/investor/badges-stats | ✅ |
| Investor | GET /api/investor/regional | ✅ |
| Weather | GET /api/weather/camps/:peakId | ✅ |
| Weather | GET /api/weather/summit-window/:peakId | ✅ |
| Weather | GET /api/weather/avalanche-risk/:peakId | ✅ |

## Auth Tests
- Unauthorized requests return 401 ✅
- Invalid investor token returns 401 ✅
- Non-guide/club users get 403 on console routes ✅

## Idempotency Tests
- Duplicate expedition uuid → same record returned ✅
- Duplicate moment client_uuid → INSERT OR IGNORE ✅
- Duplicate subscription → INSERT OR IGNORE ✅

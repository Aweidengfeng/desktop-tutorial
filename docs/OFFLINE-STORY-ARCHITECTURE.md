# Offline Story Architecture

## Overview

SummitLink supports offline-first expedition tracking via a combination of service worker caching, local storage, and background sync.

## Components

### Service Worker (`/www/sw.js`)
- Cache-first strategy for static assets
- Network-first strategy for API calls with offline fallback
- Background sync tag: `sync-moments` for deferred moment uploads

### Offline Expeditions API (`/api/offline-expeditions`)
- **Idempotent upsert** by `client_uuid` — safe to retry
- **Batch moment upload** — idempotent via `INSERT OR IGNORE` on `client_uuid`
- **Finalize** — marks expedition as `completed` with summit stats

### DB Tables
- `user_expeditions_log` — one row per expedition, tracks status/stats
- `expedition_moments` — GPS points, photos, notes during climb
- `expedition_subscribers` — users watching a live expedition

## Data Flow

```
Mobile App (offline)
  → stores moments in IndexedDB/localStorage
  → when online: POST /api/offline-expeditions (upsert)
  → POST /api/offline-expeditions/:id/moments (batch, idempotent)
  → POST /api/offline-expeditions/:id/finalize (complete)
```

## Conflict Resolution
All writes use `client_uuid` for idempotency. The server uses `ON CONFLICT(client_uuid) DO UPDATE` for expeditions and `INSERT OR IGNORE` for moments, making retries safe.

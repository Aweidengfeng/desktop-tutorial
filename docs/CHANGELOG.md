# Changelog

All notable changes to SummitLink are documented in this file.

## [2026.1.0] - 2026-04-22

### Added (Module A - Real-time Chat)
- **Socket.IO gateway** (`backend/routes/chat.gateway.js`)
  - Events: `chat:join`, `chat:leave`, `chat:message`, `chat:typing`, `chat:read`, `chat:recall`
  - JWT authentication from handshake auth token
  - Heartbeat: 25s ping interval / 5s timeout
  - SOS keyword detection → `sos:alert` broadcast
  - Sensitive word filtering via moderation utils
- **New DB tables**: `message_reads`, `conversation_members`
- **DB migrations**: `messages` (type, recalled_at, reply_to_id, content_json), `conversations` (type, name, owner_id, last_msg_at)
- REST endpoint: `POST /api/messages/conversations` (create or get DM conversation)

### Added (Module B - Mountain Content)
- **`/api/mountains` routes** (`backend/routes/mountains.js`)
  - `GET /api/mountains/categories` — 4 category overviews with peak counts
  - `GET /api/mountains/:id/detail` — full mountain detail with parsed routes/stories
  - `POST /api/mountains/:id/wishlist` — add to wishlist (auth required)
  - `DELETE /api/mountains/:id/wishlist` — remove from wishlist (auth required)
  - `POST /api/mountains/:id/footprint` — record summit (auth required)
  - `GET /api/mountains/:id/footprints` — list summiteers with user info
- **DB migrations**: `peaks` (first_ascent_year, first_ascent_team, death_rate, best_months, routes_json, contour_svg, stories_json, region)
- **New DB tables**: `mountain_wishlists`, `mountain_footprints`

### Added (Module C - Feed & Badge System)
- **`/api/badges` routes** (`backend/routes/badges.js`)
  - `GET /api/badges` — list all 22 badges
  - `GET /api/badges/my` — user's badges with unlock status and progress
  - `POST /api/badges/check` — idempotent badge unlock check
- **22 badge seeds** in DB: altitude series (3000/5000/6000/7000/8000m), 7 Summits, technical, club, social badges
- **Feed API** `GET /api/posts/feed?mode=following|recommended|nearby&cursor=&limit=`
  - Cursor-based pagination (no offset drift)
  - `following`: posts from followed users
  - `recommended`: feed_score ranked
  - `nearby`: location-filtered (if available)
- **Post saves** `POST/DELETE /api/posts/:id/save` (auth required, unique constraint)
- **New DB tables**: `badges`, `user_badges`, `post_media`, `post_saves`, `feed_scores`

### Tests
- Added `tests/api-2026-features.test.js` with 30 new API tests
- Updated `package.json` jest testMatch to include new test file
- Total: 103 tests passing

### Documentation
- Added `docs/DESIGN-SYSTEM-2026.md` — design tokens, component specs
- Updated `docs/ARCHITECTURE.md` — added chat/feed/badge architecture sections
- Added `docs/CHANGELOG.md` (this file)

## [2026.0.5] - 2026-04 (PR #72)
- Commercial climbing filters fixed
- Mobile API improvements
- Login error handling
- Light theme improvements
- Emergency contact entry point

## [2026.0.4] - 2026-04 (PR #70-71)
- Dark mode / GPS SOS / global search / team management
- Capacitor mobile login fix

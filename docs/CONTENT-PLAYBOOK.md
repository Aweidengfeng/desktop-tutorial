# SummitLink Content Playbook

_Guidelines for editing seed data and content in the SummitLink platform._

## 1. Seed Data Philosophy

All seed data lives in `backend/db/database.js` and is **idempotent** — it only inserts if the relevant table is empty (`SELECT COUNT(*) as cnt` guard). Never modify data once inserted via direct SQL; instead, add migration scripts.

## 2. Adding Peaks

Peaks are inserted via `insertBuiltinPeak.run(...)` with this column order:

```
name, name_en, altitude, country, continent, difficulty,
image, type, category, description, best_season, success_rate,
first_ascent, deaths, latitude, longitude, annual_climbers,
commercial_teams, season_detail, supplemental_oxygen, main_route, data_source
```

### Categories
| `type` value | `category` value | Meaning |
|---|---|---|
| `8000ers` | `eight_thousanders` | 14 eight-thousander peaks |
| `continental` | `seven_summits` | 7 continental high points |
| `world` | `classic` | World classic peaks |
| `alpine` | `technical` | Technical climbing objectives |

### Difficulty Scale
- `较易` — Easy (e.g., Kilimanjaro via Marangu)
- `中等` — Moderate (e.g., Mont Blanc, Aconcagua)
- `较难` — Moderately Hard
- `难` — Hard (e.g., Denali, Matterhorn)
- `极难` — Extreme (e.g., K2, Cerro Torre)

### Image URLs
Use `https://images.unsplash.com/photo-{ID}?w=800` format. All existing images use 6 rotating Unsplash mountain photos.

## 3. Adding Social Posts

Posts are inserted after the seed user (phone `13800138000`) is created. Insert via:
```js
insertBuiltinPost.run(userId, authorName, authorAvatar, content, location, likes, comments);
```

**Content guidelines:**
- Write in Mandarin Chinese (platform language)
- Include emoji for readability 🏔️💪
- Cover diverse topics: gear reviews, summit reports, training, club events, tips
- Location format: `国家/地区·地名` (e.g., `尼泊尔·珠峰大本营`)
- Likes: 50-500 range for authentic feel; comments: 8-120

## 4. Adding Guides

Guides require: `name, avatar, flag, nationality, rating, reviews, specialty, day_rate`
- `flag`: Use emoji country flags (🇨🇳🇳🇵🇫🇷 etc.)
- `rating`: 4.5–5.0 for seed guides (all approved)
- `day_rate`: In CNY (¥), typical range 2000–5500/day

## 5. Adding Clubs

Clubs require: `name, description, cover, specialty, region, type, contact, verified, members_count, expeditions, status`
- `type`: `专业` / `综合` / `休闲` / `区域`
- `status`: always `'active'` for seed clubs
- `verified`: `1` for established clubs

## 6. AI Coach Glossary

The glossary is in `backend/routes/aiCoach.js` as the `GLOSSARY` constant.
Each entry: `{ term: 'Term (English)', category: 'Category', definition: 'Definition in Chinese' }`

Categories: `地形` | `技术` | `装备` | `生理` | `天气`

## 7. Testing After Changes

Always run after seed data changes:
```bash
npx jest tests/api-new-features.test.js tests/api-commerce.test.js tests/api-2026-features.test.js tests/api-offline-expedition.test.js --forceExit --no-coverage
```

Expected: 133/133 tests pass.

## 8. Database Reset

To reset the database and re-seed:
```bash
rm backend/db/summitlink.db
npm run db:seed  # or SEED_ON_START=true node backend/db/seed.js
```

The database is auto-seeded on first require of `backend/db/database.js`.

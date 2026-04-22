const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'summitlink.db');
const db = new Database(dbPath);

// 开启WAL模式提高性能
db.pragma('journal_mode = WAL');

// 建表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT,
  avatar TEXT,
  level TEXT DEFAULT '初级攀登者',
  summits INTEGER DEFAULT 0,
  expeditions INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  name_en TEXT,
  altitude INTEGER,
  country TEXT,
  continent TEXT,
  difficulty TEXT,
  image TEXT,
  type TEXT,
  description TEXT,
  best_season TEXT,
  success_rate TEXT,
  first_ascent TEXT,
  deaths INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  avatar TEXT,
  flag TEXT,
  nationality TEXT,
  rating REAL DEFAULT 5.0,
  reviews INTEGER DEFAULT 0,
  specialty TEXT,
  day_rate INTEGER,
  cert TEXT,
  languages TEXT,
  region TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  peak TEXT,
  date TEXT,
  spots INTEGER,
  total_spots INTEGER,
  level TEXT,
  leader TEXT,
  leader_avatar TEXT,
  leader_id INTEGER,
  description TEXT,
  status TEXT DEFAULT 'recruiting',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  date TEXT,
  distance REAL,
  elevation INTEGER,
  duration TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gear (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER,
  name TEXT,
  brand TEXT,
  price REAL,
  condition_text TEXT,
  image TEXT,
  description TEXT,
  mode TEXT DEFAULT 'buy',
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT,
  image TEXT,
  location TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS summit_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  avatar TEXT,
  flag TEXT,
  peak TEXT,
  date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT,
  cert TEXT,
  specialty TEXT,
  languages TEXT,
  day_rate INTEGER,
  region TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_no TEXT UNIQUE,
  amount REAL,
  method TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user1_id INTEGER NOT NULL,
  user2_id INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cover TEXT,
  specialty TEXT,
  region TEXT,
  type TEXT DEFAULT '综合',
  members_count INTEGER DEFAULT 0,
  expeditions INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  founded TEXT,
  status TEXT DEFAULT 'active',
  creator_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(club_id, user_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mountain TEXT,
  guide_id INTEGER,
  guide_name TEXT,
  date TEXT,
  members INTEGER DEFAULT 1,
  notes TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT,
  content TEXT,
  related_id INTEGER,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：新增字段（如果不存在）
const existingUserCols = db.pragma('table_info(users)').map(c => c.name);
if (!existingUserCols.includes('is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
}
if (!existingUserCols.includes('is_banned')) {
  db.exec('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0');
}

const existingPostCols = db.pragma('table_info(posts)').map(c => c.name);
if (!existingPostCols.includes('status')) {
  db.exec("ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'pending'");
}

// 迁移：guides 表补充字段
const existingGuideCols = db.pragma('table_info(guides)').map(c => c.name);
if (!existingGuideCols.includes('bio')) {
  db.exec('ALTER TABLE guides ADD COLUMN bio TEXT');
}
if (!existingGuideCols.includes('peaks_led')) {
  db.exec("ALTER TABLE guides ADD COLUMN peaks_led TEXT");
}
if (!existingGuideCols.includes('total_expeditions')) {
  db.exec('ALTER TABLE guides ADD COLUMN total_expeditions INTEGER DEFAULT 0');
}
if (!existingGuideCols.includes('cover_image')) {
  db.exec('ALTER TABLE guides ADD COLUMN cover_image TEXT');
}
if (!existingGuideCols.includes('wechat')) {
  db.exec('ALTER TABLE guides ADD COLUMN wechat TEXT');
}
if (!existingGuideCols.includes('experience_years')) {
  db.exec('ALTER TABLE guides ADD COLUMN experience_years INTEGER DEFAULT 0');
}

// 迁移：clubs 表补充字段
const existingClubCols = db.pragma('table_info(clubs)').map(c => c.name);
if (!existingClubCols.includes('contact')) {
  db.exec('ALTER TABLE clubs ADD COLUMN contact TEXT');
}
if (!existingClubCols.includes('wechat')) {
  db.exec('ALTER TABLE clubs ADD COLUMN wechat TEXT');
}
if (!existingClubCols.includes('website')) {
  db.exec('ALTER TABLE clubs ADD COLUMN website TEXT');
}
if (!existingClubCols.includes('cover_image')) {
  db.exec('ALTER TABLE clubs ADD COLUMN cover_image TEXT');
}
if (!existingClubCols.includes('logo')) {
  db.exec('ALTER TABLE clubs ADD COLUMN logo TEXT');
}

// 迁移：bookings 表补充字段
const existingBookingCols = db.pragma('table_info(bookings)').map(c => c.name);
if (!existingBookingCols.includes('club_id')) {
  db.exec('ALTER TABLE bookings ADD COLUMN club_id INTEGER');
}
if (!existingBookingCols.includes('club_name')) {
  db.exec('ALTER TABLE bookings ADD COLUMN club_name TEXT');
}
if (!existingBookingCols.includes('type')) {
  db.exec("ALTER TABLE bookings ADD COLUMN type TEXT DEFAULT 'guide'");
}
if (!existingBookingCols.includes('confirmed_at')) {
  db.exec('ALTER TABLE bookings ADD COLUMN confirmed_at DATETIME');
}
if (!existingBookingCols.includes('rejected_reason')) {
  db.exec('ALTER TABLE bookings ADD COLUMN rejected_reason TEXT');
}

// 新增表：攻略文章、个人中心、定制攀登、救援
db.exec(`
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  read_time_minutes INTEGER DEFAULT 5,
  cover_image TEXT,
  author_id INTEGER,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  blood_type TEXT,
  allergies TEXT,
  health_notes TEXT
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gear_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  is_ready INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, type, item_id)
);

CREATE TABLE IF NOT EXISTS custom_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peak_name TEXT NOT NULL,
  preferred_date TEXT,
  group_size INTEGER DEFAULT 1,
  notes TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rescue_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  region TEXT,
  type TEXT DEFAULT 'regional'
);

CREATE TABLE IF NOT EXISTS sos_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  location TEXT,
  peak_name TEXT,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 新模块：离线远征、攀登日志、装备清单、AI教练
db.exec(`
CREATE TABLE IF NOT EXISTS user_expeditions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  peak_id INTEGER,
  peak_name TEXT,
  status TEXT DEFAULT 'ongoing',
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  summited INTEGER DEFAULT 0,
  max_altitude REAL DEFAULT 0,
  total_gain REAL DEFAULT 0,
  duration_sec INTEGER DEFAULT 0,
  cover_media_url TEXT,
  poster_url TEXT,
  total_moments INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expedition_moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_uuid TEXT UNIQUE NOT NULL,
  expedition_id INTEGER NOT NULL,
  recorded_at DATETIME NOT NULL,
  altitude REAL DEFAULT 0,
  lat REAL,
  lng REAL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expedition_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(expedition_id, user_id)
);

CREATE TABLE IF NOT EXISTS smart_gear_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peak_id INTEGER,
  peak_name TEXT NOT NULL,
  altitude_tier TEXT,
  season TEXT,
  difficulty TEXT,
  items TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coach_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  max_altitude INTEGER DEFAULT 0,
  gear_skill TEXT DEFAULT 'beginner',
  fitness TEXT DEFAULT 'moderate',
  technical_skill TEXT DEFAULT 'beginner',
  goal_peak TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：guides 表 commission_rate
if (!existingGuideCols.includes('commission_rate')) {
  db.exec('ALTER TABLE guides ADD COLUMN commission_rate REAL DEFAULT 0.15');
}

// 迁移：clubs 表 commission_rate
if (!existingClubCols.includes('commission_rate')) {
  db.exec('ALTER TABLE clubs ADD COLUMN commission_rate REAL DEFAULT 0.15');
}

// 种子数据：救援联系方式（仅插入一次）
const rescueCount = db.prepare('SELECT COUNT(*) as cnt FROM rescue_contacts').get();
if (rescueCount.cnt === 0) {
  const insertRescue = db.prepare(`
    INSERT INTO rescue_contacts (name, phone, region, type) VALUES (?, ?, ?, ?)
  `);
  insertRescue.run('西藏登山救援队', '+86-891-6322222', '西藏全区', 'regional');
  insertRescue.run('四川省山地救援', '+86-028-96955', '四川/横断山脉', 'regional');
  insertRescue.run('新疆山地救援', '+86-991-8585000', '新疆/帕米尔高原', 'regional');
  insertRescue.run('国际高山救援(IKAR)', '+41-41-7920300', '全球覆盖', 'international');
}

// 种子数据：攻略文章（仅插入一次）
const articleCount = db.prepare('SELECT COUNT(*) as cnt FROM articles').get();
if (articleCount.cnt === 0) {
  const insertArticle = db.prepare(`
    INSERT INTO articles (title, category, content, read_time_minutes, cover_image, view_count, like_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertArticle.run(
    '珠穆朗玛峰攀登全攻略：从BC到顶峰',
    'expedition',
    '珠峰（8849m）是每位攀登者的终极梦想。本文详细介绍从拉萨出发，经过合理的高海拔适应，从南坡（尼泊尔）或北坡（西藏）突击顶峰的完整流程。\n\n## 主要路线\n- **南坡（尼泊尔）**：经昆布冰瀑、希拉里台阶，技术难度较高\n- **北坡（西藏）**：需中国政府许可，通过北坳、第二台阶登顶\n\n## 最佳时间\n每年5月和10月是两个主要攀登窗口，南坡多选5月，北坡多选5月前后。\n\n## 必备装备\n- 高海拔羽绒服（-40°C级别）\n- 8000m级登山靴\n- 12齿冰爪 + 两支冰镐\n- 氧气瓶与面罩（通常从7000m以上使用）',
    18,
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    3240, 187
  );
  insertArticle.run(
    'K2技术攀登详解：世界最难八千米峰',
    'technical',
    'K2（8611m）被称为"野蛮山峰"，死亡率高达约23%。本文深度解析K2的技术难点与装备要求。\n\n## 主要路线\n- **东南山脊（阿布鲁兹山脊）**：标准路线，由多个技术路段组成\n- **魔法路线**：难度极大，仅少数精英攀登者尝试\n\n## 技术难点\n1. 黑色金字塔：坡度超55°的岩石区\n2. 瓶颈段：高角度冰雪坡+悬冰川\n3. 极端天气：风速可达120km/h\n\n## 建议经验\n必须有至少2座7000m级峰的登顶经验',
    22,
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    2180, 134
  );
  insertArticle.run(
    'EBC徒步完整路线指南：经典喜马拉雅之旅',
    'hiking',
    '珠峰大本营（EBC）徒步是全球最受欢迎的高海拔徒步路线之一，全程约130km，往返约14天。\n\n## 行程规划\n- 第1-2天：飞卢卡拉（2840m）→ 帕克丁（2610m）→ 南市市（3440m）\n- 第3-4天：南市市 → 坦波切（3860m）\n- 第5-7天：丁波切（4410m）→ 罗布切（4940m）\n- 第8天：珠峰大本营（5364m）\n\n## 高反预防\n- 遵循"爬高睡低"原则\n- 每升高1000m至少适应一天\n- 备好高原反应药物（乙酰唑胺）',
    14,
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    4560, 298
  );
  insertArticle.run(
    '冲锋衣选购终极测评：2025年十款顶级产品对比',
    'gear',
    '冲锋衣是高山攀登最重要的单件装备之一。本文对比测评2025年十款顶级产品的防水性、透气性和耐用性。\n\n## 测评标准\n- 防水指数（HH值）：建议≥20000mm\n- 透气性（MVTR）：建议≥20000g/m²/24h\n- 重量与压缩性\n- 耐久防水（DWR）处理\n\n## 榜单\n1. **Arc\'teryx Alpha SV**：顶级全能选择，防水28000mm\n2. **Mammut Nordwand Pro**：攀登专属，耐用性卓越\n3. **Patagonia Triolet**：环保材料，性价比高\n\n## 购买建议\n根据攀登海拔和强度选择，高海拔远征选Gore-Tex Pro面料。',
    12,
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    1890, 112
  );
  insertArticle.run(
    'ACT安纳普尔纳大环线：顶级徒步天堂',
    'hiking',
    '安纳普尔纳大环线（ACT）全长约160-230km，穿越世界最高山口之一——索罗帕斯（5416m），是全球最壮观的徒步路线之一。\n\n## 亮点\n- 穿越14座8000m级高峰中的多座的视野范围\n- 多样的地形：低地丛林→高山草甸→冰川地带\n- 丰富的尼泊尔文化体验\n\n## 最佳季节\n- 春季（3-5月）：天气稳定，杜鹃花盛开\n- 秋季（10-11月）：视野最佳，人气最旺\n\n## 许可证\n需要ACAP许可和TIMS卡，费用约$50美元',
    16,
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800',
    2870, 165
  );
  insertArticle.run(
    '马特洪峰攀登指南：阿尔卑斯最美山峰',
    'expedition',
    '马特洪峰（4478m）是欧洲最具辨识度的山峰，其四面棱线造就了独特的金字塔形外观。\n\n## 标准路线\n- **赫恩利山脊（Hörnligrat）**：最常攀登路线，技术难度中等偏上\n- 全程约8-10小时往返，需UIAA IV级岩攀技术\n\n## 注意事项\n- 岩石质量较差，需防落石\n- 天气变化迅速，日出前出发避免拥堵\n- 强烈建议聘请认证向导（Zermatt向导协会）\n\n## 基础营\n策马特（Zermatt）是攀登基地，禁止机动车辆进入',
    13,
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    2100, 143
  );
  insertArticle.run(
    '高海拔营养与饮食：极限环境下的能量补充',
    'technical',
    '在8000m以上的"死亡区"，人体消耗极快，正确的营养策略是登顶的关键因素之一。\n\n## 热量需求\n- 高海拔攀登每日消耗可达5000-8000大卡\n- 食欲下降是高反症状，需强制进食\n\n## 推荐食物\n- **碳水化合物**：快速能量来源（能量胶、果冻）\n- **脂肪**：高热量、缓释（坚果、奶酪）\n- **蛋白质**：肌肉修复（蛋白棒）\n\n## 补水策略\n高海拔每日补水至少4-6升，可加入电解质补充盐分',
    10,
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    1560, 89
  );
  insertArticle.run(
    '登山冰爪详细测评：主流品牌全面对比',
    'gear',
    '冰爪是冰雪地形攀登的核心安全装备，选错可能危及生命。本文全面对比主流品牌冰爪。\n\n## 分类\n- **10齿冰爪**：适合高山徒步、技术要求较低路线\n- **12齿冰爪**：标准高海拔冰攀装备\n- **前刃垂直型**：专业冰攀，如Grivel G14\n\n## 2025年推荐\n1. **Petzl Sarken**：轻量化，高山远征首选\n2. **Black Diamond Sabretooth**：全能型，适应性强\n3. **Grivel G12**：经典款，经久耐用\n\n## 安装要点\n必须与登山靴完全匹配，试穿时模拟斜坡受力测试',
    11,
    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    1340, 78
  );
}

// 新增表：保险方案、保险询价、Banner、轨迹增强
db.exec(`
CREATE TABLE IF NOT EXISTS insurance_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  region TEXT,
  coverage_type TEXT,
  price_cny REAL DEFAULT 0,
  price_usd REAL DEFAULT 0,
  coverage_amount TEXT,
  description TEXT,
  features TEXT,
  provider TEXT,
  buy_url TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 99
);

CREATE TABLE IF NOT EXISTS insurance_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  plan_id INTEGER,
  plan_name TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  peak_name TEXT,
  departure_date TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_type TEXT DEFAULT 'none',
  link_target TEXT,
  gradient_from TEXT DEFAULT '#1e4f60',
  gradient_to TEXT DEFAULT '#0f172a',
  sort_order INTEGER DEFAULT 99,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：tracks 表补充字段（新架构需要）
const existingTrackCols = db.pragma('table_info(tracks)').map(c => c.name);
if (!existingTrackCols.includes('peak_name')) {
  db.exec('ALTER TABLE tracks ADD COLUMN peak_name TEXT');
}
if (!existingTrackCols.includes('distance_km')) {
  db.exec('ALTER TABLE tracks ADD COLUMN distance_km REAL');
}
if (!existingTrackCols.includes('elevation_gain')) {
  db.exec('ALTER TABLE tracks ADD COLUMN elevation_gain INTEGER');
}
if (!existingTrackCols.includes('max_elevation')) {
  db.exec('ALTER TABLE tracks ADD COLUMN max_elevation INTEGER');
}
if (!existingTrackCols.includes('start_elevation')) {
  db.exec('ALTER TABLE tracks ADD COLUMN start_elevation INTEGER');
}
if (!existingTrackCols.includes('duration_minutes')) {
  db.exec('ALTER TABLE tracks ADD COLUMN duration_minutes INTEGER');
}
if (!existingTrackCols.includes('weather')) {
  db.exec('ALTER TABLE tracks ADD COLUMN weather TEXT');
}
if (!existingTrackCols.includes('notes')) {
  db.exec('ALTER TABLE tracks ADD COLUMN notes TEXT');
}

// 种子数据：保险方案（仅插入一次）
const insuranceCount = db.prepare('SELECT COUNT(*) as cnt FROM insurance_plans').get();
if (insuranceCount.cnt === 0) {
  const insertPlan = db.prepare(`
    INSERT INTO insurance_plans (name, region, coverage_type, price_cny, price_usd, coverage_amount, description, features, provider, buy_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPlan.run('西藏高原综合险', '西藏/青藏高原', '综合', 299, 42, '50万人民币',
    '覆盖西藏全境高海拔攀登活动，含直升机救援和医疗后送。', '["意外伤害50万","紧急救援20万","医疗费用5万","直升机救援"]', '中国人寿', '', 1);
  insertPlan.run('四川山地专项险', '四川/横断山脉', '专项', 499, 69, '100万人民币',
    '专为四川高海拔山地攀登设计，覆盖四姑娘山、贡嘎山等核心区域。', '["意外伤害100万","紧急救援30万","医疗费用10万","搜救费用20万"]', '中国平安', '', 2);
  insertPlan.run('国际高山险', '全球', '国际', 1299, 180, '200万人民币',
    '覆盖全球高山攀登，包含阿尔卑斯、安第斯、喜马拉雅等地区，无地域限制。', '["意外伤害200万","紧急直升机救援","医疗费用20万","器材损失5万","国际救援"]', 'AXA安盛', 'https://www.axa.com.cn', 3);
  insertPlan.run('8000米专项险', '喜马拉雅/喀喇昆仑', '专项', 3999, 556, '500万人民币',
    '专为8000米级高峰攀登者设计，提供最高级别保障，含家属安置和遗体运送。', '["意外伤害500万","无限额救援","家属安置保障","器材全损15万","遗体运送"]', 'Lloyd\'s劳合社', '', 4);
  insertPlan.run('EBC徒步险', '尼泊尔', '徒步', 199, 28, '30万人民币',
    '专为珠峰大本营（EBC）徒步设计，覆盖昆布地区全程，含高反医疗。', '["意外伤害30万","高反治疗10万","紧急救援15万","行程取消"]', '尼泊尔保险公司', '', 5);
  insertPlan.run('综合装备险', '全球', '装备', 99, 14, '装备价值全额',
    '专门保障攀登装备在运输、使用过程中的损坏和丢失，可附加到任意主险。', '["装备损坏全额赔付","运输丢失","盗窃保障","装备租借费用"]', '中国太平洋', '', 6);
}

// 种子数据：Banner（仅插入一次）
const bannerCount = db.prepare('SELECT COUNT(*) as cnt FROM banners').get();
if (bannerCount.cnt === 0) {
  const insertBanner = db.prepare(`
    INSERT INTO banners (title, subtitle, image_url, link_type, link_target, gradient_from, gradient_to, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertBanner.run('珠峰攀登季 2026', '海拔 8,849m · 中国/尼泊尔', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', 'peak', 'everest', '#1e4f60', '#0f172a', 1, 1);
  insertBanner.run('专业向导招募', '寻找你的攀登伙伴', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'page', 'guides', '#2d1b69', '#0f172a', 2, 1);
  insertBanner.run('攀登保险特惠', '出发前的最后保障', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'insurance', '', '#1a3a2a', '#0f172a', 3, 1);
}

// 种子数据：轨迹示例（仅当tracks为空时插入，给默认用户）
const trackCount = db.prepare('SELECT COUNT(*) as cnt FROM tracks').get();
if (trackCount.cnt === 0) {
  const defaultUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (defaultUser) {
    const insertTrack = db.prepare(`
      INSERT INTO tracks (user_id, name, peak_name, date, distance, distance_km, elevation, elevation_gain, max_elevation, start_elevation, duration, duration_minutes, weather, notes, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTrack.run(defaultUser.id, '珠峰大本营 EBC 线路', '珠穆朗玛峰', '2024-03-15',
      45.2, 45.2, 2300, 2300, 5364, 3440, '5天', 7200,
      '晴转多云，-5°C', '从卢卡拉飞往南市市，徒步抵达珠峰大本营（5364m），沿途穿越昆布冰川，风景壮观。',
      'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400');
    insertTrack.run(defaultUser.id, '四姑娘山二峰攀登', '四姑娘山二峰', '2024-07-20',
      18.5, 18.5, 1800, 1800, 5276, 3600, '2天', 1440,
      '晴，-10°C', '从日隆镇出发，攀登四姑娘山二峰（5276m），技术路段采用固定绳保护，成功登顶。',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400');
  }
}

// 新增表：评论点赞、俱乐部入驻申请、组队成员、山峰用户建议
db.exec(`
CREATE TABLE IF NOT EXISTS comment_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS club_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  club_name TEXT NOT NULL,
  description TEXT,
  specialty TEXT,
  region TEXT,
  type TEXT DEFAULT '综合',
  contact TEXT,
  wechat TEXT,
  website TEXT,
  cert_url TEXT,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'pending',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS peak_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  altitude INTEGER,
  country TEXT,
  continent TEXT,
  difficulty TEXT,
  description TEXT,
  best_season TEXT,
  routes TEXT,
  latitude REAL,
  longitude REAL,
  image TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：comments 表补充嵌套评论字段
const existingCommentCols = db.pragma('table_info(comments)').map(c => c.name);
if (!existingCommentCols.includes('parent_comment_id')) {
  db.exec('ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER DEFAULT NULL');
}
if (!existingCommentCols.includes('reply_to_user_id')) {
  db.exec('ALTER TABLE comments ADD COLUMN reply_to_user_id INTEGER DEFAULT NULL');
}
if (!existingCommentCols.includes('reply_to_user_name')) {
  db.exec('ALTER TABLE comments ADD COLUMN reply_to_user_name TEXT DEFAULT NULL');
}
if (!existingCommentCols.includes('likes')) {
  db.exec('ALTER TABLE comments ADD COLUMN likes INTEGER DEFAULT 0');
}

// 迁移：posts 表补充 tags/emojis 字段
if (!existingPostCols.includes('tags')) {
  db.exec('ALTER TABLE posts ADD COLUMN tags TEXT DEFAULT NULL');
}
if (!existingPostCols.includes('emojis')) {
  db.exec('ALTER TABLE posts ADD COLUMN emojis TEXT DEFAULT NULL');
}

// 迁移：peaks 表补充详细字段
const existingPeakCols = db.pragma('table_info(peaks)').map(c => c.name);
if (!existingPeakCols.includes('latitude')) {
  db.exec('ALTER TABLE peaks ADD COLUMN latitude REAL');
}
if (!existingPeakCols.includes('longitude')) {
  db.exec('ALTER TABLE peaks ADD COLUMN longitude REAL');
}
if (!existingPeakCols.includes('routes')) {
  db.exec('ALTER TABLE peaks ADD COLUMN routes TEXT');
}
if (!existingPeakCols.includes('camps')) {
  db.exec('ALTER TABLE peaks ADD COLUMN camps TEXT');
}
if (!existingPeakCols.includes('technical_grade')) {
  db.exec('ALTER TABLE peaks ADD COLUMN technical_grade TEXT');
}
if (!existingPeakCols.includes('permit_required')) {
  db.exec('ALTER TABLE peaks ADD COLUMN permit_required INTEGER DEFAULT 0');
}
if (!existingPeakCols.includes('permit_fee')) {
  db.exec('ALTER TABLE peaks ADD COLUMN permit_fee TEXT');
}

// 迁移：custom_orders 表补充接收方字段
const existingCustomCols = db.pragma('table_info(custom_orders)').map(c => c.name);
if (!existingCustomCols.includes('receiver_type')) {
  db.exec("ALTER TABLE custom_orders ADD COLUMN receiver_type TEXT DEFAULT 'platform'");
}
if (!existingCustomCols.includes('receiver_id')) {
  db.exec('ALTER TABLE custom_orders ADD COLUMN receiver_id INTEGER DEFAULT NULL');
}
if (!existingCustomCols.includes('receiver_name')) {
  db.exec('ALTER TABLE custom_orders ADD COLUMN receiver_name TEXT DEFAULT NULL');
}

// 迁移：teams 表补充字段
const existingTeamCols = db.pragma('table_info(teams)').map(c => c.name);
if (!existingTeamCols.includes('equipment_required')) {
  db.exec('ALTER TABLE teams ADD COLUMN equipment_required TEXT');
}
if (!existingTeamCols.includes('notes')) {
  db.exec('ALTER TABLE teams ADD COLUMN notes TEXT');
}
if (!existingTeamCols.includes('difficulty')) {
  db.exec('ALTER TABLE teams ADD COLUMN difficulty TEXT');
}
if (!existingTeamCols.includes('fee')) {
  db.exec('ALTER TABLE teams ADD COLUMN fee TEXT');
}

// 新增表：俱乐部活动/商业套餐
db.exec(`
CREATE TABLE IF NOT EXISTS club_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover TEXT,
  type TEXT DEFAULT 'activity',
  mountain TEXT,
  region TEXT,
  price REAL DEFAULT 0,
  max_members INTEGER DEFAULT 10,
  current_members INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  difficulty TEXT,
  includes TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_expeditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id INTEGER NOT NULL,
  mountain TEXT NOT NULL,
  date TEXT,
  members INTEGER DEFAULT 1,
  summit_success INTEGER DEFAULT 1,
  photo TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  rating INTEGER DEFAULT 5,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(target_type, target_id, user_id)
);
`);

// 迁移：为 peaks 表添加 latitude/longitude 列（已有数据库兼容）
try { db.exec('ALTER TABLE peaks ADD COLUMN latitude REAL'); } catch(e) {}
try { db.exec('ALTER TABLE peaks ADD COLUMN longitude REAL'); } catch(e) {}

// 迁移：为 peaks 表添加扩展数据字段（年攀登人数、商业队伍、补充氧气、主要路线、运营公司、数据来源）
const existingPeakColsExt = db.pragma('table_info(peaks)').map(c => c.name);
if (!existingPeakColsExt.includes('annual_climbers')) {
  db.exec('ALTER TABLE peaks ADD COLUMN annual_climbers INTEGER DEFAULT 0');
}
if (!existingPeakColsExt.includes('commercial_teams')) {
  db.exec('ALTER TABLE peaks ADD COLUMN commercial_teams INTEGER DEFAULT 0');
}
if (!existingPeakColsExt.includes('season_detail')) {
  db.exec('ALTER TABLE peaks ADD COLUMN season_detail TEXT');
}
if (!existingPeakColsExt.includes('supplemental_oxygen')) {
  db.exec('ALTER TABLE peaks ADD COLUMN supplemental_oxygen INTEGER DEFAULT 0');
}
if (!existingPeakColsExt.includes('main_route')) {
  db.exec('ALTER TABLE peaks ADD COLUMN main_route TEXT');
}
if (!existingPeakColsExt.includes('operating_company')) {
  db.exec('ALTER TABLE peaks ADD COLUMN operating_company TEXT');
}
if (!existingPeakColsExt.includes('data_source')) {
  db.exec("ALTER TABLE peaks ADD COLUMN data_source TEXT DEFAULT '内部参考数据'");
}

// 新增表：俱乐部帖子、向导帖子（动态）
db.exec(`
CREATE TABLE IF NOT EXISTS club_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  image TEXT,
  location TEXT,
  likes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id INTEGER NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  image TEXT,
  location TEXT,
  likes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：guides 表补充向导归属字段
const existingGuideCols2 = db.pragma('table_info(guides)').map(c => c.name);
if (!existingGuideCols2.includes('affiliation_type')) {
  db.exec("ALTER TABLE guides ADD COLUMN affiliation_type TEXT DEFAULT 'freelance'");
}
if (!existingGuideCols2.includes('affiliation_club_id')) {
  db.exec('ALTER TABLE guides ADD COLUMN affiliation_club_id INTEGER DEFAULT NULL');
}
if (!existingGuideCols2.includes('affiliation_club_name')) {
  db.exec('ALTER TABLE guides ADD COLUMN affiliation_club_name TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('bio')) {
  db.exec('ALTER TABLE guides ADD COLUMN bio TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('cover_image')) {
  db.exec('ALTER TABLE guides ADD COLUMN cover_image TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('experience_years')) {
  db.exec('ALTER TABLE guides ADD COLUMN experience_years INTEGER DEFAULT 0');
}
if (!existingGuideCols2.includes('peaks_led')) {
  db.exec('ALTER TABLE guides ADD COLUMN peaks_led TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('wechat')) {
  db.exec('ALTER TABLE guides ADD COLUMN wechat TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('cert')) {
  db.exec('ALTER TABLE guides ADD COLUMN cert TEXT DEFAULT NULL');
}
if (!existingGuideCols2.includes('total_expeditions')) {
  db.exec('ALTER TABLE guides ADD COLUMN total_expeditions INTEGER DEFAULT 0');
}

// 迁移：clubs 表补充额外字段
const existingClubCols2 = db.pragma('table_info(clubs)').map(c => c.name);
if (!existingClubCols2.includes('contact')) {
  db.exec('ALTER TABLE clubs ADD COLUMN contact TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('wechat')) {
  db.exec('ALTER TABLE clubs ADD COLUMN wechat TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('website')) {
  db.exec('ALTER TABLE clubs ADD COLUMN website TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('cover_image')) {
  db.exec('ALTER TABLE clubs ADD COLUMN cover_image TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('logo')) {
  db.exec('ALTER TABLE clubs ADD COLUMN logo TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('intro')) {
  db.exec('ALTER TABLE clubs ADD COLUMN intro TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('price_list')) {
  db.exec('ALTER TABLE clubs ADD COLUMN price_list TEXT DEFAULT NULL');
}
if (!existingClubCols2.includes('rating')) {
  db.exec('ALTER TABLE clubs ADD COLUMN rating REAL DEFAULT 5.0');
}

// 迁移：users 表补充新字段
const existingUserCols2 = db.pragma('table_info(users)').map(c => c.name);
if (!existingUserCols2.includes('wechat_openid')) {
  db.exec('ALTER TABLE users ADD COLUMN wechat_openid TEXT DEFAULT NULL');
}
if (!existingUserCols2.includes('apple_sub')) {
  db.exec('ALTER TABLE users ADD COLUMN apple_sub TEXT DEFAULT NULL');
}
if (!existingUserCols2.includes('settings')) {
  db.exec("ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}'");
}
if (!existingUserCols2.includes('privacy')) {
  db.exec("ALTER TABLE users ADD COLUMN privacy TEXT DEFAULT '{}'");
}

// 迁移：gear 表补充新字段
const existingGearCols = db.pragma('table_info(gear)').map(c => c.name);
if (!existingGearCols.includes('images')) {
  db.exec('ALTER TABLE gear ADD COLUMN images TEXT DEFAULT NULL');
}
if (!existingGearCols.includes('detail_images')) {
  db.exec('ALTER TABLE gear ADD COLUMN detail_images TEXT DEFAULT NULL');
}

// 迁移：tracks 表补充 points 字段
const existingTrackCols2 = db.pragma('table_info(tracks)').map(c => c.name);
if (!existingTrackCols2.includes('points')) {
  db.exec('ALTER TABLE tracks ADD COLUMN points TEXT DEFAULT NULL');
}
if (!existingTrackCols2.includes('is_public')) {
  db.exec('ALTER TABLE tracks ADD COLUMN is_public INTEGER DEFAULT 0');
}
if (!existingTrackCols2.includes('title')) {
  db.exec('ALTER TABLE tracks ADD COLUMN title TEXT DEFAULT NULL');
}

// 迁移：posts 表加 images JSON 字段
const existingPostColsV2 = db.pragma('table_info(posts)').map(c => c.name);
if (!existingPostColsV2.includes('images')) {
  db.exec('ALTER TABLE posts ADD COLUMN images TEXT');
}

// 迁移：comments 表加 images JSON 字段
const existingCommentColsV2 = db.pragma('table_info(comments)').map(c => c.name);
if (!existingCommentColsV2.includes('images')) {
  db.exec('ALTER TABLE comments ADD COLUMN images TEXT');
}

// 迁移：messages 表加 type 和 images 字段
const existingMsgCols = db.pragma('table_info(messages)').map(c => c.name);
if (!existingMsgCols.includes('type')) {
  db.exec("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'");
}
if (!existingMsgCols.includes('images')) {
  db.exec('ALTER TABLE messages ADD COLUMN images TEXT');
}

// 新增表：短信验证码临时存储
db.exec(`
CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS climbing_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  peak TEXT,
  difficulty TEXT,
  cover TEXT,
  description TEXT,
  altitude INTEGER DEFAULT 0,
  duration_days INTEGER DEFAULT 0,
  best_season TEXT,
  region TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_route_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL,
  route_id INTEGER NOT NULL,
  price REAL DEFAULT 0,
  includes TEXT,
  duration INTEGER DEFAULT 0,
  max_people INTEGER DEFAULT 10,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(club_id, route_id)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_summits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peak_name TEXT NOT NULL,
  altitude INTEGER DEFAULT 0,
  date TEXT,
  notes TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_expeditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  date TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 迁移：bookings 表补充路线字段
const existingBookingCols2 = db.pragma('table_info(bookings)').map(c => c.name);
if (!existingBookingCols2.includes('route_id')) {
  db.exec('ALTER TABLE bookings ADD COLUMN route_id INTEGER DEFAULT NULL');
}
if (!existingBookingCols2.includes('route_name')) {
  db.exec('ALTER TABLE bookings ADD COLUMN route_name TEXT DEFAULT NULL');
}
if (!existingBookingCols2.includes('people')) {
  db.exec('ALTER TABLE bookings ADD COLUMN people INTEGER DEFAULT 1');
}
if (!existingBookingCols2.includes('price')) {
  db.exec('ALTER TABLE bookings ADD COLUMN price REAL DEFAULT 0');
}
if (!existingBookingCols2.includes('booking_type')) {
  db.exec("ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'commercial'");
}

// 种子数据：登山线路
const routeCount = db.prepare('SELECT COUNT(*) as cnt FROM climbing_routes').get();
if (routeCount.cnt === 0) {
  const insertRoute = db.prepare(`
    INSERT INTO climbing_routes (name, peak, difficulty, cover, description, altitude, duration_days, best_season, region)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRoute.run('珠峰南坡标准线', '珠穆朗玛峰', '极难', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', '经昆布冰瀑、西库姆冰斗，经4个营地攀登至顶峰，全程约2个月', 8849, 60, '4月-5月', '喜马拉雅');
  insertRoute.run('K2阿布鲁兹山脊', 'K2', '极难', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', '经阿布鲁兹山脊标准路线攀登，含黑色金字塔和瓶颈段', 8611, 55, '6月-7月', '喀喇昆仑');
  insertRoute.run('珠峰北坡标准线', '珠穆朗玛峰', '极难', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', '经西藏北坡，过北坳、第二台阶，中国队经典路线', 8849, 55, '5月', '西藏');
  insertRoute.run('四姑娘山幺妹峰', '四姑娘山', '难', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', '四姑娘山最高峰，技术攀登路线，需要冰雪攀登经验', 6250, 10, '5月-6月, 10月', '四川');
}

// 种子数据：俱乐部-路线报价（依赖已有clubs数据）
const pricingCount = db.prepare('SELECT COUNT(*) as cnt FROM club_route_pricing').get();
if (pricingCount.cnt === 0) {
  const firstClub = db.prepare("SELECT id FROM clubs LIMIT 1").get();
  const firstRoute = db.prepare("SELECT id FROM climbing_routes LIMIT 1").get();
  if (firstClub && firstRoute) {
    db.prepare(`
      INSERT OR IGNORE INTO club_route_pricing (club_id, route_id, price, includes, duration, max_people)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(firstClub.id, firstRoute.id, 280000,
      '["许可证","BC食宿","运输","高山向导","氧气装备","保险"]', 60, 8);
  }
}

// ── A2: peaks 表补充分类字段 ───────────────────────────────────
const existingPeakColsA2 = db.pragma('table_info(peaks)').map(c => c.name);
if (!existingPeakColsA2.includes('category')) {
  db.exec("ALTER TABLE peaks ADD COLUMN category TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('categories')) {
  db.exec("ALTER TABLE peaks ADD COLUMN categories TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('cover_image')) {
  db.exec("ALTER TABLE peaks ADD COLUMN cover_image TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('gallery')) {
  db.exec("ALTER TABLE peaks ADD COLUMN gallery TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('region')) {
  db.exec("ALTER TABLE peaks ADD COLUMN region TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('first_ascent_year')) {
  db.exec("ALTER TABLE peaks ADD COLUMN first_ascent_year INTEGER DEFAULT NULL");
}
if (!existingPeakColsA2.includes('first_ascent_by')) {
  db.exec("ALTER TABLE peaks ADD COLUMN first_ascent_by TEXT DEFAULT NULL");
}
if (!existingPeakColsA2.includes('technical_notes')) {
  db.exec("ALTER TABLE peaks ADD COLUMN technical_notes TEXT DEFAULT NULL");
}

// 将旧 type 字段映射到新 category 字段（幂等迁移）
db.prepare("UPDATE peaks SET category = 'eight_thousanders' WHERE type = '8000ers' AND category IS NULL").run();
db.prepare("UPDATE peaks SET category = 'seven_summits'    WHERE type = 'continental' AND category IS NULL").run();
db.prepare("UPDATE peaks SET category = 'classic'          WHERE type = 'world' AND category IS NULL").run();
db.prepare("UPDATE peaks SET category = 'technical'        WHERE type = 'alpine' AND category IS NULL").run();

// ── A6: guides 表补充入驻审核字段 ────────────────────────────────
const existingGuideColsA6 = db.pragma('table_info(guides)').map(c => c.name);
if (!existingGuideColsA6.includes('real_name')) {
  db.exec("ALTER TABLE guides ADD COLUMN real_name TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('id_card_no')) {
  db.exec("ALTER TABLE guides ADD COLUMN id_card_no TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('id_card_front')) {
  db.exec("ALTER TABLE guides ADD COLUMN id_card_front TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('id_card_back')) {
  db.exec("ALTER TABLE guides ADD COLUMN id_card_back TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('certifications')) {
  db.exec("ALTER TABLE guides ADD COLUMN certifications TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('bank_account')) {
  db.exec("ALTER TABLE guides ADD COLUMN bank_account TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('bank_name')) {
  db.exec("ALTER TABLE guides ADD COLUMN bank_name TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('emergency_contact')) {
  db.exec("ALTER TABLE guides ADD COLUMN emergency_contact TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('emergency_phone')) {
  db.exec("ALTER TABLE guides ADD COLUMN emergency_phone TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('specialties')) {
  db.exec("ALTER TABLE guides ADD COLUMN specialties TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('years_experience')) {
  db.exec("ALTER TABLE guides ADD COLUMN years_experience INTEGER DEFAULT 0");
}
if (!existingGuideColsA6.includes('listing_fee_paid')) {
  db.exec("ALTER TABLE guides ADD COLUMN listing_fee_paid INTEGER DEFAULT 0");
}
if (!existingGuideColsA6.includes('commission_rate')) {
  db.exec("ALTER TABLE guides ADD COLUMN commission_rate REAL DEFAULT 0.15");
}
if (!existingGuideColsA6.includes('reject_reason')) {
  db.exec("ALTER TABLE guides ADD COLUMN reject_reason TEXT DEFAULT NULL");
}
if (!existingGuideColsA6.includes('approved_at')) {
  db.exec("ALTER TABLE guides ADD COLUMN approved_at DATETIME DEFAULT NULL");
}
if (!existingGuideColsA6.includes('approved_by')) {
  db.exec("ALTER TABLE guides ADD COLUMN approved_by TEXT DEFAULT NULL");
}

// ── A6: clubs 表补充入驻审核字段 ────────────────────────────────
const existingClubColsA6 = db.pragma('table_info(clubs)').map(c => c.name);
if (!existingClubColsA6.includes('business_license')) {
  db.exec("ALTER TABLE clubs ADD COLUMN business_license TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('business_license_no')) {
  db.exec("ALTER TABLE clubs ADD COLUMN business_license_no TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('legal_person')) {
  db.exec("ALTER TABLE clubs ADD COLUMN legal_person TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('legal_id_card_front')) {
  db.exec("ALTER TABLE clubs ADD COLUMN legal_id_card_front TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('legal_id_card_back')) {
  db.exec("ALTER TABLE clubs ADD COLUMN legal_id_card_back TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('bank_account_name')) {
  db.exec("ALTER TABLE clubs ADD COLUMN bank_account_name TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('bank_account_no')) {
  db.exec("ALTER TABLE clubs ADD COLUMN bank_account_no TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('bank_name')) {
  db.exec("ALTER TABLE clubs ADD COLUMN bank_name TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('contact_name')) {
  db.exec("ALTER TABLE clubs ADD COLUMN contact_name TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('contact_phone')) {
  db.exec("ALTER TABLE clubs ADD COLUMN contact_phone TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('contact_email')) {
  db.exec("ALTER TABLE clubs ADD COLUMN contact_email TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('address')) {
  db.exec("ALTER TABLE clubs ADD COLUMN address TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('established_year')) {
  db.exec("ALTER TABLE clubs ADD COLUMN established_year INTEGER DEFAULT NULL");
}
if (!existingClubColsA6.includes('listing_fee_paid')) {
  db.exec("ALTER TABLE clubs ADD COLUMN listing_fee_paid INTEGER DEFAULT 0");
}
if (!existingClubColsA6.includes('commission_rate')) {
  db.exec("ALTER TABLE clubs ADD COLUMN commission_rate REAL DEFAULT 0.15");
}
if (!existingClubColsA6.includes('reject_reason')) {
  db.exec("ALTER TABLE clubs ADD COLUMN reject_reason TEXT DEFAULT NULL");
}
if (!existingClubColsA6.includes('approved_at')) {
  db.exec("ALTER TABLE clubs ADD COLUMN approved_at DATETIME DEFAULT NULL");
}
if (!existingClubColsA6.includes('approved_by')) {
  db.exec("ALTER TABLE clubs ADD COLUMN approved_by TEXT DEFAULT NULL");
}

// ── A9: sms_codes 表补充 created_at 字段 ──────────────────────
const existingSmsCodeCols = db.pragma('table_info(sms_codes)').map(c => c.name);
if (!existingSmsCodeCols.includes('created_at')) {
  db.exec("ALTER TABLE sms_codes ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
}

// ── New migrations ────────────────────────────────────────────

// users table: policy consent fields
const existingUserColsPolicy = db.pragma('table_info(users)').map(c => c.name);
if (!existingUserColsPolicy.includes('policy_version')) {
  db.exec('ALTER TABLE users ADD COLUMN policy_version TEXT');
}
if (!existingUserColsPolicy.includes('policy_agreed_at')) {
  db.exec('ALTER TABLE users ADD COLUMN policy_agreed_at DATETIME');
}

// tracks table: moderation + certificate + GPS points
const existingTrackColsNew = db.pragma('table_info(tracks)').map(c => c.name);
if (!existingTrackColsNew.includes('flagged')) {
  db.exec('ALTER TABLE tracks ADD COLUMN flagged INTEGER DEFAULT 0');
}
if (!existingTrackColsNew.includes('flag_reason')) {
  db.exec('ALTER TABLE tracks ADD COLUMN flag_reason TEXT');
}
if (!existingTrackColsNew.includes('certificate_no')) {
  db.exec('ALTER TABLE tracks ADD COLUMN certificate_no TEXT');
}
if (!existingTrackColsNew.includes('gps_points')) {
  db.exec('ALTER TABLE tracks ADD COLUMN gps_points TEXT');
}

// guide_applications table: new schema with additional fields
db.exec(`
CREATE TABLE IF NOT EXISTS guide_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT,
  phone TEXT,
  cert TEXT,
  experience TEXT,
  regions TEXT,
  status TEXT DEFAULT 'pending',
  review_note TEXT,
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
const existingGuideAppCols = db.pragma('table_info(guide_applications)').map(c => c.name);
if (!existingGuideAppCols.includes('phone')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN phone TEXT');
}
if (!existingGuideAppCols.includes('experience')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN experience TEXT');
}
if (!existingGuideAppCols.includes('regions')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN regions TEXT');
}
if (!existingGuideAppCols.includes('review_note')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN review_note TEXT');
}
if (!existingGuideAppCols.includes('reviewed_by')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN reviewed_by INTEGER');
}
if (!existingGuideAppCols.includes('reviewed_at')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN reviewed_at DATETIME');
}

// club_applications table: review fields
const existingClubAppCols = db.pragma('table_info(club_applications)').map(c => c.name);
if (!existingClubAppCols.includes('review_note')) {
  db.exec('ALTER TABLE club_applications ADD COLUMN review_note TEXT');
}
if (!existingClubAppCols.includes('reviewed_by')) {
  db.exec('ALTER TABLE club_applications ADD COLUMN reviewed_by INTEGER');
}
if (!existingClubAppCols.includes('reviewed_at')) {
  db.exec('ALTER TABLE club_applications ADD COLUMN reviewed_at DATETIME');
}

// notifications table: title/body/link/read_at fields
const existingNotifCols = db.pragma('table_info(notifications)').map(c => c.name);
if (!existingNotifCols.includes('title')) {
  db.exec('ALTER TABLE notifications ADD COLUMN title TEXT');
}
if (!existingNotifCols.includes('body')) {
  db.exec('ALTER TABLE notifications ADD COLUMN body TEXT');
}
if (!existingNotifCols.includes('link')) {
  db.exec('ALTER TABLE notifications ADD COLUMN link TEXT');
}
if (!existingNotifCols.includes('read_at')) {
  db.exec('ALTER TABLE notifications ADD COLUMN read_at DATETIME');
}

// New tables
db.exec(`
CREATE TABLE IF NOT EXISTS moderation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content_type TEXT,
  content TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expedition_orders_new_fields_marker (
  id INTEGER PRIMARY KEY
);
`);

// ── A7: expeditions 和 expedition_orders 表 ──────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS expeditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher_type TEXT NOT NULL,
  publisher_id INTEGER NOT NULL,
  peak_id INTEGER,
  title TEXT NOT NULL,
  cover_image TEXT,
  gallery TEXT,
  route_name TEXT,
  difficulty TEXT,
  start_date TEXT,
  end_date TEXT,
  total_days INTEGER DEFAULT 0,
  min_participants INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 10,
  meeting_point TEXT,
  itinerary TEXT,
  included_services TEXT,
  excluded_services TEXT,
  base_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'CNY',
  addons TEXT,
  early_bird_price REAL,
  early_bird_deadline TEXT,
  group_discount TEXT,
  payment_stages TEXT,
  cancel_policy TEXT,
  commission_rate REAL DEFAULT 0.15,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expedition_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  expedition_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  participants INTEGER DEFAULT 1,
  selected_addons TEXT,
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  platform_fee REAL DEFAULT 0,
  publisher_income REAL DEFAULT 0,
  status TEXT DEFAULT 'pending_payment',
  contact_name TEXT,
  contact_phone TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  confirmed_at DATETIME,
  cancelled_at DATETIME
);
`);

// expedition_orders table: state machine fields (must run after CREATE TABLE)
const existingExpOrderCols = db.pragma('table_info(expedition_orders)').map(c => c.name);
if (!existingExpOrderCols.includes('status')) {
  db.exec("ALTER TABLE expedition_orders ADD COLUMN status TEXT DEFAULT 'pending_payment'");
}
if (!existingExpOrderCols.includes('status_history')) {
  db.exec('ALTER TABLE expedition_orders ADD COLUMN status_history TEXT');
}
if (!existingExpOrderCols.includes('refund_reason')) {
  db.exec('ALTER TABLE expedition_orders ADD COLUMN refund_reason TEXT');
}
if (!existingExpOrderCols.includes('refund_amount')) {
  db.exec('ALTER TABLE expedition_orders ADD COLUMN refund_amount INTEGER');
}
if (!existingExpOrderCols.includes('refunded_at')) {
  db.exec('ALTER TABLE expedition_orders ADD COLUMN refunded_at DATETIME');
}

// Add note column to guide_applications if missing
const guideAppColsNote = db.pragma('table_info(guide_applications)').map(c => c.name);
if (!guideAppColsNote.includes('note')) {
  db.exec('ALTER TABLE guide_applications ADD COLUMN note TEXT');
}
// Add note column to club_applications if missing
try {
  const clubAppColsNote = db.pragma('table_info(club_applications)').map(c => c.name);
  if (!clubAppColsNote.includes('note')) {
    db.exec('ALTER TABLE club_applications ADD COLUMN note TEXT');
  }
} catch(e) {}
// Add content_snippet column to moderation_logs if missing
const moderationLogCols = db.pragma('table_info(moderation_logs)').map(c => c.name);
if (!moderationLogCols.includes('content_snippet')) {
  db.exec('ALTER TABLE moderation_logs ADD COLUMN content_snippet TEXT');
}

// ── 商业化模块迁移 ──────────────────────────────────────────────

// tracks 表：补充 reward_granted 字段（反作弊：0 = 不计入榜单）
const existingTrackColsCommerce = db.pragma('table_info(tracks)').map(c => c.name);
if (!existingTrackColsCommerce.includes('reward_granted')) {
  db.exec('ALTER TABLE tracks ADD COLUMN reward_granted INTEGER DEFAULT 1');
}

// clubs 表：补充商业资质字段
const existingClubColsCommerce = db.pragma('table_info(clubs)').map(c => c.name);
if (!existingClubColsCommerce.includes('business_license_url')) {
  db.exec('ALTER TABLE clubs ADD COLUMN business_license_url TEXT DEFAULT NULL');
}
if (!existingClubColsCommerce.includes('insurance_cert_url')) {
  db.exec('ALTER TABLE clubs ADD COLUMN insurance_cert_url TEXT DEFAULT NULL');
}
if (!existingClubColsCommerce.includes('commercial_verified')) {
  db.exec('ALTER TABLE clubs ADD COLUMN commercial_verified INTEGER DEFAULT 0');
}
if (!existingClubColsCommerce.includes('commercial_status')) {
  db.exec("ALTER TABLE clubs ADD COLUMN commercial_status TEXT DEFAULT 'none'");
}
if (!existingClubColsCommerce.includes('commercial_applied_at')) {
  db.exec('ALTER TABLE clubs ADD COLUMN commercial_applied_at DATETIME DEFAULT NULL');
}
if (!existingClubColsCommerce.includes('commercial_reviewed_at')) {
  db.exec('ALTER TABLE clubs ADD COLUMN commercial_reviewed_at DATETIME DEFAULT NULL');
}
if (!existingClubColsCommerce.includes('commercial_reject_reason')) {
  db.exec('ALTER TABLE clubs ADD COLUMN commercial_reject_reason TEXT DEFAULT NULL');
}

// guides 表：补充商业资质字段
const existingGuideColsCommerce = db.pragma('table_info(guides)').map(c => c.name);
if (!existingGuideColsCommerce.includes('id_card_url')) {
  db.exec('ALTER TABLE guides ADD COLUMN id_card_url TEXT DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('climbing_cert_url')) {
  db.exec('ALTER TABLE guides ADD COLUMN climbing_cert_url TEXT DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('insurance_cert_url')) {
  db.exec('ALTER TABLE guides ADD COLUMN insurance_cert_url TEXT DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('health_cert_url')) {
  db.exec('ALTER TABLE guides ADD COLUMN health_cert_url TEXT DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('commercial_verified')) {
  db.exec('ALTER TABLE guides ADD COLUMN commercial_verified INTEGER DEFAULT 0');
}
if (!existingGuideColsCommerce.includes('commercial_status')) {
  db.exec("ALTER TABLE guides ADD COLUMN commercial_status TEXT DEFAULT 'none'");
}
if (!existingGuideColsCommerce.includes('commercial_applied_at')) {
  db.exec('ALTER TABLE guides ADD COLUMN commercial_applied_at DATETIME DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('commercial_reviewed_at')) {
  db.exec('ALTER TABLE guides ADD COLUMN commercial_reviewed_at DATETIME DEFAULT NULL');
}
if (!existingGuideColsCommerce.includes('commercial_reject_reason')) {
  db.exec('ALTER TABLE guides ADD COLUMN commercial_reject_reason TEXT DEFAULT NULL');
}

// 新增表：俱乐部活动报名订单
db.exec(`
CREATE TABLE IF NOT EXISTS activity_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  activity_id INTEGER NOT NULL,
  club_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending_payment',
  status_history TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  agreed_waiver INTEGER DEFAULT 0,
  agreed_waiver_version TEXT,
  refund_reason TEXT,
  refund_amount REAL,
  refunded_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover TEXT,
  type TEXT DEFAULT 'guided_climb',
  mountain TEXT,
  region TEXT,
  price REAL DEFAULT 0,
  price_unit TEXT DEFAULT 'per_person',
  duration_days INTEGER DEFAULT 1,
  max_clients INTEGER DEFAULT 6,
  difficulty TEXT,
  includes TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_service_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  service_id INTEGER NOT NULL,
  guide_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending_payment',
  status_history TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  agreed_waiver INTEGER DEFAULT 0,
  waiver_version TEXT,
  start_date TEXT,
  client_notes TEXT,
  refund_reason TEXT,
  refund_amount REAL,
  refunded_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ── 性能索引（幂等，CREATE INDEX IF NOT EXISTS）────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_user_id        ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at     ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id     ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender      ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_tracks_user_id       ON tracks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tracks_created_at    ON tracks(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bookings_user_id     ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_status      ON bookings(status);
  CREATE INDEX IF NOT EXISTS idx_expedition_orders_user   ON expedition_orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_expedition_orders_status ON expedition_orders(status);
  CREATE INDEX IF NOT EXISTS idx_activity_orders_user     ON activity_orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_orders_status   ON activity_orders(status);
  CREATE INDEX IF NOT EXISTS idx_guide_service_orders_user   ON guide_service_orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_guide_service_orders_status ON guide_service_orders(status);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower     ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following    ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_sms_codes_phone      ON sms_codes(phone);
  CREATE INDEX IF NOT EXISTS idx_guides_user_id       ON guides(user_id);
  CREATE INDEX IF NOT EXISTS idx_clubs_creator        ON clubs(creator_id);
  CREATE INDEX IF NOT EXISTS idx_club_members_club    ON club_members(club_id);
  CREATE INDEX IF NOT EXISTS idx_club_members_user    ON club_members(user_id);
`);

// 装备订单表
db.exec(`
CREATE TABLE IF NOT EXISTS gear_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  gear_id INTEGER NOT NULL,
  gear_name TEXT,
  buyer_id INTEGER NOT NULL,
  seller_id INTEGER,
  amount REAL NOT NULL,
  shipping_carrier TEXT DEFAULT NULL,
  tracking_number TEXT DEFAULT NULL,
  shipping_status TEXT DEFAULT 'pending',
  address TEXT DEFAULT NULL,
  receiver_name TEXT DEFAULT NULL,
  receiver_phone TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status TEXT DEFAULT 'paid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  shipped_at DATETIME DEFAULT NULL,
  delivered_at DATETIME DEFAULT NULL
);
`);

// 迁移：将旧的 'available' 状态向导更新为 'approved'（修复内置向导无法被列表接口返回的问题）
db.prepare("UPDATE guides SET status = 'approved' WHERE status = 'available'").run();

// ── 群聊系统表（队伍/俱乐部多人聊天）─────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS group_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER,
  name TEXT NOT NULL,
  avatar TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_chat_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT DEFAULT 'text',
  images TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_group_messages_chat ON group_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON group_chat_members(user_id);
`);

// posts 表：补充 video_url 字段
const existingPostColsVideo = db.pragma('table_info(posts)').map(c => c.name);
if (!existingPostColsVideo.includes('video_url')) {
  db.exec('ALTER TABLE posts ADD COLUMN video_url TEXT DEFAULT NULL');
}

// articles 表：补充 status 字段（pending/published/rejected）
const existingArticleCols = db.pragma('table_info(articles)').map(c => c.name);
if (!existingArticleCols.includes('status')) {
  db.exec("ALTER TABLE articles ADD COLUMN status TEXT DEFAULT 'published'");
}
if (!existingArticleCols.includes('reject_reason')) {
  db.exec('ALTER TABLE articles ADD COLUMN reject_reason TEXT DEFAULT NULL');
}
if (!existingArticleCols.includes('reviewed_at')) {
  db.exec('ALTER TABLE articles ADD COLUMN reviewed_at DATETIME DEFAULT NULL');
}

// tracks 表：补充 is_manual 字段（手动记录登顶，无GPS轨迹）
const existingTrackColsManual = db.pragma('table_info(tracks)').map(c => c.name);
if (!existingTrackColsManual.includes('is_manual')) {
  db.exec('ALTER TABLE tracks ADD COLUMN is_manual INTEGER DEFAULT 0');
}
if (!existingTrackColsManual.includes('proof_images')) {
  db.exec('ALTER TABLE tracks ADD COLUMN proof_images TEXT DEFAULT NULL');
}

// team_members 表：补充 approved_at 字段
const existingTeamMemberCols = db.pragma('table_info(team_members)').map(c => c.name);
if (!existingTeamMemberCols.includes('approved_at')) {
  db.exec('ALTER TABLE team_members ADD COLUMN approved_at DATETIME DEFAULT NULL');
}
if (!existingTeamMemberCols.includes('group_chat_id')) {
  db.exec('ALTER TABLE team_members ADD COLUMN group_chat_id INTEGER DEFAULT NULL');
}
// teams 表：关联群聊
const existingTeamColsChat = db.pragma('table_info(teams)').map(c => c.name);
if (!existingTeamColsChat.includes('group_chat_id')) {
  db.exec('ALTER TABLE teams ADD COLUMN group_chat_id INTEGER DEFAULT NULL');
}

// ── 内置山峰数据（首次启动时自动填充，无需 SEED_ON_START）──────────────────
{
  const peakSeedCount = db.prepare('SELECT COUNT(*) as cnt FROM peaks').get();
  if (peakSeedCount.cnt === 0) {
    const insertBuiltinPeak = db.prepare(`
      INSERT OR IGNORE INTO peaks (name, name_en, altitude, country, continent, difficulty, image, type, category,
                       description, best_season, success_rate, first_ascent, deaths, latitude, longitude,
                       annual_climbers, commercial_teams, season_detail, supplemental_oxygen, main_route, data_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // 8000米巨峰
    const builtinPeaks8000 = [
      ['珠穆朗玛峰','Mount Everest',8849,'中国/尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800','8000ers','eight_thousanders','世界最高峰，位于中尼边境，是无数攀登者毕生的梦想。','5月、10月','29%','1953年5月29日',310,27.98,86.92,800,35,'春季窗口期4月下旬至5月中旬，秋季窗口10月',1,'东南山脊(南坡)/东北山脊(北坡)','内部参考数据'],
      ['K2','K2',8611,'巴基斯坦/中国','亚洲','极难','https://images.unsplash.com/photo-1551632811-561732d1e306?w=800','8000ers','eight_thousanders','世界第二高峰，被誉为"野蛮巨峰"，技术难度极高。','7月-8月','25%','1954年7月31日',87,35.88,76.51,150,12,'夏季窗口期7月中旬至8月中旬',0,'Abruzzi山脊路线','内部参考数据'],
      ['干城章嘉峰','Kangchenjunga',8586,'尼泊尔/印度','亚洲','极难','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','8000ers','eight_thousanders','世界第三高峰，位于尼泊尔与印度边境。','5月、10月','38%','1955年5月25日',45,27.70,88.14,80,6,'春季4-5月；秋季10月',1,'西南壁路线','内部参考数据'],
      ['洛子峰','Lhotse',8516,'尼泊尔/中国','亚洲','极难','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800','8000ers','eight_thousanders','世界第四高峰，与珠峰共享南坳路线。','5月','65%','1956年5月18日',13,27.96,86.93,200,15,'春季4月底至5月中旬',1,'西壁/Couloir路线','内部参考数据'],
      ['马卡鲁峰','Makalu',8485,'尼泊尔/中国','亚洲','极难','https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800','8000ers','eight_thousanders','世界第五高峰，以陡峭的山脊和孤立的山体著称。','5月、10月','40%','1955年5月15日',30,27.89,87.09,70,5,'春季4月底至5月；秋季10月',1,'北坡/西北山脊','内部参考数据'],
      ['卓奥友峰','Cho Oyu',8188,'中国/尼泊尔','亚洲','难','https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800','8000ers','eight_thousanders','世界第六高峰，8000米山峰中技术难度相对较低。','9月-10月','56%','1954年10月19日',42,28.09,86.66,300,25,'秋季9月底至10月中旬',0,'西北山脊路线','内部参考数据'],
      ['道拉吉里峰','Dhaulagiri',8167,'尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800','8000ers','eight_thousanders','世界第七高峰，以多变的天气和崩雪风险闻名。','5月、10月','42%','1960年5月13日',71,28.70,83.49,90,7,'春季4月底至5月',0,'东北山脊路线','内部参考数据'],
      ['马纳斯卢峰','Manaslu',8163,'尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800','8000ers','eight_thousanders','世界第八高峰，尼泊尔语意为"灵魂之山"。','5月、10月','56%','1956年5月9日',68,28.55,84.56,400,30,'秋季9月底至10月中旬',0,'东北面/东北山脊','内部参考数据'],
      ['南迦帕尔巴特峰','Nanga Parbat',8126,'巴基斯坦','亚洲','极难','https://images.unsplash.com/photo-1551632811-561732d1e306?w=800','8000ers','eight_thousanders','被称为"杀人山"，技术极难，死亡率极高。','7月','15%','1953年',239,35.23,74.58,60,5,'夏季7月中旬至8月',0,'Kinshofer路线/鲁帕尔壁','内部参考数据'],
      ['安纳普尔纳峰','Annapurna',8091,'尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800','8000ers','eight_thousanders','世界第十高峰，死亡率曾是8000米山峰中最高。','5月、10月','38%','1950年',72,28.59,83.82,60,5,'春季4月底至5月中旬',0,'北壁路线','内部参考数据'],
      ['加舒尔布鲁姆I峰','Gasherbrum I',8080,'巴基斯坦/中国','亚洲','极难','https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800','8000ers','eight_thousanders','巴托罗冰川区最险峻的山峰之一。','7月','38%','1958年',29,35.72,76.69,50,4,'夏季7月至8月初',0,'美国路线/西北壁','内部参考数据'],
      ['布洛阿特峰','Broad Peak',8051,'巴基斯坦/中国','亚洲','难','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','8000ers','eight_thousanders','与K2相邻，路线相对温和。','7月','52%','1957年',21,35.81,76.57,120,10,'夏季7月中旬至8月初',0,'普通路线/西壁','内部参考数据'],
      ['加舒尔布鲁姆II峰','Gasherbrum II',8034,'巴基斯坦/中国','亚洲','难','https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800','8000ers','eight_thousanders','8000米山峰中成功率较高的山峰之一。','7月','65%','1956年',24,35.76,76.65,180,14,'夏季7月至8月',0,'西南壁路线','内部参考数据'],
      ['希夏邦马峰','Shishapangma',8027,'中国','亚洲','难','https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=800','8000ers','eight_thousanders','唯一完全位于中国境内的八千米级高峰。','5月、10月','49%','1964年',25,28.35,85.78,150,12,'春季5月；秋季9月底至10月',0,'北坡/西南壁','内部参考数据'],
    ];
    // 7大洲最高峰
    const builtinContinental = [
      ['珠穆朗玛峰','Mount Everest',8849,'中国/尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800','continental','seven_summits','亚洲最高峰，世界之巅。','5月、10月','29%','1953年5月29日',310,27.98,86.92,800,35,'春季窗口期4月下旬至5月中旬，秋季窗口10月',1,'东南山脊(南坡)/东北山脊(北坡)','内部参考数据'],
      ['麦金利山','Denali',6190,'美国','北美洲','难','https://images.unsplash.com/photo-1551632811-561732d1e306?w=800','continental','seven_summits','北美洲最高峰，阿拉斯加的皇冠。','5月-7月','50%','1913年',0,63.07,-151.00,1200,80,'5月至6月为窗口期，需提前申请NPS许可证',0,'西山脊/卡希尔顿路线','内部参考数据'],
      ['阿空加瓜峰','Aconcagua',6961,'阿根廷','南美洲','中等','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','continental','seven_summits','南美洲最高峰，七大洲最高峰中除亚洲外最高。','12月-2月','35%','1897年',0,-32.65,-70.01,3000,120,'南半球夏季12月至2月，1月为最佳窗口',0,'标准路线(普通路线)/波兰冰川','内部参考数据'],
      ['乞力马扎罗山','Kilimanjaro',5895,'坦桑尼亚','非洲','较易','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800','continental','seven_summits','非洲最高峰，赤道雪山奇观。','1月-3月、6月-10月','65%','1889年',0,-3.07,37.35,35000,2000,'旱季1-3月及6-10月最佳，全年均可攀登',0,'Marangu/Machame/Lemosho路线','内部参考数据'],
      ['文森峰','Vinson Massif',4892,'南极洲','南极洲','极难','https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800','continental','seven_summits','南极洲最高峰，七大洲最高峰之一。','11月-1月','80%','1966年',0,-78.53,-85.62,200,20,'南极夏季11月至1月，需乘飞机进入',0,'标准路线','内部参考数据'],
      ['科修斯科山','Mount Kosciuszko',2228,'澳大利亚','大洋洲','较易','https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800','continental','seven_summits','澳大利亚最高峰，大洋洲屋脊。','12月-2月','99%','1840年',0,-36.46,148.26,100000,0,'南半球夏季12月至2月，无技术难度',0,'夏洛特山口步道','内部参考数据'],
      ['厄尔布鲁士山','Mount Elbrus',5642,'俄罗斯','欧洲','中等','https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800','continental','seven_summits','欧洲最高峰，高加索山脉的最高点。','6月-8月','70%','1874年',0,43.35,42.44,15000,800,'夏季6月至8月，南坡有缆车辅助',0,'南坡标准路线/北坡路线','内部参考数据'],
    ];
    // 世界经典雪山
    const builtinWorld = [
      ['丹拿利峰','Denali (McKinley)',6190,'美国','北美洲','难','https://images.unsplash.com/photo-1551632811-561732d1e306?w=800','world','classic','北美洲最高峰，阿拉斯加皇冠，以极端低温和汹涌气候著称。','5月-6月','50%','1913年6月7日',0,63.07,-151.00,1200,80,'5月至6月为窗口期',0,'西山脊/卡希尔顿路线','内部参考数据'],
      ['白朗峰','Mont Blanc',4808,'法国/意大利','欧洲','中等','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','world','classic','西欧最高峰，阿尔卑斯山脉的皇冠，是欧洲最受欢迎的高山攀登目标。','6月-8月','65%','1786年8月8日',0,45.83,6.86,20000,300,'夏季6月至8月',0,'Goûter路线(标准)/Cosmiques山脊','内部参考数据'],
      ['岛峰','Island Peak (Imja Tse)',6189,'尼泊尔','亚洲','中等','https://images.unsplash.com/photo-1551632811-561732d1e306?w=800','world','classic','适合高海拔攀登入门的经典路线，是珠峰大本营徒步的绝佳补充。','4月-5月、10月-11月','75%','1953年',0,27.93,86.92,2000,150,'春季4月底至5月；秋季10月至11月初',0,'标准路线/西壁','内部参考数据'],
      ['梅拉峰','Mera Peak',6461,'尼泊尔','亚洲','中等','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800','world','classic','尼泊尔最高的攀登峰之一，技术要求相对较低。','4月-5月、10月-11月','70%','1953年',0,27.70,86.90,1500,100,'春季4月至5月；秋季10月至11月',0,'标准路线(北侧)','内部参考数据'],
      ['乞力马扎罗山','Kilimanjaro',5895,'坦桑尼亚','非洲','较易','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800','world','classic','非洲最高峰，赤道雪山奇观，每年数万人攀登。','1月-3月、6月-10月','65%','1889年',0,-3.07,37.35,35000,2000,'旱季1-3月及6-10月最佳',0,'Marangu/Machame/Lemosho路线','内部参考数据'],
      ['钦博拉索山','Chimborazo',6263,'厄瓜多尔','南美洲','较难','https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800','world','classic','厄瓜多尔最高峰，从地球中心算起是离地球最远的点。','11月-2月、6月-9月','60%','1880年',0,-1.47,-78.82,500,30,'旱季11月至2月及6月至9月',0,'标准路线(Whymper路线)','内部参考数据'],
      ['阿空加瓜峰','Aconcagua',6961,'阿根廷','南美洲','中等','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','world','classic','南美洲最高峰，西半球最高峰，七大洲最高峰之一。','12月-2月','35%','1897年',0,-32.65,-70.01,3000,120,'南半球夏季12月至2月',0,'标准路线(普通路线)/波兰冰川','内部参考数据'],
      ['厄尔布鲁士山','Elbrus',5642,'俄罗斯','欧洲','中等','https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800','world','classic','欧洲最高峰，高加索山脉的皇冠，每年吸引数万名攀登者。','6月-8月','70%','1874年',0,43.35,42.44,15000,800,'夏季6月至8月，南坡有缆车辅助',0,'南坡标准路线/北坡路线','内部参考数据'],
    ];
    // 技术攀登胜地
    const builtinAlpine = [
      ['塞罗托雷峰','Cerro Torre',3128,'阿根廷/智利','南美洲','极难','https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=800','alpine','technical','巴塔哥尼亚最难攀登的山峰之一，凭借不可思议的垂直花岗岩柱和极端天气闻名于世。','11月-2月','15%','1959年',0,-49.28,-73.11,50,3,'南半球夏季11月至2月',0,'Compressor路线/Ferrari路线','内部参考数据'],
      ['艾格峰','Eiger',3967,'瑞士','欧洲','极难','https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800','alpine','technical','阿尔卑斯三北壁之一，北壁是世界上最著名的技术路线之一。','7月-8月','30%','1938年',0,46.58,8.00,200,15,'夏季7月至8月',0,'北壁(Heckmair路线)/西山脊','内部参考数据'],
      ['马特洪峰','Matterhorn',4478,'瑞士/意大利','欧洲','难','https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800','alpine','technical','阿尔卑斯山脉标志性山峰，四壁形状各异，每年吸引数千名攀登者。','7月-9月','50%','1865年7月14日',0,45.98,7.66,3000,200,'夏季7月至9月',0,'霍恩利山脊(标准)/北壁','内部参考数据'],
      ['阿玛达布拉姆峰','Ama Dablam',6814,'尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800','alpine','technical','被誉为喜马拉雅山脉最美的山峰，是高海拔技术攀登的经典考验。','10月-12月、3月-5月','65%','1961年',0,27.86,86.86,350,30,'秋季10月至12月初；春季3月至5月中旬',0,'西南山脊路线','内部参考数据'],
      ['菲茨罗伊峰','Fitz Roy',3405,'阿根廷/智利','南美洲','极难','https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800','alpine','technical','巴塔哥尼亚的花岗岩巨柱，恶劣多变的天气与垂直岩壁使其成为技术攀登终极挑战。','11月-3月','10%','1952年',0,-49.27,-73.04,80,5,'南半球夏季11月至3月',0,'Supercanaleta路线/Franco-Argentina路线','内部参考数据'],
      ['詹努峰','Jannu',7711,'尼泊尔','亚洲','极难','https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800','alpine','technical','尼泊尔东部的技术山峰，其北壁被誉为喜马拉雅最雄伟的岩壁之一。','4月-5月','20%','1962年',0,27.68,88.05,15,1,'春季4月底至5月中旬窗口期',0,'西南山脊/北壁','内部参考数据'],
      ['拉托克I峰','Latok I',7145,'巴基斯坦','亚洲','极难','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800','alpine','technical','喀喇昆仑山脉著名技术山峰，北山脊路线是登山史上最具挑战性的项目之一。','6月-8月','10%','2018年',0,35.81,76.39,10,1,'夏季7月至8月为最佳窗口',0,'北山脊/南山脊','内部参考数据'],
      ['梅鲁峰','Meru Peak',6476,'印度','亚洲','极难','https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800','alpine','technical','喜马拉雅山脉中技术难度最高的山峰之一，"鲨鱼鳍"路线是最大挑战。','4月-5月、9月-10月','15%','2011年',0,30.88,79.10,20,2,'春季4月底至5月；秋季9月至10月中旬',0,'鲨鱼鳍(中间峰)/Merrows Buttress','内部参考数据'],
    ];
    for (const p of [...builtinPeaks8000, ...builtinContinental, ...builtinWorld, ...builtinAlpine]) {
      insertBuiltinPeak.run(...p);
    }
    console.log('✅ 内置山峰数据填充完成');
  }
}

// ── 内置俱乐部数据（首次启动时自动填充）──────────────────────────────────
{
  const clubSeed = db.prepare('SELECT COUNT(*) as cnt FROM clubs').get();
  if (clubSeed.cnt === 0) {
    const insertBuiltinClub = db.prepare(`
      INSERT OR IGNORE INTO clubs (name, description, cover, specialty, region, type, contact, verified, members_count, expeditions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'active')
    `);
    insertBuiltinClub.run('珠峰探险公司', '专注于喜马拉雅8000米峰商业远征，拥有15年运营经验，成功率高达90%', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', '8000m峰', '尼泊尔', '专业', '+977-1-4416388', 320, 18);
    insertBuiltinClub.run('高山探险服务公司', '国内最大的商业攀登服务商，覆盖喜马拉雅、喀喇昆仑等区域', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', '综合攀登', '中国', '专业', '010-88881234', 560, 42);
    insertBuiltinClub.run('成都川西登山学校', '专注于四川境内技术攀登和培训，幺妹峰、四姑娘山等线路专家', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', '技术攀登', '四川', '综合', '028-88886666', 430, 67);
    insertBuiltinClub.run('喜马拉雅探险队', '专业的喜马拉雅远征组织，曾多次带队登顶8000米峰', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', '喜马拉雅', '尼泊尔/中国', '专业', '+977-1-4001234', 890, 28);
    insertBuiltinClub.run('北京户外探险队', '以休闲户外和中低海拔攀登为主，适合初学者', 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=400', '中低海拔', '北京', '休闲', '010-66661234', 1280, 120);
    insertBuiltinClub.run('成都山地俱乐部', '专注于川西高原和横断山脉攀登的本地俱乐部', 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400', '川西高原', '四川', '区域', '028-66662345', 450, 35);
    console.log('✅ 内置俱乐部数据填充完成');
  }
}

// ── 内置向导数据（首次启动时自动填充）──────────────────────────────────
{
  const guideSeed = db.prepare('SELECT COUNT(*) as cnt FROM guides').get();
  if (guideSeed.cnt === 0) {
    const insertBuiltinGuide = db.prepare(`
      INSERT OR IGNORE INTO guides (name, avatar, flag, nationality, rating, reviews, specialty, day_rate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved')
    `);
    insertBuiltinGuide.run('扎西旺堆', 'https://i.pravatar.cc/150?u=guide1', '🇨🇳', '中国', 4.9, 87, '珠峰/洛子峰', 3500);
    insertBuiltinGuide.run('Ang Dorji', 'https://i.pravatar.cc/150?u=guide2', '🇳🇵', '尼泊尔', 4.8, 143, 'K2/南迦帕尔巴特', 4200);
    insertBuiltinGuide.run('Marc Dubois', 'https://i.pravatar.cc/150?u=guide3', '🇫🇷', '法国', 4.7, 62, '阿尔卑斯技术攀登', 2800);
    insertBuiltinGuide.run('Ibrahim Dağ', 'https://i.pravatar.cc/150?u=guide4', '🇹🇷', '土耳其', 4.6, 38, '安纳托利亚/高加索', 2200);
    insertBuiltinGuide.run('索南仁增', 'https://i.pravatar.cc/150?u=guide5', '🇨🇳', '中国', 4.9, 115, '西藏8000米峰', 3800);
    insertBuiltinGuide.run('Pemba Sherpa', 'https://i.pravatar.cc/150?u=guide6', '🇳🇵', '尼泊尔', 5.0, 201, '全喜马拉雅', 5000);
    console.log('✅ 内置向导数据填充完成');
  }
}

// ── 内置装备数据（首次启动时自动填充）──────────────────────────────────
{
  const gearSeed = db.prepare('SELECT COUNT(*) as cnt FROM gear').get();
  if (gearSeed.cnt === 0) {
    const insertBuiltinGear = db.prepare(`
      INSERT OR IGNORE INTO gear (name, brand, price, condition_text, image, description, mode, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // 新品
    insertBuiltinGear.run('Petzl SARKEN冰爪', 'Petzl', 1580, '全新', 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400', '轻量化10爪，高山远征专用，与B/D型登山靴兼容', 'buy', '冰斧');
    insertBuiltinGear.run('Black Diamond Raven冰镐', 'Black Diamond', 890, '全新', 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', '经典高山冰镐，75cm直柄，适合高海拔攀登', 'buy', '冰斧');
    insertBuiltinGear.run('Mammut Nordwand 8.0绳', 'Mammut', 1290, '全新', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400', '8.0mm干处理动力绳，60m，适合高山攀登', 'buy', '绳索');
    insertBuiltinGear.run('La Sportiva G2 SM登山靴', 'La Sportiva', 4680, '全新', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', '8000米级双层高山靴，-40°C保暖等级', 'buy', '鞋靴');
    insertBuiltinGear.run('Arc\'teryx Alpha SV冲锋衣', 'Arc\'teryx', 5800, '全新', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', 'Gore-Tex Pro面料，顶级防水透气性能', 'buy', '服装');
    insertBuiltinGear.run('MSR Remote 3帐篷', 'MSR', 3990, '全新', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', '三人高山帐篷，抗风性能卓越，适合极端环境', 'buy', '帐篷');
    insertBuiltinGear.run('Osprey Aether 65背包', 'Osprey', 1580, '全新', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400', '65升登山背包，AirSpeed透气背负系统', 'buy', '背包');
    insertBuiltinGear.run('Rab Neutrino Pro羽绒服', 'Rab', 2890, '全新', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400', '800蓬鹅绒，-30°C适用，高海拔营地保暖', 'buy', '保暖');
    // 二手
    insertBuiltinGear.run('CAMP Corsa Nanotech冰镐(二手)', 'CAMP', 320, '九成新', 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', '使用两次，无划痕，含保护套', 'used', '冰斧');
    insertBuiltinGear.run('Salewa Wildfire岩靴(二手)', 'Salewa', 450, '八成新', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', '尺码41，鞋底约80%剩余，适合裂缝攀登', 'used', '鞋靴');
    insertBuiltinGear.run('Patagonia Nano Puff保暖服(二手)', 'Patagonia', 680, '九成新', 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400', 'M码，仅穿过3次，无损坏', 'used', '保暖');
    insertBuiltinGear.run('Mammut Trion Guide 35背包(二手)', 'Mammut', 890, '九成新', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400', '35升轻量攀登包，一季使用，背负系统完好', 'used', '背包');
    console.log('✅ 内置装备数据填充完成');
  }
}

// ── 内置用户数据（首次启动时自动填充，用于测试和演示）──────────────────────
{
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount.cnt === 0) {
    // 预计算的 bcrypt hash（password: 123456, saltRounds: 10）
    const testPasswordHash = '$2b$10$2HlgzoX/NiELdTS7/WZgSOIFkGS0B/HL27ohJe13NcxmGksfjBZf6';
    db.prepare(`
      INSERT OR IGNORE INTO users (name, username, phone, password, avatar, level, summits, expeditions, followers, following)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '张伟', '@zhangwei_climbs', '13800138000', testPasswordHash,
      'https://i.pravatar.cc/150?u=zhangwei',
      '专业攀登者', 12, 8, 1247, 386
    );
    console.log('✅ 内置用户数据填充完成');

    // ── 内置帖子（首次启动时自动填充，须在用户之后）
    const userId = db.prepare('SELECT id FROM users WHERE phone = ?').get('13800138000').id;
    const insertBuiltinPost = db.prepare(`
      INSERT OR IGNORE INTO posts (user_id, author_name, author_avatar, content, location, likes, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertBuiltinPost.run(userId, '张伟', 'https://i.pravatar.cc/150?u=zhangwei',
      '刚刚完成了珠峰大本营徒步，海拔5364米，风景壮丽！明年计划挑战洛子峰 💪', '尼泊尔·珠峰大本营', 128, 24);
    insertBuiltinPost.run(userId, '张伟', 'https://i.pravatar.cc/150?u=zhangwei',
      '分享一组马卡鲁峰照片，这次远征历时45天，成功登顶！感谢队友们的配合 🏔️', '尼泊尔·马卡鲁峰', 86, 17);
    insertBuiltinPost.run(userId, '张伟', 'https://i.pravatar.cc/150?u=zhangwei',
      '推荐一条适合初学者的高海拔路线：四姑娘山二峰（5276m），难度适中，风景极佳', '四川·四姑娘山', 214, 42);
    console.log('✅ 内置帖子数据填充完成');

    // ── 内置队伍（首次启动时自动填充，须在用户之后）
    const insertBuiltinTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (name, peak, date, spots, total_spots, level, leader, leader_avatar, leader_id, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBuiltinTeam.run('珠峰大本营探险队', '珠穆朗玛峰', '2026-05-15', 4, 6, '中等',
      '张伟', 'https://i.pravatar.cc/150?u=zhangwei', userId,
      '招募有高海拔经验的攀登者，目标珠峰大本营（5364m），行程21天，含向导和装备', 'recruiting');
    insertBuiltinTeam.run('乞力马扎罗登顶计划', '乞力马扎罗山', '2026-06-20', 5, 8, '较易',
      '张伟', 'https://i.pravatar.cc/150?u=zhangwei', userId,
      '非洲最高峰，海拔5895米，无技术难度，适合登山爱好者首次高海拔体验，行程7天', 'recruiting');
    insertBuiltinTeam.run('阿尔卑斯白朗峰技术攀登', '白朗峰', '2026-08-05', 2, 4, '中等',
      '张伟', 'https://i.pravatar.cc/150?u=zhangwei', userId,
      '西欧最高峰（4808m），Goûter路线，需要基本冰雪技术，行程5天含适应期', 'recruiting');
    console.log('✅ 内置队伍数据填充完成');
  }
}

// ── 数据修正：将内置向导的 'available' 状态修正为 'approved' ──────────────
db.prepare("UPDATE guides SET status = 'approved' WHERE status = 'available'").run();

// 迁移：sos_records 表补充 status 字段
const existingSosCols = db.pragma('table_info(sos_records)').map(c => c.name);
if (!existingSosCols.includes('status')) {
  db.exec("ALTER TABLE sos_records ADD COLUMN status TEXT DEFAULT 'pending'");
}

// 迁移：guides 表补充认证年费字段
const existingGuideCols3 = db.pragma('table_info(guides)').map(c => c.name);
if (!existingGuideCols3.includes('cert_level')) {
  db.exec("ALTER TABLE guides ADD COLUMN cert_level TEXT DEFAULT 'basic'");
}
if (!existingGuideCols3.includes('cert_expires_at')) {
  db.exec('ALTER TABLE guides ADD COLUMN cert_expires_at TEXT');
}
if (!existingGuideCols3.includes('cert_year_fee')) {
  db.exec('ALTER TABLE guides ADD COLUMN cert_year_fee INTEGER DEFAULT 299');
}
if (!existingGuideCols3.includes('listing_fee_paid')) {
  db.exec('ALTER TABLE guides ADD COLUMN listing_fee_paid INTEGER DEFAULT 0');
}

// 迁移：clubs 表补充认证年费字段
const existingClubCols3 = db.pragma('table_info(clubs)').map(c => c.name);
if (!existingClubCols3.includes('cert_level')) {
  db.exec("ALTER TABLE clubs ADD COLUMN cert_level TEXT DEFAULT 'standard'");
}
if (!existingClubCols3.includes('cert_expires_at')) {
  db.exec('ALTER TABLE clubs ADD COLUMN cert_expires_at TEXT');
}
if (!existingClubCols3.includes('cert_year_fee')) {
  db.exec('ALTER TABLE clubs ADD COLUMN cert_year_fee INTEGER DEFAULT 999');
}
if (!existingClubCols3.includes('listing_fee_paid')) {
  db.exec('ALTER TABLE clubs ADD COLUMN listing_fee_paid INTEGER DEFAULT 0');
}

// 迁移：guide_applications 表补充 cert_level 字段
const existingGuideAppColsCert = db.pragma('table_info(guide_applications)').map(c => c.name);
if (!existingGuideAppColsCert.includes('cert_level')) {
  db.exec("ALTER TABLE guide_applications ADD COLUMN cert_level TEXT DEFAULT 'basic'");
}

// 迁移：club_applications 表补充 cert_level 字段
const existingClubAppColsCert = db.pragma('table_info(club_applications)').map(c => c.name);
if (!existingClubAppColsCert.includes('cert_level')) {
  db.exec("ALTER TABLE club_applications ADD COLUMN cert_level TEXT DEFAULT 'standard'");
}

// 新增表：结算账户、提现申请、平台资金流水
db.exec(`
CREATE TABLE IF NOT EXISTS settlement_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  bank_name TEXT,
  bank_account TEXT,
  bank_account_name TEXT,
  alipay TEXT,
  wechat_pay TEXT,
  is_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  fee REAL DEFAULT 0,
  actual_amount REAL NOT NULL,
  account_type TEXT DEFAULT 'bank',
  account_info TEXT,
  status TEXT DEFAULT 'pending',
  reject_reason TEXT,
  processed_at DATETIME,
  processed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_type TEXT NOT NULL,
  order_id INTEGER NOT NULL,
  order_no TEXT,
  user_id INTEGER,
  owner_type TEXT,
  owner_id INTEGER,
  total_amount REAL NOT NULL,
  platform_fee REAL DEFAULT 0,
  owner_income REAL DEFAULT 0,
  commission_rate REAL DEFAULT 0.15,
  status TEXT DEFAULT 'held',
  settled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ── 2026 Migrations ─────────────────────────────────────────────

// Extend messages table
const msgCols = db.pragma('table_info(messages)').map(c => c.name);
if (!msgCols.includes('recalled_at')) db.exec("ALTER TABLE messages ADD COLUMN recalled_at DATETIME");
if (!msgCols.includes('reply_to_id')) db.exec("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER");
if (!msgCols.includes('content_json')) db.exec("ALTER TABLE messages ADD COLUMN content_json TEXT");

// Extend conversations table
const convCols = db.pragma('table_info(conversations)').map(c => c.name);
if (!convCols.includes('type')) db.exec("ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'dm'");
if (!convCols.includes('name')) db.exec("ALTER TABLE conversations ADD COLUMN name TEXT");
if (!convCols.includes('owner_id')) db.exec("ALTER TABLE conversations ADD COLUMN owner_id INTEGER");
if (!convCols.includes('last_msg_at')) db.exec("ALTER TABLE conversations ADD COLUMN last_msg_at DATETIME");

// New tables: message_reads, conversation_members
db.exec(`
CREATE TABLE IF NOT EXISTS message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  msg_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(msg_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversation_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  muted INTEGER DEFAULT 0,
  last_read_msg_id INTEGER,
  UNIQUE(conv_id, user_id)
);
`);

// Extend peaks table
const peakCols = db.pragma('table_info(peaks)').map(c => c.name);
if (!peakCols.includes('first_ascent_year')) db.exec("ALTER TABLE peaks ADD COLUMN first_ascent_year INTEGER");
if (!peakCols.includes('first_ascent_team')) db.exec("ALTER TABLE peaks ADD COLUMN first_ascent_team TEXT");
if (!peakCols.includes('death_rate')) db.exec("ALTER TABLE peaks ADD COLUMN death_rate REAL");
if (!peakCols.includes('best_months')) db.exec("ALTER TABLE peaks ADD COLUMN best_months TEXT");
if (!peakCols.includes('routes_json')) db.exec("ALTER TABLE peaks ADD COLUMN routes_json TEXT");
if (!peakCols.includes('contour_svg')) db.exec("ALTER TABLE peaks ADD COLUMN contour_svg TEXT");
if (!peakCols.includes('stories_json')) db.exec("ALTER TABLE peaks ADD COLUMN stories_json TEXT");
if (!peakCols.includes('region')) db.exec("ALTER TABLE peaks ADD COLUMN region TEXT");

// New tables for mountains, feed, badges
db.exec(`
CREATE TABLE IF NOT EXISTS mountain_wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peak_id INTEGER NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, peak_id)
);

CREATE TABLE IF NOT EXISTS mountain_footprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peak_id INTEGER NOT NULL,
  summit_date TEXT,
  story TEXT,
  photo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  icon TEXT,
  category TEXT,
  condition_type TEXT,
  condition_value INTEGER,
  tier TEXT DEFAULT 'silver'
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress INTEGER DEFAULT 0,
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  media_type TEXT DEFAULT 'image',
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS feed_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL UNIQUE,
  score REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Seed badges
const badgeCount = db.prepare('SELECT COUNT(*) as cnt FROM badges').get();
if (badgeCount.cnt === 0) {
  const insertBadge = db.prepare(`INSERT INTO badges (name, name_en, description, icon, category, condition_type, condition_value, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insertBadge.run('3000米俱乐部', '3000m Club', '首次登顶海拔3000米以上山峰', '🏔️', 'altitude', 'summit_altitude', 3000, 'bronze');
  insertBadge.run('5000米俱乐部', '5000m Club', '首次登顶海拔5000米以上山峰', '🏔️', 'altitude', 'summit_altitude', 5000, 'silver');
  insertBadge.run('6000米俱乐部', '6000m Club', '首次登顶海拔6000米以上山峰', '⛰️', 'altitude', 'summit_altitude', 6000, 'silver');
  insertBadge.run('7000米俱乐部', '7000m Club', '首次登顶海拔7000米以上山峰', '🗻', 'altitude', 'summit_altitude', 7000, 'gold');
  insertBadge.run('8000米俱乐部', '8000m Club', '首次登顶海拔8000米以上山峰', '🌟', 'altitude', 'summit_altitude', 8000, 'platinum');
  insertBadge.run('亚洲之巅', 'Asia Summit', '登顶珠穆朗玛峰 - 亚洲最高峰', '🇨🇳', 'seven_summits', 'peak_id', 1, 'gold');
  insertBadge.run('欧洲之巅', 'Europe Summit', '登顶厄尔布鲁士峰 - 欧洲最高峰', '🇷🇺', 'seven_summits', 'peak_id', 2, 'gold');
  insertBadge.run('非洲之巅', 'Africa Summit', '登顶乞力马扎罗山 - 非洲最高峰', '🌍', 'seven_summits', 'peak_id', 3, 'gold');
  insertBadge.run('北美之巅', 'North America Summit', '登顶迪纳利峰 - 北美最高峰', '🦅', 'seven_summits', 'peak_id', 4, 'gold');
  insertBadge.run('南美之巅', 'South America Summit', '登顶阿空加瓜峰 - 南美最高峰', '🌎', 'seven_summits', 'peak_id', 5, 'gold');
  insertBadge.run('大洋洲之巅', 'Oceania Summit', '登顶查亚峰 - 大洋洲最高峰', '🦘', 'seven_summits', 'peak_id', 6, 'gold');
  insertBadge.run('南极之巅', 'Antarctica Summit', '登顶文森峰 - 南极洲最高峰', '🐧', 'seven_summits', 'peak_id', 7, 'gold');
  insertBadge.run('14座8000米峰', '14 Eight-Thousanders', '登顶全部14座海拔8000米以上山峰', '👑', '14peaks', 'peak_count', 14, 'platinum');
  insertBadge.run('冰壁猎手', 'Ice Hunter', '完成冰壁攀登技术认证', '🧊', 'technical', 'skill_type', 0, 'silver');
  insertBadge.run('大岩壁征服者', 'Big Wall Conqueror', '完成大岩壁攀登', '🧗', 'technical', 'skill_type', 1, 'gold');
  insertBadge.run('混合攀登达人', 'Mixed Climbing Expert', '完成混合地形攀登', '🔨', 'technical', 'skill_type', 2, 'silver');
  insertBadge.run('夜行者', 'Night Climber', '完成夜间攀登', '🌙', 'technical', 'skill_type', 3, 'silver');
  insertBadge.run('百人领队', 'Team Leader 100', '组织超过10次队伍活动且参与者累计100人', '👥', 'club', 'team_count', 10, 'gold');
  insertBadge.run('紧急救援者', 'SOS Rescuer', '参与紧急救援行动', '🆘', 'club', 'sos_count', 1, 'gold');
  insertBadge.run('初心', 'First Post', '发布第一条动态', '📝', 'social', 'post_count', 1, 'bronze');
  insertBadge.run('百赞达人', '100 Likes', '累计获得100个赞', '❤️', 'social', 'likes_count', 100, 'silver');
  insertBadge.run('千粉达人', '1000 Followers', '获得1000位粉丝', '⭐', 'social', 'followers_count', 1000, 'gold');
  console.log('✅ 徽章种子数据填充完成');
}

module.exports = db;

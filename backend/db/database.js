const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'summitlink.db'));

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
if (!existingGuideCols2.includes('affiliation_club_id')) {
  db.exec('ALTER TABLE guides ADD COLUMN affiliation_club_id INTEGER DEFAULT NULL');
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

module.exports = db;

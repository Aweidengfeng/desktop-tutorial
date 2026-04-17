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

module.exports = db;

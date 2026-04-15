const bcrypt = require('bcrypt');
const db = require('./database');

// 检查是否已有数据，避免重复插入
const peakCount = db.prepare('SELECT COUNT(*) as cnt FROM peaks').get();
if (peakCount.cnt > 0) {
  console.log('ℹ️  数据库已有数据，跳过填充。');
  process.exit(0);
}

console.log('📦 开始填充示例数据...');

// ── 默认用户 ──────────────────────────────────────────────
const passwordHash = bcrypt.hashSync('123456', 10);
db.prepare(`
  INSERT INTO users (name, username, phone, password, avatar, level, summits, expeditions, followers, following)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  '张伟', '@zhangwei_climbs', '13800138000', passwordHash,
  'https://i.pravatar.cc/150?u=zhangwei',
  '专业攀登者', 12, 8, 1247, 386
);

// ── 山峰：8000米巨峰 ──────────────────────────────────────
const insertPeak = db.prepare(`
  INSERT INTO peaks (name, name_en, altitude, country, continent, difficulty, image, type, description, best_season, success_rate, first_ascent, deaths)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const peaks8000 = [
  ['珠穆朗玛峰', 'Mount Everest', 8849, '中国/尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', '8000ers',
   '世界最高峰，位于中尼边境，是无数攀登者毕生的梦想。', '5月、10月', '29%', '1953年5月29日', 310],
  ['K2', 'K2', 8611, '巴基斯坦/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', '8000ers',
   '世界第二高峰，被誉为"野蛮巨峰"，技术难度极高。', '7月-8月', '25%', '1954年7月31日', 87],
  ['干城章嘉峰', 'Kangchenjunga', 8586, '尼泊尔/印度', '亚洲', '极难',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', '8000ers',
   '世界第三高峰，位于尼泊尔与印度边境。', '5月、10月', '38%', '1955年5月25日', 45],
  ['洛子峰', 'Lhotse', 8516, '尼泊尔/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', '8000ers',
   '世界第四高峰，与珠峰共享南坳路线。', '5月', '65%', '1956年5月18日', 13],
  ['马卡鲁峰', 'Makalu', 8485, '尼泊尔/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', '8000ers',
   '世界第五高峰，以陡峭的山脊和孤立的山体著称。', '5月、10月', '40%', '1955年5月15日', 30],
  ['卓奥友峰', 'Cho Oyu', 8188, '中国/尼泊尔', '亚洲', '难',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', '8000ers',
   '世界第六高峰，8000米山峰中技术难度相对较低。', '9月-10月', '56%', '1954年10月19日', 42],
  ['道拉吉里峰', 'Dhaulagiri', 8167, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', '8000ers',
   '世界第七高峰，以多变的天气和崩雪风险闻名。', '5月、10月', '42%', '1960年5月13日', 71],
  ['马纳斯卢峰', 'Manaslu', 8163, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', '8000ers',
   '世界第八高峰，尼泊尔语意为"灵魂之山"。', '5月、10月', '56%', '1956年5月9日', 68],
];

for (const p of peaks8000) insertPeak.run(...p);

// ── 洲最高峰 ────────────────────────────────────────────────
const continentalPeaks = [
  ['珠穆朗玛峰', 'Mount Everest', 8849, '中国/尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', 'continental',
   '亚洲最高峰，世界之巅。', '5月、10月', '29%', '1953年5月29日', 310],
  ['麦金利山', 'Denali', 6190, '美国', '北美洲', '难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'continental',
   '北美洲最高峰，阿拉斯加的皇冠。', '5月-7月', '50%', '1913年', 0],
  ['阿空加瓜峰', 'Aconcagua', 6961, '阿根廷', '南美洲', '中等',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'continental',
   '南美洲最高峰，七大洲最高峰中除亚洲外最高。', '12月-2月', '35%', '1897年', 0],
  ['乞力马扎罗山', 'Kilimanjaro', 5895, '坦桑尼亚', '非洲', '较易',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'continental',
   '非洲最高峰，赤道雪山奇观。', '1月-3月、6月-10月', '65%', '1889年', 0],
  ['文森峰', 'Vinson Massif', 4892, '南极洲', '南极洲', '极难',
   'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', 'continental',
   '南极洲最高峰，七大洲最高峰之一。', '11月-1月', '80%', '1966年', 0],
  ['科修斯科山', 'Mount Kosciuszko', 2228, '澳大利亚', '大洋洲', '较易',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', 'continental',
   '澳大利亚最高峰，大洋洲屋脊。', '12月-2月', '99%', '1840年', 0],
  ['厄尔布鲁士山', 'Mount Elbrus', 5642, '俄罗斯', '欧洲', '中等',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', 'continental',
   '欧洲最高峰，高加索山脉的最高点。', '6月-8月', '70%', '1874年', 0],
];

for (const p of continentalPeaks) insertPeak.run(...p);

// ── 世界名峰 ────────────────────────────────────────────────
const worldPeaks = [
  ['梅鲁峰', 'Meru Peak', 6476, '印度', '亚洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', 'world',
   '喜马拉雅山脉中技术难度最高的山峰之一，以"蜘蛛"路线闻名。', '5月、10月', '15%', '2011年', 0],
  ['阿玛达布拉姆峰', 'Ama Dablam', 6814, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', 'world',
   '被称为喜马拉雅山脉最美的山峰，造型独特优美。', '10月-12月', '65%', '1961年', 0],
  ['岛峰', 'Island Peak', 6189, '尼泊尔', '亚洲', '中等',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'world',
   '适合高海拔攀登入门的经典路线，从山谷中拔地而起如孤岛。', '5月、10月', '75%', '1953年', 0],
];

for (const p of worldPeaks) insertPeak.run(...p);

// ── 技术攀登胜地 ────────────────────────────────────────────
const alpineSpots = [
  ['玉龙雪山', 'Jade Dragon Snow Mountain', 5596, '中国', '亚洲', '较易',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'alpine',
   '云南丽江的标志性雪山，常年积雪，风景秀丽。', '全年（索道）', '90%', '1987年', 0],
  ['贡嘎山', 'Minya Konka', 7556, '中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', 'alpine',
   '四川第一高峰，被称为"蜀山之王"，技术难度极大。', '4月-5月、9月-10月', '10%', '1932年', 0],
  ['梅里雪山', 'Meili Snow Mountain', 6740, '中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', 'alpine',
   '云南迪庆的神山，藏族圣山，主峰卡瓦格博至今未被登顶。', '观景全年', '0%', '未登顶', 0],
  ['四姑娘山', 'Four Girls Mountain', 6250, '中国', '亚洲', '中等',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'alpine',
   '四川阿坝的"东方阿尔卑斯"，四峰并列，景色壮观。', '5月-10月', '60%', '1981年', 0],
];

for (const p of alpineSpots) insertPeak.run(...p);

// ── 向导数据 ────────────────────────────────────────────────
const insertGuide = db.prepare(`
  INSERT INTO guides (name, avatar, flag, nationality, rating, reviews, specialty, day_rate, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const guides = [
  ['扎西多吉', 'https://i.pravatar.cc/150?u=guide1', '🇨🇳', '中国', 4.9, 128, '高海拔攀登专家', 280, 'approved'],
  ['Ang Dorji', 'https://i.pravatar.cc/150?u=guide2', '🇳🇵', '尼泊尔', 4.8, 256, '珠峰路线向导', 350, 'approved'],
  ['Carlos Mendez', 'https://i.pravatar.cc/150?u=guide3', '🇦🇷', '阿根廷', 4.7, 89, '南美洲高峰专家', 220, 'approved'],
  ['王明', 'https://i.pravatar.cc/150?u=guide4', '🇨🇳', '中国', 4.9, 167, '技术攀岩专家', 300, 'approved'],
  ['Pemba Sherpa', 'https://i.pravatar.cc/150?u=guide5', '🇳🇵', '尼泊尔', 5.0, 312, '喜马拉雅专属向导', 400, 'approved'],
  ['Maria Chen', 'https://i.pravatar.cc/150?u=guide6', '🇺🇸', '美国', 4.6, 94, '阿尔卑斯路线专家', 260, 'approved'],
];

for (const g of guides) insertGuide.run(...g);

// ── 队伍数据 ────────────────────────────────────────────────
const insertTeam = db.prepare(`
  INSERT INTO teams (name, peak, date, spots, total_spots, level, leader, leader_avatar, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const teams = [
  ['珠峰突击队', '珠穆朗玛峰', '2026-05-15', 3, 8, '专业级', '张伟', 'https://i.pravatar.cc/150?u=leader1', 'recruiting'],
  ['K2冬季远征队', 'K2', '2026-12-01', 2, 6, '精英级', '李磊', 'https://i.pravatar.cc/150?u=leader2', 'recruiting'],
  ['七大洲计划', '阿空加瓜峰', '2026-07-20', 5, 10, '中级', '王芳', 'https://i.pravatar.cc/150?u=leader3', 'recruiting'],
];

for (const t of teams) insertTeam.run(...t);

// ── 轨迹数据 ────────────────────────────────────────────────
const insertTrack = db.prepare(`
  INSERT INTO tracks (user_id, name, date, distance, elevation, duration, image)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const tracks = [
  [1, '珠峰大本营徒步', '2026-03-15', 5.2, 1400, '6小时30分', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400'],
  [1, '四姑娘山幺妹峰', '2026-02-08', 8.7, 2100, '9小时15分', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400'],
  [1, '玉龙雪山主峰', '2026-01-20', 3.5, 800, '4小时00分', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400'],
];

for (const t of tracks) insertTrack.run(...t);

// ── 登顶榜 ────────────────────────────────────────────────
const insertRecord = db.prepare(`
  INSERT INTO summit_records (name, avatar, flag, peak, date)
  VALUES (?, ?, ?, ?, ?)
`);

const records = [
  ['张伟', 'https://i.pravatar.cc/150?u=board1', '🇨🇳', '珠穆朗玛峰', '4月12日'],
  ['Ang Dorji', 'https://i.pravatar.cc/150?u=board2', '🇳🇵', 'K2', '4月10日'],
  ['Carlos M.', 'https://i.pravatar.cc/150?u=board3', '🇦🇷', '阿空加瓜峰', '4月8日'],
  ['李磊', 'https://i.pravatar.cc/150?u=board4', '🇨🇳', '干城章嘉峰', '4月5日'],
  ['Maria C.', 'https://i.pravatar.cc/150?u=board5', '🇺🇸', '麦金利山', '4月3日'],
];

for (const r of records) insertRecord.run(...r);

// ── 装备数据 ────────────────────────────────────────────────
const insertGear = db.prepare(`
  INSERT INTO gear (name, brand, price, condition_text, image, mode, category)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const gearItems = [
  ['Black Diamond 冰斧', 'Black Diamond', 1280, '全新', 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400', 'buy', '冰斧'],
  ['Mammut 干绳 60m', 'Mammut', 2580, '全新', 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400', 'buy', '绳索'],
  ['Scarpa 高山靴', 'Scarpa', 3680, '九成新', 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=400', 'used', '鞋靴'],
  ["Arc'teryx 冲锋衣", "Arc'teryx", 4200, '全新', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', 'buy', '服装'],
];

for (const g of gearItems) insertGear.run(...g);

// ── 社区帖子示例 ─────────────────────────────────────────
const insertPost = db.prepare(`
  INSERT INTO posts (user_id, author_name, author_avatar, content, image, location, likes, comments)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const posts = [
  [1, '张伟', 'https://i.pravatar.cc/150?u=zhangwei',
   '今天成功登顶珠穆朗玛峰！历时58天，梦想终于实现！🏔️ #珠峰 #登顶',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', '珠穆朗玛峰 · 8849m', 1328, 89],
  [1, 'Ang Dorji', 'https://i.pravatar.cc/150?u=guide2',
   'K2冬季攀登条件极其恶劣，但我们的队伍做到了！感谢队友的信任和配合💪',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'K2 · 8611m', 956, 67],
  [1, 'Carlos Mendez', 'https://i.pravatar.cc/150?u=guide3',
   '阿空加瓜峰日落太美了，用任何语言都无法形容这种震撼！🌅',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', '阿空加瓜峰 · 6961m', 743, 45],
];

for (const p of posts) insertPost.run(...p);

console.log('✅ 示例数据填充完成！');

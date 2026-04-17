const bcrypt = require('bcrypt');
const db = require('./database');

// 迁移：为已有数据库中的山峰补充经纬度（无论是否已有数据都执行）
const coordsUpdates = [
  ['珠穆朗玛峰', 27.98, 86.92],
  ['K2', 35.88, 76.51],
  ['干城章嘉峰', 27.70, 88.14],
  ['洛子峰', 27.96, 86.93],
  ['马卡鲁峰', 27.89, 87.09],
  ['卓奥友峰', 28.09, 86.66],
  ['道拉吉里峰', 28.70, 83.49],
  ['马纳斯卢峰', 28.55, 84.56],
  ['麦金利山', 63.07, -151.00],
  ['阿空加瓜峰', -32.65, -70.01],
  ['乞力马扎罗山', -3.07, 37.35],
  ['文森峰', -78.53, -85.62],
  ['科修斯科山', -36.46, 148.26],
  ['厄尔布鲁士山', 43.35, 42.44],
  ['梅鲁峰', 30.88, 79.10],
  ['阿玛达布拉姆峰', 27.86, 86.86],
  ['岛峰', 27.93, 86.92],
  ['玉龙雪山', 27.10, 100.22],
  ['贡嘎山', 29.59, 101.88],
  ['梅里雪山', 28.44, 98.68],
  ['四姑娘山', 30.95, 102.97],
  ['南迦帕尔巴特峰', 35.23, 74.58],
  ['安纳普尔纳峰', 28.59, 83.82],
  ['加舒尔布鲁姆I峰', 35.72, 76.69],
  ['布洛阿特峰', 35.81, 76.57],
  ['加舒尔布鲁姆II峰', 35.76, 76.65],
  ['希夏邦马峰', 28.35, 85.78],
];
const updateCoords = db.prepare('UPDATE peaks SET latitude = ?, longitude = ? WHERE name = ? AND (latitude IS NULL OR longitude IS NULL)');
for (const [name, lat, lon] of coordsUpdates) {
  updateCoords.run(lat, lon, name);
}

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
  INSERT INTO peaks (name, name_en, altitude, country, continent, difficulty, image, type, description, best_season, success_rate, first_ascent, deaths, latitude, longitude,
                     annual_climbers, commercial_teams, season_detail, supplemental_oxygen, main_route, data_source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const peaks8000 = [
  // name, nameEn, alt, country, continent, diff, image, type, desc, bestSeason, successRate, firstAscent, deaths, lat, lon,
  // annualClimbers, commercialTeams, seasonDetail, oxygen, mainRoute, dataSource
  ['珠穆朗玛峰', 'Mount Everest', 8849, '中国/尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', '8000ers',
   '世界最高峰，位于中尼边境，是无数攀登者毕生的梦想。', '5月、10月', '29%', '1953年5月29日', 310, 27.98, 86.92,
   800, 35, '春季窗口期4月下旬至5月中旬，秋季窗口10月', 1, '东南山脊(南坡)/东北山脊(北坡)', '内部参考数据'],
  ['K2', 'K2', 8611, '巴基斯坦/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', '8000ers',
   '世界第二高峰，被誉为"野蛮巨峰"，技术难度极高。', '7月-8月', '25%', '1954年7月31日', 87, 35.88, 76.51,
   150, 12, '夏季窗口期7月中旬至8月中旬', 0, 'Abruzzi山脊路线', '内部参考数据'],
  ['干城章嘉峰', 'Kangchenjunga', 8586, '尼泊尔/印度', '亚洲', '极难',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', '8000ers',
   '世界第三高峰，位于尼泊尔与印度边境。', '5月、10月', '38%', '1955年5月25日', 45, 27.70, 88.14,
   80, 6, '春季4-5月；秋季10月', 1, '西南壁路线', '内部参考数据'],
  ['洛子峰', 'Lhotse', 8516, '尼泊尔/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', '8000ers',
   '世界第四高峰，与珠峰共享南坳路线。', '5月', '65%', '1956年5月18日', 13, 27.96, 86.93,
   200, 15, '春季4月底至5月中旬', 1, '西壁/Couloir路线', '内部参考数据'],
  ['马卡鲁峰', 'Makalu', 8485, '尼泊尔/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', '8000ers',
   '世界第五高峰，以陡峭的山脊和孤立的山体著称。', '5月、10月', '40%', '1955年5月15日', 30, 27.89, 87.09,
   70, 5, '春季4月底至5月；秋季10月', 1, '北坡/西北山脊', '内部参考数据'],
  ['卓奥友峰', 'Cho Oyu', 8188, '中国/尼泊尔', '亚洲', '难',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', '8000ers',
   '世界第六高峰，8000米山峰中技术难度相对较低。', '9月-10月', '56%', '1954年10月19日', 42, 28.09, 86.66,
   300, 25, '秋季9月底至10月中旬', 0, '西北山脊路线', '内部参考数据'],
  ['道拉吉里峰', 'Dhaulagiri', 8167, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', '8000ers',
   '世界第七高峰，以多变的天气和崩雪风险闻名。', '5月、10月', '42%', '1960年5月13日', 71, 28.70, 83.49,
   90, 7, '春季4月底至5月', 0, '东北山脊路线', '内部参考数据'],
  ['马纳斯卢峰', 'Manaslu', 8163, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', '8000ers',
   '世界第八高峰，尼泊尔语意为"灵魂之山"。', '5月、10月', '56%', '1956年5月9日', 68, 28.55, 84.56,
   400, 30, '秋季9月底至10月中旬', 0, '东北面/东北山脊', '内部参考数据'],
  ['南迦帕尔巴特峰', 'Nanga Parbat', 8126, '巴基斯坦', '亚洲', '极难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', '8000ers',
   '被称为"杀人山"，技术极难，死亡率极高。', '7月', '15%', '1953年', 239, 35.23, 74.58,
   60, 5, '夏季7月中旬至8月', 0, 'Kinshofer路线/鲁帕尔壁', '内部参考数据'],
  ['安纳普尔纳峰', 'Annapurna', 8091, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', '8000ers',
   '世界第十高峰，死亡率曾是8000米山峰中最高。', '5月、10月', '38%', '1950年', 72, 28.59, 83.82,
   60, 5, '春季4月底至5月中旬', 0, '北壁路线', '内部参考数据'],
  ['加舒尔布鲁姆I峰', 'Gasherbrum I', 8080, '巴基斯坦/中国', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', '8000ers',
   '巴托罗冰川区最险峻的山峰之一。', '7月', '38%', '1958年', 29, 35.72, 76.69,
   50, 4, '夏季7月至8月初', 0, '美国路线/西北壁', '内部参考数据'],
  ['布洛阿特峰', 'Broad Peak', 8051, '巴基斯坦/中国', '亚洲', '难',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', '8000ers',
   '与K2相邻，路线相对温和。', '7月', '52%', '1957年', 21, 35.81, 76.57,
   120, 10, '夏季7月中旬至8月初', 0, '普通路线/西壁', '内部参考数据'],
  ['加舒尔布鲁姆II峰', 'Gasherbrum II', 8034, '巴基斯坦/中国', '亚洲', '难',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', '8000ers',
   '8000米山峰中成功率较高的山峰之一。', '7月', '65%', '1956年', 24, 35.76, 76.65,
   180, 14, '夏季7月至8月', 0, '西南壁路线', '内部参考数据'],
  ['希夏邦马峰', 'Shishapangma', 8027, '中国', '亚洲', '难',
   'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=800', '8000ers',
   '唯一完全位于中国境内的八千米级高峰，目前对外国人攀登有限制。', '5月、10月', '49%', '1964年', 25, 28.35, 85.78,
   150, 12, '春季5月；秋季9月底至10月', 0, '北坡/西南壁', '内部参考数据'],
];

for (const p of peaks8000) insertPeak.run(...p);

// ── 洲最高峰 ────────────────────────────────────────────────
const continentalPeaks = [
  ['珠穆朗玛峰', 'Mount Everest', 8849, '中国/尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', 'continental',
   '亚洲最高峰，世界之巅。', '5月、10月', '29%', '1953年5月29日', 310, 27.98, 86.92,
   800, 35, '春季窗口期4月下旬至5月中旬，秋季窗口10月', 1, '东南山脊(南坡)/东北山脊(北坡)', '内部参考数据'],
  ['麦金利山', 'Denali', 6190, '美国', '北美洲', '难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'continental',
   '北美洲最高峰，阿拉斯加的皇冠。', '5月-7月', '50%', '1913年', 0, 63.07, -151.00,
   1200, 80, '5月至6月为窗口期，需提前申请NPS许可证', 0, '西山脊/卡希尔顿路线', '内部参考数据'],
  ['阿空加瓜峰', 'Aconcagua', 6961, '阿根廷', '南美洲', '中等',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'continental',
   '南美洲最高峰，七大洲最高峰中除亚洲外最高。', '12月-2月', '35%', '1897年', 0, -32.65, -70.01,
   3000, 120, '南半球夏季12月至2月，1月为最佳窗口', 0, '标准路线(普通路线)/波兰冰川', '内部参考数据'],
  ['乞力马扎罗山', 'Kilimanjaro', 5895, '坦桑尼亚', '非洲', '较易',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'continental',
   '非洲最高峰，赤道雪山奇观。', '1月-3月、6月-10月', '65%', '1889年', 0, -3.07, 37.35,
   35000, 2000, '旱季1-3月及6-10月最佳，全年均可攀登', 0, 'Marangu/Machame/Lemosho路线', '内部参考数据'],
  ['文森峰', 'Vinson Massif', 4892, '南极洲', '南极洲', '极难',
   'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', 'continental',
   '南极洲最高峰，七大洲最高峰之一。', '11月-1月', '80%', '1966年', 0, -78.53, -85.62,
   200, 20, '南极夏季11月至1月，需乘飞机进入', 0, '标准路线', '内部参考数据'],
  ['科修斯科山', 'Mount Kosciuszko', 2228, '澳大利亚', '大洋洲', '较易',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', 'continental',
   '澳大利亚最高峰，大洋洲屋脊。', '12月-2月', '99%', '1840年', 0, -36.46, 148.26,
   100000, 0, '南半球夏季12月至2月，无技术难度', 0, '夏洛特山口步道', '内部参考数据'],
  ['厄尔布鲁士山', 'Mount Elbrus', 5642, '俄罗斯', '欧洲', '中等',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', 'continental',
   '欧洲最高峰，高加索山脉的最高点。', '6月-8月', '70%', '1874年', 0, 43.35, 42.44,
   15000, 800, '夏季6月至8月，南坡有缆车辅助', 0, '南坡标准路线/北坡路线', '内部参考数据'],
];

for (const p of continentalPeaks) insertPeak.run(...p);

// ── 世界名峰（世界经典雪山） ────────────────────────────────────────────────
const worldPeaks = [
  // 世界经典雪山：Denali, Mont Blanc, Island Peak, Mera Peak,
  //              Kilimanjaro, Chimborazo, Aconcagua, Elbrus
  ['丹拿利峰', 'Denali (McKinley)', 6190, '美国', '北美洲', '难',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'world',
   '北美洲最高峰，阿拉斯加皇冠，以极端低温和汹涌气候著称，是世界经典攀登目标之一。',
   '5月-6月', '50%', '1913年6月7日', 0, 63.07, -151.00,
   1200, 80, '5月至6月为窗口期，需提前申请NPS许可证', 0, '西山脊/卡希尔顿路线', '内部参考数据'],
  ['白朗峰', 'Mont Blanc', 4808, '法国/意大利', '欧洲', '中等',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'world',
   '西欧最高峰，阿尔卑斯山脉的皇冠，是欧洲最受欢迎的高山攀登目标，每年数千人登顶。',
   '6月-8月', '65%', '1786年8月8日', 0, 45.83, 6.86,
   20000, 300, '夏季6月至8月，7月中旬至8月中旬为最佳窗口', 0, 'Goûter路线(标准)/Cosmiques山脊', '内部参考数据'],
  ['岛峰', 'Island Peak (Imja Tse)', 6189, '尼泊尔', '亚洲', '中等',
   'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', 'world',
   '适合高海拔攀登入门的经典路线，从山谷中拔地而起如孤岛，是珠峰大本营徒步的绝佳补充。',
   '4月-5月、10月-11月', '75%', '1953年', 0, 27.93, 86.92,
   2000, 150, '春季4月底至5月；秋季10月至11月初', 0, '标准路线/西壁', '内部参考数据'],
  ['梅拉峰', 'Mera Peak', 6461, '尼泊尔', '亚洲', '中等',
   'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', 'world',
   '尼泊尔最高的攀登峰之一，技术要求相对较低，登顶后可欣赏珠峰、洛子峰、马卡鲁峰等壮景。',
   '4月-5月、10月-11月', '70%', '1953年', 0, 27.70, 86.90,
   1500, 100, '春季4月至5月；秋季10月至11月', 0, '标准路线(北侧)', '内部参考数据'],
  ['乞力马扎罗山', 'Kilimanjaro', 5895, '坦桑尼亚', '非洲', '较易',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'world',
   '非洲最高峰，赤道雪山奇观，是七大洲最高峰之一，也是世界上最受欢迎的高山之一，每年数万人攀登。',
   '1月-3月、6月-10月', '65%', '1889年', 0, -3.07, 37.35,
   35000, 2000, '旱季1-3月及6-10月最佳，全年均可攀登', 0, 'Marangu/Machame/Lemosho路线', '内部参考数据'],
  ['钦博拉索山', 'Chimborazo', 6263, '厄瓜多尔', '南美洲', '较难',
   'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', 'world',
   '厄瓜多尔最高峰，从地球中心算起是离地球最远的点，是南美重要的攀登目标。',
   '11月-2月、6月-9月', '60%', '1880年', 0, -1.47, -78.82,
   500, 30, '旱季11月至2月及6月至9月', 0, '标准路线(Whymper路线)', '内部参考数据'],
  ['阿空加瓜峰', 'Aconcagua', 6961, '阿根廷', '南美洲', '中等',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'world',
   '南美洲最高峰，西半球最高峰，七大洲最高峰之一，标准路线（普通路线）技术难度相对适中。',
   '12月-2月', '35%', '1897年', 0, -32.65, -70.01,
   3000, 120, '南半球夏季12月至2月，1月为最佳窗口', 0, '标准路线(普通路线)/波兰冰川', '内部参考数据'],
  ['厄尔布鲁士山', 'Elbrus', 5642, '俄罗斯', '欧洲', '中等',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', 'world',
   '欧洲最高峰，高加索山脉的皇冠，南坡有缆车辅助，是七大洲最高峰之一，每年吸引数万名攀登者。',
   '6月-8月', '70%', '1874年', 0, 43.35, 42.44,
   15000, 800, '夏季6月至8月，南坡有缆车辅助', 0, '南坡标准路线/北坡路线', '内部参考数据'],
];

for (const p of worldPeaks) insertPeak.run(...p);

// ── 技术攀登胜地（全球技术热门山峰） ────────────────────────────────────────────
const alpineSpots = [
  // 全球技术热门山峰：Cerro Torre, Eiger, Matterhorn, Ama Dablam,
  //                  Fitz Roy, Jannu, Latok I, Meru Shark's Fin 等技术路线著名山峰
  ['塞罗托雷峰', 'Cerro Torre', 3128, '阿根廷/智利', '南美洲', '极难',
   'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=800', 'alpine',
   '巴塔哥尼亚最难攀登的山峰之一，凭借不可思议的垂直花岗岩柱和极端天气闻名于世，是技术攀登圣地。',
   '11月-2月', '15%', '1959年', 0, -49.28, -73.11,
   50, 3, '南半球夏季11月至2月；需等待多日好天气窗口', 0, 'Compressor路线/Ferrari路线', '内部参考数据'],
  ['艾格峰', 'Eiger', 3967, '瑞士', '欧洲', '极难',
   'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', 'alpine',
   '阿尔卑斯三北壁之一，北壁（Nordwand/Eigerwand）是世界上最著名的技术路线之一，落石和恶劣天气是主要挑战。',
   '7月-8月', '30%', '1938年', 0, 46.58, 8.00,
   200, 15, '夏季7月至8月；北壁需在清晨低温时攀登以减少落石', 0, '北壁(Heckmair路线)/西山脊', '内部参考数据'],
  ['马特洪峰', 'Matterhorn', 4478, '瑞士/意大利', '欧洲', '难',
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 'alpine',
   '阿尔卑斯山脉标志性山峰，四壁形状各异，每年吸引数千名攀登者，北壁是技术难度最高的路线。',
   '7月-9月', '50%', '1865年7月14日', 0, 45.98, 7.66,
   3000, 200, '夏季7月至9月；北壁仅限冬季技术攀登者', 0, '霍恩利山脊(标准)/北壁', '内部参考数据'],
  ['阿玛达布拉姆峰', 'Ama Dablam', 6814, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800', 'alpine',
   '被誉为喜马拉雅山脉最美的山峰，造型独特优美，西南山脊路线是高海拔技术攀登的经典考验。',
   '10月-12月、3月-5月', '65%', '1961年', 0, 27.86, 86.86,
   350, 30, '秋季10月至12月初；春季3月至5月中旬', 0, '西南山脊路线', '内部参考数据'],
  ['菲茨罗伊峰', 'Fitz Roy (Cerro Chaltén)', 3405, '阿根廷/智利', '南美洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', 'alpine',
   '巴塔哥尼亚的花岗岩巨柱，被称为"冒烟的山"，恶劣多变的天气与垂直岩壁使其成为技术攀登终极挑战。',
   '11月-3月', '10%', '1952年', 0, -49.27, -73.04,
   80, 5, '南半球夏季11月至3月；成功率极低，天气窗口极短', 0, 'Supercanaleta路线/Franco-Argentina路线', '内部参考数据'],
  ['詹努峰', 'Jannu (Kumbhakarna)', 7711, '尼泊尔', '亚洲', '极难',
   'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', 'alpine',
   '尼泊尔东部的技术山峰，其北壁被誉为喜马拉雅最雄伟的岩壁之一，是极少数技术高手的挑战目标。',
   '4月-5月', '20%', '1962年', 0, 27.68, 88.05,
   15, 1, '春季4月底至5月中旬窗口期', 0, '西南山脊/北壁', '内部参考数据'],
  ['拉托克I峰', 'Latok I', 7145, '巴基斯坦', '亚洲', '极难',
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', 'alpine',
   '喀喇昆仑山脉著名技术山峰，北山脊路线是登山史上最具挑战性的项目之一，2018年北山脊首登。',
   '6月-8月', '10%', '2018年', 0, 35.81, 76.39,
   10, 1, '夏季7月至8月为最佳窗口', 0, '北山脊/南山脊', '内部参考数据'],
  ['梅鲁峰', 'Meru Peak (Shark\'s Fin)', 6476, '印度', '亚洲', '极难',
   'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', 'alpine',
   '喜马拉雅山脉中技术难度最高的山峰之一，"鲨鱼鳍"路线被誉为喜马拉雅技术攀登最大挑战。',
   '4月-5月、9月-10月', '15%', '2011年', 0, 30.88, 79.10,
   20, 2, '春季4月底至5月；秋季9月至10月中旬', 0, '鲨鱼鳍(中间峰)/Merrows Buttress', '内部参考数据'],
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

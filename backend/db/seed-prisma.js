/**
 * Prisma 版种子数据脚本
 *
 * 使用方式：
 *   SEED_ON_START=true DATABASE_URL="file:./dev.db" node backend/db/seed-prisma.js
 *
 * 仅在 SEED_ON_START=true 时运行（供 Railway 首次部署使用）。
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (process.env.SEED_ON_START !== 'true') {
  console.log('ℹ️  SEED_ON_START 未设置为 true，跳过数据填充 (skip seeding)');
  process.exit(0);
}

const bcrypt = require('bcrypt');
const prisma = require('./prisma');
const { encryptPII } = require('../utils/crypto');

function logSeedWriteError(entityName, action, error) {
  console.warn(`⚠️  ${entityName} ${action} 失败：`, error?.message || error);
}

async function main() {
  console.log('📦 开始填充示例数据 (Prisma)...');

  // ── 管理员账号 ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { phone: encryptPII('13800138000') },
    update: {},
    create: {
      name: '张伟',
      username: '@zhangwei_climbs',
      phone: encryptPII('13800138000'),
      password: passwordHash,
      avatar: 'https://i.pravatar.cc/150?u=zhangwei',
      level: '专业攀登者',
      summits: 12,
      expeditions: 8,
      followers: 1247,
      following: 386,
    },
  });

  const seedAdminPassword = process.env.ADMIN_PASSWORD || require('crypto').randomBytes(24).toString('hex');
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  ADMIN_PASSWORD 未设置：已为种子管理员生成随机一次性密码。后台登录请通过 ADMIN_PASSWORD 环境变量配置。');
  }
  const adminHash = await bcrypt.hash(seedAdminPassword, 10);
  await prisma.user.upsert({
    where: { phone: encryptPII('18888888888') },
    update: {},
    create: {
      name: '平台管理员',
      username: '@platform_admin',
      phone: encryptPII('18888888888'),
      password: adminHash,
      avatar: 'https://i.pravatar.cc/150?u=admin',
      level: '系统管理员',
      isAdmin: true,
    },
  });

  const ciTestUserHash = await bcrypt.hash('test1234', 10);
  await prisma.user.upsert({
    where: { phone: encryptPII('13800000001') },
    update: {
      password: ciTestUserHash,
    },
    create: {
      name: '阿尔卑斯',
      username: '@api_test_user',
      phone: encryptPII('13800000001'),
      password: ciTestUserHash,
      avatar: 'https://i.pravatar.cc/150?u=api-test-user',
    },
  });

  const demoUser = await prisma.user.findFirst({
    where: { phone: encryptPII('13800138000') },
    select: { id: true, name: true, avatar: true },
  });

  if (demoUser?.id) {
    const sampleOrders = [
      { orderNo: 'SEED-ORDER-PAID-001', amount: 12800, method: 'wechat', status: 'paid' },
      { orderNo: 'SEED-ORDER-PENDING-001', amount: 6999, method: 'alipay', status: 'pending' },
    ];
    for (const order of sampleOrders) {
      await prisma.order.upsert({
        where: { orderNo: order.orderNo },
        update: {
          userId: demoUser.id,
          amount: order.amount,
          method: order.method,
          status: order.status,
        },
        create: {
          userId: demoUser.id,
          orderNo: order.orderNo,
          amount: order.amount,
          method: order.method,
          status: order.status,
        },
      }).catch((error) => {
        logSeedWriteError(`示例订单 ${order.orderNo}`, '写入', error);
      });
    }
  }

  // ── 山峰：8000米巨峰 ──────────────────────────────────────
  const peaks8000 = [
    { name: '珠穆朗玛峰', nameEn: 'Mount Everest', altitude: 8849, country: '中国/尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界最高峰，位于中尼边境，是无数攀登者毕生的梦想。', bestSeason: '5月、10月', successRate: '29%', firstAscent: '1953年5月29日', deaths: 310, latitude: 27.9881, longitude: 86.9250, annualClimbers: 800, commercialTeams: 35, seasonDetail: '春季窗口期4月下旬至5月中旬，秋季窗口10月', supplementalOxygen: true, mainRoute: '东南山脊(南坡)/东北山脊(北坡)' },
    { name: 'K2', nameEn: 'K2', altitude: 8611, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第二高峰，被誉为"野蛮巨峰"，技术难度极高。', bestSeason: '7月-8月', successRate: '25%', firstAscent: '1954年7月31日', deaths: 87, latitude: 35.8808, longitude: 76.5133, annualClimbers: 150, commercialTeams: 12, seasonDetail: '夏季窗口期7月中旬至8月中旬', supplementalOxygen: false, mainRoute: 'Abruzzi山脊路线' },
    { name: '干城章嘉峰', nameEn: 'Kangchenjunga', altitude: 8586, country: '尼泊尔/印度', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第三高峰，位于尼泊尔与印度边境。', bestSeason: '5月、10月', successRate: '38%', firstAscent: '1955年5月25日', deaths: 45, latitude: 27.7025, longitude: 88.1475, annualClimbers: 80, commercialTeams: 6, seasonDetail: '春季4-5月；秋季10月', supplementalOxygen: true, mainRoute: '西南壁路线' },
    { name: '洛子峰', nameEn: 'Lhotse', altitude: 8516, country: '尼泊尔/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第四高峰，与珠峰共享南坳路线。', bestSeason: '5月', successRate: '65%', firstAscent: '1956年5月18日', deaths: 13, latitude: 27.9617, longitude: 86.9330, annualClimbers: 200, commercialTeams: 15, seasonDetail: '春季4月底至5月中旬', supplementalOxygen: true, mainRoute: '西壁/Couloir路线' },
    { name: '马卡鲁峰', nameEn: 'Makalu', altitude: 8485, country: '尼泊尔/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第五高峰，以陡峭的山脊和孤立的山体著称。', bestSeason: '5月、10月', successRate: '40%', firstAscent: '1955年5月15日', deaths: 30, latitude: 27.8897, longitude: 87.0886, annualClimbers: 70, commercialTeams: 5, seasonDetail: '春季4月底至5月；秋季10月', supplementalOxygen: true, mainRoute: '北坡/西北山脊' },
    { name: '卓奥友峰', nameEn: 'Cho Oyu', altitude: 8188, country: '中国/尼泊尔', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第六高峰，8000米山峰中技术难度相对较低。', bestSeason: '9月-10月', successRate: '56%', firstAscent: '1954年10月19日', deaths: 42, latitude: 28.0940, longitude: 86.6608, annualClimbers: 300, commercialTeams: 25, seasonDetail: '秋季9月底至10月中旬', supplementalOxygen: false, mainRoute: '西北山脊路线' },
    { name: '道拉吉里峰', nameEn: 'Dhaulagiri', altitude: 8167, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第七高峰，以多变的天气和崩雪风险闻名。', bestSeason: '5月、10月', successRate: '42%', firstAscent: '1960年5月13日', deaths: 71, latitude: 28.6966, longitude: 83.4890, annualClimbers: 90, commercialTeams: 7, seasonDetail: '春季4月底至5月', supplementalOxygen: false, mainRoute: '东北山脊路线' },
    { name: '马纳斯卢峰', nameEn: 'Manaslu', altitude: 8163, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第八高峰，尼泊尔语意为"灵魂之山"。', bestSeason: '5月、10月', successRate: '56%', firstAscent: '1956年5月9日', deaths: 68, latitude: 28.5496, longitude: 84.5597, annualClimbers: 400, commercialTeams: 30, seasonDetail: '秋季9月底至10月中旬', supplementalOxygen: false, mainRoute: '东北面/东北山脊' },
    { name: '南迦帕尔巴特峰', nameEn: 'Nanga Parbat', altitude: 8126, country: '巴基斯坦', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', type: '8000ers', category: 'eight_thousanders', description: '被称为"杀人山"，技术极难，死亡率极高。', bestSeason: '7月', successRate: '15%', firstAscent: '1953年', deaths: 239, latitude: 35.2374, longitude: 74.5894, annualClimbers: 60, commercialTeams: 5, seasonDetail: '夏季7月中旬至8月', supplementalOxygen: false, mainRoute: 'Kinshofer路线/鲁帕尔壁' },
    { name: '安纳普尔纳峰', nameEn: 'Annapurna', altitude: 8091, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', type: '8000ers', category: 'eight_thousanders', description: '世界第十高峰，死亡率曾是8000米山峰中最高。', bestSeason: '5月、10月', successRate: '38%', firstAscent: '1950年', deaths: 72, latitude: 28.5960, longitude: 83.8200, annualClimbers: 60, commercialTeams: 5, seasonDetail: '春季4月底至5月中旬', supplementalOxygen: false, mainRoute: '北壁路线' },
    { name: '加舒尔布鲁姆I峰', nameEn: 'Gasherbrum I', altitude: 8080, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', type: '8000ers', category: 'eight_thousanders', description: '巴托罗冰川区最险峻的山峰之一。', bestSeason: '7月', successRate: '38%', firstAscent: '1958年', deaths: 29, latitude: 35.7243, longitude: 76.6965, annualClimbers: 50, commercialTeams: 4, seasonDetail: '夏季7月至8月初', supplementalOxygen: false, mainRoute: '美国路线/西北壁' },
    { name: '布洛阿特峰', nameEn: 'Broad Peak', altitude: 8051, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', type: '8000ers', category: 'eight_thousanders', description: '与K2相邻，路线相对温和。', bestSeason: '7月', successRate: '52%', firstAscent: '1957年', deaths: 21, latitude: 35.8107, longitude: 76.5663, annualClimbers: 120, commercialTeams: 10, seasonDetail: '夏季7月中旬至8月初', supplementalOxygen: false, mainRoute: '普通路线/西壁' },
    { name: '加舒尔布鲁姆II峰', nameEn: 'Gasherbrum II', altitude: 8034, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', type: '8000ers', category: 'eight_thousanders', description: '8000米山峰中成功率较高的山峰之一。', bestSeason: '7月', successRate: '65%', firstAscent: '1956年', deaths: 24, latitude: 35.7588, longitude: 76.6527, annualClimbers: 180, commercialTeams: 14, seasonDetail: '夏季7月至8月', supplementalOxygen: false, mainRoute: '西南壁路线' },
    { name: '希夏邦马峰', nameEn: 'Shishapangma', altitude: 8027, country: '中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1521336575822-6da63fb45455?w=800', type: '8000ers', category: 'eight_thousanders', description: '唯一完全位于中国境内的八千米级高峰。', bestSeason: '5月、10月', successRate: '49%', firstAscent: '1964年', deaths: 25, latitude: 28.3524, longitude: 85.7777, annualClimbers: 150, commercialTeams: 12, seasonDetail: '春季5月；秋季9月底至10月', supplementalOxygen: false, mainRoute: '北坡/西南壁' },
  ];

  // ── 七大洲最高峰 ─────────────────────────────────────────
  const continentalPeaks = [
    { name: '麦金利山', nameEn: 'Denali', altitude: 6190, country: '美国', continent: '北美洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800', type: 'continental', category: 'seven_summits', description: '北美洲最高峰，阿拉斯加的皇冠。', bestSeason: '5月-7月', successRate: '50%', firstAscent: '1913年', deaths: 0, latitude: 63.0692, longitude: -151.0070, annualClimbers: 1200, commercialTeams: 80, seasonDetail: '5月至6月为窗口期，需提前申请NPS许可证', supplementalOxygen: false, mainRoute: '西山脊/卡希尔顿路线' },
    { name: '阿空加瓜峰', nameEn: 'Aconcagua', altitude: 6961, country: '阿根廷', continent: '南美洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', type: 'continental', category: 'seven_summits', description: '南美洲最高峰。', bestSeason: '12月-2月', successRate: '35%', firstAscent: '1897年', deaths: 0, latitude: -32.6532, longitude: -70.0109, annualClimbers: 3000, commercialTeams: 120, seasonDetail: '南半球夏季12月至2月，1月为最佳窗口', supplementalOxygen: false, mainRoute: '标准路线(普通路线)/波兰冰川' },
    { name: '乞力马扎罗山', nameEn: 'Kilimanjaro', altitude: 5895, country: '坦桑尼亚', continent: '非洲', difficulty: '较易', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', type: 'continental', category: 'seven_summits', description: '非洲最高峰，赤道雪山奇观。', bestSeason: '1月-3月、6月-10月', successRate: '65%', firstAscent: '1889年', deaths: 0, latitude: -3.0674, longitude: 37.3556, annualClimbers: 35000, commercialTeams: 2000, seasonDetail: '旱季1-3月及6-10月最佳', supplementalOxygen: false, mainRoute: 'Marangu/Machame/Lemosho路线' },
    { name: '文森峰', nameEn: 'Vinson Massif', altitude: 4892, country: '南极洲', continent: '南极洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800', type: 'continental', category: 'seven_summits', description: '南极洲最高峰，七大洲最高峰之一。', bestSeason: '11月-1月', successRate: '80%', firstAscent: '1966年', deaths: 0, latitude: -78.5254, longitude: -85.6170, annualClimbers: 200, commercialTeams: 20, seasonDetail: '南极夏季11月至1月，需乘飞机进入', supplementalOxygen: false, mainRoute: '标准路线' },
    { name: '科修斯科山', nameEn: 'Mount Kosciuszko', altitude: 2228, country: '澳大利亚', continent: '大洋洲', difficulty: '较易', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800', type: 'continental', category: 'seven_summits', description: '澳大利亚最高峰，大洋洲屋脊。', bestSeason: '12月-2月', successRate: '99%', firstAscent: '1840年', deaths: 0, latitude: -36.4566, longitude: 148.2633, annualClimbers: 100000, commercialTeams: 0, seasonDetail: '南半球夏季12月至2月，无技术难度', supplementalOxygen: false, mainRoute: '夏洛特山口步道' },
    { name: '厄尔布鲁士山', nameEn: 'Mount Elbrus', altitude: 5642, country: '俄罗斯', continent: '欧洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', type: 'continental', category: 'seven_summits', description: '欧洲最高峰，高加索山脉的最高点。', bestSeason: '6月-8月', successRate: '70%', firstAscent: '1874年', deaths: 0, latitude: 43.3499, longitude: 42.4453, annualClimbers: 15000, commercialTeams: 800, seasonDetail: '夏季6月至8月，南坡有缆车辅助', supplementalOxygen: false, mainRoute: '南坡标准路线/北坡路线' },
  ];

  // ── 国内著名山峰 ──────────────────────────────────────────
  const chinaPeaks = [
    { name: '贡嘎山', nameEn: 'Minya Konka', altitude: 7556, country: '中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', type: 'china', category: 'china_classic', description: '四川最高峰，被称为"蜀山之王"。', bestSeason: '4月-5月、9月-10月', successRate: '20%', firstAscent: '1932年', deaths: 0, latitude: 29.5940, longitude: 101.8787, annualClimbers: 50, commercialTeams: 3 },
    { name: '梅里雪山', nameEn: 'Meili Snow Mountain', altitude: 6740, country: '中国', continent: '亚洲', difficulty: '禁止攀登', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800', type: 'china', category: 'china_classic', description: '云南最高峰，因神圣地位禁止攀登。', bestSeason: '10月-12月', successRate: '0%', firstAscent: '未登顶（禁止）', deaths: 17, latitude: 28.4370, longitude: 98.6830, annualClimbers: 0, commercialTeams: 0 },
    { name: '四姑娘山', nameEn: 'Siguniang Mountain', altitude: 6250, country: '中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800', type: 'china', category: 'china_classic', description: '四川阿坝，由幺妹峰等四座山峰组成，是西部攀登圣地。', bestSeason: '5月-6月、9月-10月', successRate: '30%', firstAscent: '1981年', deaths: 0, latitude: 30.9108, longitude: 102.9616, annualClimbers: 200, commercialTeams: 20 },
    { name: '玉龙雪山', nameEn: 'Yulong Snow Mountain', altitude: 5596, country: '中国', continent: '亚洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=800', type: 'china', category: 'china_classic', description: '云南丽江，世界上纬度最低的海洋性冰川之一，风景壮美。', bestSeason: '3月-6月、9月-11月', successRate: '60%', firstAscent: '1987年', deaths: 0, latitude: 27.1143, longitude: 100.1800, annualClimbers: 5000, commercialTeams: 100 },
  ];

  const allPeaks = [
    ...peaks8000,
    ...continentalPeaks,
    ...chinaPeaks,
  ];

  const existingPeaks = await prisma.peak.findMany({
    where: { name: { in: allPeaks.map((peak) => peak.name) } },
    select: { id: true, name: true },
  }).catch((error) => {
    console.warn('⚠️  读取已存在山峰失败，将按新数据继续创建：', error?.message || error);
    return [];
  });
  const existingPeakIdsByName = new Map(existingPeaks.map((peak) => [peak.name, peak.id]));

  for (const peak of allPeaks) {
    const existingPeakId = existingPeakIdsByName.get(peak.name);
    if (existingPeakId) {
      await prisma.peak.update({
        where: { id: existingPeakId },
        data: peak,
      }).catch((error) => {
        logSeedWriteError(`山峰 ${peak.name}`, '更新', error);
      });
      continue;
    }

    await prisma.peak.create({ data: peak }).catch((error) => {
      logSeedWriteError(`山峰 ${peak.name}`, '创建', error);
    });
  }

  // ── 救援联系人 ────────────────────────────────────────────
  const rescueContacts = [
    { name: '中国登山协会', phone: '010-67113314', region: '全国', type: 'national' },
    { name: '西藏登山协会', phone: '0891-6322889', region: '西藏', type: 'regional' },
    { name: '四川省登山协会', phone: '028-85079668', region: '四川', type: 'regional' },
    { name: '云南省登山协会', phone: '0871-6319867', region: '云南', type: 'regional' },
    { name: '北京市登山协会', phone: '010-67113314', region: '北京', type: 'regional' },
    { name: '尼泊尔旅游局', phone: '+977-1-4256909', region: '尼泊尔', type: 'international' },
    { name: '巴基斯坦旅游局', phone: '+92-51-9202766', region: '巴基斯坦', type: 'international' },
    { name: '国际SOS', phone: '+86-10-64629100', region: '全球', type: 'international' },
  ];

  for (const contact of rescueContacts) {
    await prisma.rescueContact.create({ data: contact }).catch((error) => {
      logSeedWriteError(`救援联系人 ${contact.name}`, '创建', error);
    });
  }

  // ── 保险方案 ──────────────────────────────────────────────
  const insurancePlans = [
    { name: '高山攀登基础险', region: '国内', coverageType: '意外+救援', priceCny: 288, priceUsd: 40, coverageAmount: '50万元意外+10万救援', description: '适合国内中低海拔攀登', features: JSON.stringify(['意外身故50万', '意外医疗10万', '紧急救援10万', '24小时求援热线']), provider: '平安保险', isActive: true, sortOrder: 1 },
    { name: '高山攀登专业险', region: '国际', coverageType: '全险', priceCny: 888, priceUsd: 125, coverageAmount: '100万元意外+50万救援', description: '适合8000米级高海拔攀登', features: JSON.stringify(['意外身故100万', '意外医疗50万', '紧急救援50万', '直升机救援', '遗体运送', '24小时多语言客服']), provider: '中国人保', isActive: true, sortOrder: 2 },
    { name: '高山综合险（含医疗）', region: '国际', coverageType: '意外+医疗+救援', priceCny: 1288, priceUsd: 180, coverageAmount: '200万意外+100万医疗', description: '适合远征队攀登，含全面医疗保障', features: JSON.stringify(['意外身故200万', '意外医疗100万', '紧急救援100万', '住院日额津贴', '心理援助', 'SOS应急服务']), provider: '太平洋保险', isActive: true, sortOrder: 3 },
  ];

  for (const plan of insurancePlans) {
    await prisma.insurancePlan.create({ data: plan }).catch((error) => {
      logSeedWriteError(`保险方案 ${plan.name}`, '创建', error);
    });
  }

  // ── 帖子 ──────────────────────────────────────────────────
  const postCount = await prisma.post.count();
  if (postCount === 0 && demoUser) {
    await prisma.post.createMany({
      data: [
        {
          userId: demoUser.id,
          authorName: demoUser.name,
          authorAvatar: demoUser.avatar,
          content: '珠峰南坡冲顶窗口预计在本月下旬开启，大家注意风速变化。',
          location: '珠穆朗玛峰大本营',
          likes: 18,
          comments: 4,
        },
        {
          userId: demoUser.id,
          authorName: demoUser.name,
          authorAvatar: demoUser.avatar,
          content: 'K2 阿布鲁齐山脊今天积雪偏深，建议谨慎推进。',
          location: 'K2 C2 营地',
          likes: 23,
          comments: 6,
        },
        {
          userId: demoUser.id,
          authorName: demoUser.name,
          authorAvatar: demoUser.avatar,
          content: '阿空加瓜普通线补给点已恢复，南美线队伍可正常补水。',
          location: '阿空加瓜',
          likes: 11,
          comments: 2,
        },
        {
          userId: demoUser.id,
          authorName: demoUser.name,
          authorAvatar: demoUser.avatar,
          content: '贡嘎山海螺沟方向天气转好，周末训练可安排。',
          location: '贡嘎山',
          likes: 16,
          comments: 5,
        },
      ],
    }).catch((error) => {
      logSeedWriteError('示例帖子', '批量创建', error);
    });
  }

  // ── 队伍 ──────────────────────────────────────────────────
  const teamCount = await prisma.team.count();
  if (teamCount === 0 && demoUser) {
    try {
      await prisma.team.createMany({
        data: [
          {
            name: '珠峰南坡适应队',
            peak: '珠穆朗玛峰',
            date: '2026-05-20',
            spots: 3,
            totalSpots: 5,
            level: '高级',
            leaderId: demoUser.id,
            description: '目标南坡 C3 适应+冲顶窗口观测',
            status: 'recruiting',
          },
          {
            name: 'K2 技术训练队',
            peak: 'K2',
            date: '2026-06-10',
            spots: 2,
            totalSpots: 4,
            level: '专业',
            leaderId: demoUser.id,
            description: '冰壁与固定绳技术训练，需 6000m 以上经验',
            status: 'recruiting',
          },
          {
            name: '贡嘎山周末拉练',
            peak: '贡嘎山',
            date: '2026-05-25',
            spots: 4,
            totalSpots: 6,
            level: '中级',
            leaderId: demoUser.id,
            description: '两日拉练，含高海拔徒步与营地协作',
            status: 'recruiting',
          },
        ],
      });
    } catch (error) {
      logSeedWriteError('示例队伍', '创建', error);
    }
  }

  console.log('✅ 种子数据填充完成！');
}

main()
  .catch(e => {
    console.error('❌ 种子数据填充失败:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

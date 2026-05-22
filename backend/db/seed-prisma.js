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

  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123456', 10);
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

  const demoUser = await prisma.user.findFirst({
    where: { phone: encryptPII('13800138000') },
    select: { id: true, name: true, avatar: true },
  });

  // ── 山峰：8000米巨峰 ──────────────────────────────────────
  const peaks8000 = [
    { name: '珠穆朗玛峰', nameEn: 'Mount Everest', altitude: 8849, country: '中国/尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1516466723[...] },
    { name: 'K2', nameEn: 'K2', altitude: 8611, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',[...] },
    { name: '干城章嘉峰', nameEn: 'Kangchenjunga', altitude: 8586, country: '尼泊尔/印度', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1506905925[...] },
    { name: '洛子峰', nameEn: 'Lhotse', altitude: 8516, country: '尼泊尔/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2[...] },
    { name: '马卡鲁峰', nameEn: 'Makalu', altitude: 8485, country: '尼泊尔/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1522163182402-834f87[...] },
    { name: '卓奥友峰', nameEn: 'Cho Oyu', altitude: 8188, country: '中国/尼泊尔', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1d[...] },
    { name: '道拉吉里峰', nameEn: 'Dhaulagiri', altitude: 8167, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1519681393784-d12026[...] },
    { name: '马纳斯卢峰', nameEn: 'Manaslu', altitude: 8163, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd[...] },
    { name: '南迦帕尔巴特峰', nameEn: 'Nanga Parbat', altitude: 8126, country: '巴基斯坦', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-155163281[...] },
    { name: '安纳普尔纳峰', nameEn: 'Annapurna', altitude: 8091, country: '尼泊尔', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1486870591958-9b9d[...] },
    { name: '加舒尔布鲁姆I峰', nameEn: 'Gasherbrum I', altitude: 8080, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1[...] },
    { name: '布洛阿特峰', nameEn: 'Broad Peak', altitude: 8051, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1506905925346[...] },
    { name: '加舒尔布鲁姆II峰', nameEn: 'Gasherbrum II', altitude: 8034, country: '巴基斯坦/中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-14[...] },
    { name: '希夏邦马峰', nameEn: 'Shishapangma', altitude: 8027, country: '中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1521336575822-6da63fb454[...] },
  ];

  // ── 七大洲最高峰 ─────────────────────────────────────────
  const continentalPeaks = [
    { name: '麦金利山', nameEn: 'Denali', altitude: 6190, country: '美国', continent: '北美洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'[...] },
    { name: '阿空加瓜峰', nameEn: 'Aconcagua', altitude: 6961, country: '阿根廷', continent: '南美洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1506905925346-21bd[...] },
    { name: '乞力马扎罗山', nameEn: 'Kilimanjaro', altitude: 5895, country: '坦桑尼亚', continent: '非洲', difficulty: '较易', image: 'https://images.unsplash.com/photo-1464822759023[...] },
    { name: '文森峰', nameEn: 'Vinson Massif', altitude: 4892, country: '南极洲', continent: '南极洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1522163182402-834f87[...] },
    { name: '科修斯科山', nameEn: 'Mount Kosciuszko', altitude: 2228, country: '澳大利亚', continent: '大洋洲', difficulty: '较易', image: 'https://images.unsplash.com/photo-14868705[...] },
    { name: '厄尔布鲁士山', nameEn: 'Mount Elbrus', altitude: 5642, country: '俄罗斯', continent: '欧洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1519681393784-d[...] },
  ];

  // ── 国内著名山峰 ──────────────────────────────────────────
  const chinaPeaks = [
    { name: '贡嘎山', nameEn: 'Minya Konka', altitude: 7556, country: '中国', continent: '亚洲', difficulty: '极难', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w[...] },
    { name: '梅里雪山', nameEn: 'Meili Snow Mountain', altitude: 6740, country: '中国', continent: '亚洲', difficulty: '禁止攀登', image: 'https://images.unsplash.com/photo-15005343142[...] },
    { name: '四姑娘山', nameEn: 'Siguniang Mountain', altitude: 6250, country: '中国', continent: '亚洲', difficulty: '难', image: 'https://images.unsplash.com/photo-1519681393784-d120267[...] },
    { name: '玉龙雪山', nameEn: 'Yulong Snow Mountain', altitude: 5596, country: '中国', continent: '亚洲', difficulty: '中等', image: 'https://images.unsplash.com/photo-1516466723877-e4[...] },
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
    { name: '高山攀登基础险', region: '国内', coverageType: '意外+救援', priceCny: 288, priceUsd: 40, coverageAmount: '50万元意外+10万救援', description: '适合国内中低��[...] },
    { name: '高山攀登专业险', region: '国际', coverageType: '全险', priceCny: 888, priceUsd: 125, coverageAmount: '100万元意外+50万救援', description: '适合8000米级高海拔[...] },
    { name: '高山综合险（含医疗）', region: '国际', coverageType: '意外+医疗+救援', priceCny: 1288, priceUsd: 180, coverageAmount: '200万意外+100万医疗', description: '适[...] },
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
    }).catch((error) => {
      logSeedWriteError('示例队伍', '批量创建', error);
    });
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

#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const prisma = require('../db/prisma');
const { encryptPII } = require('../utils/crypto');

async function seedAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD 未配置，无法创建默认管理员账号');
  }
  const encryptedEmail = encryptPII('admin@summitlink.app');
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email: encryptedEmail },
    update: {
      password: hash,
      isAdmin: true,
      name: 'SummitLink Admin',
      username: '@admin',
    },
    create: {
      name: 'SummitLink Admin',
      username: '@admin',
      email: encryptedEmail,
      password: hash,
      isAdmin: true,
      level: '管理员',
      settings: '{}',
      privacy: '{}',
    },
  });
}

async function seedPeaks() {
  const peaks = [
    { name: '珠穆朗玛峰', nameEn: 'Mount Everest', altitude: 8848, country: '中国/尼泊尔', continent: '亚洲', difficulty: '极高', description: '世界最高峰' },
    { name: 'K2', nameEn: 'K2', altitude: 8611, country: '中国/巴基斯坦', continent: '亚洲', difficulty: '极高', description: '喀喇昆仑山脉第二高峰' },
    { name: '慕士塔格峰', nameEn: 'Muztagh Ata', altitude: 7546, country: '中国', continent: '亚洲', difficulty: '高', description: '被称为冰山之父' },
  ];

  for (const peak of peaks) {
    const exists = await prisma.peak.findFirst({ where: { name: peak.name }, select: { id: true } });
    if (!exists) {
      await prisma.peak.create({ data: peak });
    }
  }
}

async function main() {
  await seedAdmin();
  await seedPeaks();
  console.log('✅ Prisma seed 完成');
}

main()
  .catch((e) => {
    console.error('❌ Prisma seed 失败:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

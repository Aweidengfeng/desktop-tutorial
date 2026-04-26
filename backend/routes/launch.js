const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const router = express.Router();

const applicationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提交过于频繁，请稍后再试' },
});

const program = {
  title: 'AlpineLink Seven Summits Global Selection Program',
  subtitle: '2026 七大洲最高峰全球 20 人招募计划',
  positioning: '全球经典商业攀登展示 + 活动报名 + 服务商招募 + 官网/App 可访问的轻量启动版',
  launchWindow: '2026-06-01 至 2026-08-30',
  selectionSize: 20,
  serviceProviderDecision: '2026-08',
  shortlistAnnouncement: '2026-10',
  riskNotice: '平台先做信息展示、报名收集、服务商筛选和内容传播；实际攀登由合规持证服务商执行。',
  infrastructure: {
    recommendedServer: '2 核 4G / 80G SSD / Ubuntu 22.04 或 24.04 / Nginx + Node.js + SQLite/PostgreSQL',
    overseasBudget: '10-30 USD/月',
    domesticBudget: '1000-3000 RMB/年',
    firstDeployment: '优先一台海外小服务器，后续再增加国内备案和多节点',
  },
  appCapabilities: ['支付', '向导', '俱乐部', '天气查询', '攀登报告', '官网', '安卓/iOS Capacitor 测试版'],
  collections: {
    sevenSummits: [
      { name: '珠穆朗玛峰', nameEn: 'Mount Everest', altitude: 8849, continent: '亚洲', country: '中国/尼泊尔' },
      { name: '阿空加瓜', nameEn: 'Aconcagua', altitude: 6961, continent: '南美洲', country: '阿根廷' },
      { name: '丹纳利', nameEn: 'Denali', altitude: 6190, continent: '北美洲', country: '美国' },
      { name: '乞力马扎罗', nameEn: 'Kilimanjaro', altitude: 5895, continent: '非洲', country: '坦桑尼亚' },
      { name: '厄尔布鲁士', nameEn: 'Mount Elbrus', altitude: 5642, continent: '欧洲', country: '俄罗斯' },
      { name: '文森峰', nameEn: 'Vinson Massif', altitude: 4892, continent: '南极洲', country: '南极洲' },
      { name: '查亚峰/科修斯科峰', nameEn: 'Carstensz Pyramid / Mount Kosciuszko', altitude: 4884, continent: '大洋洲', country: '印度尼西亚/澳大利亚', note: '按 Messner/Bass 版本分别说明' },
    ],
    eightThousanders: [
      '珠穆朗玛峰', 'K2', '干城章嘉', '洛子峰', '马卡鲁', '卓奥友', '道拉吉里',
      '马纳斯鲁', '南迦帕尔巴特', '安纳普尔纳', '加舒布鲁木 I', '布洛阿特',
      '加舒布鲁木 II', '希夏邦马',
    ],
    commercialDestinations: [
      { name: '马年转山 / 冈仁波齐转山', type: '2026 徒步专题', season: '5月-10月' },
      { name: 'EBC 徒步', type: '经典徒步', season: '3月-5月 / 10月-11月' },
      { name: 'ABC 徒步', type: '经典徒步', season: '3月-5月 / 10月-11月' },
      { name: '乞力马扎罗', type: '商业攀登', season: '1月-3月 / 6月-10月' },
      { name: '阿空加瓜', type: '商业攀登', season: '12月-2月' },
      { name: '厄尔布鲁士', type: '商业攀登', season: '6月-8月' },
      { name: '勃朗峰', type: '阿尔卑斯经典', season: '6月-9月' },
      { name: '马特洪峰', type: '阿尔卑斯经典', season: '7月-9月' },
      { name: '阿尔卑斯经典路线', type: '技术攀登', season: '6月-9月' },
      { name: '安第斯经典路线', type: '商业攀登', season: '12月-3月' },
    ],
  },
  timeline: [
    { period: '现在-5月中旬', goal: '可展示、可报名、可部署', tasks: ['全球攀登首页', '三类山峰专题', '活动报名', '服务商招募', '基础天气', '小云服务器部署'] },
    { period: '5月下旬', goal: '上线测试', tasks: ['域名/HTTPS', '后台管理', '数据备份', '隐私政策和免责声明', '中英文基础页面'] },
    { period: '6月1日-8月30日', goal: '全球报名和内容传播', tasks: ['全球攀登者招募', '候选人展示', '服务商沟通', '攀登故事收集'] },
    { period: '8月', goal: '确定七大洲服务商', tasks: ['核实资质', '确认报价', '确认保险和救援', '确认付款/取消政策'] },
    { period: '9月', goal: '筛选报名者', tasks: ['体能评估', '经验评估', '护照签证准备', '预算确认', '风险确认'] },
    { period: '10月', goal: '公布中签名单', tasks: ['20 人名单', '候补名单', '合作服务商', '活动路线图', '内容跟拍'] },
  ],
};

function trimString(value, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

router.get('/global-climbing', (req, res) => {
  res.json(program);
});

router.post('/applications', applicationLimiter, async (req, res) => {
  try {
    const type = trimString(req.body.type, 20);
    if (!['climber', 'provider'].includes(type)) {
      return res.status(400).json({ error: '报名类型必须为 climber 或 provider' });
    }

    const name = trimString(req.body.name, 80);
    const contact = trimString(req.body.contact, 120);
    if (!name || !contact) {
      return res.status(400).json({ error: '姓名/机构名称和联系方式不能为空' });
    }

    const agreedRisk = req.body.agreedRisk === true || req.body.agreedRisk === 1 || req.body.agreedRisk === 'true';
    if (type === 'climber' && !agreedRisk) {
      return res.status(400).json({ error: '攀登者报名需确认风险告知' });
    }

    const payload = {
      budgetConfirmed: Boolean(req.body.budgetConfirmed),
      targetPeaks: Array.isArray(req.body.targetPeaks) ? req.body.targetPeaks.slice(0, 10).map(v => trimString(v, 80)).filter(Boolean) : [],
      services: Array.isArray(req.body.services) ? req.body.services.slice(0, 10).map(v => trimString(v, 80)).filter(Boolean) : [],
      language: trimString(req.body.language, 40) || 'zh-CN',
    };

    const createdAt = new Date().toISOString();
    await prisma.$executeRaw`
      INSERT INTO global_launch_applications (
        type, name, contact, nationality, experience, target, notes, payload, status, created_at
      ) VALUES (
        ${type},
        ${name},
        ${contact},
        ${trimString(req.body.nationality, 80) || null},
        ${trimString(req.body.experience, 1000) || null},
        ${trimString(req.body.target, 200) || null},
        ${trimString(req.body.notes, 1000) || null},
        ${JSON.stringify(payload)},
        'received',
        ${createdAt}
      )
    `;
    res.status(201).json({ success: true, application: { type, status: 'received', createdAt } });
  } catch (e) {
    console.error('Global launch application submission failed:', e);
    res.status(500).json({ error: '启动计划申请提交失败' });
  }
});

module.exports = router;

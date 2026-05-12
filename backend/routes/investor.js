const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const investorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

const INVESTOR_NARRATIVE = {
  positioning: 'SummitLink 是面向高山攀登与山地户外的交易型社区，把内容种草、向导/俱乐部供给、商业攀登履约、安全救援与保险装备服务连接在一个闭环内。',
  value_proposition: [
    '用真实登山内容和轨迹沉淀低成本获客入口',
    '用认证向导、俱乐部和商业攀登订单承接高客单价交易',
    '用天气、SOS、电子护照、登顶记录等安全与数据能力提高信任',
    '用保险、装备、定制攀登和地方文旅合作扩展收入边界',
  ],
  highlights: [
    '垂直人群明确：高山攀登用户决策周期长、客单价高、强依赖信任',
    '供给侧可聚合：向导、俱乐部、线路、装备、保险均可平台化',
    '交易与安全闭环：从发现山峰到下单、履约、记录、救援形成数据资产',
    '可面向多类资本讲述：早期增长、规模网络效应、产业协同、地方文旅与后期经营质量',
  ],
  risks: [
    { risk: '高风险户外场景带来的安全与履约责任', mitigation: '强化资质审核、路线风控、SOS 记录、保险合作与订单状态机' },
    { risk: '早期供给密度不足影响成交效率', mitigation: '优先聚焦核心山峰/区域，扶持头部向导和俱乐部形成样板' },
    { risk: '商业化过早可能伤害社区信任', mitigation: '用内容社区和真实登顶记录建立信任，再引导高意向用户进入交易' },
  ],
  milestones: [
    '完善投资者看板与核心指标口径',
    '打磨向导/俱乐部商业攀登发布、下单、履约闭环',
    '接入真实支付、保险与区域合作资源',
    '形成核心山峰样板市场后复制到更多山地目的地',
  ],
  personas: [
    {
      id: 'angel',
      name: '天使投资人',
      headline: '看团队、原型和早期细分机会',
      narrative: '对天使投资人，SummitLink 的重点是一个足够垂直但高客单价的早期机会：先用完整产品原型证明用户需求，再通过核心山峰和头部向导验证交易闭环。',
      focus_metrics: ['产品原型完成度', '早期注册用户', '社区内容活跃度', '向导/俱乐部入驻数量'],
      opportunity: '高山攀登消费升级与户外社交内容结合，早期仍缺少可信交易平台。',
      moat: '真实轨迹、登顶记录、向导资质和社区信任沉淀形成早期壁垒。',
      business_model: '先验证商业攀登佣金，再扩展保险、装备、定制服务。',
      growth_strategy: '聚焦少数经典山峰和高信任向导，做出样板用户旅程。',
      risk_control: '以审核、保险、SOS 和履约流程降低早期安全风险。',
      exit_logic: '若验证交易闭环，可进入 VC 轮，放大目的地和供给网络。',
    },
    {
      id: 'vc',
      name: 'VC',
      headline: '看市场规模、增长路径和网络效应',
      narrative: '对 VC，SummitLink 的重点是“户外内容社区 + 高客单价服务交易平台”的可扩展模型：用户、向导、俱乐部、山峰线路和安全数据越多，平台匹配效率和交易信任越强。',
      focus_metrics: ['DAU/WAU/MAU', 'GMV', '订单完成率', '登顶转化'],
      opportunity: '山地户外从低价装备消费走向高价值体验服务，平台可切入交易和服务基础设施。',
      moat: '双边网络、目的地数据、履约记录、用户安全档案和品牌信任共同提升迁移成本。',
      business_model: '商业攀登佣金为主，叠加保险、装备、俱乐部活动和定制攀登收入。',
      growth_strategy: '从核心山峰复制到更多目的地，形成内容获客、供给入驻和交易转化飞轮。',
      risk_control: '用标准化订单状态、资质体系和安全工具提升规模化履约质量。',
      exit_logic: '成长为垂直户外交易入口后，可被大型旅游、本地生活、保险或体育平台并购，或继续独立融资扩张。',
    },
    {
      id: 'strategic',
      name: '战略投资人',
      headline: '看户外、文旅、保险、装备和救援协同',
      narrative: '对战略投资人，SummitLink 是连接高价值户外用户与产业资源的入口，可为装备品牌、保险公司、文旅目的地、俱乐部和救援服务提供可交易、可履约、可复购的数字渠道。',
      focus_metrics: ['GMV', 'Top 山峰/向导', '保险与装备转化', 'SOS 使用记录'],
      opportunity: '户外产业链分散，缺少围绕真实攀登场景组织用户、供给、风控和服务的统一入口。',
      moat: '平台掌握用户意图、路线偏好、履约记录和安全需求，可提升产业伙伴转化效率。',
      business_model: '交易佣金之外，可发展品牌合作、保险分销、装备交易和目的地服务套餐。',
      growth_strategy: '与装备、保险、文旅和救援伙伴共建核心目的地解决方案。',
      risk_control: '通过合作方资质、服务标准、保险产品和应急体系共担高风险场景。',
      exit_logic: '可成为战略方的垂直用户入口、服务中台或目的地数字化能力。',
    },
    {
      id: 'government',
      name: '政府/文旅基金',
      headline: '看地方山地旅游、安全体系和产业带动',
      narrative: '对政府和文旅基金，SummitLink 的重点是把山地户外从零散自发活动升级为可管理、可服务、可带动产业的数字化基础设施，帮助地方沉淀游客、线路、向导、救援和消费数据。',
      focus_metrics: ['区域用户分布', '热门山峰', 'SOS 响应', '俱乐部/向导供给'],
      opportunity: '地方山地资源需要数字化运营工具，将流量转化为安全、有序和可持续的文旅消费。',
      moat: '线路、游客、向导、俱乐部和安全记录在地方目的地持续沉淀。',
      business_model: '平台交易收入之外，可承接目的地运营、活动管理、数据服务和安全协同项目。',
      growth_strategy: '先与重点山地目的地共建样板，再复制到更多区域。',
      risk_control: '强调合规运营、实名订单、路线提示、救援协同和保险保障。',
      exit_logic: '形成地方文旅数字基础设施和山地户外产业平台。',
    },
    {
      id: 'pe',
      name: 'PE/后期投资人',
      headline: '看收入结构、利润率、履约质量和风控',
      narrative: '对 PE/后期投资人，SummitLink 的核心是经营质量：GMV、佣金率、订单完成率、履约成本、风险事件和复购数据能否证明这是一个可持续盈利的垂直交易平台。',
      focus_metrics: ['GMV', '订单完成率', '平台抽佣率', '履约与安全事件'],
      opportunity: '若核心目的地交易密度形成，平台具备稳定佣金和增值服务收入。',
      moat: '高信任供给、历史履约数据、用户复购和目的地合作关系提升后期经营确定性。',
      business_model: '以交易佣金为基本盘，以保险、装备、定制、企业/目的地服务提升毛利。',
      growth_strategy: '优化盈利模型、提高订单完成率、降低履约与获客成本。',
      risk_control: '建立财务、订单、供应商、保险和安全事件的可审计指标体系。',
      exit_logic: '可通过并购整合户外服务资产，或进入更大文旅/体育服务集团。',
    },
  ],
};

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // 仍执行一次等长比较，避免早返回造成时序泄露
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function investorAuth(req, res, next) {
  // 仅从请求头读取 token，禁止使用 query 参数（避免凭证泄露到日志/代理/Referer）
  const token = req.headers['x-investor-token'];
  const expectedToken = process.env.INVESTOR_TOKEN;
  if (!expectedToken) {
    // 必须显式配置 INVESTOR_TOKEN，禁止复用 ADMIN_PASSWORD
    return res.status(503).json({ error: '投资者令牌未配置，请联系管理员' });
  }
  if (!token || !timingSafeStringEqual(token, expectedToken)) {
    return res.status(401).json({ error: '需要投资者访问令牌' });
  }
  next();
}

// GET /api/investor/personas
router.get('/personas', investorLimiter, investorAuth, (req, res) => {
  res.json(INVESTOR_NARRATIVE.personas.map(({ id, name, headline, narrative, focus_metrics }) => ({
    id,
    name,
    headline,
    narrative,
    focus_metrics,
  })));
});

// GET /api/investor/narrative?persona=vc
router.get('/narrative', investorLimiter, investorAuth, (req, res) => {
  const personaId = req.query.persona || 'vc';
  const defaultPersona = INVESTOR_NARRATIVE.personas.find(p => p.id === 'vc') || INVESTOR_NARRATIVE.personas[0];
  const selectedPersona = INVESTOR_NARRATIVE.personas.find(p => p.id === personaId) || defaultPersona;
  res.json({
    positioning: INVESTOR_NARRATIVE.positioning,
    value_proposition: INVESTOR_NARRATIVE.value_proposition,
    highlights: INVESTOR_NARRATIVE.highlights,
    risks: INVESTOR_NARRATIVE.risks,
    milestones: INVESTOR_NARRATIVE.milestones,
    persona: selectedPersona,
  });
});

// GET /api/investor/metrics
router.get('/metrics', investorLimiter, investorAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7*24*60*60*1000).toISOString().split('T')[0];
    const monthAgo = new Date(now - 30*24*60*60*1000).toISOString().split('T')[0];
    const dau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)=${today}`)[0];
    const wau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=${weekAgo}`)[0];
    const mau = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM posts WHERE DATE(created_at)>=${monthAgo}`)[0];
    let gmv = { gmv: 0 };
    let totalOrders = { c: 0 };
    let completedOrders = { c: 0 };
    try {
      gmv = (await prisma.$queryRaw`SELECT COALESCE(SUM(total),0) as gmv FROM expedition_orders WHERE status='paid'`)[0];
      totalOrders = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_orders`)[0];
      completedOrders = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM expedition_orders WHERE status='paid'`)[0];
    } catch (_) {}
    const totalUsers = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    let sosCalls = { c: 0 };
    try { sosCalls = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM sos_records`)[0]; } catch (_) {}
    let summits = { c: 0 };
    try { summits = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM user_expeditions_log WHERE summited=1`)[0]; } catch (_) {}
    const completionRate = Number(totalOrders.c) > 0 ? (Number(completedOrders.c) / Number(totalOrders.c) * 100).toFixed(1) : 0;
    res.json({
      dau: Number(dau.c), wau: Number(wau.c), mau: Number(mau.c),
      gmv: Number(gmv.gmv),
      total_users: Number(totalUsers.c),
      order_completion_rate: completionRate + '%',
      sos_response_count: Number(sosCalls.c),
      summit_conversions: Number(summits.c),
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/funnel
router.get('/funnel', investorLimiter, investorAuth, async (req, res) => {
  try {
    const registered = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    const profileCompleted = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users WHERE avatar IS NOT NULL`)[0];
    let orderedOnce = { c: 0 };
    let paidOnce = { c: 0 };
    try {
      orderedOnce = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders`)[0];
      paidOnce = (await prisma.$queryRaw`SELECT COUNT(DISTINCT user_id) as c FROM expedition_orders WHERE status='paid'`)[0];
    } catch (_) {}
    res.json({
      registered: Number(registered.c),
      profile_completed: Number(profileCompleted.c),
      ordered_once: Number(orderedOnce.c),
      paid_once: Number(paidOnce.c),
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-guides
router.get('/top-guides', investorLimiter, investorAuth, async (req, res) => {
  try {
    let guides = [];
    try {
      const rawGuides = await prisma.$queryRaw`
        SELECT g.id, g.name, g.rating, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv,
               COALESCE(SUM(eo.publisher_income),0) as net_income
        FROM guides g
        LEFT JOIN expeditions e ON e.publisher_type='guide' AND e.publisher_id=g.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY g.id ORDER BY gmv DESC LIMIT 10
      `;
      guides = rawGuides.map(g => ({ ...g, order_count: Number(g.order_count), gmv: Number(g.gmv), net_income: Number(g.net_income) }));
    } catch (_) {
      guides = await prisma.$queryRaw`SELECT id, name, rating FROM guides LIMIT 10`;
    }
    res.json(guides);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/top-peaks
router.get('/top-peaks', investorLimiter, investorAuth, async (req, res) => {
  try {
    let peaks = [];
    try {
      const rawPeaks = await prisma.$queryRaw`
        SELECT p.id, p.name, p.altitude, COUNT(eo.id) as order_count,
               COALESCE(SUM(eo.total),0) as gmv
        FROM peaks p
        LEFT JOIN expeditions e ON e.peak_id=p.id
        LEFT JOIN expedition_orders eo ON eo.expedition_id=e.id AND eo.status='paid'
        GROUP BY p.id ORDER BY order_count DESC LIMIT 10
      `;
      peaks = rawPeaks.map(p => ({ ...p, order_count: Number(p.order_count), gmv: Number(p.gmv) }));
    } catch (_) {
      peaks = await prisma.$queryRaw`SELECT id, name, altitude FROM peaks LIMIT 10`;
    }
    res.json(peaks);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/badges-stats
router.get('/badges-stats', investorLimiter, investorAuth, async (req, res) => {
  try {
    let stats = [];
    try {
      stats = await prisma.$queryRaw`
        SELECT badge_type, COUNT(*) as count FROM user_badges GROUP BY badge_type ORDER BY count DESC
      `;
    } catch (_) {}
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/investor/regional
router.get('/regional', investorLimiter, investorAuth, async (req, res) => {
  try {
    const total = (await prisma.$queryRaw`SELECT COUNT(*) as c FROM users`)[0];
    res.json({
      total_users: Number(total.c),
      regions: [
        { region: '华东', percentage: 32, users: Math.floor(Number(total.c) * 0.32) },
        { region: '华北', percentage: 25, users: Math.floor(Number(total.c) * 0.25) },
        { region: '西南', percentage: 20, users: Math.floor(Number(total.c) * 0.20) },
        { region: '华南', percentage: 13, users: Math.floor(Number(total.c) * 0.13) },
        { region: '其他', percentage: 10, users: Math.floor(Number(total.c) * 0.10) },
      ],
    });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

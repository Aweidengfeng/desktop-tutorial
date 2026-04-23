const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const auth = require('../middleware/auth');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请稍后再试' },
});

const PRESET_ANSWERS = {
  '如何预防高原反应': '循序渐进地适应高海拔，建议每天上升不超过300-500米，多喝水，避免剧烈运动。',
  '什么是8000米峰': '全球共有14座海拔超过8000米的山峰，均位于喜马拉雅山脉和喀喇昆仑山脉。',
  '攀登需要什么装备': '基础装备包括：登山靴、冰爪、冰镐、安全带、头盔、防寒服、手套等。',
  'default': '这是一个很好的问题！建议您咨询专业向导，或参加SummitLink的线下训练营。',
};

const ROADMAP_BY_LEVEL = {
  beginner: ['珠峰大本营徒步 (5364m)', '四姑娘山大峰 (5025m)', '玉珠峰 (6178m)', '慕士塔格 (7546m)'],
  intermediate: ['玉珠峰 (6178m)', '慕士塔格 (7546m)', '博格达峰 (5445m)', '卓奥友 (8201m)'],
  advanced: ['博格达峰 (5445m)', '梅里雪山 (6740m)', '珠穆朗玛峰 (8848m)', '乔戈里峰 (8611m)'],
};

const GLOSSARY = [
  // 地形 (Terrain)
  { term: '大本营 (Base Camp)', category: '地形', definition: '远征队建立的最低营地，作为补给和协调中心，通常设在攀登峰的山脚下' },
  { term: '前进营地 (Advanced Base Camp)', category: '地形', definition: '设在大本营以上的中转营地，靠近技术攀登起点' },
  { term: '冰川 (Glacier)', category: '地形', definition: '由积雪压实形成的冰体，攀登时常需穿越，伴有冰裂缝风险' },
  { term: '冰瀑区 (Icefall)', category: '地形', definition: '冰川陡峭区段形成的大规模冰块堆积，有崩塌危险，如珠峰孔布冰瀑' },
  { term: '山脊 (Ridge)', category: '地形', definition: '两侧山坡交汇形成的狭长山脊，攀登时需注意侧滑风险' },
  { term: '山坳 (Col/Saddle)', category: '地形', definition: '两座山峰之间的低洼连接部，是重要的中转和营地选择点' },
  { term: '岩壁 (Rock Face/Wall)', category: '地形', definition: '陡峭的垂直或接近垂直的岩石斜面，需要专业技术攀登' },
  { term: '冰壁 (Ice Wall)', category: '地形', definition: '陡峭的冰雪斜面，需要冰镐和冰爪辅助攀登' },
  { term: '雪坡 (Snow Slope)', category: '地形', definition: '被积雪覆盖的山坡，根据倾斜角度区分为简单步行到技术攀登' },
  { term: '库仑/雪槽 (Couloir)', category: '地形', definition: '山壁上狭长的雪或冰的沟槽，常作为快速上升路线，有落石落冰风险' },
  { term: '裂缝 (Crevasse)', category: '地形', definition: '冰川上因冰体运动形成的深沟裂隙，有时被积雪覆盖形成"雪桥"' },
  { term: '悬冰川 (Serac)', category: '地形', definition: '冰川中不稳定的冰塔或冰崖，崩塌风险极高，需快速通过' },
  { term: '高原 (Plateau)', category: '地形', definition: '海拔较高、地形相对平坦的区域，常见于西藏高原等地' },
  { term: '垭口 (Pass)', category: '地形', definition: '山脉间可供翻越的低洼点，是重要的战略性路线节点' },
  { term: '峰顶 (Summit)', category: '地形', definition: '山峰的最高点，登顶者的最终目标' },
  { term: '岩钉/岩角 (Rock Buttress)', category: '地形', definition: '从主山体突出的岩石支柱，常用于识别路线特征' },
  { term: '混合地形 (Mixed Terrain)', category: '地形', definition: '同时包含岩石、冰雪的复合地形，需要混合攀登技术' },
  { term: '雪崩道 (Avalanche Path)', category: '地形', definition: '雪崩频繁运行的区域，应尽量快速通过或绕行' },
  { term: '斜壁 (Slab)', category: '地形', definition: '角度平缓的整块岩石斜面，依赖摩擦力攀登' },
  { term: '大岩壁 (Big Wall)', category: '地形', definition: '高度超过600米的垂直或接近垂直的岩壁，如酋长岩' },

  // 技术 (Techniques)
  { term: '自我制动 (Self-Arrest)', category: '技术', definition: '滑坠时用冰镐刺入雪/冰面来阻止下滑的紧急制动技术' },
  { term: '普鲁士结 (Prusik Knot)', category: '技术', definition: '用绳套绕绕主绳形成的摩擦结，受力后夹紧，用于上升或保护系统' },
  { term: '上升器 (Ascender/Jumar)', category: '技术', definition: '单向锁定装置，可沿绳子向上移动，是固定绳攀登的必备工具' },
  { term: '下降器 (Descender)', category: '技术', definition: '控制下降速度的辅助装置，常见有八字环、ATC等' },
  { term: '阿尔派风格 (Alpine Style)', category: '技术', definition: '轻装、快速、自给自足地攀登，不预先架设固定绳和营地' },
  { term: '围攻战术 (Siege Tactics)', category: '技术', definition: '预先架设固定绳、建立多个营地、储备物资的传统商业攀登方式' },
  { term: '冰爪步法 (Crampon Technique)', category: '技术', definition: '使用冰爪行走的技术，包括法式（平踏法）和德式（前爪法）' },
  { term: '前爪攀登 (Front-Pointing)', category: '技术', definition: '用冰爪前两个尖刺刺入冰面向上攀登的技术，适用于陡峭冰壁' },
  { term: '绳降 (Rappelling/Abseiling)', category: '技术', definition: '沿绳子向下滑降的技术，是下撤陡峭地形的基本技能' },
  { term: '保护站 (Belay Anchor)', category: '技术', definition: '将攀登者保护系统固定在岩石、冰雪或地物上的可靠支点' },
  { term: '顶绳保护 (Top Rope)', category: '技术', definition: '绳子从顶端穿过，攀登者攀登时始终处于保护下的安全系统' },
  { term: '先锋攀登 (Lead Climbing)', category: '技术', definition: '攀登者在前方边爬边设置保护点的攀登方式，风险更高' },
  { term: '冰钉 (Ice Screw)', category: '技术', definition: '旋入冰面作为保护支点的金属螺旋管，是冰攀的核心保护装置' },
  { term: '岩塞/凸轮 (Nut/Cam)', category: '技术', definition: '塞入岩石裂缝中作为保护支点的机械装置' },
  { term: '结组攀登 (Roped Climbing)', category: '技术', definition: '攀登者以绳索相连，互相保护的攀登方式' },
  { term: '跑步攀登 (Simul Climbing)', category: '技术', definition: '绳队同时攀登而不停止保护，适合简单路段，速度快但风险较高' },
  { term: '混合攀登 (Mixed Climbing)', category: '技术', definition: '在冰雪和岩石混合地形上使用冰具和手法综合攀登的技术' },
  { term: '十字结 (Clove Hitch)', category: '技术', definition: '常用于绑在岩钉或保护站上的实用结，易调整长度' },
  { term: '8字结 (Figure-8 Knot)', category: '技术', definition: '最基础的攀登接绳结，将绳子穿过安全带用于连接' },
  { term: '等距补强系统 (SERENE/EQUALETTE)', category: '技术', definition: '用于均匀分配锚点受力的保护站构建系统' },
  { term: '布须曼步 (Flagging)', category: '技术', definition: '攀岩中将一条腿侧向放置以平衡身体、减少倾覆的技术' },

  // 装备 (Equipment)
  { term: '冰爪 (Crampons)', category: '装备', definition: '安装在登山靴底部的金属爪，用于在冰雪上行走，分10爪/12爪/前爪式' },
  { term: '冰镐 (Ice Axe)', category: '装备', definition: '登山必备工具，用于自我制动、辅助攀登和雪坡行走，分技术冰镐和登山镐' },
  { term: '安全带 (Harness)', category: '装备', definition: '穿戴在腰部和大腿的带状装置，连接攀登者与绳索保护系统' },
  { term: '头盔 (Helmet)', category: '装备', definition: '保护头部免受落石和冰块冲击的防护装备，高山攀登必备' },
  { term: '上升器 (Ascender)', category: '装备', definition: '沿固定绳向上移动的单向锁定装置，常见品牌为Jumar、Petzl等' },
  { term: '主锁 (Carabiner)', category: '装备', definition: '连接攀登系统各组件的金属钩环，分锁门和不锁门两类' },
  { term: '扁带 (Sling/Runner)', category: '装备', definition: '扁平织带制成的环形带，用于建立保护站或延伸保护点' },
  { term: '主绳 (Dynamic Rope)', category: '装备', definition: '能吸收冲坠冲击力的弹性绳索，是先锋攀登的核心装备' },
  { term: '辅绳 (Cord/Accessory Cord)', category: '装备', definition: '直径较细的静力或半静力绳，用于建立普鲁士结等辅助系统' },
  { term: '高山靴 (Mountaineering Boot)', category: '装备', definition: '专为高海拔或冰雪攀登设计的硬底靴，分单层和双层高山靴' },
  { term: '岩靴 (Rock Shoe)', category: '装备', definition: '紧贴脚型的橡胶底攀岩鞋，最大化摩擦力和感知力' },
  { term: '雪杖 (Trekking Pole)', category: '装备', definition: '辅助行走平衡和减轻膝盖压力的可调节手杖' },
  { term: 'GPS设备 (GPS Device)', category: '装备', definition: '提供位置信息和导航功能的电子设备，高山探险必备' },
  { term: '冲锋衣 (Shell Jacket)', category: '装备', definition: '防水防风的外层冲锋衣，是应对恶劣天气的关键装备' },
  { term: '羽绒服 (Down Jacket)', category: '装备', definition: '以鹅绒或鸭绒为填充的保暖夹克，是高海拔营地保暖主力' },
  { term: '睡袋 (Sleeping Bag)', category: '装备', definition: '高海拔攀登需使用-30°C或以下温标的羽绒睡袋' },
  { term: '高山帐 (High Camp Tent)', category: '装备', definition: '专为高海拔强风暴雪设计的轻量化帐篷，结构抗压' },
  { term: '头灯 (Headlamp)', category: '装备', definition: '固定在头部的照明工具，夜间攀登和早出营地必备' },
  { term: '雪锚 (Snow Anchor/Dead Man)', category: '装备', definition: '水平埋入雪中作为固定点的装置，用于雪坡保护站' },
  { term: '高山炉具 (High-Altitude Stove)', category: '装备', definition: '在低气压低氧环境仍可正常工作的液化气或汽油炉' },

  // 生理 (Physiology)
  { term: '高原反应 (AMS - Acute Mountain Sickness)', category: '生理', definition: '急性高原病，症状包括头痛、恶心、疲劳，通常发生在2500m以上' },
  { term: '高原肺水肿 (HAPE - High Altitude Pulmonary Edema)', category: '生理', definition: '肺部积液，致命性高原病，表现为呼吸困难、咳粉红色泡沫，须立即下撤并吸氧' },
  { term: '高原脑水肿 (HACE - High Altitude Cerebral Edema)', category: '生理', definition: '大脑组织液积累，严重高原病，症状包括共济失调和意识改变，须立即下撤' },
  { term: '适应性训练 (Acclimatization)', category: '生理', definition: '通过循序渐进地暴露于高海拔让身体逐步适应低氧环境的过程' },
  { term: '死亡区 (Death Zone)', category: '生理', definition: '海拔8000米以上区域，大气压和氧分压极低，人体无法完全适应，长期停留会导致死亡' },
  { term: '补充氧气 (Supplemental Oxygen)', category: '生理', definition: '高海拔攀登中使用的瓶装氧气，可显著提升攀登者的运动能力和安全性' },
  { term: '脉搏血氧仪 (Pulse Oximeter)', category: '生理', definition: '测量血液氧饱和度的便携设备，是高原监测的重要工具' },
  { term: '高山症药物 (Acetazolamide/Diamox)', category: '生理', definition: '乙酰唑胺，用于预防和治疗急性高原反应的常用药物' },
  { term: '脱水 (Dehydration)', category: '生理', definition: '高海拔因呼吸加速和汗液蒸发加剧，脱水速度远高于平原，须保持补水' },
  { term: '低温症 (Hypothermia)', category: '生理', definition: '体温过低导致的医疗紧急情况，高山攀登中的重要风险' },
  { term: '冻伤 (Frostbite)', category: '生理', definition: '极低温导致肢体末端组织冻结损伤，手指脚趾鼻尖是高危部位' },
  { term: '高原减重 (Altitude Weight Loss)', category: '生理', definition: '高海拔下因食欲减退和能量消耗增加导致的体重减轻现象' },
  { term: '睡眠呼吸暂停 (Cheyne-Stokes Respiration)', category: '生理', definition: '高海拔睡眠中出现的周期性呼吸暂停，导致夜间频繁醒来' },
  { term: '红细胞增多 (Polycythemia)', category: '生理', definition: '身体对高海拔低氧的长期适应反应，增加血液携氧能力' },
  { term: '功率输出下降 (Power Output Reduction)', category: '生理', definition: '海拔每升高1000m，有氧运动功率约下降8-10%' },
  { term: '核心温度 (Core Temperature)', category: '生理', definition: '身体内部维持生命的温度，正常值约37°C，低于35°C进入低温症状态' },
  { term: '周期性呼吸 (Periodic Breathing)', category: '生理', definition: '高海拔睡眠时出现的不规律呼吸节律，是正常高原适应反应' },
  { term: '糖原储备 (Glycogen Reserve)', category: '生理', definition: '肌肉和肝脏中储存的能量糖原，高海拔攀登中消耗极快' },
  { term: '乳酸阈值 (Lactate Threshold)', category: '生理', definition: '运动强度超过此阈值时乳酸积累速度加剧，是耐力训练的关键指标' },
  { term: '最大摄氧量 (VO2 Max)', category: '生理', definition: '单位时间内最大耗氧量，是评估有氧能力的核心指标，高海拔时显著下降' },
  { term: '肌肉萎缩 (Muscle Atrophy)', category: '生理', definition: '长期高海拔停留导致肌肉组织分解，是远征后恢复的挑战之一' },

  // 天气 (Weather)
  { term: '峰顶窗口期 (Summit Window)', category: '天气', definition: '适合冲顶的短暂好天气窗口，通常只有数小时，需等待和把握' },
  { term: '射流 (Jet Stream)', category: '天气', definition: '高空强风带，是喜马拉雅春秋攀登季节的关键气象因素，窗口期是射流暂时北移时' },
  { term: '季风 (Monsoon)', category: '天气', definition: '每年6-9月影响喜马拉雅的印度洋季风，带来大量降水，使攀登条件极差' },
  { term: '白化天 (Whiteout)', category: '天气', definition: '雪地反光与低云浑为一体导致视野极差、无法判断地形的危险天气状况' },
  { term: '雪崩 (Avalanche)', category: '天气', definition: '山坡上积雪突然滑落的危险自然现象，是山地事故的主要原因之一' },
  { term: '风寒效应 (Wind Chill)', category: '天气', definition: '强风使体感温度远低于实际气温的现象，8000m区域风速可达100km/h以上' },
  { term: '积冰 (Rime Ice)', category: '天气', definition: '过冷水滴遇物体冻结形成的白色不透明冰层，可大量积累在装备和帐篷上' },
  { term: '旗云 (Banner Cloud/Lenticular Cloud)', category: '天气', definition: '山峰背风面形成的特殊云状，可作为预判强风的参考指标' },
  { term: '辐射冷却 (Radiative Cooling)', category: '天气', definition: '晴天夜晚地表快速散热导致的急剧降温，高山露营时需注意' },
  { term: '气象卫星预报 (Satellite Weather Forecast)', category: '天气', definition: '通过气象卫星获取的高精度天气预报，是现代远征决策的重要依据' },
  { term: '落石 (Rockfall)', category: '天气', definition: '因温差变化、积冰融化等因素导致的岩石松动坠落，是冰雪融化季节的主要危险' },
  { term: '雪盲 (Snow Blindness)', category: '天气', definition: '紫外线在雪面强烈反射导致的眼部灼伤，须佩戴护目镜或墨镜' },
  { term: '冰爆 (Glacial Burst)', category: '天气', definition: '冰川冰坝溃决导致的突发性洪水，危及下游攀登者和营地' },
  { term: '高空风速预报 (High-Altitude Wind Forecast)', category: '天气', definition: '针对海拔7000m以上高空风速的专业气象预报，对冲顶决策至关重要' },
  { term: '绕山气流 (Mountain Wave/Lee Wave)', category: '天气', definition: '气流绕过山体产生的波状扰动，可在山体背风面造成局部强风和颠簸' },
];

// POST /api/ai-coach/assessment - save user assessment
router.post('/assessment', writeLimiter, auth, async (req, res) => {
  try {
    const { max_altitude, gear_skill, fitness, technical_skill, goal_peak } = req.body;
    const now = new Date().toISOString();
    await prisma.$executeRaw`
      INSERT INTO coach_assessments (user_id, max_altitude, gear_skill, fitness, technical_skill, goal_peak, created_at, updated_at)
      VALUES (${req.user.id}, ${max_altitude || 0}, ${gear_skill || 'beginner'}, ${fitness || 'moderate'}, ${technical_skill || 'beginner'}, ${goal_peak || null}, ${now}, ${now})
      ON CONFLICT(user_id) DO UPDATE SET
        max_altitude = excluded.max_altitude,
        gear_skill = excluded.gear_skill,
        fitness = excluded.fitness,
        technical_skill = excluded.technical_skill,
        goal_peak = excluded.goal_peak,
        updated_at = excluded.updated_at
    `;
    const assessment = (await prisma.$queryRaw`SELECT * FROM coach_assessments WHERE user_id = ${req.user.id}`)[0];
    res.json(assessment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/ai-coach/assessment - get user's assessment
router.get('/assessment', auth, async (req, res) => {
  try {
    const assessment = (await prisma.$queryRaw`SELECT * FROM coach_assessments WHERE user_id = ${req.user.id}`)[0];
    if (!assessment) return res.status(404).json({ error: '未找到评估记录，请先完成评估' });
    res.json(assessment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/ai-coach/roadmap - get personalized climbing roadmap
router.get('/roadmap', auth, async (req, res) => {
  try {
    const assessment = (await prisma.$queryRaw`SELECT * FROM coach_assessments WHERE user_id = ${req.user.id}`)[0];
    let level = 'beginner';
    if (assessment) {
      if (assessment.max_altitude >= 7000 || assessment.technical_skill === 'advanced') level = 'advanced';
      else if (assessment.max_altitude >= 5000 || assessment.technical_skill === 'intermediate') level = 'intermediate';
    }
    const roadmap = ROADMAP_BY_LEVEL[level] || ROADMAP_BY_LEVEL.beginner;
    res.json({ level, roadmap, goal_peak: assessment?.goal_peak || null });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/ai-coach/terms - get climbing terminology glossary
router.get('/terms', (req, res) => {
  res.json(GLOSSARY);
});

// POST /api/ai-coach/ask - ask question
router.post('/ask', writeLimiter, auth, (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: '问题不能为空' });
    const answer = Object.entries(PRESET_ANSWERS).find(([key]) => question.includes(key))?.[1] || PRESET_ANSWERS.default;
    res.json({ question, answer, source: 'ai_coach_v1' });
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

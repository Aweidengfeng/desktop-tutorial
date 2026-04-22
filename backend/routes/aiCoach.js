const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
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
  { term: '大本营 (Base Camp)', definition: '远征队建立的最低营地，作为补给和协调中心' },
  { term: '适应性训练', definition: '在低海拔反复锻炼，帮助身体适应高海拔的训练方法' },
  { term: '冰川 (Glacier)', definition: '由积雪压实形成的冰体，攀登时常需穿越' },
  { term: '冰爪 (Crampons)', definition: '安装在登山靴底部的金属爪，用于在冰雪上行走' },
  { term: '冰镐 (Ice Axe)', definition: '登山必备工具，用于自我制动和辅助攀登' },
  { term: '高原反应 (AMS)', definition: '急性高原病，症状包括头痛、恶心、疲劳等' },
  { term: '峰顶窗口期', definition: '适合冲顶的天气窗口，通常只有数小时' },
  { term: '固定绳 (Fixed Rope)', definition: '提前架设在危险路段的绳索，供攀登者使用' },
];

// POST /api/ai-coach/assessment - save user assessment
router.post('/assessment', writeLimiter, auth, (req, res) => {
  try {
    const { max_altitude, gear_skill, fitness, technical_skill, goal_peak } = req.body;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO coach_assessments (user_id, max_altitude, gear_skill, fitness, technical_skill, goal_peak, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        max_altitude = excluded.max_altitude,
        gear_skill = excluded.gear_skill,
        fitness = excluded.fitness,
        technical_skill = excluded.technical_skill,
        goal_peak = excluded.goal_peak,
        updated_at = excluded.updated_at
    `).run(req.user.id, max_altitude || 0, gear_skill || 'beginner', fitness || 'moderate', technical_skill || 'beginner', goal_peak || null, now, now);
    const assessment = db.prepare('SELECT * FROM coach_assessments WHERE user_id = ?').get(req.user.id);
    res.json(assessment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/ai-coach/assessment - get user's assessment
router.get('/assessment', auth, (req, res) => {
  try {
    const assessment = db.prepare('SELECT * FROM coach_assessments WHERE user_id = ?').get(req.user.id);
    if (!assessment) return res.status(404).json({ error: '未找到评估记录，请先完成评估' });
    res.json(assessment);
  } catch (e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/ai-coach/roadmap - get personalized climbing roadmap
router.get('/roadmap', auth, (req, res) => {
  try {
    const assessment = db.prepare('SELECT * FROM coach_assessments WHERE user_id = ?').get(req.user.id);
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

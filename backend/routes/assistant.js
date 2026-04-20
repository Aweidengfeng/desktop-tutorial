const express = require('express');
const router = express.Router();
const https = require('https');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');

const assistantLimiter = rateLimit({ windowMs: 60*1000, max: 10 });

const MOCK_REPLIES = [
  '根据您的轨迹记录和目标山峰数据，我建议您在出发前做好充分的高反适应训练。',
  '当前天气条件适合攀登，风速较低，能见度良好。建议早晨6点前出发。',
  '您选择的路线难度中等，预计需要5-7天。请确保携带足够的补给和保暖装备。',
  'SummitLink为您提供专业向导服务，您可以在"探索"页面找到认证向导。',
];

router.post('/chat', auth, assistantLimiter, async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const mockReply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
      return res.json({
        reply: mockReply,
        citations: [],
        mock: true,
      });
    }

    let systemPrompt = 'You are SummitLink Copilot, a professional mountaineering assistant. Answer in Chinese.';

    if (context?.peakId) {
      try {
        const peak = db.prepare('SELECT name, altitude, difficulty, description FROM peaks WHERE id = ?').get(context.peakId);
        if (peak) systemPrompt += `\n当前山峰: ${peak.name} (${peak.altitude}m, ${peak.difficulty})`;
      } catch(e) {}
    }

    try {
      const tracks = db.prepare('SELECT name, peak_name, distance_km, elevation_gain FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT 3').all(req.user.id);
      if (tracks.length > 0) {
        systemPrompt += '\n用户近期轨迹: ' + tracks.map(t => `${t.name}(${t.peak_name},${t.distance_km}km)`).join(', ');
      }
    } catch(e) {}

    const payload = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 500,
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(payload) },
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          const reply = json.choices?.[0]?.message?.content || '暂时无法回答，请稍后再试';
          res.json({ reply, citations: [] });
        } catch(e) {
          res.status(500).json({ error: '解析响应失败' });
        }
      });
    });
    apiReq.on('error', () => res.status(500).json({ error: 'AI服务暂时不可用' }));
    apiReq.write(payload);
    apiReq.end();
  } catch(e) {
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

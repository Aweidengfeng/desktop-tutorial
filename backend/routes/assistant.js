const express = require('express');
const router = express.Router();
const https = require('https');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

const assistantLimiter = rateLimit({ windowMs: 60*1000, max: 10 });

// 智能本地回复（无 OPENAI_API_KEY 时使用）
function localAssistantReply(message) {
  const msg = (message || '').toLowerCase();
  if (msg.includes('天气') || msg.includes('气候') || msg.includes('weather')) {
    return '珠峰攀登窗口期通常在5月（季前）和10月（季后）。建议实时查看 Summit Weather 或 Mountain-Forecast，提前5天的预报可靠性较高。';
  }
  if (msg.includes('装备') || msg.includes('gear') || msg.includes('背包')) {
    return '高海拔必备装备：羽绒睡袋（-30°C）、高山靴、冰爪、冰镐、头盔、安全带、下降器、头灯（备用电池）、氧气瓶（8000m以上建议携带）。详细清单请查看装备清单页面。';
  }
  if (msg.includes('高反') || msg.includes('高原') || msg.includes('altitude') || msg.includes('acclim')) {
    return '高反预防：1) 缓慢升高，每天净升高不超过500m。2) "爬高睡低"原则。3) 充分补水。4) 可预防性服用乙酰唑胺（需医嘱）。出现严重头痛、呼吸困难立即下撤。';
  }
  if (msg.includes('证件') || msg.includes('permit') || msg.includes('许可')) {
    return '攀登许可因山峰不同而异：\n• 珠峰（北坡）：中国登山协会颁发，费用约¥35,000/人\n• K2：巴基斯坦体育旅游部，约$2,000\n• 厄尔布鲁士：免许可，仅需注册';
  }
  if (msg.includes('向导') || msg.includes('guide') || msg.includes('陪登')) {
    return '专业向导可大幅提升安全性。在 SummitLink 上可浏览认证向导，按山峰/地区/语言筛选，直接发送消息洽谈行程。';
  }
  if (msg.includes('保险') || msg.includes('insurance')) {
    return '高海拔攀登建议购买涵盖直升机救援的专项户外保险，如 Global Rescue、Ripcord 或国内平安/太平洋的户外险。注意确认覆盖的最高海拔限制。';
  }
  if (msg.includes('你好') || msg.includes('hello') || msg.includes('hi') || msg.includes('在吗')) {
    return '你好！我是 SummitLink AI 助手 🏔 我可以解答攀登相关问题：天气窗口、装备建议、高反预防、许可申请等。有什么可以帮你的？';
  }
  return '感谢你的提问！配置 OPENAI_API_KEY 后我将提供更精准的 AI 回答。目前我可以解答：天气窗口 / 装备建议 / 高反预防 / 攀登许可 / 保险建议 等话题，请重新描述你的问题。';
}

router.post('/chat', assistantLimiter, auth, async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const lastMsg = Array.isArray(messages) ? (messages[messages.length - 1]?.content || '') : '';
      const reply = localAssistantReply(lastMsg);
      return res.json({
        reply,
        citations: [],
        source: 'local',
      });
    }

    let systemPrompt = 'You are SummitLink Copilot, a professional mountaineering assistant. Answer in Chinese.';

    if (context?.peakId) {
      try {
        const peak = (await prisma.$queryRaw`SELECT name, altitude, difficulty, description FROM peaks WHERE id = ${context.peakId}`)[0];
        if (peak) systemPrompt += `\n当前山峰: ${peak.name} (${peak.altitude}m, ${peak.difficulty})`;
      } catch(e) {}
    }

    try {
      const tracks = await prisma.$queryRaw`SELECT name, peak_name, distance_km, elevation_gain FROM tracks WHERE user_id = ${req.user.id} ORDER BY created_at DESC LIMIT 3`;
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

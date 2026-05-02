/**
 * aiCoach.js — AI 教练服务（渐进增强）
 * 支持 Claude (Anthropic) 和 OpenAI GPT 双引擎，按优先级自动选择。
 * 若均未配置，返回内置规则建议（离线降级）。
 *
 * 环境变量：
 *   ANTHROPIC_API_KEY   Claude API Key（优先）
 *   OPENAI_API_KEY      OpenAI API Key（次选）
 *   AI_MODEL_CLAUDE     Claude 模型，默认 claude-3-haiku-20240307
 *   AI_MODEL_OPENAI     OpenAI 模型，默认 gpt-4o-mini
 */

const CLAUDE_ENABLED = !!process.env.ANTHROPIC_API_KEY;
const OPENAI_ENABLED = !!process.env.OPENAI_API_KEY;
const AI_ENABLED = CLAUDE_ENABLED || OPENAI_ENABLED;

const SYSTEM_PROMPT = `你是 AlpineLink 平台的专业高山训练教练，名叫"峰岭"。
你精通高海拔登山、技术攀岩、体能训练和装备选择。
回答要简洁专业，中文为主，必要时使用英文专业术语。
每次回答控制在 300 字以内，提供可操作的具体建议。
不要提供医疗诊断，但可以建议寻求专业医疗意见。`;

// 内置离线降级建议库
const OFFLINE_TIPS = {
  训练: '建议每周进行3次有氧训练（跑步/骑行）、2次力量训练（深蹲/硬拉/引体向上），并加入负重徒步模拟登山负重。海拔适应训练建议提前4-6周开始低海拔适应。',
  装备: '核心装备清单：防水冲锋衣、保暖中间层、硬壳头盔、冰爪（技术线路）、冰镐（雪坡≥40°）、高海拔睡袋（-20°C）、高原防晒（SPF50+）。',
  饮食: '高海拔热量需求增加20-30%。建议富含碳水化合物（60%），保持充足水分（每日3-4L），携带高热量零食（坚果/能量棒）。避免酒精，谨慎使用咖啡因。',
  安全: '遵守"爬升不超过500m/天"原则，保持"爬高睡低"策略。高海拔症状（头痛/恶心/失眠）出现时立即下撤，不可强行上升。',
  default: '专业建议需要了解您的具体目标和当前体能水平。建议先完成体能评估，制定个性化训练计划。如需详细指导，请在平台预约专业向导。',
};

function getOfflineTip(message) {
  for (const [key, tip] of Object.entries(OFFLINE_TIPS)) {
    if (key !== 'default' && message.includes(key)) return tip;
  }
  return OFFLINE_TIPS.default;
}

async function askClaude(messages, systemPrompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.AI_MODEL_CLAUDE || 'claude-3-haiku-20240307',
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });
  return response.content[0].text;
}

async function askOpenAI(messages, systemPrompt) {
  const OpenAI = require('openai');
  const client = new OpenAI.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.AI_MODEL_OPENAI || 'gpt-4o-mini',
    max_tokens: 512,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  });
  return response.choices[0].message.content;
}

/**
 * 向 AI 教练提问
 * @param {Array} messages  [{role:'user'|'assistant', content:'...'}]
 * @param {string} [context]  额外上下文（用户档案、所选山峰等）
 * @returns {Promise<{reply: string, engine: string}>}
 */
async function askCoach(messages, context) {
  const systemPrompt = context
    ? `${SYSTEM_PROMPT}\n\n用户上下文：${context}`
    : SYSTEM_PROMPT;

  if (CLAUDE_ENABLED) {
    try {
      const reply = await askClaude(messages, systemPrompt);
      return { reply, engine: 'claude' };
    } catch (e) {
      console.warn('[aiCoach] Claude 失败，尝试 OpenAI:', e.message);
    }
  }
  if (OPENAI_ENABLED) {
    try {
      const reply = await askOpenAI(messages, systemPrompt);
      return { reply, engine: 'openai' };
    } catch (e) {
      console.warn('[aiCoach] OpenAI 失败，降级离线:', e.message);
    }
  }
  // 离线降级
  const lastMsg = messages[messages.length - 1]?.content || '';
  return { reply: getOfflineTip(lastMsg), engine: 'offline' };
}

module.exports = { askCoach, AI_ENABLED, CLAUDE_ENABLED, OPENAI_ENABLED };

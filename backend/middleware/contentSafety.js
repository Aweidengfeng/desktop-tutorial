/**
 * 阿里云内容安全图片审核中间件（框架）
 * 生产环境：调用阿里云内容安全 API
 * 开发/测试环境：直接放行
 */
const checkImageSafety = async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || !process.env.ALIYUN_ACCESS_KEY_ID) {
    return next(); // 非生产或未配置key则跳过
  }
  try {
    // TODO: 接入阿里云内容安全 SDK
    // const Green = require('@alicloud/green20220302');
    // const result = await Green.imageSync({ ...imageData });
    // if (result.suggestion === 'block') return res.status(400).json({ error: '图片内容违规' });
    next();
  } catch (err) {
    console.error('[contentSafety] 审核失败，放行：', err.message);
    next(); // 审核失败时放行（不阻断用户流程）
  }
};

module.exports = { checkImageSafety };

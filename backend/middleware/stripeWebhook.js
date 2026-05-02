/**
 * Stripe Webhook 签名验证中间件
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

module.exports = function verifyStripeWebhook(req, res, next) {
  const sig = req.headers['stripe-signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET 未设置，跳过签名验证（仅开发环境）');
    return next();
  }
  try {
    req.stripeEvent = stripe.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
    next();
  } catch (err) {
    console.error('❌ Stripe webhook 签名验证失败:', err.message);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
};

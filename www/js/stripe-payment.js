/**
 * SummitLink Stripe 支付组件
 * 使用方式：
 *   const payment = new StripePayment();
 *   await payment.init();
 *   await payment.showPaymentSheet({ amount: 99.00, currency: 'usd', orderId: '123', orderType: 'expedition' });
 */
class StripePayment {
  constructor() {
    this.stripe = null;
    this.elements = null;
  }

  async init() {
    const res = await fetch('/api/payment/config');
    const { publishableKey } = await res.json();
    if (!publishableKey) throw new Error('Stripe publishable key not configured');
    this.stripe = Stripe(publishableKey);
  }

  async createPaymentSheet(container, { amount, currency, orderId, orderType }) {
    const res = await fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ amount, currency, orderId, orderType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '创建支付意图失败');
    const { clientSecret } = data;

    this.elements = this.stripe.elements({ clientSecret });
    const paymentElement = this.elements.create('payment');
    paymentElement.mount(container);
    return clientSecret;
  }

  async confirmPayment(returnUrl) {
    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: returnUrl || window.location.origin + '/payment-success',
      },
    });
    if (error) throw new Error(error.message);
  }
}

window.StripePayment = StripePayment;

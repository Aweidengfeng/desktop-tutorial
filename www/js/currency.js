/**
 * SummitLink 多货币显示工具
 */
const CURRENCY_SYMBOLS = { usd: '$', eur: '€', cny: '¥', gbp: '£', jpy: '¥', aud: 'A$', cad: 'C$' };

class CurrencyFormatter {
  constructor() {
    this.rates = null;
    this.userCurrency = localStorage.getItem('preferredCurrency') || this._detectCurrency();
  }

  _detectCurrency() {
    const lang = navigator.language || 'en-US';
    if (lang.startsWith('zh')) return 'cny';
    if (lang.startsWith('ja')) return 'jpy';
    if (lang.includes('GB')) return 'gbp';
    if (lang.includes('AU')) return 'aud';
    if (lang.includes('CA')) return 'cad';
    return 'usd';
  }

  async loadRates() {
    try {
      const res = await fetch('/api/currency/rates');
      const data = await res.json();
      this.rates = data.rates;
    } catch (e) {
      // Fallback rates must match BASE_RATES in backend/routes/currency.js
      this.rates = { usd: 1, eur: 0.92, cny: 7.24, gbp: 0.79, jpy: 149.5, aud: 1.53, cad: 1.36 };
    }
  }

  format(amountUSD, targetCurrency) {
    const currency = (targetCurrency || this.userCurrency).toLowerCase();
    const rate = this.rates?.[currency] || 1;
    const converted = amountUSD * rate;
    const symbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase();
    return `${symbol}${converted.toFixed(2)}`;
  }

  setUserCurrency(currency) {
    this.userCurrency = currency.toLowerCase();
    localStorage.setItem('preferredCurrency', this.userCurrency);
  }
}

window.CurrencyFormatter = CurrencyFormatter;
window.currencyFormatter = new CurrencyFormatter();
// 自动加载汇率
window.currencyFormatter.loadRates();

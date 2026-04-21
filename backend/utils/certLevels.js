const GUIDE_CERT_LEVELS = {
  basic:  { label: '入门向导', yearFee: 299,  commissionRate: 0.15, badge: '✅', priority: 1 },
  pro:    { label: '专业向导', yearFee: 699,  commissionRate: 0.10, badge: '🌟', priority: 2 },
  expert: { label: '资深向导', yearFee: 1299, commissionRate: 0.05, badge: '🏔️', priority: 3 },
};

const CLUB_CERT_LEVELS = {
  standard: { label: '标准俱乐部', yearFee: 999,  commissionRate: 0.15, badge: '🏛️', priority: 1 },
  advanced: { label: '高级俱乐部', yearFee: 2499, commissionRate: 0.10, badge: '⭐', priority: 2 },
  flagship: { label: '旗舰俱乐部', yearFee: 4999, commissionRate: 0.05, badge: '🚀', priority: 3 },
};

module.exports = { GUIDE_CERT_LEVELS, CLUB_CERT_LEVELS };

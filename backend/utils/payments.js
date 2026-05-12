function paymentsEnabled() {
  return String(process.env.PAYMENTS_ENABLED || 'false').toLowerCase() === 'true';
}

function paymentsDisabledResponse(res) {
  return res.status(503).json({
    error: 'payments_disabled',
    message: 'Payments are not yet available in this region. Please check back soon.',
  });
}

module.exports = {
  paymentsEnabled,
  paymentsDisabledResponse,
};

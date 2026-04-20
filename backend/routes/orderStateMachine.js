const VALID_TRANSITIONS = {
  'pending_payment': ['paid', 'cancelled'],
  'paid': ['departing', 'refund_requested', 'cancelled'],
  'departing': ['completed'],
  'completed': ['reviewed'],
  'refund_requested': ['refunded', 'paid'],
  'refunded': [],
  'cancelled': [],
  'reviewed': [],
};

function appendStatusHistory(current, newStatus) {
  let history = [];
  try { history = JSON.parse(current || '[]'); } catch(e) {
    console.warn('[orders] Corrupted status_history JSON, resetting:', e.message);
  }
  history.push({ status: newStatus, at: new Date().toISOString() });
  return JSON.stringify(history);
}

module.exports = { VALID_TRANSITIONS, appendStatusHistory };

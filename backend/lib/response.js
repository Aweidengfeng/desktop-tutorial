function success(res, data, message = '', status = 200) {
  return res.status(status).json({ code: 0, data, message });
}

function fail(res, message, status = 400, code = -1) {
  return res.status(status).json({ code, error: message, message });
}

module.exports = { success, fail };

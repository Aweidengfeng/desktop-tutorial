const DEFAULT_TIMEOUT = 10000;

export async function apiRequest(url, options = {}, { token, retries = 0 } = {}) {
  const controller = new AbortController();
  const { timeout = DEFAULT_TIMEOUT, headers: optionHeaders = {}, ...fetchOptions } = options || {};
  const timer = setTimeout(() => controller.abort(), timeout);
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const hasJsonBody = fetchOptions.body !== undefined && fetchOptions.body !== null && !isFormData;

  const headers = {
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...optionHeaders,
  };

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || body.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return res.text();
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (retries > 0 && method === 'GET' && e.name !== 'AbortError') {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (3 - retries)));
      return apiRequest(url, options, { token, retries: retries - 1 });
    }
    throw e;
  }
}

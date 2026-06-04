import axios from 'axios';

export const apiClient = axios.create({
  baseURL: window.__API_BASE__ || '',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  // 为状态变更请求附带双提交 CSRF 令牌（从 adminCsrf Cookie 读取）
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const m = document.cookie.match(/(?:^|;\s*)adminCsrf=([^;]+)/);
    if (m) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['X-CSRF-Token'] = decodeURIComponent(m[1]);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/admin-v2#/login';
    }
    return Promise.reject(err);
  }
);

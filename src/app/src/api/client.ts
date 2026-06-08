import axios from 'axios';

// API base: 开发时 Vite 代理到 localhost:8080，生产时从 /api/config 获取
const BASE_URL = (window as Window).__API_BASE__ || '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 自动附加 JWT token（优先 localStorage，兼容 Cookie 模式）
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sl_token');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)['Authorization'] = 'Bearer ' + token;
  }
  return config;
});

// 401 → 清除 token 并跳转到登录页
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sl_token');
      localStorage.removeItem('sl_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  /** 手机号密码登录 */
  loginPassword: (phone: string, password: string) =>
    apiClient.post('/api/auth/login', { phone, password }),

  /** 注册 */
  register: (data: { phone?: string; email?: string; password: string; username?: string }) =>
    apiClient.post('/api/auth/register', data),

  /** 发送手机验证码 */
  sendSmsCode: (phone: string) =>
    apiClient.post('/api/auth/sms/send', { phone }),

  /** 验证手机验证码登录 */
  verifySmsCode: (phone: string, code: string) =>
    apiClient.post('/api/auth/sms/verify', { phone, code }),

  /** 发送邮箱验证码 */
  sendEmailCode: (email: string) =>
    apiClient.post('/api/auth/email/send', { email }),

  /** 验证邮箱验证码 */
  verifyEmailCode: (email: string, code: string) =>
    apiClient.post('/api/auth/email/verify', { email, code }),

  /** Google OAuth */
  googleLogin: (idToken: string) =>
    apiClient.post('/api/auth/google', { idToken }),

  /** Apple OAuth */
  appleLogin: (code: string, identityToken: string) =>
    apiClient.post('/api/auth/apple', { code, identityToken }),

  /** 当前用户信息 */
  me: () => apiClient.get('/api/auth/me'),

  /** 刷新 token */
  refresh: () => apiClient.post('/api/auth/refresh'),
};

// ─── Posts ───────────────────────────────────────────────────────────────────

export const postsApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/api/posts', { params }),

  feed: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/api/posts/feed', { params }),

  get: (id: number) => apiClient.get(`/api/posts/${id}`),

  create: (data: { content: string; imageUrls?: string[]; peakId?: number }) =>
    apiClient.post('/api/posts', data),

  like: (id: number) => apiClient.post(`/api/posts/${id}/like`),

  save: (id: number) => apiClient.post(`/api/posts/${id}/save`),
};

// ─── Peaks ───────────────────────────────────────────────────────────────────

export const peaksApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; difficulty?: string }) =>
    apiClient.get('/api/peaks', { params }),

  get: (id: number) => apiClient.get(`/api/peaks/${id}`),

  weather: (id: number) => apiClient.get(`/api/peaks/${id}/weather`),
};

// ─── Guides ──────────────────────────────────────────────────────────────────

export const guidesApi = {
  list: (params?: { page?: number; pageSize?: number; specialty?: string }) =>
    apiClient.get('/api/guides', { params }),

  get: (id: number) => apiClient.get(`/api/guides/${id}`),
};

// ─── Clubs ───────────────────────────────────────────────────────────────────

export const clubsApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/api/clubs', { params }),

  get: (id: number) => apiClient.get(`/api/clubs/${id}`),

  join: (id: number) => apiClient.post(`/api/clubs/${id}/join`),

  leave: (id: number) => apiClient.post(`/api/clubs/${id}/leave`),
};

// ─── Teams ───────────────────────────────────────────────────────────────────

export const teamsApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/api/teams', { params }),

  get: (id: number) => apiClient.get(`/api/teams/${id}`),

  join: (id: number) => apiClient.post(`/api/teams/${id}/join`),
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export const profileApi = {
  get: (userId: number) => apiClient.get(`/api/profile/${userId}`),
  update: (data: Record<string, unknown>) => apiClient.put('/api/profile', data),
  uploadAvatar: (formData: FormData) =>
    apiClient.post('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Config ──────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => apiClient.get('/api/config'),
};

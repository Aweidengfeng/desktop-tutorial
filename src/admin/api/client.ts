import axios from 'axios';

export const apiClient = axios.create({
  baseURL: window.__API_BASE__ || '',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
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

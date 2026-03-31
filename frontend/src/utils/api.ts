/// <reference types="vite/client" />
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Request interceptor automatically attaching token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 & token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and it's not a retry request and NOT a login request
    const isLoginRequest = originalRequest.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // Attempt to refresh token using the configured api instance
          const { data } = await api.post('/auth/refresh', {
            refreshToken,
          });
          
          // Store new token and retry
          localStorage.setItem('accessToken', data.accessToken);
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, user needs to login again
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
      } else {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

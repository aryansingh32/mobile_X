import axios from 'axios';
import { useAppStore } from '../store/useAppStore';
import { Alert } from 'react-native';
import CryptoJS from 'crypto-js';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const API_CLIENT_SECRET = process.env.EXPO_PUBLIC_API_CLIENT_SECRET || 'super_secret_client_key';
const MAX_GET_RETRIES = 2;

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT and Request Signature
apiClient.interceptors.request.use((config) => {
  const token = useAppStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  config.headers['x-api-timestamp'] = timestamp;
  config.headers['x-api-nonce'] = nonce;
  
  const sortObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
  };

  const bodyString = config.data ? JSON.stringify(sortObjectKeys(config.data)) : '';
  const payload = bodyString + timestamp + nonce;
  const signature = CryptoJS.HmacSHA256(payload, API_CLIENT_SECRET).toString(CryptoJS.enc.Hex);
  
  config.headers['x-api-signature'] = signature;

  return config;
});

// Response interceptor — handle 401 and 429
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalConfig = error.config;
    if (error.response?.status === 401) {
      useAppStore.getState().logout();
    } else if (error.response?.status === 429) {
      Alert.alert('Rate Limited', 'Too many requests. Please slow down.');
    } else if (
      !error.response &&
      !axios.isCancel(error) &&
      originalConfig &&
      (originalConfig._retryCount ?? 0) < MAX_GET_RETRIES &&
      originalConfig.method === 'get'
    ) {
      // Retry logic for network failures (only safe for idempotent GET requests).
      // Exponential backoff with jitter so a flaky connection doesn't hammer
      // the server with retries spaced exactly 1s apart.
      const attempt = (originalConfig._retryCount ?? 0) + 1;
      originalConfig._retryCount = attempt;
      const delay = Math.min(500 * 2 ** (attempt - 1), 4000) + Math.random() * 250;
      return new Promise((resolve) => {
        setTimeout(() => resolve(apiClient(originalConfig)), delay);
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;

import axios from 'axios';

declare global {
  interface Window {
    dcm?: {
      api?: { basicAuth?: string };
      config?: { baseUrl?: string };
    };
  }
}

const injectedAuth = window.dcm?.api?.basicAuth;
const injectedBase = window.dcm?.config?.baseUrl;

const AUTH_HEADER = injectedAuth ?? import.meta.env.VITE_API_AUTH_HEADER ?? '';
const BASE_URL =
  (injectedBase ? `${injectedBase}/restapi/v1` : undefined) ??
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:8080/DMS/restapi/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (AUTH_HEADER) {
    config.headers.Authorization = AUTH_HEADER;
  }
  return config;
});

export default apiClient;

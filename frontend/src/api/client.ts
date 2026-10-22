import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 120_000,
});

type AuthHooks = {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<boolean>;
};

const hooks: AuthHooks = {
  getAccessToken: () => null,
  refreshSession: async () => false,
};

/**
 * The auth store registers these hooks so the interceptor can attach the access
 * token and transparently retry once after a token refresh on a 401.
 */
export function registerAuthHooks(h: AuthHooks): void {
  hooks.getAccessToken = h.getAccessToken;
  hooks.refreshSession = h.refreshSession;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = hooks.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshInFlight: Promise<boolean> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as RetryableConfig | undefined;
    const isRefresh = config?.url?.includes('/auth/refresh');
    if (error?.response?.status === 401 && config && !config._retried && !isRefresh) {
      config._retried = true;
      refreshInFlight = refreshInFlight ?? hooks.refreshSession().finally(() => {
        refreshInFlight = null;
      });
      if (await refreshInFlight) {
        return api(config);
      }
    }
    if (error?.response?.status === 429) {
      const message = (error.response?.data as { message?: string } | undefined)?.message
        ?? 'Too many requests. Please wait a moment and try again.';
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    return message ?? err.message ?? 'Request failed';
  }
  return err instanceof Error ? err.message : 'Request failed';
}

/** Fetches a protected file as a blob and returns an object URL for preview. */
export async function fetchFileBlob(url: string): Promise<string> {
  const response = await api.get(url, { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

/** Fetches a protected file and triggers a browser download. */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  const response = await api.get(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export type { AxiosRequestConfig };

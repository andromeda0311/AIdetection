import { defineStore } from 'pinia';
import { api, registerAuthHooks } from '../api/client';
import type { AuthUser } from '../types';
import { authDisabled } from '../utils/preview';

interface LoginResult {
  user: AuthUser;
  accessToken: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    accessToken: null as string | null,
    ready: false,
  }),

  getters: {
    isAuthenticated: (state) => authDisabled || Boolean(state.user && state.accessToken),
    isAdmin: (state) => authDisabled || state.user?.role === 'admin',
    displayName: (state) => {
      if (authDisabled) return 'Local preview';
      if (!state.user) return '';
      const name = `${state.user.firstName ?? ''} ${state.user.lastName ?? ''}`.trim();
      return name || state.user.email;
    },
  },

  actions: {
    async login(email: string, password: string): Promise<void> {
      const response = await api.post<{ data: LoginResult }>('/auth/login', { email, password });
      this.user = response.data.data.user;
      this.accessToken = response.data.data.accessToken;
      this.ready = true;
    },

    async refresh(): Promise<boolean> {
      if (authDisabled) {
        this.ready = true;
        return false;
      }
      try {
        const response = await api.post<{ data: LoginResult }>('/auth/refresh');
        this.user = response.data.data.user;
        this.accessToken = response.data.data.accessToken;
        this.ready = true;
        return true;
      } catch {
        this.reset();
        return false;
      }
    },

    async logout(): Promise<void> {
      if (authDisabled) {
        this.reset();
        return;
      }
      try {
        await api.post('/auth/logout');
      } catch {
        // Server may be unreachable or rate-limited — always clear local session.
      } finally {
        this.reset();
      }
    },

    reset(): void {
      this.user = null;
      this.accessToken = null;
      this.ready = true;
    },
  },
});

registerAuthHooks({
  getAccessToken: () => useAuthStore().accessToken,
  refreshSession: () => useAuthStore().refresh(),
});

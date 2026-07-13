import { apiGet, apiPost } from './client.ts';

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}

export const authApi = {
  status(): Promise<AuthStatus> {
    return apiGet<AuthStatus>('/api/auth/status');
  },

  me(): Promise<{ user: AuthUser | null; authEnabled: boolean }> {
    return apiGet('/api/auth/me');
  },

  register(username: string, password: string): Promise<{ user: AuthUser }> {
    return apiPost('/api/auth/register', { username, password });
  },

  login(username: string, password: string): Promise<{ user: AuthUser }> {
    return apiPost('/api/auth/login', { username, password });
  },

  logout(): Promise<{ success: boolean }> {
    return apiPost('/api/auth/logout');
  },
};

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthUser } from '../api/auth.ts';
import { getApiErrorMessage } from '../api/client.ts';

interface AuthContextValue {
  loading: boolean;
  authEnabled: boolean;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await authApi.status();
      setAuthEnabled(status.enabled);
      setUser(status.user);
    } catch (error) {
      console.error('Failed to load auth status', error);
      setAuthEnabled(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    setUser(result.user);
    setAuthEnabled(true);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const result = await authApi.register(username, password);
    setUser(result.user);
    setAuthEnabled(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error(getApiErrorMessage(error, 'Logout failed'));
    }
    setUser(null);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ loading, authEnabled, user, refresh, login, register, logout }),
    [loading, authEnabled, user, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

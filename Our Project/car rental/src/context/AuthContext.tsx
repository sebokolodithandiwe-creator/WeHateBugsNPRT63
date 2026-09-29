import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, ApiError, getToken } from '../api/client';
import type { CurrentUser, UserRole } from '../types';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string, expectedRole?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  recordActivity: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());

  function recordActivity() {
    if (user) {
      lastActivityRef.current = Date.now();
    }
  }

  async function refreshUser() {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const me = await api.me();
      setUser(me);
      lastActivityRef.current = Date.now();
    } catch {
      await api.logout();
      setUser(null);
    }
  }

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  // The Phase 4 requirement is an inactivity timeout, not simply a short JWT.
  // We therefore track user activity in the app and end the local session
  // after 15 minutes without interaction.
  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();

    const interval = setInterval(async () => {
      const inactiveFor = Date.now() - lastActivityRef.current;

      if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
        await api.logout();
        setUser(null);
      }
    }, 15_000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const inactiveFor = Date.now() - lastActivityRef.current;
        if (user && inactiveFor >= INACTIVITY_TIMEOUT_MS) {
          api.logout().then(() => setUser(null));
        } else if (user) {
          lastActivityRef.current = Date.now();
        }
      }
    });

    return () => subscription.remove();
  }, [user]);

  async function login(username: string, password: string, expectedRole?: UserRole) {
    const result = await api.login(username, password);

    if (expectedRole && result.role !== expectedRole) {
      await api.logout();
      throw new ApiError(
        `This account is registered as ${result.role}. Please select ${result.role} when signing in.`,
        403
      );
    }

    await refreshUser();
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, recordActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

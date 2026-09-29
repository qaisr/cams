'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface AuthUser {
  sub: string;
  lanId: string;
  name: string;
  email: string;
  groups: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): { exp: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload)) as { exp: number };
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = parseToken(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const logoutRef = useRef<() => void>(() => {});

  const logout = useCallback(() => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('authUser');
    queryClient.clear();
    setUser(null);
    setAccessToken(null);
  }, [queryClient]);

  logoutRef.current = logout;

  useEffect(() => {
    const storedToken = sessionStorage.getItem('accessToken');
    const storedUser = sessionStorage.getItem('authUser');

    if (storedToken && storedUser && isTokenValid(storedToken)) {
      setAccessToken(storedToken);
      setUser(JSON.parse(storedUser) as AuthUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((token: string, newUser: AuthUser) => {
    sessionStorage.setItem('accessToken', token);
    sessionStorage.setItem('authUser', JSON.stringify(newUser));
    setAccessToken(token);
    setUser(newUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      isLoading,
      login,
      logout,
    }),
    [user, accessToken, isLoading, login, logout],
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

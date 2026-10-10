import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, getToken, setToken } from "./api";
import type { Account, Profile, SessionResult } from "./types";

interface AuthValue {
  ready: boolean;
  account: Account | null;
  profile: Profile | null;
  login: (email: string, password: string) => Promise<Account>;
  register: (payload: Record<string, unknown>) => Promise<SessionResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!getToken());
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      if (!mounted.current) return;
      setAccount(null);
      setProfileState(null);
    };
    window.addEventListener("pj:unauthorized", onUnauthorized);
    return () => window.removeEventListener("pj:unauthorized", onUnauthorized);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setAccount(null);
      setProfileState(null);
      setReady(true);
      return;
    }
    try {
      const data = await api<{ account: Account; profile: Profile | null }>("auth.me");
      if (!mounted.current) return;
      setAccount(data.account);
      setProfileState(data.profile);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setToken(null);
        setAccount(null);
        setProfileState(null);
      }
    } finally {
      if (mounted.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<SessionResult>("auth.login", { email, password });
    setToken(data.token);
    setAccount(data.account);
    setProfileState(data.profile);
    return data.account;
  }, []);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const data = await api<SessionResult>("auth.register", payload);
    setToken(data.token);
    setAccount(data.account);
    setProfileState(data.profile);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("auth.logout");
    } catch {
      // The local session is cleared regardless of the server response.
    }
    setToken(null);
    setAccount(null);
    setProfileState(null);
  }, []);

  const setProfile = useCallback((next: Profile | null) => {
    setProfileState(next);
  }, []);

  const value = useMemo(
    () => ({ ready, account, profile, login, register, logout, refresh, setProfile }),
    [ready, account, profile, login, register, logout, refresh, setProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

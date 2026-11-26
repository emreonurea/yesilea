import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, loadToken, setToken, setUnauthorizedHandler, type Me } from "./api";

interface AuthState {
  ready: boolean;
  signedIn: boolean;
  me: Me | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    try { await api.logout(); } catch { /* oturum zaten düşmüş olabilir */ }
    await setToken(null);
    setMe(null);
    setSignedIn(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch {
      /* ağ hatasında mevcut bilgiyle devam */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setMe(null);
      setSignedIn(false);
    });
    (async () => {
      const t = await loadToken();
      if (t) {
        setSignedIn(true);
        await refresh();
      }
      setReady(true);
    })();
  }, [refresh]);

  const signIn = useCallback(async (t: string) => {
    await setToken(t);
    setSignedIn(true);
    setMe(await api.me());
  }, []);

  return <Ctx.Provider value={{ ready, signedIn, me, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider eksik");
  return v;
}

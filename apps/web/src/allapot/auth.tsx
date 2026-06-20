import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, aktualisEmailLeker, aktualisEmailBeallit, aktualisTokenBeallit } from '../api/kliens';
import { OIDC_MOD, oidcManager, type User } from './oidc';
import type { Felhasznalo } from '../api/tipusok';

/** Dev-felhasználók a váltóhoz (a seedből; OIDC módban nem látszik). */
export const DEV_FELHASZNALOK = [
  { email: 'kiss.anna@pelda.hu', nev: 'Kiss Anna (Szerző @ 3R)' },
  { email: 'varga.dora@pelda.hu', nev: 'Varga Dóra (Szerző @ Terminus)' },
  { email: 'nagy.peter@pelda.hu', nev: 'Nagy Péter (globális Admin)' },
];

interface AuthCtx {
  felhasznalo: Felhasznalo | null;
  betolt: boolean;
  /** OIDC mód aktív-e (a felület ehhez igazítja a belépést). */
  oidc: boolean;
  /** Dev mód: felhasználóváltás e-maillel. */
  emailBeallit: (email: string | null) => void;
  /** OIDC mód: átirányítás a bejelentkezéshez / kijelentkezés. */
  login: () => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  return OIDC_MOD ? <OidcAuth>{children}</OidcAuth> : <DevAuth>{children}</DevAuth>;
}

/** Fejléc-alapú dev hitelesítés (a seed-felhasználók közti váltással). */
function DevAuth({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState<string | null>(aktualisEmailLeker());

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'en', email],
    queryFn: () => api.get<Felhasznalo>('/api/auth/en'),
    enabled: !!email,
    retry: false,
  });

  const emailBeallit = (uj: string | null) => {
    aktualisEmailBeallit(uj);
    setEmail(uj);
    void qc.invalidateQueries();
  };

  return (
    <Ctx.Provider
      value={{
        felhasznalo: data ?? null,
        betolt: isLoading,
        oidc: false,
        emailBeallit,
        login: () => {},
        logout: () => emailBeallit(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** A redirect-callback feldolgozása csak egyszer fusson (StrictMode dupla-effekt ellen). */
let callbackFut = false;

/** Valódi OIDC/SSO (Authorization Code + PKCE); a token Bearer-ként megy az API-nak. */
function OidcAuth({ children }: { children: ReactNode }) {
  const [kesz, setKesz] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const mgr = oidcManager();
    const allit = (u: User | null) => {
      const t = u && !u.expired ? u.access_token : null;
      aktualisTokenBeallit(t);
      setToken(t);
    };

    void (async () => {
      try {
        if (window.location.pathname === '/auth/callback') {
          if (callbackFut) return;
          callbackFut = true;
          await mgr.signinRedirectCallback();
          // Tiszta újratöltés a gyökérre — a tárolt session-t a getUser felveszi.
          window.location.replace('/');
          return;
        }
        allit(await mgr.getUser());
      } catch {
        allit(null);
      }
      setKesz(true);
    })();

    const onLoaded = (u: User) => allit(u);
    const onUnloaded = () => allit(null);
    mgr.events.addUserLoaded(onLoaded);
    mgr.events.addUserUnloaded(onUnloaded);
    return () => {
      mgr.events.removeUserLoaded(onLoaded);
      mgr.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'en', token],
    queryFn: () => api.get<Felhasznalo>('/api/auth/en'),
    enabled: !!token,
    retry: false,
  });

  return (
    <Ctx.Provider
      value={{
        felhasznalo: token ? (data ?? null) : null,
        betolt: !kesz || (!!token && isLoading),
        oidc: true,
        emailBeallit: () => {},
        login: () => void oidcManager().signinRedirect(),
        logout: () => {
          aktualisTokenBeallit(null);
          void oidcManager().signoutRedirect();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth az AuthProvider-en kívül');
  return c;
}

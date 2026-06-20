import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

/** OIDC mód aktív-e (a dev-felhasználóváltó helyett valódi login). Build-idős konstans. */
export const OIDC_MOD = import.meta.env.VITE_AUTH_MODE === 'oidc';

let manager: UserManager | null = null;

/** A UserManager singleton (Authorization Code + PKCE, configból). */
export function oidcManager(): UserManager {
  if (!manager) {
    manager = new UserManager({
      authority: import.meta.env.VITE_OIDC_AUTHORITY as string,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID as string,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: `${window.location.origin}/`,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    });
  }
  return manager;
}

export type { User };

const TOKEN_KEY = 'langactif.eleve.jeton';

type Fetch = typeof fetch;

export type LoginResult =
  | { ok: true; token: string; pseudo: string; langue: string }
  | { ok: false; reason: 'invalide' | 'bloque' | 'trop_de_tentatives' | 'reseau'; retryAfterSeconds?: number };

export type MeResult = { status: 'ok'; pseudo: string; langue: string } | { status: 'expire' } | { status: 'reseau' };

export interface LoginInput {
  groupe: string;
  pseudo: string;
  code: string;
  appareilPartage: boolean;
}

export async function fetchPseudos(groupCode: string, f: Fetch = fetch): Promise<string[] | null> {
  try {
    const r = await f(`/api/student-list-pseudos?g=${encodeURIComponent(groupCode)}`);
    if (!r.ok) return null;
    const d = (await r.json()) as { pseudos?: string[] };
    return d.pseudos ?? null;
  } catch {
    return null;
  }
}

export async function loginStudent(input: LoginInput, f: Fetch = fetch): Promise<LoginResult> {
  try {
    const r = await f('/api/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const d = (await r.json()) as { ok?: boolean; token?: string; pseudo?: string; langue?: string; retry_after_seconds?: number };
    if (r.ok && d.ok && d.token) return { ok: true, token: d.token, pseudo: d.pseudo ?? '', langue: d.langue ?? '' };
    if (r.status === 423) return { ok: false, reason: 'bloque', retryAfterSeconds: d.retry_after_seconds };
    if (r.status === 429) return { ok: false, reason: 'trop_de_tentatives' };
    if (r.status >= 500) return { ok: false, reason: 'reseau' };
    return { ok: false, reason: 'invalide' };
  } catch {
    return { ok: false, reason: 'reseau' };
  }
}

export async function fetchMe(token: string, f: Fetch = fetch): Promise<MeResult> {
  try {
    const r = await f('/api/student-me', { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) return { status: 'expire' };
    if (!r.ok) return { status: 'reseau' };
    const d = (await r.json()) as { pseudo: string; langue: string };
    return { status: 'ok', pseudo: d.pseudo, langue: d.langue };
  } catch {
    return { status: 'reseau' };
  }
}

/** Révocation au mieux : la déconnexion locale ne dépend pas de la réponse. */
export async function logoutStudent(token: string, f: Fetch = fetch): Promise<void> {
  try {
    await f('/api/student-logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* hors ligne : le jeton expirera ou sera révoqué à la prochaine occasion */
  }
}

export interface Stores {
  local: Storage | null;
  session: Storage | null;
}

export function defaultStores(): Stores {
  const get = (name: 'localStorage' | 'sessionStorage'): Storage | null => {
    try {
      return window[name];
    } catch {
      return null; // navigation privée ou stockage bloqué
    }
  };
  return { local: get('localStorage'), session: get('sessionStorage') };
}

export function clearToken(stores: Stores = defaultStores()): void {
  for (const s of [stores.local, stores.session]) {
    try {
      s?.removeItem(TOKEN_KEY);
    } catch {
      /* ignoré */
    }
  }
}

/** Appareil partagé : sessionStorage (disparaît à la fermeture de l'onglet). Sinon localStorage. */
export function saveToken(token: string, shared: boolean, stores: Stores = defaultStores()): void {
  clearToken(stores);
  try {
    (shared ? stores.session : stores.local)?.setItem(TOKEN_KEY, token);
  } catch {
    /* sans stockage, l'élève devra se reconnecter à chaque visite */
  }
}

export function loadToken(stores: Stores = defaultStores()): string | null {
  try {
    return stores.session?.getItem(TOKEN_KEY) ?? stores.local?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

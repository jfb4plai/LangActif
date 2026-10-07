import { describe, expect, it } from 'vitest';
import {
  clearToken,
  fetchMe,
  fetchPseudos,
  loadToken,
  loginStudent,
  logoutStudent,
  saveToken,
  type Stores,
} from './studentApi';

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const fakeStore = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
};
const stores = (): Stores => ({ local: fakeStore(), session: fakeStore() });

const input = { groupe: 'K7M4X', pseudo: 'Meuse', code: 'K472', appareilPartage: false };

describe('loginStudent', () => {
  it('succès : renvoie le jeton', async () => {
    const f = async () => jsonResponse(200, { ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    expect(await loginStudent(input, f)).toEqual({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
  });
  it('401 : invalide', async () => {
    const f = async () => jsonResponse(401, { ok: false, reason: 'invalide' });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'invalide' });
  });
  it('423 : bloqué avec délai', async () => {
    const f = async () => jsonResponse(423, { ok: false, reason: 'bloque', retry_after_seconds: 600 });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'bloque', retryAfterSeconds: 600 });
  });
  it('429 : trop de tentatives', async () => {
    const f = async () => jsonResponse(429, { ok: false, reason: 'trop_de_tentatives' });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'trop_de_tentatives' });
  });
  it('500 et réseau coupé : reseau', async () => {
    expect(await loginStudent(input, async () => jsonResponse(500, {}))).toEqual({ ok: false, reason: 'reseau' });
    expect(await loginStudent(input, async () => { throw new Error('offline'); })).toEqual({ ok: false, reason: 'reseau' });
  });
  it('envoie une requête POST JSON', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const f = async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), init };
      return jsonResponse(401, { ok: false, reason: 'invalide' });
    };
    await loginStudent(input, f as typeof fetch);
    expect(seen!.url).toBe('/api/student-login');
    expect(seen!.init?.method).toBe('POST');
    expect(JSON.parse(String(seen!.init?.body))).toEqual(input);
  });
});

describe('fetchPseudos', () => {
  it('renvoie la liste', async () => {
    expect(await fetchPseudos('K7M4X', async () => jsonResponse(200, { pseudos: ['Meuse', 'Orion'] }))).toEqual(['Meuse', 'Orion']);
  });
  it('null si groupe inconnu ou réseau coupé', async () => {
    expect(await fetchPseudos('ZZZZZ', async () => jsonResponse(404, { error: 'x' }))).toBeNull();
    expect(await fetchPseudos('ZZZZZ', async () => { throw new Error('offline'); })).toBeNull();
  });
});

describe('fetchMe', () => {
  it('ok', async () => {
    expect(await fetchMe('t', async () => jsonResponse(200, { pseudo: 'Meuse', langue: 'nl-BE' }))).toEqual({
      status: 'ok', pseudo: 'Meuse', langue: 'nl-BE',
    });
  });
  it('401 : session expirée', async () => {
    expect(await fetchMe('t', async () => jsonResponse(401, { error: 'x' }))).toEqual({ status: 'expire' });
  });
  it('réseau coupé : on ne déconnecte pas l\'élève', async () => {
    expect(await fetchMe('t', async () => { throw new Error('offline'); })).toEqual({ status: 'reseau' });
  });
});

describe('logoutStudent', () => {
  it('ne lève jamais d\'erreur', async () => {
    await expect(logoutStudent('t', async () => { throw new Error('offline'); })).resolves.toBeUndefined();
  });
});

describe('stockage du jeton', () => {
  it('session personnelle : localStorage', () => {
    const s = stores();
    saveToken('abc', false, s);
    expect(loadToken(s)).toBe('abc');
    expect(s.local!.getItem('langactif.eleve.jeton')).toBe('abc');
    expect(s.session!.getItem('langactif.eleve.jeton')).toBeNull();
  });
  it('appareil partagé : sessionStorage seulement', () => {
    const s = stores();
    saveToken('abc', true, s);
    expect(s.session!.getItem('langactif.eleve.jeton')).toBe('abc');
    expect(s.local!.getItem('langactif.eleve.jeton')).toBeNull();
  });
  it('un nouveau jeton remplace l\'ancien des deux côtés', () => {
    const s = stores();
    saveToken('ancien', false, s);
    saveToken('nouveau', true, s);
    expect(s.local!.getItem('langactif.eleve.jeton')).toBeNull();
    expect(loadToken(s)).toBe('nouveau');
  });
  it('clearToken efface tout', () => {
    const s = stores();
    saveToken('abc', false, s);
    clearToken(s);
    expect(loadToken(s)).toBeNull();
  });
  it('fonctionne sans stockage disponible', () => {
    const none: Stores = { local: null, session: null };
    expect(() => saveToken('abc', false, none)).not.toThrow();
    expect(loadToken(none)).toBeNull();
  });
});

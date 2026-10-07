import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/student-login';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

let ipCounter = 0;
const nextIp = () => `10.0.0.${++ipCounter}`;

const call = async (body: unknown, ip = nextIp(), method = 'POST') => {
  const res = fakeRes();
  await handler(fakeReq({ method, headers: { 'x-forwarded-for': ip }, body }) as never, res as never);
  return res;
};
const good = { groupe: 'k7m4x', pseudo: 'Meuse', code: 'k472', appareilPartage: true };

describe('student-login', () => {
  it('succès : 200 avec le jeton, entrées normalisées', async () => {
    const fetchMock = stubSupabase({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    const res = await call(good);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_student_login');
    expect(JSON.parse(String(init.body))).toEqual({ p_group_code: 'K7M4X', p_pseudo: 'Meuse', p_code: 'K472', p_shared: true });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-key-test');
  });
  it('401 pour un code incorrect, sans détail', async () => {
    stubSupabase({ ok: false, reason: 'invalide' });
    const res = await call(good);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, reason: 'invalide' });
  });
  it('423 avec le délai restant pour un pseudo bloqué', async () => {
    stubSupabase({ ok: false, reason: 'bloque', retry_after_seconds: 600 });
    const res = await call(good);
    expect(res.statusCode).toBe(423);
    expect(res.body).toEqual({ ok: false, reason: 'bloque', retry_after_seconds: 600 });
  });
  it('400 si un champ manque ou est trop long, sans appeler la base', async () => {
    const fetchMock = stubSupabase({});
    expect((await call({ ...good, pseudo: '' })).statusCode).toBe(400);
    expect((await call({ ...good, code: 'A'.repeat(11) })).statusCode).toBe(400);
    expect((await call(undefined)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors POST', async () => {
    expect((await call(good, nextIp(), 'GET')).statusCode).toBe(405);
  });
  it('502 si la base répond en erreur', async () => {
    stubSupabase({}, false);
    expect((await call(good)).statusCode).toBe(502);
  });
  it('429 au-delà de 30 tentatives par IP', async () => {
    stubSupabase({ ok: false, reason: 'invalide' });
    const ip = nextIp();
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await call(good, ip)).statusCode;
    expect(last).toBe(429);
  });
});

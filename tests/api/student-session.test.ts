import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logout from '../../api/student-logout';
import me from '../../api/student-me';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'a'.repeat(64);
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

const run = async (h: typeof me, req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await h(req as never, res as never);
  return res;
};

describe('student-me', () => {
  it('200 avec le pseudo si le jeton est valide', async () => {
    const fetchMock = stubSupabase({ pseudo: 'Meuse', langue: 'nl-BE' });
    const res = await run(me, fakeReq({ headers: bearer(TOKEN) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ pseudo: 'Meuse', langue: 'nl-BE' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ p_token: TOKEN });
  });
  it('401 si la base répond null (jeton inconnu, expiré ou révoqué)', async () => {
    stubSupabase(null);
    expect((await run(me, fakeReq({ headers: bearer(TOKEN) }))).statusCode).toBe(401);
  });
  it('401 sans appeler la base si le jeton est absent ou mal formé', async () => {
    const fetchMock = stubSupabase({});
    expect((await run(me, fakeReq({}))).statusCode).toBe(401);
    expect((await run(me, fakeReq({ headers: bearer('court') }))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors GET', async () => {
    expect((await run(me, fakeReq({ method: 'POST', headers: bearer(TOKEN) }))).statusCode).toBe(405);
  });
});

describe('student-logout', () => {
  it('200 et appel de la révocation', async () => {
    const fetchMock = stubSupabase(null);
    const res = await run(logout, fakeReq({ method: 'POST', headers: bearer(TOKEN) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_student_logout');
  });
  it('200 même sans jeton valide (rien à révoquer), sans appeler la base', async () => {
    const fetchMock = stubSupabase(null);
    const res = await run(logout, fakeReq({ method: 'POST', headers: bearer('court') }));
    expect(res.statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors POST', async () => {
    expect((await run(logout, fakeReq({ method: 'GET', headers: bearer(TOKEN) }))).statusCode).toBe(405);
  });
});

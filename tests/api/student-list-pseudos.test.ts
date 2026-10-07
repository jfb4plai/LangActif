import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/student-list-pseudos';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const call = async (req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await handler(req as never, res as never);
  return res;
};

describe('student-list-pseudos', () => {
  it('renvoie les pseudos du groupe', async () => {
    const fetchMock = stubSupabase(['Meuse', 'Orion']);
    const res = await call(fakeReq({ query: { g: 'k7m4x' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ pseudos: ['Meuse', 'Orion'] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_group_pseudos');
    expect(JSON.parse(String(init.body))).toEqual({ p_group_code: 'K7M4X' });
  });
  it('404 si le groupe est inconnu (liste vide)', async () => {
    stubSupabase([]);
    expect((await call(fakeReq({ query: { g: 'ZZZZZ' } }))).statusCode).toBe(404);
  });
  it('400 si le code est absent ou invalide, sans appeler la base', async () => {
    const fetchMock = stubSupabase([]);
    expect((await call(fakeReq({ query: {} }))).statusCode).toBe(400);
    expect((await call(fakeReq({ query: { g: '<script>' } }))).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors GET', async () => {
    expect((await call(fakeReq({ method: 'POST', query: { g: 'K7M4X' } }))).statusCode).toBe(405);
  });
});

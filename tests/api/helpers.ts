import { vi } from 'vitest';

export interface FakeRes {
  statusCode: number;
  body: unknown;
  status(code: number): FakeRes;
  json(body: unknown): FakeRes;
}

export function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

export function fakeReq(init: {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}) {
  return { method: init.method ?? 'GET', headers: init.headers ?? {}, query: init.query ?? {}, body: init.body };
}

export function setEnv() {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-test';
}

/** Simule la réponse PostgREST (appel RPC). */
export function stubSupabase(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => payload }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

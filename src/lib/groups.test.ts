import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  addSeats,
  archiveGroup,
  archiveSeat,
  createGroup,
  deleteGroup,
  deleteSeat,
  getGroup,
  listGroups,
  regenerateCodes,
  resetSeatCode,
  seatState,
  unlockSeat,
  type SeatRow,
} from './groups';

const asClient = (fake: unknown) => fake as SupabaseClient;

function rpcClient(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = asClient({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data, error };
    },
  });
  return { client, calls };
}

const seat = (over: Partial<SeatRow> = {}): SeatRow => ({
  id: 's1', group_id: 'g1', pseudo: 'Meuse', failed_attempts: 0, locked_until: null,
  last_seen_at: null, archived_at: null, created_at: '2026-10-07T08:00:00Z', ...over,
});

describe('seatState', () => {
  const now = new Date('2026-10-07T10:00:00Z');
  it('archivée prime sur tout', () => {
    expect(seatState(seat({ archived_at: '2026-10-01', locked_until: '2026-10-08T00:00:00Z' }), now)).toBe('archive');
  });
  it('bloquée tant que locked_until est dans le futur', () => {
    expect(seatState(seat({ locked_until: '2026-10-07T10:10:00Z' }), now)).toBe('bloque');
  });
  it('blocage expiré : on retombe sur jamais ou actif', () => {
    expect(seatState(seat({ locked_until: '2026-10-07T09:00:00Z' }), now)).toBe('jamais');
    expect(seatState(seat({ locked_until: '2026-10-07T09:00:00Z', last_seen_at: '2026-10-06' }), now)).toBe('actif');
  });
  it('jamais connecté', () => {
    expect(seatState(seat(), now)).toBe('jamais');
  });
});

describe('listGroups', () => {
  it('compte seulement les places non archivées', async () => {
    const rows = [
      { id: 'g1', nom: 'Rem NL', langue: 'nl-BE', code: 'K7M4X', archived_at: null, created_at: 'x',
        lang_students: [{ id: 'a', archived_at: null }, { id: 'b', archived_at: '2026-10-01' }, { id: 'c', archived_at: null }] },
    ];
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }) });
    const out = await listGroups(client);
    expect(out[0].seatsCount).toBe(2);
    expect(out[0]).not.toHaveProperty('lang_students');
  });
  it('lève une erreur lisible', async () => {
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) });
    await expect(listGroups(client)).rejects.toThrow('permission denied');
  });
});

describe('getGroup', () => {
  it('trie les places par pseudo', async () => {
    const row = { id: 'g1', nom: 'n', langue: 'nl-BE', code: 'K7M4X', archived_at: null, created_at: 'x',
      lang_students: [seat({ id: '2', pseudo: 'Orion' }), seat({ id: '1', pseudo: 'Érable' }), seat({ id: '3', pseudo: 'Meuse' })] };
    const client = asClient({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }) });
    const g = await getGroup(client, 'g1');
    expect(g.seats.map((s) => s.pseudo)).toEqual(['Érable', 'Meuse', 'Orion']);
  });
});

describe('appels RPC', () => {
  it('createGroup', async () => {
    const { client, calls } = rpcClient({ group_id: 'g', code: 'K7M4X', seats: [{ id: '1', pseudo: 'Meuse', code: 'K472' }] });
    const out = await createGroup(client, { nom: 'Rem NL', langue: 'nl-BE', places: 8 });
    expect(calls[0]).toEqual({ name: 'lang_group_create', args: { p_nom: 'Rem NL', p_langue: 'nl-BE', p_places: 8 } });
    expect(out.code).toBe('K7M4X');
  });
  it('addSeats, regenerateCodes, resetSeatCode', async () => {
    const a = rpcClient([{ id: '1', pseudo: 'Meuse', code: 'K472' }]);
    expect(await addSeats(a.client, 'g1', 2)).toHaveLength(1);
    expect(a.calls[0]).toEqual({ name: 'lang_group_add_seats', args: { p_group: 'g1', p_count: 2 } });
    const b = rpcClient([{ id: '1', pseudo: 'Meuse', code: 'K472' }]);
    await regenerateCodes(b.client, 'g1');
    expect(b.calls[0]).toEqual({ name: 'lang_group_regenerate_codes', args: { p_group: 'g1' } });
    const c = rpcClient({ pseudo: 'Meuse', code: 'M829' });
    expect(await resetSeatCode(c.client, 's1')).toEqual({ pseudo: 'Meuse', code: 'M829' });
    expect(c.calls[0]).toEqual({ name: 'lang_seat_reset_code', args: { p_seat: 's1' } });
  });
  it('unlockSeat, archiveSeat, archiveGroup', async () => {
    const { client, calls } = rpcClient(null);
    await unlockSeat(client, 's1');
    await archiveSeat(client, 's1');
    await archiveGroup(client, 'g1');
    expect(calls.map((c) => c.name)).toEqual(['lang_seat_unlock', 'lang_seat_archive', 'lang_group_archive']);
  });
  it("traduit l'erreur de la base", async () => {
    const { client } = rpcClient(null, { message: 'Failed to fetch' });
    await expect(unlockSeat(client, 's1')).rejects.toThrow('Connexion impossible');
  });
});

describe('suppressions directes', () => {
  const deleting = (error: { message: string } | null) => {
    const seen: Array<[string, string]> = [];
    const client = asClient({
      from: (table: string) => ({ delete: () => ({ eq: async (_c: string, v: string) => { seen.push([table, v]); return { error }; } }) }),
    });
    return { client, seen };
  };
  it('deleteSeat et deleteGroup', async () => {
    const { client, seen } = deleting(null);
    await deleteSeat(client, 's1');
    await deleteGroup(client, 'g1');
    expect(seen).toEqual([['lang_students', 's1'], ['lang_groups', 'g1']]);
  });
  it('lève une erreur lisible', async () => {
    await expect(deleteGroup(deleting({ message: 'permission denied' }).client, 'g1')).rejects.toThrow('permission denied');
  });
});

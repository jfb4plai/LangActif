import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { friendlyError } from './errors';

export interface GroupSummary {
  id: string;
  nom: string;
  langue: Langue;
  code: string;
  archived_at: string | null;
  created_at: string;
  seatsCount: number;
}

export interface SeatRow {
  id: string;
  group_id: string;
  pseudo: string;
  failed_attempts: number;
  locked_until: string | null;
  last_seen_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface GroupDetail {
  id: string;
  nom: string;
  langue: Langue;
  code: string;
  archived_at: string | null;
  created_at: string;
  seats: SeatRow[];
}

/** Une place dont le code en clair vient d'être généré (affiché une seule fois). */
export interface IssuedSeat {
  id: string;
  pseudo: string;
  code: string;
}

export interface CreatedGroup {
  group_id: string;
  code: string;
  seats: IssuedSeat[];
}

export type SeatState = 'archive' | 'bloque' | 'jamais' | 'actif';

export function seatState(seat: SeatRow, now: Date = new Date()): SeatState {
  if (seat.archived_at) return 'archive';
  if (seat.locked_until && new Date(seat.locked_until) > now) return 'bloque';
  if (!seat.last_seen_at) return 'jamais';
  return 'actif';
}

type SummaryRow = Omit<GroupSummary, 'seatsCount'> & { lang_students: Array<{ id: string; archived_at: string | null }> };
type DetailRow = Omit<GroupDetail, 'seats'> & { lang_students: SeatRow[] };

export async function listGroups(client: SupabaseClient): Promise<GroupSummary[]> {
  const { data, error } = await client
    .from('lang_groups')
    .select('id, nom, langue, code, archived_at, created_at, lang_students(id, archived_at)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyError(error.message));
  return ((data ?? []) as unknown as SummaryRow[]).map(({ lang_students, ...rest }) => ({
    ...rest,
    seatsCount: lang_students.filter((s) => !s.archived_at).length,
  }));
}

export async function getGroup(client: SupabaseClient, id: string): Promise<GroupDetail> {
  const { data, error } = await client
    .from('lang_groups')
    .select(
      'id, nom, langue, code, archived_at, created_at, ' +
        'lang_students(id, group_id, pseudo, failed_attempts, locked_until, last_seen_at, archived_at, created_at)',
    )
    .eq('id', id)
    .single();
  if (error) throw new Error(friendlyError(error.message));
  const { lang_students, ...rest } = data as unknown as DetailRow;
  return { ...rest, seats: [...lang_students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')) };
}

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

export function createGroup(client: SupabaseClient, input: { nom: string; langue: Langue; places: number }): Promise<CreatedGroup> {
  return rpc<CreatedGroup>(client, 'lang_group_create', { p_nom: input.nom, p_langue: input.langue, p_places: input.places });
}

export function addSeats(client: SupabaseClient, groupId: string, count: number): Promise<IssuedSeat[]> {
  return rpc<IssuedSeat[]>(client, 'lang_group_add_seats', { p_group: groupId, p_count: count });
}

export function regenerateCodes(client: SupabaseClient, groupId: string): Promise<IssuedSeat[]> {
  return rpc<IssuedSeat[]>(client, 'lang_group_regenerate_codes', { p_group: groupId });
}

export function resetSeatCode(client: SupabaseClient, seatId: string): Promise<{ pseudo: string; code: string }> {
  return rpc<{ pseudo: string; code: string }>(client, 'lang_seat_reset_code', { p_seat: seatId });
}

export async function unlockSeat(client: SupabaseClient, seatId: string): Promise<void> {
  await rpc<null>(client, 'lang_seat_unlock', { p_seat: seatId });
}

export async function archiveSeat(client: SupabaseClient, seatId: string): Promise<void> {
  await rpc<null>(client, 'lang_seat_archive', { p_seat: seatId });
}

export async function archiveGroup(client: SupabaseClient, groupId: string): Promise<void> {
  await rpc<null>(client, 'lang_group_archive', { p_group: groupId });
}

/** Suppression définitive : la cascade efface places et sessions (droit à l'effacement). */
export async function deleteSeat(client: SupabaseClient, seatId: string): Promise<void> {
  const { error } = await client.from('lang_students').delete().eq('id', seatId);
  if (error) throw new Error(friendlyError(error.message));
}

export async function deleteGroup(client: SupabaseClient, groupId: string): Promise<void> {
  const { error } = await client.from('lang_groups').delete().eq('id', groupId);
  if (error) throw new Error(friendlyError(error.message));
}

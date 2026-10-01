import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { deleteChapter, getChapter, importChapter, listChapters, sortChapterDetail, type ChapterDetail } from './chapters';
import type { ImportPayload } from './importPayload';

const asClient = (fake: unknown) => fake as SupabaseClient;

describe('listChapters', () => {
  it('renvoie le nombre de listes de chaque chapitre', async () => {
    const rows = [
      { id: 'c1', langue: 'nl-BE', niveau: 'A1', titre: 'Le vélo', numero: '4', created_at: '2026-10-01', lang_lists: [{ count: 3 }] },
      { id: 'c2', langue: 'en-GB', niveau: 'A2', titre: 'Town', numero: '1', created_at: '2026-09-30', lang_lists: [] },
    ];
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }) });
    const out = await listChapters(client);
    expect(out.map((c) => [c.id, c.listsCount])).toEqual([['c1', 3], ['c2', 0]]);
  });

  it('lève une erreur lisible', async () => {
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) });
    await expect(listChapters(client)).rejects.toThrow('permission denied');
  });
});

describe('sortChapterDetail', () => {
  it('trie les listes et les mots par position', () => {
    const raw: ChapterDetail = {
      id: 'c', langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, created_at: 'x',
      lists: [
        { id: 'l2', nom: 'B', position: 1, words: [] },
        {
          id: 'l1', nom: 'A', position: 0,
          words: [
            { id: 'w2', position: 1, fr: 'b', cible: 'b', article: null, synonymes_fr: [], synonymes_cible: [], phrase_cible: null, phrase_fr: null, audio_url: null },
            { id: 'w1', position: 0, fr: 'a', cible: 'a', article: null, synonymes_fr: [], synonymes_cible: [], phrase_cible: null, phrase_fr: null, audio_url: null },
          ],
        },
      ],
    };
    const sorted = sortChapterDetail(raw);
    expect(sorted.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(sorted.lists[0].words.map((w) => w.id)).toEqual(['w1', 'w2']);
  });
});

describe('getChapter', () => {
  it('renvoie le chapitre trié', async () => {
    const row = { id: 'c', langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, created_at: 'x',
      lang_lists: [{ id: 'l2', nom: 'B', position: 1, lang_words: [] }, { id: 'l1', nom: 'A', position: 0, lang_words: [] }] };
    const client = asClient({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }) });
    const out = await getChapter(client, 'c');
    expect(out.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

describe('importChapter', () => {
  const payload: ImportPayload = { langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, lists: [] };

  it('appelle la fonction SQL et renvoie l\'identifiant', async () => {
    let called: { fn: string; args: unknown } | null = null;
    const client = asClient({ rpc: async (fn: string, args: unknown) => { called = { fn, args }; return { data: 'new-id', error: null }; } });
    expect(await importChapter(client, payload)).toBe('new-id');
    expect(called).toEqual({ fn: 'lang_import_chapter', args: { p: payload } });
  });

  it('lève l\'erreur de la base', async () => {
    const client = asClient({ rpc: async () => ({ data: null, error: { message: 'Nombre de listes invalide (1 à 40)' } }) });
    await expect(importChapter(client, payload)).rejects.toThrow('Nombre de listes invalide');
  });
});

describe('deleteChapter', () => {
  it('supprime par identifiant', async () => {
    let eqArgs: unknown[] = [];
    const client = asClient({ from: () => ({ delete: () => ({ eq: async (...a: unknown[]) => { eqArgs = a; return { error: null }; } }) }) });
    await deleteChapter(client, 'c9');
    expect(eqArgs).toEqual(['id', 'c9']);
  });
});

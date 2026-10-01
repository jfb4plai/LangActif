import type { SupabaseClient } from '@supabase/supabase-js';
import type { Article, Langue } from '../engine/types';
import type { ImportPayload } from './importPayload';

export interface ChapterSummary {
  id: string;
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  created_at: string;
  listsCount: number;
}

export interface WordRow {
  id: string;
  position: number;
  fr: string;
  cible: string;
  article: Article | null;
  synonymes_fr: string[];
  synonymes_cible: string[];
  phrase_cible: string | null;
  phrase_fr: string | null;
  audio_url: string | null;
}

export interface ListRow {
  id: string;
  nom: string;
  position: number;
  words: WordRow[];
}

export interface ChapterDetail {
  id: string;
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  created_at: string;
  lists: ListRow[];
}

type SummaryRow = Omit<ChapterSummary, 'listsCount'> & { lang_lists: Array<{ count: number }> };
type DetailRow = Omit<ChapterDetail, 'lists'> & {
  lang_lists: Array<{ id: string; nom: string; position: number; lang_words: WordRow[] }>;
};

export async function listChapters(client: SupabaseClient): Promise<ChapterSummary[]> {
  const { data, error } = await client
    .from('lang_chapters')
    .select('id, langue, niveau, titre, numero, created_at, lang_lists(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SummaryRow[]).map(({ lang_lists, ...rest }) => ({
    ...rest,
    listsCount: lang_lists[0]?.count ?? 0,
  }));
}

/** Listes et mots dans l'ordre de l'Excel (la base ne garantit pas l'ordre des imbrications). */
export function sortChapterDetail(chapter: ChapterDetail): ChapterDetail {
  return {
    ...chapter,
    lists: [...chapter.lists]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ ...l, words: [...l.words].sort((a, b) => a.position - b.position) })),
  };
}

export async function getChapter(client: SupabaseClient, id: string): Promise<ChapterDetail> {
  const { data, error } = await client
    .from('lang_chapters')
    .select(
      'id, langue, niveau, titre, numero, auteur, created_at, ' +
        'lang_lists(id, nom, position, lang_words(id, position, fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url))',
    )
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const { lang_lists, ...rest } = data as unknown as DetailRow;
  return sortChapterDetail({
    ...rest,
    lists: lang_lists.map(({ lang_words, ...list }) => ({ ...list, words: lang_words })),
  });
}

/** Import atomique : la fonction SQL crée chapitre, listes et mots en une transaction. */
export async function importChapter(client: SupabaseClient, payload: ImportPayload): Promise<string> {
  const { data, error } = await client.rpc('lang_import_chapter', { p: payload });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteChapter(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('lang_chapters').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

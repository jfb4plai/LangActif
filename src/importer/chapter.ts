import type { Article, Langue, Word } from '../engine/types';

export interface RawRow {
  /** Numéro de ligne dans Excel (1 = en-tête). */
  n: number;
  cells: string[];
}
export interface RawSheet {
  name: string;
  /** En-têtes en minuscules. */
  header: string[];
  rows: RawRow[];
}
export interface RawWorkbook {
  hasMeta: boolean;
  /** Clés en minuscules. */
  meta: Record<string, string>;
  lists: RawSheet[];
}

export interface ImportIssue {
  sheet: string;
  row: number | null;
  column: string | null;
  message: string;
}

export type ParsedWord = Omit<Word, 'id'> & {
  phraseCible: string | null;
  phraseFr: string | null;
  audioUrl: string | null;
};
export interface ParsedList {
  name: string;
  words: ParsedWord[];
}
export interface ParsedChapter {
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  lists: ParsedList[];
}
export type ParseResult = { ok: true; chapter: ParsedChapter } | { ok: false; issues: ImportIssue[] };

const LANGUES: Langue[] = ['en-GB', 'nl-BE'];
const split = (s: string): string[] => s.split(';').map((x) => x.trim()).filter(Boolean);

/** Valide un classeur lu et produit un chapitre ; si une seule erreur, rien n'est importé. */
export function parseChapter(wb: RawWorkbook): ParseResult {
  const issues: ImportIssue[] = [];

  if (!wb.hasMeta) {
    return { ok: false, issues: [{ sheet: 'Méta', row: null, column: null, message: 'Feuille « Méta » absente' }] };
  }

  const need = (key: string): string => {
    const v = (wb.meta[key] ?? '').trim();
    if (!v) issues.push({ sheet: 'Méta', row: null, column: key, message: `Champ « ${key} » manquant` });
    return v;
  };
  const langue = need('langue');
  const niveau = need('niveau');
  const titre = need('titre');
  const numero = need('numero');
  const auteur = (wb.meta['auteur'] ?? '').trim() || null;
  const langueOk = (LANGUES as string[]).includes(langue);
  if (langue && !langueOk) {
    issues.push({ sheet: 'Méta', row: null, column: 'langue', message: `Langue « ${langue} » inconnue (attendu : en-GB ou nl-BE)` });
  }

  if (wb.lists.length === 0) {
    issues.push({ sheet: 'Méta', row: null, column: null, message: 'Aucune feuille de liste dans le classeur' });
  }

  const lists: ParsedList[] = [];
  for (const sheet of wb.lists) {
    const col = (name: string) => sheet.header.indexOf(name);
    const iFr = col('fr');
    const iCible = col('cible');
    const iArticle = col('article');
    if (iFr < 0) issues.push({ sheet: sheet.name, row: 1, column: 'fr', message: 'Colonne « fr » absente' });
    if (iCible < 0) issues.push({ sheet: sheet.name, row: 1, column: 'cible', message: 'Colonne « cible » absente' });
    if (langue === 'nl-BE' && iArticle < 0) {
      issues.push({ sheet: sheet.name, row: 1, column: 'article', message: 'Colonne « article » absente (obligatoire en néerlandais)' });
    }
    if (iFr < 0 || iCible < 0) continue;

    const cell = (row: RawRow, name: string): string => {
      const i = col(name);
      return i < 0 ? '' : (row.cells[i] ?? '').trim();
    };

    const words: ParsedWord[] = [];
    const seenFr = new Set<string>();
    const seenCible = new Set<string>();
    const before = issues.length;

    for (const row of sheet.rows) {
      if (row.cells.every((c) => c.trim() === '')) continue;
      const fr = cell(row, 'fr');
      const cible = cell(row, 'cible');
      const bad = (column: string, message: string) => issues.push({ sheet: sheet.name, row: row.n, column, message });

      if (!fr) bad('fr', 'Mot français manquant');
      if (!cible) bad('cible', 'Mot en langue cible manquant');
      if (!fr || !cible) continue;

      const rawArticle = cell(row, 'article').toLowerCase();
      let article: Article | null = null;
      if (langue === 'nl-BE') {
        if (rawArticle === 'de' || rawArticle === 'het') article = rawArticle;
        else if (rawArticle !== '-') bad('article', 'Article absent ou invalide (de, het, ou « - » si le mot n\'a pas d\'article)');
      } else if (langue === 'en-GB' && rawArticle !== '' && rawArticle !== '-') {
        bad('article', 'Pas d\'article attendu en anglais');
      }

      const kFr = fr.toLowerCase();
      const kCible = cible.toLowerCase();
      if (seenFr.has(kFr) || seenCible.has(kCible)) bad('fr', `Doublon dans la liste : « ${fr} » / « ${cible} »`);
      seenFr.add(kFr);
      seenCible.add(kCible);

      const phraseCible = cell(row, 'phrase_cible') || null;
      const phraseFr = cell(row, 'phrase_fr') || null;
      if (phraseCible && !phraseFr) bad('phrase_fr', 'Traduction française de la phrase manquante');
      if (phraseFr && !phraseCible) bad('phrase_cible', 'Phrase en langue cible manquante');

      words.push({
        fr,
        cible,
        article,
        synonymesFr: split(cell(row, 'synonymes_fr')),
        synonymesCible: split(cell(row, 'synonymes_cible')),
        phraseCible,
        phraseFr,
        audioUrl: cell(row, 'audio_url') || null,
      });
    }

    if (words.length === 0 && issues.length === before) {
      issues.push({ sheet: sheet.name, row: null, column: null, message: 'Liste vide' });
    }
    lists.push({ name: sheet.name, words });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, chapter: { langue: langue as Langue, niveau, titre, numero, auteur, lists } };
}

// src/importer/template.test.ts
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { readWorkbook } from './readXlsx';
import { buildTemplate } from './template';

describe('buildTemplate', () => {
  it('produit un modèle néerlandais avec la colonne article', async () => {
    const raw = await readWorkbook(await buildTemplate('nl-BE'));
    expect(raw.hasMeta).toBe(true);
    expect(raw.meta.langue).toBe('nl-BE');
    expect(raw.lists).toHaveLength(1);
    expect(raw.lists[0].header).toEqual([
      'fr', 'cible', 'article', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url',
    ]);
    expect(raw.lists[0].rows).toEqual([]);
  });

  it('produit un modèle anglais sans colonne article', async () => {
    const raw = await readWorkbook(await buildTemplate('en-GB'));
    expect(raw.meta.langue).toBe('en-GB');
    expect(raw.lists[0].header).toEqual(['fr', 'cible', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url']);
  });

  it('n\'est pas importable tel quel : les champs à remplir sont signalés', async () => {
    const result = parseChapter(await readWorkbook(await buildTemplate('nl-BE')));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const columns = result.issues.map((i) => i.column);
    expect(columns).toEqual(expect.arrayContaining(['niveau', 'titre', 'numero']));
  });
});

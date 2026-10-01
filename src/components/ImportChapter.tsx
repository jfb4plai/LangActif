import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { parseChapter, type ImportIssue, type ParsedChapter } from '../importer/chapter';
import { importChapter } from '../lib/chapters';
import { formatIssue } from '../lib/formatIssue';
import { toImportPayload } from '../lib/importPayload';
import { langueLabel } from '../lib/labels';
import { readXlsxInWorker } from '../lib/readXlsxInWorker';
import { FormField } from './FormField';

interface Props {
  client: SupabaseClient;
  onDone: (chapterId: string) => void;
  onCancel: () => void;
}

type Parsed = { chapter: ParsedChapter; warnings: ImportIssue[] };

export function ImportChapter({ client, onDone, onCancel }: Props) {
  const [templateLangue, setTemplateLangue] = useState<Langue>('nl-BE');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const requestId = useRef(0);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setTemplateError(null);
    try {
      // chargement différé : exceljs n'est téléchargé que si l'enseignant demande le modèle
      const { buildTemplate } = await import('../importer/template');
      const buffer = await buildTemplate(templateLangue);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `modele-langactif-${templateLangue}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setTemplateError('Impossible de préparer le modèle, réessayez.');
    }
  };

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setIssues([]);
    setReadError(null);
    setSaveError(null);
    const current = ++requestId.current;
    if (!file) {
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const result = parseChapter(await readXlsxInWorker(file));
      if (current !== requestId.current) return;
      if (result.ok) setParsed({ chapter: result.chapter, warnings: result.warnings });
      else setIssues(result.issues);
    } catch (e) {
      if (current !== requestId.current) return;
      setReadError(e instanceof Error ? e.message : 'Lecture impossible.');
    }
    if (current === requestId.current) setReading(false);
  };

  const save = async () => {
    if (!parsed) return;
    setSaving(true);
    setSaveError(null);
    try {
      onDone(await importChapter(client, toImportPayload(parsed.chapter)));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const wordCount = parsed ? parsed.chapter.lists.reduce((n, l) => n + l.words.length, 0) : 0;

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onCancel} style={{ marginBottom: '1rem' }}>Retour aux chapitres</button>
      <h1 className="font-serif" style={{ fontSize: 26, marginBottom: '1rem' }}>Importer un chapitre</h1>

      <div className="plai-card">
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>1. Télécharger le modèle</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
          Un chapitre = un classeur Excel. La feuille « Méta » décrit le chapitre, puis chaque feuille est une liste de vocabulaire du manuel.
          Survolez les en-têtes de colonnes dans Excel pour lire l'aide de chaque colonne.
        </p>
        <FormField label="Langue du chapitre" help="Le néerlandais ajoute la colonne « article » (de ou het), obligatoire pour les noms.">
          <select className="plai-input" value={templateLangue} onChange={(e) => setTemplateLangue(e.target.value as Langue)}>
            <option value="nl-BE">{langueLabel('nl-BE')}</option>
            <option value="en-GB">{langueLabel('en-GB')}</option>
          </select>
        </FormField>
        <button type="button" className="plai-btn-ghost" onClick={downloadTemplate}>Télécharger le modèle Excel</button>
        {templateError && <div className="plai-error" role="alert">{templateError}</div>}
      </div>

      <div className="plai-card">
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>2. Choisir votre classeur rempli</h2>
        <FormField
          label="Classeur Excel (.xlsx)"
          help="2 Mo maximum. Le fichier est vérifié dans votre navigateur ; rien n'est enregistré avant votre confirmation à l'étape suivante."
        >
          <input className="plai-input" type="file" accept=".xlsx" onChange={(e) => onFile(e.target.files?.[0])} />
        </FormField>
        {reading && <p aria-live="polite">Lecture du fichier...</p>}
        {readError && <div className="plai-error" role="alert">{readError}</div>}
        {issues.length > 0 && (
          <div className="plai-error" role="alert">
            <strong>{issues.length} {issues.length > 1 ? 'problèmes empêchent' : 'problème empêche'} l'import. Corrigez le classeur puis choisissez-le à nouveau :</strong>
            <ul style={{ marginTop: 6, paddingLeft: '1.25rem' }}>
              {issues.map((issue, i) => (
                <li key={i}>{formatIssue(issue)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {parsed && (
        <div className="plai-card">
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>3. Vérifier et enregistrer</h2>
          <p>
            <strong>{parsed.chapter.numero}. {parsed.chapter.titre}</strong>
          </p>
          <p style={{ color: 'var(--text2)', margin: '4px 0 10px' }}>
            {langueLabel(parsed.chapter.langue)}, niveau {parsed.chapter.niveau} : {parsed.chapter.lists.length} listes, {wordCount} mots
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: 12 }}>
            {parsed.chapter.lists.map((l) => (
              <li key={l.name}>{l.name} : {l.words.length} mots</li>
            ))}
          </ul>
          {parsed.warnings.length > 0 && (
            <div className="plai-success" role="status" style={{ background: '#fff8e6', borderColor: '#e0b43a', color: '#7a5a00' }}>
              <strong>À vérifier (n'empêche pas l'enregistrement) :</strong>
              <ul style={{ marginTop: 6, paddingLeft: '1.25rem' }}>
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{formatIssue(w)}</li>
                ))}
              </ul>
            </div>
          )}
          {saveError && <div className="plai-error" role="alert">{saveError}</div>}
          <button type="button" className="plai-btn" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer le chapitre'}
          </button>
        </div>
      )}
    </section>
  );
}

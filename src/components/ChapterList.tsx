import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listChapters, type ChapterSummary } from '../lib/chapters';
import { langueLabel } from '../lib/labels';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  client: SupabaseClient;
  onOpen: (id: string) => void;
  onImport: () => void;
}

export function ChapterList({ client, onOpen, onImport }: Props) {
  const [chapters, setChapters] = useState<ChapterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let alive = true;
    listChapters(client)
      .then((c) => alive && setChapters(c))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>Mes chapitres</h1>
        <button type="button" className="plai-btn" onClick={onImport}>Importer un chapitre</button>
      </div>

      {error && <div className="plai-error" role="alert">Impossible de charger vos chapitres : {error}</div>}
      {!error && chapters === null && <p aria-live="polite">Chargement...</p>}
      {chapters !== null && chapters.length === 0 && (
        <p className="plai-empty">
          Aucun chapitre pour l'instant. Importez un classeur Excel : un chapitre = un classeur, une feuille par liste de vocabulaire.
        </p>
      )}
      {chapters?.map((c) => (
        <button
          key={c.id}
          type="button"
          className="plai-card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() => onOpen(c.id)}
        >
          <strong>{c.numero}. {c.titre}</strong>
          <span style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="lang-badge">{langueLabel(c.langue)}</span>
            <span style={{ color: 'var(--text2)' }}>Niveau {c.niveau}</span>
            <span style={{ color: 'var(--text2)' }}>{c.listsCount} {c.listsCount > 1 ? 'listes' : 'liste'}</span>
          </span>
        </button>
      ))}
    </section>
  );
}

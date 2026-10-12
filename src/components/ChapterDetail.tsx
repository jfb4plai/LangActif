import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteChapter, getChapter, type ChapterDetail as Detail } from '../lib/chapters';
import { ArcadeGame, type ArcadeList } from '../arcade/ArcadeGame';
import { MIN_WORDS } from '../arcade/session';
import { langueLabel } from '../lib/labels';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  client: SupabaseClient;
  id: string;
  onBack: () => void;
}

/** Titre monté seulement quand le chapitre est chargé : le focus s'y place à ce moment. */
function ChapterTitle({ children }: { children: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <h1 ref={ref} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>
      {children}
    </h1>
  );
}

export function ChapterDetail({ client, id, onBack }: Props) {
  const [chapter, setChapter] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playing, setPlaying] = useState(false);

  const arcade = useMemo(() => {
    if (!chapter) return null;
    const lists: ArcadeList[] = chapter.lists.map((l) => ({
      id: l.id,
      nom: l.nom,
      words: l.words.map((w) => ({
        id: w.id,
        fr: w.fr,
        cible: w.cible,
        article: w.article,
        synonymesFr: w.synonymes_fr,
        synonymesCible: w.synonymes_cible,
      })),
    }));
    const audio: Record<string, string | null> = {};
    chapter.lists.forEach((l) => l.words.forEach((w) => (audio[w.id] = w.audio_url)));
    return { lists, audio };
  }, [chapter]);

  useEffect(() => {
    let alive = true;
    getChapter(client, id)
      .then((c) => alive && setChapter(c))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client, id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteChapter(client, id);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.');
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <section>
        <div className="plai-error" role="alert">{error}</div>
        <button type="button" className="plai-btn-ghost" onClick={onBack}>Retour</button>
      </section>
    );
  }
  if (!chapter) return <p aria-live="polite">Chargement...</p>;

  const wordCount = chapter.lists.reduce((n, l) => n + l.words.length, 0);

  if (playing && arcade) {
    return (
      <ArcadeGame
        lists={arcade.lists}
        audioByWordId={arcade.audio}
        studentId="essai-enseignant"
        blocId={chapter.id}
        preview
        onExit={() => setPlaying(false)}
      />
    );
  }

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onBack} style={{ marginBottom: '1rem' }}>Retour aux chapitres</button>
      <ChapterTitle>{chapter.numero}. {chapter.titre}</ChapterTitle>
      <div style={{ margin: '8px 0 1.25rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="lang-badge">{langueLabel(chapter.langue)}</span>
        <span style={{ color: 'var(--text2)' }}>Niveau {chapter.niveau}</span>
        <span style={{ color: 'var(--text2)' }}>{chapter.lists.length} listes, {wordCount} mots</span>
      </div>

      <div className="plai-card" style={{ marginBottom: '1rem' }}>
        <h2 className="font-serif" style={{ fontSize: 18, marginBottom: 8 }}>Essayer ce chapitre en jeu</h2>
        <p style={{ marginBottom: 10, color: 'var(--text2)' }}>
          Mode arcade : l'élève tire sur la bonne traduction. Tu peux le tester avec tes propres mots avant de le proposer. Rien n'est enregistré.
        </p>
        <button type="button" className="plai-btn" disabled={wordCount < MIN_WORDS} onClick={() => setPlaying(true)}>Essayer en mode arcade</button>
        {wordCount < MIN_WORDS && <p style={{ marginTop: 8 }}>Il faut au moins {MIN_WORDS} mots.</p>}
      </div>

      {chapter.lists.map((list) => (
        <div key={list.id} className="plai-card" style={{ overflowX: 'auto' }}>
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>{list.nom} ({list.words.length} mots)</h2>
          <table className="lang-table">
            <thead>
              <tr>
                <th scope="col">Français</th>
                <th scope="col">Langue cible</th>
                <th scope="col">Synonymes français</th>
                <th scope="col">Synonymes langue cible</th>
                <th scope="col">Phrase exemple</th>
              </tr>
            </thead>
            <tbody>
              {list.words.map((w) => (
                <tr key={w.id}>
                  <td>{w.fr}</td>
                  <td>{w.article ? `${w.article} ${w.cible}` : w.cible}</td>
                  <td>{w.synonymes_fr.join(' ; ')}</td>
                  <td>{w.synonymes_cible.join(' ; ')}</td>
                  <td>
                    {w.phrase_cible ?? ''}
                    {w.phrase_fr && <span style={{ display: 'block', color: 'var(--text2)' }}>{w.phrase_fr}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="plai-card" style={{ marginTop: '1.5rem' }}>
        <h2 className="font-serif" style={{ fontSize: 18, marginBottom: 8 }}>Supprimer ce chapitre</h2>
        {!confirming ? (
          <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(true)}>Supprimer le chapitre</button>
        ) : (
          <div role="alert">
            <p style={{ marginBottom: 10 }}>
              Supprimer définitivement « {chapter.titre} » ({chapter.lists.length} listes, {wordCount} mots) ? Cette action ne peut pas être annulée.
            </p>
            <button type="button" className="plai-btn" onClick={remove} disabled={deleting} style={{ marginRight: 8 }}>
              {deleting ? 'Suppression...' : 'Oui, supprimer'}
            </button>
            <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Annuler</button>
          </div>
        )}
      </div>
    </section>
  );
}

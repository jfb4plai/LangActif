import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listGroups, type GroupSummary } from '../lib/groups';
import { langueLabel } from '../lib/labels';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  client: SupabaseClient;
  onOpen: (id: string) => void;
  onCreate: () => void;
}

export function GroupList({ client, onOpen, onCreate }: Props) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let alive = true;
    listGroups(client)
      .then((g) => alive && setGroups(g))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>Mes groupes</h1>
        <button type="button" className="plai-btn" onClick={onCreate}>Créer un groupe</button>
      </div>

      {error && <div className="plai-error" role="alert">Impossible de charger vos groupes : {error}</div>}
      {!error && groups === null && <p aria-live="polite">Chargement...</p>}
      {groups !== null && groups.length === 0 && (
        <p className="plai-empty">
          Aucun groupe pour l'instant. Un groupe réunit les élèves d'une remédiation ou d'une classe : chacun reçoit un pseudo et un
          code personnel, sans nom ni adresse e-mail.
        </p>
      )}
      {groups?.map((g) => (
        <button
          key={g.id}
          type="button"
          className="plai-card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() => onOpen(g.id)}
        >
          <strong>{g.nom}</strong>
          <span style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="lang-badge">{langueLabel(g.langue)}</span>
            <span style={{ color: 'var(--text2)' }}>Code de groupe : {g.code}</span>
            <span style={{ color: 'var(--text2)' }}>{g.seatsCount} {g.seatsCount > 1 ? 'places' : 'place'}</span>
            {g.archived_at && <span style={{ color: 'var(--text2)' }}>Archivé</span>}
          </span>
        </button>
      ))}
    </section>
  );
}

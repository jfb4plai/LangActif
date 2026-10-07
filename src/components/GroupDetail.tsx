import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addSeats,
  archiveGroup,
  archiveSeat,
  deleteGroup,
  deleteSeat,
  getGroup,
  regenerateCodes,
  resetSeatCode,
  seatState,
  unlockSeat,
  type GroupDetail as Detail,
  type SeatState,
} from '../lib/groups';
import { langueLabel } from '../lib/labels';
import { buildSlips, type Slip } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { PrintSheet } from './PrintSheet';

interface Props {
  client: SupabaseClient;
  id: string;
  onBack: () => void;
}

const STATE_LABEL: Record<SeatState, string> = {
  archive: 'Archivée',
  bloque: 'Bloquée',
  jamais: 'Jamais connecté',
  actif: 'Active',
};

function Title({ children }: { children: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <h1 ref={ref} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>
      {children}
    </h1>
  );
}

export function GroupDetail({ client, id, onBack }: Props) {
  const [group, setGroup] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ title: string; slips: Slip[] } | null>(null);
  const [extra, setExtra] = useState('1');

  const load = useCallback(async () => {
    try {
      setGroup(await getGroup(client, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!group) {
    return error ? (
      <section>
        <div className="plai-error" role="alert">{error}</div>
        <button type="button" className="plai-btn-ghost" onClick={onBack}>Retour</button>
      </section>
    ) : (
      <p aria-live="polite">Chargement...</p>
    );
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setConfirming(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const show = (title: string, seats: Array<{ pseudo: string; code: string }>) =>
    setIssued({ title, slips: buildSlips(window.location.origin, group.code, seats) });

  if (issued) {
    return <PrintSheet title={issued.title} slips={issued.slips} doneLabel="Retour au groupe" onDone={() => setIssued(null)} />;
  }

  const archived = group.archived_at !== null;
  const activeSeats = group.seats.filter((s) => !s.archived_at).length;

  const addMore = () => {
    const n = Number(extra);
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      setError('Indiquez un nombre entier de 1 à 40.');
      return;
    }
    void run(async () => show(`Fiches des ${n} nouvelles places`, await addSeats(client, group.id, n)));
  };

  const confirmBox = (key: string, text: string, onYes: () => void) =>
    confirming === key && (
      <div role="alert" style={{ marginTop: 8 }}>
        <p style={{ marginBottom: 8 }}>{text}</p>
        <button type="button" className="plai-btn" disabled={busy} onClick={onYes}>Confirmer</button>{' '}
        <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(null)}>Annuler</button>
      </div>
    );

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onBack} style={{ marginBottom: '1rem' }}>Retour aux groupes</button>
      <Title>{group.nom}</Title>
      <div style={{ margin: '8px 0 1.25rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="lang-badge">{langueLabel(group.langue)}</span>
        <span style={{ color: 'var(--text2)' }}>Code de groupe : <strong>{group.code}</strong></span>
        <span style={{ color: 'var(--text2)' }}>{activeSeats} {activeSeats > 1 ? 'places actives' : 'place active'}</span>
      </div>

      {archived && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>Groupe archivé : les élèves ne peuvent plus se connecter.</div>}
      {error && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="plai-card" style={{ overflowX: 'auto' }}>
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Places</h2>
        <table className="lang-table lang-table-stack">
          <thead>
            <tr>
              <th scope="col">Pseudo</th>
              <th scope="col">État</th>
              <th scope="col">Dernière activité</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {group.seats.map((s) => {
              const state = seatState(s);
              return (
                <tr key={s.id}>
                  <td data-label="Pseudo">{s.pseudo}</td>
                  <td data-label="État">{STATE_LABEL[state]}</td>
                  <td data-label="Dernière activité">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('fr-BE') : 'Aucune'}</td>
                  <td>
                    {state !== 'archive' && !archived && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="plai-btn-ghost"
                          disabled={busy}
                          onClick={() => void run(async () => show(`Nouveau code pour ${s.pseudo}`, [await resetSeatCode(client, s.id)]))}
                        >
                          Nouveau code
                        </button>
                        {state === 'bloque' && (
                          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => void run(() => unlockSeat(client, s.id))}>
                            Débloquer
                          </button>
                        )}
                        <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming(`seat-archive:${s.id}`)}>
                          Archiver
                        </button>
                      </div>
                    )}
                    <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming(`seat-delete:${s.id}`)}>
                      Supprimer
                    </button>
                    {confirmBox(`seat-archive:${s.id}`, `Archiver « ${s.pseudo} » ? L'élève ne pourra plus se connecter ; ses données sont conservées.`, () =>
                      void run(() => archiveSeat(client, s.id)),
                    )}
                    {confirmBox(
                      `seat-delete:${s.id}`,
                      `Supprimer définitivement « ${s.pseudo} » ? Cela efface aussi tout son travail. Cette action ne peut pas être annulée.`,
                      () => void run(() => deleteSeat(client, s.id)),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!archived && (
        <div className="plai-card" style={{ marginTop: '1rem' }}>
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Ajouter des places</h2>
          <FormField
            label="Nombre de places à ajouter"
            help="Seules les nouvelles places reçoivent un pseudo et un code. Les codes déjà distribués ne changent pas."
          >
            <input className="plai-input" inputMode="numeric" value={extra} placeholder="2" onChange={(e) => setExtra(e.target.value)} />
          </FormField>
          <button type="button" className="plai-btn" disabled={busy} onClick={addMore}>Ajouter et imprimer</button>

          <h2 className="font-serif" style={{ fontSize: 20, margin: '1.25rem 0 8px' }}>Régénérer toutes les fiches</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
            Nouveaux codes pour toutes les places actives. Les anciennes fiches et tous les appareils connectés sont invalidés.
          </p>
          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('regen')}>Régénérer les fiches</button>
          {confirmBox('regen', 'Tous les élèves devront utiliser leur nouveau code. Continuer ?', () =>
            void run(async () => show('Nouvelles fiches du groupe', await regenerateCodes(client, group.id))),
          )}
        </div>
      )}

      <div className="plai-card" style={{ marginTop: '1rem' }}>
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Archiver ou supprimer le groupe</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!archived && (
            <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('group-archive')}>Archiver le groupe</button>
          )}
          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('group-delete')}>Supprimer le groupe</button>
        </div>
        {confirmBox('group-archive', 'Archiver le groupe ? Plus aucun élève ne pourra se connecter ; les données sont conservées.', () =>
          void run(() => archiveGroup(client, group.id)),
        )}
        {confirmBox(
          'group-delete',
          `Supprimer définitivement « ${group.nom} » (${group.seats.length} places) ? Cela efface aussi tout le travail des élèves. Cette action ne peut pas être annulée.`,
          () => void run(async () => { await deleteGroup(client, group.id); onBack(); }),
        )}
      </div>
    </section>
  );
}

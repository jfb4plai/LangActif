import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { createGroup, type CreatedGroup } from '../lib/groups';
import { buildSlips } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { PrintSheet } from './PrintSheet';

interface Props {
  client: SupabaseClient;
  onDone: (groupId: string) => void;
  onCancel: () => void;
}

export function GroupCreate({ client, onDone, onCancel }: Props) {
  const [nom, setNom] = useState('');
  const [langue, setLangue] = useState<Langue>('nl-BE');
  const [places, setPlaces] = useState('8');
  const [errors, setErrors] = useState<{ nom?: string; places?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedGroup | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  if (created) {
    return (
      <PrintSheet
        title={`Fiches du groupe « ${nom.trim()} »`}
        slips={buildSlips(window.location.origin, created.code, created.seats)}
        doneLabel="Ouvrir le groupe"
        onDone={() => onDone(created.group_id)}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const trimmed = nom.trim();
    const n = Number(places);
    if (!trimmed) next.nom = 'Donnez un nom au groupe.';
    else if (trimmed.length > 200) next.nom = 'Le nom est trop long (200 caractères au maximum).';
    if (!Number.isInteger(n) || n < 1 || n > 40) next.places = 'Indiquez un nombre entier de 1 à 40.';
    setErrors(next);
    if (next.nom || next.places) return;

    setSubmitting(true);
    try {
      setCreated(await createGroup(client, { nom: trimmed, langue, places: n }));
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Création impossible.' });
      setSubmitting(false);
    }
  };

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onCancel} style={{ marginBottom: '1rem' }}>Retour aux groupes</button>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26, marginBottom: 12 }}>Créer un groupe</h1>
      <form className="plai-card" onSubmit={submit} noValidate>
        <FormField
          label="Nom du groupe"
          required
          error={errors.nom}
          help="Visible par vous seul. N'écrivez aucun nom d'élève : l'application ne doit jamais contenir de nom."
        >
          <input
            className="plai-input"
            value={nom}
            maxLength={200}
            placeholder="Remédiation néerlandais, 2e S, lundi 12 h"
            onChange={(e) => setNom(e.target.value)}
          />
        </FormField>
        <FormField label="Langue" help="Détermine les chapitres que vous pourrez assigner à ce groupe.">
          <select className="plai-input" value={langue} onChange={(e) => setLangue(e.target.value as Langue)}>
            <option value="nl-BE">Néerlandais (Belgique)</option>
            <option value="en-GB">Anglais (Royaume-Uni)</option>
          </select>
        </FormField>
        <FormField
          label="Nombre de places"
          required
          error={errors.places}
          help="Une place = un pseudo et un code à distribuer. Vous pourrez en ajouter plus tard sans changer les codes déjà distribués. Un élève qui suit deux groupes aura un pseudo dans chacun."
        >
          <input
            className="plai-input"
            inputMode="numeric"
            value={places}
            placeholder="8"
            onChange={(e) => setPlaces(e.target.value)}
          />
        </FormField>
        {errors.general && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{errors.general}</div>}
        <button type="submit" className="plai-btn" disabled={submitting}>
          {submitting ? 'Création...' : 'Créer le groupe et les fiches'}
        </button>
      </form>
    </section>
  );
}

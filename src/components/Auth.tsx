import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { FormField } from './FormField';

type Props = {
  passwordRecovery?: boolean;
  onPasswordUpdated?: () => void;
};

type Mode = 'signin' | 'signup' | 'reset';

export function Auth({ passwordRecovery = false, onPasswordUpdated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError('Connexion impossible : vérifiez l\'adresse et le mot de passe.');
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) setError(error.message);
      else setInfo('Courriel envoyé. Ouvrez le lien reçu pour choisir un nouveau mot de passe.');
    } else {
      // emailRedirectTo : sans lui, le courriel de confirmation ne sait pas revenir vers cette application
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setError(error.message);
      else setInfo('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('6 caractères minimum.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) setError(error.message);
    else onPasswordUpdated?.();
  };

  if (passwordRecovery) {
    return (
      <div className="plai-card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h1 className="font-serif" style={{ fontSize: 24, marginBottom: '1rem' }}>Nouveau mot de passe</h1>
        <form onSubmit={handleUpdatePassword}>
          <FormField label="Nouveau mot de passe" required help="Il remplace l'ancien pour toutes les applications PLAI qui utilisent ce compte.">
            <input
              className="plai-input"
              type="password"
              placeholder="Au moins 6 caractères"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </FormField>
          {error && <div className="plai-error" role="alert">{error}</div>}
          <button className="plai-btn" type="submit" disabled={loading}>
            {loading ? 'Chargement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    );
  }

  const title = mode === 'reset' ? 'Mot de passe oublié' : mode === 'signup' ? 'Créer un compte enseignant' : 'Connexion enseignant';

  return (
    <div className="plai-card" style={{ maxWidth: 420, margin: '2rem auto' }}>
      <h1 className="font-serif" style={{ fontSize: 24, marginBottom: '0.25rem' }}>{title}</h1>
      <p style={{ color: 'var(--text2)', marginBottom: '1rem' }}>
        LangActif : vocabulaire de langues étrangères pour vos élèves, avec suivi de leurs résultats.
      </p>
      <form onSubmit={handleSubmit}>
        <FormField label="Adresse courriel" required help="Celle de votre école : elle sert à vous reconnaître et à récupérer votre mot de passe.">
          <input
            className="plai-input"
            type="email"
            placeholder="prenom.nom@ecole.be"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </FormField>
        {mode !== 'reset' && (
          <FormField label="Mot de passe" required help="6 caractères minimum. Le même compte sert dans les autres applications PLAI.">
            <input
              className="plai-input"
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </FormField>
        )}
        {error && <div className="plai-error" role="alert">{error}</div>}
        {info && <div className="plai-success" role="status">{info}</div>}
        <button className="plai-btn" type="submit" disabled={loading}>
          {loading ? 'Chargement...' : mode === 'signin' ? 'Se connecter' : mode === 'reset' ? 'Envoyer le lien' : 'Créer un compte'}
        </button>
      </form>
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mode !== 'reset' && (
          <button type="button" className="plai-nav-link" style={{ textAlign: 'left', fontSize: 14 }} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
          </button>
        )}
        {mode === 'signin' && (
          <button type="button" className="plai-nav-link" style={{ textAlign: 'left', fontSize: 14 }} onClick={() => switchMode('reset')}>
            Mot de passe oublié ?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="plai-nav-link" style={{ textAlign: 'left', fontSize: 14 }} onClick={() => switchMode('signin')}>
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}

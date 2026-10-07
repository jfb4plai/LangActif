import { useEffect, useState, type FormEvent } from 'react';
import {
  clearToken,
  fetchMe,
  fetchPseudos,
  loadToken,
  loginStudent,
  logoutStudent,
  saveToken,
  type LoginResult,
} from '../lib/studentApi';
import { groupCodeFromSearch } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { Layout } from './Layout';
import { PrivacyInfo } from './PrivacyInfo';

type Phase = 'loading' | 'login' | 'home';

function failureMessage(r: Extract<LoginResult, { ok: false }>): string {
  switch (r.reason) {
    case 'bloque': {
      const minutes = Math.max(1, Math.ceil((r.retryAfterSeconds ?? 900) / 60));
      return `Trop d'essais. Demande à ton enseignant ou réessaie dans ${minutes} ${minutes > 1 ? 'minutes' : 'minute'}.`;
    }
    case 'trop_de_tentatives':
      return "Trop d'essais depuis cet appareil. Réessaie dans quelques minutes.";
    case 'reseau':
      return 'Connexion impossible : vérifie ton réseau.';
    default:
      return 'Pseudo ou code incorrect.';
  }
}

export function StudentApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [pseudo, setPseudo] = useState('');
  const [networkNote, setNetworkNote] = useState(false);

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setPhase('login');
      return;
    }
    fetchMe(token).then((r) => {
      if (r.status === 'ok') {
        setPseudo(r.pseudo);
        setPhase('home');
      } else {
        if (r.status === 'expire') clearToken();
        setNetworkNote(r.status === 'reseau');
        setPhase('login');
      }
    });
  }, []);

  const signOut = async () => {
    const token = loadToken();
    clearToken();
    if (token) await logoutStudent(token);
    setPhase('login');
  };

  return (
    <Layout studentMode>
      {phase === 'loading' && <p aria-live="polite">Chargement...</p>}
      {phase === 'login' && (
        <Login
          networkNote={networkNote}
          onLoggedIn={(p) => {
            setPseudo(p);
            setPhase('home');
          }}
        />
      )}
      {phase === 'home' && <Home pseudo={pseudo} onSignOut={signOut} />}
    </Layout>
  );
}

function Home({ pseudo, onSignOut }: { pseudo: string; onSignOut: () => void }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 28, marginBottom: 12 }}>Bonjour, {pseudo}</h1>
      <p className="plai-empty">Ton enseignant n'a pas encore assigné de travail.</p>
      <button type="button" className="plai-btn-ghost" onClick={onSignOut}>Se déconnecter</button>
      <PrivacyInfo />
    </section>
  );
}

function Login({ networkNote, onLoggedIn }: { networkNote: boolean; onLoggedIn: (pseudo: string) => void }) {
  const [groupe, setGroupe] = useState(() => groupCodeFromSearch(window.location.search));
  const [pseudos, setPseudos] = useState<string[] | null>(null);
  const [unknownGroup, setUnknownGroup] = useState(false);
  const [networkProblem, setNetworkProblem] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pseudo, setPseudo] = useState('');
  const [code, setCode] = useState('');
  const [partage, setPartage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    setPseudo('');
    setUnknownGroup(false);
    setNetworkProblem(false);
    if (!/^[A-Z0-9]{5}$/.test(groupe)) {
      setPseudos(null);
      return;
    }
    let alive = true;
    fetchPseudos(groupe).then((result) => {
      if (!alive) return;
      setPseudos(result.status === 'ok' ? result.pseudos : null);
      setUnknownGroup(result.status === 'inconnu');
      setNetworkProblem(result.status === 'reseau');
    });
    return () => {
      alive = false;
    };
  }, [groupe, retry]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pseudo || !code.trim()) {
      setError('Choisis ton pseudo et écris ton code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await loginStudent({ groupe, pseudo, code: code.trim().toUpperCase(), appareilPartage: partage });
    if (result.ok) {
      saveToken(result.token, partage);
      onLoggedIn(result.pseudo);
      return;
    }
    setError(failureMessage(result));
    setSubmitting(false);
  };

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 28, marginBottom: 12 }}>Entrer dans LangActif</h1>
      {networkNote && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>Connexion impossible : vérifie ton réseau.</div>}
      <form className="plai-card" onSubmit={submit} noValidate>
        <FormField
          label="Code du groupe"
          help="Ton enseignant te le donne. Si tu as scanné le QR code, il est déjà écrit."
          error={
            unknownGroup
              ? 'Ce groupe est introuvable. Vérifie le code.'
              : networkProblem
                ? 'Connexion impossible : vérifie ton réseau. Ton code de groupe n\'est pas en cause.'
                : undefined
          }
        >
          <input
            className="plai-input"
            value={groupe}
            maxLength={10}
            placeholder="K7M4X"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setGroupe(e.target.value.trim().toUpperCase())}
          />
        </FormField>

        {networkProblem && (
          <button type="button" className="plai-btn-ghost" style={{ marginBottom: 16 }} onClick={() => setRetry((n) => n + 1)}>
            Réessayer
          </button>
        )}

        {pseudos && (
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
            <legend className="plai-label">Ton pseudo</legend>
            <p style={{ fontSize: 16, color: 'var(--text2)' }}>Choisis le pseudo écrit sur ta fiche.</p>
            <div className="lang-pseudo-grid">
              {pseudos.map((p) => (
                <label key={p}>
                  <input type="radio" name="pseudo" value={p} checked={pseudo === p} onChange={() => setPseudo(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <FormField label="Ton code" help="Une lettre et trois chiffres, écrits sur ta fiche.">
          <input
            className="plai-input"
            value={code}
            maxLength={4}
            placeholder="K472"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </FormField>

        <div className="plai-field">
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, fontSize: 16 }}>
            <input type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} style={{ width: 24, height: 24, marginTop: 2 }} />
            <span>Je suis sur un appareil de l'école (tablette ou ordinateur partagé)</span>
          </label>
          <p style={{ fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>
            Coche cette case si d'autres élèves utilisent le même appareil, par exemple une tablette de l'école. Sinon, la personne qui
            utilisera cet appareil après toi pourrait entrer avec ton pseudo. Cochée, tu seras déconnecté au bout de quelques heures.
          </p>
        </div>

        {error && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
        <button type="submit" className="plai-btn" disabled={submitting}>{submitting ? 'Connexion...' : 'Entrer'}</button>
      </form>
      <PrivacyInfo />
    </section>
  );
}

import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  userEmail?: string;
  onSignOut?: () => void;
  onHome?: () => void;
}

export function Layout({ children, userEmail, onSignOut, onHome }: LayoutProps) {
  return (
    <>
      <nav className="plai-nav">
        <button type="button" className="plai-nav-logo" onClick={onHome} aria-label="LangActif, retour à l'accueil">
          {/* hauteur seule : le logo n'est pas carré (1276 x 498) */}
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          <span>LangActif</span>
        </button>
        {userEmail && (
          <div className="plai-nav-actions">
            <span className="lang-nav-email" style={{ fontSize: 16, color: 'var(--text2)' }}>{userEmail}</span>
            <button type="button" className="plai-nav-link" style={{ fontSize: 16 }} onClick={onSignOut}>
              Se déconnecter
            </button>
          </div>
        )}
      </nav>
      <main className="plai-container" style={{ paddingTop: '1.5rem', paddingBottom: '1rem' }}>
        {children}
      </main>
      <footer className="plai-footer">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto', margin: '0 auto 0.75rem' }} />
        <p>LangActif, un outil du Pôle Territorial de la Ville de Liège (PLAI)</p>
        <p>
          <a href="mailto:jf.beguin@outlook.com">jf.beguin@outlook.com</a>
        </p>
      </footer>
    </>
  );
}

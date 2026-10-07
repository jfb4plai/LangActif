import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  active: boolean;
  onClick: () => void;
}

interface LayoutProps {
  children: ReactNode;
  userEmail?: string;
  onSignOut?: () => void;
  onHome?: () => void;
  nav?: NavItem[];
}

export function Layout({ children, userEmail, onSignOut, onHome, nav }: LayoutProps) {
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
            {nav?.map((item) => (
              <button
                key={item.label}
                type="button"
                className="plai-nav-link"
                style={{ fontSize: 16, fontWeight: item.active ? 700 : 400 }}
                aria-current={item.active ? 'page' : undefined}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
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
        <p>
          Code :{' '}
          <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>
          {' · '}Contenus :{' '}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>
          {' · '}Jean-François Beguin, jfb4plai.com
        </p>
      </footer>
    </>
  );
}

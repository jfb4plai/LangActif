import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './plai-style.css';
import './overrides.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p className="plai-empty">LangActif</p>
  </StrictMode>,
);

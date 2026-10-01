import { useState } from 'react';
import { Auth } from './components/Auth';
import { ChapterDetail } from './components/ChapterDetail';
import { ChapterList } from './components/ChapterList';
import { ImportChapter } from './components/ImportChapter';
import { Layout } from './components/Layout';
import { supabase } from './lib/supabase';
import { useSession } from './lib/useSession';

type View = { name: 'chapters' } | { name: 'import' } | { name: 'chapter'; id: string };

export default function App() {
  const { session, loading, passwordRecovery, clearPasswordRecovery } = useSession();
  const [view, setView] = useState<View>({ name: 'chapters' });

  if (loading) {
    return (
      <Layout>
        <p aria-live="polite">Chargement...</p>
      </Layout>
    );
  }

  if (!session || passwordRecovery) {
    return (
      <Layout>
        <Auth passwordRecovery={passwordRecovery} onPasswordUpdated={clearPasswordRecovery} />
      </Layout>
    );
  }

  const home = () => setView({ name: 'chapters' });

  return (
    <Layout userEmail={session.user.email ?? ''} onSignOut={() => supabase.auth.signOut()} onHome={home}>
      {view.name === 'chapters' && (
        <ChapterList client={supabase} onOpen={(id) => setView({ name: 'chapter', id })} onImport={() => setView({ name: 'import' })} />
      )}
      {view.name === 'import' && (
        <ImportChapter client={supabase} onDone={(id) => setView({ name: 'chapter', id })} onCancel={home} />
      )}
      {view.name === 'chapter' && <ChapterDetail client={supabase} id={view.id} onBack={home} />}
    </Layout>
  );
}

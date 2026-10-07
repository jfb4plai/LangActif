import { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { ChapterDetail } from './components/ChapterDetail';
import { ChapterList } from './components/ChapterList';
import { GroupCreate } from './components/GroupCreate';
import { GroupDetail } from './components/GroupDetail';
import { GroupList } from './components/GroupList';
import { ImportChapter } from './components/ImportChapter';
import { Layout } from './components/Layout';
import { StudentApp } from './components/StudentApp';
import { isStudentRoute } from './lib/slips';
import { supabase } from './lib/supabase';
import { useSession } from './lib/useSession';

type View =
  | { name: 'chapters' }
  | { name: 'import' }
  | { name: 'chapter'; id: string }
  | { name: 'groups' }
  | { name: 'group-create' }
  | { name: 'group'; id: string };

export default function App() {
  return isStudentRoute(window.location.pathname) ? <StudentApp /> : <TeacherApp />;
}

function TeacherApp() {
  const { session, loading, passwordRecovery, clearPasswordRecovery } = useSession();
  const [view, setView] = useState<View>({ name: 'chapters' });

  // changement de compte ou déconnexion : retour à l'écran d'accueil
  useEffect(() => {
    setView({ name: 'chapters' });
  }, [session?.user.id]);

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
  const groups = () => setView({ name: 'groups' });
  const inGroups = view.name === 'groups' || view.name === 'group-create' || view.name === 'group';

  return (
    <Layout
      userEmail={session.user.email ?? ''}
      onSignOut={() => supabase.auth.signOut()}
      onHome={home}
      nav={[
        { label: 'Mes chapitres', active: !inGroups, onClick: home },
        { label: 'Mes groupes', active: inGroups, onClick: groups },
      ]}
    >
      {view.name === 'chapters' && (
        <ChapterList client={supabase} onOpen={(id) => setView({ name: 'chapter', id })} onImport={() => setView({ name: 'import' })} />
      )}
      {view.name === 'import' && (
        <ImportChapter client={supabase} onDone={(id) => setView({ name: 'chapter', id })} onCancel={home} />
      )}
      {view.name === 'chapter' && <ChapterDetail client={supabase} id={view.id} onBack={home} />}
      {view.name === 'groups' && (
        <GroupList client={supabase} onOpen={(id) => setView({ name: 'group', id })} onCreate={() => setView({ name: 'group-create' })} />
      )}
      {view.name === 'group-create' && (
        <GroupCreate client={supabase} onDone={(id) => setView({ name: 'group', id })} onCancel={groups} />
      )}
      {view.name === 'group' && <GroupDetail client={supabase} id={view.id} onBack={groups} />}
    </Layout>
  );
}

# LangActif, plan 2 : application, comptes enseignant et import de chapitres

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une application web déployable où un enseignant se connecte, télécharge un modèle Excel, importe un chapitre (validé par le moteur du plan 1), le voit enregistré en base (chapitre, listes, mots) et peut le supprimer.

**Architecture:** React 18 + Vite + Tailwind v3 dans le même dépôt que le moteur du plan 1 (`src/engine`, `src/importer`). Authentification Supabase (projet partagé), données lues et écrites directement par `supabase-js` sous RLS (aucune clé de service côté navigateur). L'import est atomique : une fonction Postgres `lang_import_chapter(jsonb)` (security invoker) crée chapitre, listes et mots en une transaction. Le fichier `.xlsx` est lu dans un Web Worker avec délai maximal (les limites du plan 1 ne couvrent pas une bombe zip).

**Tech Stack:** React 18, Vite 5, Tailwind v3, Supabase v2 (PostgreSQL, RLS), exceljs (dans un Worker et dans un chargement différé), Vitest 2.

**Spec de référence :** `docs/superpowers/specs/2026-10-01-langactif-design.md` (sections 3, 4, 7 à 9, 13). Plan précédent : `2026-10-01-langactif-plan-1-moteur.md`.

## Périmètre et découpage

Le plan 2 initial (voir plan 1) comprenait l'audio. Après lecture de Dialogue Audio, **l'audio sort du plan 2** :

- Le Space Hugging Face de Dialogue Audio (`projets/dialogue-audio/hf-space/app.py`, FastAPI + edge-tts) produit **un dialogue MP3 par requête, déposé sur Internet Archive**. Il n'a pas de point d'entrée « un mot, un clip » : l'utiliser tel quel créerait un élément Internet Archive par mot.
- Il faut donc décider où générer (nouveau point d'entrée sur le Space, ou fonction serverless Node avec un paquet edge-tts) et où stocker (Supabase Storage ou Internet Archive). C'est un sous-système à part, avec ses risques (service non officiel, démarrage à froid du Space, durée des lots). **Plan 2b : audio.**

Le plan 2 livre donc un logiciel complet et testable sans audio : le champ `audio_url` fourni par l'enseignant dans l'Excel est conservé, la génération viendra au plan 2b.

Ensuite : plan 3 (accès élève, code personnel, file hors ligne, QCM audio et taper), plan 4 (tableau de bord), plans 5 et 6 (autres modes, arcade).

## Décisions d'implémentation à valider par JF

1. **Aide dans le modèle Excel** (question laissée ouverte par la revue du plan 1) : l'aide est en **notes de cellule sur les en-têtes** (pas de ligne d'exemple, qui serait importée comme un mot, pas de feuille d'aide visible, qui serait lue comme une liste). Des explications complètes figurent aussi dans la page d'import.
2. **Importer = créer.** Pas de « remplacer un chapitre » dans ce plan : ré-importer crée un nouveau chapitre. Le remplacement conserverait-il les progrès des élèves ? Question pour le plan 3.
3. **Suppression** d'un chapitre : définitive (cascade sur listes et mots), après confirmation.
4. **Plafonds côté base** de l'import : 40 listes par chapitre et 1000 mots par liste (alignés sur les limites de l'importeur).
5. **Teal et police** : on reprend `shared/css/plai-style.css` tel quel (teal `#0f6e56`) ; seule la taille de base passe de 15 à 16 px (règle PLAI d'accessibilité).
6. **Contact public** dans le pied de page : `jf.beguin@outlook.com`.

## Actions réservées à JF (aucun sous-agent ne peut les faire)

- **A1** Exécuter la migration SQL (Task 2) dans l'éditeur SQL du projet Supabase partagé, puis le script de vérification RLS.
- **A2** Fournir `VITE_SUPABASE_ANON_KEY` (clé publique « anon ») dans `.env.local`.
- **A3** Se connecter avec un compte enseignant existant (ou en créer un lui-même) pour la recette de la Task 11. Aucun compte n'est créé par l'assistant sur un service distant.
- **A4** Dans Supabase, Authentication, URL Configuration : ajouter `http://localhost:5173` et l'adresse de production aux « Redirect URLs » (ajout seulement, le projet est partagé).
- **A5** Connecter le dépôt à Vercel (variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`) et le sous-domaine `langactif.jfb4plai.com`.

## Structure des fichiers

Tout sous `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\`. Branche de travail : `feat/plan-2-application`.

| Fichier | Responsabilité |
|---|---|
| `vite.config.ts` (remplace `vitest.config.ts`) | Vite, React, config des tests, Worker en ES |
| `tailwind.config.js`, `postcss.config.js` | Tailwind v3 (motif `import.meta.url` de DiffActif) |
| `index.html`, `src/main.tsx`, `src/vite-env.d.ts` | point d'entrée |
| `src/index.css`, `src/plai-style.css`, `src/overrides.css`, `public/plai-logo.jpg` | styles PLAI |
| `src/importer/limits.ts` | constantes de limites (module léger, sans exceljs) |
| `src/importer/template.ts` (+ test) | génération du modèle Excel |
| `supabase/migrations/20261001000000_create_lang_content.sql` | tables, RLS, grants, fonction d'import |
| `supabase/tests/rls_lang_content.sql` | vérification RLS manuelle (JF) |
| `src/lib/importPayload.ts` (+ test) | chapitre analysé vers charge utile de l'import |
| `src/lib/chapters.ts` (+ test) | accès aux données (liste, détail, import, suppression) |
| `src/lib/formatIssue.ts`, `src/lib/readError.ts` (+ tests) | messages lisibles |
| `src/lib/readXlsxInWorker.ts` (+ test), `src/workers/readXlsx.worker.ts` | lecture isolée du fichier |
| `src/lib/labels.ts` | libellés des langues |
| `src/lib/supabase.ts`, `src/lib/useSession.ts` | client et session |
| `src/components/Layout.tsx`, `FormField.tsx`, `Auth.tsx` | cadre PLAI, champ guidé, connexion |
| `src/components/ChapterList.tsx`, `ChapterDetail.tsx`, `ImportChapter.tsx` | écrans enseignant |
| `src/App.tsx` | navigation entre écrans |

Règle de découpage du bundle : **le code d'écran importe `../importer/chapter` et `../importer/limits` directement, jamais `../importer` (le fichier d'index réexporte `readXlsx`, donc exceljs).** exceljs n'entre que dans le Worker et dans le chargement différé du modèle.

---

### Task 0 : Branche, dépendances et socle de build

**Files:**
- Create: `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`, `src/index.css`, `src/overrides.css`, `.env.example`, `.claude/launch.json`
- Create (copie): `src/plai-style.css`, `public/plai-logo.jpg`
- Modify: `package.json`, `tsconfig.json`, `.gitignore`
- Delete: `vitest.config.ts`

- [ ] **Step 1: Créer la branche**

Run (dans `langactif/`): `git checkout -b feat/plan-2-application`
Expected: `Switched to a new branch 'feat/plan-2-application'`.

- [ ] **Step 2: Installer les dépendances**

```bash
npm install react@^18.3.1 react-dom@^18.3.1 @supabase/supabase-js@^2.57.4
npm install -D vite@^5.4.2 @vitejs/plugin-react@^4.3.1 tailwindcss@^3.4.1 postcss@^8.4.35 autoprefixer@^10.4.18 @types/react@^18.3.5 @types/react-dom@^18.3.0
npm pkg set scripts.dev=vite scripts.build="vite build" scripts.preview="vite preview"
```
Expected: installation sans erreur ; `package.json` contient les scripts `dev`, `build`, `preview`, `test`, `typecheck`.

- [ ] **Step 3: Remplacer la config Vitest par une config Vite unique**

```bash
git rm vitest.config.ts
```

Créer `vite.config.ts` :

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // le Worker de lecture Excel est un module ES
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 4: Tailwind et PostCSS (motif DiffActif, indépendant du dossier courant)**

`tailwind.config.js` :

```js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [join(__dirname, 'index.html'), join(__dirname, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['DM Serif Display', 'serif'],
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js` :

```js
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: resolve(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: TypeScript pour le navigateur**

Remplacer `tsconfig.json` par :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Créer `src/vite-env.d.ts` :

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: HTML, styles et logo**

`index.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/jpeg" href="/plai-logo.jpg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LangActif</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css` :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/overrides.css` (chargé en dernier : la règle PLAI de 16 px minimum l'emporte sur les 15 px du guide partagé) :

```css
body {
  font-size: 16px;
}

table.lang-table {
  width: 100%;
  border-collapse: collapse;
}
table.lang-table th,
table.lang-table td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
table.lang-table th {
  font-weight: 600;
  color: var(--text2);
}

.lang-badge {
  display: inline-block;
  font-size: 13px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 20px;
  background: var(--teal-bg);
  color: var(--teal);
  border: 1px solid var(--teal-border);
}
```

Copier les fichiers partagés :

```bash
cp ../shared/css/plai-style.css src/plai-style.css
mkdir -p public && cp ../shared/css/plai-logo.jpg public/plai-logo.jpg
```

- [ ] **Step 7: Point d'entrée minimal (remplacé à la Task 9)**

`src/main.tsx` :

```tsx
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
```

- [ ] **Step 8: Variables d'environnement, aperçu et .gitignore**

`.env.example` :

```
VITE_SUPABASE_URL=https://dfoaumjleqtxjeaplnna.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
```

`.claude/launch.json` :

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "langactif-dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

Ajouter à `.gitignore` les deux lignes `.claude/` et `dist` (si absentes).

- [ ] **Step 9: Vérifier que tout passe**

Run: `npx tsc --noEmit && npm test && npx vite build`
Expected: aucune erreur de typage ; `Tests  137 passed` ; `vite build` se termine par `built in …` avec un dossier `dist/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: socle React, Vite, Tailwind et styles PLAI

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1 : Limites de l'importeur dans un module léger

Le code d'écran doit connaître les limites sans importer `readXlsx` (donc exceljs). On déplace les constantes.

**Files:**
- Create: `src/importer/limits.ts`
- Modify: `src/importer/readXlsx.ts` (en-tête)
- Test: `src/importer/limits.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/importer/limits.test.ts
import { describe, expect, it } from 'vitest';
import { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS } from './limits';
import * as readXlsx from './readXlsx';

describe('limits', () => {
  it('fixe les limites de l\'import', () => {
    expect(MAX_FILE_BYTES).toBe(2_000_000);
    expect(MAX_SHEETS).toBe(40);
    expect(MAX_ROWS).toBe(1000);
    expect(MAX_COLS).toBe(20);
  });

  it('reste réexporté par readXlsx (compatibilité des tests existants)', () => {
    expect(readXlsx.MAX_FILE_BYTES).toBe(MAX_FILE_BYTES);
    expect(readXlsx.MAX_ROWS).toBe(MAX_ROWS);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/importer/limits.test.ts`
Expected: FAIL (`Failed to resolve import "./limits"`).

- [ ] **Step 3: Créer `src/importer/limits.ts`**

```ts
/** Limites de lecture d'un classeur déposé par un utilisateur. */
export const MAX_FILE_BYTES = 2_000_000;
export const MAX_SHEETS = 40;
export const MAX_ROWS = 1000;
export const MAX_COLS = 20;
```

- [ ] **Step 4: Utiliser ce module dans `readXlsx.ts`**

Dans `src/importer/readXlsx.ts`, remplacer les quatre lignes

```ts
export const MAX_FILE_BYTES = 2_000_000;
export const MAX_SHEETS = 40;
export const MAX_ROWS = 1000;
export const MAX_COLS = 20;
```

par

```ts
import { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS } from './limits';

export { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS };
```

(les deux lignes d'import existantes en tête du fichier restent en place, la nouvelle ligne `import` se place avec elles).

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tous les tests passent (139 : les 137 existants plus 2), typage propre.

- [ ] **Step 6: Commit**

```bash
git add src/importer/limits.ts src/importer/limits.test.ts src/importer/readXlsx.ts
git commit -m "refactor(importer): limites dans un module sans exceljs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Schéma Supabase, RLS, grants et import atomique

Cette tâche s'écrit par un sous-agent, mais **l'application du SQL et la vérification RLS sont une action de JF (A1)** : il n'existe pas d'accès SQL automatisé au projet partagé (le `supabase db push` a échoué par le passé à cause de l'historique de migrations commun).

**Files:**
- Create: `supabase/migrations/20261001000000_create_lang_content.sql`
- Create: `supabase/tests/rls_lang_content.sql`

- [ ] **Step 1: Vérifier l'absence de conflit de noms**

Run (Grep, glob `**/migrations/*.sql`, dans tout `claude-workspace`): motif `create table (if not exists )?(public\.)?lang_`
Expected: aucun résultat avant la création du fichier ci-dessous.

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/20261001000000_create_lang_content.sql` :

```sql
-- LangActif : contenu des chapitres (chapitres, listes, mots).
-- Toutes les tables sont préfixées lang_. Ne pas recréer profiles ni le trigger updated_at.

create table if not exists public.lang_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  langue text not null check (langue in ('en-GB', 'nl-BE')),
  niveau text not null,
  titre text not null,
  numero text not null,
  auteur text,
  created_at timestamptz not null default now()
);

create table if not exists public.lang_lists (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.lang_chapters(id) on delete cascade,
  nom text not null,
  position integer not null check (position >= 0),
  unique (chapter_id, position)
);

create table if not exists public.lang_words (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lang_lists(id) on delete cascade,
  position integer not null check (position >= 0),
  fr text not null,
  cible text not null,
  article text check (article in ('de', 'het')),
  synonymes_fr text[] not null default '{}',
  synonymes_cible text[] not null default '{}',
  phrase_cible text,
  phrase_fr text,
  audio_url text,
  unique (list_id, position)
);

create index if not exists lang_chapters_user_id_idx on public.lang_chapters (user_id);
create index if not exists lang_lists_chapter_id_idx on public.lang_lists (chapter_id);
create index if not exists lang_words_list_id_idx on public.lang_words (list_id);

-- Fonctions de propriété en security definer : pas d'auto-référence de politique RLS
-- (incident AménagActif du 2026-09-23).
create or replace function public.lang_owns_chapter(p_chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lang_chapters c
    where c.id = p_chapter and c.user_id = auth.uid()
  );
$$;

create or replace function public.lang_owns_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lang_lists l
    join public.lang_chapters c on c.id = l.chapter_id
    where l.id = p_list and c.user_id = auth.uid()
  );
$$;

revoke all on function public.lang_owns_chapter(uuid) from public;
revoke all on function public.lang_owns_list(uuid) from public;
grant execute on function public.lang_owns_chapter(uuid) to authenticated;
grant execute on function public.lang_owns_list(uuid) to authenticated;

alter table public.lang_chapters enable row level security;
alter table public.lang_lists enable row level security;
alter table public.lang_words enable row level security;

create policy lang_chapters_owner_all on public.lang_chapters
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy lang_lists_owner_all on public.lang_lists
  for all to authenticated
  using (public.lang_owns_chapter(chapter_id))
  with check (public.lang_owns_chapter(chapter_id));

create policy lang_words_owner_all on public.lang_words
  for all to authenticated
  using (public.lang_owns_list(list_id))
  with check (public.lang_owns_list(list_id));

-- Grants Data API (obligatoires pour toute nouvelle table). Pas d'accès anonyme :
-- les élèves passeront par des fonctions serveur (plan 3).
grant select, insert, update, delete on public.lang_chapters to authenticated;
grant select, insert, update, delete on public.lang_lists to authenticated;
grant select, insert, update, delete on public.lang_words to authenticated;
grant select, insert, update, delete on public.lang_chapters to service_role;
grant select, insert, update, delete on public.lang_lists to service_role;
grant select, insert, update, delete on public.lang_words to service_role;

-- Import atomique d'un chapitre : tout ou rien, sous les droits de l'appelant (RLS appliquée).
create or replace function public.lang_import_chapter(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_chapter uuid;
  v_list uuid;
  l jsonb;
  w jsonb;
  li integer := 0;
  wi integer;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if coalesce(jsonb_array_length(p->'lists'), 0) not between 1 and 40 then
    raise exception 'Nombre de listes invalide (1 à 40)';
  end if;

  insert into public.lang_chapters (user_id, langue, niveau, titre, numero, auteur)
  values (auth.uid(), p->>'langue', p->>'niveau', p->>'titre', p->>'numero', nullif(p->>'auteur', ''))
  returning id into v_chapter;

  for l in select value from jsonb_array_elements(p->'lists') loop
    if coalesce(jsonb_array_length(l->'words'), 0) > 1000 then
      raise exception 'Trop de mots dans la liste « % » (maximum 1000)', l->>'nom';
    end if;
    insert into public.lang_lists (chapter_id, nom, position)
    values (v_chapter, l->>'nom', li)
    returning id into v_list;

    wi := 0;
    for w in select value from jsonb_array_elements(l->'words') loop
      insert into public.lang_words
        (list_id, position, fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url)
      values (
        v_list, wi, w->>'fr', w->>'cible', nullif(w->>'article', ''),
        array(select jsonb_array_elements_text(coalesce(w->'synonymes_fr', '[]'::jsonb))),
        array(select jsonb_array_elements_text(coalesce(w->'synonymes_cible', '[]'::jsonb))),
        nullif(w->>'phrase_cible', ''), nullif(w->>'phrase_fr', ''), nullif(w->>'audio_url', '')
      );
      wi := wi + 1;
    end loop;
    li := li + 1;
  end loop;

  return v_chapter;
end;
$$;

revoke all on function public.lang_import_chapter(jsonb) from public;
revoke all on function public.lang_import_chapter(jsonb) from anon;
grant execute on function public.lang_import_chapter(jsonb) to authenticated;
```

- [ ] **Step 3: Écrire le script de vérification RLS (à exécuter par JF)**

`supabase/tests/rls_lang_content.sql` :

```sql
-- Vérification RLS de LangActif. À exécuter dans l'éditeur SQL Supabase, APRÈS la migration.
-- Tout est annulé à la fin (rollback). Une erreur « ... » signale une règle non respectée.
--
-- 1) Remplacer UUID_COMPTE_A ci-dessous par l'identifiant d'un compte enseignant existant :
--      select id, email from auth.users order by created_at desc limit 5;
-- 2) Exécuter tout le script d'un coup. Succès attendu : « Success. No rows returned ».
-- (Une requête lancée sans « set local role » contourne RLS : elle ne prouve rien.)

begin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);

do $$
declare
  v uuid;
begin
  v := public.lang_import_chapter(
    '{"langue":"nl-BE","niveau":"A1","titre":"Test RLS","numero":"99","auteur":null,
      "lists":[{"nom":"Liste test","words":[
        {"fr":"vélo","cible":"fiets","article":"de","synonymes_fr":[],"synonymes_cible":["het rijwiel"],
         "phrase_cible":null,"phrase_fr":null,"audio_url":null}]}]}'::jsonb);
  assert (select count(*) from public.lang_chapters where id = v) = 1, 'A ne voit pas son chapitre';
  assert (select count(*) from public.lang_words w join public.lang_lists l on l.id = w.list_id
          where l.chapter_id = v) = 1, 'A ne voit pas ses mots';
  assert (select synonymes_cible from public.lang_words w join public.lang_lists l on l.id = w.list_id
          where l.chapter_id = v) = array['het rijwiel'], 'synonymes mal enregistrés';
  perform set_config('lang.test_chapter', v::text, true);
end $$;

-- Un autre utilisateur (identifiant inexistant) ne voit rien et ne peut rien modifier.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  v uuid := current_setting('lang.test_chapter')::uuid;
  n integer;
begin
  assert (select count(*) from public.lang_chapters where id = v) = 0, 'B voit le chapitre de A';
  assert (select count(*) from public.lang_lists where chapter_id = v) = 0, 'B voit les listes de A';
  assert (select count(*) from public.lang_words w join public.lang_lists l on l.id = w.list_id
          where l.chapter_id = v) = 0, 'B voit les mots de A';

  begin
    insert into public.lang_lists (chapter_id, nom, position) values (v, 'intrus', 9);
    raise exception 'insertion intruse acceptée dans lang_lists';
  exception when insufficient_privilege then
    null; -- attendu : « new row violates row-level security policy »
  end;

  delete from public.lang_chapters where id = v;
  get diagnostics n = row_count;
  assert n = 0, 'B a supprimé le chapitre de A';
end $$;

-- Anonyme : aucun accès aux tables.
set local role anon;
do $$
begin
  begin
    perform count(*) from public.lang_chapters;
    raise exception 'anon peut lire lang_chapters';
  exception when insufficient_privilege then
    null; -- attendu : permission denied
  end;
end $$;

rollback;
```

- [ ] **Step 4: Commit (fichiers seulement)**

```bash
git add supabase
git commit -m "feat(db): tables lang_*, RLS, grants et import atomique d'un chapitre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5 (A1, JF): appliquer et vérifier**

1. Copier le contenu de la migration dans l'éditeur SQL du projet Supabase partagé et l'exécuter.
2. Remplacer `UUID_COMPTE_A` dans le script de vérification, l'exécuter.
Expected: `Success. No rows returned` aux deux exécutions. Toute autre sortie : arrêter, ne pas passer à la recette, corriger la migration.
Le script rejouable : la migration peut être exécutée deux fois sans erreur (politiques et déclencheurs sont recréés). Le dernier bloc du script de vérification suppose que `anon` n'a aucun droit sur les tables `lang_*`, ce que la migration garantit en révoquant d'abord les privilèges par défaut du projet partagé.

---

### Task 3 : Chapitre analysé vers charge utile de l'import

**Files:**
- Create: `src/lib/importPayload.ts`
- Test: `src/lib/importPayload.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/lib/importPayload.test.ts
import { describe, expect, it } from 'vitest';
import type { ParsedChapter } from '../importer/chapter';
import { toImportPayload } from './importPayload';

const chapter: ParsedChapter = {
  langue: 'nl-BE',
  niveau: 'A1',
  titre: 'Chapitre 4 : Le vélo et la ville',
  numero: '4',
  auteur: null,
  lists: [
    {
      name: 'Liste 4.1',
      words: [
        {
          fr: 'vélo',
          cible: 'fiets',
          article: 'de',
          synonymesFr: ['bicyclette'],
          synonymesCible: ['het rijwiel'],
          phraseCible: 'Ik ga met de fiets naar school.',
          phraseFr: 'Je vais à l\'école à vélo.',
          audioUrl: null,
        },
        { fr: 'courir', cible: 'lopen', article: null, synonymesFr: [], synonymesCible: [], phraseCible: null, phraseFr: null, audioUrl: 'https://exemple.be/lopen.mp3' },
      ],
    },
    { name: 'Liste 4.2', words: [] },
  ],
};

describe('toImportPayload', () => {
  it('met les champs en snake_case, comme la fonction SQL les lit', () => {
    const p = toImportPayload(chapter);
    expect(p).toMatchObject({ langue: 'nl-BE', niveau: 'A1', titre: 'Chapitre 4 : Le vélo et la ville', numero: '4', auteur: null });
    expect(p.lists[0].words[0]).toEqual({
      fr: 'vélo',
      cible: 'fiets',
      article: 'de',
      synonymes_fr: ['bicyclette'],
      synonymes_cible: ['het rijwiel'],
      phrase_cible: 'Ik ga met de fiets naar school.',
      phrase_fr: 'Je vais à l\'école à vélo.',
      audio_url: null,
    });
  });

  it('conserve l\'ordre des listes et des mots, les nulls et l\'audio fourni', () => {
    const p = toImportPayload(chapter);
    expect(p.lists.map((l) => l.nom)).toEqual(['Liste 4.1', 'Liste 4.2']);
    expect(p.lists[0].words.map((w) => w.cible)).toEqual(['fiets', 'lopen']);
    expect(p.lists[0].words[1].article).toBeNull();
    expect(p.lists[0].words[1].audio_url).toBe('https://exemple.be/lopen.mp3');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/importPayload.test.ts`
Expected: FAIL (`Failed to resolve import "./importPayload"`).

- [ ] **Step 3: Implémenter `src/lib/importPayload.ts`**

```ts
import type { Article } from '../engine/types';
import type { ParsedChapter } from '../importer/chapter';

export interface ImportWordPayload {
  fr: string;
  cible: string;
  article: Article | null;
  synonymes_fr: string[];
  synonymes_cible: string[];
  phrase_cible: string | null;
  phrase_fr: string | null;
  audio_url: string | null;
}

export interface ImportListPayload {
  nom: string;
  words: ImportWordPayload[];
}

export interface ImportPayload {
  langue: string;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  lists: ImportListPayload[];
}

/** Charge utile lue par la fonction SQL `lang_import_chapter`. */
export function toImportPayload(chapter: ParsedChapter): ImportPayload {
  return {
    langue: chapter.langue,
    niveau: chapter.niveau,
    titre: chapter.titre,
    numero: chapter.numero,
    auteur: chapter.auteur,
    lists: chapter.lists.map((list) => ({
      nom: list.name,
      words: list.words.map((w) => ({
        fr: w.fr,
        cible: w.cible,
        article: w.article,
        synonymes_fr: w.synonymesFr,
        synonymes_cible: w.synonymesCible,
        phrase_cible: w.phraseCible,
        phrase_fr: w.phraseFr,
        audio_url: w.audioUrl,
      })),
    })),
  };
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/lib/importPayload.test.ts && npx tsc --noEmit`
Expected: PASS (2 tests), typage propre.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importPayload.ts src/lib/importPayload.test.ts
git commit -m "feat(lib): charge utile de l'import d'un chapitre

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Accès aux données des chapitres

**Files:**
- Create: `src/lib/chapters.ts`, `src/lib/supabase.ts`
- Test: `src/lib/chapters.test.ts`

`supabase.ts` crée le client à partir de l'environnement ; il lève une erreur si les variables manquent, donc **il n'est importé que par `App.tsx` et `useSession.ts`**, jamais par `chapters.ts` (qui reçoit le client en paramètre, ce qui le rend testable avec un faux client).

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/lib/chapters.test.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { deleteChapter, getChapter, importChapter, listChapters, sortChapterDetail, type ChapterDetail } from './chapters';
import type { ImportPayload } from './importPayload';

const asClient = (fake: unknown) => fake as SupabaseClient;

describe('listChapters', () => {
  it('renvoie le nombre de listes de chaque chapitre', async () => {
    const rows = [
      { id: 'c1', langue: 'nl-BE', niveau: 'A1', titre: 'Le vélo', numero: '4', created_at: '2026-10-01', lang_lists: [{ count: 3 }] },
      { id: 'c2', langue: 'en-GB', niveau: 'A2', titre: 'Town', numero: '1', created_at: '2026-09-30', lang_lists: [] },
    ];
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }) });
    const out = await listChapters(client);
    expect(out.map((c) => [c.id, c.listsCount])).toEqual([['c1', 3], ['c2', 0]]);
  });

  it('lève une erreur lisible', async () => {
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) });
    await expect(listChapters(client)).rejects.toThrow('permission denied');
  });
});

describe('sortChapterDetail', () => {
  it('trie les listes et les mots par position', () => {
    const raw: ChapterDetail = {
      id: 'c', langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, created_at: 'x',
      lists: [
        { id: 'l2', nom: 'B', position: 1, words: [] },
        {
          id: 'l1', nom: 'A', position: 0,
          words: [
            { id: 'w2', position: 1, fr: 'b', cible: 'b', article: null, synonymes_fr: [], synonymes_cible: [], phrase_cible: null, phrase_fr: null, audio_url: null },
            { id: 'w1', position: 0, fr: 'a', cible: 'a', article: null, synonymes_fr: [], synonymes_cible: [], phrase_cible: null, phrase_fr: null, audio_url: null },
          ],
        },
      ],
    };
    const sorted = sortChapterDetail(raw);
    expect(sorted.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(sorted.lists[0].words.map((w) => w.id)).toEqual(['w1', 'w2']);
  });
});

describe('getChapter', () => {
  it('renvoie le chapitre trié', async () => {
    const row = { id: 'c', langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, created_at: 'x',
      lang_lists: [{ id: 'l2', nom: 'B', position: 1, lang_words: [] }, { id: 'l1', nom: 'A', position: 0, lang_words: [] }] };
    const client = asClient({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }) });
    const out = await getChapter(client, 'c');
    expect(out.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

describe('importChapter', () => {
  const payload: ImportPayload = { langue: 'nl-BE', niveau: 'A1', titre: 't', numero: '1', auteur: null, lists: [] };

  it('appelle la fonction SQL et renvoie l\'identifiant', async () => {
    let called: { fn: string; args: unknown } | null = null;
    const client = asClient({ rpc: async (fn: string, args: unknown) => { called = { fn, args }; return { data: 'new-id', error: null }; } });
    expect(await importChapter(client, payload)).toBe('new-id');
    expect(called).toEqual({ fn: 'lang_import_chapter', args: { p: payload } });
  });

  it('lève l\'erreur de la base', async () => {
    const client = asClient({ rpc: async () => ({ data: null, error: { message: 'Nombre de listes invalide (1 à 40)' } }) });
    await expect(importChapter(client, payload)).rejects.toThrow('Nombre de listes invalide');
  });
});

describe('deleteChapter', () => {
  it('supprime par identifiant', async () => {
    let eqArgs: unknown[] = [];
    const client = asClient({ from: () => ({ delete: () => ({ eq: async (...a: unknown[]) => { eqArgs = a; return { error: null }; } }) }) });
    await deleteChapter(client, 'c9');
    expect(eqArgs).toEqual(['id', 'c9']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/chapters.test.ts`
Expected: FAIL (`Failed to resolve import "./chapters"`).

- [ ] **Step 3: Implémenter `src/lib/chapters.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Article, Langue } from '../engine/types';
import type { ImportPayload } from './importPayload';

export interface ChapterSummary {
  id: string;
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  created_at: string;
  listsCount: number;
}

export interface WordRow {
  id: string;
  position: number;
  fr: string;
  cible: string;
  article: Article | null;
  synonymes_fr: string[];
  synonymes_cible: string[];
  phrase_cible: string | null;
  phrase_fr: string | null;
  audio_url: string | null;
}

export interface ListRow {
  id: string;
  nom: string;
  position: number;
  words: WordRow[];
}

export interface ChapterDetail {
  id: string;
  langue: Langue;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  created_at: string;
  lists: ListRow[];
}

type SummaryRow = Omit<ChapterSummary, 'listsCount'> & { lang_lists: Array<{ count: number }> };
type DetailRow = Omit<ChapterDetail, 'lists'> & {
  lang_lists: Array<{ id: string; nom: string; position: number; lang_words: WordRow[] }>;
};

export async function listChapters(client: SupabaseClient): Promise<ChapterSummary[]> {
  const { data, error } = await client
    .from('lang_chapters')
    .select('id, langue, niveau, titre, numero, created_at, lang_lists(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SummaryRow[]).map(({ lang_lists, ...rest }) => ({
    ...rest,
    listsCount: lang_lists[0]?.count ?? 0,
  }));
}

/** Listes et mots dans l'ordre de l'Excel (la base ne garantit pas l'ordre des imbrications). */
export function sortChapterDetail(chapter: ChapterDetail): ChapterDetail {
  return {
    ...chapter,
    lists: [...chapter.lists]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ ...l, words: [...l.words].sort((a, b) => a.position - b.position) })),
  };
}

export async function getChapter(client: SupabaseClient, id: string): Promise<ChapterDetail> {
  const { data, error } = await client
    .from('lang_chapters')
    .select(
      'id, langue, niveau, titre, numero, auteur, created_at, ' +
        'lang_lists(id, nom, position, lang_words(id, position, fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url))',
    )
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const { lang_lists, ...rest } = data as unknown as DetailRow;
  return sortChapterDetail({
    ...rest,
    lists: lang_lists.map(({ lang_words, ...list }) => ({ ...list, words: lang_words })),
  });
}

/** Import atomique : la fonction SQL crée chapitre, listes et mots en une transaction. */
export async function importChapter(client: SupabaseClient, payload: ImportPayload): Promise<string> {
  const { data, error } = await client.rpc('lang_import_chapter', { p: payload });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteChapter(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('lang_chapters').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Créer `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables Supabase manquantes : copier .env.example vers .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 5: Vérifier le succès**

Run: `npx vitest run src/lib/chapters.test.ts && npx tsc --noEmit`
Expected: PASS (6 tests), typage propre.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chapters.ts src/lib/chapters.test.ts src/lib/supabase.ts
git commit -m "feat(lib): accès aux chapitres (liste, détail, import atomique, suppression)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Messages lisibles (erreurs d'import, erreurs de lecture)

**Files:**
- Create: `src/lib/formatIssue.ts`, `src/lib/readError.ts`, `src/lib/labels.ts`
- Test: `src/lib/formatIssue.test.ts`, `src/lib/readError.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/lib/formatIssue.test.ts
import { describe, expect, it } from 'vitest';
import { formatIssue } from './formatIssue';
import { langueLabel } from './labels';

describe('formatIssue', () => {
  it('indique feuille, ligne et colonne', () => {
    expect(formatIssue({ sheet: 'Liste 4.1', row: 3, column: 'article', message: 'Article absent ou invalide' }))
      .toBe('Feuille « Liste 4.1 », ligne 3, colonne « article » : Article absent ou invalide');
  });
  it('omet la ligne et la colonne quand elles sont inconnues', () => {
    expect(formatIssue({ sheet: 'Méta', row: null, column: null, message: 'Aucune feuille de liste dans le classeur' }))
      .toBe('Feuille « Méta » : Aucune feuille de liste dans le classeur');
  });
  it('omet seulement la colonne si elle manque', () => {
    expect(formatIssue({ sheet: 'L', row: 5, column: null, message: 'x' })).toBe('Feuille « L », ligne 5 : x');
  });
});

describe('langueLabel', () => {
  it('donne un libellé lisible', () => {
    expect(langueLabel('nl-BE')).toBe('Néerlandais (Belgique)');
    expect(langueLabel('en-GB')).toBe('Anglais (Royaume-Uni)');
  });
});
```

```ts
// src/lib/readError.test.ts
import { describe, expect, it } from 'vitest';
import { friendlyReadError } from './readError';

describe('friendlyReadError', () => {
  it('garde les messages de limite de l\'importeur', () => {
    expect(friendlyReadError('Fichier trop volumineux (maximum 2 Mo)')).toBe('Fichier trop volumineux (maximum 2 Mo)');
    expect(friendlyReadError('Trop de feuilles (maximum 40)')).toBe('Trop de feuilles (maximum 40)');
    expect(friendlyReadError('Feuille « Liste 1 » : plus de 1000 lignes')).toBe('Feuille « Liste 1 » : plus de 1000 lignes');
  });
  it('remplace une erreur technique par un message clair', () => {
    expect(friendlyReadError("Can't find end of central directory : is this a zip file ?"))
      .toBe('Ce fichier n\'est pas un classeur Excel (.xlsx) lisible. Enregistrez-le à nouveau depuis Excel.');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/formatIssue.test.ts src/lib/readError.test.ts`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implémenter**

`src/lib/labels.ts` :

```ts
import type { Langue } from '../engine/types';

const LABELS: Record<Langue, string> = {
  'nl-BE': 'Néerlandais (Belgique)',
  'en-GB': 'Anglais (Royaume-Uni)',
};

export function langueLabel(langue: Langue): string {
  return LABELS[langue];
}
```

`src/lib/formatIssue.ts` :

```ts
import type { ImportIssue } from '../importer/chapter';

/** « Feuille « Liste 4.1 », ligne 3, colonne « article » : message » */
export function formatIssue(issue: ImportIssue): string {
  let where = `Feuille « ${issue.sheet} »`;
  if (issue.row !== null) where += `, ligne ${issue.row}`;
  if (issue.column !== null) where += `, colonne « ${issue.column} »`;
  return `${where} : ${issue.message}`;
}
```

`src/lib/readError.ts` :

```ts
const KNOWN = /^(Fichier trop volumineux|Trop de feuilles|Feuille «)/;

/** Les messages de limite de l'importeur sont déjà en français ; le reste vient d'exceljs (technique, en anglais). */
export function friendlyReadError(message: string): string {
  if (KNOWN.test(message)) return message;
  return 'Ce fichier n\'est pas un classeur Excel (.xlsx) lisible. Enregistrez-le à nouveau depuis Excel.';
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run src/lib && npx tsc --noEmit`
Expected: PASS (tous les tests de `src/lib`), typage propre.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatIssue.ts src/lib/formatIssue.test.ts src/lib/readError.ts src/lib/readError.test.ts src/lib/labels.ts
git commit -m "feat(lib): messages lisibles pour les erreurs d'import et de lecture

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Lecture du fichier dans un Web Worker avec délai maximal

**Files:**
- Create: `src/workers/readXlsx.worker.ts`, `src/lib/readXlsxInWorker.ts`
- Test: `src/lib/readXlsxInWorker.test.ts` (la partie pure seulement)

Le Worker et son délai ne se testent pas sous Node : ils sont vérifiés dans le navigateur à la recette (Task 11, étape 6). La partie pure (`checkFileBeforeRead`) est testée.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/lib/readXlsxInWorker.test.ts
import { describe, expect, it } from 'vitest';
import { checkFileBeforeRead } from './readXlsxInWorker';

describe('checkFileBeforeRead', () => {
  it('accepte un .xlsx de taille raisonnable', () => {
    expect(checkFileBeforeRead({ name: 'chapitre4.xlsx', size: 50_000 })).toBeNull();
    expect(checkFileBeforeRead({ name: 'CHAPITRE4.XLSX', size: 50_000 })).toBeNull();
  });
  it('refuse les autres formats', () => {
    expect(checkFileBeforeRead({ name: 'chapitre4.xls', size: 1000 })).toContain('.xlsx');
    expect(checkFileBeforeRead({ name: 'chapitre4.csv', size: 1000 })).toContain('.xlsx');
  });
  it('refuse un fichier vide ou trop gros', () => {
    expect(checkFileBeforeRead({ name: 'a.xlsx', size: 0 })).toContain('vide');
    expect(checkFileBeforeRead({ name: 'a.xlsx', size: 2_000_001 })).toContain('volumineux');
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/readXlsxInWorker.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter le Worker**

`src/workers/readXlsx.worker.ts` :

```ts
import { readWorkbook } from '../importer/readXlsx';
import { friendlyReadError } from '../lib/readError';

// Le typage DOM déclare `self` comme Window : on restreint à ce dont le Worker a besoin.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = async (e) => {
  try {
    const workbook = await readWorkbook(e.data);
    ctx.postMessage({ ok: true, workbook });
  } catch (err) {
    ctx.postMessage({ ok: false, error: friendlyReadError(err instanceof Error ? err.message : '') });
  }
};
```

- [ ] **Step 4: Implémenter le client**

`src/lib/readXlsxInWorker.ts` :

```ts
import type { RawWorkbook } from '../importer/chapter';
import { MAX_FILE_BYTES } from '../importer/limits';

export const READ_TIMEOUT_MS = 15_000;

/** Contrôles rapides avant d'ouvrir le fichier ; renvoie un message ou null. */
export function checkFileBeforeRead(file: { name: string; size: number }): string | null {
  if (!/\.xlsx$/i.test(file.name)) return 'Format non pris en charge : enregistrez le fichier au format Excel .xlsx.';
  if (file.size === 0) return 'Le fichier est vide.';
  if (file.size > MAX_FILE_BYTES) return 'Fichier trop volumineux (maximum 2 Mo).';
  return null;
}

type WorkerReply = { ok: true; workbook: RawWorkbook } | { ok: false; error: string };

/**
 * Lit le classeur hors du fil principal ; le Worker est arrêté au bout de `timeoutMs`
 * (protège l'onglet contre un fichier qui prend un temps déraisonnable).
 */
export async function readXlsxInWorker(file: File, timeoutMs = READ_TIMEOUT_MS): Promise<RawWorkbook> {
  const problem = checkFileBeforeRead(file);
  if (problem) throw new Error(problem);
  const buffer = await file.arrayBuffer();

  return new Promise<RawWorkbook>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/readXlsx.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Lecture trop longue (plus de 15 secondes) : fichier refusé.'));
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      finish();
      if (e.data.ok) resolve(e.data.workbook);
      else reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Impossible de lire ce fichier Excel.'));
    };
    worker.postMessage(buffer, [buffer]);
  });
}
```

- [ ] **Step 5: Vérifier le succès**

Run: `npx vitest run src/lib/readXlsxInWorker.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests), typage propre.

- [ ] **Step 6: Commit**

```bash
git add src/workers/readXlsx.worker.ts src/lib/readXlsxInWorker.ts src/lib/readXlsxInWorker.test.ts
git commit -m "feat(lib): lecture du classeur dans un Web Worker avec délai maximal

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Modèle Excel téléchargeable

**Files:**
- Create: `src/importer/template.ts`
- Test: `src/importer/template.test.ts`
- Modify: `src/importer/index.ts` (ajouter l'export)

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/importer/template.test.ts
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { readWorkbook } from './readXlsx';
import { buildTemplate } from './template';

describe('buildTemplate', () => {
  it('produit un modèle néerlandais avec la colonne article', async () => {
    const raw = await readWorkbook(await buildTemplate('nl-BE'));
    expect(raw.hasMeta).toBe(true);
    expect(raw.meta.langue).toBe('nl-BE');
    expect(raw.lists).toHaveLength(1);
    expect(raw.lists[0].header).toEqual([
      'fr', 'cible', 'article', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url',
    ]);
    expect(raw.lists[0].rows).toEqual([]);
  });

  it('produit un modèle anglais sans colonne article', async () => {
    const raw = await readWorkbook(await buildTemplate('en-GB'));
    expect(raw.meta.langue).toBe('en-GB');
    expect(raw.lists[0].header).toEqual(['fr', 'cible', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url']);
  });

  it('n\'est pas importable tel quel : les champs à remplir sont signalés', async () => {
    const result = parseChapter(await readWorkbook(await buildTemplate('nl-BE')));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const columns = result.issues.map((i) => i.column);
    expect(columns).toEqual(expect.arrayContaining(['niveau', 'titre', 'numero']));
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/importer/template.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `src/importer/template.ts`**

```ts
import ExcelJS from 'exceljs';
import type { Langue } from '../engine/types';

const HEADERS_NL = ['fr', 'cible', 'article', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url'];
const HEADERS_EN = ['fr', 'cible', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url'];

// L'aide est portée par des notes de cellule : une ligne d'exemple serait importée comme un mot,
// une feuille d'aide visible serait lue comme une liste.
const COLUMN_HELP: Record<string, string> = {
  fr: 'Le mot en français, comme dans la liste du manuel. Exemple : vélo',
  cible: 'Le mot dans la langue apprise, SANS article. Exemple : fiets',
  article: 'Néerlandais seulement : de ou het. Écrire « - » si le mot n\'a pas d\'article (verbe, adjectif).',
  synonymes_fr: 'Autres traductions françaises acceptées, séparées par « ; » (jamais par une virgule). Exemple : bicyclette',
  synonymes_cible: 'Autres traductions acceptées dans la langue apprise, séparées par « ; ». En néerlandais, chaque synonyme s\'écrit AVEC son article. Exemple : het rijwiel',
  phrase_cible: 'Phrase exemple facultative dans la langue apprise. Si elle est remplie, remplir aussi phrase_fr.',
  phrase_fr: 'Traduction française de la phrase exemple. Obligatoire si phrase_cible est remplie.',
  audio_url: 'Facultatif : adresse d\'un fichier audio que vous possédez déjà. Laisser vide pour une génération automatique plus tard.',
};

const META_HELP: Record<string, string> = {
  langue: 'Ne pas modifier : en-GB (anglais) ou nl-BE (néerlandais de Belgique).',
  niveau: 'Niveau visé par le chapitre. Exemple : A1',
  titre: 'Titre du chapitre. Exemple : Chapitre 4 : Le vélo et la ville',
  numero: 'Numéro du chapitre dans le manuel. Exemple : 4',
  auteur: 'Facultatif : votre nom ou vos initiales.',
};

/** Classeur vide : feuille « Méta » et une feuille de liste, avec l'aide en notes d'en-tête. */
export async function buildTemplate(langue: Langue): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();

  const meta = wb.addWorksheet('Méta');
  const metaRows: Array<[string, string]> = [
    ['langue', langue],
    ['niveau', ''],
    ['titre', ''],
    ['numero', ''],
    ['auteur', ''],
  ];
  for (const [key, value] of metaRows) {
    const row = meta.addRow([key, value]);
    row.getCell(1).note = META_HELP[key];
    row.getCell(1).font = { bold: true };
  }
  meta.getColumn(1).width = 14;
  meta.getColumn(2).width = 44;

  const list = wb.addWorksheet('Liste 1');
  const headers = langue === 'nl-BE' ? HEADERS_NL : HEADERS_EN;
  const header = list.addRow(headers);
  headers.forEach((name, i) => {
    const cell = header.getCell(i + 1);
    cell.note = COLUMN_HELP[name];
    cell.font = { bold: true };
    list.getColumn(i + 1).width = name.startsWith('phrase') ? 38 : 18;
  });
  list.views = [{ state: 'frozen', ySplit: 1 }];

  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
```

- [ ] **Step 4: Exporter depuis l'index de l'importeur**

Ajouter la ligne `export * from './template';` à `src/importer/index.ts`.

- [ ] **Step 5: Vérifier le succès**

Run: `npx vitest run src/importer && npx tsc --noEmit`
Expected: PASS (tous les tests de l'importeur, dont 3 nouveaux), typage propre.

- [ ] **Step 6: Commit**

```bash
git add src/importer/template.ts src/importer/template.test.ts src/importer/index.ts
git commit -m "feat(importer): modèle Excel téléchargeable avec aide en notes d'en-tête

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Cadre PLAI, champ guidé, connexion

Cette tâche n'a pas de test unitaire (composants d'interface) : sa vérification est visuelle, Task 10. Les trois composants suivent le modèle de LexiActif (`Auth`, `FormField`) et les consignes PLAI : cadre `plai-nav` / `plai-container` / `plai-footer`, logo à hauteur fixe seulement, aide sous chaque champ.

**Files:**
- Create: `src/components/Layout.tsx`, `src/components/FormField.tsx`, `src/components/Auth.tsx`, `src/lib/useSession.ts`

- [ ] **Step 1: `src/lib/useSession.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, passwordRecovery, clearPasswordRecovery: () => setPasswordRecovery(false) };
}
```

- [ ] **Step 2: `src/components/FormField.tsx`**

```tsx
import { cloneElement, useId, type CSSProperties, type ReactElement } from 'react';

type FieldChildProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  required?: boolean;
};

interface FormFieldProps {
  label: string;
  /** Texte d'aide sous le champ : portée et effet de la saisie. */
  help?: string;
  error?: string;
  required?: boolean;
  style?: CSSProperties;
  children: ReactElement<FieldChildProps>;
}

export function FormField({ label, help, error, required, style, children }: FormFieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const field = cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    required: required || children.props.required,
  });

  return (
    <div className="plai-field" style={style}>
      <label className="plai-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {field}
      {help && (
        <p id={helpId} style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>
          {help}
        </p>
      )}
      {error && (
        <div id={errorId} className="plai-error" role="alert" style={{ marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/Layout.tsx`**

```tsx
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
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>{userEmail}</span>
            <button type="button" className="plai-nav-link" style={{ fontSize: 14 }} onClick={onSignOut}>
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
```

- [ ] **Step 4: `src/components/Auth.tsx`**

```tsx
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
```

- [ ] **Step 5: Vérifier le typage**

Run: `npx tsc --noEmit`
Expected: aucune sortie. (`App.tsx` n'existe pas encore : ces fichiers ne sont pas encore importés, le typage doit tout de même passer.)

- [ ] **Step 6: Commit**

```bash
git add src/components src/lib/useSession.ts
git commit -m "feat(ui): cadre PLAI, champ guidé et connexion enseignant

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Écrans enseignant et navigation

**Files:**
- Create: `src/components/ChapterList.tsx`, `src/components/ChapterDetail.tsx`, `src/components/ImportChapter.tsx`, `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: `src/components/ChapterList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listChapters, type ChapterSummary } from '../lib/chapters';
import { langueLabel } from '../lib/labels';

interface Props {
  client: SupabaseClient;
  onOpen: (id: string) => void;
  onImport: () => void;
}

export function ChapterList({ client, onOpen, onImport }: Props) {
  const [chapters, setChapters] = useState<ChapterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listChapters(client)
      .then((c) => alive && setChapters(c))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 className="font-serif" style={{ fontSize: 26 }}>Mes chapitres</h1>
        <button type="button" className="plai-btn" onClick={onImport}>Importer un chapitre</button>
      </div>

      {error && <div className="plai-error" role="alert">Impossible de charger vos chapitres : {error}</div>}
      {!error && chapters === null && <p aria-live="polite">Chargement...</p>}
      {chapters !== null && chapters.length === 0 && (
        <p className="plai-empty">
          Aucun chapitre pour l'instant. Importez un classeur Excel : un chapitre = un classeur, une feuille par liste de vocabulaire.
        </p>
      )}
      {chapters?.map((c) => (
        <button
          key={c.id}
          type="button"
          className="plai-card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() => onOpen(c.id)}
        >
          <strong>{c.numero}. {c.titre}</strong>
          <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="lang-badge">{langueLabel(c.langue)}</span>
            <span style={{ color: 'var(--text2)' }}>Niveau {c.niveau}</span>
            <span style={{ color: 'var(--text2)' }}>{c.listsCount} {c.listsCount > 1 ? 'listes' : 'liste'}</span>
          </div>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: `src/components/ChapterDetail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteChapter, getChapter, type ChapterDetail as Detail } from '../lib/chapters';
import { langueLabel } from '../lib/labels';

interface Props {
  client: SupabaseClient;
  id: string;
  onBack: () => void;
}

export function ChapterDetail({ client, id, onBack }: Props) {
  const [chapter, setChapter] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    getChapter(client, id)
      .then((c) => alive && setChapter(c))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client, id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteChapter(client, id);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.');
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <section>
        <div className="plai-error" role="alert">{error}</div>
        <button type="button" className="plai-btn-ghost" onClick={onBack}>Retour</button>
      </section>
    );
  }
  if (!chapter) return <p aria-live="polite">Chargement...</p>;

  const wordCount = chapter.lists.reduce((n, l) => n + l.words.length, 0);

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onBack} style={{ marginBottom: '1rem' }}>Retour aux chapitres</button>
      <h1 className="font-serif" style={{ fontSize: 26 }}>{chapter.numero}. {chapter.titre}</h1>
      <div style={{ margin: '8px 0 1.25rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="lang-badge">{langueLabel(chapter.langue)}</span>
        <span style={{ color: 'var(--text2)' }}>Niveau {chapter.niveau}</span>
        <span style={{ color: 'var(--text2)' }}>{chapter.lists.length} listes, {wordCount} mots</span>
      </div>

      {chapter.lists.map((list) => (
        <div key={list.id} className="plai-card" style={{ overflowX: 'auto' }}>
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>{list.nom} ({list.words.length} mots)</h2>
          <table className="lang-table">
            <thead>
              <tr>
                <th scope="col">Français</th>
                <th scope="col">Langue cible</th>
                <th scope="col">Synonymes</th>
                <th scope="col">Phrase exemple</th>
              </tr>
            </thead>
            <tbody>
              {list.words.map((w) => (
                <tr key={w.id}>
                  <td>{w.fr}</td>
                  <td>{w.article ? `${w.article} ${w.cible}` : w.cible}</td>
                  <td>{[...w.synonymes_fr, ...w.synonymes_cible].join(' ; ')}</td>
                  <td>{w.phrase_cible ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="plai-card" style={{ marginTop: '1.5rem' }}>
        <h2 className="font-serif" style={{ fontSize: 18, marginBottom: 8 }}>Supprimer ce chapitre</h2>
        {!confirming ? (
          <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(true)}>Supprimer le chapitre</button>
        ) : (
          <div role="alert">
            <p style={{ marginBottom: 10 }}>
              Supprimer définitivement « {chapter.titre} » ({chapter.lists.length} listes, {wordCount} mots) ? Cette action ne peut pas être annulée.
            </p>
            <button type="button" className="plai-btn" onClick={remove} disabled={deleting} style={{ marginRight: 8 }}>
              {deleting ? 'Suppression...' : 'Oui, supprimer'}
            </button>
            <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Annuler</button>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `src/components/ImportChapter.tsx`**

```tsx
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { parseChapter, type ImportIssue, type ParsedChapter } from '../importer/chapter';
import { importChapter } from '../lib/chapters';
import { formatIssue } from '../lib/formatIssue';
import { toImportPayload } from '../lib/importPayload';
import { langueLabel } from '../lib/labels';
import { readXlsxInWorker } from '../lib/readXlsxInWorker';
import { FormField } from './FormField';

interface Props {
  client: SupabaseClient;
  onDone: (chapterId: string) => void;
  onCancel: () => void;
}

type Parsed = { chapter: ParsedChapter; warnings: ImportIssue[] };

export function ImportChapter({ client, onDone, onCancel }: Props) {
  const [templateLangue, setTemplateLangue] = useState<Langue>('nl-BE');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    // chargement différé : exceljs n'est téléchargé que si l'enseignant demande le modèle
    const { buildTemplate } = await import('../importer/template');
    const buffer = await buildTemplate(templateLangue);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `modele-langactif-${templateLangue}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setIssues([]);
    setReadError(null);
    setSaveError(null);
    if (!file) return;
    setReading(true);
    try {
      const result = parseChapter(await readXlsxInWorker(file));
      if (result.ok) setParsed({ chapter: result.chapter, warnings: result.warnings });
      else setIssues(result.issues);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Lecture impossible.');
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (!parsed) return;
    setSaving(true);
    setSaveError(null);
    try {
      onDone(await importChapter(client, toImportPayload(parsed.chapter)));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const wordCount = parsed ? parsed.chapter.lists.reduce((n, l) => n + l.words.length, 0) : 0;

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onCancel} style={{ marginBottom: '1rem' }}>Retour aux chapitres</button>
      <h1 className="font-serif" style={{ fontSize: 26, marginBottom: '1rem' }}>Importer un chapitre</h1>

      <div className="plai-card">
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>1. Télécharger le modèle</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
          Un chapitre = un classeur Excel. La feuille « Méta » décrit le chapitre, puis chaque feuille est une liste de vocabulaire du manuel.
          Survolez les en-têtes de colonnes dans Excel pour lire l'aide de chaque colonne.
        </p>
        <FormField label="Langue du chapitre" help="Le néerlandais ajoute la colonne « article » (de ou het), obligatoire pour les noms.">
          <select className="plai-input" value={templateLangue} onChange={(e) => setTemplateLangue(e.target.value as Langue)}>
            <option value="nl-BE">{langueLabel('nl-BE')}</option>
            <option value="en-GB">{langueLabel('en-GB')}</option>
          </select>
        </FormField>
        <button type="button" className="plai-btn-ghost" onClick={downloadTemplate}>Télécharger le modèle Excel</button>
      </div>

      <div className="plai-card">
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>2. Choisir votre classeur rempli</h2>
        <FormField
          label="Classeur Excel (.xlsx)"
          help="2 Mo maximum. Le fichier est vérifié dans votre navigateur ; rien n'est enregistré avant votre confirmation à l'étape suivante."
        >
          <input className="plai-input" type="file" accept=".xlsx" onChange={(e) => onFile(e.target.files?.[0])} />
        </FormField>
        {reading && <p aria-live="polite">Lecture du fichier...</p>}
        {readError && <div className="plai-error" role="alert">{readError}</div>}
        {issues.length > 0 && (
          <div className="plai-error" role="alert">
            <strong>{issues.length} {issues.length > 1 ? 'problèmes empêchent' : 'problème empêche'} l'import. Corrigez le classeur puis choisissez-le à nouveau :</strong>
            <ul style={{ marginTop: 6, paddingLeft: '1.25rem' }}>
              {issues.map((issue, i) => (
                <li key={i}>{formatIssue(issue)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {parsed && (
        <div className="plai-card">
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>3. Vérifier et enregistrer</h2>
          <p>
            <strong>{parsed.chapter.numero}. {parsed.chapter.titre}</strong>
          </p>
          <p style={{ color: 'var(--text2)', margin: '4px 0 10px' }}>
            {langueLabel(parsed.chapter.langue)}, niveau {parsed.chapter.niveau} : {parsed.chapter.lists.length} listes, {wordCount} mots
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: 12 }}>
            {parsed.chapter.lists.map((l) => (
              <li key={l.name}>{l.name} : {l.words.length} mots</li>
            ))}
          </ul>
          {parsed.warnings.length > 0 && (
            <div className="plai-success" role="status" style={{ background: '#fff8e6', borderColor: '#e0b43a', color: '#7a5a00' }}>
              <strong>À vérifier (n'empêche pas l'enregistrement) :</strong>
              <ul style={{ marginTop: 6, paddingLeft: '1.25rem' }}>
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{formatIssue(w)}</li>
                ))}
              </ul>
            </div>
          )}
          {saveError && <div className="plai-error" role="alert">{saveError}</div>}
          <button type="button" className="plai-btn" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer le chapitre'}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: `src/App.tsx`**

```tsx
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
```

- [ ] **Step 5: Brancher l'application dans `src/main.tsx`**

Remplacer le contenu de `src/main.tsx` par :

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './plai-style.css';
import './overrides.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Vérifier typage, tests et build**

Run: `npx tsc --noEmit && npm test && npx vite build`
Expected: typage propre ; tous les tests passent ; `vite build` réussit.

Contrôle de découpage du bundle : dans la sortie de `vite build`, le fichier principal `assets/index-*.js` ne doit **pas** contenir exceljs (taille raisonnable, de l'ordre de quelques centaines de ko au plus) ; exceljs doit apparaître dans un fichier séparé (le Worker) et dans un chunk chargé à la demande (le modèle). Si le fichier principal dépasse 1 Mo, chercher un import de `../importer` (l'index) ou de `../importer/readXlsx` dans un fichier de `src/components` ou `src/lib` et le remplacer par `../importer/chapter` ou `../importer/limits`.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(ui): liste, détail et import de chapitres

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Vérification visuelle (contrôleur, sans compte)

Faite par la session qui orchestre, avec les outils d'aperçu. Elle couvre ce qui est visible sans connexion : le cadre PLAI et l'écran de connexion. Elle n'utilise **pas** de compte et n'envoie rien à Supabase : le client est créé avec des valeurs factices, aucune requête n'est émise tant que personne ne se connecte.

- [ ] **Step 1: Valeurs factices pour l'aperçu**

Créer `.env.local` (ignoré par git) :

```
VITE_SUPABASE_URL=https://exemple.invalid
VITE_SUPABASE_ANON_KEY=cle-factice-pour-apercu
```

- [ ] **Step 2: Lancer l'aperçu**

`preview_start` avec le nom `langactif-dev`, puis ouvrir la page.

- [ ] **Step 3: Contrôles**

- `read_console_messages` (erreurs seulement) : aucune erreur d'exécution.
- `read_page` : on voit `Connexion enseignant`, deux champs avec libellé et texte d'aide, le bouton `Se connecter`, la barre de navigation `LangActif`, le pied de page avec le courriel de contact.
- `javascript_tool` : `document.querySelector('.plai-nav img').getBoundingClientRect()` donne une largeur égale à environ 2,56 fois la hauteur (32 px), preuve que le logo n'est pas déformé. Même contrôle sur le logo du pied de page (hauteur 40 px).
- `javascript_tool` : `getComputedStyle(document.body).fontSize` vaut `16px`.
- `resize_window` en `mobile` (375 px) : pas de défilement horizontal de la page, les champs et boutons restent utilisables ; rétablir ensuite `desktop`.
- Capture d'écran pour preuve.

- [ ] **Step 4: Nettoyer**

`preview_stop`. Le fichier `.env.local` factice sera remplacé par JF (A2) : le laisser, il est ignoré par git.

Si un contrôle échoue : corriger le composant concerné (Layout, Auth, `overrides.css`), relancer `npx tsc --noEmit && npm test && npx vite build`, committer la correction.

---

### Task 11 : Recette par JF, build et déploiement

- [ ] **Step 1 (A1) : base prête.** Migration appliquée et script RLS réussi (Task 2, Step 5).

- [ ] **Step 2 (A2) : clé anon.** Remplacer les valeurs factices de `.env.local` par `VITE_SUPABASE_URL=https://dfoaumjleqtxjeaplnna.supabase.co` et la vraie clé publique `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 3 (A4) : redirections Supabase.** Ajouter `http://localhost:5173` aux Redirect URLs.

- [ ] **Step 4: Lancer l'application.** `npm run dev`, ouvrir `http://localhost:5173`.

- [ ] **Step 5 (A3) : connexion.** Se connecter avec un compte enseignant existant. Attendu : écran « Mes chapitres » avec le message « Aucun chapitre pour l'instant ».

- [ ] **Step 6: Recette de l'import.** Cases à cocher (JF) :
  - [ ] Télécharger le modèle néerlandais ; dans Excel, les notes d'en-tête (survol des cellules) affichent l'aide.
  - [ ] Importer le modèle vide : l'application liste les champs manquants (niveau, titre, numéro, « Liste vide ») avec feuille, ligne et colonne.
  - [ ] Remplir un chapitre réel de 2 listes (dont un nom avec article, un verbe avec « - », un synonyme avec article, un homonyme) ; l'importer : l'aperçu affiche titre, langue, listes et nombre de mots ; l'homonyme apparaît en avertissement ; « Enregistrer » ouvre le détail avec les mots dans l'ordre du classeur.
  - [ ] Importer un fichier `.xls` ou `.csv` : message « Format non pris en charge ».
  - [ ] Importer un fichier de plus de 2 Mo : message « trop volumineux ».
  - [ ] Revenir à la liste : le chapitre y figure avec « 2 listes ».
  - [ ] Supprimer le chapitre : confirmation, puis retour à une liste vide.
  - [ ] Se déconnecter puis se reconnecter : on retombe sur la liste des chapitres (pas sur le chapitre ouvert avant).
  - [ ] Choisir à nouveau le MÊME fichier après l'avoir corrigé : l'application relit bien le fichier (les anciennes erreurs disparaissent).
  - [ ] Renommer un fichier `.docx` en `.xlsx` et l'importer : message « Ce fichier n'est pas un classeur Excel (.xlsx) lisible ».
  - [ ] Sur téléphone (ou fenêtre de 375 px de large), connecté : pas de défilement horizontal, le bouton « Se déconnecter » reste accessible.
  - [ ] « Mot de passe oublié » : le courriel arrive et le lien ramène sur l'application (sinon vérifier l'étape 3 : Redirect URLs).
  - [ ] Facultatif : créer un second compte et vérifier qu'il ne voit pas les chapitres du premier.

- [ ] **Step 7: Build avant tout push.** `npx tsc --noEmit && npm test && npx vite build` doivent passer sans erreur (règle PLAI : pas de push sans build local réussi).

- [ ] **Step 8: Fusionner et pousser.** Sur accord de JF : fusion de `feat/plan-2-application` dans `main` (tests sur le résultat), `git push`.

- [ ] **Step 9 (A5): Vercel.** Connecter le dépôt, définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, ajouter le sous-domaine `langactif.jfb4plai.com`, puis ajouter l'adresse de production aux Redirect URLs de Supabase.

---

## Auto-revue du plan contre le spec

**Couverture**
- Spec 3 (stack, PWA, branding, tables `lang_*`, RLS, grants, dépôt, fonctions autonomes) : Tasks 0 et 2. La PWA (installable, hors ligne) relève du plan 3, car elle concerne l'interface élève ; aucune fonction `api/*` dans ce plan (pas de clé de service côté navigateur).
- Spec 4.1 et 4.2 (hiérarchie, classeur, modèle téléchargeable avec aide, validation à l'import, rien d'importé si erreur) : Tasks 2, 3, 4, 7, 9. L'atomicité est assurée par la fonction SQL.
- Spec 4.3 (aide IA pour les phrases) : hors plan 2 (plan 2b ou ultérieur, avec relecture enseignant).
- Spec 4.4 (blocs-jeux calculés) et 4.5 (bibliothèque partagée) : plans 4 à 6.
- Spec 8 (créer et gérer le contenu, guidage contextuel sur chaque champ) : Tasks 8 et 9 (label, aide sous chaque champ, exemples FWB). Classes, assignation, tableau de bord : plans 3 et 4.
- Spec 9 (rôles) : seul le rôle enseignant propriétaire existe ici ; remédiateur et bibliothèque aux plans suivants. Les fonctions de propriété en `security definer` évitent la récursion RLS documentée.
- Spec 10 (RGPD) : aucune donnée d'élève dans ce plan.
- Spec 11 (audio) : hors plan 2, voir « Périmètre et découpage ».
- Spec 13 (sécurité, erreurs) : import tout ou rien, lecture isolée avec délai, limites, aucune clé secrète côté navigateur, aucun `console.log` de données.

**Cohérence des types** : `ParsedChapter`, `ImportIssue`, `RawWorkbook` (plan 1) sont réutilisés tels quels. `ImportPayload` (Task 3) correspond aux clés lues par `lang_import_chapter` (Task 2) : `langue, niveau, titre, numero, auteur, lists[].nom, lists[].words[].{fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url}`. `ChapterDetail` et `WordRow` (Task 4) reprennent les colonnes de `lang_words`. `getChapter` et `ChapterDetail.tsx` utilisent les mêmes noms.

**Placeholders** : aucun dans les étapes de code. `UUID_COMPTE_A` du script RLS est une valeur que JF remplace (étape explicite, action A1).

**Risques à surveiller à l'exécution**
- Le bundle exceljs dans le Worker avec Vite n'a pas été essayé dans ce dépôt : si `vite build` échoue sur exceljs (polyfills Node), le repli est de lire le classeur côté serveur dans une fonction avec délai maximal (changement de conception à soumettre à JF avant de continuer).
- Les notes de cellule (`cell.note`) et le gel de volet d'`exceljs` sont vérifiés indirectement (le classeur se relit) ; leur affichage dans Excel est vérifié à la recette.
- La jointure imbriquée `lang_lists(... lang_words(...))` de PostgREST dépend des clés étrangères créées par la migration : si elle échoue, vérifier d'abord que la migration est bien appliquée (A1).


---

## Bilan d'exécution (2026-10-01)

Tasks 0 à 10 exécutées par sous-agents sur la branche `feat/plan-2-application`, puis revue finale globale par un relecteur indépendant ; correctifs livrés en trois lots. État : 171 tests, `tsc --noEmit` propre, `vite build` réussi (exceljs uniquement dans le Worker et le chunk du modèle, pas dans le bundle principal). **Reste : Task 11 (recette par JF) et la fusion sur `main`.**

**Écarts entre les extraits de ce plan et le code livré** (le code fait foi) :

1. Task 4 : `chapters.test.ts` compte 7 tests (le plan en annonçait 6).
2. Task 2, migration SQL, corrigée après revue :
   - Révocation des privilèges par défaut de Supabase pour `anon` et `authenticated` avant les grants (sans cela le dernier bloc du test RLS échouait, et `authenticated` gardait TRUNCATE, REFERENCES et TRIGGER).
   - Bornes de longueur en CHECK sur toutes les colonnes de texte, `audio_url` limité à `https://` (500 caractères), 20 synonymes par mot au plus.
   - Limites par déclencheur, valables aussi pour les insertions directes : 200 chapitres par enseignant, 40 listes par chapitre, 1000 mots par liste (fonction `security definer` : comptage par index, sans réévaluer la RLS ligne par ligne).
   - Politiques et déclencheurs rejouables (`drop ... if exists`), synonymes null acceptés, article refusé sur un chapitre anglais.
   - Script RLS : trois contrôles ajoutés (audio non https, texte trop long, article en anglais).
3. Interface, corrigée après revue :
   - Même fichier ré-importable après correction ; résultat d'un fichier périmé ignoré si deux fichiers sont choisis vite.
   - Barre de navigation sans débordement à 375 px une fois connecté (le courriel est masqué sur téléphone).
   - 16 px partout (libellés, messages, pied de page, étiquettes), boutons et liens d'au moins 44 px de haut, contraste du pied de page et de l'état vide relevé.
   - Écran réinitialisé à la déconnexion, focus placé sur le titre à chaque écran, messages d'erreur techniques traduits en français (`friendlyError`), états de chargement qui ne restent plus bloqués, balisage valide des cartes, phrase française visible dans le détail.

**Décisions prises à valider par JF (nouvelles)** :

- Plafonds de 200 chapitres par enseignant, 200 caractères par mot et titre, 500 par phrase et par adresse audio : choisis pour protéger la base partagée, modifiables dans la migration avant son application.
- L'adresse audio fournie dans l'Excel doit commencer par `https://` (les appareils des élèves ne chargeront pas d'adresse arbitraire en clair).

**Non traité, noté pour la suite** :

- Date du chapitre (champ `date` de la feuille Méta du spec 4.2) : absent du modèle et de la table.
- Navigation par état (le bouton « précédent » du navigateur quitte l'application, un rechargement revient à la liste) : acceptable ici, le plan 3 (PWA élève) exigera un vrai routage.
- Contrainte `unique (list_id, position)` non différable : elle compliquera le réordonnancement sur place (plan ultérieur).
- Une liste de 40 x 1000 mots (maximum légal) pourrait approcher le délai d'exécution de 8 s du rôle `authenticated` ; les chapitres réels (quelques dizaines de mots) ne sont pas concernés.
- Les inscriptions restent ouvertes sur le projet partagé : un compte peut remplir la base dans les limites ci-dessus ; un quota global relève du projet partagé, pas de LangActif.

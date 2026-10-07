// Exécute les migrations et le script de vérification sur Postgres (PGlite, en local, sans réseau).
// Les rôles Supabase et auth.uid() sont simulés : c'est un filet de sécurité, pas un remplacement
// de l'exécution sur le projet Supabase réel.
// Usage : npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEACHER = '11111111-1111-1111-1111-111111111111';
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  insert into auth.users values ('${TEACHER}', 'enseignant@test');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;
  grant usage on schema auth, extensions, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create extension pgcrypto with schema extensions;
  grant execute on all functions in schema extensions to anon, authenticated, service_role;
`);

const migrations = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const f of migrations) {
  try {
    await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
    console.log('OK migration', f);
  } catch (e) {
    console.error('ERREUR migration', f, '\n', e.message);
    process.exit(1);
  }
}

// Seul le script du plan 3a est rejoué ici : celui du plan 2 appelle des fonctions du plan 2
// déjà couvertes par son propre script sur le projet réel.
try {
  const script = readFileSync(join(root, 'tests', 'rls_lang_groups.sql'), 'utf8').replaceAll('UUID_COMPTE_A', TEACHER);
  await db.exec(script);
  console.log('OK tests/rls_lang_groups.sql');
} catch (e) {
  console.error('ERREUR tests/rls_lang_groups.sql\n', e.message);
  process.exit(1);
}

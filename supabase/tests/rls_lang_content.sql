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

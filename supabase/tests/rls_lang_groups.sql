-- Vérification du plan 3a. À exécuter dans l'éditeur SQL Supabase, APRÈS les deux migrations.
-- Tout est annulé (rollback). Remplacer UUID_COMPTE_A (toutes les occurrences) par l'id d'un
-- compte enseignant existant. Succès attendu : « Success. No rows returned ».

begin;

-- 0) Constantes et formats (rôle propriétaire : fonctions internes)
do $$
begin
  assert (select count(distinct w) from unnest(public.lang_pseudo_pool()) as w) = 100,
    'le pool doit compter 100 pseudos distincts';
  assert public.lang_new_student_code() ~ '^[ACEFGHJKMNRSTUVWXYZ][2-9]{3}$', 'format du code élève';
  assert public.lang_new_group_code() ~ '^[ACEFGHJKMNRSTUVWXYZ2-9]{5}$', 'format du code de groupe';
end $$;

-- 1) Enseignant A : création, lecture, code_hash illisible
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);

do $$
declare
  r jsonb;
  r2 jsonb;
  g uuid;
begin
  r := public.lang_group_create('Groupe test RLS', 'nl-BE', 3);
  g := (r->>'group_id')::uuid;
  assert jsonb_array_length(r->'seats') = 3, '3 places attendues';
  assert (r->>'code') ~ '^[ACEFGHJKMNRSTUVWXYZ2-9]{5}$', 'code de groupe invalide';
  assert (select count(distinct s->>'pseudo') from jsonb_array_elements(r->'seats') s) = 3, 'pseudos distincts';
  assert (select bool_and((s->>'code') ~ '^[ACEFGHJKMNRSTUVWXYZ][2-9]{3}$') from jsonb_array_elements(r->'seats') s),
    'format des codes élèves';
  assert (select count(*) from public.lang_groups where id = g) = 1, 'A ne voit pas son groupe';
  assert (select count(*) from public.lang_students where group_id = g) = 3, 'A ne voit pas ses places';

  begin
    perform code_hash from public.lang_students limit 1;
    raise exception 'FAIL: code_hash lisible par l''enseignant';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.lang_student_sessions;
    raise exception 'FAIL: sessions lisibles par l''enseignant';
  exception when insufficient_privilege then
    null;
  end;

  r2 := public.lang_group_add_seats(g, 2);
  assert jsonb_array_length(r2) = 2, '2 places ajoutées attendues';
  assert (select count(distinct pseudo) from public.lang_students where group_id = g) = 5, 'pseudos uniques sur 5 places';

  perform set_config('lang.test_group', g::text, true);
  perform set_config('lang.test_code', r->>'code', true);
  perform set_config('lang.test_seat_id', r->'seats'->0->>'id', true);
  perform set_config('lang.test_seat_pseudo', r->'seats'->0->>'pseudo', true);
  perform set_config('lang.test_seat_secret', r->'seats'->0->>'code', true);
end $$;

-- 2) Un autre enseignant (B) ne voit rien et ne peut rien faire
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  g uuid := current_setting('lang.test_group')::uuid;
  s uuid := current_setting('lang.test_seat_id')::uuid;
  n integer;
begin
  assert (select count(*) from public.lang_groups where id = g) = 0, 'B voit le groupe de A';
  assert (select count(*) from public.lang_students where group_id = g) = 0, 'B voit les places de A';

  begin
    perform public.lang_group_add_seats(g, 1);
    raise exception 'FAIL: B a ajouté des places au groupe de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_seat_reset_code(s);
    raise exception 'FAIL: B a réinitialisé un code de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_seat_unlock(s);
    raise exception 'FAIL: B a débloqué une place de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_group_archive(g);
    raise exception 'FAIL: B a archivé le groupe de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.lang_students (group_id, pseudo, code_hash) values (g, 'Intrus', 'x');
    raise exception 'FAIL: insertion directe de place acceptée';
  exception when insufficient_privilege then
    null;
  end;

  delete from public.lang_groups where id = g;
  get diagnostics n = row_count;
  assert n = 0, 'B a supprimé le groupe de A';
  delete from public.lang_students where id = s;
  get diagnostics n = row_count;
  assert n = 0, 'B a supprimé une place de A';
end $$;

-- 3) anon : aucun accès
set local role anon;
do $$
begin
  begin
    perform count(*) from public.lang_groups;
    raise exception 'FAIL: anon lit lang_groups';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.lang_group_create('x', 'nl-BE', 1);
    raise exception 'FAIL: anon appelle lang_group_create';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.lang_student_login('AAAAA', 'x', 'A222', false);
    raise exception 'FAIL: anon appelle lang_student_login';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- 4) Un enseignant ne peut pas appeler les fonctions élève
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.lang_student_login(current_setting('lang.test_code'), 'x', 'A222', false);
    raise exception 'FAIL: authenticated appelle lang_student_login';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- 5) Élève (service_role) : liste, mauvais code, blocage
set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  c text := current_setting('lang.test_seat_secret');
  wrong text := case when current_setting('lang.test_seat_secret') = 'A222' then 'A223' else 'A222' end;
  r jsonb;
  i integer;
begin
  assert cardinality(public.lang_group_pseudos(g)) = 5, '5 pseudos attendus';
  assert cardinality(public.lang_group_pseudos('ZZZZZ')) = 0, 'groupe inconnu = liste vide';

  r := public.lang_student_login(g, p, wrong, false);
  assert (r->>'ok')::boolean = false and r->>'reason' = 'invalide', 'mauvais code : invalide';
  r := public.lang_student_login(g, 'Inconnu', wrong, false);
  assert (r->>'ok')::boolean = false and r->>'reason' = 'invalide', 'pseudo inconnu : même message';

  for i in 1..3 loop
    perform public.lang_student_login(g, p, wrong, false);
  end loop;
  r := public.lang_student_login(g, p, wrong, false);  -- 5e échec cumulé
  assert r->>'reason' = 'bloque', '5 échecs : blocage';
  r := public.lang_student_login(g, p, c, false);
  assert r->>'reason' = 'bloque', 'le bon code est refusé pendant le blocage';
end $$;

-- 6) Déblocage par l'enseignant
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
select public.lang_seat_unlock(current_setting('lang.test_seat_id')::uuid);

-- 7) Connexion réussie, session personnelle glissante, appareil partagé, déconnexion
set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  c text := current_setting('lang.test_seat_secret');
  s uuid := current_setting('lang.test_seat_id')::uuid;
  r jsonb;
  tok text;
  tok2 text;
begin
  r := public.lang_student_login(g, p, c, false);
  assert (r->>'ok')::boolean, 'connexion avec le bon code';
  tok := r->>'token';
  assert length(tok) = 64, 'jeton de 64 caractères hexadécimaux';
  assert public.lang_student_me(tok)->>'pseudo' = p, 'me renvoie le pseudo';

  update public.lang_student_sessions set expires_at = now() + interval '1 day'
    where student_id = s and not shared_device;
  perform public.lang_student_me(tok);
  assert (select expires_at > now() + interval '11 months' from public.lang_student_sessions
          where student_id = s and not shared_device limit 1), 'expiration glissante de 12 mois';

  r := public.lang_student_login(g, p, c, true);
  tok2 := r->>'token';
  assert (select count(*) from public.lang_student_sessions
          where student_id = s and shared_device and expires_at < now() + interval '13 hours') = 1,
    'appareil partagé : 12 heures';

  perform public.lang_student_logout(tok);
  assert public.lang_student_me(tok) is null, 'jeton révoqué après déconnexion';
  assert public.lang_student_me(tok2) is not null, 'l''autre appareil reste connecté';
  perform set_config('lang.test_token2', tok2, true);
end $$;

-- 8) Nouveau code : révoque les appareils, ancien code refusé, nouveau code accepté
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.lang_seat_reset_code(current_setting('lang.test_seat_id')::uuid);
begin
  perform set_config('lang.test_new_secret', r->>'code', true);
end $$;

set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  old_c text := current_setting('lang.test_seat_secret');
  new_c text := current_setting('lang.test_new_secret');
  r jsonb;
begin
  assert public.lang_student_me(current_setting('lang.test_token2')) is null, 'nouveau code : sessions révoquées';
  if old_c <> new_c then
    r := public.lang_student_login(g, p, old_c, false);
    assert (r->>'ok')::boolean = false, 'ancien code refusé';
  end if;
  r := public.lang_student_login(g, p, new_c, false);
  assert (r->>'ok')::boolean, 'nouveau code accepté';
end $$;

-- 9) Archivage d'une place puis du groupe : plus de connexion
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
select public.lang_group_archive(current_setting('lang.test_group')::uuid);

set local role service_role;
do $$
begin
  assert cardinality(public.lang_group_pseudos(current_setting('lang.test_code'))) = 0, 'groupe archivé : liste vide';
  assert (public.lang_student_login(current_setting('lang.test_code'), current_setting('lang.test_seat_pseudo'),
          current_setting('lang.test_new_secret'), false)->>'ok')::boolean = false, 'groupe archivé : connexion refusée';
end $$;

-- 10) Effacement en cascade (RGPD) : groupe supprimé = plus aucune ligne liée
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
delete from public.lang_groups where id = current_setting('lang.test_group')::uuid;

set local role service_role;
do $$
declare
  g uuid := current_setting('lang.test_group')::uuid;
begin
  assert (select count(*) from public.lang_groups where id = g) = 0, 'groupe encore présent';
  assert (select count(*) from public.lang_students where group_id = g) = 0, 'places restantes';
  assert (select count(*) from public.lang_student_sessions
          where student_id = current_setting('lang.test_seat_id')::uuid) = 0, 'sessions restantes';
end $$;

rollback;

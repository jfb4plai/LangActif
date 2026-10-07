-- LangActif, plan 3a : fonctions élève. Exécutables par service_role UNIQUEMENT
-- (appelées par les fonctions Vercel api/student-*.ts avec la clé de service).

create or replace function public.lang_group_pseudos(p_group_code text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(s.pseudo order by s.pseudo), '{}'::text[])
  from public.lang_groups g
  join public.lang_students s on s.group_id = g.id
  where g.code = upper(trim(p_group_code))
    and g.archived_at is null
    and s.archived_at is null;
$$;

-- Connexion : toujours un calcul bcrypt (même pour un pseudo inconnu ou bloqué) afin de ne pas
-- révéler par le temps de réponse si un pseudo existe. 5 échecs = blocage de 15 minutes.
create or replace function public.lang_student_login(p_group_code text, p_pseudo text, p_code text, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group public.lang_groups%rowtype;
  v_student public.lang_students%rowtype;
  v_shared boolean := coalesce(p_shared, false);
  v_token text;
  v_attempts integer;
begin
  select * into v_group from public.lang_groups
    where code = upper(trim(p_group_code)) and archived_at is null;
  if v_group.id is not null then
    select * into v_student from public.lang_students
      where group_id = v_group.id and pseudo = p_pseudo and archived_at is null
      for update;
  end if;

  if v_student.id is null then
    perform crypt(coalesce(p_code, ''), gen_salt('bf', 8));
    return jsonb_build_object('ok', false, 'reason', 'invalide');
  end if;

  if v_student.locked_until is not null and v_student.locked_until > now() then
    perform crypt(coalesce(p_code, ''), gen_salt('bf', 8));
    return jsonb_build_object('ok', false, 'reason', 'bloque',
      'retry_after_seconds', ceil(extract(epoch from (v_student.locked_until - now())))::integer);
  end if;

  if v_student.code_hash = crypt(coalesce(p_code, ''), v_student.code_hash) then
    update public.lang_students
      set failed_attempts = 0, locked_until = null, last_seen_at = now()
      where id = v_student.id;
    v_token := encode(gen_random_bytes(32), 'hex');
    insert into public.lang_student_sessions (student_id, token_hash, shared_device, expires_at)
    values (
      v_student.id,
      encode(digest(v_token, 'sha256'), 'hex'),
      v_shared,
      now() + case when v_shared then interval '12 hours' else interval '12 months' end
    );
    return jsonb_build_object('ok', true, 'token', v_token, 'pseudo', v_student.pseudo, 'langue', v_group.langue);
  end if;

  v_attempts := v_student.failed_attempts + 1;
  if v_attempts >= 5 then
    update public.lang_students
      set failed_attempts = 0, locked_until = now() + interval '15 minutes'
      where id = v_student.id;
    return jsonb_build_object('ok', false, 'reason', 'bloque', 'retry_after_seconds', 900);
  end if;
  update public.lang_students set failed_attempts = v_attempts where id = v_student.id;
  return jsonb_build_object('ok', false, 'reason', 'invalide');
end;
$$;

-- Valide un jeton. Session personnelle : expiration glissante de 12 mois. Appareil partagé :
-- expiration fixe (12 h après la connexion), non renouvelée.
create or replace function public.lang_student_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.lang_student_sessions%rowtype;
  v_pseudo text;
  v_langue text;
begin
  select ss.* into v_session
  from public.lang_student_sessions ss
  join public.lang_students st on st.id = ss.student_id
  join public.lang_groups g on g.id = st.group_id
  where ss.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and ss.revoked_at is null
    and ss.expires_at > now()
    and st.archived_at is null
    and g.archived_at is null;
  if v_session.id is null then
    return null;
  end if;

  update public.lang_student_sessions
    set last_used_at = now(),
        expires_at = case when shared_device then expires_at else now() + interval '12 months' end
    where id = v_session.id;
  update public.lang_students set last_seen_at = now() where id = v_session.student_id;

  select st.pseudo, g.langue into v_pseudo, v_langue
  from public.lang_students st join public.lang_groups g on g.id = st.group_id
  where st.id = v_session.student_id;
  return jsonb_build_object('pseudo', v_pseudo, 'langue', v_langue);
end;
$$;

create or replace function public.lang_student_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.lang_student_sessions
    set revoked_at = now()
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and revoked_at is null;
end;
$$;

revoke all on function public.lang_group_pseudos(text) from public, anon, authenticated;
revoke all on function public.lang_student_login(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.lang_student_me(text) from public, anon, authenticated;
revoke all on function public.lang_student_logout(text) from public, anon, authenticated;
grant execute on function public.lang_group_pseudos(text) to service_role;
grant execute on function public.lang_student_login(text, text, text, boolean) to service_role;
grant execute on function public.lang_student_me(text) to service_role;
grant execute on function public.lang_student_logout(text) to service_role;

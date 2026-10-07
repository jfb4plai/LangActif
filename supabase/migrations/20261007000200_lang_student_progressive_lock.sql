-- LangActif, plan 3a : blocage progressif.
--
-- Problème corrigé : la liste des pseudos d'un groupe est publique (il faut connaître le code de
-- groupe), et le blocage se faisait par pseudo, toujours pour 15 minutes. Un camarade pouvait donc
-- bloquer un élève à volonté avec 5 mauvais codes.
--
-- Nouveau comportement : les blocages successifs durent 1 minute, puis 5 minutes, puis 15 minutes
-- (plafond). L'échelon redescend à zéro après une heure sans nouvel échec. Les échecs isolés
-- (moins de 5) sont eux aussi oubliés au bout d'une heure. Un élève qui se trompe de bonne foi
-- attend donc 1 minute ; un acharnement reste limité à 5 essais par blocage, ce qui garde la
-- recherche d'un code (environ 9 700 possibilités) très lente. Le blocage ne peut pas être
-- supprimé sans stocker l'adresse IP ou un identifiant d'appareil, ce que le spec exclut (RGPD) :
-- l'enseignant voit donc les blocages répétés et peut agir (débloquer, nouveau code).

alter table public.lang_students
  add column if not exists lock_level integer not null default 0,
  add column if not exists last_failed_at timestamptz;

grant select (lock_level) on public.lang_students to authenticated;

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
  v_recent boolean;
  v_attempts integer;
  v_level integer;
  v_seconds integer;
begin
  select * into v_group from public.lang_groups
    where code = upper(trim(p_group_code)) and archived_at is null;
  if v_group.id is not null then
    select * into v_student from public.lang_students
      where group_id = v_group.id and pseudo = p_pseudo and archived_at is null
      for update;
  end if;

  -- Toujours un calcul bcrypt, même pour un pseudo inconnu ou bloqué (pas de fuite par le temps).
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
      set failed_attempts = 0, locked_until = null, lock_level = 0, last_failed_at = null, last_seen_at = now()
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

  -- Échec : les échecs et l'échelon de blocage plus vieux d'une heure sont oubliés.
  v_recent := v_student.last_failed_at is not null and v_student.last_failed_at > now() - interval '1 hour';
  v_attempts := (case when v_recent then v_student.failed_attempts else 0 end) + 1;
  if v_attempts >= 5 then
    v_level := least((case when v_recent then v_student.lock_level else 0 end) + 1, 3);
    v_seconds := case v_level when 1 then 60 when 2 then 300 else 900 end;
    update public.lang_students
      set failed_attempts = 0,
          lock_level = v_level,
          last_failed_at = now(),
          locked_until = now() + make_interval(secs => v_seconds)
      where id = v_student.id;
    return jsonb_build_object('ok', false, 'reason', 'bloque', 'retry_after_seconds', v_seconds);
  end if;
  update public.lang_students
    set failed_attempts = v_attempts,
        lock_level = case when v_recent then v_student.lock_level else 0 end,
        last_failed_at = now()
    where id = v_student.id;
  return jsonb_build_object('ok', false, 'reason', 'invalide');
end;
$$;

-- Le déblocage par l'enseignant remet aussi l'échelon à zéro.
create or replace function public.lang_seat_unlock(p_seat uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.lang_students where id = p_seat;
  if v_group is null or not public.lang_owns_group(v_group) then
    raise exception 'Place introuvable ou non autorisée';
  end if;
  update public.lang_students
    set failed_attempts = 0, locked_until = null, lock_level = 0, last_failed_at = null
    where id = p_seat;
end;
$$;

-- Les privilèges de ces fonctions ne changent pas (create or replace les conserve), mais on les
-- réaffirme pour que cette migration se suffise à elle-même.
revoke all on function public.lang_student_login(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.lang_student_login(text, text, text, boolean) to service_role;
revoke all on function public.lang_seat_unlock(uuid) from public, anon;
grant execute on function public.lang_seat_unlock(uuid) to authenticated;

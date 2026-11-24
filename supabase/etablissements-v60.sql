-- Classe Master v60 : ÉTABLISSEMENTS (un code par établissement, chaque enseignant rattaché à son établissement)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS tous les autres scripts (schema, partage-parents, partage-admin,
-- acces-admin, code-enseignant, securite-v32, tableau-bord-admin, vie-scolaire-admin). Faites d'abord une sauvegarde.
-- Rejouable sans danger. Ne rejouez pas securite-v32.sql / acces-admin.sql / partage-admin.sql / vie-scolaire-admin.sql /
-- tableau-bord-admin.sql APRÈS celui-ci : ils remettraient l'ancien fonctionnement (rejouez alors celui-ci en dernier).
--
-- Principe :
--  * un établissement = un nom + un code à 8 caractères (ex. K7M2-QX4P) ;
--  * le chef d'établissement crée l'établissement (il en devient administrateur) et donne le code aux enseignants ;
--  * un enseignant s'inscrit avec le code : il devient membre et ne gère que les classes de son établissement ;
--  * un administrateur ne voit QUE les dossiers, résumés, départs et décisions de SON établissement ;
--  * l'existant est repris : chaque administrateur actuel reçoit un établissement « Mon établissement » (renommable)
--    avec ses élèves ; les enseignants déjà affectés à ses élèves en deviennent membres.

-- 1. Tables ------------------------------------------------------------------------------------------------------
create table if not exists public.etablissements (
  id         uuid        primary key default gen_random_uuid(),
  nom        text        not null check (char_length(btrim(nom)) between 2 and 120),
  ville      text        not null default '' check (char_length(ville) <= 80),
  code       text        not null unique check (code ~ '^[A-Z0-9]{8}$'),
  ouvert     boolean     not null default true,    -- false : le code n'accepte plus de nouveaux enseignants
  verifie    boolean     not null default false,   -- à passer à true (SQL Editor) pour un établissement confirmé
  cree_par   uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.etab_membres (
  etab_id uuid        not null references public.etablissements (id) on delete cascade,
  user_id uuid        not null references auth.users (id) on delete cascade,
  role    text        not null default 'enseignant' check (role in ('admin', 'enseignant')),
  depuis  timestamptz not null default now(),
  primary key (etab_id, user_id)
);
create index if not exists etab_membres_user_idx on public.etab_membres (user_id);
create table if not exists public.etab_essais (      -- essais de code ratés : limite les devinettes
  user_id uuid        not null,
  at      timestamptz not null default now()
);
create index if not exists etab_essais_idx on public.etab_essais (user_id, at desc);
alter table public.etablissements enable row level security;   -- aucune règle : tout passe par les fonctions ci-dessous
alter table public.etab_membres   enable row level security;
alter table public.etab_essais    enable row level security;

alter table public.registry_students add column if not exists etab_id uuid references public.etablissements (id) on delete cascade;
create index if not exists registry_students_etab_idx on public.registry_students (etab_id, class_label, name);
alter table public.registry_log add column if not exists etab_id uuid;

-- 2. Fonctions de base -----------------------------------------------------------------------------------------------
create or replace function public.gen_etab_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; h text; i integer;
begin
  loop
    h := replace(gen_random_uuid()::text, '-', '');
    c := '';
    for i in 0..7 loop
      c := c || substr(alpha, 1 + (('x' || substr(h, 1 + 2 * i, 2))::bit(8)::integer % 32), 1);
    end loop;
    exit when not exists (select 1 from public.etablissements e where e.code = c);
  end loop;
  return c;
end $$;
revoke all on function public.gen_etab_code() from public;

create or replace function public.is_etab_admin(p_etab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_etab is not null and exists (
  select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = (select auth.uid()) and m.role = 'admin') $$;
create or replace function public.is_etab_member(p_etab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_etab is not null and exists (
  select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = (select auth.uid())) $$;
create or replace function public.can_admin_student(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.registry_students g where g.id = p_student and public.is_etab_admin(g.etab_id)) $$;
revoke all on function public.is_etab_admin(uuid), public.is_etab_member(uuid), public.can_admin_student(uuid) from public;
grant execute on function public.is_etab_admin(uuid), public.is_etab_member(uuid), public.can_admin_student(uuid) to authenticated;

-- « Mon compte est-il administrateur (d'au moins un établissement) ? » : utilisé par l'application
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.etab_membres m where m.user_id = (select auth.uid()) and m.role = 'admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Reprise de l'existant ---------------------------------------------------------------------------------------------
do $$
declare r record; eid uuid;
begin
  for r in
    select u.uid from (
      select user_id as uid from public.admin_users
      union select user_id from public.registry_students
    ) u
    where not exists (select 1 from public.etab_membres m where m.user_id = u.uid and m.role = 'admin')
  loop
    insert into public.etablissements (nom, code, cree_par)
    values (
      coalesce(nullif(btrim((select au.raw_user_meta_data ->> 'school' from auth.users au where au.id = r.uid)), ''), 'Mon établissement'),
      public.gen_etab_code(), r.uid)
    returning id into eid;
    insert into public.etab_membres (etab_id, user_id, role) values (eid, r.uid, 'admin');
  end loop;
end $$;

update public.registry_students g
   set etab_id = (select m.etab_id from public.etab_membres m where m.user_id = g.user_id and m.role = 'admin' order by m.depuis limit 1)
 where g.etab_id is null;
update public.registry_log l
   set etab_id = (select m.etab_id from public.etab_membres m where m.user_id = l.user_id and m.role = 'admin' order by m.depuis limit 1)
 where l.etab_id is null;
insert into public.etab_membres (etab_id, user_id, role)
select distinct g.etab_id, a.teacher_id, 'enseignant'
from public.registry_access a join public.registry_students g on g.id = a.registry_id
where g.etab_id is not null
on conflict do nothing;

do $$
begin
  if not exists (select 1 from public.registry_students where etab_id is null) then
    alter table public.registry_students alter column etab_id set not null;
  end if;
end $$;

-- 4. Dossiers élèves, accès enseignants, décisions, départs : limités à l'établissement ------------------------------------
drop policy if exists "registry_select_own" on public.registry_students;
drop policy if exists "registry_insert_own" on public.registry_students;
drop policy if exists "registry_update_own" on public.registry_students;
drop policy if exists "registry_delete_own" on public.registry_students;
create policy "registry_select_own" on public.registry_students
  for select to authenticated using ((select public.is_etab_admin(etab_id)));
create policy "registry_insert_own" on public.registry_students
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_etab_admin(etab_id)));
create policy "registry_update_own" on public.registry_students
  for update to authenticated using ((select public.is_etab_admin(etab_id))) with check ((select public.is_etab_admin(etab_id)));
create policy "registry_delete_own" on public.registry_students
  for delete to authenticated using ((select public.is_etab_admin(etab_id)));

-- Un enseignant n'agit que sur les élèves qui lui sont affectés ET tant qu'il est membre de l'établissement.
create or replace function public.can_use_ref(p_ref text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_ref is not null and exists (
    select 1 from public.registry_students g
    where g.ref = p_ref
      and (
        public.is_etab_admin(g.etab_id)
        or exists (
          select 1 from public.registry_access a
          join public.etab_membres m on m.user_id = a.teacher_id and m.etab_id = g.etab_id
          where a.registry_id = g.id and a.teacher_id = (select auth.uid()))
      )
  )
$$;
revoke all on function public.can_use_ref(text) from public;
grant execute on function public.can_use_ref(text) to authenticated;

drop policy if exists "decisions_select_own" on public.registry_decisions;
drop policy if exists "decisions_insert_own" on public.registry_decisions;
drop policy if exists "decisions_update_own" on public.registry_decisions;
drop policy if exists "decisions_delete_own" on public.registry_decisions;
create policy "decisions_select_own" on public.registry_decisions
  for select to authenticated using ((select public.can_admin_student(student_id)));
create policy "decisions_insert_own" on public.registry_decisions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.can_admin_student(student_id)));
create policy "decisions_update_own" on public.registry_decisions
  for update to authenticated using ((select public.can_admin_student(student_id))) with check ((select public.can_admin_student(student_id)));
create policy "decisions_delete_own" on public.registry_decisions
  for delete to authenticated using ((select public.can_admin_student(student_id)));

drop policy if exists "registry_log_select_own" on public.registry_log;
create policy "registry_log_select_own" on public.registry_log
  for select to authenticated using ((select public.is_etab_admin(etab_id)) or (etab_id is null and user_id = (select auth.uid())));
create or replace function public.log_registry_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.registry_log (user_id, name, class_label, event, etab_id)
  values (old.user_id, old.name, coalesce(old.class_label, ''), 'depart', old.etab_id);
  return old;
end $$;
revoke all on function public.log_registry_delete() from public;

-- 5. Tableaux de bord de l'administrateur : un établissement à la fois (p_etab) ou tous ceux qu'il administre (null) ---------
drop function if exists public.admin_dashboard();

create or replace function public.admin_dashboard(p_etab uuid default null)
returns table (
  student_id  uuid,
  class_label text,
  subj        text,
  teacher     text,
  n           integer,   -- appels faits
  a           integer,   -- absences
  j           integer,   -- dont justifiées
  r           integer,   -- retards
  recent_a    integer,   -- absences des 14 derniers jours
  avg         numeric,   -- moyenne /20
  t1          numeric,   -- moyenne des évaluations : septembre à décembre
  t2          numeric,   -- janvier à mars
  t3          numeric,   -- avril à août
  hw_n        integer,   -- devoirs non rendus
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         g.class_label,
         coalesce(x.snapshot->>'subj', ''),
         coalesce(x.snapshot->>'teacher', ''),
         coalesce(public.safe_int(x.snapshot #>> '{pres,n}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,a}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,j}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,r}'), 0),
         ab.recent_a,
         public.safe_num(x.snapshot->>'avg'),
         round(tr.t1, 2), round(tr.t2, 2), round(tr.t3, 2),
         coalesce(public.safe_int(x.snapshot #>> '{hw,n}'), 0),
         x.updated_at
  from public.registry_students g
  join lateral (
    select distinct on (s.user_id, s.class_id, s.student_id) s.snapshot, s.updated_at
    from public.parent_shares s
    where s.ref = g.ref
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  ) x on true
  cross join lateral (
    select count(*)::integer as recent_a
    from jsonb_array_elements(case when jsonb_typeof(x.snapshot->'abs') = 'array' then x.snapshot->'abs' else '[]'::jsonb end) e
    where coalesce(e->>'v', 'a') <> 'r'
      and public.safe_date(e->>'d') >= current_date - 14
  ) ab
  cross join lateral (
    select avg(v) filter (where mo in (9, 10, 11, 12)) as t1,
           avg(v) filter (where mo in (1, 2, 3))       as t2,
           avg(v) filter (where mo in (4, 5, 6, 7, 8)) as t3
    from (
      select public.safe_num(e->>'n') / nullif(public.safe_num(e->>'m'), 0) * 20 as v,
             extract(month from public.safe_date(e->>'d'))::integer as mo
      from jsonb_array_elements(case when jsonb_typeof(x.snapshot->'notes') = 'array' then x.snapshot->'notes' else '[]'::jsonb end) e
    ) q
  ) tr
  where (select public.is_etab_admin(g.etab_id))
    and (p_etab is null or g.etab_id = p_etab)
  order by g.class_label, g.id, 3, 4
$$;

revoke all on function public.admin_dashboard(uuid) from public;
grant execute on function public.admin_dashboard(uuid) to authenticated;

drop function if exists public.admin_teaching();
create or replace function public.admin_teaching(p_etab uuid default null)
returns table (
  teacher     text,
  subj        text,
  class_label text,
  n_students  integer,
  lc          text,         -- date du dernier appel
  tt          jsonb,        -- séances de la semaine [[jour, début, fin], ...]
  ev          jsonb,        -- évaluations {ne, l: [[date, élèves notés], ...]}
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (s.user_id, s.class_id, s.student_id)
           s.user_id, s.class_id, s.snapshot, s.updated_at, g.class_label
    from public.parent_shares s
    join public.registry_students g on g.ref = s.ref
    where (select public.is_etab_admin(g.etab_id))
    and (p_etab is null or g.etab_id = p_etab)
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  )
  select coalesce(max(l.snapshot->>'teacher'), ''),
         coalesce(max(l.snapshot->>'subj'), ''),
         coalesce(mode() within group (order by l.class_label), ''),
         count(*)::integer,
         max(l.snapshot->>'lc'),
         (array_agg(l.snapshot->'tt' order by (l.snapshot->'tt') is null, l.updated_at desc))[1],
         (array_agg(l.snapshot->'ev' order by (l.snapshot->'ev') is null, l.updated_at desc))[1],
         max(l.updated_at)
  from latest l
  group by l.user_id, l.class_id
  order by 3, 1, 2
$$;
revoke all on function public.admin_teaching(uuid) from public;
grant execute on function public.admin_teaching(uuid) to authenticated;

drop function if exists public.admin_discipline();
create or replace function public.admin_discipline(p_etab uuid default null)
returns table (
  student_id  uuid,
  class_label text,
  subj        text,
  teacher     text,
  d           text,
  k           text,        -- inc = incident, grv = incident grave
  t           text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         g.class_label,
         coalesce(x.snapshot->>'subj', ''),
         coalesce(x.snapshot->>'teacher', ''),
         coalesce(e->>'d', ''),
         coalesce(e->>'k', 'inc'),
         left(coalesce(e->>'t', ''), 400)
  from public.registry_students g
  join lateral (
    select distinct on (s.user_id, s.class_id, s.student_id) s.snapshot
    from public.parent_shares s
    where s.ref = g.ref
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  ) x on true
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(x.snapshot->'dis') = 'array' then x.snapshot->'dis' else '[]'::jsonb end) e
  where (select public.is_etab_admin(g.etab_id))
    and (p_etab is null or g.etab_id = p_etab)
  order by 5 desc, 2, 1
$$;
revoke all on function public.admin_discipline(uuid) from public;
grant execute on function public.admin_discipline(uuid) to authenticated;

-- 6. Affectation des élèves aux enseignants : uniquement parmi les membres de l'établissement -------------------------------
drop function if exists public.admin_assign(text, text);
drop function if exists public.admin_unassign(text, text);
drop function if exists public.admin_assignments();

create or replace function public.admin_assign(p_etab uuid, p_email text, p_class text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n integer;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select u.id into tid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if tid is null then raise exception 'unknown teacher'; end if;
  if not exists (select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = tid) then
    raise exception 'not member';
  end if;
  insert into public.registry_access (registry_id, teacher_id)
  select g.id, tid from public.registry_students g
  where g.etab_id = p_etab and (coalesce(p_class, '') = '' or g.class_label = p_class)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_unassign(p_etab uuid, p_email text, p_class text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n integer;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select u.id into tid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if tid is null then return 0; end if;
  delete from public.registry_access a using public.registry_students g
  where a.registry_id = g.id and a.teacher_id = tid and g.etab_id = p_etab
    and (coalesce(p_class, '') = '' or g.class_label = p_class);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_assignments(p_etab uuid default null)
returns table (email text, class_label text, n bigint)
language sql stable security definer set search_path = ''
as $$
  select u.email::text, g.class_label, count(*)
  from public.registry_access a
  join public.registry_students g on g.id = a.registry_id
  join auth.users u on u.id = a.teacher_id
  where (select public.is_etab_admin(g.etab_id)) and (p_etab is null or g.etab_id = p_etab)
  group by u.email, g.class_label
  order by u.email, g.class_label
$$;
revoke all on function public.admin_assign(uuid, text, text), public.admin_unassign(uuid, text, text), public.admin_assignments(uuid) from public;
grant execute on function public.admin_assign(uuid, text, text), public.admin_unassign(uuid, text, text), public.admin_assignments(uuid) to authenticated;

-- 7. Fonctions « établissement » appelées par l'application (réponse JSON ; { "ok": false, "err": "..." } en cas de refus) ----------
-- Créer un établissement : le créateur en devient administrateur et reçoit le code à donner aux enseignants.
create or replace function public.creer_etablissement(p_nom text, p_ville text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); n text := btrim(coalesce(p_nom, '')); e uuid; c text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if char_length(n) < 2 or char_length(n) > 120 then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  if (select count(*) from public.etablissements x where x.cree_par = uid) >= 3 then
    return jsonb_build_object('ok', false, 'err', 'too_many');
  end if;
  c := public.gen_etab_code();
  insert into public.etablissements (nom, ville, code, cree_par)
  values (n, left(btrim(coalesce(p_ville, '')), 80), c, uid) returning id into e;
  insert into public.etab_membres (etab_id, user_id, role) values (e, uid, 'admin');
  return jsonb_build_object('ok', true, 'id', e, 'nom', n, 'code', c);
end $$;

-- Rejoindre un établissement avec son code (8 caractères, tirets et espaces ignorés). 8 essais ratés par quart d'heure au maximum.
create or replace function public.rejoindre_etablissement(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); e record; fails integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.etab_essais t where t.at < now() - interval '1 day';
  select count(*) into fails from public.etab_essais t where t.user_id = uid and t.at > now() - interval '15 minutes';
  if fails >= 8 then return jsonb_build_object('ok', false, 'err', 'too_many_attempts'); end if;
  select x.id, x.nom, x.ouvert into e from public.etablissements x where x.code = c;
  if not found then
    insert into public.etab_essais (user_id) values (uid);
    return jsonb_build_object('ok', false, 'err', 'unknown_code');
  end if;
  if not e.ouvert and not exists (select 1 from public.etab_membres m where m.etab_id = e.id and m.user_id = uid) then
    return jsonb_build_object('ok', false, 'err', 'closed');
  end if;
  insert into public.etab_membres (etab_id, user_id, role) values (e.id, uid, 'enseignant') on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', e.id, 'nom', e.nom);
end $$;

-- Mes établissements (le code n'est donné qu'aux administrateurs).
create or replace function public.mes_etablissements()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'nom', x.nom, 'ville', x.ville, 'role', m.role,
           'code', case when m.role = 'admin' then x.code end,
           'ouvert', x.ouvert, 'verifie', x.verifie,
           'membres', (select count(*) from public.etab_membres q where q.etab_id = x.id)
         ) order by m.depuis), '[]'::jsonb)
  from public.etab_membres m join public.etablissements x on x.id = m.etab_id
  where m.user_id = (select auth.uid())
$$;

-- Liste des membres (administrateurs seulement).
create or replace function public.etab_membres_liste(p_etab uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'user_id', m.user_id, 'email', u.email, 'nom', coalesce(u.raw_user_meta_data ->> 'name', ''),
            'role', m.role, 'depuis', m.depuis) order by m.role, m.depuis), '[]'::jsonb)
          from public.etab_membres m join auth.users u on u.id = m.user_id
          where m.etab_id = p_etab);
end $$;

-- Retirer un enseignant (ses affectations d'élèves dans cet établissement sont retirées aussi).
create or replace function public.etab_retirer(p_etab uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select m.role into r from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
  if r is null then return jsonb_build_object('ok', true); end if;
  if r = 'admin' and (select count(*) from public.etab_membres m where m.etab_id = p_etab and m.role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'last_admin');
  end if;
  delete from public.registry_access a using public.registry_students g
   where a.registry_id = g.id and g.etab_id = p_etab and a.teacher_id = p_user;
  delete from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- Nommer ou retirer un administrateur (direction, CPE...).
create or replace function public.etab_definir_role(p_etab uuid, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_role not in ('admin', 'enseignant') then return jsonb_build_object('ok', false, 'err', 'bad_role'); end if;
  select m.role into r from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
  if r is null then return jsonb_build_object('ok', false, 'err', 'not_member'); end if;
  if r = 'admin' and p_role = 'enseignant'
     and (select count(*) from public.etab_membres m where m.etab_id = p_etab and m.role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'last_admin');
  end if;
  update public.etab_membres m set role = p_role where m.etab_id = p_etab and m.user_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

-- Nouveau code (l'ancien cesse de fonctionner ; les enseignants déjà membres restent membres).
create or replace function public.etab_nouveau_code(p_etab uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  c := public.gen_etab_code();
  update public.etablissements x set code = c where x.id = p_etab;
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- Ouvrir / fermer les inscriptions avec le code.
create or replace function public.etab_ouvrir(p_etab uuid, p_ouvert boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  update public.etablissements x set ouvert = coalesce(p_ouvert, true) where x.id = p_etab;
  return jsonb_build_object('ok', true);
end $$;

-- Renommer l'établissement.
create or replace function public.etab_renommer(p_etab uuid, p_nom text, p_ville text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n text := btrim(coalesce(p_nom, ''));
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if char_length(n) < 2 or char_length(n) > 120 then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  update public.etablissements x set nom = n, ville = left(btrim(coalesce(p_ville, '')), 80) where x.id = p_etab;
  return jsonb_build_object('ok', true);
end $$;

-- Quitter un établissement (impossible pour le dernier administrateur).
create or replace function public.etab_quitter(p_etab uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); r text;
begin
  select m.role into r from public.etab_membres m where m.etab_id = p_etab and m.user_id = uid;
  if r is null then return jsonb_build_object('ok', true); end if;
  if r = 'admin' and (select count(*) from public.etab_membres m where m.etab_id = p_etab and m.role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'last_admin');
  end if;
  delete from public.registry_access a using public.registry_students g
   where a.registry_id = g.id and g.etab_id = p_etab and a.teacher_id = uid;
  delete from public.etab_membres m where m.etab_id = p_etab and m.user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function
  public.creer_etablissement(text, text), public.rejoindre_etablissement(text), public.mes_etablissements(),
  public.etab_membres_liste(uuid), public.etab_retirer(uuid, uuid), public.etab_definir_role(uuid, uuid, text),
  public.etab_nouveau_code(uuid), public.etab_ouvrir(uuid, boolean), public.etab_renommer(uuid, text, text),
  public.etab_quitter(uuid) from public;
grant execute on function
  public.creer_etablissement(text, text), public.rejoindre_etablissement(text), public.mes_etablissements(),
  public.etab_membres_liste(uuid), public.etab_retirer(uuid, uuid), public.etab_definir_role(uuid, uuid, text),
  public.etab_nouveau_code(uuid), public.etab_ouvrir(uuid, boolean), public.etab_renommer(uuid, text, text),
  public.etab_quitter(uuid) to authenticated;

-- 8. Contrôle : une ligne par établissement (nom, code, administrateurs, enseignants)
select x.nom, x.code,
       count(*) filter (where m.role = 'admin') as administrateurs,
       count(*) filter (where m.role = 'enseignant') as enseignants
from public.etablissements x left join public.etab_membres m on m.etab_id = x.id
group by x.id order by x.nom;

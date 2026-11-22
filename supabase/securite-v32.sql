-- Classe Master v32 : sécurité des dossiers élèves
-- À exécuter une fois dans Supabase > SQL Editor, après partage-admin.sql (et acces-admin.sql / code-enseignant.sql si déjà faits).
-- Ce script est rejouable sans danger.
--
-- Il met en place :
--  1. des règles Supabase qui réservent les dossiers élèves aux comptes administrateurs (et plus seulement à la page admin.html) ;
--  2. l'affectation des élèves aux enseignants : un enseignant ne peut publier un résumé ou lire un code que pour les élèves
--     que l'administrateur lui a affectés. Connaître une « Réf » ne suffit plus.

-- 0. Liste des administrateurs (identique à acces-admin.sql)
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Pour ne verrouiller personne dehors : ceux qui ont déjà des dossiers élèves deviennent administrateurs.
insert into public.admin_users (user_id)
select distinct user_id from public.registry_students
on conflict do nothing;

-- Pour ajouter un autre administrateur (remplacez l'adresse) :
-- insert into public.admin_users (user_id) select id from auth.users where lower(email) = lower('ADRESSE@EXEMPLE.COM') on conflict do nothing;

-- 1. Dossiers élèves : réservés aux administrateurs
drop policy if exists "registry_select_own" on public.registry_students;
drop policy if exists "registry_insert_own" on public.registry_students;
drop policy if exists "registry_update_own" on public.registry_students;
drop policy if exists "registry_delete_own" on public.registry_students;

create policy "registry_select_own" on public.registry_students
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_admin()));
create policy "registry_insert_own" on public.registry_students
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_admin()));
create policy "registry_update_own" on public.registry_students
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_admin()))
  with check (user_id = (select auth.uid()) and (select public.is_admin()));
create policy "registry_delete_own" on public.registry_students
  for delete to authenticated using (user_id = (select auth.uid()) and (select public.is_admin()));

-- 2. Affectation élève -> enseignant
create table if not exists public.registry_access (
  registry_id uuid not null references public.registry_students (id) on delete cascade,
  teacher_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (registry_id, teacher_id)
);
create index if not exists registry_access_teacher_idx on public.registry_access (teacher_id);
alter table public.registry_access enable row level security;   -- aucune règle : tout passe par les fonctions ci-dessous

-- Reprise de l'existant : les enseignants qui ont déjà publié un résumé lié gardent leur accès.
insert into public.registry_access (registry_id, teacher_id)
select g.id, s.user_id
from public.parent_shares s join public.registry_students g on g.ref = s.ref
where s.ref is not null
on conflict do nothing;

-- L'enseignant a-t-il le droit d'agir sur cette référence ? (administrateur propriétaire, ou enseignant affecté)
create or replace function public.can_use_ref(p_ref text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_ref is not null and exists (
    select 1 from public.registry_students g
    where g.ref = p_ref
      and (
        g.user_id = (select auth.uid())
        or exists (select 1 from public.registry_access a where a.registry_id = g.id and a.teacher_id = (select auth.uid()))
      )
  )
$$;
revoke all on function public.can_use_ref(text) from public;
grant execute on function public.can_use_ref(text) to authenticated;

-- Résumés parents : une référence n'est acceptée que si l'enseignant y a droit
drop policy if exists "shares_insert_own" on public.parent_shares;
drop policy if exists "shares_update_own" on public.parent_shares;
create policy "shares_insert_own" on public.parent_shares
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (ref is null or (select public.can_use_ref(ref))));
create policy "shares_update_own" on public.parent_shares
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (ref is null or (select public.can_use_ref(ref))));

-- Code famille : visible pour les élèves affectés (n'exige plus d'avoir déjà publié un résumé)
create or replace function public.get_family_code(p_ref text)
returns text language sql stable security definer set search_path = ''
as $$
  select g.code from public.registry_students g
  where g.ref = p_ref and char_length(p_ref) between 10 and 40 and (select public.can_use_ref(p_ref))
  limit 1
$$;
revoke all on function public.get_family_code(text) from public;
grant execute on function public.get_family_code(text) to authenticated;

-- 3. Fonctions de la page administrateur
-- Affecter à un enseignant (par e-mail) tous les élèves d'une classe ; classe vide = tous les élèves.
create or replace function public.admin_assign(p_email text, p_class text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n integer;
begin
  if not (select public.is_admin()) then raise exception 'not admin'; end if;
  select id into tid from auth.users where lower(email) = lower(trim(p_email));
  if tid is null then raise exception 'unknown teacher'; end if;
  insert into public.registry_access (registry_id, teacher_id)
  select g.id, tid from public.registry_students g
  where g.user_id = (select auth.uid()) and (coalesce(p_class,'') = '' or g.class_label = p_class)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_unassign(p_email text, p_class text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n integer;
begin
  if not (select public.is_admin()) then raise exception 'not admin'; end if;
  select id into tid from auth.users where lower(email) = lower(trim(p_email));
  if tid is null then return 0; end if;
  delete from public.registry_access a using public.registry_students g
  where a.registry_id = g.id and a.teacher_id = tid and g.user_id = (select auth.uid())
    and (coalesce(p_class,'') = '' or g.class_label = p_class);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_assignments()
returns table (email text, class_label text, n bigint)
language sql stable security definer set search_path = ''
as $$
  select u.email::text, g.class_label, count(*)
  from public.registry_access a
  join public.registry_students g on g.id = a.registry_id
  join auth.users u on u.id = a.teacher_id
  where g.user_id = (select auth.uid()) and (select public.is_admin())
  group by u.email, g.class_label
  order by u.email, g.class_label
$$;

revoke all on function public.admin_assign(text, text), public.admin_unassign(text, text), public.admin_assignments() from public;
grant execute on function public.admin_assign(text, text), public.admin_unassign(text, text), public.admin_assignments() to authenticated;

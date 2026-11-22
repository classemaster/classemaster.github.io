-- Classe Master v30 : comptes autorisés à ouvrir admin.html
-- À exécuter une fois dans Supabase > SQL Editor (après partage-admin.sql).

-- 1. Liste des administrateurs (personne ne peut la lire ni la modifier depuis l'application)
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;   -- aucune règle : accès réservé à l'éditeur SQL

-- 2. Fonction appelée par l'application : « mon compte est-il administrateur ? »
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Donner l'accès à un compte (remplacez l'adresse puis exécutez ; répétez pour chaque administrateur)
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('VOTRE-ADRESSE@EXEMPLE.COM')
on conflict do nothing;

-- Retirer l'accès :
-- delete from public.admin_users where user_id = (select id from auth.users where lower(email) = lower('ADRESSE'));

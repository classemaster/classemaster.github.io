-- Classe Master v61 : RENTRÉE (passage des élèves au niveau suivant) + protection des dossiers à la suppression d'un compte
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS etablissements-v60.sql. Faites d'abord une sauvegarde. Rejouable sans danger.

-- 1. Les dossiers appartiennent à l'ÉTABLISSEMENT, pas à celui qui les a créés ------------------------------------------------
-- Avant : si l'administrateur qui avait créé des dossiers supprimait son compte, ses dossiers (et les décisions saisies)
-- disparaissaient pour tout l'établissement. Désormais « créé par » est simplement vidé.
alter table public.registry_students  alter column user_id drop not null;
alter table public.registry_decisions alter column user_id drop not null;
alter table public.registry_students  drop constraint if exists registry_students_user_id_fkey;
alter table public.registry_students  add  constraint registry_students_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
alter table public.registry_decisions drop constraint if exists registry_decisions_user_id_fkey;
alter table public.registry_decisions add  constraint registry_decisions_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- Suppression de son compte : refusée pour le seul administrateur d'un établissement qui compte d'autres membres
-- (nommez d'abord un autre administrateur) ; un établissement qui n'a plus que lui est supprimé avec ses dossiers.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if exists (
    select 1 from public.etab_membres m
    where m.user_id = uid and m.role = 'admin'
      and not exists (select 1 from public.etab_membres o where o.etab_id = m.etab_id and o.role = 'admin' and o.user_id <> uid)
      and exists (select 1 from public.etab_membres t where t.etab_id = m.etab_id and t.user_id <> uid)
  ) then
    raise exception 'last admin';
  end if;
  delete from public.etablissements e
   where e.id in (select m.etab_id from public.etab_membres m where m.user_id = uid and m.role = 'admin')
     and not exists (select 1 from public.etab_membres o where o.etab_id = e.id and o.user_id <> uid);
  delete from auth.users where id = uid;   -- supprime aussi ses classes (cascade)
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Rentrée : historique des passages (un seul passage actif par établissement et par année) -----------------------------------
create table if not exists public.etab_rentrees (
  id        bigint generated always as identity primary key,
  etab_id   uuid        not null references public.etablissements (id) on delete cascade,
  year      text        not null check (char_length(year) between 4 and 12),   -- année terminée, ex. 2025-2026
  par       uuid        references auth.users (id) on delete set null,
  moves     jsonb       not null default '[]'::jsonb,                          -- [{ "from": "6e B", "to": "5e B", "ids": [...] }]
  nb        integer     not null default 0,
  cree_le   timestamptz not null default now(),
  annule_le timestamptz
);
create unique index if not exists etab_rentrees_actif_idx on public.etab_rentrees (etab_id, year) where annule_le is null;
alter table public.etab_rentrees enable row level security;   -- aucune règle : tout passe par les fonctions ci-dessous

-- Applique un passage : p_moves = [{ "from": "6e B", "to": "5e B", "ids": ["uuid", ...] }, ...].
-- Seuls les élèves de l'établissement qui sont ENCORE dans la classe « from » sont déplacés (protège d'un état périmé).
create or replace function public.appliquer_rentree(p_etab uuid, p_year text, p_moves jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare mv jsonb; ids uuid[]; mj jsonb; applied jsonb := '[]'::jsonb; n integer := 0; k integer;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_year is null or char_length(p_year) not between 4 and 12 then return jsonb_build_object('ok', false, 'err', 'bad_year'); end if;
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' then return jsonb_build_object('ok', false, 'err', 'bad_moves'); end if;
  if exists (select 1 from public.etab_rentrees r where r.etab_id = p_etab and r.year = p_year and r.annule_le is null) then
    return jsonb_build_object('ok', false, 'err', 'already_applied');
  end if;
  for mv in select * from jsonb_array_elements(p_moves) loop
    select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(mv -> 'ids') x;
    with u as (
      update public.registry_students g set class_label = left(btrim(coalesce(mv ->> 'to', '')), 80)
       where g.etab_id = p_etab and g.id = any (ids) and g.class_label = coalesce(mv ->> 'from', '')
      returning g.id
    )
    select coalesce(jsonb_agg(u.id), '[]'::jsonb) into mj from u;
    k := jsonb_array_length(mj);
    if k > 0 then
      applied := applied || jsonb_build_object('from', coalesce(mv ->> 'from', ''), 'to', left(btrim(coalesce(mv ->> 'to', '')), 80), 'ids', mj);
      n := n + k;
    end if;
  end loop;
  insert into public.etab_rentrees (etab_id, year, par, moves, nb) values (p_etab, p_year, (select auth.uid()), applied, n);
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- Annule le dernier passage de l'année : remet chaque élève dans sa classe d'origine (s'il n'a pas encore changé de classe depuis).
create or replace function public.annuler_rentree(p_etab uuid, p_year text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r record; mv jsonb; ids uuid[]; k integer; n integer := 0;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select * into r from public.etab_rentrees x where x.etab_id = p_etab and x.year = p_year and x.annule_le is null;
  if not found then return jsonb_build_object('ok', false, 'err', 'nothing'); end if;
  for mv in select * from jsonb_array_elements(r.moves) loop
    select coalesce(array_agg(x::uuid), '{}') into ids from jsonb_array_elements_text(mv -> 'ids') x;
    update public.registry_students g set class_label = left(coalesce(mv ->> 'from', ''), 80)
     where g.etab_id = p_etab and g.id = any (ids) and g.class_label = coalesce(mv ->> 'to', '');
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  update public.etab_rentrees x set annule_le = now() where x.id = r.id;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- Liste des passages de l'établissement (récents d'abord).
create or replace function public.rentrees_liste(p_etab uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('year', r.year, 'nb', r.nb, 'le', r.cree_le, 'annule', r.annule_le is not null)
                                    order by r.cree_le desc), '[]'::jsonb)
          from public.etab_rentrees r where r.etab_id = p_etab);
end $$;

revoke all on function public.appliquer_rentree(uuid, text, jsonb), public.annuler_rentree(uuid, text), public.rentrees_liste(uuid) from public;
grant execute on function public.appliquer_rentree(uuid, text, jsonb), public.annuler_rentree(uuid, text), public.rentrees_liste(uuid) to authenticated;

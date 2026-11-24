-- Classe Master v63 : VALIDATION DES ÉTABLISSEMENTS par les administrateurs de Classe Master
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS etablissements-v60.sql (et rentree-v61.sql). Rejouable sans danger.
-- Ne rejouez pas etablissements-v60.sql APRÈS celui-ci : il remettrait l'ancien fonctionnement (rejouez alors celui-ci en dernier).
--
-- Principe :
--  * un établissement créé par un chef d'établissement est « en_attente » ;
--  * tant qu'il n'est pas « valide », son chef n'a PAS accès au tableau de bord, aux dossiers élèves, à la gestion des
--    enseignants ni au code d'accès (le serveur refuse : ce n'est pas qu'un affichage), et personne ne peut le rejoindre ;
--  * un administrateur de Classe Master (table plateforme_admins, remplie uniquement depuis l'éditeur SQL) le valide ou le refuse ;
--  * les établissements qui existent déjà sont considérés comme validés (rien ne change pour eux).

-- 1. Statut de l'établissement ----------------------------------------------------------------------------------------------
-- Les lignes déjà présentes passent en « valide » (valeur par défaut au moment de l'ajout de la colonne), puis les NOUVEAUX
-- établissements démarrent « en_attente ».
alter table public.etablissements add column if not exists statut    text not null default 'valide';
alter table public.etablissements add column if not exists motif     text not null default '';
alter table public.etablissements add column if not exists decide_le timestamptz;
alter table public.etablissements add column if not exists decide_par uuid references auth.users (id) on delete set null;
alter table public.etablissements drop constraint if exists etablissements_statut_check;
alter table public.etablissements add constraint etablissements_statut_check check (statut in ('en_attente', 'valide', 'refuse'));
alter table public.etablissements alter column statut set default 'en_attente';
update public.etablissements set verifie = true where statut = 'valide' and verifie = false;
create index if not exists etablissements_statut_idx on public.etablissements (statut, created_at);

-- 2. Administrateurs de Classe Master (les seuls à valider) ---------------------------------------------------------------------
-- Table distincte de admin_users : un chef d'établissement validé n'est PAS administrateur de la plateforme.
create table if not exists public.plateforme_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  depuis  timestamptz not null default now()
);
alter table public.plateforme_admins enable row level security;   -- aucune règle : personne ne la lit ni ne la modifie depuis l'application

create or replace function public.est_admin_plateforme()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.plateforme_admins p where p.user_id = (select auth.uid())) $$;
revoke all on function public.est_admin_plateforme() from public;
grant execute on function public.est_admin_plateforme() to authenticated;

-- 3. Le serveur refuse tout accès « administrateur » tant que l'établissement n'est pas validé -----------------------------------
create or replace function public.is_etab_admin(p_etab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_etab is not null and exists (
  select 1 from public.etab_membres m join public.etablissements x on x.id = m.etab_id
   where m.etab_id = p_etab and m.user_id = (select auth.uid()) and m.role = 'admin' and x.statut = 'valide') $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.etab_membres m join public.etablissements x on x.id = m.etab_id
   where m.user_id = (select auth.uid()) and m.role = 'admin' and x.statut = 'valide') $$;

-- 4. Création : l'établissement démarre « en_attente » ---------------------------------------------------------------------------
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
  insert into public.etablissements (nom, ville, code, cree_par, statut)
  values (n, left(btrim(coalesce(p_ville, '')), 80), c, uid, 'en_attente') returning id into e;
  insert into public.etab_membres (etab_id, user_id, role) values (e, uid, 'admin');
  return jsonb_build_object('ok', true, 'id', e, 'nom', n, 'statut', 'en_attente');
end $$;

-- 5. On ne rejoint qu'un établissement validé ------------------------------------------------------------------------------------
create or replace function public.rejoindre_etablissement(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); e record; fails integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.etab_essais t where t.at < now() - interval '1 day';
  select count(*) into fails from public.etab_essais t where t.user_id = uid and t.at > now() - interval '15 minutes';
  if fails >= 8 then return jsonb_build_object('ok', false, 'err', 'too_many_attempts'); end if;
  select x.id, x.nom, x.ouvert, x.statut into e from public.etablissements x where x.code = c;
  if not found then
    insert into public.etab_essais (user_id) values (uid);
    return jsonb_build_object('ok', false, 'err', 'unknown_code');
  end if;
  if e.statut <> 'valide' then return jsonb_build_object('ok', false, 'err', 'pending'); end if;
  if not e.ouvert and not exists (select 1 from public.etab_membres m where m.etab_id = e.id and m.user_id = uid) then
    return jsonb_build_object('ok', false, 'err', 'closed');
  end if;
  insert into public.etab_membres (etab_id, user_id, role) values (e.id, uid, 'enseignant') on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', e.id, 'nom', e.nom);
end $$;

-- 6. Mes établissements : statut et motif ; le code n'est donné qu'aux administrateurs d'un établissement VALIDÉ ------------------
create or replace function public.mes_etablissements()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'nom', x.nom, 'ville', x.ville, 'role', m.role,
           'code', case when m.role = 'admin' and x.statut = 'valide' then x.code end,
           'ouvert', x.ouvert, 'verifie', x.verifie, 'statut', x.statut,
           'motif', case when m.role = 'admin' then x.motif else '' end,
           'membres', (select count(*) from public.etab_membres q where q.etab_id = x.id)
         ) order by m.depuis), '[]'::jsonb)
  from public.etab_membres m join public.etablissements x on x.id = m.etab_id
  where m.user_id = (select auth.uid())
$$;

-- 7. Annuler sa demande (seulement tant que l'établissement n'est pas validé, et seulement par son créateur, s'il y est seul) -------
create or replace function public.etab_annuler_demande(p_etab uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); x record;
begin
  select e.id, e.statut, e.cree_par into x from public.etablissements e where e.id = p_etab;
  if not found then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  if x.cree_par is distinct from uid or x.statut = 'valide'
     or exists (select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id <> uid) then
    return jsonb_build_object('ok', false, 'err', 'not_allowed');
  end if;
  delete from public.etablissements e where e.id = p_etab;
  return jsonb_build_object('ok', true);
end $$;

-- 8. Administration du site (administrateurs de Classe Master) : liste des établissements, puis décision -----------------------------------------------------
-- L'administrateur de Classe Master voit : le nom, la ville, l'état, les responsables (chefs d'établissement) et le NOMBRE d'enseignants.
-- Il ne reçoit AUCUNE classe, AUCUN élève, AUCUNE salle ni aucun résultat : ces données restent réservées au chef d'établissement.
create or replace function public.sa_etablissements(p_statut text default 'en_attente')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.est_admin_plateforme()) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', x.id, 'nom', x.nom, 'ville', x.ville, 'statut', x.statut, 'motif', x.motif, 'cree', x.created_at,
            'createur_email', u.email, 'createur_nom', coalesce(u.raw_user_meta_data ->> 'name', ''),
            'chefs', (select coalesce(jsonb_agg(jsonb_build_object('nom', coalesce(cu.raw_user_meta_data ->> 'name', ''), 'email', cu.email) order by m.depuis), '[]'::jsonb)
                        from public.etab_membres m join auth.users cu on cu.id = m.user_id
                       where m.etab_id = x.id and m.role = 'admin'),
            'enseignants', (select count(*) from public.etab_membres m where m.etab_id = x.id and m.role = 'enseignant')
          ) order by (x.statut <> 'en_attente'), x.created_at desc), '[]'::jsonb)
          from public.etablissements x left join auth.users u on u.id = x.cree_par
          where p_statut is null or x.statut = p_statut);
end $$;

create or replace function public.sa_decider_etablissement(p_etab uuid, p_valide boolean, p_motif text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  update public.etablissements x
     set statut = case when p_valide then 'valide' else 'refuse' end,
         verifie = coalesce(p_valide, false),
         motif = case when p_valide then '' else left(btrim(coalesce(p_motif, '')), 300) end,
         decide_le = now(), decide_par = (select auth.uid())
   where x.id = p_etab and x.statut <> 'valide';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function
  public.creer_etablissement(text, text), public.rejoindre_etablissement(text), public.mes_etablissements(),
  public.etab_annuler_demande(uuid), public.sa_etablissements(text), public.sa_decider_etablissement(uuid, boolean, text) from public;
grant execute on function
  public.creer_etablissement(text, text), public.rejoindre_etablissement(text), public.mes_etablissements(),
  public.etab_annuler_demande(uuid), public.sa_etablissements(text), public.sa_decider_etablissement(uuid, boolean, text) to authenticated;

-- 9. Vous donner le rôle d'administrateur de Classe Master (remplacez l'adresse, décommentez, exécutez ; répétez pour chaque personne)
-- insert into public.plateforme_admins (user_id)
-- select id from auth.users where lower(email) = lower('VOTRE-ADRESSE@exemple.com') on conflict do nothing;
-- Retirer : delete from public.plateforme_admins where user_id = (select id from auth.users where lower(email) = lower('ADRESSE'));

-- 10. Contrôle : établissements par statut
select x.statut, count(*) as nb from public.etablissements x group by x.statut order by x.statut;

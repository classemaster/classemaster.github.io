-- Classe Master v78 : SUPPRIMER UN ÉTABLISSEMENT SUSPENDU OU REFUSÉ (administrateur du site)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS contact-v73.sql. Faites d'abord une sauvegarde. Rejouable sans danger.
-- Ce script n'en remplace aucun autre : il ajoute deux fonctions réservées aux administrateurs de Classe Master
-- (table plateforme_admins, vérifiée par le serveur : est_admin_plateforme) et une petite table d'archive.
--
-- Garde-fous :
--  * seul un établissement SUSPENDU ou REFUSÉ peut être supprimé (un établissement validé ou en attente doit d'abord être suspendu) ;
--  * l'administrateur doit retaper le nom exact de l'établissement (vérifié par le serveur) ;
--  * un aperçu indique d'abord combien d'enseignants et de dossiers d'élèves seront effacés.
--
-- Ce qui est effacé, définitivement : l'établissement, ses membres, ses messages, les dossiers d'élèves et leurs liens famille,
-- les accès des enseignants à ces dossiers, les résumés publiés pour les parents, la rentrée en cours et le journal de l'établissement.
-- Ce qui reste : les classes et notes gardées dans l'application de chaque enseignant (sur son appareil et dans son compte), et les
-- demandes d'aide envoyées à l'équipe (elles perdent seulement le lien avec l'établissement).
-- Les enseignants et le chef de cet établissement retombent sur l'écran « Votre établissement » à leur prochaine ouverture.
-- Une ligne d'archive (nom, ville, date, auteur, effectifs) est conservée dans plateforme_suppressions, lisible depuis l'éditeur SQL.

create table if not exists public.plateforme_suppressions (
  id          uuid        primary key default gen_random_uuid(),
  nom         text        not null,
  ville       text        not null default '',
  statut      text        not null default '',
  eleves      integer     not null default 0,
  enseignants integer     not null default 0,
  supprime_le timestamptz not null default now(),
  par         uuid        references auth.users (id) on delete set null
);
alter table public.plateforme_suppressions enable row level security;   -- aucune règle : lisible seulement depuis l'éditeur SQL

-- 1. Aperçu : ce que la suppression effacerait ----------------------------------------------------------------------------------------------
create or replace function public.sa_apercu_suppression(p_etab uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare x record;
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  select e.id, e.nom, e.statut into x from public.etablissements e where e.id = p_etab;
  if not found then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  if x.statut not in ('suspendu', 'refuse') then return jsonb_build_object('ok', false, 'err', 'not_deletable'); end if;
  return jsonb_build_object('ok', true, 'nom', x.nom,
    'eleves', (select count(*) from public.registry_students g where g.etab_id = p_etab),
    'membres', (select count(*) from public.etab_membres m where m.etab_id = p_etab));
end $$;

-- 2. Suppression -------------------------------------------------------------------------------------------------------------------------------
create or replace function public.sa_supprimer_etablissement(p_etab uuid, p_nom text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare x record; ne integer; nm integer;
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  select e.id, e.nom, e.ville, e.statut into x from public.etablissements e where e.id = p_etab for update;
  if not found then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  if x.statut not in ('suspendu', 'refuse') then return jsonb_build_object('ok', false, 'err', 'not_deletable'); end if;
  if lower(btrim(coalesce(p_nom, ''))) <> lower(btrim(x.nom)) then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  select count(*) into ne from public.registry_students g where g.etab_id = p_etab;
  select count(*) into nm from public.etab_membres m where m.etab_id = p_etab;
  -- résumés publiés pour les familles (sans clé étrangère) : à retirer avant les dossiers
  delete from public.parent_shares s where s.ref in (select g.ref from public.registry_students g where g.etab_id = p_etab);
  insert into public.plateforme_suppressions (nom, ville, statut, eleves, enseignants, par)
  values (x.nom, x.ville, x.statut, ne, nm, (select auth.uid()));
  delete from public.etablissements e where e.id = p_etab;   -- supprime en cascade membres, dossiers, accès, messages, rentrée
  delete from public.registry_log l where l.etab_id = p_etab;   -- après : la suppression des dossiers inscrit elle-même des « départs » dans le journal
  return jsonb_build_object('ok', true, 'eleves', ne, 'membres', nm);
end $$;

revoke all on function public.sa_apercu_suppression(uuid), public.sa_supprimer_etablissement(uuid, text) from public;
grant execute on function public.sa_apercu_suppression(uuid), public.sa_supprimer_etablissement(uuid, text) to authenticated;

-- Contrôle : établissements par statut, puis archive des suppressions
select x.statut, count(*) as nb from public.etablissements x group by x.statut order by x.statut;
select s.nom, s.ville, s.eleves, s.enseignants, s.supprime_le from public.plateforme_suppressions s order by s.supprime_le desc limit 10;

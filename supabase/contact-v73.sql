-- Classe Master v73 : CONTACTER LES ADMINISTRATEURS DU SITE (chefs d'établissement et enseignants)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS aide-chefs-v72.sql. Faites d'abord une sauvegarde. Rejouable sans danger.
-- Ce script n'en remplace aucun autre.
--
-- Principe :
--  * toute personne connectée (chef ou enseignant) écrit une demande à l'équipe Classe Master depuis la page contact.html,
--    avec un sujet, une catégorie et, si elle le souhaite, l'établissement concerné (dont elle doit être membre) ;
--  * la demande est une conversation : la personne peut ajouter des messages, un administrateur du site répond ;
--  * l'administrateur du site (table plateforme_admins, vérifiée par le serveur : est_admin_plateforme) voit les demandes dans
--    admin.html, avec l'adresse et le nom de l'expéditeur et son établissement. Il ne voit toujours aucune classe ni aucun élève ;
--  * l'expéditeur ne voit jamais l'adresse de l'administrateur qui lui répond ;
--  * aucune adresse e-mail n'est envoyée : chacun voit les nouveaux messages en ouvrant la page.
--  * limites contre les abus : 5 nouvelles demandes par 24 h et 10 demandes ouvertes au plus par personne ; 10 messages par heure.

-- 1. Tables ------------------------------------------------------------------------------------------------------------------------------------
create table if not exists public.contact_demandes (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  etab_id      uuid        references public.etablissements (id) on delete set null,
  categorie    text        not null default 'question' check (categorie in ('question', 'probleme', 'code', 'etablissement', 'autre')),
  sujet        text        not null check (char_length(btrim(sujet)) between 1 and 100),
  statut       text        not null default 'ouvert' check (statut in ('ouvert', 'traite')),
  non_lu_admin boolean     not null default true,
  non_lu_user  boolean     not null default false,
  created_at   timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);
create index if not exists contact_demandes_user_idx   on public.contact_demandes (user_id, maj_le desc);
create index if not exists contact_demandes_statut_idx on public.contact_demandes (statut, maj_le desc);

create table if not exists public.contact_echanges (
  id         uuid        primary key default gen_random_uuid(),
  demande_id uuid        not null references public.contact_demandes (id) on delete cascade,
  de_admin   boolean     not null default false,
  auteur     uuid        references auth.users (id) on delete set null,
  corps      text        not null check (char_length(btrim(corps)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists contact_echanges_idx on public.contact_echanges (demande_id, created_at);

alter table public.contact_demandes enable row level security;   -- aucune règle : tout passe par les fonctions ci-dessous
alter table public.contact_echanges enable row level security;

-- 2. Côté enseignant / chef --------------------------------------------------------------------------------------------------------------------
create or replace function public.contact_envoyer(p_etab uuid, p_categorie text, p_sujet text, p_corps text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); s text := btrim(coalesce(p_sujet, '')); b text := btrim(coalesce(p_corps, '')); cat text := coalesce(p_categorie, 'autre'); d uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if char_length(s) < 1 or char_length(s) > 100 or char_length(b) < 1 or char_length(b) > 2000 then
    return jsonb_build_object('ok', false, 'err', 'bad_input');
  end if;
  if cat not in ('question', 'probleme', 'code', 'etablissement', 'autre') then cat := 'autre'; end if;
  if p_etab is not null and not exists (select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = uid) then
    return jsonb_build_object('ok', false, 'err', 'not_member');
  end if;
  if (select count(*) from public.contact_demandes q where q.user_id = uid and q.created_at > now() - interval '24 hours') >= 5
     or (select count(*) from public.contact_demandes q where q.user_id = uid and q.statut = 'ouvert') >= 10 then
    return jsonb_build_object('ok', false, 'err', 'too_many');
  end if;
  insert into public.contact_demandes (user_id, etab_id, categorie, sujet) values (uid, p_etab, cat, s) returning id into d;
  insert into public.contact_echanges (demande_id, de_admin, auteur, corps) values (d, false, uid, b);
  return jsonb_build_object('ok', true, 'id', d);
end $$;

create or replace function public.contact_repondre(p_id uuid, p_corps text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); b text := btrim(coalesce(p_corps, ''));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if char_length(b) < 1 or char_length(b) > 2000 then return jsonb_build_object('ok', false, 'err', 'bad_input'); end if;
  if not exists (select 1 from public.contact_demandes q where q.id = p_id and q.user_id = uid) then
    return jsonb_build_object('ok', false, 'err', 'not_found');
  end if;
  if (select count(*) from public.contact_echanges e where e.auteur = uid and e.de_admin = false and e.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'err', 'too_many');
  end if;
  insert into public.contact_echanges (demande_id, de_admin, auteur, corps) values (p_id, false, uid, b);
  update public.contact_demandes q set statut = 'ouvert', non_lu_admin = true, maj_le = now() where q.id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.contact_mes_demandes()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.maj_le desc), '[]'::jsonb) from (
            select q.id, q.categorie, q.sujet, q.statut, q.non_lu_user as non_lu, q.created_at, q.maj_le, x.nom as etab_nom,
                   (select coalesce(jsonb_agg(jsonb_build_object('de_admin', e.de_admin, 'corps', e.corps, 'created_at', e.created_at)
                                              order by e.created_at), '[]'::jsonb)
                      from public.contact_echanges e where e.demande_id = q.id) as echanges
              from public.contact_demandes q left join public.etablissements x on x.id = q.etab_id
             where q.user_id = uid
             order by q.maj_le desc limit 50) r);
end $$;

create or replace function public.contact_marquer_lu(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  update public.contact_demandes q set non_lu_user = false where q.id = p_id and q.user_id = (select auth.uid());
  return jsonb_build_object('ok', true);
end $$;

-- 3. Côté administrateur du site ---------------------------------------------------------------------------------------------------------------
create or replace function public.sa_contact_liste(p_statut text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.est_admin_plateforme()) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r) order by (r.statut = 'traite'), r.maj_le desc), '[]'::jsonb) from (
            select q.id, q.categorie, q.sujet, q.statut, q.non_lu_admin as non_lu, q.created_at, q.maj_le,
                   u.email as de_email, coalesce(u.raw_user_meta_data ->> 'name', '') as de_nom,
                   q.etab_id, x.nom as etab_nom, x.ville as etab_ville,
                   (select m.role from public.etab_membres m where m.etab_id = q.etab_id and m.user_id = q.user_id) as role,
                   (select coalesce(jsonb_agg(jsonb_build_object('de_admin', e.de_admin, 'corps', e.corps, 'created_at', e.created_at)
                                              order by e.created_at), '[]'::jsonb)
                      from public.contact_echanges e where e.demande_id = q.id) as echanges
              from public.contact_demandes q
              join auth.users u on u.id = q.user_id
              left join public.etablissements x on x.id = q.etab_id
             where p_statut is null or q.statut = p_statut
             order by (q.statut = 'traite'), q.maj_le desc limit 200) r);
end $$;

create or replace function public.sa_contact_repondre(p_id uuid, p_corps text, p_clore boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare b text := btrim(coalesce(p_corps, ''));
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  if char_length(b) < 1 or char_length(b) > 2000 then return jsonb_build_object('ok', false, 'err', 'bad_input'); end if;
  if not exists (select 1 from public.contact_demandes q where q.id = p_id) then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  insert into public.contact_echanges (demande_id, de_admin, auteur, corps) values (p_id, true, (select auth.uid()), b);
  update public.contact_demandes q
     set statut = case when coalesce(p_clore, false) then 'traite' else q.statut end,
         non_lu_user = true, non_lu_admin = false, maj_le = now()
   where q.id = p_id;
  return jsonb_build_object('ok', true);
end $$;

--    Clore ou rouvrir une demande sans écrire de message ; marquer comme lue (p_statut null = changer seulement l'état « lu »).
create or replace function public.sa_contact_statut(p_id uuid, p_statut text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  if p_statut is not null and p_statut not in ('ouvert', 'traite') then return jsonb_build_object('ok', false, 'err', 'bad_status'); end if;
  update public.contact_demandes q set statut = coalesce(p_statut, q.statut), non_lu_admin = false where q.id = p_id;
  if not found then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 4. Droits ----------------------------------------------------------------------------------------------------------------------------------------
revoke all on function
  public.contact_envoyer(uuid, text, text, text), public.contact_repondre(uuid, text), public.contact_mes_demandes(), public.contact_marquer_lu(uuid),
  public.sa_contact_liste(text), public.sa_contact_repondre(uuid, text, boolean), public.sa_contact_statut(uuid, text) from public;
grant execute on function
  public.contact_envoyer(uuid, text, text, text), public.contact_repondre(uuid, text), public.contact_mes_demandes(), public.contact_marquer_lu(uuid),
  public.sa_contact_liste(text), public.sa_contact_repondre(uuid, text, boolean), public.sa_contact_statut(uuid, text) to authenticated;

-- 5. Contrôle : demandes par état
select q.statut, count(*) as nb from public.contact_demandes q group by q.statut order by q.statut;

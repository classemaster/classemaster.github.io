# Classe Master — mise en route de Supabase

Site : https://classemaster.github.io/

1. **Base de données** : Supabase > SQL Editor > New query > coller le contenu de `schema.sql` > Run.
2. **Clé publique** : Supabase > Project Settings > API Keys > copier la clé « anon / publishable ».
   La coller dans `js/supabase.js`, à la place de la clé publique.
   (Cette clé est faite pour être publique ; la protection vient des règles RLS du schéma.)
3. **Adresses autorisées** : Authentication > URL Configuration
   - Site URL : `https://classemaster.github.io/`
   - Redirect URLs : `https://classemaster.github.io/**`
4. **E-mails** : Authentication > Providers > Email. **Laissez « Confirm email » désactivé** : les comptes sont actifs immédiatement, sans e-mail de confirmation (l'application connecte l'utilisateur dès l'inscription). L'application ne gère pas la confirmation par e-mail.
5. **Google (facultatif)** : Authentication > Providers > Google, puis renseigner l'ID et le secret client Google Cloud.
   Tant que ce n'est pas fait, le bouton affiche « La connexion avec Google n'est pas activée ».
6. **Suivi parent (lien en lecture seule)** : Supabase > SQL Editor > New query > coller le contenu de `partage-parents.sql` > Run. À faire une seule fois ; sans cela, le lien parent affiche une erreur.
7. **Dossiers élèves et lien unique famille** : SQL Editor > New query > coller le contenu de `partage-admin.sql` > Run. À faire une seule fois, après l'étape 6 ; sans cela, la page `admin.html` affiche une erreur (les liens par matière continuent de marcher). Ensuite, l'administrateur ouvre `https://classemaster.github.io/admin.html`.
8. **Tableau de bord administrateur (v46)** : SQL Editor > New query > coller le contenu de `tableau-bord-admin.sql` > Run. À faire après `acces-admin.sql` ; si une version précédente l'avait déjà exécuté, le **réexécuter pour la v51** (rien n'est perdu) : il ajoute la lecture sûre des valeurs, qui empêche une donnée mal formée de faire échouer tout le tableau de bord. Sans cela, le tableau de bord affiche « Statistiques indisponibles » et les départs ne sont pas enregistrés.
9. **Enseignants, discipline, fin de période (v47)** : SQL Editor > New query > coller le contenu de `vie-scolaire-admin.sql` > Run. À faire après l'étape 8 ; peut être réexécuté sans risque. Sans cela, les onglets Enseignants, Discipline et Fin de période affichent « Indisponible », et les décisions de passage ne sont pas enregistrées. Ce script retire aussi les incidents de discipline des données lues par les parents.
9bis. **Établissements et codes d'accès (v60)** : SQL Editor > New query > coller le contenu de `etablissements-v60.sql` > Run, **après tous les scripts précédents** et après une sauvegarde. Rejouable sans risque. Chaque administrateur actuel reçoit automatiquement un établissement « Mon établissement » (ou le nom saisi dans son profil) avec ses élèves ; les enseignants déjà affectés en deviennent membres ; les autres enseignants rejoignent leur établissement avec le code à leur prochaine connexion. Le script affiche à la fin la liste des établissements avec leur code. **Ne rejouez pas** les scripts des étapes 7 à 9 après celui-ci (ils remettraient l'ancien fonctionnement) : si vous le faites, rejouez `etablissements-v60.sql` en dernier. Sans ce script, l'application fonctionne comme avant.
9ter. **Rentrée et protection des dossiers (v61)** : après l'étape 9bis, collez le contenu de `rentree-v61.sql` > Run (après sauvegarde, rejouable). Il active le passage des élèves au niveau suivant (Administration › Rentrée, annulable), fait en sorte que les dossiers appartiennent à l'établissement et non à celui qui les a créés (un administrateur qui supprime son compte n'efface plus les dossiers des autres), et empêche le seul administrateur d'un établissement qui compte d'autres membres de supprimer son compte avant d'avoir nommé un autre administrateur.
10. Un guide pas à pas pour l'administrateur (accès, quotidien, dépannage) est dans `aide-etablissement.html`, lié depuis `etablissement.html` (bouton « Guide »).
11. Publier les fichiers sur le dépôt GitHub `classemaster.github.io`.

Les anciens comptes locaux : à la première ouverture, l'utilisateur se connecte (ou crée son compte) avec la même adresse e-mail et retrouve ses données de l'appareil, qui sont ensuite envoyées en ligne.

## Mode hors ligne
- L'application s'installe en cache au premier chargement (`sw.js`) et s'ouvre ensuite sans internet. La bibliothèque Supabase est hébergée dans `js/vendor/supabase.js`.
- **Après chaque mise à jour du site**, changez `VERSION` en haut de `sw.js` (ex. `cm-v4`) pour que les téléphones récupèrent les nouveaux fichiers.
- Sans internet, on peut créer un compte et se connecter : les données restent sur l'appareil. Au retour d'internet, un bandeau « Finaliser » demande le mot de passe une fois pour créer le compte Supabase et envoyer les données.

## Validation des établissements (v63)
Exécutez `validation-etablissements-v63.sql` **après** `etablissements-v60.sql` et `rentree-v61.sql`. Un établissement créé par un chef d'établissement est alors « en attente » : son chef n'a ni tableau de bord, ni code d'accès, et personne ne peut le rejoindre, tant qu'un administrateur de Classe Master ne l'a pas validé (menu Compte > « Administration du site », réservée aux administrateurs de Classe Master, qui ne voient aucune classe ni aucun élève). Les établissements déjà existants restent validés.
Pour vous nommer administrateur de Classe Master, décommentez l'étape 9 du script (adresse e-mail de votre compte), puis exécutez-le.


## Décisions réversibles (v70)
Exécutez `validation-reversible-v70.sql` **après** `validation-etablissements-v63.sql` (rejouable ; à rejouer en dernier si vous rejouez le script v63). Un établissement validé peut alors être **suspendu** puis réactivé, et un établissement refusé peut être validé ensuite, depuis `admin.html`. Pendant une suspension, le chef n'a plus accès au tableau de bord, aux dossiers ni au code, et personne ne peut rejoindre l'établissement ; les enseignants déjà inscrits gardent leurs classes. La page affiche aussi qui a décidé et quand, une recherche par nom ou ville, et signale les doublons possibles (même nom, même ville). Sans ce script, `admin.html` affiche une erreur au moment de valider ou de suspendre.

## Gestion de l'établissement (v71)
Exécutez `gestion-v71.sql` **après** `validation-reversible-v70.sql` (après sauvegarde, rejouable ; à rejouer en dernier si vous rejouez les scripts v60 ou v63). Il ajoute :
- **Validation des enseignants** : le chef peut exiger qu'un enseignant qui rejoint avec le code soit accepté. Tant qu'il est « en attente », le serveur ne lui ouvre aucun dossier d'élève.
- **Transfert d'élèves** vers une autre classe (page du chef, dans une classe). Les accès des enseignants à ces élèves sont retirés : le chef réaffecte ensuite les enseignants de la nouvelle classe.
- **Seuils d'alerte** réglables par établissement : moyenne, présence, absences sur 14 jours (valeurs d'origine 10, 80 %, 3). Les retards gardent un seuil fixe de 3.
- **Messages** du chef à tous les enseignants (affichés dans l'application) ou à toutes les familles (affichés dans l'espace parents, avec le code famille ; le lien d'une seule matière `?t=` n'affiche pas les messages).
- **Journal des actions** (visible du seul chef) : départs, transferts, enseignants acceptés, refusés ou retirés, rôles, codes, inscriptions, renommage, seuils, messages. Les actions faites par la rentrée (passage de niveau) ne sont pas encore journalisées.
Sans ce script, la page du chef affiche « indisponible » pour les messages et le journal, et les seuils restent aux valeurs d'origine.

## Aider un chef et chiffres d'usage (v72)
Exécutez `aide-chefs-v72.sql` **après** `gestion-v71.sql` (après sauvegarde, rejouable). Il ajoute, pour l'administrateur du site seulement (`admin.html`) :
- **Nouveau code** d'accès pour un établissement validé : l'ancien code cesse de fonctionner, les enseignants déjà inscrits restent membres. Le code s'affiche sur la carte, à transmettre au chef.
- **Changer de chef** : désigner un chef par son e-mail (le compte doit exister), en retirant ou non les droits de chef aux responsables actuels (ils restent enseignants).
- **Chiffres d'usage anonymes** : établissements actifs ou sans activité sur 30 jours, nombre d'enseignants, dernière activité (connexion d'un membre ou mise à jour d'un lien parent). Aucune donnée d'élève.
Ces actions apparaissent dans le journal du chef. Sans ce script, `admin.html` affiche « Chiffres d'usage indisponibles » et les deux boutons échouent avec un message d'erreur. La gestion des autres administrateurs du site reste en SQL (`plateforme_admins`).

## Contacter les administrateurs (v73)
Exécutez `contact-v73.sql` **après** `aide-chefs-v72.sql` (après sauvegarde, rejouable). Les chefs d'établissement et les enseignants écrivent à l'équipe Classe Master depuis `contact.html` (bouton « Écrire à un administrateur » de l'onglet Compte, ou « Contacter un administrateur » sur la page du chef) ; l'administrateur du site lit et répond dans la rubrique **Demandes** de `admin.html`. Chaque demande est une conversation ; l'expéditeur ne voit jamais l'adresse de l'administrateur qui répond. Aucun e-mail n'est envoyé : les nouveaux messages se voient en ouvrant la page. Sans ce script, la page de contact affiche une erreur et la rubrique Demandes indique « Messagerie indisponible ».

## Supprimer un établissement (v78)
Exécutez `suppression-v78.sql` **après** `contact-v73.sql` (après sauvegarde, rejouable). L'administrateur du site (`admin.html`) peut alors supprimer un établissement **suspendu ou refusé** : aperçu des dossiers concernés, nom à retaper, effacement définitif de l'établissement, de ses membres, messages, dossiers d'élèves et liens famille, résumés parents, rentrée et journal. Les classes gardées dans l'application de chaque enseignant restent. Une archive (nom, ville, date, auteur, effectifs) est conservée dans `plateforme_suppressions`. Sans ce script, le bouton « Supprimer » affiche « Suppression indisponible ».

## Les deux pages d'administration
- **`etablissement.html` — le chef d'établissement** : classes, enseignants (retirer, nommer un autre chef, renommer l'établissement), codes, dossiers des élèves, liens parents. Le compte se crée dans l'application (choix « Chef d'établissement »), plus depuis cette page. Le bouton « Gestion de l'établissement » de l'onglet Compte y mène (visible seulement pour un chef dont l'établissement est validé).
- **`admin.html` — l'administrateur du site (vous)** : liste des établissements, validation, refus, suspension et réactivation, recherche, nouveau code, changement de chef, chiffres d'usage. Aucun bouton de l'application n'y mène : ouvrez l'adresse `…/admin.html` et connectez-vous. Pour tout autre compte, la page affiche seulement « Page introuvable » (le droit est vérifié par le serveur : `est_admin_plateforme`). Elle n'est pas mise en cache hors ligne et n'est pas référencée par les moteurs de recherche.

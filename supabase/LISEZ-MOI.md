# Classe Master — mise en route de Supabase

Site : https://classemaster.github.io/

1. **Base de données** : Supabase > SQL Editor > New query > coller le contenu de `schema.sql` > Run.
2. **Clé publique** : Supabase > Project Settings > API Keys > copier la clé « anon / publishable ».
   La coller dans `js/supabase.js`, à la place de la clé publique.
   (Cette clé est faite pour être publique ; la protection vient des règles RLS du schéma.)
3. **Adresses autorisées** : Authentication > URL Configuration
   - Site URL : `https://classemaster.github.io/`
   - Redirect URLs : `https://classemaster.github.io/**`
4. **E-mails** : Authentication > Providers > Email. **Désactivez « Confirm email »** : les comptes sont alors actifs immédiatement, sans e-mail de confirmation (l'application connecte l'utilisateur dès l'inscription).
5. **Google (facultatif)** : Authentication > Providers > Google, puis renseigner l'ID et le secret client Google Cloud.
   Tant que ce n'est pas fait, le bouton affiche « La connexion avec Google n'est pas activée ».
6. **Suivi parent (lien en lecture seule)** : Supabase > SQL Editor > New query > coller le contenu de `partage-parents.sql` > Run. À faire une seule fois ; sans cela, le lien parent affiche une erreur.
7. **Dossiers élèves et lien unique famille** : SQL Editor > New query > coller le contenu de `partage-admin.sql` > Run. À faire une seule fois, après l'étape 6 ; sans cela, la page `admin.html` affiche une erreur (les liens par matière continuent de marcher). Ensuite, l'administrateur ouvre `https://classemaster.github.io/admin.html`.
8. **Tableau de bord administrateur (v46)** : SQL Editor > New query > coller le contenu de `tableau-bord-admin.sql` > Run. À faire après `acces-admin.sql` ; si la v45 l'avait déjà exécuté, le réexécuter pour la v46 (rien n'est perdu). Sans cela, le tableau de bord affiche « Statistiques indisponibles » et les départs ne sont pas enregistrés.
9. **Enseignants, discipline, fin de période (v47)** : SQL Editor > New query > coller le contenu de `vie-scolaire-admin.sql` > Run. À faire après l'étape 8 ; peut être réexécuté sans risque. Sans cela, les onglets Enseignants, Discipline et Fin de période affichent « Indisponible », et les décisions de passage ne sont pas enregistrées. Ce script retire aussi les incidents de discipline des données lues par les parents.
10. Publier les fichiers sur le dépôt GitHub `classemaster.github.io`.

Les anciens comptes locaux : à la première ouverture, l'utilisateur se connecte (ou crée son compte) avec la même adresse e-mail et retrouve ses données de l'appareil, qui sont ensuite envoyées en ligne.

## Mode hors ligne
- L'application s'installe en cache au premier chargement (`sw.js`) et s'ouvre ensuite sans internet. La bibliothèque Supabase est hébergée dans `js/vendor/supabase.js`.
- **Après chaque mise à jour du site**, changez `VERSION` en haut de `sw.js` (ex. `cm-v4`) pour que les téléphones récupèrent les nouveaux fichiers.
- Sans internet, on peut créer un compte et se connecter : les données restent sur l'appareil. Au retour d'internet, un bandeau « Finaliser » demande le mot de passe une fois pour créer le compte Supabase et envoyer les données.
- Si « Confirm email » est activé, l'e-mail de confirmation n'est envoyé qu'à ce moment-là.

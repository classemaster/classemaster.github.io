# Classe Master v34 — bandeau de mise à jour et historique complet côté parent

## 1. Bandeau « Mise à jour disponible »
- Quand une nouvelle version du site est publiée, l'application la télécharge en arrière-plan puis affiche en bas de l'écran : **Mise à jour disponible. Recharger.** Un bouton **×** permet de remettre à plus tard.
- Avant de recharger, l'application enregistre ce qui est en cours. Les données de l'appareil ne sont pas touchées.
- La vérification se fait au retour sur l'application, au retour d'internet, toutes les 30 minutes et 20 secondes après l'ouverture.
- Pas de bandeau à la toute première installation.
- Nouveau fichier : `js/maj.js` (chargé par `index.html`, ajouté au cache de `sw.js`).
- **Toujours nécessaire :** changer `VERSION` dans `sw.js` à chaque publication (ici `cm-v34`). C'est ce changement qui déclenche le bandeau.

## 2. Historique complet côté parent
- Sur `parent.html` (lien famille et lien par matière), les absences et retards affichent les 8 plus récents, les notes les 6 plus récentes. Le bouton **Voir tout l'historique (N de plus)** déplie le reste, **Réduire** le replie.
- Le résumé publié par l'enseignant contient maintenant jusqu'à **200 absences/retards** (avant : 15) et **100 notes** (avant : 20), toujours bien en dessous de la limite de 100 Ko.
- Les liens parents des élèves concernés se mettent à jour automatiquement à la prochaine synchronisation de l'enseignant (seuls ceux qui avaient plus de 15 absences ou plus de 20 notes changent). Aucun script SQL.

## Mise en place
Publier les fichiers sur GitHub. Rien à exécuter dans Supabase.

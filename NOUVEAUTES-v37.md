# Classe Master v37 — statistiques de l'année par élève

## Dans la fiche d'un élève (Notes)
- **Tableau des périodes** : deux colonnes en plus, **Classe** (moyenne de la classe sur la période) et **Écart** (pastille verte ▲ au-dessus de la classe, rouge ▼ en dessous, grise sous 0,5 point), à côté de la moyenne et du rang.
- **Progression** : le texte sous le graphique donne maintenant une tendance calculée sur **toutes** les notes (droite de tendance), et non plus seulement la première et la dernière. « Stable » en dessous d'un point d'écart sur l'année.
- **Nouvelle carte « Statistiques de l'année »**, après le graphique :
  - évolution de la moyenne d'un trimestre au suivant, avec celle de la classe (« ▲ +4 pt · classe +0,1 ») ;
  - nombre d'évaluations où la note est égale ou supérieure à la moyenne de la classe ;
  - meilleure et plus faible notes, avec l'évaluation concernée ;
  - régularité des notes : Régulier (écart-type sous 2 points), Variable (2 à 4), Irrégulier (plus de 4) ;
  - présence et devoirs rendus de l'élève, avec ceux de la classe.
- Les lignes qui n'ont pas assez de données ne s'affichent pas (régularité : 3 notes minimum ; comparaison à la classe : 2 notes saisies par évaluation ; trimestres : seuls ceux qui ont une note comptent).
- La carte porte sur toute l'année de la classe, sans tenir compte du filtre de période de la fiche.

## Code
- Nouveau fichier `js/stats-eleve.js` (chargé par `index.html`, ajouté au cache de `sw.js`). Il contient aussi les petits outils `stSg`, `stPill` et `stTrend`, utilisés par `notes.js` et `progression.js`.
- Nouveau point d'extension **`fiche`** (`js/hooks.js`) : la carte s'y inscrit avec `hookOn("fiche", ...)`. `hookPipe` accepte maintenant un troisième paramètre transmis aux extensions (ici la classe et l'élève).
- `js/notes.js` : tableau des périodes élargi et appel du point d'extension. `js/progression.js` : phrase de tendance.
- Aucune donnée nouvelle n'est enregistrée ni synchronisée. Aucun script SQL.

## À savoir
- `sw.js` : `cm-v37`. `node outils/verifier-code.js` : aucun problème détecté.
- Fichiers modifiés depuis la v36 : `index.html`, `sw.js`, `js/hooks.js`, `js/notes.js`, `js/progression.js`, et nouveaux `js/stats-eleve.js`, `NOUVEAUTES-v37.md`.

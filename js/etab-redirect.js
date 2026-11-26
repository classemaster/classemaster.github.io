/* Ancienne adresse etablissement.html : renvoie vers la page qui a repris la rubrique (favoris, anciens liens).
   #apercu → Accueil · #eff → Classes · #ass, #res → Résultats · #ens → Enseignants · #dis → Vie scolaire · #fin → Fin d'année · #c=… → une classe. */
(function(){
  var MAP={apercu:"etab-accueil.html",eff:"etab-classes.html",ass:"etab-resultats.html",res:"etab-resultats.html",ens:"etab-enseignants.html",dis:"etab-vie.html",fin:"etab-fin.html"};
  var h=String(location.hash||"").slice(1),to="etab-accueil.html";
  if(MAP.hasOwnProperty(h))to=MAP[h];
  else if(/^c=/.test(h))to="etab-classes.html#"+h;
  var a=document.getElementById("go");if(a)a.href=to;
  location.replace(to);
})();

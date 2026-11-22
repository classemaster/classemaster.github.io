/* Points d’extension : un fichier peut réagir à un événement ou compléter un affichage sans remplacer
   une fonction d’un autre fichier. L’ordre de chargement des scripts n’a donc plus d’importance, et une erreur
   dans une extension n’empêche pas la fonction principale de se terminer.
   Événements (hookRun) : "saved" (après save), "sync" (texte d’état de la synchronisation), "pend" (bandeaux).
   Compléments d’affichage (hookPipe) : "notes" (page Notes), "part" (page Sauvegarde et partage), "fiche" (fiche élève, après la progression ; reçoit {c:classe, s:élève}) : chaque extension reçoit le HTML et renvoie le HTML complété. */
var HK={};
function hookOn(n,f){(HK[n]=HK[n]||[]).push(f);}
function hookRun(n,a){
  (HK[n]||[]).forEach(function(f){try{f(a);}catch(e){try{console.error("extension « "+n+" » :",e);}catch(e2){}}});
}
function hookPipe(n,v,a){
  return(HK[n]||[]).reduce(function(x,f){
    try{var r=f(x,a);return typeof r==="string"?r:x;}
    catch(e){try{console.error("extension « "+n+" » :",e);}catch(e2){}return x;}
  },v);
}

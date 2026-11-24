/* Visite guidée : 6 courtes étapes au premier lancement (une seule fois par compte), rejouable depuis l’Aide.
   Non bloquante : on peut toucher l’appli pendant la visite, la fermer avec « Passer » ou la touche Échap. */
var TOUR=[
  {t:"Bienvenue dans Classe Master",x:"Faisons un tour rapide de 30 secondes. Vous pouvez quitter à tout moment avec « Passer »."},
  {t:"Accueil",x:"C’est ici que tout commence : ajoutez vos élèves, puis faites l’appel du jour en quelques secondes.",n:"home"},
  {t:"Bilan",x:"Retrouvez les présences, les absences et les retards de la période, avec des graphiques, et imprimez-les.",n:"hist"},
  {t:"Recherche",x:"Trouvez vite un élève dans toutes vos classes pour ouvrir sa fiche.",n:"search"},
  {t:"Compte",x:"Sauvegardez vos données, partagez un lien aux parents et retrouvez l’aide.",n:"compte"},
  {t:"Mode nuit",x:"Ce bouton passe l’affichage en clair ou en sombre, pour reposer les yeux.",id:"thm"}
];
var tourI=-1;
function tourKey(){return"cm-tour-v1:"+(ME&&ME.id?ME.id:"");}
function tourSeen(){try{return localStorage.getItem(tourKey())==="1";}catch(e){return false;}}
function tourMark(){try{localStorage.setItem(tourKey(),"1");}catch(e){}}
function tourTarget(s){return s.n?document.querySelector('nav button[data-v="'+s.n+'"]'):s.id?document.getElementById(s.id):null;}
function tourClear(){document.querySelectorAll(".tour-hl").forEach(function(b){b.classList.remove("tour-hl");});}
function tourClose(){
  var o=document.getElementById("tour");if(o)o.remove();
  tourClear();tourI=-1;tourMark();
}
function tourShow(i){
  var s=TOUR[i],last=i===TOUR.length-1,o=document.getElementById("tour");
  if(!s)return;
  tourI=i;tourClear();
  if(!o){o=document.createElement("div");o.id="tour";o.className="tour";o.setAttribute("role","dialog");o.setAttribute("aria-modal","false");o.setAttribute("aria-labelledby","tour-t");o.setAttribute("aria-describedby","tour-x");document.body.appendChild(o);
    o.addEventListener("keydown",function(e){if(e.key==="Escape")tourClose();});
    o.addEventListener("click",function(e){
      var b=e.target.closest("button[data-tr]");if(!b)return;
      var a=b.dataset.tr;
      if(a==="skip")tourClose();
      else if(a==="prev")tourShow(tourI-1);
      else if(a==="next")tourShow(tourI+1);
      else if(a==="end"){var empty=typeof cl==="function"&&cl()&&!cl().students.length;tourClose();if(empty&&typeof render==="function"){view="eleves";render();window.scrollTo(0,0);}}
    });
  }
  var dots="";for(var k=0;k<TOUR.length;k++)dots+='<i'+(k===i?' class="on"':'')+'></i>';
  o.innerHTML='<div class="tour-c"><p class="tour-n">Étape '+(i+1)+' sur '+TOUR.length+'</p><h2 id="tour-t">'+s.t+'</h2><p id="tour-x">'+s.x+'</p><div class="tour-d" aria-hidden="true">'+dots+'</div>'+
    '<div class="tour-b"><button type="button" class="lnk" data-tr="skip">Passer</button>'+(i>0?'<button type="button" class="btn ghost" data-tr="prev">Précédent</button>':'')+
    (last?'<button type="button" class="btn" data-tr="end">'+(typeof cl==="function"&&cl()&&!cl().students.length?"Ajouter mes élèves":"Terminer")+'</button>':'<button type="button" class="btn" data-tr="next">Suivant</button>')+'</div></div>';
  var g=tourTarget(s);if(g)g.classList.add("tour-hl");
  var f=o.querySelector('[data-tr="next"],[data-tr="end"]');if(f)setTimeout(function(){f.focus();},20);
}
function tourStart(){if(document.getElementById("tour"))return;tourShow(0);}
/* Lancement automatique : seulement pour un nouveau compte (sans données), à l’Accueil, hors écran verrouillé */
function tourAuto(){
  if(!ME||view!=="home"||tourI>=0||tourSeen())return;
  var lk=document.getElementById("lock");if(lk&&!lk.hidden)return;
  if(document.getElementById("adlg"))return;
  if(typeof hasData==="function"&&hasData(D)){tourMark();return;}   /* enseignant déjà installé : pas de visite imposée */
  setTimeout(function(){if(view==="home"&&!document.getElementById("adlg"))tourStart();},600);
}
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-tour]");if(b){view="home";render();window.scrollTo(0,0);tourStart();}});

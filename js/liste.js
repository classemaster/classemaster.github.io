/* Listes repliables : une longue liste (élèves, évaluations, appels, messages…) ne s’affiche plus en entier.
   Seuls les premiers noms sont visibles, avec un bouton « Voir la liste complète » qui l’ouvre en plein écran.
   Tout se fait après l’affichage de l’écran (foldDraw), sans toucher aux écrans eux-mêmes : les lignes restent les mêmes éléments,
   donc les boutons, les champs et les notes continuent de fonctionner dans la liste ouverte. */
var FOLD={show:5,min:9,minHist:6,open:"",y:0,top:0,h:false};   /* minHist : les listes d'appels se replient dès 6 lignes */   /* show : lignes visibles ; min : nombre de lignes à partir duquel on replie */

/* Nombre de lignes à partir duquel une liste de ce type se replie */
function foldMin(k){return k==="hist"?FOLD.minHist:FOLD.min;}
/* Type de ligne répétée (vide si l’élément n’est pas une ligne de liste) */
function foldKind(el){
  var c=el.classList;
  if(!c)return"";
  if(c.contains("row")&&el.hasAttribute("data-nm"))return"row";
  if(c.contains("er"))return"er";
  if(c.contains("li"))return"li";
  if(c.contains("hist"))return"hist";
  if(c.contains("card")&&(c.contains("sv")||/padding:\s*12px/.test(el.getAttribute("style")||"")))return"card";
  return"";
}
/* Ce que contient la liste, pour le bouton : « 32 élèves », « 14 appels »… */
function foldNoun(it,n){
  function has(s){return!!(it.matches(s)||it.querySelector(s));}
  var w=has("[data-nm],[data-fiche],[data-n],[data-ns],[data-pad],[data-sf],[data-grs],[data-pmbe]")?["élève","élèves"]:
    has("[data-ev]")?["évaluation","évaluations"]:
    has("[data-crv],[data-crcp]")?["message","messages"]:
    has("[data-cxdel]")?["séance","séances"]:
    has("[data-pgdel]")?["leçon","leçons"]:
    has("[data-obdel]")?["observation","observations"]:
    it.matches(".hist[data-open],.hist[data-sd]")?["appel","appels"]:["élément","éléments"];
  return" · "+n+" "+(n>1?w[1]:w[0]);
}
/* Titre de la liste ouverte : titre de la carte, sinon dernier titre placé avant la liste */
function foldTitle(w){
  var card=w.closest(".card,.hm-card"),h=card&&card.querySelector("h2,h3");
  if(h&&!w.contains(h))return h.textContent.trim();
  var p=w.previousElementSibling;
  while(p){if(/^H[123]$/.test(p.tagName))return p.textContent.trim();p=p.previousElementSibling;}
  return"Liste complète";
}

/* Cherche les listes longues sous « root » : suites de lignes voisines de même type, et tableaux */
function foldFind(root){
  var out=[];
  (function scan(p){
    var kids=p.children,i=0,j,k,run;
    while(i<kids.length){
      k=foldKind(kids[i]);
      if(!k){i++;continue;}
      run=[kids[i]];j=i+1;
      while(j<kids.length&&foldKind(kids[j])===k){run.push(kids[j]);j++;}
      if(run.length>=foldMin(k))out.push({items:run,wrap:null});
      i=j;
    }
    for(i=0;i<kids.length;i++)if(kids[i].children.length&&!kids[i].classList.contains("fold")&&kids[i].tagName!=="TABLE")scan(kids[i]);
  })(root);
  Array.prototype.forEach.call(root.querySelectorAll("table"),function(t){
    if(t.closest(".fold"))return;
    var rows=Array.prototype.filter.call(t.rows,function(r){return r.querySelector("td");});
    if(rows.length>=FOLD.min)out.push({items:rows,wrap:t.parentElement&&t.parentElement.classList.contains("scroll")?t.parentElement:t});
  });
  return out;
}

/* Replie une liste. mode « sheet » : s’ouvre en plein écran ; mode « inline » : se déplie sur place (fenêtres déjà ouvertes) */
function foldMake(f,key,mode,st){
  var items=f.items,n=items.length,w=document.createElement("div"),first=f.wrap||items[0],last=f.wrap||items[n-1],b=document.createElement("button");
  w.className="fold"+(mode==="inline"?" fold-in":"");w.setAttribute("data-fk",key);
  first.parentNode.insertBefore(w,first);
  if(f.wrap)w.appendChild(f.wrap);else items.forEach(function(it){w.appendChild(it);});
  items.forEach(function(it,i){if(i>=FOLD.show)it.classList.add("fold-x");});
  b.type="button";b.className="fold-more";
  b.innerHTML='<span>Voir la liste complète</span><small>'+foldNoun(items[0],n).replace(/^ · /,"")+'</small>';
  b.setAttribute("aria-haspopup",mode==="inline"?"false":"dialog");
  w.parentNode.insertBefore(b,w.nextSibling);
  if(mode==="inline"){
    b.setAttribute("aria-expanded","false");
    b.onclick=function(){var o=!w.classList.contains("open");w.classList.toggle("open",o);b.setAttribute("aria-expanded",String(o));b.firstChild.textContent=o?"Réduire la liste":"Voir la liste complète";if(st)st.open=o;};
    if(st&&st.open)b.onclick();
    return w;
  }
  var hd=document.createElement("div");hd.className="fold-h";
  hd.innerHTML='<b></b><button type="button" class="btn ghost fold-c" aria-label="Fermer la liste">Fermer</button>';
  hd.firstChild.textContent=foldTitle(w)+foldNoun(items[0],n);
  w.insertBefore(hd,w.firstChild);
  w.addEventListener("scroll",function(){if(w.classList.contains("open"))FOLD.top=w.scrollTop;});
  b.onclick=function(){foldOpen(w,true);};
  hd.lastChild.onclick=function(){foldClose();};
  return w;
}

/* Ouvre / ferme la liste en plein écran */
function foldOpen(w,user){
  var wasLocked=document.body.classList.contains("fold-lock");
  w.classList.add("open");w.setAttribute("role","dialog");w.setAttribute("aria-modal","true");w.setAttribute("aria-label",foldTitle(w));
  document.body.classList.add("fold-lock");
  FOLD.open=w.getAttribute("data-fk");
  if(user){
    FOLD.y=window.scrollY;FOLD.top=0;
    try{history.pushState(Object.assign({},typeof snap==="function"?snap():{},{fold:1}),"",location.pathname+location.search+"#"+view);FOLD.h=true;}catch(e){FOLD.h=false;}
    w.scrollTop=0;
    var c=w.querySelector(".fold-c");if(c)c.focus();
  }else{w.scrollTop=FOLD.top;}
  return wasLocked;
}
function foldClose(){
  if(!FOLD.open)return;
  if(FOLD.h){try{history.back();return;}catch(e){}}   /* le retour de l’appareil ferme aussi la liste : voir popstate plus bas */
  foldShut();
}
function foldShut(){
  var w=document.querySelector(".fold.open:not(.fold-in)");
  if(w){w.classList.remove("open");w.removeAttribute("role");w.removeAttribute("aria-modal");w.removeAttribute("aria-label");
    var b=w.nextElementSibling;
    FOLD.open="";FOLD.h=false;document.body.classList.remove("fold-lock");
    window.scrollTo(0,FOLD.y);if(b&&b.focus)b.focus({preventScroll:true});return;}
  FOLD.open="";FOLD.h=false;document.body.classList.remove("fold-lock");
}

/* Appelé après chaque affichage d’un écran : replie les longues listes et rouvre celle qui était ouverte */
function foldDraw(root){
  var el=root||document.getElementById("view");if(!el)return;
  var prefix=(typeof view!=="undefined"?view:"")+"|"+(typeof D!=="undefined"&&D?D.cur:"")+"|",reopen=null;
  foldFind(el).forEach(function(f,i){
    var key=prefix+i,w=foldMake(f,key,"sheet");
    if(FOLD.open===key)reopen=w;
  });
  if(reopen)foldOpen(reopen,false);
  else{FOLD.open="";FOLD.h=false;document.body.classList.remove("fold-lock");}
  foldSearch();
}
/* Liste repliée dans un bloc rafraîchi à part (résultats de recherche) : mêmes règles, sans mémoriser l’ouverture */
function foldPart(root){
  if(!root)return;
  foldFind(root).forEach(function(f,i){foldMake(f,"p|"+i,"sheet");});
}
/* Liste repliée dans une fenêtre déjà ouverte : se déplie sur place, l’état est gardé dans « st » entre deux rafraîchissements */
function foldInline(root,st){
  if(!root)return;
  foldFind(root).forEach(function(f){foldMake(f,"in","inline",st);});
}
/* Pendant une recherche dans l’appel, on montre directement les élèves trouvés (sans repli) */
function foldSearch(){
  var q=typeof qs!=="undefined"&&qs;
  Array.prototype.forEach.call(document.querySelectorAll(".fold"),function(w){
    if(!w.querySelector(".row[data-nm]"))return;
    w.classList.toggle("off",!!q);
    var b=w.nextElementSibling;if(b&&b.classList.contains("fold-more"))b.hidden=!!q;
  });
}

/* Touche Échap : ferme la liste ouverte. Retour de l’appareil : l’entrée d’historique ajoutée à l’ouverture est retirée */
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&FOLD.open){e.preventDefault();foldClose();}});
window.addEventListener("popstate",function(e){
  var was=!!FOLD.open;
  FOLD.open="";FOLD.h=false;
  if(e.state&&e.state.fold){setTimeout(function(){try{history.back();}catch(x){}},0);return;}   /* retour sur une entrée « liste ouverte » devenue inutile */
  if(was)setTimeout(function(){window.scrollTo(0,FOLD.y);},0);
});

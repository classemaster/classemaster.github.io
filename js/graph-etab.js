/* Graphiques du tableau de bord de l'établissement (etab-accueil.html).
   Une carte par graphique, placée sous les indicateurs de chaque onglet. Les données sont celles déjà calculées par la page.
   Étape 23 (v125) : finitions du bloc « graphiques cliquables » : tout est calculé sur l'appareil à partir des données déjà chargées (aucun appel réseau dans ce fichier), donc les listes s'ouvrent aussi hors ligne avec la copie gardée par etab-offline.js.
   Étape 22 (v124) : « Présence » (jauge), « Évolution par trimestre » (courbes) et « Moyenne par matière » (barres) : toucher une zone, un point ou une matière liste les élèves concernés (geBuildJauge, geBuildEvo, geBuildSubj).
   Étape 21 (v123) : « Absences et retards » : toucher un segment (justifiées, non justifiées, retards) liste les élèves de la classe concernés (geAbsKind, geBuildAbs).
   Étape 20 (v122) : « Présence par classe » : toucher une barre liste les élèves de la classe qui ont des absences, du plus d'absences au moins (geAbsRows, geBuildPres).
   Étape 19 (v121) : « Moyenne par classe » (barres, Accueil) et « Moyennes par classe » (boîtes, Résultats) : toucher une classe liste ses élèves avec leur moyenne (geClsRows, geClsPick).
   Étape 18 (v120) : panneau « Qui est concerné ? » (geWho, composant commun) ; branché sur « Distribution des moyennes » : toucher une barre liste les élèves de la tranche.
   Étape 16 (v118) : plus de liste « Matière » propre aux cartes « Répartition des moyennes » et « Moyenne par classe » (la matière se choisit dans la carte « Filtrer » de la page,
   qui reste visible en haut) ; le périmètre (classe · matière · enseignant) est rappelé sous chaque graphique.
   Étape 15 (v117) : chaque carte a un petit texte repliable « Comment c’est calculé ? » (GE_HOW, une entrée par titre de carte). */
var GE={inst:[]};
function geClear(){GE.inst.forEach(function(i){try{i.destroy();}catch(e){}});GE.inst=[];}
function geR1(x){return x===null||x===undefined||isNaN(x)?null:Math.round(x*10)/10;}
function geBand(a){return a>=16?0:a>=14?1:a>=12?2:a>=10?3:4;}


function geEsc(t){return String(t==null?"":t).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function geNf(v){return v===null||v===undefined||isNaN(v)?"–":String(Math.round(v*10)/10).replace(".",",");}
/* Panneau « Qui est concerné ? » (étape 18) : composant commun aux cartes cliquables.
   geWho(boîte).hint(texte) affiche l'invite ; .show({title, color, rows:[{name, cls, tag}], empty}) affiche le titre avec l'effectif puis une ligne par élève (60 au plus, le reste est compté). Tout est échappé. */
var GE_WHO_MAX=60;
function geWho(box){
  return{
    hint:function(t){box.innerHTML='<p class="ge-hint">'+geEsc(t)+'</p>';},
    show:function(o){
      var r=o.rows||[],n=r.length;
      var h='<h3 class="ge-wh">'+(o.color?'<span class="ge-dot" style="background:'+geEsc(o.color)+'"></span>':'')+geEsc(o.title)+' · '+n+' élève'+(n>1?'s':'')+'</h3>';
      if(!n){box.innerHTML=h+'<p class="ge-hint">'+geEsc(o.empty||'Aucun élève concerné.')+'</p>';return;}
      h+=r.slice(0,GE_WHO_MAX).map(function(e){return'<div class="dr"><span><b>'+geEsc(e.name)+'</b><small>'+geEsc(e.cls)+'</small></span><span class="tg">'+geEsc(e.tag)+'</span></div>';}).join('');
      if(n>GE_WHO_MAX)h+='<p class="ge-hint ge-more">… et '+(n-GE_WHO_MAX)+' autre'+(n-GE_WHO_MAX>1?'s':'')+'.</p>';
      box.innerHTML=h;
    }
  };
}
var GE_BANDS=[["Excellent (16 et plus)","#35d6c9"],["Bien (14 à 16)","#8b7cff"],["Assez bien (12 à 14)","#38bdf8"],["Passable (10 à 12)","#ffc15a"],["Insuffisant (moins de 10)","#ff6b9a"]];

/* Explication « Comment c’est calculé ? » de chaque carte, par titre de carte (texte simple, affiché sous le graphique) */
var GE_HOW={
  "Présence":"Présence = (appels − absences) ÷ appels, sur tous les élèves suivis du périmètre affiché. Les retards ne comptent pas comme des absences. La partie « Sous le seuil » correspond au seuil d’alerte réglé dans « Paramètres ». Touchez une zone de l’arc pour lister les élèves de cette zone, des moins présents aux plus présents.",
  "Répartition des moyennes":"Pour chaque élève suivi, on fait la moyenne des moyennes que les enseignants ont transmises (chaque moyenne compte pour une), puis on le place dans une tranche : 16 et plus, 14 à moins de 16, 12 à moins de 14, 10 à moins de 12, moins de 10. Avec une matière choisie, seule la moyenne de cette matière compte. Un élève sans moyenne n’est pas compté.",
  "Moyenne par classe":"Pour chaque élève, la moyenne de ses moyennes transmises (ou de la matière choisie) ; la barre est la moyenne de ces moyennes d’élèves, arrondie au dixième. Une classe sans aucune moyenne n’apparaît pas. Le trait est le seuil de réussite réglé dans « Paramètres ». Touchez une barre pour lister les élèves de la classe.",
  "Élèves par classe":"Nombre d’élèves de chaque classe, d’après la liste des élèves de l’établissement.",
  "Répartition par niveau":"Les classes sont regroupées par niveau d’après leur nom (« 6e A » et « 6e B » donnent « 6e »). Chaque part est le nombre d’élèves de ce niveau.",
  "Présence par classe":"Pour chaque classe : (appels − absences) ÷ appels, sur tous ses élèves suivis, en %. Une classe sans aucun appel n’apparaît pas. Le trait est le seuil d’alerte réglé dans « Paramètres ». Touchez une barre pour lister les élèves de la classe qui ont des absences, du plus d’absences au moins.",
  "Absences et retards":"Cumul par classe, sur tous les élèves suivis : absences justifiées, absences non justifiées (absences moins justifiées) et retards. Une classe sans aucun appel n’apparaît pas. Touchez un segment pour lister les élèves de la classe concernés, du plus au moins.",
  "Distribution des moyennes":"Chaque élève suivi compte une fois, selon la moyenne de ses moyennes transmises. Les barres regroupent les élèves par tranches de 2 points, de 0 à 20. Touchez une barre pour lister les élèves de la tranche. Le trait est le seuil de réussite réglé dans « Paramètres ».",
  "Moyennes par classe":"Pour chaque classe, on prend la moyenne de chacun de ses élèves (touchez une boîte pour les lister). Le trait central est la médiane (la moitié des élèves au-dessus, la moitié au-dessous), la boîte va du premier au troisième quartile (la moitié centrale des élèves), les moustaches s’arrêtent aux dernières valeurs normales et les ronds sont des valeurs atypiques. Huit classes au plus.",
  "Évolution par trimestre":"Pour chaque classe, moyenne des moyennes d’évaluations du trimestre 1, 2 et 3 ; un trimestre sans note n’a pas de point. Seules les classes qui ont des notes dans au moins deux trimestres sont tracées, cinq au plus (dans l’ordre des niveaux). Le trait est le seuil de réussite. Touchez un point d’une courbe pour lister les élèves de la classe avec leur moyenne du trimestre.",
  "Moyenne par matière":"Moyenne de toutes les moyennes transmises pour la matière (chaque moyenne d’enseignant et de classe compte pour une). Douze matières au plus, de la plus haute à la plus basse. Le trait est le seuil de réussite. Touchez une barre pour lister les élèves qui ont une moyenne dans cette matière.",
  "Appel du jour":"Une séance est une classe d’un enseignant. Appel fait : l’appel a été enregistré aujourd’hui. Appel non fait : une séance prévue à l’emploi du temps est terminée sans appel. À venir : une séance est prévue plus tard aujourd’hui. Sans séance : aucun cours prévu aujourd’hui. Sans emploi du temps : l’enseignant n’en a pas saisi.",
  "Élèves par enseignant":"Nombre d’élèves suivis par chaque enseignant, en additionnant ses classes et ses matières (un élève vu dans deux matières compte deux fois). Dix enseignants au plus, du plus chargé au moins chargé.",
  "Incidents par classe":"Incidents enregistrés au cours des 30 derniers jours, comptés dans la classe de l’élève concerné, graves d’un côté et autres de l’autre. Dix classes au plus, les plus touchées d’abord.",
  "Passages proposés":"Chaque élève est classé d’après sa moyenne annuelle : au moins le seuil de passage choisi sur la page (10 par défaut) = passe ; jusqu’à 2 points en dessous = à examiner ; plus bas = redoublement ; sans moyenne = non évalué. Une décision confirmée par le conseil de classe remplace cette proposition.",
  "Passages par classe":"Même règle que « Passages proposés », comptée classe par classe : la décision confirmée par le conseil de classe si elle existe, sinon la proposition d’après la moyenne annuelle."
};
/* Rappel du périmètre sous chaque graphique : le filtre de la page (classe · matière · enseignant), ou tout l'établissement sur les pages sans filtre */
function geScope(x){return'<p class="ge-scope">Périmètre : <b>'+geEsc(x.scope||"tous les élèves de l’établissement")+'</b></p>';}
function geHow(t){var h=GE_HOW[t];return h?'<details class="ge-how"><summary>Comment c’est calculé ?</summary><p>'+geEsc(h)+'</p></details>':"";}

/* Carte « Répartition des moyennes » : choix de la matière (toutes par défaut) + liste des élèves de la part touchée */
function geBuildMoy(el,c,x){
  var M=x.M;
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=el.querySelector(".ge-who"),ch=null,cur=null;
  function calc(){
    var n=[0,0,0,0,0],w=[[],[],[],[],[]];
    M.ids.forEach(function(id){
      var st=M.S[id],r=M.byId[id],m=x.mean(st.av);
      if(m===null||!r)return;
      var b=geBand(m);n[b]++;w[b].push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",m:m});
    });
    w.forEach(function(l){l.sort(function(a,b){return b.m-a.m||a.name.localeCompare(b.name,"fr");});});
    return{n:n,w:w};
  }
  function showWho(label){
    if(!label||!cur){who.innerHTML='<p class="ge-hint">Touchez une part de l’anneau ou une ligne de la légende pour voir les élèves concernés.</p>';return;}
    var b=GE_BANDS.map(function(l){return l[0];}).indexOf(label),l=cur.w[b]||[];
    who.innerHTML='<h3 class="ge-wh"><span class="ge-dot" style="background:'+GE_BANDS[b][1]+'"></span>'+geEsc(label)+' · '+l.length+' élève'+(l.length>1?"s":"")+'</h3>'+
      l.map(function(e){return'<div class="dr"><span><b>'+geEsc(e.name)+'</b><small>'+geEsc(e.cls)+'</small></span><span class="tg">'+geNf(e.m)+' / 20</span></div>';}).join("");
  }
  function opts(){
    return{data:GE_BANDS.map(function(l,i){return{label:l[0],value:cur.n[i],color:l[1]};})};
  }
  function refresh(keep){
    cur=calc();
    var o=opts(),total=x.rows.length;
    if(!ch){var oo=Object.assign({},c.o,o);oo.total=total;try{ch=new DonutChart(dEl,oo);GE.inst.push(ch);}catch(e){dEl.textContent="Graphique indisponible.";return;}
      var pin=ch.pin;ch.pin=function(i){pin.call(ch,i);var d=ch.d&&ch.d.data[ch.pinned];showWho(ch.pinned==null||!d?null:d.label);};
    }else{o.total=total;ch.update(o);}
    if(!cur.n.some(function(v){return v>0;})){who.innerHTML='<p class="ge-hint">Aucun élève n’a de moyenne pour ce périmètre.</p>';return;}
    var idx=-1;if(keep&&ch.d)ch.d.data.forEach(function(d,i){if(d.label===keep)idx=i;});
    if(idx>=0)ch.pin(idx);else showWho(null);
  }
  refresh(null);
}

/* Élèves d'une classe (clé = nom de classe tel quel, "" si sans classe) avec leur moyenne arrondie au dixième, de la plus haute à la plus basse ; les élèves sans moyenne ne sont pas listés */
function geClsRows(x,key){
  var M=x.M,rows=[];
  M.ids.forEach(function(id){
    var r=M.byId[id],m=x.mean(M.S[id].av);
    if(m===null||!r||(r.class_label||"")!==key)return;
    rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",m:geR1(m)});
  });
  rows.sort(function(a,b){return b.m-a.m||a.name.localeCompare(b.name,"fr");});
  return rows.map(function(e){return{name:e.name,cls:e.cls,tag:geNf(e.m)+" / 20"};});
}
/* Rappel au toucher d'une classe : liste ses élèves dans le panneau ; un deuxième toucher sur la même classe referme ; after(info) complète le titre */
function geClsPick(who,x,hint,after){
  var cur;
  return function(info){
    var k=info.key!==undefined&&info.key!==null?info.key:(info.label==="?"?"":info.label);
    if(cur!==undefined&&cur===k){cur=undefined;who.hint(hint);return;}
    cur=k;
    who.show({title:info.label+(after?after(info):""),empty:"Aucun élève de cette classe n’a de moyenne.",rows:geClsRows(x,k)});
  };
}

/* Élèves d'une classe (clé = nom de classe tel quel) qui ont au moins une absence : le plus d'absences d'abord, puis la plus faible présence, puis l'ordre alphabétique */
function geAbsRows(x,key){
  var M=x.M,rows=[];
  M.ids.forEach(function(id){
    var r=M.byId[id],s=M.S[id];
    if(!r||!s||!(s.a>0)||(r.class_label||"")!==key)return;
    rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",a:s.a,p:x.pc(s.n,s.a)});
  });
  rows.sort(function(a,b){return b.a-a.a||(a.p===null?101:a.p)-(b.p===null?101:b.p)||a.name.localeCompare(b.name,"fr");});
  return rows.map(function(e){return{name:e.name,cls:e.cls,tag:e.a+" absence"+(e.a>1?"s":"")+(e.p===null?"":" · "+Math.round(e.p)+" %")};});
}

/* Carte « Présence par classe » : toucher une barre liste les élèves de la classe qui ont des absences ; un deuxième toucher referme */
function geBuildPres(el,c,x){
  var HINT="Touchez une barre pour voir les élèves de la classe qui ont le plus d’absences.",cur;
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=geWho(el.querySelector(".ge-who"));
  who.hint(HINT);
  function pick(info){
    var k=info.key!==undefined&&info.key!==null?info.key:(info.label==="?"?"":info.label);
    if(cur!==undefined&&cur===k){cur=undefined;who.hint(HINT);return;}
    cur=k;
    who.show({title:info.label+" · présence "+geNf(info.value)+" %",empty:"Aucun élève de cette classe n’a d’absence.",rows:geAbsRows(x,k)});
  }
  try{GE.inst.push(new BarChart(dEl,Object.assign({},c.o,{onPick:pick})));}catch(e){dEl.textContent="Graphique indisponible.";}
}

/* Types de segment de « Absences et retards » : clé de série -> [nom au pluriel, nom au singulier, calcul du nombre par élève] */
var GE_ABS={
  j:["justifiées","justifiée",function(s){return s.j||0;}],
  nj:["non justifiées","non justifiée",function(s){return Math.max(0,(s.a||0)-(s.j||0));}],
  r:["retards","retard",function(s){return s.r||0;}]
};
/* Élèves d'une classe concernés par un type (j, nj ou r) : au moins un, le plus grand nombre d'abord, puis l'ordre alphabétique */
function geAbsKind(x,key,kind){
  var M=x.M,K=GE_ABS[kind],rows=[];
  if(!K)return rows;
  M.ids.forEach(function(id){
    var r=M.byId[id],s=M.S[id];
    if(!r||!s||(r.class_label||"")!==key)return;
    var v=K[2](s);if(!(v>0))return;
    rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",v:v});
  });
  rows.sort(function(a,b){return b.v-a.v||a.name.localeCompare(b.name,"fr");});
  return rows.map(function(e){return{name:e.name,cls:e.cls,tag:e.v+" "+(e.v>1?K[0]:K[1])};});
}

/* Carte « Absences et retards » (barres empilées) : toucher un segment liste les élèves de la classe concernés ; même segment une deuxième fois = referme */
function geBuildAbs(el,c,x){
  var HINT="Touchez un segment d’une barre (justifiées, non justifiées, retards) pour voir les élèves concernés.",cur,KS=["j","nj","r"];
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=geWho(el.querySelector(".ge-who"));
  who.hint(HINT);
  function pick(info){
    var kind=info.seriesKey!==undefined&&info.seriesKey!==null?info.seriesKey:KS[info.seriesIndex];
    if(!GE_ABS[kind]){cur=undefined;who.hint(HINT);return;}
    var k=info.key!==undefined&&info.key!==null?info.key:(info.label==="?"?"":info.label),id=k+"|"+kind;
    if(cur===id){cur=undefined;who.hint(HINT);return;}
    cur=id;
    who.show({title:info.label+" · "+GE_ABS[kind][0]+" "+(info.segmentValue==null?"":info.segmentValue),color:((c.o.series||[]).filter(function(q){return q.key===kind;})[0]||{}).color,empty:"Aucun élève de cette classe n’est concerné.",rows:geAbsKind(x,k,kind)});
  }
  try{GE.inst.push(new BarChart(dEl,Object.assign({},c.o,{onPick:pick})));}catch(e){dEl.textContent="Graphique indisponible.";}
}

/* Bascule commune : un deuxième toucher sur le même élément referme la liste et remet l'invite */
function geToggle(who,hint){
  var cur;
  return function(id,o){
    if(cur!==undefined&&cur===id){cur=undefined;who.hint(hint);return;}
    cur=id;who.show(o);
  };
}
function geBoxes(el){
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  return{d:el.querySelector(".ge-d"),w:geWho(el.querySelector(".ge-who"))};
}

/* Carte « Présence » (jauge) : toucher une zone liste les élèves dont la présence tombe dans la zone (arrondie au dixième, bornes de la zone), les moins présents d'abord */
function geBuildJauge(el,c,x,C){
  var M=x.M,HINT="Touchez une zone de l’arc pour voir les élèves concernés.",b=geBoxes(el),tog=geToggle(b.w,HINT);
  b.w.hint(HINT);
  function pick(info){
    var rows=[];
    M.ids.forEach(function(id){
      var r=M.byId[id],s=M.S[id],p=r&&s?x.pc(s.n,s.a):null;
      if(p===null||p===undefined)return;
      p=geR1(p);
      if(p>=info.from&&(p<info.to||(info.to>=100&&p<=info.to)))rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",p:p,a:s.a});
    });
    rows.sort(function(a,z){return a.p-z.p||z.a-a.a||a.name.localeCompare(z.name,"fr");});
    tog(info.index,{title:info.label,color:info.color,empty:"Aucun élève dans cette zone.",rows:rows.map(function(e){return{name:e.name,cls:e.cls,tag:geNf(e.p)+" % · "+e.a+" absence"+(e.a>1?"s":"")};})});
  }
  try{GE.inst.push(new C(b.d,Object.assign({},c.o,{onPick:pick})));}catch(e){b.d.textContent="Graphique indisponible.";}
}

/* Carte « Évolution par trimestre » : toucher un point liste les élèves de la classe de la courbe touchée avec leur moyenne du trimestre (T1 à T3), la plus haute d'abord */
function geBuildEvo(el,c,x,C){
  var M=x.M,HINT="Touchez un point d’une courbe pour voir les élèves de la classe.",b=geBoxes(el),tog=geToggle(b.w,HINT);
  b.w.hint(HINT);
  function pick(info){
    var k=info.seriesKey,t=info.index;
    if(k===undefined||k===null||t==null){b.w.hint(HINT);return;}
    var rows=[];
    M.ids.forEach(function(id){
      var r=M.byId[id],s=M.S[id],m=r&&s&&s.t?x.mean(s.t[t]):null;
      if(m===null||m===undefined||(r.class_label||"")!==k)return;
      rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",m:geR1(m)});
    });
    rows.sort(function(a,z){return z.m-a.m||a.name.localeCompare(z.name,"fr");});
    tog(k+"|"+t,{title:(info.seriesName||"?")+" · "+info.label+" · moyenne "+geNf(info.value),empty:"Aucun élève de cette classe n’a de moyenne ce trimestre.",rows:rows.map(function(e){return{name:e.name,cls:e.cls,tag:geNf(e.m)+" / 20"};})});
  }
  try{GE.inst.push(new C(b.d,Object.assign({},c.o,{onPick:pick})));}catch(e){b.d.textContent="Graphique indisponible.";}
}

/* Carte « Moyenne par matière » : toucher une barre liste les élèves qui ont une moyenne dans la matière (moyenne de leurs moyennes de cette matière), la plus haute d'abord */
function geBuildSubj(el,c,x,C){
  var M=x.M,HINT="Touchez une barre pour voir les élèves de la matière.",b=geBoxes(el),tog=geToggle(b.w,HINT);
  b.w.hint(HINT);
  function pick(info){
    var k=info.key!==undefined&&info.key!==null?info.key:info.label,rows=[];
    M.ids.forEach(function(id){
      var r=M.byId[id],s=M.S[id],v=r&&s&&s.bs?s.bs[k]:null,m=v&&v.length?x.mean(v):null;
      if(m===null||m===undefined)return;
      rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",m:geR1(m)});
    });
    rows.sort(function(a,z){return z.m-a.m||a.name.localeCompare(z.name,"fr");});
    tog(k,{title:info.label+" · moyenne "+geNf(info.value),empty:"Aucun élève n’a de moyenne dans cette matière.",rows:rows.map(function(e){return{name:e.name,cls:e.cls,tag:geNf(e.m)+" / 20"};})});
  }
  try{GE.inst.push(new C(b.d,Object.assign({},c.o,{onPick:pick})));}catch(e){b.d.textContent="Graphique indisponible.";}
}

/* Carte « Distribution des moyennes » : toucher une barre de l'histogramme liste les élèves dont la moyenne tombe dans la tranche (même arrondi au dixième et mêmes bornes que le graphique) ; un deuxième toucher referme la liste */
function geBuildHist(el,c,x,C){
  var M=x.M,HINT="Touchez une barre de l’histogramme pour voir les élèves de la tranche.";
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=geWho(el.querySelector(".ge-who")),cur=null;
  who.hint(HINT);
  function pick(info){
    if(cur===info.index){cur=null;who.hint(HINT);return;}
    cur=info.index;
    var rows=[];
    M.ids.forEach(function(id){
      var r=M.byId[id],m=x.mean(M.S[id].av);
      if(m===null||!r)return;
      var v=geR1(m);
      if(v>=info.from&&(v<info.to||(info.last&&v<=info.to)))rows.push({name:r.name||"(sans nom)",cls:r.class_label||"(sans classe)",m:v});
    });
    rows.sort(function(a,b){return b.m-a.m||a.name.localeCompare(b.name,"fr");});
    who.show({title:"Moyenne de "+geNf(info.from)+(info.last?" à ":" à moins de ")+geNf(info.to),color:"#8b7cff",empty:"Aucun élève dans cette tranche.",
      rows:rows.map(function(e){return{name:e.name,cls:e.cls,tag:geNf(e.m)+" / 20"};})});
  }
  try{GE.inst.push(new C(dEl,Object.assign({},c.o,{onPick:pick})));}catch(e){dEl.textContent="Graphique indisponible.";}
}

/* Carte « Moyennes par classe » (boîtes) : toucher une boîte liste les élèves de la classe */
function geBuildBox(el,c,x,C){
  var HINT="Touchez une boîte pour voir les élèves de la classe.";
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=geWho(el.querySelector(".ge-who"));
  who.hint(HINT);
  var pick=geClsPick(who,x,HINT,function(i){return" · médiane "+geNf(i.median);});
  try{GE.inst.push(new C(dEl,Object.assign({},c.o,{onPick:pick})));}catch(e){dEl.textContent="Graphique indisponible.";}
}

/* Carte « Moyenne par classe » : la matière vient du filtre de la page (toutes les classes publiées) */
function geBuildCls(el,c,x){
  var M=x.M;
  var HINT="Touchez une barre pour voir les élèves de la classe.";
  el.innerHTML='<div class="ge-d"></div><div class="ge-who" aria-live="polite"></div>';
  var dEl=el.querySelector(".ge-d"),who=geWho(el.querySelector(".ge-who")),ch=null;
  var pick=geClsPick(who,x,HINT,function(i){return" · moyenne "+geNf(i.value);});
  who.hint(HINT);
  function calc(){
    var C={};
    M.ids.forEach(function(id){
      var st=M.S[id],r=M.byId[id],m=x.mean(st.av);
      if(m===null||!r)return;
      var k=r.class_label||"";(C[k]=C[k]||[]).push(m);
    });
    var ks=Object.keys(C).sort(x.sortCls);
    return{labels:ks.map(function(k){return k||"?";}),keys:ks,values:ks.map(function(k){return geR1(x.mean(C[k]));})};
  }
  function refresh(){
    var d=calc();
    if(!d.labels.length){dEl.innerHTML='<p class="ge-hint">Aucune classe n’a de moyenne pour ce périmètre.</p>';who.hint("");ch=null;return;}
    if(!ch){dEl.innerHTML="";var o=Object.assign({},c.o,{labels:d.labels,keys:d.keys,values:d.values,onPick:pick});ch=new BarChart(dEl,o);GE.inst.push(ch);}
    else ch.update({labels:d.labels,keys:d.keys,values:d.values});
  }
  refresh();
}

/* Chaque constructeur de carte renvoie [{k:"BarChart", t:"Titre", s:"Sous-titre", o:{options}}] ; une carte sans données est ignorée */
function geCards(x){
  var P=Charts.palette,M=x.M,TH=x.TH,out=[],byCls=function(){return Object.keys(M.C).sort(x.sortCls);};
  if(x.t==="apercu"&&M){
    var p=x.pc(M.N,M.A);
    if(p!==null)out.push({k:"GaugeChart",jauge:1,t:"Présence",s:"Seuil d’alerte "+TH.pres+" %",o:{min:0,max:100,unit:" %",label:"Présence",value:Math.round(p),
      zones:[{to:TH.pres,color:P[2],label:"Sous le seuil"},{to:100,color:P[1],label:"Satisfaisant"}]}});
    var n=[0,0,0,0,0],L=[["Excellent (16 et plus)","#35d6c9"],["Bien (14 à 16)","#8b7cff"],["Assez bien (12 à 14)","#38bdf8"],["Passable (10 à 12)","#ffc15a"],["Insuffisant (moins de 10)","#ff6b9a"]];
    M.means.forEach(function(a){n[geBand(a)]++;});
    if(M.means.length)out.push({k:"DonutChart",moy:1,t:"Répartition des moyennes",s:"Élèves suivis · moyenne de chaque élève",o:{unit:"élèves",total:x.rows.length,
      text:{label:"Répartition des moyennes",caption:"Élèves suivis",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:L.map(function(l,i){return{label:l[0],value:n[i],color:l[1]};})}});
    var ks=byCls().filter(function(k){return x.mean(M.C[k].m)!==null;});
    if(ks.length)out.push({k:"BarChart",cls:1,t:"Moyenne par classe",s:"Sur 20 · trait = seuil de réussite",o:{unit:"/20",label:"Moyenne par classe",labels:ks.map(function(k){return k||"?";}),values:ks.map(function(k){return geR1(x.mean(M.C[k].m));}),goal:{value:TH.moy,label:"Seuil"}}});
  }
  if(x.t==="eff"){
    var C={},G={};
    x.rows.forEach(function(r){var k=r.class_label||"",l=x.lvl(k);C[k]=(C[k]||0)+1;G[l]=(G[l]||0)+1;});
    var cs=Object.keys(C).sort(x.sortCls),gs=Object.keys(G).sort(function(a,b){return x.lvlRank(a)-x.lvlRank(b)||a.localeCompare(b,"fr");});
    out.push({k:"BarChart",t:"Élèves par classe",s:"Effectif de chaque classe",o:{unit:"élèves",label:"Élèves par classe",labels:cs.map(function(k){return k||"?";}),values:cs.map(function(k){return C[k];})}});
    out.push({k:"DonutChart",t:"Répartition par niveau",s:"Part de chaque niveau dans l’établissement",o:{unit:"élèves",total:x.rows.length,
      text:{label:"Répartition par niveau",caption:"Élèves",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:gs.map(function(l,i){return{label:l,value:G[l],color:P[i%P.length]};})}});
  }
  if(x.t==="ass"&&M){
    var ka=byCls().filter(function(k){return M.C[k].n>0;});
    if(ka.length){
      out.push({k:"BarChart",pres:1,t:"Présence par classe",s:"En % · trait = seuil d’alerte",o:{unit:"%",label:"Présence par classe",labels:ka.map(function(k){return k||"?";}),keys:ka,values:ka.map(function(k){return geR1(x.pc(M.C[k].n,M.C[k].a));}),goal:{value:TH.pres,label:"Seuil"}}});
      out.push({k:"BarChart",abs:1,t:"Absences et retards",s:"Cumul par classe",o:{unit:"",label:"Absences et retards par classe",labels:ka.map(function(k){return k||"?";}),keys:ka,series:[
        {name:"Justifiées",key:"j",color:P[1],values:ka.map(function(k){return M.C[k].j;})},
        {name:"Non justifiées",key:"nj",color:P[4],values:ka.map(function(k){return Math.max(0,M.C[k].a-M.C[k].j);})},
        {name:"Retards",key:"r",color:P[3],values:ka.map(function(k){return M.C[k].r;})}]}});
    }
  }
  if(x.t==="res"&&M){
    if(M.means.length){
      out.push({k:"HistogramChart",who:1,t:"Distribution des moyennes",s:"Nombre d’élèves par tranche de 2 points",o:{unit:"élèves",label:"Distribution des moyennes",values:M.means.map(geR1),min:0,max:20,bins:10,threshold:TH.moy,thresholdLabel:"Seuil",xUnit:""}});
      var g=[];byCls().forEach(function(k){if(M.C[k].m.length)g.push({label:k||"?",key:k,color:P[g.length%P.length],values:M.C[k].m.map(geR1)});});
      if(g.length)out.push({k:"BoxPlotChart",box:1,t:"Moyennes par classe",s:"Médiane, quartiles et valeurs atypiques",o:{unit:"/20",label:"Moyennes par classe",min:0,max:20,groups:g.slice(0,8)}});
    }
    var ev=byCls().filter(function(k){return M.C[k].t.filter(function(a){return a.length;}).length>1;}).slice(0,5),vals=[];
    if(ev.length){
      var se=ev.map(function(k,i){var v=M.C[k].t.map(function(a){return geR1(x.mean(a));});v.forEach(function(y){if(y!==null)vals.push(y);});return{name:k||"?",key:k,color:P[i%P.length],values:v};});
      out.push({k:"LineChart",evo:1,t:"Évolution par trimestre",s:"Moyenne des évaluations, T1 à T3",o:{unit:"/20",label:"Évolution par trimestre",labels:["T1","T2","T3"],series:se,goal:{value:TH.moy,label:"Seuil"},
        min:Math.max(0,Math.min(Math.floor(Math.min.apply(null,vals))-1,TH.moy-1)),max:Math.min(20,Math.max(Math.ceil(Math.max.apply(null,vals))+1,TH.moy+1))}});
    }
    var sk=Object.keys(M.SJ).sort(function(a,b){return x.mean(M.SJ[b].v)-x.mean(M.SJ[a].v);}).slice(0,12);
    if(sk.length)out.push({k:"BarChart",subj:1,t:"Moyenne par matière",s:"Sur 20 · trait = seuil de réussite",o:{unit:"/20",label:"Moyenne par matière",labels:sk,keys:sk,values:sk.map(function(k){return geR1(x.mean(M.SJ[k].v));}),goal:{value:TH.moy,label:"Seuil"}}});
  }
  if(x.t==="ens"&&x.tch&&x.tch.length&&!x.tch.err){
    var cn={ok:0,miss:0,soon:0,none:0,unk:0},T={};
    x.tch.forEach(function(g){cn[x.stat(g)]++;var k=x.tname(g);T[k]=(T[k]||0)+(g.n_students||0);});
    var LB=[["ok","Appels faits","#35d6c9"],["miss","Appels non faits","#ff6b9a"],["soon","À venir","#38bdf8"],["none","Sans séance aujourd’hui","#9aa8bc"],["unk","Sans emploi du temps","#ffc15a"]];
    out.push({k:"DonutChart",t:"Appel du jour",s:"État des appels de la journée",o:{unit:"séances",total:x.tch.length,
      text:{label:"Appel du jour",caption:"Séances",of:"sur",ofTotal:"des séances",ofReference:"des séances"},data:LB.map(function(l){return{label:l[1],value:cn[l[0]],color:l[2]};})}});
    var tk=Object.keys(T).sort(function(a,b){return T[b]-T[a];}).slice(0,10);
    out.push({k:"BarChart",t:"Élèves par enseignant",s:"Élèves suivis, toutes matières confondues",o:{unit:"élèves",label:"Élèves par enseignant",labels:tk,values:tk.map(function(k){return T[k];})}});
  }
  if(x.t==="dis"&&x.dsc&&x.dsc.length&&!x.dsc.err){
    var lim=x.dstrOf(Date.now()-30*864e5),D={};
    x.dsc.forEach(function(r){if(!x.get(r.student_id)||r.d<lim)return;var k=x.get(r.student_id).class_label||"",o=D[k]||(D[k]={g:0,a:0});if(r.k==="grv")o.g++;else o.a++;});
    var kd=Object.keys(D).sort(function(a,b){return D[b].g+D[b].a-D[a].g-D[a].a;}).slice(0,10);
    if(kd.length)out.push({k:"BarChart",t:"Incidents par classe",s:"30 derniers jours",o:{unit:"incidents",label:"Incidents par classe",labels:kd.map(function(k){return k||"?";}),series:[
      {name:"Autres",color:P[3],values:kd.map(function(k){return D[k].a;})},{name:"Graves",color:P[4],values:kd.map(function(k){return D[k].g;})}]}});
  }
  if(x.t==="fin"&&x.fin){
    var F=x.fin,LF=[["p","Passe","#35d6c9"],["x","À examiner","#ffc15a"],["r","Redoublement","#ff6b9a"],["n","Non évalué","#9aa8bc"]],tot=x.rows.length;
    out.push({k:"DonutChart",t:"Passages proposés",s:"Décision proposée d’après les moyennes",o:{unit:"élèves",total:tot,
      text:{label:"Passages proposés",caption:"Élèves",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:LF.map(function(l){return{label:l[1],value:F.cnt[l[0]],color:l[2]};})}});
    var kf=Object.keys(F.PC).sort(x.sortCls);
    if(kf.length)out.push({k:"BarChart",t:"Passages par classe",s:"Élèves par décision proposée",o:{unit:"élèves",label:"Passages par classe",labels:kf.map(function(k){return k||"?";}),
      series:LF.map(function(l){return{name:l[1],color:l[2],values:kf.map(function(k){return F.PC[k][l[0]];})};})}});
  }
  return out;
}

/* Dessine les cartes dans l'emplacement #ge ; chaque graphique n'est construit que lorsqu'il approche de l'écran (rapidité) */
function geDraw(x){
  geClear();
  var root=document.getElementById("ge");
  if(!root||!window.Charts||!Charts.Chart)return;
  var cards;try{cards=geCards(Object.assign({t:root.dataset.t},x));}catch(e){cards=[];}
  if(!cards.length){root.remove();return;}
  root.innerHTML=cards.map(function(c,i){return'<section class="card ge-card"><h2>'+c.t+'</h2><p class="sub">'+c.s+'</p><div data-ge="'+i+'"></div>'+geScope(x)+geHow(c.t)+'</section>';}).join("");
  function build(el){
    if(el.dataset.done)return;el.dataset.done="1";
    var c=cards[+el.dataset.ge],C=window[c.k];
    try{if(c.moy&&x.M&&x.M.S)geBuildMoy(el,c,x);else if(c.cls&&x.M&&x.M.S)geBuildCls(el,c,x);else if(c.who&&x.M&&x.M.S)geBuildHist(el,c,x,C);else if(c.box&&x.M&&x.M.S)geBuildBox(el,c,x,C);else if(c.pres&&x.M&&x.M.S)geBuildPres(el,c,x);else if(c.abs&&x.M&&x.M.S)geBuildAbs(el,c,x);else if(c.jauge&&x.M&&x.M.S)geBuildJauge(el,c,x,C);else if(c.evo&&x.M&&x.M.S)geBuildEvo(el,c,x,C);else if(c.subj&&x.M&&x.M.S)geBuildSubj(el,c,x,C);else GE.inst.push(new C(el,c.o));}catch(e){el.textContent="Graphique indisponible.";}
  }
  var els=Array.prototype.slice.call(root.querySelectorAll("[data-ge]"));
  if(!("IntersectionObserver" in window)){els.forEach(build);return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);build(e.target);}});},{rootMargin:"300px 0px"});
  els.forEach(function(el){io.observe(el);});
  setTimeout(function(){els.forEach(function(el){if(el.isConnected&&!el.dataset.done){try{io.unobserve(el);}catch(e){}build(el);}});},1800);
}

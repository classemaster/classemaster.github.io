/* Statistiques de l'année pour un élève (fiche élève), comparées à la classe.
   - stSg, stPill, stTrend : petits outils partagés (écart signé, pastille ▲ ▼, tendance d'une série de notes) ;
     ils servent aussi au tableau des périodes (notes.js) et au graphique de progression (progression.js).
   - Carte « Statistiques de l'année » : ajoutée après le graphique de progression par le point d'extension « fiche » (hooks.js).
   Aucune donnée nouvelle n'est enregistrée : tout est calculé à partir des notes, des appels et des devoirs de la classe. */

/* Écart signé sur 20, arrondi au dixième : +1,8 · −0,4 · 0 */
function stSg(x){var v=Math.round(Math.abs(x)*10)/10;return(x>0&&v?"+":x<0&&v?"−":"")+nf(v);}

/* Pastille d'écart : verte au-dessus, rouge en dessous, neutre quand l'écart est inférieur à 0,5 point */
function stPill(d,u){
  if(d===null||d===undefined||isNaN(d))return"–";
  var r=Math.round(Math.abs(d)*10)/10,k=Math.abs(d)<0.5?"cm-n":d>0?"cm-g":"cm-b";
  return'<span class="cm-d '+k+'">'+(r===0?"= 0":(d>0?"▲ ":"▼ ")+stSg(d))+(r===0?"":u||"")+"</span>";
}

/* Tendance d'une série de notes sur 20 (dans l'ordre des évaluations) : droite de régression sur tout le parcours,
   et non seulement première et dernière note. d = variation estimée entre le début et la fin ; « stable » sous 1 point. */
function stTrend(v){
  var n=v.length,i,mx=(n-1)/2,my=0,sxy=0,sxx=0;
  if(n<2)return null;
  for(i=0;i<n;i++)my+=v[i];
  my/=n;
  for(i=0;i<n;i++){sxy+=(i-mx)*(v[i]-my);sxx+=(i-mx)*(i-mx);}
  var d=sxy/sxx*(n-1);
  return{d:d,n:n,k:Math.abs(d)<1?"flat":d>0?"up":"down"};
}
function stTrendTxt(t){return t.k==="flat"?"Notes stables":t.k==="up"?"En progrès":"En baisse";}

/* Notes de l'élève dans l'ordre des dates, avec la moyenne de la classe à chaque évaluation (si au moins 2 notes saisies) */
function stEvals(c,id){
  return evs(c).filter(function(e){return e.s&&typeof e.s[id]==="number"&&e.m>0;}).sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0;}).map(function(e){
    return{t:e.t,v:n20(e,e.s[id]),cls:evStat(e,c).n>=2?evAvg20(e,c):null};
  });
}

/* Moyenne de l'élève et de la classe par trimestre (T1, T2, T3) */
function stTrim(c,id){
  return[1,2,3].map(function(p){
    var rm=rankMap(c,p);
    return{l:"T"+p,a:rm[id].a,cls:clsAvgStat(rm).avg};
  }).filter(function(x){return x.a!==null&&x.cls!==null;});
}

function stSd(v){
  var m=v.reduce(function(t,x){return t+x;},0)/v.length;
  return Math.sqrt(v.reduce(function(t,x){return t+(x-m)*(x-m);},0)/v.length);
}
/* Présence de l'élève sur toute l'année : appels où il est noté présent, absent ou en retard (un retard compte comme présent) */
function stPresence(c,id){
  var n=0,a=0;
  Object.keys(c.records).forEach(function(k){var v=(c.records[k]||{})[id];if(v){n++;if(v==="a")a++;}});
  return n?{n:n,a:a}:null;
}
/* Devoirs rendus : « rendu » et « en retard » comptent comme rendus ; les devoirs non suivis ne comptent pas */
function stHw(c,id){
  var ok=0,all=0;
  evs(c).forEach(function(e){
    if(!e.h)return;
    var v=rdOf(e,id);
    if(v==="r"||v==="l"){ok++;all++;}else if(v==="n")all++;
  });
  return all?{n:all,a:all-ok}:null;
}

function stRow(l,v){return'<div class="li"><span>'+l+'</span><span style="text-align:right">'+v+"</span></div>";}

function stCard(c,s){
  var E=stEvals(c,s.id);
  if(!E.length)return"";
  var rows="",T=stTrim(c,s.id),i;
  /* évolution d'un trimestre noté au suivant, avec celle de la classe */
  for(i=1;i<T.length;i++){
    rows+=stRow("Évolution "+T[i-1].l+" → "+T[i].l,stPill(T[i].a-T[i-1].a," pt")+' <small class="sub">classe '+stSg(T[i].cls-T[i-1].cls)+"</small>");
  }
  /* notes égales ou supérieures à la moyenne de la classe */
  var cmp=E.filter(function(x){return x.cls!==null;}),up=cmp.filter(function(x){return x.v>=x.cls;}).length;
  if(cmp.length)rows+=stRow("Notes ≥ moyenne de la classe",'<b>'+up+"</b> sur "+cmp.length+(cmp.length>1?" évaluations":" évaluation"));
  /* meilleure et plus faible notes */
  if(E.length>1){
    var hi=E[0],lo=E[0];
    E.forEach(function(x){if(x.v>hi.v)hi=x;if(x.v<lo.v)lo=x;});
    rows+=stRow("Meilleure note",'<b>'+nf(hi.v)+"</b> / 20 <small class=\"sub\">"+esc(hi.t)+"</small>");
    rows+=stRow("Note la plus faible",'<b>'+nf(lo.v)+"</b> / 20 <small class=\"sub\">"+esc(lo.t)+"</small>");
  }
  /* régularité : écart-type des notes sur 20, à partir de 3 notes */
  if(E.length>=3){
    var sd=stSd(E.map(function(x){return x.v;}));
    rows+=stRow("Régularité",'<b>'+(sd<2?"Régulier":sd<4?"Variable":"Irrégulier")+'</b> <small class="sub">± '+nf(Math.round(sd*10)/10)+" pt</small>");
  }
  /* présence et devoirs, avec la classe */
  var pm=stPresence(c,s.id),pc=grPres(c);
  if(pm&&pc)rows+=stRow("Présence",'<b>'+fr(rate(pm))+'</b> <small class="sub">classe '+fr(rate(pc))+"</small>");
  var hm=stHw(c,s.id),hc=grHw(c);
  if(hm&&hc)rows+=stRow("Devoirs rendus",'<b>'+fr(rate(hm))+'</b> <small class="sub">classe '+fr(rate({n:hc.all,a:hc.all-hc.ok}))+"</small>");
  return'<div class="card"><h2>Statistiques de l’année</h2><p class="sub" style="margin-top:0">Sur toute l’année, comparées aux '+c.students.length+' élèves de la classe.</p>'+rows+"</div>";
}

hookOn("fiche",function(h,x){return h+stCard(x.c,x.s);});

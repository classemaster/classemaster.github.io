/* Élèves à suivre : croise absences, retards, devoirs, notes et observations */
function sigOf(c,s){
  var T=th(c),out=[],o=cnt(c,s.id,Object.keys(c.records).filter(inRange));
  if(T.a>0&&o.a>=T.a)out.push({c:"k-cmp",t:o.a+" absence"+(o.a>1?"s":"")});
  if(T.r>0&&o.r>=T.r)out.push({c:"k-dif",t:o.r+" retard"+(o.r>1?"s":"")});
  var nd=0;evs(c).forEach(function(e){if(e.h&&inRange(e.d)&&rdOf(e,s.id)==="n")nd++;});
  if(T.d>0&&nd>=T.d)out.push({c:"k-dif",t:nd+" devoir"+(nd>1?"s":"")+" non rendu"+(nd>1?"s":"")});
  var L=evs(c).filter(function(e){return e.s&&typeof e.s[s.id]==="number"&&e.m>0}).sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0}).map(function(e){return e.s[s.id]/e.m*20;});
  if(L.length>=3){
    var l2=(L[L.length-1]+L[L.length-2])/2,pr=L.slice(0,-2),pv=pr.reduce(function(t,x){return t+x},0)/pr.length;
    if(pv-l2>=2)out.push({c:"k-cmp",t:"notes en baisse ("+nf(pv)+" → "+nf(l2)+")"});
  }
  if(L.length>=2){var av=sAvg(c,s.id);if(av!==null&&av<10)out.push({c:"k-cmp",t:"moyenne "+nf(av)+" / 20"});}
  var ob=obList(c,s.id).filter(function(x){return(x.k==="cmp"||x.k==="dif")&&inRange(x.d);});
  if(ob.length>=2)out.push({c:"k-dif",t:ob.length+" observations (comportement, difficulté)"});
  return out;
}
function renderSuivi(){
  var c=cl(),h='<h1>Élèves à suivre</h1><p class="sub">'+esc(c.name)+(c.subj?" · "+esc(c.subj):"")+'</p>'+filterUI();
  if(!c.students.length)return h+'<div class="empty">Ajoutez d’abord des élèves à cette classe.</div>';
  var L=c.students.map(function(s){return{s:s,g:sigOf(c,s)};}).filter(function(x){return x.g.length;});
  L.sort(function(a,b){return b.g.length-a.g.length||a.s.name.localeCompare(b.s.name,"fr")});
  h+='<p class="sub">'+(L.length?L.length+" élève"+(L.length>1?"s":"")+" sur "+c.students.length+" à suivre sur cette période.":"Aucun élève n’atteint un seuil sur cette période.")+'</p>';
  h+=L.map(function(x){return'<div class="card sv"><div class="sv-h"><button class="lnk" data-fiche="'+x.s.id+'"><b>'+esc(x.s.name)+'</b></button><span class="al" style="margin:0">'+x.g.length+' '+(x.g.length>1?"signaux":"signal")+'</span></div><div class="sv-c">'+x.g.map(function(y){return'<span class="tg '+y.c+'">'+esc(y.t)+'</span>';}).join("")+'</div></div>';}).join("");
  return h+helpTip("Comment sont choisis ces élèves ?",'Absences, retards et devoirs non rendus : seuils réglables dans « Gérer la classe ». Notes en baisse : les deux dernières notes (sur 20) sont au moins 2 points sous les précédentes, avec 3 notes minimum. Moyenne : sous 10 avec 2 notes minimum. Observations : au moins 2 de type comportement ou difficulté.')+'<button class="btn ghost" data-go="eleves">Régler les seuils</button>';
}

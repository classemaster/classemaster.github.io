/* Devoirs rendus ou non, et statistiques d’une évaluation */
var RD=[["r","Rendu"],["l","En retard"],["n","Non rendu"]];
function rdOf(e,id){return(e.r&&e.r[id])||"";}
function rdCount(e,c){var o={r:0,l:0,n:0,x:0};c.students.forEach(function(s){o[rdOf(e,s.id)||"x"]++;});return o;}
function rdBtns(e,s){var v=rdOf(e,s.id);return RD.map(function(x){return'<button data-rd="'+x[0]+'" data-rs="'+s.id+'" aria-pressed="'+(v===x[0])+'" class="rd-'+x[0]+'">'+x[1]+'</button>';}).join("");}
function evRdTxt(e,c){if(!e.h)return"";var n=rdCount(e,c).n;return n?" · "+n+" non rendu"+(n>1?"s":""):"";}
function names(a){return a.length>3?a.slice(0,3).join(", ")+" +"+(a.length-3):a.join(", ");}

/* Cartes de statistiques affichées sous les résultats d’une évaluation */
function evStatsHTML(e,c){
  var L=[],h="";
  c.students.forEach(function(s){var v=e.s&&e.s[s.id];if(typeof v==="number")L.push({n:s.name,v:v,t:v/e.m*20});});
  if(L.length){
    var vs=L.map(function(x){return x.v}).sort(function(a,b){return a-b}),n=vs.length;
    var avg=vs.reduce(function(t,x){return t+x},0)/n,med=n%2?vs[(n-1)/2]:(vs[n/2-1]+vs[n/2])/2;
    var mx=vs[n-1],mn=vs[0];
    var bs=L.filter(function(x){return x.v===mx}).map(function(x){return x.n}),ws=L.filter(function(x){return x.v===mn}).map(function(x){return x.n});
    var low=L.filter(function(x){return x.t<10}).length,ok=n-low;
    var bins=[0,0,0,0],lab=["0–4","5–9","10–14","15–20"];
    L.forEach(function(x){bins[x.t<5?0:x.t<10?1:x.t<15?2:3]++;});
    var top=Math.max.apply(null,bins);
    h+='<div class="card"><h2>Statistiques de la classe</h2><p class="sub" style="margin-top:0">'+n+' note'+(n>1?"s":"")+' sur '+c.students.length+' élève'+(c.students.length>1?"s":"")+'. Les seuils « moins de 10 » et la répartition sont ramenés sur 20.</p>'+
    '<div class="cl-t"><div><b style="color:var(--accent)">'+nf(avg)+'</b><span>Moyenne / '+nf(e.m)+'</span></div><div><b>'+nf(med)+'</b><span>Médiane</span></div><div><b style="color:var(--p)">'+Math.round(ok/n*100)+' %</b><span>≥ 10 / 20</span></div></div>'+
    '<div class="cl-t"><div><b style="color:var(--p)">'+nf(mx)+'</b><span>Meilleure · '+esc(names(bs))+'</span></div><div><b style="color:var(--a)">'+nf(mn)+'</b><span>Plus basse · '+esc(names(ws))+'</span></div><div><b style="color:var(--a)">'+low+'</b><span>Sous 10 / 20</span></div></div>'+
    '<h2 style="font-size:.95rem;margin:14px 0 6px">Répartition des notes (sur 20)</h2><div class="dist" role="img" aria-label="Répartition : '+lab.map(function(l,i){return bins[i]+" élève(s) entre "+l}).join(", ")+'">'+bins.map(function(b,i){return'<div><em>'+b+'</em><i style="height:'+(top?Math.max(4,Math.round(b/top*100)):4)+'%"></i><span>'+lab[i]+'</span></div>';}).join("")+'</div></div>';
  }
  if(e.h&&c.students.length){
    var o=rdCount(e,c),nr=c.students.filter(function(s){return rdOf(e,s.id)==="n"}).map(function(s){return s.name});
    h+='<div class="card"><h2>Devoirs rendus</h2><div class="cl-t"><div><b style="color:var(--p)">'+o.r+'</b><span>Rendu'+(o.r>1?"s":"")+'</span></div><div><b style="color:var(--r)">'+o.l+'</b><span>En retard</span></div><div><b style="color:var(--a)">'+o.n+'</b><span>Non rendu'+(o.n>1?"s":"")+'</span></div></div>'+
    (o.x?'<p class="sub" style="margin:8px 0 0">'+o.x+' élève'+(o.x>1?"s":"")+' pas encore renseigné'+(o.x>1?"s":"")+'.</p>':'')+
    (nr.length?'<p style="margin:8px 0 0"><b>Non rendu :</b> '+esc(nr.join(" ; "))+'</p>':'')+'</div>';
  }
  return h;
}

/* Fiche d’un élève : devoirs rendus sur la période choisie */
function ficheDevoirs(c,s){
  var E=evs(c).filter(function(e){return e.h&&inRange(e.d)}).sort(function(a,b){return b.d<a.d?-1:b.d>a.d?1:0});
  if(!E.length)return"";
  var o={r:0,l:0,n:0,x:0},rows="";
  E.forEach(function(e){
    var v=rdOf(e,s.id);o[v||"x"]++;
    if(v==="l"||v==="n")rows+='<div class="li"><span><b>'+esc(e.t)+'</b><br><span class="sub">'+esc(fmt(e.d))+' · '+(v==="n"?"Non rendu":"Rendu en retard")+'</span></span></div>';
  });
  var T=th(c),al=T.d>0&&o.n>=T.d?'<p style="margin:8px 0 0"><span class="al" style="margin:0">⚠ '+o.n+' devoir'+(o.n>1?"s":"")+' non rendu'+(o.n>1?"s":"")+'</span></p>':"";
  return'<div class="card"><h2>Devoirs rendus</h2><p class="sub" style="margin-top:0">'+o.r+' rendu'+(o.r>1?"s":"")+' · '+o.l+' en retard · '+o.n+' non rendu'+(o.n>1?"s":"")+' sur '+E.length+' devoir'+(E.length>1?"s":"")+' suivi'+(E.length>1?"s":"")+'</p>'+al+(rows||'<p class="sub" style="margin:8px 0 0">Aucun oubli sur cette période.</p>')+'</div>';
}

/* Page de la classe : élèves avec des devoirs non rendus sur la période */
function classeDevoirs(c){
  var E=evs(c).filter(function(e){return e.h&&inRange(e.d)});
  if(!E.length||!c.students.length)return"";
  var T=th(c),L=c.students.map(function(s){var o={r:0,l:0,n:0};E.forEach(function(e){var v=rdOf(e,s.id);if(v)o[v]++;});return{s:s,o:o};}).filter(function(x){return x.o.n||x.o.l;});
  L.sort(function(a,b){return b.o.n-a.o.n||b.o.l-a.o.l||a.s.name.localeCompare(b.s.name,"fr")});
  return'<div class="card"><h2>Devoirs rendus</h2><p class="sub" style="margin-top:0">'+E.length+' devoir'+(E.length>1?"s":"")+' suivi'+(E.length>1?"s":"")+' sur la période.</p>'+
  (L.length?'<div class="scroll"><table><tr><th>Élève</th><th class="n">Non rendus</th><th class="n">En retard</th></tr>'+L.map(function(x){return'<tr><td><button class="lnk" data-fiche="'+x.s.id+'">'+esc(x.s.name)+'</button>'+(T.d>0&&x.o.n>=T.d?'<span class="al">⚠</span>':'')+'</td><td class="n">'+x.o.n+'</td><td class="n">'+x.o.l+'</td></tr>';}).join('')+'</table></div>':'<p class="sub" style="margin:0">Aucun oubli sur la période.</p>')+'</div>';
}

/* Interactions : case « Suivre les devoirs rendus » et boutons Rendu / En retard / Non rendu */
document.getElementById("view").addEventListener("change",function(e){
  if(e.target.id!=="evh")return;
  var c=cl(),ev=evs(c).find(function(x){return x.id===evid});if(!ev)return;
  ev.h=e.target.checked;save();var y=window.scrollY;render();window.scrollTo(0,y);
});
document.getElementById("view").addEventListener("click",function(e){
  var b=e.target.closest("[data-rd]");if(!b)return;
  var c=cl(),ev=evs(c).find(function(x){return x.id===evid}),s=ev&&c.students.find(function(x){return x.id===b.dataset.rs});if(!s)return;
  if(!ev.r)ev.r={};
  if(ev.r[s.id]===b.dataset.rd)delete ev.r[s.id];else ev.r[s.id]=b.dataset.rd;
  save();
  var row=b.closest(".rd");if(row)row.innerHTML=rdBtns(ev,s);
  var sx=document.getElementById("evst");if(sx)sx.innerHTML=evStatsHTML(ev,c);
});

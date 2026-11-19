/* Notes et évaluations */
function nf(x){return x===null||x===undefined||isNaN(x)?"–":String(Math.round(x*100)/100).replace(".",",");}
function evs(c){return c.ev||(c.ev=[]);}
function sAvg(c,id){var w=0,t=0;evs(c).forEach(function(e){var v=e.s&&e.s[id];if(typeof v==="number"&&e.m>0){var k=e.k||1;t+=v/e.m*20*k;w+=k;}});return w?t/w:null;}
function evStat(e,c){var n=0,t=0,mn=null,mx=null;c.students.forEach(function(s){var v=e.s&&e.s[s.id];if(typeof v==="number"){n++;t+=v;if(mn===null||v<mn)mn=v;if(mx===null||v>mx)mx=v;}});return{n:n,avg:n?t/n:null,mn:mn,mx:mx};}
function evLine(e,c){var x=evStat(e,c);return x.n?"Moyenne "+nf(x.avg)+" / "+nf(e.m)+" · min "+nf(x.mn)+" · max "+nf(x.mx)+" · "+x.n+" note"+(x.n>1?"s":""):"Aucune note saisie";}
function ficheNotes(c,s){
  var E=evs(c).filter(function(e){return e.s&&typeof e.s[s.id]==="number"}).sort(function(a,b){return b.d<a.d?-1:1});
  var a=sAvg(c,s.id);
  return'<div class="card"><h2>Notes</h2>'+(E.length?'<div class="rate">'+nf(a)+' <span style="font-size:1rem">/ 20</span></div>'+E.map(function(e){return'<div class="li"><span><b>'+esc(e.t)+'</b><br><span class="sub">'+esc(fmt(e.d))+'</span></span><span>'+nf(e.s[s.id])+' / '+nf(e.m)+'</span></div>';}).join(''):'<p class="sub" style="margin:0">Aucune note pour cet élève.</p>')+'</div>';
}
function renderNotes(){
  var c=cl(),E=evs(c).slice().sort(function(a,b){return b.d<a.d?-1:b.d>a.d?1:0});
  var h='<h1>Notes</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p><div class="cl-act"><button class="btn" id="newev">+ Nouvelle évaluation</button></div>';
  if(!c.students.length)return h+'<div class="empty">Ajoutez d’abord des élèves à cette classe.</div>';
  var rk=c.students.map(function(s){return{s:s,a:sAvg(c,s.id)}}).sort(function(x,y){return(y.a===null?-1:y.a)-(x.a===null?-1:x.a)||x.s.name.localeCompare(y.s.name,"fr")});
  var ok=rk.filter(function(x){return x.a!==null}),m=ok.length?ok.reduce(function(t,x){return t+x.a},0)/ok.length:null;
  var ps=ok.length?Math.round(ok.filter(function(x){return x.a>=10}).length/ok.length*100):null;
  h+='<div class="cl-t"><div><b style="color:var(--accent)">'+nf(m)+'</b><span>Moyenne / 20</span></div><div><b style="color:var(--p)">'+(ps===null?"–":ps+" %")+'</b><span>≥ 10 / 20</span></div><div><b>'+E.length+'</b><span>Évaluation'+(E.length>1?'s':'')+'</span></div></div>';
  h+='<div class="card"><h2>Classement</h2>'+(ok.length?'<div class="scroll"><table><tr><th class="n">#</th><th>Élève</th><th class="n">Moy. /20</th></tr>'+rk.map(function(x,i){return'<tr><td class="n">'+(x.a===null?'–':i+1)+'</td><td><button class="lnk" data-fiche="'+x.s.id+'">'+esc(x.s.name)+'</button></td><td class="n">'+nf(x.a)+'</td></tr>';}).join('')+'</table></div>':'<p class="sub" style="margin:0">Le classement apparaît dès qu’une note est saisie.</p>')+'</div>';
  h+='<h2 style="font-size:1.05rem">Évaluations</h2>'+(E.length?E.map(function(e){var x=evStat(e,c);return'<button class="hist" data-ev="'+e.id+'"><span>'+esc(e.t)+' <small>'+esc(fmt(e.d))+'</small></span><span>'+(x.n?nf(x.avg)+' / '+nf(e.m):'à saisir')+evRdTxt(e,c)+'</span></button>';}).join(''):'<p class="sub">Aucune évaluation pour le moment.</p>');
  return h;
}
function renderEval(){
  var c=cl(),e=evs(c).find(function(x){return x.id===evid});
  if(!e)return'<div class="empty">Évaluation introuvable.<br><br><button class="btn" data-go="notes">Retour aux notes</button></div>';
  var h='<h1>'+esc(c.name)+'</h1><div class="card"><input type="text" id="evt" value="'+esc(e.t)+'" aria-label="Titre" style="width:100%;margin-bottom:8px"><div style="display:flex;gap:10px;flex-wrap:wrap"><label>Date <input type="date" id="evd" value="'+e.d+'"></label><label>Sur <input type="number" min="1" id="evm" value="'+e.m+'" style="width:76px"></label><label>Coef. <input type="number" min="0" step="0.5" id="evk" value="'+(e.k||1)+'" style="width:76px"></label></div><label class="rdt"><input type="checkbox" id="evh"'+(e.h?" checked":"")+'> Suivre les devoirs rendus</label></div>';
  h+='<div class="card"><h2>Résultats</h2><p class="sub" id="evs" style="margin-top:0">'+evLine(e,c)+'</p>';
  if(!c.students.length)h+='<p class="sub">Aucun élève.</p>';
  c.students.forEach(function(s){var v=e.s[s.id];h+='<div class="er"><div class="li"><span style="flex:1;min-width:0">'+esc(s.name)+'</span><input type="text" inputmode="decimal" data-ns="'+s.id+'" value="'+(typeof v==="number"?nf(v):"")+'" placeholder="–" aria-label="Note de '+esc(s.name)+'" style="width:84px;text-align:right"></div>'+(e.h?'<div class="rd">'+rdBtns(e,s)+'</div>':'')+'</div>';});
  return h+'</div><div id="evst">'+evStatsHTML(e,c)+'</div><button class="btn ghost" id="delev">Supprimer cette évaluation</button>';
}

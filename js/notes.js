/* Notes et évaluations */
function nf(x){return x===null||x===undefined||isNaN(x)?"–":String(Math.round(x*100)/100).replace(".",",");}
function evs(c){return c.ev||(c.ev=[]);}
/* sAvg (moyenne pondérée /20, par trimestre ou annuelle) : voir moyennes.js */
function evStat(e,c){var n=0,t=0,mn=null,mx=null;c.students.forEach(function(s){var v=e.s&&e.s[s.id];if(typeof v==="number"){n++;t+=v;if(mn===null||v<mn)mn=v;if(mx===null||v>mx)mx=v;}});return{n:n,avg:n?t/n:null,mn:mn,mx:mx};}
function evLine(e,c){var x=evStat(e,c);return x.n?"Moyenne "+nf(x.avg)+" / "+nf(e.m)+" · min "+nf(x.mn)+" · max "+nf(x.mx)+" · "+x.n+" note"+(x.n>1?"s":""):"Aucune note saisie";}
function ficheNotes(c,s){
  var E=evs(c).filter(function(e){return e.s&&typeof e.s[s.id]==="number"}).sort(function(a,b){return b.d<a.d?-1:1});
  var a=sAvg(c,s.id);
  var tr="";
  if(E.length){
    tr='<div class="scroll"><table><tr><th>Période</th><th class="n">Moyenne</th><th class="n">Classe</th><th class="n">Écart</th><th class="n">Rang</th></tr>'+[1,2,3,"A"].map(function(p){
      var all=rankMap(c,p),rm=all[s.id],ca=clsAvgStat(all).avg;
      return'<tr><td>'+(p==="A"?"Annuelle":"Trimestre "+p)+'</td><td class="n">'+nf(rm.a)+'</td><td class="n">'+nf(ca)+'</td><td class="n">'+(rm.a===null||ca===null?"–":stPill(rm.a-ca))+'</td><td class="n">'+rkTxt(rm)+'</td></tr>';
    }).join('')+'</table></div>';
  }
  return'<div class="card"><h2>Notes</h2>'+(E.length?'<div class="rate">'+nf(a)+' <span style="font-size:1rem">/ 20</span></div>'+tr+E.map(function(e){return'<div class="li"><span><b>'+esc(e.t)+'</b><br><span class="sub">'+esc(fmt(e.d))+' · T'+trOf(e)+'</span></span><span>'+nf(e.s[s.id])+' / '+nf(e.m)+'</span></div>';}).join(''):'<p class="sub" style="margin:0">Aucune note pour cet élève.</p>')+'</div>'+(E.length?ficheProg(c,s)+hookPipe("fiche","",{c:c,s:s})+ficheBulletin(c,s):'');
}
function renderNotes(){return hookPipe("notes",notesCore());}   /* compléments par hookOn("notes") */
function notesCore(){
  var c=cl(),p=ntr;
  var E=evs(c).filter(function(e){return typeof p!=="number"||trOf(e)===p}).sort(function(a,b){return b.d<a.d?-1:b.d>a.d?1:0});
  var h='<h1 style="text-transform:none">Notes</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p><div class="cl-act"><button class="btn" id="newev">+ Nouvelle évaluation</button></div>';
  if(!c.students.length)return h+'<div class="empty">Ajoutez d’abord des élèves à cette classe.</div>';
  h+='<div class="flt"><select id="ntr" aria-label="Période">'+trOpts(p,true)+'</select></div>';
  var rm=rankMap(c,p);
  var rk=c.students.map(function(s){return{s:s,a:rm[s.id].a,r:rm[s.id].r}}).sort(function(x,y){return(x.r===null?1e9:x.r)-(y.r===null?1e9:y.r)||x.s.name.localeCompare(y.s.name,"fr")});
  var ok=rk.filter(function(x){return x.a!==null}),st=clsAvgStat(rm);
  var ps=ok.length?Math.round(ok.filter(function(x){return x.a>=10}).length/ok.length*100):null;
  h+='<div class="cl-t"><div><b style="color:var(--accent)">'+nf(st.avg)+'</b><span>Moyenne / 20</span></div><div><b style="color:var(--p)">'+(ps===null?"–":ps+" %")+'</b><span>≥ 10 / 20</span></div><div><b>'+E.length+'</b><span>Évaluation'+(E.length>1?'s':'')+'</span></div></div>';
  var ann=p==="A";
  var th0=ann?'<th class="n">T1</th><th class="n">T2</th><th class="n">T3</th>':'';
  h+='<div class="card"><h2>Classement · '+esc(trName(p))+'</h2>'+(ok.length?'<div class="scroll"><table><tr><th class="n">#</th><th>Élève</th>'+th0+'<th class="n">Moy. /20</th></tr>'+rk.map(function(x){
    var tc=ann?[1,2,3].map(function(t){return'<td class="n">'+nf(sAvg(c,x.s.id,t))+'</td>';}).join(''):'';
    return'<tr><td class="n">'+(x.r===null?'–':x.r)+'</td><td><button class="lnk" data-fiche="'+x.s.id+'">'+esc(x.s.name)+'</button></td>'+tc+'<td class="n">'+nf(x.a)+'</td></tr>';
  }).join('')+'</table></div>':'<p class="sub" style="margin:0">Le classement apparaît dès qu’une note est saisie.</p>')+'</div>';
  h+=classeProg(c,E);
  h+='<h2 style="font-size:1.05rem">Évaluations</h2>'+(E.length?E.map(function(e){var x=evStat(e,c);return'<button class="hist" data-ev="'+e.id+'"><span>'+esc(e.t)+' <small>'+esc(fmt(e.d))+' · T'+trOf(e)+'</small></span><span>'+(x.n?nf(x.avg)+' / '+nf(e.m):'à saisir')+evRdTxt(e,c)+'</span></button>';}).join(''):'<p class="sub">Aucune évaluation pour le moment.</p>');
  return h+bulletinsCard(c);
}
function renderEval(){
  var c=cl(),e=evs(c).find(function(x){return x.id===evid});
  if(!e)return'<div class="empty">Évaluation introuvable.<br><br><button class="btn" data-go="notes">Retour aux notes</button></div>';
  var trs='<label>Trimestre <select id="evtr" style="width:auto"><option value="">Auto (T'+autoTr(e.d)+')</option>'+[1,2,3].map(function(t){return'<option value="'+t+'"'+(e.tr===t?" selected":"")+'>Trimestre '+t+'</option>';}).join('')+'</select></label>';
  var h='<h1>'+esc(c.name)+'</h1><div class="card"><input type="text" id="evt" value="'+esc(e.t)+'" aria-label="Titre" style="width:100%;margin-bottom:8px"><div style="display:flex;gap:10px;flex-wrap:wrap"><label>Date <input type="date" id="evd" value="'+e.d+'"></label><label>Sur <input type="number" min="1" id="evm" value="'+e.m+'" style="width:76px"></label><label>Coef. <input type="number" min="0" step="0.5" id="evk" value="'+(e.k===undefined?1:e.k)+'" style="width:76px"></label>'+trs+'</div><label class="rdt"><input type="checkbox" id="evh"'+(e.h?" checked":"")+'> Suivre les devoirs rendus</label></div>';
  h+='<div class="card"><h2>Résultats</h2><p class="sub" id="evs" style="margin-top:0">'+evLine(e,c)+'</p>';
  if(!c.students.length)h+='<p class="sub">Aucun élève.</p>';
  c.students.forEach(function(s){var v=e.s[s.id];h+='<div class="er"><div class="li"><span style="flex:1;min-width:0">'+esc(s.name)+'</span><input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" data-ns="'+s.id+'" value="'+(typeof v==="number"?nf(v):"")+'" placeholder="–" aria-label="Note de '+esc(s.name)+'" style="width:84px;text-align:right"></div>'+(e.h?'<div class="rd">'+rdBtns(e,s)+'</div>':'')+'</div>';});
  return h+'</div><div id="evst">'+evStatsHTML(e,c)+'</div><button class="btn ghost" id="delev">Supprimer cette évaluation</button>';
}

/* Observations sur les élèves : notes datées (comportement, difficultés, points forts) */
var OBK=[["pos","Positif"],["cmp","Comportement"],["dif","Difficulté"],["aut","Autre"],["avt","Avertissement (transmis à l’administration)"],["inc","Incident (transmis à l’administration)"],["grv","Incident grave (transmis à l’administration)"]];
function obName(k){var f=OBK.filter(function(x){return x[0]===k})[0];return f?f[1].replace(/ \(transmis.*$/,""):"Autre";}
function obTag(k){return'<span class="tg k-'+esc(k)+'">'+esc(obName(k))+'</span>';}
function obList(c,id){return(c.ob||[]).filter(function(o){return!id||o.s===id;}).sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0;});}
function ficheObs(c,s){
  var L=obList(c,s.id);
  return'<div class="card"><h2>Observations</h2><select id="obk" aria-label="Type d’observation" style="width:100%;margin-bottom:8px">'+OBK.map(function(x){return'<option value="'+x[0]+'">'+x[1]+'</option>';}).join('')+'</select><textarea id="obt" rows="2" placeholder="Ex. Participe bien, a besoin d’aide en lecture…" aria-label="Observation"></textarea><p class="sub" style="margin:6px 0 0">Les observations restent privées. Seuls les <b>avertissements</b> et les <b>incidents</b> sont transmis à l’administration (élèves liés à leur dossier).</p><div class="bar" style="margin:8px 0 0"><button class="btn" id="obadd">Ajouter l’observation</button></div>'+
  (L.length?L.map(function(o){return'<div class="li"><span style="min-width:0">'+obTag(o.k)+' <small class="sub">'+esc(fmt(o.d))+'</small><br>'+esc(o.t)+'</span><button data-obdel="'+o.id+'" aria-label="Supprimer l’observation">Supprimer</button></div>';}).join(''):'<p class="sub" style="margin:10px 0 0">Aucune observation pour cet élève.</p>')+'</div>';
}
function classeObs(c){
  var L=obList(c).filter(function(o){return c.students.some(function(s){return s.id===o.s;});}).slice(0,5);
  if(!L.length)return"";
  return'<div class="card"><h2>Observations récentes</h2>'+L.map(function(o){var s=c.students.filter(function(x){return x.id===o.s;})[0];return'<button class="hist" data-fiche="'+o.s+'"><span style="min-width:0"><b>'+esc(s.name)+'</b> '+obTag(o.k)+'<br><small>'+esc(o.t.length>60?o.t.slice(0,60)+"…":o.t)+'</small></span><span>'+esc(fmt(o.d))+'</span></button>';}).join('')+'</div>';
}
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl();
  if(t.id==="obadd"){
    var tx=document.getElementById("obt").value.trim();if(!tx)return;
    (c.ob||(c.ob=[])).push({id:uid(),s:sel,d:today(),k:document.getElementById("obk").value,t:tx});
    save();var y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  var d=t.closest("[data-obdel]");
  if(d){var o0=(c.ob||[]).find(function(o){return o.id===d.dataset.obdel;});delItem(c,"ob",d.dataset.obdel,o0?o0.t.slice(0,40):"Observation");var y2=window.scrollY;render();window.scrollTo(0,y2);}
});

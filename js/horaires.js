/* Emploi du temps par classe : séances de la semaine, séances du jour, rappel */
var JOURS=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
function hm(t){var p=String(t).split(":");return(+p[0])*60+(+p[1]||0);}
function ttSorted(c){return(c.tt||[]).slice().sort(function(a,b){return((a.d+6)%7)-((b.d+6)%7)||hm(a.s)-hm(b.s);});}
function homeToday(){
  var now=new Date(),dow=now.getDay(),nm=now.getHours()*60+now.getMinutes(),t=today(),L=[],any=false;
  D.classes.forEach(function(c){(c.tt||[]).forEach(function(x){any=true;if(x.d===dow)L.push({c:c,x:x});});});
  if(!any)return"";
  L.sort(function(a,b){return hm(a.x.s)-hm(b.x.s);});
  var nxt=-1;L.forEach(function(o,i){if(nxt<0&&hm(o.x.e)>nm)nxt=i;});
  var ban="";
  if(nxt>=0){var o=L[nxt],ds=hm(o.x.s)-nm;
    if(ds<=0)ban='<p class="bn">▶ '+esc(o.c.name)+' : séance en cours</p>';
    else if(ds<=15)ban='<p class="bn">⏰ '+esc(o.c.name)+' commence dans '+ds+' min</p>';}
  var rows=L.map(function(o,i){
    var done=!!dayRate(o.c,t),over=hm(o.x.e)<=nm,cur=i===nxt?(hm(o.x.s)<=nm?" · En cours":" · Prochaine"):"";
    return'<button class="hist" data-sd="'+o.c.id+'|'+t+'"><span><b>'+esc(o.x.s)+'–'+esc(o.x.e)+'</b> '+esc(o.c.name)+(o.x.r?' <small>'+esc(o.x.r)+'</small>':'')+'</span><span>'+(done?'✓ Appel fait':over?'Non fait':'À faire')+(over?'':cur)+'</span></button>';
  }).join('');
  return'<section class="hm-card"><h2 class="hm-h">Aujourd’hui</h2>'+ban+(rows||'<p class="sub" style="margin:0">Aucune séance prévue aujourd’hui.</p>')+'</section>';
}
function classeHoraires(c){
  var L=ttSorted(c);
  return'<div class="card"><h2>Emploi du temps</h2>'+(L.length?L.map(function(x){return'<div class="li"><span><b>'+JOURS[x.d].slice(0,3)+'</b> '+esc(x.s)+'–'+esc(x.e)+'</span><span class="sub" style="margin:0">'+esc(x.r||"")+'</span></div>';}).join(''):'<p class="sub" style="margin-top:0">Aucune séance enregistrée pour cette classe.</p>')+'<div class="bar" style="margin:10px 0 0"><button class="btn ghost" data-go="horaires">'+(L.length?'Modifier':'Ajouter des séances')+'</button></div></div>';
}
function renderHoraires(){
  var c=cl(),L=ttSorted(c);
  var h='<h1>Emploi du temps</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p>';
  h+='<div class="card"><h2>Ajouter une séance</h2><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px"><select id="sld" aria-label="Jour">'+[1,2,3,4,5,6,0].map(function(d){return'<option value="'+d+'">'+JOURS[d]+'</option>';}).join('')+'</select><label>De <input type="time" id="sls" value="08:00"></label><label>À <input type="time" id="sle" value="09:00"></label></div><input type="text" id="slr" placeholder="Salle (facultatif)" aria-label="Salle" style="width:100%;margin-bottom:8px"><button class="btn" id="addsl">Ajouter</button></div>';
  h+='<div class="card"><h2>Séances ('+L.length+')</h2>'+(L.length?L.map(function(x){return'<div class="li"><span><b>'+JOURS[x.d]+'</b> '+esc(x.s)+'–'+esc(x.e)+(x.r?'<br><span class="sub">'+esc(x.r)+'</span>':'')+'</span><button data-delsl="'+x.id+'" aria-label="Supprimer la séance">Supprimer</button></div>';}).join(''):'<p class="sub" style="margin:0">Aucune séance.</p>')+'</div>';
  return h;
}
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl();
  if(t.id==="addsl"){
    var s=document.getElementById("sls").value,en=document.getElementById("sle").value;
    if(!s||!en||hm(en)<=hm(s)){alert("L’heure de fin doit être après l’heure de début.");return;}
    (c.tt||(c.tt=[])).push({id:uid(),d:+document.getElementById("sld").value,s:s,e:en,r:document.getElementById("slr").value.trim()});
    save();var y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  var d=t.closest("[data-delsl]");
  if(d&&confirm("Supprimer cette séance ?")){c.tt=(c.tt||[]).filter(function(x){return x.id!==d.dataset.delsl;});save();var y2=window.scrollY;render();window.scrollTo(0,y2);}
});
/* Rafraîchit « Aujourd’hui » chaque minute sur l’accueil (le rappel suit l’heure) */
setInterval(function(){
  if(view!=="home"||document.hidden)return;
  var a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;
  var y=window.scrollY;render();window.scrollTo(0,y);
},60000);

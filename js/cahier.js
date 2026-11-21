/* Cahier de textes et progression du programme */
/* c.ct : séances {id,d,t:contenu,w:travail à faire,p:id de la leçon}   c.pg : programme {id,t,x:fait à la main} */
function pgList(c){return c.pg||(c.pg=[]);}
function ctList(c){return c.ct||(c.ct=[]);}
function pgDone(c,l){return l.x===true||ctList(c).some(function(s){return s.p===l.id;});}
function pgStat(c){
  var L=pgList(c),n=L.filter(function(l){return pgDone(c,l);}).length;
  return{n:n,total:L.length,pct:L.length?Math.round(n/L.length*100):null};
}
function pgBar(c){
  var s=pgStat(c);
  if(!s.total)return'<p class="sub" style="margin:0">Ajoutez les leçons du programme pour suivre la progression.</p>';
  return'<div class="pgv"><b>'+s.pct+' %</b><span>du programme couvert · '+s.n+' leçon'+(s.n>1?'s':'')+' sur '+s.total+'</span></div><div class="pgb" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+s.pct+'" aria-label="Programme couvert"><i style="width:'+s.pct+'%"></i></div>';
}
function classeCahier(c){
  var s=pgStat(c),last=ctList(c).slice().sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0})[0];
  return'<div class="card"><h2>Cahier de textes</h2>'+pgBar(c)+'<p class="sub" style="margin:8px 0 0">'+(last?'Dernière séance : '+esc(fmt(last.d))+' · '+esc(last.t.length>50?last.t.slice(0,50)+'…':last.t):'Aucune séance enregistrée.')+'</p><div class="bar" style="margin:10px 0 0"><button class="btn ghost" data-go="cahier">Ouvrir le cahier</button></div></div>';
}
function renderCahier(){
  var c=cl(),P=pgList(c),S=ctList(c).slice().sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0});
  var h='<h1 style="text-transform:none">Cahier de textes</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p>';
  h+='<div class="card"><h2>Progression du programme</h2>'+pgBar(c)+'</div>';
  h+='<div class="card"><h2>Nouvelle séance</h2><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px"><label>Date <input type="date" id="cxd" value="'+today()+'"></label></div>'+
  '<select id="cxp" aria-label="Leçon du programme" style="width:100%;margin-bottom:8px"><option value="">Leçon : hors programme</option>'+P.map(function(l){return'<option value="'+l.id+'">'+(pgDone(c,l)?'✓ ':'')+esc(l.t)+'</option>';}).join('')+'</select>'+
  '<textarea id="cxt" rows="3" placeholder="Contenu de la séance (ex. Le présent de l’indicatif : verbes du 1er groupe)" aria-label="Contenu de la séance"></textarea>'+
  '<input type="text" id="cxw" placeholder="Travail à faire (facultatif)" aria-label="Travail à faire" style="width:100%;margin-top:8px">'+
  '<div class="bar" style="margin:8px 0 0"><button class="btn" id="cxadd">Enregistrer la séance</button></div></div>';
  h+='<div class="card"><h2>Programme ('+P.length+' leçon'+(P.length>1?'s':'')+')</h2>'+
  (P.length?P.map(function(l){
    var seen=ctList(c).filter(function(s){return s.p===l.id;}).sort(function(a,b){return a.d<b.d?-1:1;})[0];
    return'<div class="li"><label class="pgl"><input type="checkbox" data-pgx="'+l.id+'"'+(pgDone(c,l)?' checked':'')+(seen?' disabled':'')+'><span>'+esc(l.t)+(seen?'<br><small class="sub">vue le '+esc(fmt(seen.d))+'</small>':'')+'</span></label><button data-pgdel="'+l.id+'" aria-label="Retirer la leçon">Retirer</button></div>';
  }).join(''):'<p class="sub" style="margin-top:0">Aucune leçon pour le moment.</p>')+
  '<p class="sub" style="margin:12px 0 4px">Ajouter des leçons, une par ligne (vous pouvez coller tout le programme) :</p><textarea id="pgt" rows="4" placeholder="Le nom et le groupe nominal&#10;Le présent de l’indicatif&#10;Le récit au passé" aria-label="Leçons à ajouter"></textarea><div class="bar" style="margin:8px 0 0"><button class="btn ghost" id="pgadd">Ajouter au programme</button></div></div>';
  h+='<h2 style="font-size:1.05rem">Séances ('+S.length+')</h2>';
  h+=S.length?S.map(function(s){
    var l=P.filter(function(x){return x.id===s.p})[0];
    return'<div class="card" style="padding:12px"><div class="cr-h"><span><b>'+esc(fmt(s.d,true))+'</b>'+(l?'<br><span class="tg k-aut">'+esc(l.t)+'</span>':'')+'</span><button class="lnk" data-cxdel="'+s.id+'" style="color:var(--a)" aria-label="Supprimer la séance">Supprimer</button></div><p style="margin:6px 0 0;white-space:pre-wrap">'+esc(s.t)+'</p>'+(s.w?'<p class="sub" style="margin:6px 0 0"><b>À faire :</b> '+esc(s.w)+'</p>':'')+'</div>';
  }).join(''):'<p class="sub">Aucune séance enregistrée.</p>';
  return h;
}
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl(),y;
  if(view!=="cahier")return;
  if(t.id==="cxadd"){
    var tx=document.getElementById("cxt").value.trim(),d=document.getElementById("cxd").value||today(),pid=document.getElementById("cxp").value;
    if(!tx&&!pid){alert("Écrivez le contenu de la séance ou choisissez une leçon.");return;}
    var l=pgList(c).filter(function(x){return x.id===pid})[0];
    ctList(c).push({id:uid(),d:d,t:tx||(l?l.t:""),w:document.getElementById("cxw").value.trim(),p:pid||""});
    save();y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  if(t.id==="pgadd"){
    var lines=document.getElementById("pgt").value.split("\n").map(function(x){return x.trim()}).filter(Boolean);
    lines.forEach(function(n){pgList(c).push({id:uid(),t:n});});
    if(lines.length){save();y=window.scrollY;render();window.scrollTo(0,y);}return;
  }
  var pdl=t.closest("[data-pgdel]");
  if(pdl){var g=pgList(c).filter(function(x){return x.id===pdl.dataset.pgdel})[0];if(g&&confirm("Retirer la leçon « "+g.t+" » du programme ?")){c.pg=pgList(c).filter(function(x){return x.id!==g.id});ctList(c).forEach(function(s){if(s.p===g.id)s.p="";});save();y=window.scrollY;render();window.scrollTo(0,y);}return;}
  var sd=t.closest("[data-cxdel]");
  if(sd&&confirm("Supprimer cette séance du cahier de textes ?")){c.ct=ctList(c).filter(function(x){return x.id!==sd.dataset.cxdel});save();y=window.scrollY;render();window.scrollTo(0,y);}
});
document.getElementById("view").addEventListener("change",function(e){
  var t=e.target,c=cl();
  if(view!=="cahier"||!t.dataset.pgx)return;
  var l=pgList(c).filter(function(x){return x.id===t.dataset.pgx})[0];if(!l)return;
  if(t.checked)l.x=true;else delete l.x;
  save();var y=window.scrollY;render();window.scrollTo(0,y);
});

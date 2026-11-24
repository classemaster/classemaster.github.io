/* Carnet de correspondance : messages entre l’enseignant et les parents, avec visa « vu » */
var CRK=[["obs","Observation"],["conv","Convocation"],["inf","Information"],["fel","Félicitations"]];
function crName(k){var f=CRK.filter(function(x){return x[0]===k})[0];return f?f[1]:"Information";}
function crTag(k){return'<span class="tg c-'+esc(k)+'">'+esc(crName(k))+'</span>';}
function crList(c,id){return(c.cr||[]).filter(function(o){return!id||o.s===id;}).sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0;});}
function crOne(c,o,withName){
  var s=withName?c.students.filter(function(x){return x.id===o.s;})[0]:null;
  return'<div class="cr-i'+(o.v?" vu":"")+'"><div class="cr-h"><span>'+crTag(o.k)+' <small class="sub">'+esc(fmt(o.d))+'</small>'+(s?' <button class="lnk" data-fiche="'+s.id+'"><b>'+esc(s.name)+'</b></button>':'')+'</span></div><p>'+esc(o.t)+'</p>'+
  '<div class="cr-b"><button class="cr-v" data-crv="'+o.id+'" aria-pressed="'+(!!o.v)+'">'+(o.v?"✓ Vu par les parents":"À faire viser")+'</button><button data-crcp="'+o.id+'">Copier</button><button data-crdel="'+o.id+'" aria-label="Supprimer le message" style="color:var(--a)">Supprimer</button></div></div>';
}
function ficheCarnet(c,s){
  var L=crList(c,s.id);
  return'<div class="card"><h2>Carnet de correspondance</h2><select id="crk" aria-label="Type de message" style="width:100%;margin-bottom:8px">'+CRK.map(function(x){return'<option value="'+x[0]+'">'+x[1]+'</option>';}).join('')+'</select><textarea id="crt" rows="2" placeholder="Ex. Merci de venir me voir lundi à 15 h au sujet des devoirs non rendus." aria-label="Message aux parents"></textarea><div class="bar" style="margin:8px 0 0"><button class="btn" id="cradd">Ajouter au carnet</button></div>'+
  (L.length?L.map(function(o){return crOne(c,o,false);}).join(''):'<p class="sub" style="margin:10px 0 0">Aucun message pour cet élève.</p>')+'</div>';
}
function renderCarnet(){
  var c=cl(),all=crList(c).filter(function(o){return c.students.some(function(s){return s.id===o.s;});});
  var todo=all.filter(function(o){return!o.v;}),L=crf==="todo"?todo:all;
  var h='<h1 style="text-transform:none">Carnet de correspondance</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p>';
  if(!c.students.length)return h+'<div class="empty">Ajoutez d’abord des élèves à cette classe.</div>';
  h+='<div class="cl-t"><div><b>'+all.length+'</b><span>Message'+(all.length>1?'s':'')+'</span></div><div><b style="color:var(--r)">'+todo.length+'</b><span>À faire viser</span></div><div><b style="color:var(--p)">'+(all.length-todo.length)+'</b><span>Vu'+(all.length-todo.length>1?'s':'')+'</span></div></div>';
  h+='<div class="card"><h2>Nouveau message</h2><select id="crs" aria-label="Élève" style="width:100%;margin-bottom:8px">'+c.students.map(function(s){return'<option value="'+s.id+'">'+esc(s.name)+'</option>';}).join('')+'</select><select id="crk" aria-label="Type de message" style="width:100%;margin-bottom:8px">'+CRK.map(function(x){return'<option value="'+x[0]+'">'+x[1]+'</option>';}).join('')+'</select><textarea id="crt" rows="3" placeholder="Message aux parents…" aria-label="Message aux parents"></textarea><div class="bar" style="margin:8px 0 0"><button class="btn" id="cradd">Ajouter au carnet</button></div></div>';
  h+='<div class="flt"><select id="crf" aria-label="Filtre"><option value=""'+(crf?"":" selected")+'>Tous les messages</option><option value="todo"'+(crf==="todo"?" selected":"")+'>À faire viser</option></select></div>';
  h+=L.length?L.map(function(o){return'<div class="card" style="padding:12px">'+crOne(c,o,true)+'</div>';}).join(''):'<p class="sub">'+(crf==="todo"?"Tous les messages ont été vus par les parents.":"Aucun message pour le moment.")+'</p>';
  return h;
}
function classeCarnet(c){
  var all=crList(c).filter(function(o){return c.students.some(function(s){return s.id===o.s;});}),todo=all.filter(function(o){return!o.v;});
  return'<div class="card"><h2>Carnet de correspondance</h2><p class="sub" style="margin-top:0">'+(all.length?all.length+' message'+(all.length>1?'s':'')+' · '+todo.length+' à faire viser':'Aucun message pour le moment.')+'</p><div class="bar" style="margin:0"><button class="btn ghost" data-go="carnet">Ouvrir le carnet</button></div></div>';
}
function crText(c,o){
  var s=c.students.filter(function(x){return x.id===o.s;})[0];
  return"Carnet de correspondance – "+(s?s.name:"")+" ("+c.name+")\n"+crName(o.k)+" du "+fmt(o.d,true)+" :\n"+o.t+(ME&&ME.name?"\n— "+ME.name:"");
}
document.getElementById("view").addEventListener("change",function(e){
  if(e.target.id==="crf"){crf=e.target.value;render();}
});
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl(),y;
  if(t.id==="cradd"){
    var tx=document.getElementById("crt").value.trim();if(!tx)return;
    var sid=view==="fiche"?sel:(document.getElementById("crs")||{}).value;if(!sid)return;
    (c.cr||(c.cr=[])).push({id:uid(),s:sid,d:today(),k:document.getElementById("crk").value,t:tx,v:false});
    save();y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  var v=t.closest("[data-crv]");
  if(v){var o=(c.cr||[]).filter(function(x){return x.id===v.dataset.crv})[0];if(o){o.v=!o.v;save();y=window.scrollY;render();window.scrollTo(0,y);}return;}
  var cp=t.closest("[data-crcp]");
  if(cp){
    var q=(c.cr||[]).filter(function(x){return x.id===cp.dataset.crcp})[0];if(!q)return;
    var txt=crText(c,q);
    cmCopy(txt,function(g){cp.textContent=g?"Copié":"Copie impossible";});
    return;
  }
  var d=t.closest("[data-crdel]");
  if(d){var q0=(c.cr||[]).find(function(x){return x.id===d.dataset.crdel;});delItem(c,"cr",d.dataset.crdel,q0?q0.t.slice(0,40):"Message");y=window.scrollY;render();window.scrollTo(0,y);}
});

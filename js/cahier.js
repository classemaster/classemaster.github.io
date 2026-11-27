/* Cahier de textes et progression du programme */
/* c.ct : séances {id,d,t:contenu,w:travail à faire,p:id de la leçon}   c.pg : programme {id,t,x:fait à la main} */
function pgList(c){return c.pg||(c.pg=[]);}
function ctList(c){return c.ct||(c.ct=[]);}
/* Découpage par mois : année scolaire de septembre à juin. Une leçon porte son mois prévu (l.m = "09".."06") ; une séance est rangée selon sa date. */
var CX_MOIS=["09","10","11","12","01","02","03","04","05","06"];
var CX_NOM={"01":"Janvier","02":"Février","03":"Mars","04":"Avril","05":"Mai","06":"Juin","07":"Juillet","08":"Août","09":"Septembre","10":"Octobre","11":"Novembre","12":"Décembre"};
var cxOpen={},cxPgm="";   /* mois ouverts (gardés entre deux affichages) ; dernier mois choisi pour ajouter des leçons */
var CX_ABR={"09":"Sep","10":"Oct","11":"Nov","12":"Déc","01":"Jan","02":"Fév","03":"Mar","04":"Avr","05":"Mai","06":"Juin"};
/* Position du mois en cours dans l'année scolaire (juillet-août : l'année est finie, tous les mois sont passés) */
function cxIdxNow(){var m=String(new Date().getMonth()+1).padStart(2,"0"),i=CX_MOIS.indexOf(m);return i>=0?i:CX_MOIS.length;}
/* Avancement du programme mois par mois : leçons prévues, faites, restantes ; état = passé (retard possible), en cours ou à venir (avance possible) */
function cxBilan(c){
  var now=cxIdxNow(),sans=0,out=[];
  pgList(c).forEach(function(l){if(CX_MOIS.indexOf(l.m)<0)sans++;});
  CX_MOIS.forEach(function(m,i){
    var L=pgList(c).filter(function(l){return l.m===m;});if(!L.length)return;
    var d=L.filter(function(l){return pgDone(c,l);}).length;
    out.push({m:m,i:i,total:L.length,done:d,left:L.length-d,st:i<now?"past":i===now?"now":"next"});
  });
  out.sans=sans;return out;
}
function cxMoisNow(){var m=String(new Date().getMonth()+1).padStart(2,"0");return CX_MOIS.indexOf(m)>=0?m:"09";}
function cxIsOpen(k,def){return cxOpen[k]===undefined?def:cxOpen[k];}
function cxMoisOpts(sel,none){
  return(none?'<option value=""'+(sel?"":" selected")+'>Sans mois</option>':"")+CX_MOIS.map(function(m){return'<option value="'+m+'"'+(sel===m?" selected":"")+'>'+CX_NOM[m]+'</option>';}).join("");
}
/* Bloc repliable d'un mois */
function cxMonth(key,title,sum,open,body){
  return'<details class="cx-m" data-cxk="'+key+'"'+(open?" open":"")+'><summary><span>'+esc(title)+'</span><small>'+esc(sum)+'</small></summary><div class="cx-b">'+body+'</div></details>';
}
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
function cxLessonOpts(c,P){
  var out="",seen={};
  CX_MOIS.concat([""]).forEach(function(m){
    var L=P.filter(function(l){return(l.m||"")===m;});if(!L.length)return;
    out+='<optgroup label="'+(m?CX_NOM[m]:"Sans mois")+'">'+L.map(function(l){return'<option value="'+l.id+'">'+(pgDone(c,l)?'✓ ':'')+esc(l.t)+'</option>';}).join("")+'</optgroup>';
  });
  P.forEach(function(l){if(l.m&&CX_MOIS.indexOf(l.m)<0&&!seen[l.id])out+='<option value="'+l.id+'">'+(pgDone(c,l)?'✓ ':'')+esc(l.t)+'</option>';});
  return out;
}
/* Programme : une section repliable par mois, avec l'avancement du mois */
function cxProgramme(c,P,now){
  var h="",groups=CX_MOIS.concat([""]);
  groups.forEach(function(m){
    var L=P.filter(function(l){return(CX_MOIS.indexOf(l.m)>=0?l.m:"")===m;});if(!L.length)return;
    var n=L.filter(function(l){return pgDone(c,l);}).length,body=L.map(function(l){
      var seen=ctList(c).filter(function(s){return s.p===l.id;}).sort(function(a,b){return a.d<b.d?-1:1;})[0];
      return'<div class="li pg-li"><label class="pgl"><input type="checkbox" data-pgx="'+l.id+'"'+(pgDone(c,l)?' checked':'')+(seen?' disabled':'')+'><span>'+esc(l.t)+(seen?'<br><small class="sub">vue le '+esc(fmt(seen.d))+'</small>':'')+'</span></label><select class="cx-sel" data-pgm="'+l.id+'" aria-label="Mois de la leçon « '+esc(l.t)+' »">'+cxMoisOpts(m,true)+'</select><button data-pgdel="'+l.id+'" aria-label="Retirer la leçon">Retirer</button></div>';
    }).join("");
    body=cxCleanBtn(c,"p|"+m,m?"Retirer les leçons de ce mois":"Retirer les leçons sans mois")+body;
    h+=cxMonth("p|"+m,m?CX_NOM[m]:"Sans mois",n+" / "+L.length+" faite"+(L.length>1?"s":""),cxIsOpen("p|"+m,m===now),body);
  });
  return h;
}
/* Séances : une section repliable par mois (du plus récent au plus ancien) */
function cxSeances(c,P,S){
  var by={},keys=[],h="",cur=today().slice(0,7);
  S.forEach(function(s){var k=String(s.d).slice(0,7);if(!by[k]){by[k]=[];keys.push(k);}by[k].push(s);});
  keys.sort().reverse();
  keys.forEach(function(k,i){
    var L=by[k],y=k.slice(0,4),m=k.slice(5,7),body=L.map(function(s){
      var l=P.filter(function(x){return x.id===s.p})[0];
      return'<div class="card" style="padding:12px"><div class="cr-h"><span><b>'+esc(fmt(s.d,true))+'</b>'+(l?'<br><span class="tg k-aut">'+esc(l.t)+'</span>':'')+'</span><button class="lnk" data-cxdel="'+s.id+'" style="color:var(--a)" aria-label="Supprimer la séance">Supprimer</button></div><p style="margin:6px 0 0;white-space:pre-wrap">'+esc(s.t)+'</p>'+(s.w?'<p class="sub" style="margin:6px 0 0"><b>À faire :</b> '+esc(s.w)+'</p>':'')+'</div>';
    }).join("");
    body=cxCleanBtn(c,"s|"+k,"Vider ce mois")+body;
    h+=cxMonth("s|"+k,(CX_NOM[m]||m)+" "+y,L.length+" séance"+(L.length>1?"s":""),cxIsOpen("s|"+k,k===cur||i===0),body);
  });
  return h;
}
/* Nettoyage du cahier : par mois, ou en entier. Une seule entrée dans la corbeille (7 jours) permet de tout rétablir.
   Clés : "s|AAAA-MM" séances d'un mois · "p|MM" leçons prévues un mois ("p|" = sans mois) · "all-s" toutes les séances · "all-p" tout le programme · "all" tout. */
var cxConf="";   /* clé en attente de confirmation (le bouton de confirmation s'affiche à sa place) */
function cxSel(c,key){
  var S=[],P=[],a=String(key).split("|"),v=a[1]||"";
  if(a[0]==="s")S=ctList(c).filter(function(s){return String(s.d).slice(0,7)===v;});
  else if(a[0]==="p")P=pgList(c).filter(function(l){return(CX_MOIS.indexOf(l.m)>=0?l.m:"")===v;});
  else if(key==="p-undone")P=pgList(c).filter(function(l){return!pgDone(c,l);});
  else{if(key==="all"||key==="all-s")S=ctList(c).slice();if(key==="all"||key==="all-p"||key==="top-p")P=pgList(c).slice();}
  return{S:S,P:P};
}
function cxLabel(key){
  var a=String(key).split("|"),v=a[1]||"";
  if(a[0]==="s")return"Séances de "+(CX_NOM[v.slice(5,7)]||v.slice(5,7))+" "+v.slice(0,4);
  if(a[0]==="p")return"Leçons "+(v?"de "+CX_NOM[v]:"sans mois");
  if(key==="p-undone")return"Leçons non faites du programme";
  return key==="all-s"?"Toutes les séances du cahier":(key==="all-p"||key==="top-p")?"Tout le programme":"Tout le cahier de textes";
}
function cxApply(c,key){
  var x=cxSel(c,key),sid={},pid={},links={},order=pgList(c).map(function(l){return l.id;});
  if(!x.S.length&&!x.P.length)return null;
  x.S.forEach(function(s){sid[s.id]=1;});x.P.forEach(function(l){pid[l.id]=1;});
  c.ct=ctList(c).filter(function(s){return!sid[s.id];});
  c.ct.forEach(function(s){if(s.p&&pid[s.p]){links[s.id]=s.p;s.p="";}});   /* une séance garde son texte, mais perd le lien avec une leçon retirée */
  c.pg=pgList(c).filter(function(l){return!pid[l.id];});
  var tid=trashAdd("cx",cxLabel(key),c.id,{ct:x.S,pg:x.P,links:links,order:order});
  save();return{id:tid,s:x.S.length,p:x.P.length};
}
function cxMsg(key,n){
  var a=String(key).split("|");
  var tail=" Vous pourrez annuler juste après, ou depuis la corbeille (7 jours).";
  if(a[0]==="s")return"Effacer "+(n.S.length>1?"les "+n.S.length+" séances":"la séance")+" de "+cxLabel(key).slice(11)+" ? Les leçons du programme restent."+tail;
  if(a[0]==="p")return"Retirer "+(n.P.length>1?"les "+n.P.length+" leçons":"la leçon")+" "+(a[1]?"prévue"+(n.P.length>1?"s":"")+" en "+CX_NOM[a[1]]:"sans mois")+" du programme ? Les séances déjà écrites restent."+tail;
  if(key==="all-s")return"Effacer les "+n.S.length+" séances du cahier ? Le programme reste."+tail;
  if(key==="p-undone")return"Retirer les "+n.P.length+" leçons non faites du programme ? Les leçons cochées « faites » restent."+tail;
  if(key==="all-p"||key==="top-p")return"Retirer les "+n.P.length+" leçons du programme ? Les séances déjà écrites restent."+tail;
  return"Tout effacer : "+n.S.length+" séance"+(n.S.length>1?"s":"")+" et "+n.P.length+" leçon"+(n.P.length>1?"s":"")+" ? Le cahier sera entièrement vidé."+tail;
}
/* Bouton de nettoyage ; au clic, il est remplacé par la question de confirmation */
function cxCleanBtn(c,key,label){
  var n=cxSel(c,key),tot=n.S.length+n.P.length;
  if(!tot)return key==="all"||key.indexOf("all")===0?'<button class="btn ghost" disabled>'+esc(label)+'</button>':"";
  if(cxConf===key)return'<div class="card" role="alertdialog" aria-label="Confirmer l’effacement" style="border:2px solid var(--a);margin:10px 0 0"><p style="margin:0 0 10px"><b>'+esc(cxMsg(key,n))+'</b></p><div class="bar" style="margin:0"><button class="btn" data-cxok="'+esc(key)+'" style="background:var(--a);color:#fff">Oui, effacer</button><button class="btn ghost" data-cxno="1">Annuler</button></div></div>';
  return'<div class="bar" style="margin:10px 0 0"><button class="btn ghost" data-cxc="'+esc(key)+'" style="color:var(--a)">'+esc(label)+'</button></div>';
}
/* En haut du programme : retirer tout d'un coup (ou seulement les leçons non faites), sans parcourir toute la liste */
function cxProgTools(c,P){
  if(P.length<2)return"";
  var und=pgList(c).filter(function(l){return!pgDone(c,l);}).length,h="";
  h+=cxCleanBtn(c,"top-p","Retirer tout le programme ("+P.length+")");
  if(und>0&&und<P.length)h+=cxCleanBtn(c,"p-undone","Retirer les leçons non faites ("+und+")");
  return h?'<div style="margin:0 0 12px">'+h+'</div>':"";
}
function cxCleanCard(c){
  var h='<div class="card"><h2>Nettoyer le cahier</h2><p class="sub" style="margin-top:0">Pour effacer par mois, ouvrez le mois ci-dessus et touchez « Vider ce mois ». Ici : tout effacer d’un coup. Une confirmation est demandée, et vous pouvez annuler ensuite.</p>';
  h+=cxCleanBtn(c,"all-s","Effacer toutes les séances ("+ctList(c).length+")");
  h+=cxCleanBtn(c,"all-p","Effacer tout le programme ("+pgList(c).length+")");
  h+=cxCleanBtn(c,"all","Tout effacer : séances et programme");
  return h+'</div>';
}
function renderCahier(){
  var c=cl(),P=pgList(c),S=ctList(c).slice().sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0});
  var h='<h1 style="text-transform:none">Cahier de textes</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p>';
  h+='<div class="card"><h2>Progression du programme</h2>'+pgBar(c)+'</div>';
  h+=typeof pgeCard==="function"?pgeCard():"";   /* programme de l'établissement, en lecture (v142) */
  h+='<div class="card"><h2>Nouvelle séance</h2><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px"><label>Date <input type="date" id="cxd" value="'+today()+'"></label></div>'+
  '<select id="cxp" aria-label="Leçon du programme" style="width:100%;margin-bottom:8px"><option value="">Leçon : hors programme</option>'+cxLessonOpts(c,P)+'</select>'+
  '<textarea id="cxt" rows="3" placeholder="Contenu de la séance (ex. Le présent de l’indicatif : verbes du 1er groupe)" aria-label="Contenu de la séance"></textarea>'+
  '<input type="text" id="cxw" placeholder="Travail à faire (facultatif)" aria-label="Travail à faire" style="width:100%;margin-top:8px">'+
  '<div class="bar" style="margin:8px 0 0"><button class="btn" id="cxadd">Enregistrer la séance</button></div></div>';
  var pm=cxPgm!==""&&cxPgm!==undefined?cxPgm:cxMoisNow(),now=cxMoisNow();
  h+='<div class="card"><h2>Programme ('+P.length+' leçon'+(P.length>1?'s':'')+')</h2>'+cxProgTools(c,P)+
  (P.length?cxProgramme(c,P,now):'<p class="sub" style="margin-top:0">Aucune leçon pour le moment.</p>')+
  '<p class="sub" style="margin:12px 0 4px">Ajouter des leçons à un mois, une par ligne (vous pouvez coller tout le programme du mois) :</p><select id="pgm" aria-label="Mois des leçons à ajouter" style="width:100%;margin-bottom:8px">'+cxMoisOpts(pm,true)+'</select><textarea id="pgt" rows="4" placeholder="Le nom et le groupe nominal&#10;Le présent de l’indicatif&#10;Le récit au passé" aria-label="Leçons à ajouter"></textarea><div class="bar" style="margin:8px 0 0"><button class="btn ghost" id="pgadd">Ajouter au programme</button></div></div>';
  h+='<h2 style="font-size:1.05rem">Séances ('+S.length+')</h2>';
  h+=S.length?cxSeances(c,P,S):'<p class="sub">Aucune séance enregistrée.</p>';
  return h+cxCleanCard(c);
}
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl(),y;
  if(view!=="cahier")return;
  if(t.id==="cxadd"){
    var tx=document.getElementById("cxt").value.trim(),d=document.getElementById("cxd").value||today(),pid=document.getElementById("cxp").value;
    if(!tx&&!pid){alert("Écrivez le contenu de la séance ou choisissez une leçon.");return;}
    var l=pgList(c).filter(function(x){return x.id===pid})[0];
    ctList(c).push({id:uid(),d:d,t:tx||(l?l.t:""),w:document.getElementById("cxw").value.trim(),p:pid||""});
    cxOpen["s|"+d.slice(0,7)]=true;
    save();y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  if(t.id==="pgadd"){
    var lines=document.getElementById("pgt").value.split("\n").map(function(x){return x.trim()}).filter(Boolean);
    var pmv=(document.getElementById("pgm")||{}).value||"";cxPgm=pmv;if(pmv)cxOpen["p|"+pmv]=true;
    lines.forEach(function(n){var o={id:uid(),t:n};if(pmv)o.m=pmv;pgList(c).push(o);});
    if(lines.length){save();y=window.scrollY;render();window.scrollTo(0,y);}return;
  }
  var cc=t.closest("[data-cxc]");
  if(cc){cxConf=cc.dataset.cxc;y=window.scrollY;render();window.scrollTo(0,y);return;}
  if(t.closest("[data-cxno]")){cxConf="";y=window.scrollY;render();window.scrollTo(0,y);return;}
  var ck=t.closest("[data-cxok]");
  if(ck){
    var key=ck.dataset.cxok,r=cxApply(c,key);cxConf="";
    if(r)toast((r.s?r.s+" séance"+(r.s>1?"s":"")+" effacée"+(r.s>1?"s":""):"")+(r.s&&r.p?" et ":"")+(r.p?r.p+" leçon"+(r.p>1?"s":"")+" retirée"+(r.p>1?"s":""):"")+" du cahier","Annuler",function(){undoTrash(r.id);});
    y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  var pdl=t.closest("[data-pgdel]");
  if(pdl){var g=pgList(c).filter(function(x){return x.id===pdl.dataset.pgdel})[0];if(g&&confirm("Retirer la leçon « "+g.t+" » du programme ?")){delItem(c,"pg",g.id,g.t);ctList(c).forEach(function(s){if(s.p===g.id)s.p="";});save();y=window.scrollY;render();window.scrollTo(0,y);}return;}
  var sd=t.closest("[data-cxdel]");
  if(sd){var s0=ctList(c).find(function(x){return x.id===sd.dataset.cxdel;});delItem(c,"ct",sd.dataset.cxdel,s0?fmt(s0.d)+" · "+(s0.t||"").slice(0,30):"Séance");y=window.scrollY;render();window.scrollTo(0,y);}
});
document.getElementById("view").addEventListener("change",function(e){
  var t=e.target,c=cl();
  if(view==="cahier"&&t.dataset.pgm!==undefined){
    var lm=pgList(c).filter(function(x){return x.id===t.dataset.pgm})[0];if(!lm)return;
    if(t.value)lm.m=t.value;else delete lm.m;
    cxOpen["p|"+t.value]=true;save();var ym=window.scrollY;render();window.scrollTo(0,ym);return;
  }
  if(view!=="cahier"||!t.dataset.pgx)return;
  var l=pgList(c).filter(function(x){return x.id===t.dataset.pgx})[0];if(!l)return;
  if(t.checked)l.x=true;else delete l.x;
  save();var y=window.scrollY;render();window.scrollTo(0,y);
});
/* garde les mois ouverts / fermés quand l'écran est réaffiché (l'événement « toggle » ne remonte pas : on l'écoute à la descente) */
document.getElementById("view").addEventListener("toggle",function(e){
  var d=e.target;if(d&&d.classList&&d.classList.contains("cx-m")&&d.dataset.cxk)cxOpen[d.dataset.cxk]=d.open;
},true);

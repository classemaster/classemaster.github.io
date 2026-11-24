/* Nouvelle année scolaire : passe toutes les classes à la rentrée en une seule fois.
   Pour chaque classe : « passe au niveau suivant » (6e B → 5e B), « reste la même » (nouveaux élèves) ou « terminée ».
   L'année écoulée est rangée en archive (rien n'est perdu) et une sauvegarde est proposée avant de commencer. */
var RT=null;

function rtKey(){return"cm-rentree-"+(ME?ME.id:"invite");}
function rtDone(){try{return localStorage.getItem(rtKey())||"";}catch(e){return"";}}
function rtMark(v){try{localStorage.setItem(rtKey(),v);}catch(e){}}
function rtNowLabel(){return syLabel(today());}
function rtLastDate(c){
  var m="";
  Object.keys(c.records||{}).forEach(function(k){if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&k>m)m=k;});
  (c.ev||[]).forEach(function(e){if(e&&typeof e.d==="string"&&e.d>m)m=e.d;});
  return m;
}
/* La classe contient des données d'une année scolaire déjà terminée */
function rtOld(c){var d=rtLastDate(c);return!!d&&schoolYear(d)<schoolYear(today());}
/* Année à archiver : celle des dernières données ; à défaut l'année précédente */
function rtArchLabel(){
  var m="";
  liveCls().forEach(function(c){var d=rtLastDate(c);if(d>m)m=d;});
  if(m)return syLabel(m);
  var y=schoolYear(today());return(y-1)+"-"+y;
}

/* Carte d'accueil : visible tant que la rentrée n'est pas préparée (ou repoussée) pour l'année en cours */
function rentreeCard(){
  if(typeof liveCls!=="function"||typeof D==="undefined"||!D||!D.classes)return"";
  var now=rtNowLabel();
  if(rtDone()===now||!liveCls().some(rtOld))return"";
  return'<section class="hm-card rt-card"><h2 class="hm-h">Bonne rentrée '+esc(now)+'</h2>'+
    '<p class="sub" style="margin:0 0 10px">Les appels et les notes de '+esc(rtArchLabel())+' sont encore dans vos classes. Préparez la nouvelle année en une fois : l’ancienne est rangée en archive, rien n’est perdu.</p>'+
    '<div class="bar"><button class="btn" data-go="rentree">Préparer la rentrée</button><button class="btn ghost" id="rtlater">Plus tard</button></div></section>';
}
function rentreeCompteCard(){
  if(typeof liveCls!=="function"||typeof D==="undefined"||!D||!liveCls().length)return"";
  return'<div class="card"><h2>Nouvelle année scolaire</h2><p class="sub" style="margin:0 0 10px">Passez toutes vos classes à la rentrée en une fois : archives, classes reconduites au niveau suivant, élèves qui continuent.</p><button class="btn" data-go="rentree">Préparer une nouvelle année</button></div>';
}

function rtItem(id){var i;if(!RT)return null;for(i=0;i<RT.items.length;i++)if(RT.items[i].id===id)return RT.items[i];return null;}
function rtApplyMode(it,c,mode){
  it.mode=mode;
  if(mode==="up"){var n=nivNext(c.name,{last3:RT.last3});it.name=n.known&&!n.last?n.next:c.name;it.keep=true;}
  else if(mode==="same"){it.name=c.name;it.keep=false;}
  else{it.name=c.name;it.keep=false;}
}
function rtInit(){
  var live=liveCls(),lycee=live.some(function(c){return nivIsLycee(c.name);}),y=schoolYear(today());
  RT={label:rtArchLabel(),next:rtNowLabel(),last3:!lycee,items:[]};
  live.forEach(function(c){
    var n=nivNext(c.name,{last3:RT.last3}),it={id:c.id,mode:"same",name:c.name,keep:false,out:{},open:false};
    if(n.known)rtApplyMode(it,c,n.last?"end":"up");
    RT.items.push(it);
  });
  RT.y=y;
}
function rtCls(id){var i,l=D.classes;for(i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null;}

function renderRentree(){
  if(!RT)rtInit();
  var h='<h1 style="text-transform:none">Nouvelle année scolaire</h1><p class="sub">'+esc(RT.label)+' → '+esc(RT.next)+'. Chaque classe est rangée en archive ; vous repartez avec les classes ci-dessous.</p>';
  if(!RT.items.length)return h+'<div class="card"><p class="sub" style="margin:0">Aucune classe à préparer.</p></div>';
  h+='<div class="card"><label class="rt-k"><input type="checkbox" data-rtl3'+(RT.last3?" checked":"")+'> La 3e est la dernière classe de mon établissement (les élèves de 3e sortent)</label></div>';
  var nUp=0,nSame=0,nEnd=0,nStu=0;
  RT.items.forEach(function(it){
    var c=rtCls(it.id);if(!c)return;
    var n=(c.students||[]).length,kept=it.keep?(c.students||[]).filter(function(s){return!it.out[s.id];}).length:0;
    if(it.mode==="up")nUp++;else if(it.mode==="same")nSame++;else nEnd++;
    nStu+=kept;
    var info=nivNext(c.name,{last3:RT.last3});
    h+='<div class="card rt-c"><h2 style="margin:0 0 2px">'+esc(c.name)+'</h2><p class="sub" style="margin:0 0 10px">'+n+' élève'+(n>1?'s':'')+(info.known?'':' · niveau non reconnu : choisissez le nouveau nom')+'</p>'+
      '<label class="fld">Que devient cette classe ?<select data-rtm="'+esc(it.id)+'">'+
        '<option value="up"'+(it.mode==="up"?" selected":"")+'>Passe au niveau suivant</option>'+
        '<option value="same"'+(it.mode==="same"?" selected":"")+'>Reste la même (nouveaux élèves)</option>'+
        '<option value="end"'+(it.mode==="end"?" selected":"")+'>Terminée : archiver seulement</option></select></label>';
    if(it.mode!=="end"){
      h+='<label class="fld">Nom en '+esc(RT.next)+'<input type="text" data-rtn="'+esc(it.id)+'" maxlength="60" value="'+esc(it.name)+'"></label>'+
        '<label class="rt-k"><input type="checkbox" data-rtk="'+esc(it.id)+'"'+(it.keep?" checked":"")+'> Garder les élèves'+(it.keep?' ('+kept+' sur '+n+')':'')+'</label>';
      if(it.keep&&n){
        h+='<button class="btn ghost" data-rto="'+esc(it.id)+'" style="margin-top:8px">'+(it.open?"Masquer la liste":"Choisir ceux qui continuent")+'</button>';
        if(it.open)h+='<div class="rt-s">'+c.students.map(function(s){return'<label class="rt-k"><input type="checkbox" data-rts="'+esc(it.id)+'|'+esc(s.id)+'"'+(it.out[s.id]?"":" checked")+'> '+esc(s.name)+'</label>';}).join("")+'</div>';
      }
    }
    h+='</div>';
  });
  h+='<div class="card"><p style="margin:0 0 4px"><b>Résumé</b></p><p class="sub" style="margin:0">'+nUp+' classe'+(nUp>1?'s':'')+' au niveau suivant · '+nSame+' reconduite'+(nSame>1?'s':'')+' · '+nEnd+' terminée'+(nEnd>1?'s':'')+' · '+nStu+' élève'+(nStu>1?'s':'')+' conservé'+(nStu>1?'s':'')+'.</p></div>'+
    '<div class="bar"><button class="btn" id="rtgo">Lancer la nouvelle année</button><button class="btn ghost" id="rtcancel">Annuler</button></div>'+
    '<p class="sub" style="margin:10px 2px">Une sauvegarde de vos classes est enregistrée avant le passage. Les années rangées restent consultables dans les classes archivées.</p>';
  return h;
}

function rtRun(){
  var lab=RT.label,done=0,i,ids=[];
  /* valeurs saisies pas encore validées (champ nom encore actif) */
  Array.prototype.forEach.call(document.querySelectorAll("[data-rtn]"),function(el){var it=rtItem(el.getAttribute("data-rtn"));if(it)it.name=String(el.value||"").trim()||it.name;});
  var bad=RT.items.filter(function(it){return it.mode!=="end"&&!String(it.name||"").trim();});
  if(bad.length){toast("Donnez un nom à chaque classe reconduite.");return;}
  if(!confirm("Lancer la nouvelle année "+RT.next+" ? Vos classes de "+lab+" sont rangées en archive. Une sauvegarde est enregistrée d’abord."))return;
  try{saveFile("avant-nouvelle-annee-"+lab+".json",JSON.stringify({app:"appel-matin",version:1,classes:liveCls()}),"application/json",function(){});}catch(e){}
  var stamp=Date.now();
  RT.items.forEach(function(it){
    var c=rtCls(it.id);if(!c)return;
    var carry=it.keep?(c.students||[]).filter(function(s){return!it.out[s.id];}):[];
    if(it.mode==="end"){
      c.th=Object.assign({},c.th||{a:3,r:3},{ar:lab});
      if(String(c.name).indexOf("archive")<0)c.name=c.name+" · archive "+lab;
      delete c.tt;dirty[c.id]=stamp;done++;return;
    }
    var a=JSON.parse(JSON.stringify(c));
    a.id=uid();a.name=c.name+" · archive "+lab;a.th=Object.assign({},a.th||{a:3,r:3},{ar:lab});delete a.tt;
    delete a.ref;
    D.classes.push(a);dirty[a.id]=stamp;
    c.name=String(it.name).trim();
    c.records={};c.notes={};c.ev=[];c.ob=[];c.cr=[];c.ct=[];c.pg=[];c.bc=[];c.pa=[];
    c.students=carry;
    dirty[c.id]=stamp;done++;
  });
  if(!liveCls().length){var nc={id:uid(),name:"Nouvelle classe",students:[],records:{},et:etabId()};D.classes.push(nc);dirty[nc.id]=stamp;}
  D.cur=liveCls()[0].id;
  save();
  rtMark(rtNowLabel());
  RT=null;view="home";render();window.scrollTo(0,0);
  toast("Nouvelle année prête : "+done+" classe"+(done>1?"s":"")+" traitée"+(done>1?"s":"")+". L’année "+lab+" est en archive.");
}

function rentreeClick(t){
  var b=t.closest?t.closest("button"):null;
  if(!b)return false;
  if(b.id==="rtlater"){rtMark(rtNowLabel());render();return true;}
  if(b.dataset.go==="rentree"){RT=null;view="rentree";render();window.scrollTo(0,0);return true;}
  if(b.id==="rtcancel"){RT=null;view="home";render();window.scrollTo(0,0);return true;}
  if(b.id==="rtgo"){rtRun();return true;}
  if(b.dataset.rto){var it=rtItem(b.dataset.rto);if(it){it.open=!it.open;render();}return true;}
  return false;
}
(function(){
  var v=document.getElementById("view");if(!v)return;
  v.addEventListener("change",function(e){
    var t=e.target;if(!RT||!t||view!=="rentree")return;
    if(t.hasAttribute("data-rtl3")){
      RT.last3=!!t.checked;
      RT.items.forEach(function(it){var c=rtCls(it.id),p=c&&nivParse(c.name);if(p&&p.k==="3"&&it.mode!=="same")rtApplyMode(it,c,RT.last3?"end":"up");});
      render();return;
    }
    var id;
    if((id=t.getAttribute("data-rtm"))){var it=rtItem(id),c=rtCls(id);if(it&&c){rtApplyMode(it,c,t.value);render();}return;}
    if((id=t.getAttribute("data-rtn"))){var i2=rtItem(id);if(i2)i2.name=String(t.value||"").trim();return;}
    if((id=t.getAttribute("data-rtk"))){var i3=rtItem(id);if(i3){i3.keep=!!t.checked;render();}return;}
    if((id=t.getAttribute("data-rts"))){var p=id.split("|"),i4=rtItem(p[0]);if(i4){if(t.checked)delete i4.out[p[1]];else i4.out[p[1]]=true;render();}return;}
  });
})();

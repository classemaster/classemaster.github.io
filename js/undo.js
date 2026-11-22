/* Annuler et récupérer : message « Annuler » après chaque suppression + corbeille de 7 jours sur l'appareil */
var TRASH_DAYS=7,TRASH_MAX=60,toastT=null;
var KINDS={ev:"Évaluation",ob:"Observation",cr:"Message du carnet",ct:"Séance du cahier",pg:"Leçon du programme",tt:"Séance de l’emploi du temps",students:"Élève",appel:"Appel",cls:"Classe"};

function clone(x){return JSON.parse(JSON.stringify(x));}
function tkey(){return KEY?KEY+"-trash":"";}
function tLoad(){var k=tkey(),a;if(!k)return[];try{a=JSON.parse(localStorage.getItem(k)||"[]");}catch(e){a=[];}return Array.isArray(a)?a:[];}
function tSave(a){
  var k=tkey();if(!k)return;
  try{if(a.length)localStorage.setItem(k,JSON.stringify(a));else localStorage.removeItem(k);}
  catch(e){try{localStorage.setItem(k,JSON.stringify(a.slice(0,8)));}catch(e2){}}   /* mémoire pleine : on garde les plus récents */
}
function tPurge(a){var lim=Date.now()-TRASH_DAYS*864e5;return a.filter(function(x){return x&&x.ts>lim;}).slice(0,TRASH_MAX);}
function trashAdd(kind,label,cid,data){
  var a=tPurge(tLoad()),e={id:uid(),kind:kind,label:label,cid:cid,ts:Date.now(),data:clone(data)};
  a.unshift(e);tSave(a);return e.id;
}

/* Message en bas de l'écran, avec un bouton d'action */
function toast(msg,label,fn){
  var el=document.getElementById("toast");
  if(!el){
    el=document.createElement("div");el.id="toast";el.setAttribute("role","status");el.setAttribute("aria-live","polite");el.hidden=true;
    el.innerHTML='<span></span><button type="button"></button>';document.body.appendChild(el);
    el.querySelector("button").addEventListener("click",function(){var f=el._fn;el.hidden=true;el._fn=null;clearTimeout(toastT);if(f)f();});
  }
  el.firstChild.textContent=msg;
  var b=el.querySelector("button");b.hidden=!label;b.textContent=label||"";
  el._fn=fn||null;el.hidden=false;
  clearTimeout(toastT);toastT=setTimeout(function(){el.hidden=true;el._fn=null;},label?9000:4500);
}

/* Retire un élément d'une liste de la classe (élève, évaluation, observation…) et propose d'annuler */
function delItem(c,key,id,label){
  var L=c[key]||[],i=L.findIndex(function(x){return x.id===id;});
  if(i<0)return false;
  var item=L[i],tid=trashAdd("item",label,c.id,{k:key,i:i,item:item});
  c[key]=L.filter(function(x){return x.id!==id;});
  save();
  toast((KINDS[key]||"Élément")+" supprimé(e)","Annuler",function(){undoTrash(tid);});
  return true;
}
function delAppel(c,k){
  var r=c.records[k];if(!r)return;
  var tid=trashAdd("appel","Appel du "+fmt(k),c.id,{k:k,rec:r});
  delete c.records[k];save();
  toast("Appel du "+fmt(k)+" effacé","Annuler",function(){undoTrash(tid);});
}
function delClass(c){
  var tid=trashAdd("cls",c.name,c.id,c);
  toast("Classe « "+c.name+" » supprimée","Annuler",function(){undoTrash(tid);});
}

/* Remet un élément supprimé. Renvoie un texte d'erreur, ou "" si c'est fait. */
function trashRestore(e){
  var d=e.data,c,L,i;
  if(e.kind==="cls"){
    if(D.classes.some(function(x){return x.id===d.id;}))return"Cette classe existe déjà.";
    D.classes.push(d);D.cur=d.id;dirty[d.id]=Date.now();save();return"";
  }
  c=D.classes.find(function(x){return x.id===e.cid;});
  if(!c)return"La classe d’origine n’existe plus : rétablissez-la d’abord.";
  if(e.kind==="appel"){
    var r=rec(c,d.k);
    Object.keys(d.rec).forEach(function(s){if(!r[s])r[s]=d.rec[s];});   /* ne remplace pas un appel refait depuis */
    save();return"";
  }
  L=c[d.k]||(c[d.k]=[]);
  if(L.some(function(x){return x.id===d.item.id;}))return"Déjà rétabli.";
  i=Math.min(d.i,L.length);L.splice(i,0,d.item);
  save();return"";
}
function undoTrash(id){
  var a=tLoad(),e=a.find(function(x){return x.id===id;}),m;
  if(!e){toast("Rien à rétablir.");return;}
  m=trashRestore(e);
  if(m){toast(m);return;}
  tSave(a.filter(function(x){return x.id!==id;}));
  var y=window.scrollY;render();window.scrollTo(0,y);
  toast("« "+e.label+" » rétabli(e)");
}

/* Carte « Corbeille » de l'écran Sauvegarde et partage */
function ago(ts){
  var m=Math.round((Date.now()-ts)/60000);
  if(m<1)return"à l’instant";if(m<60)return"il y a "+m+" min";
  var h=Math.round(m/60);if(h<24)return"il y a "+h+" h";
  var j=Math.round(h/24);return"il y a "+j+" jour"+(j>1?"s":"");
}
function trashCard(){
  var a=tPurge(tLoad()),h='<h3 class="sec-t">Corbeille</h3><div class="card"><h2>Éléments supprimés</h2><p class="sub" style="margin-top:0">Conservés 7 jours sur cet appareil. Rétablissez une classe, une évaluation, un appel ou un élève supprimé par erreur.</p>';
  if(!a.length)return h+'<p class="sub" style="margin:0">La corbeille est vide.</p></div>';
  a.forEach(function(e){
    var kind=e.kind==="item"?(KINDS[e.data.k]||"Élément"):(KINDS[e.kind]||"Élément"),cn=(D.classes.find(function(x){return x.id===e.cid;})||{}).name;
    h+='<div class="li tr-li"><span style="min-width:0"><b>'+esc(kind)+'</b> · '+esc(e.label)+'<br><small class="sub">'+(cn&&e.kind!=="cls"?esc(cn)+' · ':'')+ago(e.ts)+'</small></span><button class="btn ghost" data-trs="'+e.id+'">Rétablir</button></div>';
  });
  return h+'<div class="bar stk" style="margin:10px 0 0"><button class="btn ghost" id="trclr">Vider la corbeille</button></div></div>';
}
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target.closest("[data-trs]");
  if(t){undoTrash(t.dataset.trs);return;}
  if(e.target.id==="trclr"&&confirm("Vider la corbeille ? Les éléments supprimés ne pourront plus être rétablis.")){tSave([]);render();}
});

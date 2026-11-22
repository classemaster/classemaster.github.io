/* Alertes aux parents : message d'absence ou de retard prêt à envoyer par WhatsApp ou SMS */
var PM_CC="242"; /* indicatif par défaut : Congo-Brazzaville */

/* Nettoie un numéro saisi à la main (espaces, points, tirets…) */
function pmClean(v){
  v=String(v||"").trim();
  var plus=v.charAt(0)==="+";
  var d=v.replace(/\D/g,"");
  return d?(plus?"+":"")+d:"";
}
/* Numéro au format international sans « + » (pour wa.me), ou "" s'il est invalide */
function pmIntl(v){
  v=pmClean(v);if(!v)return"";
  var d=v.replace(/\D/g,"");
  if(v.charAt(0)==="+")return d.length>=8&&d.length<=15?d:"";
  if(d.slice(0,2)==="00")d=d.slice(2);
  else if(d.slice(0,3)!==PM_CC||d.length<11)d=PM_CC+d;
  return d.length>=8&&d.length<=15?d:"";
}
function pmGet(c,id){return c.students.find(function(s){return s.id===id;});}

/* Texte du message : type = "a" (absence) ou "r" (retard) */
function pmText(c,s,k,v){
  var n=gn(c,k,s.id),f=s.g==="F",m=s.g==="M";
  var who="votre enfant "+s.name;
  var etat=v==="r"?"en retard":(m?"absent":f?"absente":"absent(e)");
  var cours=c.subj?" au cours de "+c.subj:"";
  var t="Bonjour, je vous informe que "+who+" (classe "+c.name+") était "+etat+" le "+fmt(k,true)+cours+".";
  if(v==="a"&&n.j===true)t+=" L’absence est enregistrée comme justifiée.";
  else if(v==="a")t+=" Merci de m’en indiquer le motif.";
  else t+=" Merci de veiller à sa ponctualité.";
  if(n.m)t+=" Motif noté : "+n.m+".";
  var sig=ME&&ME.name?ME.name:"";
  t+="\nCordialement"+(sig?", "+sig:"")+(ME&&ME.school?" – "+ME.school:"")+".";
  return t;
}

function pmClose(){
  var e=document.getElementById("pm-sh");if(e)e.remove();
  document.removeEventListener("keydown",pmKey);
}
function pmKey(e){if(e.key==="Escape"){if(view==="appel"&&document.querySelector("#pm-sh [data-pmbx]"))pmBatchClose();else pmClose();}}

function pmOpen(sid,k){
  pmClose();
  var c=cl(),s=pmGet(c,sid);if(!s)return;
  var v=(c.records[k]||{})[sid];if(v!=="a"&&v!=="r")return;
  var h='<div class="gr-sh" id="pm-sh"><div class="gr-sh-b" data-pmx="1"></div><div class="gr-sh-p" role="dialog" aria-modal="true" aria-label="Prévenir le parent de '+esc(s.name)+'">'+
    '<div class="gr-sh-h"><h3>Prévenir le parent de '+esc(s.name)+'</h3><button type="button" class="gr-sh-x" data-pmx="1" aria-label="Fermer">✕</button></div>'+
    '<p class="sub" style="margin:0 0 8px">'+(v==="a"?"Absence":"Retard")+' · '+esc(fmt(k,true))+'</p>'+
    '<label class="pm-l" for="pm-tel">Téléphone du parent</label>'+
    '<input type="tel" id="pm-tel" inputmode="tel" autocomplete="off" placeholder="06 123 45 67 ou +242 06 123 45 67" value="'+esc(s.p||"")+'">'+
    '<label class="pm-l" for="pm-txt">Message (modifiable)</label>'+
    '<textarea id="pm-txt" style="min-height:130px">'+esc(pmText(c,s,k,v))+'</textarea>'+
    '<p class="sub" id="pm-msg" role="status" style="margin:6px 0"></p>'+
    '<div class="pm-b"><button class="btn" id="pm-wa">WhatsApp</button><button class="btn ghost" id="pm-sms">SMS</button><button class="btn ghost" id="pm-cp">Copier</button></div>'+
    '</div></div>';
  document.body.insertAdjacentHTML("beforeend",h);
  var sh=document.getElementById("pm-sh"),tel=document.getElementById("pm-tel"),txt=document.getElementById("pm-txt"),msg=document.getElementById("pm-msg");
  function say(m){msg.textContent=m;}
  /* Enregistre le numéro dans la fiche de l'élève (uniquement s'il a changé) */
  function keepTel(){
    var n=pmClean(tel.value),cur=pmClean(s.p||"");
    if(n!==cur){if(n)s.p=n;else delete s.p;save();}
    return n;
  }
  function needTel(){
    var n=keepTel(),i=pmIntl(n);
    if(!i){say(n?"Ce numéro ne semble pas valide. Vérifiez-le (chiffres uniquement, avec ou sans +).":"Entrez d’abord le numéro de téléphone du parent.");tel.focus();return"";}
    say("");return i;
  }
  tel.addEventListener("change",keepTel);
  sh.addEventListener("click",function(e){
    var t=e.target;
    if(t.closest("[data-pmx]")){keepTel();pmClose();if(view==="appel"||view==="eleves"||view==="fiche")render();return;}
    if(t.id==="pm-wa"){var i=needTel();if(i)window.open("https://wa.me/"+i+"?text="+encodeURIComponent(txt.value),"_blank","noopener");return;}
    if(t.id==="pm-sms"){var j=needTel();if(j)location.href="sms:+"+j+"?&body="+encodeURIComponent(txt.value);return;}
    if(t.id==="pm-cp"){
      var fb=function(){txt.select();try{document.execCommand("copy");say("Message copié.");}catch(er){say("Sélectionnez le texte et copiez-le.");}};
      try{navigator.clipboard.writeText(txt.value).then(function(){say("Message copié.");},fb);}catch(er){fb();}
    }
  });
  document.addEventListener("keydown",pmKey);
  (s.p?txt:tel).focus();
}

/* Bouton « Prévenir le parent » affiché sous un élève absent ou en retard */
function pmButton(c,id,v){
  if(v!=="a"&&v!=="r")return"";
  var s=pmGet(c,id);
  return'<button type="button" class="pm-btn" data-pm="'+id+'">'+(s&&s.p?"✉ Prévenir le parent":"✉ Prévenir le parent (ajouter le numéro)")+'</button>';
}

/* ---- Messages groupés : prévenir en série les parents de tous les absents et retardataires du jour ---- */
function pmBatchList(c,k){var r=c.records[k]||{};return c.students.filter(function(s){return r[s.id]==="a"||r[s.id]==="r";});}
function pmBatchButton(c,k){
  var n=pmBatchList(c,k).length;
  if(n<2)return"";   /* avec un seul élève, le bouton « Prévenir le parent » suffit */
  return'<div class="bar"><button class="btn" data-pmb="1">✉ Prévenir les parents ('+n+')</button></div>';
}
function pmBatchClose(){
  var e=document.getElementById("pm-sh");if(e)e.remove();
  document.removeEventListener("keydown",pmKey);
  if(view==="appel")render();
}
function pmBatchOpen(k){
  pmClose();
  var c=cl(),L=pmBatchList(c,k);if(!L.length)return;
  var h='<div class="gr-sh" id="pm-sh"><div class="gr-sh-b" data-pmbx="1"></div><div class="gr-sh-p" role="dialog" aria-modal="true" aria-label="Prévenir les parents">'+
    '<div class="gr-sh-h"><h3>Prévenir les parents</h3><button type="button" class="gr-sh-x" data-pmbx="1" aria-label="Fermer">✕</button></div>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(fmt(k,true))+' · '+esc(c.name)+'</p><p class="sub" id="pmb-n" role="status" style="margin:0 0 8px;font-weight:700"></p>'+
    '<div class="pm-b" style="margin-bottom:10px"><button class="btn" id="pmb-next">Prévenir le suivant ▶</button></div>'+
    '<p class="sub" id="pmb-m" role="status" style="margin:0 0 8px"></p><div id="pmb-l"></div></div></div>';
  document.body.insertAdjacentHTML("beforeend",h);
  var sh=document.getElementById("pm-sh"),box=document.getElementById("pmb-l"),cnt=document.getElementById("pmb-n"),nx=document.getElementById("pmb-next"),msg=document.getElementById("pmb-m");
  function sent(s){return gn(c,k,s.id).w===true;}
  function ready(s){return!!pmIntl(s.p);}
  function nextOne(){return L.find(function(s){return!sent(s)&&ready(s);});}
  function draw(){
    var done=L.filter(sent).length,noTel=L.filter(function(s){return!ready(s);}).length;
    cnt.textContent=done+" parent"+(done>1?"s":"")+" prévenu"+(done>1?"s":"")+" sur "+L.length+(noTel?" · "+noTel+" sans numéro valide":"");
    nx.disabled=!nextOne();
    box.innerHTML=L.map(function(s){
      var v=(c.records[k]||{})[s.id],n=gn(c,k,s.id),st=(v==="a"?"Absent"+(n.j===true?" · justifiée":""):"Retard")+(n.m?" · "+n.m:"");
      return'<div class="li pm-li"><span style="min-width:0"><b>'+esc(s.name)+'</b><br><small class="sub">'+esc(st)+(sent(s)?" · ✓ envoyé":"")+'</small></span>'+
        '<span class="pm-act"><button style="color:var(--accent)" data-pmbe="'+s.id+'">Modifier</button>'+(ready(s)?'<button style="color:var(--accent)" data-pmbw="'+s.id+'">'+(sent(s)?"Renvoyer":"WhatsApp")+'</button>':"")+'</span>'+
        (ready(s)?"":'<input type="tel" class="pm-tel" inputmode="tel" data-pmbt="'+s.id+'" placeholder="Numéro du parent" aria-label="Numéro du parent de '+esc(s.name)+'" value="'+esc(s.p||"")+'">')+'</div>';
    }).join("");
  }
  function send(s){
    var v=(c.records[k]||{})[s.id];if(!ready(s)||!v)return;
    window.open("https://wa.me/"+pmIntl(s.p)+"?text="+encodeURIComponent(pmText(c,s,k,v)),"_blank","noopener");
    nt(c,k,s.id).w=true;save();draw();
  }
  sh.addEventListener("click",function(e){
    var t=e.target,id;
    if(t.closest("[data-pmbx]")){pmBatchClose();return;}
    if(t.id==="pmb-next"){var s0=nextOne();if(s0)send(s0);return;}
    if(t.dataset.pmbw){send(pmGet(c,t.dataset.pmbw));return;}
    if(t.dataset.pmbe){id=t.dataset.pmbe;pmBatchClose();pmOpen(id,k);}
  });
  sh.addEventListener("change",function(e){
    var t=e.target,s;
    if(!t.dataset.pmbt)return;
    s=pmGet(c,t.dataset.pmbt);if(!s)return;
    var n=pmClean(t.value);
    if(n&&!pmIntl(n)){msg.textContent="Ce numéro ne semble pas valide pour "+s.name+".";return;}
    msg.textContent="";
    if(n)s.p=n;else delete s.p;
    save();draw();
  });
  document.addEventListener("keydown",pmKey);
  draw();
}

document.getElementById("view").addEventListener("click",function(e){
  if(e.target.closest("[data-pmb]")){pmBatchOpen(date);return;}
  var b=e.target.closest("[data-pm]");
  if(b){pmOpen(b.dataset.pm,b.dataset.pmd||date);return;}
});

/* Gestionnaires d’événements (clics, saisie) */
document.getElementById("view").addEventListener("input",function(e){if(e.target.id==="q"){qs=e.target.value;applyQ();}else if(e.target.id==="gq"){gqs=e.target.value;drawSearch();}});
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl();
  if(t.id==="newev"){
    var ti=prompt("Titre de l’évaluation (ex. Devoir 1)");if(!ti||!ti.trim())return;
    var mx=parseFloat((prompt("Note sur combien ?","20")||"").replace(",","."));if(!(mx>0))mx=20;
    var id=uid();evs(c).push({id:id,t:ti.trim(),d:today(),m:mx,k:1,s:{}});evid=id;save();view="eval";render();window.scrollTo(0,0);return;
  }
  var eb=t.closest("[data-ev]");
  if(eb){evid=eb.dataset.ev;view="eval";render();window.scrollTo(0,0);return;}
  if(t.id==="delev"&&confirm("Supprimer cette évaluation ?")){c.ev=evs(c).filter(function(x){return x.id!==evid});save();view="notes";render();window.scrollTo(0,0);}
});
document.getElementById("view").addEventListener("input",function(e){
  if(view!=="eval")return;
  var t=e.target,c=cl(),ev=evs(c).find(function(x){return x.id===evid});if(!ev)return;
  if(t.dataset.ns){
    var v=t.value.trim().replace(",",".");
    if(v==="")delete ev.s[t.dataset.ns];else{var n=parseFloat(v);if(isNaN(n))return;ev.s[t.dataset.ns]=n;}
  }else if(t.id==="evt")ev.t=t.value;
  else if(t.id==="evd"){if(!t.value)return;ev.d=t.value;}
  else if(t.id==="evm"){var m=parseFloat(t.value);if(!(m>0))return;ev.m=m;}
  else if(t.id==="evk"){var k=parseFloat(t.value);if(!(k>=0))return;ev.k=k;}
  else return;
  save();var st=document.getElementById("evs");if(st)st.textContent=evLine(ev,c);var sx=document.getElementById("evst");if(sx)sx.innerHTML=evStatsHTML(ev,c);
});
document.getElementById("cls").addEventListener("change",function(e){qs="";
  if(e.target.value==="__new"){
    var nm=prompt("Nom de la nouvelle classe (ex. 4e B)");
    if(nm&&nm.trim()){var id=uid();D.classes.push({id:id,name:nm.trim(),students:[],records:{}});D.cur=id;view="eleves";save();}
  }else{D.cur=e.target.value;}
  render();
});
document.getElementById("dt").addEventListener("change",function(e){if(e.target.value){date=e.target.value;render();}});
document.querySelector("nav").addEventListener("click",function(e){var b=e.target.closest("button");if(b){view=b.dataset.v;render();window.scrollTo(0,0);if(view==="search"){var g=document.getElementById("gq");if(g)g.focus();}}});

document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl();
  var pk=t.closest("[data-pick]");
  if(pk){var sl0=document.querySelector(".hm-cls"),x0=sl0?sl0.scrollLeft:0;D.cur=pk.dataset.pick;view="classe";local();render();window.scrollTo(0,0);return;}
  if(t.closest("[data-newclass]")){var nn=prompt("Nom de la nouvelle classe (ex. 4e B)");if(nn&&nn.trim()){var nid=uid();D.classes.push({id:nid,name:nn.trim(),students:[],records:{}});D.cur=nid;save();render();}return;}
  if(t.closest("[data-guest]")){if(!GUEST){D=blank();KEY="";}GUEST=true;ME=null;view="home";date=today();qs="";render();window.scrollTo(0,0);return;}
  var ey=t.closest("[data-eye]");
  if(ey){var pi=document.getElementById(ey.dataset.eye);if(pi){var sh=pi.type==="password";pi.type=sh?"text":"password";ey.setAttribute("aria-pressed",String(sh));ey.setAttribute("aria-label",sh?"Masquer le mot de passe":"Afficher le mot de passe");}return;}
  if(t.closest("#gbtn")){var ge0=document.getElementById(view==="login"?"lerr":"serr");if(ge0)ge0.textContent="La connexion avec Google n’est pas encore disponible. Utilisez votre e-mail.";return;}
  var seg=t.closest(".seg");
  if(seg&&t.dataset.v){
    var r=rec(c,date),id=seg.dataset.s;
    if(r[id]===t.dataset.v)delete r[id];else r[id]=t.dataset.v;
    save();var y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  var hf=t.closest("[data-fiche]");
  if(hf){sel=hf.dataset.fiche;fb=view==="classe"||view==="notes"||view==="suivi"?view:"hist";view="fiche";render();window.scrollTo(0,0);return;}
  var hm=t.closest("[data-mo]");
  if(hm){mo=dstr(new Date(+mo.slice(0,4),+mo.slice(5,7)-1+(+hm.dataset.mo),1)).slice(0,7);render();return;}
  if(t.id==="lgin"){
    var le=document.getElementById("lerr"),li=document.getElementById("li").value.trim().toLowerCase(),lw=document.getElementById("lw").value;
    if(Date.now()<until){le.textContent="Trop d’essais. Patientez quelques secondes.";return;}
    var lu=ACC.users.find(function(x){return x.login===li});
    var bad=function(){fails++;if(fails>=5){until=Date.now()+30000;fails=0;}le.textContent="Identifiant ou mot de passe incorrect.";};
    if(!lu||!lw){bad();return;}
    pwHash(lw,lu.salt).then(function(h){if(h===lu.hash){fails=0;enter(lu);}else bad();});
    return;
  }
  if(t.id==="lfp"){
    var fe=document.getElementById("lerr"),fl=document.getElementById("li").value.trim().toLowerCase(),fu=ACC.users.find(function(x){return x.login===fl});
    if(!fu){fe.textContent="Entrez d’abord l’identifiant du compte concerné.";return;}
    if(confirm("Sans serveur, il est impossible de retrouver un mot de passe. Vous pouvez supprimer le compte « "+fu.name+" » et ses données sur cet appareil, puis en créer un nouveau (une sauvegarde .json pourra être restaurée). Supprimer ce compte ?")){removeUser(fu);view=ACC.users.length?"login":"signup";render();}
    return;
  }
  if(t.id==="sgo"){
    var ge=function(i){return document.getElementById(i)},er=ge("serr");
    var fn=ge("sfn").value.trim(),ln=ge("sln").value.trim(),nm=(fn+" "+ln).trim(),sc="",si=ge("sid").value.trim().toLowerCase(),p1=ge("spw").value;
    if(!fn||!ln){er.textContent="Entrez votre prénom et votre nom.";return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(si)){er.textContent="Entrez une adresse e-mail valide.";return;}
    if(ACC.users.some(function(x){return x.login===si})){er.textContent="Cet identifiant existe déjà sur cet appareil.";return;}
    if(p1.length<8){er.textContent="Le mot de passe doit contenir au moins 8 caractères.";return;}
    er.textContent="";
    var salt=rnd();
    pwHash(p1,salt).then(function(h){
      var id=uid(),first=!ACC.users.length,nu={id:id,name:nm,school:sc,login:si,salt:salt,hash:h,key:first?"appel-matin-v1":"appel-matin-u-"+id};
      ACC.users.push(nu);ACC.cur=id;
      if(!saveAcc()){ACC.users.pop();ACC.cur=null;var e2=ge("serr");if(e2)e2.textContent="Impossible d’enregistrer le compte sur cet appareil.";return;}
      enter(nu,true);
    });
    return;
  }
  if(t.id==="cpw"){
    var cm=document.getElementById("cpm"),c0=document.getElementById("cp0").value,c1=document.getElementById("cp1").value,c2=document.getElementById("cp2").value;
    var cf=function(m){cm.className="err";cm.textContent=m;};
    if(c1.length<8){cf("Le nouveau mot de passe doit contenir au moins 8 caractères.");return;}
    if(c1!==c2){cf("Les deux mots de passe ne sont pas identiques.");return;}
    pwHash(c0,ME.salt).then(function(h){
      if(h!==ME.hash){cf("Le mot de passe actuel est incorrect.");return;}
      var ns=rnd();
      pwHash(c1,ns).then(function(h2){
        ME.salt=ns;ME.hash=h2;
        if(!saveAcc()){cf("Impossible d’enregistrer le nouveau mot de passe.");return;}
        ["cp0","cp1","cp2"].forEach(function(i){var x=document.getElementById(i);if(x)x.value="";});
        cm.className="err ok";cm.textContent="Mot de passe modifié.";
      });
    });
    return;
  }
  if(t.id==="lout"){doLogout();return;}
  if(t.id==="adel"){
    if(confirm("Supprimer votre compte ainsi que toutes les classes, élèves et appels enregistrés sur cet appareil ? Pensez à faire une sauvegarde avant.")){removeUser(ME);view=ACC.users.length?"login":"signup";render();window.scrollTo(0,0);}
    return;
  }
  var sfh=t.closest("[data-sf]");
  if(sfh){var a1=sfh.dataset.sf.split("|");D.cur=a1[0];sel=a1[1];fb="hist";view="fiche";local();render();window.scrollTo(0,0);return;}
  var sch=t.closest("[data-sc]");
  if(sch){D.cur=sch.dataset.sc;view="classe";local();render();window.scrollTo(0,0);return;}
  var sdh=t.closest("[data-sd]");
  if(sdh){var a2=sdh.dataset.sd.split("|");D.cur=a2[0];date=a2[1];view="appel";local();render();window.scrollTo(0,0);return;}
  if(t.id==="pon"){
    var pv=document.getElementById("np").value.replace(/\D/g,""),pm=document.getElementById("pmsg");
    if(!/^\d{4,8}$/.test(pv)){pm.textContent="Le code doit contenir 4 à 8 chiffres.";return;}
    hashPin(pv).then(function(h){try{localStorage.setItem(PK,h);}catch(e){pm.textContent="Impossible d’enregistrer le code sur cet appareil.";return;}render();document.getElementById("pmsg").textContent="Code activé.";});
    return;
  }
  if(t.id==="poff"){
    var pw=document.getElementById("np").value.replace(/\D/g,""),pn=document.getElementById("pmsg");
    hashPin(pw).then(function(h){if(h===pinSet()){try{localStorage.removeItem(PK);}catch(e){}render();document.getElementById("pmsg").textContent="Code désactivé.";}else pn.innerHTML='Code incorrect. <button class="lnk" id="poff2">Code oublié ? Désactiver quand même</button>';});
    return;
  }
  if(t.id==="poff2"){if(confirm("Désactiver le verrouillage sans saisir le code ?")){try{localStorage.removeItem(PK);}catch(e){}render();document.getElementById("pmsg").textContent="Code désactivé.";}return;}
  if(t.id==="qx"){qs="";var qi=document.getElementById("q");if(qi){qi.value="";qi.focus();}applyQ();return;}
  if(t.id==="pnow"){lock();return;}
  if(t.id==="exp"){exportCSV();return;}
  if(t.id==="rpdf"||t.id==="rsvg"){
    var R=reportData(),nm="bilan-"+cl().name.replace(/[^\w-]+/g,"_"),mf=function(m){var e=document.getElementById("rmsg");if(e)e.textContent=m;};
    if(t.id==="rpdf")saveFile(nm+".pdf",reportPDF(R),"application/pdf",mf);else saveFile(nm+".svg",reportSVG(R),"image/svg+xml",mf);
    return;
  }
  if(t.id==="xone"){exportJSON(false);return;}
  if(t.id==="xall"){exportJSON(true);return;}
  if(t.id==="cpx"){
    var xm=document.getElementById("xmsg"),ta=document.getElementById("sh");
    var fb=function(){ta.select();try{document.execCommand("copy");xm.textContent="Texte copié.";}catch(e){xm.textContent="Sélectionnez le texte et copiez-le manuellement.";}};
    try{navigator.clipboard.writeText(shareTxt).then(function(){xm.textContent="Texte copié.";},fb);}catch(e){fb();}
    return;
  }
  if(t.id==="ipt"){var pv=document.getElementById("pst").value.trim();if(pv)importJSON(pv);return;}
  if(t.id==="allp"){var r2=rec(c,date);c.students.forEach(function(s){if(!r2[s.id])r2[s.id]="p";});save();render();return;}
  if(t.id==="rst"){if(confirm("Effacer l’appel de ce jour ?")){delete c.records[date];save();render();}return;}
  if(t.id==="cp"){
    var txt=summary(c,date);
    try{navigator.clipboard.writeText(txt).then(function(){t.textContent="Message copié";},function(){t.textContent="Sélectionnez le texte ci-dessus";});}
    catch(err){t.textContent="Sélectionnez le texte ci-dessus";}
    return;
  }
  if(t.dataset.go){view=t.dataset.go;render();return;}
  var ho=t.closest("[data-open]");
  if(ho){date=ho.dataset.open;view="appel";render();window.scrollTo(0,0);return;}
  if(t.id==="sort"){c.students.sort(function(a,b){return a.name.localeCompare(b.name,"fr",{sensitivity:"base"})});save();render();return;}
  if(t.id==="add"){
    var lines=document.getElementById("ta").value.split("\n").map(function(x){return x.trim()}).filter(Boolean);
    lines.forEach(function(n){c.students.push({id:uid(),name:n,g:document.getElementById("dg").value});});
    if(lines.length){save();render();}return;
  }
  if(t.dataset.del){
    var s=c.students.find(function(x){return x.id===t.dataset.del});
    if(s&&confirm("Retirer "+s.name+" de la liste ?")){c.students=c.students.filter(function(x){return x.id!==s.id});save();render();}return;
  }
  if(t.id==="delc"){
    if(confirm("Supprimer la classe "+c.name+" et tout son historique ?")){D.classes=D.classes.filter(function(x){return x.id!==c.id});D.cur=D.classes[0].id;dirty[c.id]=1;save();view="home";render();window.scrollTo(0,0);}
  }
});
document.getElementById("view").addEventListener("change",function(e){
  var t=e.target,c=cl();
  if(t.id==="an"&&ME){if(t.value.trim()){ME.name=t.value.trim();saveAcc();}else t.value=ME.name;return;}
  if(t.id==="as"&&ME){ME.school=t.value.trim();saveAcc();return;}
  if(t.id==="cn"&&t.value.trim()){c.name=t.value.trim();save();header();return;}
  if(t.id==="cs"){c.subj=t.value.trim();save();return;}
  if(t.id==="imp"&&t.files&&t.files[0]){importJSON(t.files[0]);return;}
  if(t.dataset.n!==undefined){var sn=c.students.find(function(x){return x.id===t.dataset.n}),nv=t.value.trim();if(sn&&nv){sn.name=nv;save();}else if(sn){t.value=sn.name;}return;}
  if(t.dataset.g!==undefined){var sg=c.students.find(function(x){return x.id===t.dataset.g});if(sg){sg.g=t.value;save();}return;}
  var upd=function(){var m=document.getElementById("sum");if(m)m.textContent=summary(c,date);};
  if(t.dataset.j!==undefined){var n=nt(c,date,t.dataset.j);if(t.value==="")delete n.j;else n.j=t.value==="1";save();upd();return;}
  if(t.dataset.m!==undefined){nt(c,date,t.dataset.m).m=t.value.trim();save();upd();return;}
  if(t.id==="fm"){flt.mode=t.value;render();return;}
  if(t.id==="ff"){flt.from=t.value;render();return;}
  if(t.id==="ft"){flt.to=t.value;render();return;}
  if(t.id==="tha"||t.id==="thr"||t.id==="thd"){var q=th(c);c.th={a:q.a,r:q.r,d:q.d};c.th[t.id==="tha"?"a":t.id==="thr"?"r":"d"]=Math.max(0,parseInt(t.value,10)||0);save();return;}
});

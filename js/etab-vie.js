/* Page « Vie scolaire » de l'établissement (v91) : discipline (incidents transmis par les enseignants) et messages aux enseignants et aux familles.
   Reprise de l'onglet « Discipline » et du bloc « Messages » de l'ancienne page de gestion (remplacée par une redirection depuis la v94), sur le socle commun js/etab-core.js.
   Adresses : etab-vie.html (Discipline), #messages (Messages).
   Lecture des incidents ; écritures uniquement par les fonctions serveur etab_message_envoyer / etab_message_supprimer (supabase/gestion-v71.sql).
   Aucun code secret demandé. */
(function(){
  var E=Etab,esc=E.esc,pl=E.plural,dsc=null,msgs=null,loaded=false,loadErr="",tab="dis",D={c:"enseignants",t:"",b:""};

  /* adresses : #dis et #messages (pas #msg, qui est le nom de la ligne d'état en bas de page) */
  var HASH={dis:"dis",msg:"messages"};
  function fromHash(){var h=String(location.hash||"").slice(1);return h==="dis"?"dis":h==="messages"?"msg":null;}
  tab=fromHash()||tab;

  function reset(){dsc=null;msgs=null;loaded=false;loadErr="";}

  /* ---------- Chargement : les élèves d'abord, puis incidents et messages en parallèle ---------- */
  function loadMsgs(){
    sb.rpc("etab_messages_liste",{p_etab:E.ET.id}).then(function(r){
      msgs=r.error?{err:E.frErr(r.error)}:(r.data||[]);E.render();
    },function(){msgs={err:"Pas d’internet."};E.render();});
  }
  function load(){
    reset();
    /* pas de code secret ici : seuls l'identité et la classe sont demandés */
    E.loadStudents("id,name,class_label,ref",function(rows,err){
      if(err){loadErr=E.fail(err);loaded=true;E.render();return;}
      loaded=true;E.render();
      E.loadDiscipline(function(d,e){dsc=e?{err:E.frErr(e)}:d;E.render();});
      loadMsgs();
    });
  }

  /* ---------- Petits morceaux communs ---------- */
  function ptab(){
    return'<section class="card"><div class="tb2 wrap" role="tablist" aria-label="Discipline ou messages">'+[["dis","Discipline"],["msg","Messages"]].map(function(t){
      return'<button type="button" role="tab" class="btn'+(tab===t[0]?"":" ghost")+'" aria-selected="'+(tab===t[0])+'" data-vue="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div></section>';
  }
  function geWrap(b){var i=b.indexOf('<h3 class="dh"'),ph='<div class="gr ge" id="ge" data-t="dis"></div>';return i<0?b+ph:b.slice(0,i)+ph+b.slice(i);}
  function sqlErr(e){return"Indisponible ("+esc(e)+"). Exécutez <b>supabase/vie-scolaire-admin.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.";}

  /* ---------- Discipline ---------- */
  function dis(){
    if(dsc===null)return'<p class="sub">Chargement…</p>';
    if(dsc.err)return'<p class="sub">'+sqlErr(dsc.err)+'</p>';
    var lim=E.dstrOf(Date.now()-30*864e5),R=dsc.filter(function(x){return E.get(x.student_id);}),R30=R.filter(function(x){return x.d>=lim;}),S={},C={},g30=0;
    R.forEach(function(x){
      var r=E.get(x.student_id),k=r.class_label||"",s=S[x.student_id]||(S[x.student_id]={n:0,t:0,g:0,by:{}}),c=C[k]||(C[k]={n:0,t:0,g:0});
      s.t++;c.t++;s.by[x.teacher||"—"]=1;
      if(x.d>=lim){s.n++;c.n++;if(x.k==="grv"){s.g++;c.g++;}}
    });
    R30.forEach(function(x){if(x.k==="grv")g30++;});
    var ids=Object.keys(S).filter(function(i){return S[i].n>0;}),rec=ids.filter(function(i){return S[i].n>=2;});
    var h='<div class="kpis">'+E.kp(R30.length,"incidents (30 j)")+E.kp(g30,"dont graves")+E.kp(ids.length,"élèves concernés")+E.kp(rec.length,"récidives (≥ 2)")+E.kp(R.length,"depuis le début")+'</div>';
    h+='<p class="sub">Seuls les incidents que les enseignants transmettent depuis la fiche de l’élève apparaissent ici. Leurs autres observations restent privées, et les parents ne voient jamais ces incidents.</p>';
    if(!R.length)return h+'<p class="sub" style="margin-top:10px">Aucun incident transmis pour le moment.</p>';
    var ks=Object.keys(C).sort(function(a,b){return C[b].n-C[a].n||C[b].t-C[a].t||E.sortCls(a,b);}),mx=Math.max.apply(null,ks.map(function(k){return C[k].n||C[k].t;}))||1;
    var sv=ids.sort(function(a,b){return S[b].g-S[a].g||S[b].n-S[a].n;});
    h+='<h3 class="dh">Par classe</h3>';
    h+=ks.map(function(k){
      var c=C[k],hr=k?E.href("classes",{c:k}):E.href("classes");
      return'<a class="dr" href="'+esc(hr)+'" style="display:block"><span style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(k||"(sans classe)")+'</b><span class="tg'+(c.g?" bad":"")+'">'+c.n+' (30 j)</span></span><small>'+pl(c.t,"incident","incidents")+' au total'+(c.g?" · "+pl(c.g,"grave","graves")+" sur 30 j":"")+'</small>'+E.pbar((c.n||c.t)/mx*100,c.g>0)+'</a>';
    }).join("");
    h+='<h3 class="dh">Élèves concernés (30 jours)</h3>';
    h+=sv.slice(0,12).map(function(i){var s=S[i],r=E.get(i);return E.dr(r.name,(r.class_label||"(sans classe)")+" · signalé par "+Object.keys(s.by).join(", "),s.g?"grave":pl(s.n,"incident","incidents"),undefined,s.g>0||s.n>=2);}).join("")||'<p class="sub">Aucun incident ces 30 derniers jours.</p>';
    if(sv.length>12)h+='<p class="sub">+ '+(sv.length-12)+' autre'+(sv.length-12>1?"s":"")+'. L’export Excel contient la liste complète.</p>';
    h+='<h3 class="dh">Derniers incidents</h3>';
    h+=R.slice(0,10).map(function(x){
      var r=E.get(x.student_id);
      return'<div class="dr" style="display:block"><span style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(r.name)+'</b><span class="tg'+(x.k==="grv"?" bad":"")+'">'+(x.k==="grv"?"grave":"incident")+'</span></span><small>'+esc(E.fd(x.d)+" · "+(r.class_label||"(sans classe)")+" · "+(x.teacher||"—")+(x.subj?" ("+x.subj+")":""))+'</small><small style="color:var(--ink)">'+esc(x.t)+'</small></div>';
    }).join("");
    return h+'<div class="bs"><button class="btn ghost" id="x-dis">Exporter tous les incidents (Excel)</button></div>';
  }
  function exportDis(){
    var body=(Array.isArray(dsc)?dsc:[]).filter(function(x){return E.get(x.student_id);}).map(function(x){var r=E.get(x.student_id);return[x.d,r.name,r.class_label||"(sans classe)",x.k==="grv"?"Grave":"Incident",x.teacher||"",x.subj||"",x.t];});
    E.download("incidents-"+E.schoolYear()+".csv",E.tblCsv({head:["Date","Élève","Classe","Gravité","Enseignant","Matière","Description"],body:body}));
  }

  /* ---------- Messages aux enseignants et aux familles ---------- */
  function msg(){
    var h='<div class="card"><h2>Nouveau message</h2><p class="sub" style="margin:0 0 6px">Un enseignant voit le message dans l’application ; une famille le voit dans son espace parents (avec le code famille). Messages visibles 45 jours (enseignants) ou 60 jours (familles).</p>'+
      '<label for="mc">Destinataires</label><select id="mc"><option value="enseignants"'+(D.c==="enseignants"?" selected":"")+'>Tous les enseignants</option><option value="familles"'+(D.c==="familles"?" selected":"")+'>Toutes les familles</option></select>'+
      '<label for="mt">Titre</label><input id="mt" type="text" maxlength="100" value="'+esc(D.t)+'" placeholder="ex. Réunion pédagogique">'+
      '<label for="mb">Message</label><textarea id="mb" maxlength="1000" placeholder="Votre message…">'+esc(D.b)+'</textarea>'+
      '<div class="bs"><button class="btn" id="emsg">Envoyer</button></div></div>';
    if(msgs===null)return h+'<p class="sub">Chargement des messages…</p>';
    if(msgs.err)return h+'<p class="sub">Liste indisponible ('+esc(msgs.err)+'). Exécutez <b>supabase/gestion-v71.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.</p>';
    if(!msgs.length)return h+'<p class="sub">Aucun message envoyé.</p>';
    h+='<h3 class="dh">Messages envoyés</h3>';
    return h+msgs.map(function(m){
      var c=String(m.corps||"");
      return'<div class="st mrow"><div class="mi"><b>'+esc(m.titre)+'</b> · <span class="tg">'+(m.cible==="familles"?"familles":"enseignants")+'</span><br><span class="sub" style="margin:0">'+esc(E.fdt(m.created_at))+' — '+esc(c.length>140?c.slice(0,140)+"…":c)+'</span></div>'+
        '<div class="mb"><button class="btn warn" data-msgdel="'+esc(m.id)+'">Retirer</button></div></div>';
    }).join("");
  }
  function send(){
    var t=D.t.trim(),c=D.b.trim();
    if(!t||!c){E.say("Écrivez un titre et un message.");return;}
    if(!confirm("Envoyer ce message à "+(D.c==="familles"?"toutes les familles":"tous les enseignants")+" de l’établissement ?"))return;
    E.call("etab_message_envoyer",{p_etab:E.ET.id,p_cible:D.c,p_titre:t,p_corps:c},function(){D.t="";D.b="";E.say("Message envoyé.");loadMsgs();});
  }

  /* ---------- Contenu ---------- */
  function render(){
    if(!loaded)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    if(loadErr)return'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>';
    var h=ptab();
    if(tab==="msg")return h+msg();
    if(!E.rows.length)return h+'<div class="card"><h2>Aucun élève pour le moment</h2><p class="sub" style="margin:0">Ajoutez ou importez vos élèves dans la rubrique « Classes » : les incidents transmis par les enseignants apparaîtront ici.</p><div class="bs"><a class="btn" href="'+esc(E.href("classes"))+'" style="text-decoration:none">Ouvrir « Classes »</a></div></div>';
    return h+geWrap(dis());
  }

  function setTab(t){
    if(t===tab)return;
    tab=t;try{history.replaceState(null,"","#"+HASH[t]);}catch(e){}
    var y=window.scrollY;E.render();window.scrollTo(0,y);
  }

  /* Boutons, brouillon du message (gardé quand la page se redessine), export, puis graphique */
  function after(v){
    Array.prototype.forEach.call(v.querySelectorAll("[data-vue]"),function(b){b.onclick=function(){setTab(b.getAttribute("data-vue"));};});
    var mc=document.getElementById("mc"),mt=document.getElementById("mt"),mb=document.getElementById("mb"),em=document.getElementById("emsg"),xd=document.getElementById("x-dis");
    if(mc)mc.onchange=function(){D.c=mc.value;};
    if(mt)mt.oninput=function(){D.t=mt.value;};
    if(mb)mb.oninput=function(){D.b=mb.value;};
    if(em)em.onclick=send;
    if(xd)xd.onclick=exportDis;
    Array.prototype.forEach.call(v.querySelectorAll("[data-msgdel]"),function(b){
      b.onclick=function(){
        if(!confirm("Retirer ce message ? Il disparaîtra aussi chez les destinataires."))return;
        E.call("etab_message_supprimer",{p_etab:E.ET.id,p_id:b.getAttribute("data-msgdel")},function(){E.say("Message retiré.");loadMsgs();});
      };
    });
    if(tab!=="dis"||!Array.isArray(dsc)||typeof geDraw!=="function")return;
    try{geDraw({M:null,rows:E.rows,TH:E.TH,tch:null,dsc:dsc,fin:null,sortCls:E.sortCls,lvl:E.lvl,lvlRank:E.lvlRank,pc:E.pc,mean:E.mean,get:E.get,stat:E.tstat,tname:E.tname,dstrOf:E.dstrOf});}catch(e){}
  }

  window.addEventListener("hashchange",function(){var t=fromHash();if(t)setTab(t);});

  E.start({page:"vie",load:load,reset:reset,render:render,after:after,onMembres:function(){}});
})();

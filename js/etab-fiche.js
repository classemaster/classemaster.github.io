/* Fiche d'un élève (chef d'établissement) — étapes 25 (v127), 26 (v128 : Évaluations), 27 (v129 : Assiduité et Devoirs) 28 (v130 : Avertissements et incidents) et 29 (v131 : ouverture depuis Résultats, Vie scolaire et les graphiques) 30 (v132 : consultation hors ligne) et 32 (v134 : les avertissements dans la fiche).
   Un panneau plein écran sur téléphone s'ouvre au toucher d'un élève marqué data-fiche="<id>" (ex. « À surveiller » de l'Accueil) et lit la fonction serveur etab_eleve_fiche
   (supabase/fiche-eleve-v105.sql). Cette étape montre l'en-tête et les moyennes par matière et par trimestre ; les sections suivantes s'ajoutent à EtabFiche.sections.
   Les données viennent du serveur : tout texte est échappé. Un seul nom global : « EtabFiche ». */
var EtabFiche=(function(){
  var me={cur:null,open:null,sections:[]},tok=0,box=null,from=null;

  function esc(t){return String(t==null?"":t).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function nf(v){return v===null||v===undefined||isNaN(v)?"–":String(Math.round(v*10)/10).replace(".",",");}
  function num(v){return v===null||v===undefined||v===""||isNaN(+v)?null:+v;}
  function mean(a){var s=0,n=0;a.forEach(function(v){v=num(v);if(v!==null){s+=v;n++;}});return n?s/n:null;}
  function pct(n,a){return n>0?(n-a)/n*100:null;}
  function pl(n,s,p){return n+" "+(n>1?p:s);}
  function th(H){return H&&H.TH?H.TH:{moy:10,pres:80,abs:3};}

  /* Ligne d'élève qui ouvre la fiche (même aspect que E.dr) */
  me.row=function(id,title,sub,tag,bad){
    return'<button type="button" class="dr" data-fiche="'+esc(id)+'"><span><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span>'+
      (tag?'<span class="tg'+(bad===true?" bad":bad===false?" ok":"")+'">'+esc(tag)+'</span>':"")+'</button>';
  };

  /* Chiffres de l'en-tête : moyenne générale (chaque matière compte pour une), présence, absences, retards */
  me.stats=function(d){
    var S=(d&&d.subjects)||[],n=0,a=0,j=0,r=0;
    S.forEach(function(s){n+=+s.n||0;a+=+s.a||0;j+=+s.j||0;r+=+s.r||0;});
    return{gm:mean(S.map(function(s){return s.avg;})),p:pct(n,a),n:n,a:a,j:j,r:r,subjects:S.length};
  };

  function kp(v,l,bad){return'<div class="ef-k'+(bad===true?" bad":bad===false?" ok":"")+'"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>';}
  function head(d,H){
    var st=me.stats(d),T=th(H),s=(d&&d.student)||{};
    return'<header class="ef-h"><h2 id="ef-t">'+esc(s.name||"(sans nom)")+'</h2><p class="ef-c">'+esc(s.class_label||"(sans classe)")+'</p>'+
      '<div class="ef-ks">'+kp(nf(st.gm)+(st.gm===null?"":" / 20"),"moyenne générale",st.gm===null?undefined:st.gm<T.moy)+
      kp(st.p===null?"–":nf(st.p)+" %","présence",st.p===null?undefined:st.p<T.pres)+
      kp(String(st.a),st.a>1?"absences":"absence")+kp(String(st.r),st.r>1?"retards":"retard")+'</div></header>';
  }

  /* Moyennes par matière et par trimestre ; une note sous le seuil de réussite est signalée */
  function grades(d,H){
    var S=(d&&d.subjects)||[],T=th(H);
    if(!S.length)return'<section class="ef-s"><h3>Moyennes</h3><p class="ef-m">Aucun enseignant n’a encore publié de suivi pour cet élève.</p></section>';
    function cell(v){v=num(v);return'<td class="'+(v===null?"":v<T.moy?"bad":"")+'">'+nf(v)+'</td>';}
    var rows=S.map(function(s){
      return'<tr><th scope="row">'+esc(s.subj||"—")+(s.teacher?'<small>'+esc(s.teacher)+'</small>':"")+'</th>'+cell(s.t1)+cell(s.t2)+cell(s.t3)+cell(s.avg)+'</tr>';
    }).join("");
    return'<section class="ef-s"><h3>Moyennes par matière</h3><div class="ef-w"><table class="ef-t"><thead><tr><th scope="col">Matière</th><th scope="col">T1</th><th scope="col">T2</th><th scope="col">T3</th><th scope="col">Moy.</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<p class="ef-m">Sur 20. T1 : septembre à décembre, T2 : janvier à mars, T3 : avril à août. En rouge : sous '+nf(T.moy)+'.</p></section>';
  }
  /* Évaluations : titre, matière, date, note sur son barème, moyenne de la classe (même barème), coefficient s'il n'est pas 1 ; les 10 plus récentes, le reste dans « Voir les N autres » */
  var EV_SHOW=10;
  function dateFr(d){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d||""));return m?m[3]+"/"+m[2]+"/"+m[1]:"sans date";}
  function evRow(e,T){
    var n=num(e.n),m=num(e.m),c=num(e.c),k=num(e.k),bad=n!==null&&m>0&&n/m*20<T.moy;
    var sub=[e.subj||"—",dateFr(e.d)];
    if(c!==null)sub.push("classe "+nf(c));
    if(k!==null&&k!==1)sub.push("coef. "+nf(k));
    return'<div class="dr"><span><b>'+esc(e.t||"Évaluation")+'</b><small>'+esc(sub.join(" · "))+'</small></span><span class="tg'+(bad?" bad":"")+'">'+nf(n)+(m>0?" / "+nf(m):"")+'</span></div>';
  }
  function evals(d,H){
    var L=((d&&d.evals)||[]).slice().sort(function(a,b){return String(b.d||"")<String(a.d||"")?-1:String(b.d||"")>String(a.d||"")?1:0;}),T=th(H);
    if(!L.length)return'<section class="ef-s"><h3>Évaluations</h3><p class="ef-m">Aucune évaluation notée n’a été transmise pour cet élève.</p></section>';
    var first=L.slice(0,EV_SHOW).map(function(e){return evRow(e,T);}).join(""),rest=L.slice(EV_SHOW);
    return'<section class="ef-s"><h3>Évaluations <span class="ef-n">'+L.length+'</span></h3>'+first+
      (rest.length?'<details class="ef-more"><summary>Voir '+(rest.length>1?"les "+rest.length+" autres":"l’autre")+'</summary>'+rest.map(function(e){return evRow(e,T);}).join("")+'</details>':"")+
      '<p class="ef-m">Note de l’élève sur son barème ; « classe » est la moyenne de la classe sur le même barème. En rouge : sous '+nf(T.moy)+' sur 20.</p></section>';
  }
  /* Assiduité : chiffres par matière (appels, absences dont justifiées, retards, présence) puis les absences et retards, les plus récents d'abord ; alerte si le seuil d'absences sur 14 jours est atteint */
  var AB_SHOW=10;
  function isoDay(ms){var d=new Date(ms);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function absRow(e){
    var v=e.v==="r"?"r":"a",tag=v==="r"?"retard":e.j===true?"justifiée":"non justifiée",cls=v==="r"?"":e.j===true?" ok":" bad";
    var sub=[e.subj||"—"];if(e.m)sub.push(e.m);
    return'<div class="dr"><span><b>'+esc(dateFr(e.d))+'</b><small>'+esc(sub.join(" · "))+'</small></span><span class="tg'+cls+'">'+tag+'</span></div>';
  }
  function attend(d,H){
    var S=(d&&d.subjects)||[],T=th(H),st=me.stats(d),A=(((d&&d.abs)||[]).slice()).sort(function(a,b){return String(b.d||"")<String(a.d||"")?-1:String(b.d||"")>String(a.d||"")?1:0;});
    if(!st.n&&!A.length)return'<section class="ef-s"><h3>Assiduité</h3><p class="ef-m">Aucun appel n’a encore été transmis pour cet élève.</p></section>';
    var h='<section class="ef-s"><h3>Assiduité</h3>';
    var lim=isoDay(((H&&H.now)||Date.now())-14*864e5),rec=A.filter(function(e){return e.v!=="r"&&String(e.d||"")>=lim;}).length;
    if(T.abs>0&&rec>=T.abs)h+='<p class="ef-e">⚠ '+pl(rec,"absence","absences")+' sur les 14 derniers jours (seuil : '+T.abs+').</p>';
    h+='<p class="ef-m" style="margin:0 0 6px">'+pl(st.n,"appel","appels")+' · '+pl(st.a,"absence","absences")+' dont '+st.j+' justifiée'+(st.j>1?"s":"")+' · '+pl(st.r,"retard","retards")+'</p>';
    if(S.length){
      var rows=S.map(function(x){
        var n=+x.n||0,a=+x.a||0,p=pct(n,a);
        return'<tr><th scope="row">'+esc(x.subj||"—")+'</th><td>'+n+'</td><td>'+a+'</td><td>'+(+x.j||0)+'</td><td>'+(+x.r||0)+'</td><td class="'+(p!==null&&p<T.pres?"bad":"")+'">'+(p===null?"–":nf(p)+" %")+'</td></tr>';
      }).join("");
      h+='<div class="ef-w"><table class="ef-t"><thead><tr><th scope="col">Matière</th><th scope="col">Appels</th><th scope="col">Abs.</th><th scope="col">Just.</th><th scope="col">Ret.</th><th scope="col">Prés.</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }
    if(A.length){
      var first=A.slice(0,AB_SHOW).map(absRow).join(""),rest=A.slice(AB_SHOW);
      h+='<h4 class="ef-h4">Absences et retards <span class="ef-n">'+A.length+'</span></h4>'+first+
        (rest.length?'<details class="ef-more"><summary>Voir '+(rest.length>1?"les "+rest.length+" autres":"l’autre")+'</summary>'+rest.map(absRow).join("")+'</details>':"");
    }
    return h+'<p class="ef-m">Présence = (appels − absences) ÷ appels. En rouge : sous '+nf(T.pres)+' %. Les retards ne comptent pas comme des absences.</p></section>';
  }

  /* Devoirs : par matière, rendus, rendus en retard et non rendus (les enseignants transmettent les nombres, pas les titres) */
  function homework(d){
    var S=((d&&d.subjects)||[]).filter(function(x){var w=x.hw||{};return(+w.r||0)+(+w.l||0)+(+w.n||0)>0;});
    if(!S.length)return'<section class="ef-s"><h3>Devoirs</h3><p class="ef-m">Aucun devoir suivi pour cet élève.</p></section>';
    var tr=0,tl=0,tn=0;
    var rows=S.map(function(x){var w=x.hw,r=+w.r||0,l=+w.l||0,n=+w.n||0;tr+=r;tl+=l;tn+=n;
      return'<tr><th scope="row">'+esc(x.subj||"—")+'</th><td>'+r+'</td><td>'+l+'</td><td class="'+(n>0?"bad":"")+'">'+n+'</td></tr>';}).join("");
    return'<section class="ef-s"><h3>Devoirs</h3><p class="ef-m" style="margin:0 0 6px">'+tr+' rendu'+(tr>1?"s":"")+' · '+tl+' en retard · '+tn+' non rendu'+(tn>1?"s":"")+'</p>'+
      '<div class="ef-w"><table class="ef-t"><thead><tr><th scope="col">Matière</th><th scope="col">Rendus</th><th scope="col">En retard</th><th scope="col">Non rendus</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  }

  /* Avertissements et incidents déjà transmis par les enseignants : les plus récents d'abord, l'incident grave en rouge */
  var DI_SHOW=10;
  function disRow(e){
    var g=e.k==="grv",tag=g?"incident grave":e.k==="avt"?"avertissement":"incident",sub=[e.subj||"—"];if(e.teacher)sub.push(e.teacher);
    return'<div class="ef-d"><div class="dr"><span><b>'+esc(dateFr(e.d))+'</b><small>'+esc(sub.join(" · "))+'</small></span><span class="tg'+(g?" bad":"")+'">'+tag+'</span></div>'+
      (e.t?'<p class="ef-tx">'+esc(e.t)+'</p>':"")+'</div>';
  }
  function disc(d){
    var L=(((d&&d.dis)||[]).slice()).sort(function(a,b){return String(b.d||"")<String(a.d||"")?-1:String(b.d||"")>String(a.d||"")?1:0;});
    if(!L.length)return'<section class="ef-s"><h3>Avertissements et incidents</h3><p class="ef-m">Aucun avertissement ni incident n’a été transmis pour cet élève.</p></section>';
    var g=L.filter(function(e){return e.k==="grv";}).length,av=L.filter(function(e){return e.k==="avt";}).length,inc=L.length-av,first=L.slice(0,DI_SHOW).map(disRow).join(""),rest=L.slice(DI_SHOW);
    var cnt=[av?pl(av,"avertissement","avertissements"):"",inc?pl(inc,"incident","incidents"):""].filter(Boolean).join(" · ")+" transmis"+(g?" dont "+pl(g,"grave","graves"):"");
    return'<section class="ef-s"><h3>Avertissements et incidents <span class="ef-n">'+L.length+'</span></h3>'+
      '<p class="ef-m" style="margin:0 0 6px">'+esc(cnt)+'</p>'+first+
      (rest.length?'<details class="ef-more"><summary>Voir '+(rest.length>1?"les "+rest.length+" autres":"l’autre")+'</summary>'+rest.map(disRow).join("")+'</details>':"")+
      '<p class="ef-m">Seuls les avertissements et les incidents que les enseignants transmettent à l’administration apparaissent ici ; leurs autres observations restent privées. Les parents ne les voient pas.</p></section>';
  }
  me.sections=[grades,evals,attend,homework,disc];

  /* Date et heure d'une copie enregistrée (jj/mm/aaaa à hh:mm) */
  function stamp(ms){var d=new Date(ms),p=function(n){return String(n).padStart(2,"0");};return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" à "+p(d.getHours())+":"+p(d.getMinutes());}

  /* copieAt (facultatif) : la fiche vient d'une copie gardée sur l'appareil, pas du serveur */
  me.html=function(d,H,copieAt){
    var h=head(d,H);
    if(copieAt)h+='<p class="ef-e">Copie enregistrée le '+esc(stamp(copieAt))+' : sans connexion, les chiffres ont pu changer depuis.</p>';
    me.sections.forEach(function(f){try{h+=f(d,H);}catch(e){}});
    return h;
  };

  function msg(e){
    var m=String((e&&(e.message||e.code))||"");
    if(/not admin/i.test(m))return"Cette fiche est réservée au chef de l’établissement de l’élève.";
    if(/could not find|42883|PGRST202|does not exist/i.test(m))return"La fiche n’est pas encore activée : exécutez fiche-eleve-v105.sql dans Supabase (voir supabase/LISEZ-MOI.md).";
    if(/fetch|network|offline/i.test(m)||(typeof navigator!=="undefined"&&navigator.onLine===false)){
      if(typeof EtabOffline!=="undefined"&&EtabOffline&&EtabOffline.enabled&&!EtabOffline.enabled())return"Fiche indisponible sans connexion. Pour consulter les fiches hors ligne, cochez « Garder les données sur cet appareil » dans Paramètres, puis ouvrez chaque fiche une fois avec du réseau.";
      return"Cette fiche n’a pas encore été ouverte avec du réseau sur cet appareil : elle n’est pas disponible hors ligne.";
    }
    return"Fiche indisponible pour le moment.";
  }

  function body(){return box&&box.querySelector(".ef-b");}
  function close(){
    tok++;me.open=null;me.cur=null;
    if(box){document.removeEventListener("keydown",key,true);box.remove();box=null;document.documentElement.classList.remove("ef-lock");}
    if(from&&from.isConnected){try{from.focus();}catch(e){}}from=null;
  }
  function key(e){if(e.key==="Escape"){e.preventDefault();close();}}
  function shell(){
    box=document.createElement("div");box.className="ef";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-labelledby","ef-t");
    box.innerHTML='<div class="ef-bg" data-ef="x"></div><div class="ef-p"><button type="button" class="ef-x" data-ef="x" aria-label="Fermer la fiche">×</button><div class="ef-b" aria-live="polite"></div></div>';
    box.addEventListener("click",function(e){var t=e.target;if(t&&t.getAttribute&&t.getAttribute("data-ef")==="x")close();});
    document.body.appendChild(box);document.documentElement.classList.add("ef-lock");
    document.addEventListener("keydown",key,true);
    var x=box.querySelector(".ef-x");try{x.focus();}catch(e){}
  }

  /* Ouvre la fiche d'un élève ; name et cls (facultatifs) s'affichent pendant le chargement */
  me.show=function(id,name,cls,trigger){
    if(!id)return;
    if(box)close();
    from=trigger||null;me.open=id;shell();
    var my=++tok,b=body();
    b.innerHTML='<header class="ef-h"><h2 id="ef-t">'+esc(name||"Fiche de l’élève")+'</h2>'+(cls?'<p class="ef-c">'+esc(cls)+'</p>':"")+'</header><p class="ef-m">Chargement…</p>';
    var EE=(typeof E!=="undefined"&&E&&E.TH)?E:(typeof Etab!=="undefined"&&Etab&&Etab.TH?Etab:null),H=EE?{TH:EE.TH}:null;   /* seuils réglés dans « Paramètres » (Etab sur les pages du chef) */
    if(typeof sb==="undefined"||!sb||!sb.rpc){b.innerHTML+='<p class="ef-e">'+esc(msg())+'</p>';return;}
    if(typeof EtabOffline!=="undefined"&&EtabOffline)EtabOffline.hit=null;
    var done=function(r,err){
      if(my!==tok||!box)return;
      if(err||!r||r.error){b.innerHTML='<header class="ef-h"><h2 id="ef-t">'+esc(name||"Fiche de l’élève")+'</h2></header><p class="ef-e">'+esc(msg(err||(r&&r.error)))+'</p>';return;}
      if(!r.data){b.innerHTML='<header class="ef-h"><h2 id="ef-t">'+esc(name||"Fiche de l’élève")+'</h2></header><p class="ef-e">Cet élève est introuvable.</p>';return;}
      var ht=typeof EtabOffline!=="undefined"&&EtabOffline?EtabOffline.hit:null;
      me.cur=r.data;b.innerHTML=me.html(r.data,H,ht&&ht.n==="etab_eleve_fiche"&&String(ht.b).indexOf(id)>=0?ht.at:0);
    };
    try{sb.rpc("etab_eleve_fiche",{p_student:id}).then(function(r){done(r);},function(e){done(null,e||{message:"failed to fetch"});});}
    catch(e){done(null,e);}
  };
  me.close=close;

  /* Un seul écouteur pour toute la page : tout élément [data-fiche] ouvre la fiche */
  function click(e){
    var t=e.target&&e.target.closest?e.target.closest("[data-fiche]"):null;
    if(!t||(box&&box.contains(t)))return;
    e.preventDefault();
    var n=t.querySelector("b"),s=t.querySelector("small");
    me.show(t.getAttribute("data-fiche"),n?n.textContent:"",s?String(s.textContent).split(" · ")[0]:"",t);
  }
  if(typeof document!=="undefined")document.addEventListener("click",click);
  me._esc=esc;
  return me;
})();

/* Page « Fin d'année » de l'établissement (v92) : bulletins prêts, décisions de passage et de redoublement, exports pour l'inspection,
   rentrée (passage des élèves au niveau suivant).
   Reprise de l'onglet « Fin de période » et du bloc « Rentrée » de l'ancienne page de gestion (remplacée par une redirection depuis la v94), sur le socle commun js/etab-core.js.
   Adresses : etab-fin.html (Bulletins), #decisions (Décisions et exports), #rentree (Rentrée).
   Écritures : décisions de l'année (table registry_decisions, comme avant) et passage de rentrée par les fonctions serveur
   appliquer_rentree / annuler_rentree (supabase/rentree-v61.sql). Une sauvegarde des classes est téléchargée avant chaque passage.
   Aucun code secret demandé. */
(function(){
  var E=Etab,esc=E.esc,pl=E.plural,nf1=E.nf1,pc=E.pc,mean=E.mean;
  var dash=null,tch=null,dsc=null,dec=null,loaded=false,loadErr="",M=null,tab="bul",GF=null;
  var DL={p:"Passe",x:"À examiner",r:"Redoublement",n:"Non évalué"},PER=[["1","T1"],["2","T2"],["3","T3"],["a","Année"]],dper="",fcl=null;
  /* seuil de passage : réglage de cet appareil (comme avant), de 5 à 15 */
  var thr=10;try{var tv=parseFloat(localStorage.getItem("cm-seuil"));if(tv>=5&&tv<=15)thr=tv;}catch(e){}
  var RTA={year:"",last3:null,inc:false,dmap:null,list:null,missing:false,err:"",loading:false};

  /* adresses : #bulletins, #decisions, #rentree */
  var HASH={bul:"bulletins",dec:"decisions",ren:"rentree"};
  function fromHash(){var h=String(location.hash||"").slice(1);return h==="bulletins"?"bul":h==="decisions"?"dec":h==="rentree"?"ren":null;}
  tab=fromHash()||tab;

  function reset(){dash=null;tch=null;dsc=null;dec=null;loaded=false;loadErr="";M=null;GF=null;fcl=null;RTA.dmap=null;RTA.list=null;RTA.missing=false;RTA.err="";RTA.loading=false;}
  function perDef(){var m=new Date().getMonth()+1;return m>=9?"1":m<=3?"2":"3";}
  function perName(p){return(PER.filter(function(x){return x[0]===p;})[0]||[,""])[1];}
  function sqlErr(e){return"Indisponible ("+esc(e)+"). Exécutez <b>supabase/vie-scolaire-admin.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.";}
  function fnm(s){return E.nrm(s||"sans-classe").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"classe";}
  function keep(f){var y=window.scrollY;f();window.scrollTo(0,y);}

  /* ---------- Chargement : les élèves d'abord, puis suivis, enseignants, incidents et décisions en parallèle ---------- */
  function loadDec(){
    var out={};
    (function page(from){
      sb.from("registry_decisions").select("student_id,decision").eq("year",E.schoolYear()).range(from,from+999).then(function(r){
        if(r.error){dec={err:E.frErr(r.error)};E.render();return;}
        (r.data||[]).forEach(function(x){out[x.student_id]=x.decision;});
        if((r.data||[]).length===1000)page(from+1000);else{dec=out;E.render();}
      },function(){dec={err:"Pas d’internet."};E.render();});
    })(0);
  }
  function load(){
    reset();
    /* pas de code secret ici : seuls l'identité et la classe sont demandés */
    E.loadStudents("id,name,class_label,ref",function(rows,err){
      if(err){loadErr=E.fail(err);loaded=true;E.render();return;}
      loaded=true;E.render();
      E.loadDash(function(d,e){dash=e?{err:E.frErr(e)}:d;M=null;E.render();});
      E.loadTeaching(function(d,e){tch=e?{err:E.frErr(e)}:d;E.render();});
      E.loadDiscipline(function(d,e){dsc=e?{err:E.frErr(e)}:d;E.render();});
      loadDec();
    });
  }

  /* ---------- Décisions : proposition d'après la moyenne annuelle, décision confirmée par le conseil de classe ---------- */
  function autoDec(a,t){return a===null?"n":a>=t?"p":a>=t-2?"x":"r";}
  function finDec(m,i){var s=m.S[i],a=s?s.m:null,au=autoDec(a,thr),o=dec&&!dec.err?dec[i]:null;return{a:a,auto:au,fin:o||au,set:!!o};}
  function pval(d,p){var v=p==="a"?d.avg:d["t"+p];return v===null||v===undefined?null:+v;}
  /* Bulletins : une matière est complète quand tous les élèves de la classe ont une moyenne pour la période et qu'aucune évaluation n'attend ses notes */
  function bulletins(m,p){
    var G={},C={};
    dash.forEach(function(d){
      var r=m.byId[d.student_id];if(!r)return;
      var k=r.class_label||"",key=k+"|"+(d.teacher||"")+"|"+(d.subj||""),g=G[key]||(G[key]={k:k,t:d.teacher||"",s:d.subj||"—",n:0,late:0});
      if(pval(d,p)!==null)g.n++;
    });
    (Array.isArray(tch)?tch:[]).forEach(function(g){var o=G[(g.class_label||"")+"|"+(g.teacher||"")+"|"+(g.subj||"")];if(o)o.late=E.evLate(g).length;});
    Object.keys(G).forEach(function(key){
      var g=G[key],eff=m.C[g.k]?m.C[g.k].eff:0,c=C[g.k]||(C[g.k]={k:g.k,eff:eff,ok:0,all:0,bad:[]});
      c.all++;if(g.n>=eff&&!g.late)c.ok++;else c.bad.push(g);
    });
    return C;
  }
  function incOf(id){var n=0;if(Array.isArray(dsc))dsc.forEach(function(x){if(x.student_id===id)n++;});return n;}
  function incAll30(){var n=0,lim=E.dstrOf(Date.now()-30*864e5);if(Array.isArray(dsc))dsc.forEach(function(x){if(E.get(x.student_id)&&x.d>=lim)n++;});return n;}
  function inc30(k){var n=0,lim=E.dstrOf(Date.now()-30*864e5);if(Array.isArray(dsc))dsc.forEach(function(x){var r=E.get(x.student_id);if(r&&(r.class_label||"")===k&&x.d>=lim)n++;});return n;}
  function counts(m){
    var cnt={p:0,x:0,r:0,n:0},conf=0,PC={};
    E.rows.forEach(function(r){var d=finDec(m,r.id),k=r.class_label||"",c=PC[k]||(PC[k]={p:0,x:0,r:0,n:0,conf:0,eff:0});c[d.fin]++;c.eff++;cnt[d.fin]++;if(d.set){c.conf++;conf++;}});
    return{cnt:cnt,conf:conf,PC:PC};
  }

  /* ---------- Petits morceaux communs ---------- */
  function ptab(){
    return'<section class="card"><div class="tb2 wrap" role="tablist" aria-label="Bulletins, décisions ou rentrée">'+[["bul","Bulletins"],["dec","Décisions"],["ren","Rentrée"]].map(function(t){
      return'<button type="button" role="tab" class="btn'+(tab===t[0]?"":" ghost")+'" aria-selected="'+(tab===t[0])+'" data-vue="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div></section>';
  }
  function geWrap(b){return b+'<div class="gr ge" id="ge" data-t="fin"></div>';}
  function needStats(){
    if(dash===null)return'<p class="sub">Chargement des statistiques…</p>';
    if(dash.err)return'<p class="sub">Statistiques indisponibles ('+esc(dash.err)+'). Exécutez <b>supabase/tableau-bord-admin.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.</p>';
    return'<p class="sub">Aucun enseignant n’a encore publié de suivi pour vos élèves : les bulletins et les décisions apparaîtront dès les premières publications.</p>';
  }

  /* ---------- Bulletins prêts ---------- */
  function bul(){
    if(!M)return needStats();
    if(!dper)dper=perDef();
    var C=bulletins(M,dper),ks=Object.keys(C).sort(E.sortCls),ready=ks.filter(function(k){return!C[k].bad.length;}).length;
    var h='<div class="tb2" role="group" aria-label="Période">'+PER.map(function(x){return'<button type="button" class="btn'+(dper===x[0]?"":" ghost")+'" data-per="'+x[0]+'" aria-pressed="'+(dper===x[0])+'">'+x[1]+'</button>';}).join("")+'</div>';
    h+='<div class="kpis">'+E.kp(ready+"/"+ks.length,"classes prêtes")+E.kp(ks.reduce(function(n,k){return n+C[k].ok;},0)+"/"+ks.reduce(function(n,k){return n+C[k].all;},0),"matières complètes")+'</div>';
    h+='<p class="sub">Prêt : chaque matière publiée pour la classe a une moyenne pour tous les élèves, sans évaluation en retard. Une matière que l’enseignant n’a encore jamais publiée n’est pas détectée.</p>';
    h+=ks.map(function(k){
      var c=C[k],bad=c.bad.length;
      return'<div class="dr" style="display:block"><span style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(k||"(sans classe)")+'</b><span class="tg'+(bad?" bad":" ok")+'">'+(bad?c.ok+"/"+c.all+" matières":"prêt")+'</span></span>'+
        (bad?c.bad.slice(0,4).map(function(g){return'<small>'+esc(g.s+(g.t?" · "+g.t:""))+' : '+g.n+'/'+c.eff+' élèves notés'+(g.late?' · '+pl(g.late,"évaluation","évaluations")+' sans notes':'')+'</small>';}).join("")+(bad>4?'<small>+ '+(bad-4)+' autre'+(bad-4>1?"s":"")+'</small>':""):'<small>'+pl(c.all,"matière complète","matières complètes")+'</small>')+'</div>';
    }).join("")||'<p class="sub">Aucune matière publiée.</p>';
    return h;
  }

  /* ---------- Décisions de passage et exports ---------- */
  function decis(){
    if(!M)return needStats();
    var h='<h3 class="dh" style="margin-top:6px">Passages et redoublements</h3>';
    var opts=[];for(var v=8;v<=12;v+=0.5)opts.push(v);
    h+='<label for="thr">Seuil de passage (/20) · proposé : « passe » dès ce seuil, « à examiner » jusqu’à 2 points en dessous, « redoublement » sous cette limite</label><select id="thr">'+opts.map(function(v){return'<option value="'+v+'"'+(v===thr?" selected":"")+'>'+nf1(v)+'</option>';}).join("")+'</select>';
    var K=counts(M);GF={cnt:K.cnt,PC:K.PC};
    h+='<div class="kpis">'+E.kp(K.cnt.p,"passent")+E.kp(K.cnt.x,"à examiner")+E.kp(K.cnt.r,"redoublent")+E.kp(K.cnt.n,"non évalués")+E.kp(K.conf+"/"+E.rows.length,"décisions confirmées")+'</div>';
    if(dec===null)h+='<p class="sub">Chargement des décisions…</p>';
    else if(dec.err)h+='<p class="sub">Décisions indisponibles ('+esc(dec.err)+') : exécutez <b>supabase/vie-scolaire-admin.sql</b> dans Supabase. Les propositions restent visibles.</p>';
    else h+='<p class="sub">Les propositions viennent de la moyenne annuelle. Confirmez ou corrigez après le conseil de classe : seules les décisions confirmées sont enregistrées (année '+esc(E.schoolYear())+').</p>';
    var ks=Object.keys(K.PC).sort(E.sortCls);
    h+=ks.map(function(k){var c=K.PC[k];return'<button type="button" class="dr" data-fcl="'+esc("#"+k)+'" style="display:block"><span style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(k||"(sans classe)")+'</b><span class="tg'+(c.conf>=c.eff?" ok":"")+'">'+c.conf+'/'+c.eff+' confirmées</span></span><small>'+c.p+' passent · '+c.x+' à examiner · '+c.r+' redoublent'+(c.n?' · '+c.n+' non évalués':'')+'</small></button>';}).join("");
    h+='<label for="fsel">Classe (décisions élève par élève et exports de classe)</label><select id="fsel"><option value="#none">Choisir une classe…</option>'+ks.map(function(k){return'<option value="'+esc("#"+k)+'"'+(fcl!==null&&fcl===k?" selected":"")+'>'+esc(k||"(sans classe)")+'</option>';}).join("")+'</select>';
    if(fcl!==null){
      var L=E.rows.filter(function(r){return(r.class_label||"")===fcl;}).sort(function(a,b){return a.name.localeCompare(b.name,"fr");}),off=!dec||dec.err;
      h+='<div style="margin-top:8px">'+L.map(function(r){
        var d=finDec(M,r.id);
        return'<div class="dr"><span><b>'+esc(r.name)+'</b><small>moyenne '+nf1(d.a)+' · proposé : '+DL[d.auto]+'</small></span><select data-dec="'+esc(r.id)+'" aria-label="Décision pour '+esc(r.name)+'" style="width:auto;min-width:132px"'+(off?" disabled":"")+'><option value="">Proposé : '+DL[d.auto]+'</option><option value="p"'+(dec&&dec[r.id]==="p"?" selected":"")+'>Passe</option><option value="x"'+(dec&&dec[r.id]==="x"?" selected":"")+'>À examiner</option><option value="r"'+(dec&&dec[r.id]==="r"?" selected":"")+'>Redoublement</option></select></div>';
      }).join("")+'</div>';
    }
    h+='<h3 class="dh">Exports pour l’inspection et les conseils de classe</h3><p class="sub">Excel : fichier CSV qui s’ouvre dans Excel. PDF : une page de rapport s’ouvre, choisissez « Enregistrer en PDF » dans la fenêtre d’impression.</p>';
    h+='<div class="bs"><button class="btn" id="x-ec">Excel · établissement</button><button class="btn" id="x-ep">PDF · établissement</button></div>';
    h+='<div class="bs"><button class="btn ghost" id="x-cc"'+(fcl===null?" disabled":"")+'>Excel · classe</button><button class="btn ghost" id="x-cp"'+(fcl===null?" disabled":"")+'>PDF · classe</button></div>';
    if(fcl===null)h+='<p class="sub">Choisissez une classe ci-dessus pour exporter son bilan.</p>';
    return geWrap(h);
  }
  function tblHtml(T){return'<table class="rpt"><thead><tr>'+T.head.map(function(x){return'<th>'+esc(x)+'</th>';}).join("")+'</tr></thead><tbody>'+T.body.map(function(r){return'<tr>'+r.map(function(c){return'<td>'+esc(typeof c==="number"?E.csvNum(c):c)+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';}
  function cntAll(PC,f){var n=0;Object.keys(PC).forEach(function(k){n+=PC[k][f];});return n;}
  function etabTable(m){
    var Bu=bulletins(m,dper||perDef()),PC=counts(m).PC,body=[],T={a:0,n:0,aj:0,rt:0,eff:0,fol:0},ms=[];
    Object.keys(m.C).sort(E.sortCls).forEach(function(k){
      var c=m.C[k],p=pc(c.n,c.a),ok=c.m.filter(function(x){return x>=E.TH.moy;}).length,b=Bu[k],d=PC[k]||{p:0,x:0,r:0};
      T.a+=c.a;T.n+=c.n;T.aj+=c.j;T.rt+=c.r;T.eff+=c.eff;T.fol+=c.fol;ms=ms.concat(c.m);
      body.push([k||"(sans classe)",c.eff,c.fol,p,c.a,Math.max(0,c.a-c.j),c.r,mean(c.m),c.m.length?ok/c.m.length*100:null,Array.isArray(dsc)?inc30(k):"",d.p,d.x,d.r,b?(b.bad.length?"Incomplet ("+b.ok+"/"+b.all+")":"Prêt"):"Sans donnée"]);
    });
    var tok=ms.filter(function(x){return x>=E.TH.moy;}).length;
    body.push(["Établissement",T.eff,T.fol,pc(T.n,T.a),T.a,Math.max(0,T.a-T.aj),T.rt,mean(ms),ms.length?tok/ms.length*100:null,Array.isArray(dsc)?incAll30():"",cntAll(PC,"p"),cntAll(PC,"x"),cntAll(PC,"r"),""]);
    return{head:["Classe","Effectif","Suivis","Présence (%)","Absences","Non justifiées","Retards","Moyenne /20","Réussite (%)","Incidents (30 j)","Passent","À examiner","Redoublent","Bulletins "+perName(dper||perDef())],body:body};
  }
  function classTable(m,k){
    var L=E.rows.filter(function(r){return(r.class_label||"")===k;}),W=L.map(function(r){return{r:r,s:m.S[r.id],d:finDec(m,r.id)};});
    W.sort(function(x,y){return(y.d.a===null?-1:y.d.a)-(x.d.a===null?-1:x.d.a)||x.r.name.localeCompare(y.r.name,"fr");});
    var rk=0;
    var body=W.map(function(o){
      var s=o.s,t=s?s.t.map(mean):[null,null,null];
      return[o.d.a===null?"":++rk,o.r.name,t[0],t[1],t[2],o.d.a,s?pc(s.n,s.a):null,s?s.a:"",s?Math.max(0,s.a-s.j):"",s?s.r:"",Array.isArray(dsc)?incOf(o.r.id):"",DL[o.d.auto],o.d.set?DL[o.d.fin]:"À confirmer"];
    });
    return{W:W,T:{head:["Rang","Élève","T1","T2","T3","Moyenne annuelle","Présence (%)","Absences","Non justifiées","Retards","Incidents","Décision proposée","Décision retenue"],body:body}};
  }
  function printRep(html){
    var pr=document.getElementById("pr");if(!pr){E.say("L’impression n’est pas disponible sur cette page.");return;}
    pr.innerHTML='<div class="rp">'+html+'</div>';E.say("Rapport prêt : choisissez « Enregistrer en PDF » dans la fenêtre d’impression.");setTimeout(function(){window.print();},150);
  }
  function repHead(t,sub){return'<h2>'+esc(t)+'</h2><p>'+esc(sub)+' · année '+esc(E.schoolYear())+' · édité le '+esc(E.fd(E.todayS())+"/"+E.todayS().slice(0,4))+'</p>';}
  function exportFin(id){
    if(!M){E.say("Les statistiques ne sont pas encore disponibles.");return;}
    var pl0=perName(dper||perDef());
    if(id==="x-ec"){E.download("synthese-etablissement-"+E.schoolYear()+".csv",E.tblCsv(etabTable(M)));return;}
    if(id==="x-ep"){
      var dif=M.ids.filter(function(i){return M.S[i].m!==null&&M.S[i].m<E.TH.moy;}).sort(function(x,y){return M.S[x].m-M.S[y].m;}).slice(0,40),
          dc=M.ids.filter(function(i){return M.S[i].ra>=E.TH.abs;}).sort(function(x,y){return M.S[y].ra-M.S[x].ra;}).slice(0,40);
      var h=repHead("Rapport de l’établissement","Synthèse par classe · bulletins : "+pl0)+tblHtml(etabTable(M));
      h+='<h3>Élèves en difficulté (moyenne sous '+nf1(E.TH.moy)+')</h3>'+tblHtml({head:["Élève","Classe","Moyenne /20","Présence (%)"],body:dif.map(function(i){return[M.byId[i].name,M.byId[i].class_label||"(sans classe)",M.S[i].m,pc(M.S[i].n,M.S[i].a)];})});
      h+='<h3>Risque de décrochage ('+E.TH.abs+' absence'+(E.TH.abs>1?"s":"")+' ou plus sur 14 jours)</h3>'+tblHtml({head:["Élève","Classe","Absences récentes","Absences au total"],body:dc.map(function(i){return[M.byId[i].name,M.byId[i].class_label||"(sans classe)",M.S[i].ra,M.S[i].a];})});
      h+='<div class="sig"><span>Le chef d’établissement</span><span>Cachet</span></div>';
      printRep(h);return;
    }
    if(fcl===null)return;
    var o=classTable(M,fcl),c=M.C[fcl]||{eff:0,fol:0,n:0,a:0,j:0,r:0,m:[]},ok=c.m.filter(function(x){return x>=E.TH.moy;}).length;
    if(id==="x-cc"){E.download("bilan-"+fnm(fcl)+"-"+E.schoolYear()+".csv",E.tblCsv(o.T));return;}
    if(id==="x-cp"){
      var cn={p:0,x:0,r:0,n:0};o.W.forEach(function(w){cn[w.d.fin]++;});
      var h2=repHead("Conseil de classe · "+(fcl||"(sans classe)"),pl(c.eff,"élève","élèves"));
      h2+='<p><b>Moyenne de la classe : '+esc(nf1(mean(c.m)))+'/20</b> · réussite (≥ '+esc(nf1(E.TH.moy))+') : '+(c.m.length?Math.round(ok/c.m.length*100)+" %":"–")+' · présence : '+esc(pc(c.n,c.a)===null?"–":nf1(pc(c.n,c.a))+" %")+' · seuil de passage : '+esc(nf1(thr))+' · propositions : '+cn.p+' passent, '+cn.x+' à examiner, '+cn.r+' redoublent'+(cn.n?', '+cn.n+' non évalués':'')+'</p>';
      h2+=tblHtml(o.T)+'<p style="margin-top:2mm;font-size:8pt">Propositions établies d’après les moyennes ; la décision finale appartient au conseil de classe.</p><div class="sig"><span>Le professeur principal</span><span>Le chef d’établissement</span></div>';
      printRep(h2);return;
    }
  }
  /* Enregistre (ou efface) la décision d'un élève pour l'année en cours */
  function saveDec(sel){
    var id=sel.getAttribute("data-dec"),v=sel.value,yr=E.schoolYear();
    if(!dec||dec.err||E.busy)return;
    E.busy=true;sel.disabled=true;
    var req=v?sb.from("registry_decisions").upsert({student_id:id,year:yr,decision:v},{onConflict:"student_id,year"}):sb.from("registry_decisions").delete().eq("student_id",id).eq("year",yr);
    req.then(function(r){
      E.busy=false;
      if(r.error){sel.disabled=false;E.say("Échec : "+E.frErr(r.error)+" — exécutez d’abord supabase/vie-scolaire-admin.sql dans Supabase.");keep(E.render);return;}
      if(v)dec[id]=v;else delete dec[id];
      keep(E.render);E.say("Décision enregistrée.");
    },function(){E.busy=false;sel.disabled=false;E.say("Pas d’internet.");});
  }

  /* ---------- Rentrée : élèves au niveau suivant (supabase/rentree-v61.sql) ---------- */
  function rtaYears(){var y=+E.schoolYear().slice(0,4);return[(y-1)+"-"+y,y+"-"+(y+1)];}
  function rtaInit(){
    if(RTA.year)return;
    var ys=rtaYears(),m=new Date().getMonth();   /* de septembre à décembre, la rentrée porte sur l’année qui vient de finir */
    RTA.year=(m>=8&&m<=11)?ys[0]:ys[1];
  }
  function rtaLoad(){
    if(RTA.loading)return;
    RTA.loading=true;
    var yr=RTA.year,out={};
    /* décisions de l'année choisie, par pages de 1 000 lignes (le serveur n'en rend pas davantage d'un coup) */
    (function page(from){
      sb.from("registry_decisions").select("student_id,decision").eq("year",yr).range(from,from+999).then(function(r){
        if(r.error){RTA.loading=false;RTA.dmap={};RTA.list=[];RTA.err=E.frErr(r.error);E.render();return;}
        (r.data||[]).forEach(function(d){out[d.student_id]=d.decision;});
        if((r.data||[]).length===1000){page(from+1000);return;}
        sb.rpc("rentrees_liste",{p_etab:E.ET.id}).then(function(a){
          RTA.loading=false;
          if(yr!==RTA.year){rtaLoad();return;}
          RTA.dmap=out;RTA.err="";RTA.missing=!!a.error;RTA.list=a.error?[]:(a.data||[]);E.render();
        },function(){RTA.loading=false;});
      },function(){RTA.loading=false;});
    })(0);
  }
  function rtaPlan(m){
    var by={},plan={moves:[],unknown:[],movers:0,stay:0,pend:0},lyc=false;
    E.rows.forEach(function(r){var k=r.class_label||"";(by[k]=by[k]||[]).push(r);if(nivIsLycee(k))lyc=true;});
    if(RTA.last3===null)RTA.last3=!lyc;
    Object.keys(by).sort().forEach(function(k){
      var info=nivNext(k,{last3:RTA.last3}),mv=[],stay=0,pend=0;
      by[k].forEach(function(r){
        var d=RTA.dmap&&RTA.dmap[r.id];
        if(!d&&RTA.inc&&m&&RTA.year===E.schoolYear()){var f=finDec(m,r.id);d=f&&f.auto;}
        if(d==="p")mv.push(r.id);else if(d==="r")stay++;else pend++;
      });
      if(!info.known){if(k&&!/^Sortis /i.test(k))plan.unknown.push(k);return;}
      plan.stay+=stay;plan.pend+=pend;
      if(!mv.length)return;
      plan.moves.push({from:k,to:info.last?"Sortis "+RTA.year:info.next,ids:mv,n:mv.length,stay:stay,pend:pend,last:info.last});
      plan.movers+=mv.length;
    });
    return plan;
  }
  function ren(){
    rtaInit();
    if(RTA.dmap===null){if(!RTA.loading)rtaLoad();return'<p class="sub">Chargement…</p>';}
    var ys=rtaYears(),plan=rtaPlan(M),act=(RTA.list||[]).filter(function(x){return x.year===RTA.year&&!x.annule;})[0];
    var h='<div class="card">'+
      (RTA.err?'<p class="sub" style="margin:0 0 8px">Décisions indisponibles ('+esc(RTA.err)+') : le passage ne peut pas être préparé. Rechargez la page ou exécutez <b>supabase/vie-scolaire-admin.sql</b> dans Supabase.</p>':'')+
      (RTA.missing?'<p class="sub" style="margin:0 0 8px">Exécutez d’abord <b>supabase/rentree-v61.sql</b> dans Supabase pour activer le passage.</p>':'')+
      '<h2>Rentrée : passage au niveau suivant</h2>'+
      '<label for="rtay">Année terminée</label><select id="rtay">'+ys.map(function(y){return'<option value="'+y+'"'+(y===RTA.year?" selected":"")+'>'+y+'</option>';}).join("")+'</select>'+
      '<p class="sub" style="margin:8px 0">Les élèves dont la décision est « passe » montent d’un niveau (6e B → 5e B). Les redoublants restent dans leur classe. Les décisions « à examiner » ou absentes ne bougent pas. Les élèves de la dernière classe passent en « Sortis '+esc(RTA.year)+' ».</p>'+
      '<label class="rtk"><input type="checkbox" id="rtal3"'+(RTA.last3?" checked":"")+'> La 3e est la dernière classe de l’établissement (sinon : 2nde)</label>'+
      (RTA.year===E.schoolYear()&&M?'<label class="rtk"><input type="checkbox" id="rtain"'+(RTA.inc?" checked":"")+'> Inclure aussi les propositions non confirmées</label>':'');
    if(RTA.err){/* pas de plan sans les décisions */}
    else if(!plan.moves.length)h+='<p class="sub" style="margin:8px 0 0">Aucun élève à faire passer pour '+esc(RTA.year)+' : confirmez d’abord les décisions « passe » dans l’onglet Décisions.</p>';
    else h+='<div class="scroll"><table class="rtt"><tr><th>Classe</th><th>Devient</th><th>Passent</th><th>Restent</th><th>À voir</th></tr>'+
      plan.moves.map(function(m){return'<tr><td>'+esc(m.from||"(sans classe)")+'</td><td>'+esc(m.to)+'</td><td>'+m.n+'</td><td>'+m.stay+'</td><td>'+m.pend+'</td></tr>';}).join("")+'</table></div>';
    if(plan.unknown.length)h+='<p class="sub" style="margin:8px 0 0">Niveau non reconnu (non déplacées) : '+plan.unknown.map(esc).join(", ")+'.</p>';
    if(act)h+='<p class="sub" style="margin:10px 0 6px"><b>Rentrée déjà appliquée</b> ('+pl(act.nb,"élève","élèves")+').</p><div class="bs"><button class="btn ghost" id="rtaundo">Annuler ce passage</button></div>';
    else if(plan.moves.length)h+='<p class="sub" style="margin:10px 0 0">Avant le passage, un fichier de sauvegarde des classes actuelles est téléchargé. Le passage peut aussi être annulé ensuite.</p><div class="bs" style="margin-top:10px"><button class="btn" id="rtaapply">Appliquer le passage ('+pl(plan.movers,"élève","élèves")+')</button></div>';
    return h+'</div>';
  }
  /* Sauvegarde : la classe de chaque élève avant le passage, et la nouvelle classe de ceux qui montent */
  function rtaBackup(plan){
    var to={};plan.moves.forEach(function(m){m.ids.forEach(function(i){to[i]=m.to;});});
    var body=E.rows.map(function(r){return[r.name,r.class_label||"",to[r.id]||""];});
    E.download("sauvegarde-classes-avant-rentree-"+RTA.year+".csv",E.tblCsv({head:["Élève","Classe actuelle","Nouvelle classe"],body:body}),"Gardez ce fichier : il permet de retrouver les classes d’origine.");
  }
  function rtaApply(){
    var plan=rtaPlan(M);
    if(!plan.moves.length)return;
    if(!confirm("Appliquer le passage de "+pl(plan.movers,"élève","élèves")+" au niveau suivant ? Un fichier de sauvegarde des classes sera d’abord téléchargé. Vous pourrez aussi annuler le passage ensuite."))return;
    rtaBackup(plan);
    E.call("appliquer_rentree",{p_etab:E.ET.id,p_year:RTA.year,p_moves:plan.moves.map(function(m){return{from:m.from,to:m.to,ids:m.ids};})},function(d){
      load();E.say((d.n||0)+" élève(s) passé(s) au niveau suivant.");
    });
  }
  function rtaUndo(){
    if(!confirm("Annuler le passage ? Chaque élève retrouve sa classe d’origine (s’il n’a pas changé de classe depuis)."))return;
    E.call("annuler_rentree",{p_etab:E.ET.id,p_year:RTA.year},function(d){
      load();E.say((d.n||0)+" élève(s) remis dans leur classe.");
    });
  }

  /* ---------- Contenu ---------- */
  function render(){
    if(!loaded)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    if(loadErr)return'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>';
    var h=ptab();
    if(!E.rows.length)return h+'<div class="card"><h2>Aucun élève pour le moment</h2><p class="sub" style="margin:0">Ajoutez ou importez vos élèves dans la rubrique « Classes » : les bulletins, les décisions et la rentrée apparaîtront ici.</p><div class="bs"><a class="btn" href="'+esc(E.href("classes"))+'" style="text-decoration:none">Ouvrir « Classes »</a></div></div>';
    if(dash&&!dash.err&&dash.length&&!M)M=E.model(E.rows,dash);
    if(tab==="ren")return h+ren();
    return h+'<section class="card">'+(tab==="dec"?decis():bul())+'</section>';
  }

  function setTab(t){
    if(t===tab)return;
    tab=t;try{history.replaceState(null,"","#"+HASH[t]);}catch(e){}
    keep(E.render);
  }

  /* Boutons de l'onglet affiché, puis graphique */
  function after(v){
    Array.prototype.forEach.call(v.querySelectorAll("[data-vue]"),function(b){b.onclick=function(){setTab(b.getAttribute("data-vue"));};});
    Array.prototype.forEach.call(v.querySelectorAll("[data-per]"),function(b){b.onclick=function(){dper=b.getAttribute("data-per");keep(E.render);};});
    Array.prototype.forEach.call(v.querySelectorAll("[data-fcl]"),function(b){b.onclick=function(){fcl=b.getAttribute("data-fcl").slice(1);keep(E.render);};});
    var fs=document.getElementById("fsel");if(fs)fs.onchange=function(){fcl=fs.value==="#none"?null:fs.value.slice(1);keep(E.render);};
    var th=document.getElementById("thr");if(th)th.onchange=function(){var x=parseFloat(th.value);if(x>=5&&x<=15){thr=x;try{localStorage.setItem("cm-seuil",String(x));}catch(e){}}keep(E.render);};
    Array.prototype.forEach.call(v.querySelectorAll("[data-dec]"),function(s){s.onchange=function(){saveDec(s);};});
    ["x-ec","x-ep","x-cc","x-cp"].forEach(function(id){var b=document.getElementById(id);if(b)b.onclick=function(){exportFin(id);};});
    var ry=document.getElementById("rtay"),r3=document.getElementById("rtal3"),ri=document.getElementById("rtain"),ra=document.getElementById("rtaapply"),ru=document.getElementById("rtaundo");
    if(ry)ry.onchange=function(){RTA.year=ry.value;RTA.dmap=null;RTA.list=null;E.render();};
    if(r3)r3.onchange=function(){RTA.last3=!!r3.checked;keep(E.render);};
    if(ri)ri.onchange=function(){RTA.inc=!!ri.checked;keep(E.render);};
    if(ra)ra.onclick=rtaApply;
    if(ru)ru.onclick=rtaUndo;
    if(tab!=="dec"||!M||!GF||typeof geDraw!=="function")return;
    try{geDraw({M:M,rows:E.rows,TH:E.TH,tch:Array.isArray(tch)?tch:null,dsc:Array.isArray(dsc)?dsc:null,fin:GF,sortCls:E.sortCls,lvl:E.lvl,lvlRank:E.lvlRank,pc:E.pc,mean:E.mean,get:E.get,stat:E.tstat,tname:E.tname,dstrOf:E.dstrOf});}catch(e){}
  }

  window.addEventListener("hashchange",function(){var t=fromHash();if(t)setTab(t);});

  E.start({page:"fin",load:load,reset:reset,render:render,after:after,onMembres:function(){}});
})();

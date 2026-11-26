/* Page « Accueil » de l'établissement (v89) : indicateurs, alertes à traiter, vue par classe, élèves à surveiller, enseignants à relancer.
   Reprise de l'onglet « Aperçu » de l'ancienne page de gestion (remplacée par une redirection depuis la v94), sur le socle commun js/etab-core.js. */
(function(){
  var E=Etab,esc=E.esc,dash=null,tch=null,dsc=null,loaded=false,loadErr="",M=null;

  function reset(){dash=null;tch=null;dsc=null;loaded=false;loadErr="";M=null;}

  /* ---------- Chargement : les élèves d'abord, puis les suivis en parallèle ---------- */
  function load(){
    reset();
    /* pas de code secret ici : seuls l'identité et la classe sont demandés */
    E.loadStudents("id,name,class_label,ref,created_at",function(rows,err){
      if(err){loadErr=E.fail(err);loaded=true;E.render();return;}
      loaded=true;E.render();
      E.loadDash(function(d,e){dash=e?{err:E.frErr(e)}:d;M=null;E.render();});
      E.loadTeaching(function(d,e){tch=e?{err:E.frErr(e)}:d;E.render();});
      E.loadDiscipline(function(d,e){dsc=e?{err:E.frErr(e)}:d;E.render();});
    });
  }

  /* ---------- Alertes : ce qui demande une action, avec le lien vers la rubrique concernée ---------- */
  function alertes(m){
    var a=[],lim=E.dstrOf(Date.now()-30*864e5),p=E.pending();
    if(p)a.push(["enseignants",E.plural(p,"demande d’enseignant en attente","demandes d’enseignants en attente")]);
    if(Array.isArray(tch)){
      var n=tch.filter(function(g){return E.tstat(g)==="miss";}).length;if(n)a.push(["enseignants",E.plural(n,"appel non fait","appels non faits")+" aujourd’hui"]);
      var l=tch.reduce(function(s,g){return s+E.evLate(g).length;},0);if(l)a.push(["enseignants",E.plural(l,"évaluation en retard","évaluations en retard")]);
    }
    if(m){var dc=m.ids.filter(function(i){return m.S[i].ra>=E.TH.abs;}).length;if(dc)a.push(["resultats",E.plural(dc,"élève à risque de décrochage","élèves à risque de décrochage"),"#ass"]);}
    if(Array.isArray(dsc)){var g=dsc.filter(function(x){return x.k==="grv"&&x.d>=lim&&E.get(x.student_id);}).length;if(g)a.push(["vie",E.plural(g,"incident grave (30 j)","incidents graves (30 j)")]);}
    if(!a.length)return"";
    return'<div class="al" role="status"><b>À traiter</b>'+a.map(function(x){var h=E.href(x[0]);if(h&&x[2])h+=x[2];return h?'<a class="btn ghost" href="'+esc(h)+'">'+esc(x[1])+' →</a>':'<span class="tg bad">'+esc(x[1])+'</span>';}).join("")+'</div>';
  }

  function classesOf(rows){var o={};rows.forEach(function(r){o[r.class_label||""]=1;});return Object.keys(o);}

  /* ---------- Contenu ---------- */
  function render(){
    var rows=E.rows,TH=E.TH;
    if(!loaded)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    if(loadErr)return'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>'+alertes(null);
    if(!rows.length)return alertes(null)+'<div class="card"><h2>Aucun élève pour le moment</h2><p class="sub" style="margin:0">Ajoutez ou importez vos élèves dans la rubrique « Classes » : les indicateurs apparaîtront ici dès que les enseignants publieront leurs suivis.</p>'+(E.href("classes")?'<div class="bs"><a class="btn" href="'+esc(E.href("classes"))+'" style="text-decoration:none">Ouvrir « Classes »</a></div>':"")+'</div>';
    if(dash&&!dash.err&&dash.length&&!M)M=E.model(rows,dash);
    var h=alertes(M),ncl=classesOf(rows).length;
    if(!M){
      h+='<div class="kpis">'+E.kp(rows.length,"élèves")+E.kp(ncl,"classes")+E.kp(E.MEM.filter(function(m){return m.role!=="admin"&&m.statut!=="en_attente";}).length,"enseignants inscrits")+'</div>';
      if(dash===null)return h+'<p class="sub">Chargement des statistiques…</p>';
      if(dash.err)return h+'<p class="sub">Statistiques indisponibles ('+esc(dash.err)+'). Exécutez <b>supabase/tableau-bord-admin.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.</p>';
      return h+'<p class="sub">Aucun enseignant n’a encore publié de suivi pour vos élèves. Les statistiques apparaîtront ici dès les premières publications.</p>';
    }
    var tn=Object.keys(M.T).length,p=E.pc(M.N,M.A);
    h+='<div class="kpis">'+E.kp(rows.length,"élèves")+E.kp(ncl,"classes")+E.kp(tn,"enseignant"+(tn>1?"s":"")+" actif"+(tn>1?"s":""))+E.kp(Math.round(M.ids.length/rows.length*100)+" %","élèves suivis")+E.kp(p===null?"–":E.nf1(p)+" %","présence")+E.kp(E.nf1(M.gm),"moyenne /20")+'</div>';
    h+='<p class="sub">D’après les suivis publiés par les enseignants · dernière mise à jour '+esc(E.ago(M.last))+'.</p>';
    h+='<div class="gr ge" id="ge" data-t="apercu"></div>';
    h+='<h3 class="dh">Par classe</h3>';
    Object.keys(M.C).sort(E.sortCls).forEach(function(k){var c=M.C[k],q=E.pc(c.n,c.a);
      h+=E.dr(k||"(sans classe)",c.eff+" élève"+(c.eff>1?"s":"")+" · présence "+(q===null?"–":E.nf1(q)+" %")+" · moyenne "+E.nf1(E.mean(c.m)),c.fol+"/"+c.eff+" suivis",E.href("classes",{c:k}),c.fol>=c.eff);});
    var risk=M.ids.filter(function(i){var s=M.S[i],q=E.pc(s.n,s.a);return(s.m!==null&&s.m<TH.moy)||(q!==null&&q<TH.pres);}).sort(function(x,y){return(M.S[x].m===null?99:M.S[x].m)-(M.S[y].m===null?99:M.S[y].m);});
    h+='<h3 class="dh">À surveiller</h3>';
    if(!risk.length)h+='<p class="sub">Aucun élève sous '+E.nf1(TH.moy)+' de moyenne ou sous '+E.nf1(TH.pres)+' % de présence.</p>';
    else{
      risk.slice(0,5).forEach(function(i){var s=M.S[i],r=M.byId[i],q=E.pc(s.n,s.a);
        h+=E.dr(r.name,(r.class_label||"(sans classe)")+" · moyenne "+E.nf1(s.m)+" · présence "+(q===null?"–":E.nf1(q)+" %"),s.m!==null&&s.m<TH.moy?"moyenne":"absences",undefined,true);});
      if(risk.length>5){var hr=E.href("resultats");h+='<p class="sub">+ '+(risk.length-5)+' autre'+(risk.length-5>1?"s":"")+'.'+(hr?' <a href="'+esc(hr)+'">Voir les résultats et l’assiduité</a>.':"")+'</p>';}
    }
    h+='<h3 class="dh">Enseignants</h3>';
    Object.keys(M.T).map(function(k){return M.T[k];}).sort(function(x,y){return(x.last||"")<(y.last||"")?-1:1;}).forEach(function(t){
      var old=!t.last||(Date.now()-new Date(t.last).getTime())>14*864e5,cl=Object.keys(t.cls);
      h+=E.dr(t.name,Object.keys(t.subj).join(", ")+" · "+cl.length+" classe"+(cl.length>1?"s":""),(old?"pas de mise à jour · ":"")+E.ago(t.last),undefined,old);});
    return h;
  }

  /* Les graphiques sont dessinés après chaque affichage (la bibliothèque js/graph-etab.js est facultative) */
  function after(){
    if(!M||typeof geDraw!=="function")return;
    try{geDraw({M:M,rows:E.rows,TH:E.TH,tch:Array.isArray(tch)?tch:null,dsc:Array.isArray(dsc)?dsc:null,fin:null,sortCls:E.sortCls,lvl:E.lvl,lvlRank:E.lvlRank,pc:E.pc,mean:E.mean,get:E.get,stat:E.tstat,tname:E.tname,dstrOf:E.dstrOf});}catch(e){}
  }

  E.start({page:"accueil",load:load,reset:reset,render:render,after:after,onMembres:function(){}});
})();

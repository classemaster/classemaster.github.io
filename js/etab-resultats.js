/* Page « Résultats et assiduité » de l'établissement (v91) : moyennes, réussite, matières, évolution par trimestre, élèves en difficulté ;
   présence par classe, absences non justifiées, risque de décrochage, retards répétés.
   Reprise des onglets « Résultats » et « Assiduité » de l'ancienne page de gestion (remplacée par une redirection depuis la v94), sur le socle commun js/etab-core.js.
   Filtres (v95) : classe, matière et enseignant ; ils s'appliquent aux deux onglets et aux graphiques.
   Lecture seule : aucune écriture, aucun code secret demandé. Adresses : etab-resultats.html (Résultats), #ass (Assiduité). */
(function(){
  var E=Etab,esc=E.esc,pl=E.plural,dash=null,loaded=false,loadErr="",M=null,tab="res";
  var FL=E.filters(function(){return Array.isArray(dash)?dash:[];}),fr=FL.fr,NOTCH=FL.NOTCH;

  /* la page s'ouvre sur l'onglet demandé par l'adresse (#res ou #ass) */
  function fromHash(){var h=String(location.hash||"").slice(1);return h==="ass"||h==="res"?h:null;}
  tab=fromHash()||tab;

  function reset(){dash=null;loaded=false;loadErr="";M=null;FL.reset();}

  /* ---------- Chargement : les élèves d'abord, puis les suivis publiés ---------- */
  function load(){
    reset();
    /* pas de code secret ici : seuls l'identité et la classe sont demandés */
    E.loadStudents("id,name,class_label,ref",function(rows,err){
      if(err){loadErr=E.fail(err);loaded=true;E.render();return;}
      loaded=true;E.render();
      E.loadDash(function(d,e){dash=e?{err:E.frErr(e)}:d;M=null;FL.reset();E.render();});
    });
  }

  /* ---------- Petits morceaux communs ---------- */
  function ptab(){
    return'<section class="card"><div class="tb2 wrap" role="tablist" aria-label="Résultats ou assiduité">'+[["res","Résultats"],["ass","Assiduité"]].map(function(t){
      return'<button type="button" role="tab" class="btn'+(tab===t[0]?"":" ghost")+'" aria-selected="'+(tab===t[0])+'" data-vue="'+t[0]+'">'+t[1]+'</button>';}).join("")+'</div></section>';
  }
  /* Emplacement des graphiques : avant la première liste de l'onglet ; geDraw le remplit ensuite */
  function geWrap(b){var i=b.indexOf('<h3 class="dh"'),ph='<div class="gr ge" id="ge" data-t="'+tab+'"></div>';return i<0?b+ph:b.slice(0,i)+ph+b.slice(i);}
  /* Ligne de classe avec barre ; elle ouvre la classe dans la rubrique « Classes » */
  function crow(k,tag,bad,small,pct){
    var hr=k?E.href("classes",{c:k}):E.href("classes");
    return'<a class="dr" href="'+esc(hr)+'" style="display:block"><span style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(k||"(sans classe)")+'</b><span class="tg'+(bad?" bad":" ok")+'">'+tag+'</span></span><small>'+small+'</small>'+E.pbar(pct,bad)+'</a>';
  }
  function more(n,what){return n>0?'<p class="sub">+ '+n+' autre'+(n>1?"s":"")+(what?". "+what:".")+'</p>':"";}
  function nobody(txt){return'<p class="sub">'+txt+'</p>';}

  /* ---------- Assiduité : présence par classe, absences non justifiées, retards répétés, décrochage ---------- */
  function ass(M){
    var TH=E.TH,nj=0,rt=0;
    M.ids.forEach(function(i){var s=M.S[i];nj+=Math.max(0,s.a-s.j);rt+=s.r;});
    var dec=M.ids.filter(function(i){return M.S[i].ra>=TH.abs;}).sort(function(x,y){return M.S[y].ra-M.S[x].ra;}),
        rep=M.ids.filter(function(i){return M.S[i].r>=3;}).sort(function(x,y){return M.S[y].r-M.S[x].r;}),
        p=E.pc(M.N,M.A);
    var h='<div class="kpis">'+E.kp(p===null?"–":E.nf1(p)+" %","présence")+E.kp(M.A,"absences")+E.kp(nj,"non justifiées")+E.kp(rt,"retards")+E.kp(dec.length,"à risque de décrochage")+'</div>';
    h+='<p class="sub">Cumul des matières publiées par les enseignants · dernière mise à jour '+esc(E.ago(M.last))+'.</p><h3 class="dh">Présence par classe</h3>';
    var ks=Object.keys(M.C).filter(function(k){return M.C[k].n>0;}).sort(function(a,b){return E.pc(M.C[a].n,M.C[a].a)-E.pc(M.C[b].n,M.C[b].a);});
    h+=ks.length?ks.map(function(k){
      var c=M.C[k],q=E.pc(c.n,c.a),njc=Math.max(0,c.a-c.j);
      return crow(k,E.nf1(q)+" %",q<85,c.a+" abs. dont "+pl(njc,"non justifiée","non justifiées")+" · "+pl(c.r,"retard","retards"),q);
    }).join(""):nobody("Pas encore d’appel publié.");
    h+='<h3 class="dh">Risque de décrochage</h3><p class="sub">'+pl(TH.abs,"absence","absences")+' ou plus sur les 14 derniers jours.</p>';
    h+=dec.length?dec.slice(0,8).map(function(i){var r=M.byId[i];return E.dr(r.name,(r.class_label||"(sans classe)")+" · "+pl(M.S[i].a,"absence","absences")+" au total",M.S[i].ra+" récentes",undefined,true);}).join(""):nobody("Aucun élève concerné.");
    h+=more(dec.length-8);
    h+='<h3 class="dh">Retards répétés</h3><p class="sub">3 retards ou plus.</p>';
    h+=rep.length?rep.slice(0,8).map(function(i){var r=M.byId[i];return E.dr(r.name,r.class_label||"(sans classe)",M.S[i].r+" retards",undefined,true);}).join(""):nobody("Aucun élève concerné.");
    h+=more(rep.length-8);
    return h;
  }

  /* ---------- Résultats : moyennes, réussite, matières, évolution par trimestre, élèves en difficulté ---------- */
  function res(M){
    var TH=E.TH,ok=M.means.filter(function(m){return m>=TH.moy;}).length,tx=M.means.length?ok/M.means.length*100:null,
        cm=Object.keys(M.C).map(function(k){return{k:k,m:E.mean(M.C[k].m)};}).filter(function(x){return x.m!==null;}).sort(function(a,b){return b.m-a.m;});
    var h='<div class="kpis">'+E.kp(E.nf1(M.gm),"moyenne /20")+E.kp(tx===null?"–":Math.round(tx)+" %","réussite (≥ "+E.nf1(TH.moy)+")")+E.kp(M.means.length-ok,"sous "+E.nf1(TH.moy))+E.kp(cm.length>1?E.nf1(cm[0].m-cm[cm.length-1].m):"–","écart entre classes")+'</div>';
    h+='<p class="sub">Moyennes des élèves, toutes matières publiées confondues · dernière mise à jour '+esc(E.ago(M.last))+'.</p><h3 class="dh">Par classe</h3>';
    h+=cm.length?cm.map(function(x){
      var c=M.C[x.k],o=c.m.filter(function(m){return m>=TH.moy;}).length,t=c.m.length?Math.round(o/c.m.length*100):0;
      return crow(x.k,E.nf1(x.m)+" / 20",x.m<TH.moy,"réussite "+t+" % · "+pl(c.m.length,"élève noté","élèves notés"),x.m/20*100);
    }).join(""):nobody("Pas encore de notes publiées.");
    var sk=Object.keys(M.SJ).sort(function(a,b){return E.mean(M.SJ[b].v)-E.mean(M.SJ[a].v);});
    h+='<h3 class="dh">Par matière</h3>';
    h+=sk.length?sk.map(function(k){var o=M.SJ[k],m=E.mean(o.v);return E.dr(k==="—"?"(sans matière)":k,pl(o.v.length,"moyenne","moyennes")+" · réussite "+Math.round(o.ok/o.v.length*100)+" %",E.nf1(m)+" / 20",undefined,m<TH.moy?true:undefined);}).join(""):nobody("Aucune matière notée.");
    h+="\u0002X";
    h+='<h3 class="dh">Évolution par trimestre</h3><p class="sub">Moyenne des évaluations : T1 sept.–déc., T2 janv.–mars, T3 avril–été.</p>';
    var ev=Object.keys(M.C).sort(E.sortCls).filter(function(k){return M.C[k].t.some(function(a){return a.length;});});
    h+=ev.length?ev.map(function(k){
      var t=M.C[k].t.map(E.mean),ar="",q=t.filter(function(x){return x!==null;});
      if(q.length>1)ar=q[q.length-1]>q[0]+0.2?"▲":q[q.length-1]<q[0]-0.2?"▼":"=";
      return E.dr(k||"(sans classe)",["T1","T2","T3"].map(function(l,j){return l+" "+E.nf1(t[j]);}).join(" · "),ar,undefined,ar==="▼"?true:ar==="▲"?false:undefined);
    }).join(""):nobody("Pas encore d’évaluations datées.");
    var dif=M.ids.filter(function(i){return M.S[i].m!==null&&M.S[i].m<TH.moy;}).sort(function(x,y){return M.S[x].m-M.S[y].m;});
    h+='<h3 class="dh">Élèves en difficulté</h3><p class="sub">Moyenne inférieure à '+E.nf1(TH.moy)+'.</p>';
    h+=dif.length?dif.slice(0,10).map(function(i){var r=M.byId[i];return E.dr(r.name,r.class_label||"(sans classe)",E.nf1(M.S[i].m)+" / 20",undefined,true);}).join(""):nobody("Aucun élève sous "+E.nf1(TH.moy)+" de moyenne.");
    h+=more(dif.length-10,"Ouvrez la classe concernée.");
    return h;
  }


  /* ---------- v96 : classe × matière, et provenance des données ---------- */
  /* Moyenne des élèves pour chaque couple classe / matière (même source que « Par matière ») */
  function cross(v){
    var by={},CS={},ks={},ss={};
    v.rows.forEach(function(r){by[r.id]=r;});
    v.dash.forEach(function(d){
      var r=by[d.student_id];if(!r||d.avg===null||d.avg===undefined)return;
      var k=r.class_label||"",sj=d.subj||"—";ks[k]=1;ss[sj]=1;
      ((CS[k]=CS[k]||{})[sj]=CS[k][sj]||[]).push(+d.avg);
    });
    return{CS:CS,cls:Object.keys(ks).sort(E.sortCls),subj:Object.keys(ss).sort(fr)};
  }
  function crossHtml(v){
    var X=cross(v),TH=E.TH;
    if(!X.cls.length||!X.subj.length)return"";
    var h='<h3 class="dh">Classe × matière</h3><p class="sub">Moyenne /20 des élèves notés ; en rouge sous '+E.nf1(TH.moy)+'. Touchez une classe pour l’ouvrir.</p><div class="xwrap" style="overflow-x:auto"><table class="xtab" id="xtab"><thead><tr><th>Classe</th>'+
      X.subj.map(function(x){return'<th>'+esc(x==="—"?"(sans matière)":x)+'</th>';}).join("")+'</tr></thead><tbody>';
    X.cls.forEach(function(k){
      h+='<tr><th scope="row"><a href="'+esc(E.href("classes",{c:k}))+'">'+esc(k||"(sans classe)")+'</a></th>'+X.subj.map(function(x){
        var a=X.CS[k]&&X.CS[k][x];if(!a||!a.length)return'<td class="xe">–</td>';
        var m=E.mean(a);return'<td class="'+(m<TH.moy?"xb":"xo")+'" title="'+esc(pl(a.length,"élève noté","élèves notés"))+'">'+E.nf1(m)+'</td>';}).join("")+'</tr>';
    });
    return h+'</tbody></table></div>';
  }
  /* Une ligne par matière et enseignant : nombre de suivis, classes concernées, dernière publication */
  function provHtml(v){
    var G={},by={};
    v.rows.forEach(function(r){by[r.id]=r;});
    v.dash.forEach(function(d){
      var sj=d.subj||"—",tc=d.teacher||NOTCH,key=sj+"\u0001"+tc,g=G[key]||(G[key]={sj:sj,tc:tc,n:0,cls:{},last:""});
      g.n++;g.cls[(by[d.student_id]&&by[d.student_id].class_label)||"(sans classe)"]=1;if(d.updated_at&&d.updated_at>g.last)g.last=d.updated_at;
    });
    var L=Object.keys(G).map(function(k){return G[k];}).sort(function(a,b){return fr(a.sj,b.sj)||fr(a.tc,b.tc);});
    if(!L.length)return"";
    var old=Date.now()-30*864e5;
    return'<details class="card" id="prov"><summary style="font-weight:700;cursor:pointer">Provenance des données</summary><p class="sub">Ce que chaque enseignant a publié. En rouge : rien depuis plus de 30 jours.</p>'+L.map(function(g){
      var stale=!g.last||new Date(g.last).getTime()<old;
      return E.dr((g.sj==="—"?"(sans matière)":g.sj)+" · "+g.tc,pl(g.n,"suivi d’élève","suivis d’élèves")+" · "+Object.keys(g.cls).sort(E.sortCls).join(", "),E.ago(g.last),undefined,stale?true:undefined);
    }).join("")+'</details>';
  }

  /* ---------- Contenu ---------- */
  function render(){
    var rows=E.rows;
    if(!loaded)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    if(loadErr)return'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>';
    if(!rows.length)return'<div class="card"><h2>Aucun élève pour le moment</h2><p class="sub" style="margin:0">Ajoutez ou importez vos élèves dans la rubrique « Classes » : les résultats et l’assiduité apparaîtront dès que les enseignants publieront leurs suivis.</p><div class="bs"><a class="btn" href="'+esc(E.href("classes"))+'" style="text-decoration:none">Ouvrir « Classes »</a></div></div>';
    var h=ptab();
    if(dash===null)return h+'<p class="sub">Chargement des statistiques…</p>';
    if(dash.err)return h+'<p class="sub">Statistiques indisponibles ('+esc(dash.err)+'). Exécutez <b>supabase/tableau-bord-admin.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.</p>';
    if(!dash.length)return h+'<p class="sub">Aucun enseignant n’a encore publié de suivi pour vos élèves. Les statistiques apparaîtront ici dès les premières publications.</p>';
    var o=FL.options();FL.check(o);h+=FL.bar(o);
    var v=FL.view();
    if(!v.dash.length)return h+FL.note()+'<p class="sub" id="rf-none">Aucune donnée publiée pour ces filtres.</p>';
    if(!M)M=E.model(v.rows,v.dash);
    var body=tab==="ass"?ass(M):res(M).replace("\u0002X",crossHtml(v));
    return h+FL.note()+(tab==="res"?FL.generalNote():"")+geWrap(body)+provHtml(v);
  }

  function setTab(t){
    if(t===tab)return;
    tab=t;try{history.replaceState(null,"","#"+t);}catch(e){}
    var y=window.scrollY;E.render();window.scrollTo(0,y);
  }

  /* Boutons des onglets, puis graphiques (la bibliothèque js/graph-etab.js est facultative) */
  function after(v){
    Array.prototype.forEach.call(v.querySelectorAll("[data-vue]"),function(b){b.onclick=function(){setTab(b.getAttribute("data-vue"));};});
    FL.bind(function(){M=null;E.render();});
    if(!M||typeof geDraw!=="function")return;
    try{geDraw({M:M,scope:FL.scope(),rows:FL.view().rows,TH:E.TH,tch:null,dsc:null,fin:null,sortCls:E.sortCls,lvl:E.lvl,lvlRank:E.lvlRank,pc:E.pc,mean:E.mean,get:E.get,stat:E.tstat,tname:E.tname,dstrOf:E.dstrOf});}catch(e){}
  }

  window.addEventListener("hashchange",function(){var t=fromHash();if(t)setTab(t);});

  E.start({page:"resultats",load:load,reset:reset,render:render,after:after,onMembres:function(){}});
})();

/* « Relevé de notes » en A4 paysage (modèle de cahier) à imprimer.
   Étape 1 : cadre (titre, ligne d’informations, tableau quadrillé), élèves numérotés dans l’ordre alphabétique,
   en-tête répété à chaque page.
   Étape 2 : colonne de devoir placée avant « Moyenne », avec les notes déjà saisies.
   Étape 3 : une colonne par devoir réellement saisi (au moins une note) dans la période choisie, du plus ancien au plus récent.
   Étape 6bis : la colonne Moyenne et la colonne Observations (appréciation) sont remplies ; l’en-tête d’un devoir ne porte que son titre.
   Étape 6 : les compositions viennent après les devoirs (en-tête teinté, filet plus épais avant la première), seulement s’il y en a.
   Étape 7 : colonne « Place » (rang dans la classe, ex æquo = même rang) après Moyenne, si l’option « Inclure les places » est cochée ;
   l’option « Inclure les compositions » (cochée par défaut) retire ou garde les colonnes de compositions. Options : {places:bool, comps:bool}.
   Étape 8 : grilles d’appréciation du maître (sur 20 et sur 10) et de l’enseignant (sur 10), d’après la fiche de l’établissement ; branchées à l’étape 9.
   Étape 9 : la colonne Observations utilise la grille du barème des copies de la période : sur 10 si toutes les évaluations sont sur 10
   (moyenne affichée sur 10, appréciation du maître + appréciation de l’enseignant), sinon sur 20 (grille du maître seule).
   Étape 10 : en-tête à remplir — établissement, matière, enseignant(e) viennent de l’appli ; un champ vide devient une ligne « ______ » à remplir à la main
   (année scolaire, classe et effectif sont toujours calculés).
   Étape 11 : options {tous:true} (trois sections, Trimestre 1, 2 puis 3, chacune avec son en-tête et ses feuillets, numérotation des pages continue)
   et {vierge:true} (cahier vierge : élèves numérotés, 8 colonnes de devoir vides, Moyenne / Place / Observations vides).
   Étape 4 : largeurs — « Observations » prend la place restante ; les colonnes de devoir se resserrent jusqu’à 8 ;
   au-delà de 8 devoirs, la suite passe sur un nouveau feuillet (mêmes élèves, mêmes numéros). */
var RC={W:842,H:595,M:30,rowH:21,headH:22,maxDev:8,compFill:"0.82 0.87 0.95",devW:60,devMin:39,nomW:210,moyW:70,nW:34,plW:46};
function rcLine(x1,y1,x2,y2,w){return"0.25 0.28 0.33 RG "+(w||0.6)+" w "+x1+" "+y1+" m "+x2+" "+y2+" l S\n0 G\n";}
/* Élèves dans l’ordre alphabétique (accents et majuscules ignorés), numéros 1, 2, 3… */
function rcEleves(c){
  return c.students.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name),"fr",{sensitivity:"base"})||(a.id<b.id?-1:1);});
}
/* Évaluations de la période (1, 2, 3, ou toutes si p n’est pas un numéro) qui ont au moins une note :
   d’abord les devoirs, du plus ancien au plus récent, puis — seulement s’il y en a — les compositions, dans le même ordre. */
function rcOpt(o){o=o||{};return{places:!!o.places,comps:o.comps!==false,tous:!!o.tous,vierge:!!o.vierge};}
/* Cahier vierge : 8 colonnes de devoir vides (sans titre) à remplir à la main */
function rcBlancs(){var a=[],i;for(i=0;i<RC.maxDev;i++)a.push({id:"v"+i,t:"",s:{}});return a;}
function rcDevoirs(c,p,o){
  var op=rcOpt(o);
  return evs(c).filter(function(e){return(typeof p!=="number"||trOf(e)===p)&&(op.comps||!evIsComp(e))&&e.s&&Object.keys(e.s).some(function(k){return typeof e.s[k]==="number";});})
    .sort(function(a,b){return(evIsComp(a)?1:0)-(evIsComp(b)?1:0)||(a.d<b.d?-1:a.d>b.d?1:(a.id<b.id?-1:1));});
}
/* Largeur d’une colonne de devoir quand il y en a n sur le feuillet : 60 pt, resserrée jusqu’à 39 pt pour 8 devoirs */
function rcDevW(n){return n?Math.max(RC.devMin,Math.min(RC.devW,Math.floor((RC.W-2*RC.M-RC.nW-RC.nomW-RC.moyW-150)/n))):0;}
/* Colonnes d’un feuillet : N°, Nom et prénom, [devoirs de D], Moyenne, Observations (= la place restante) */
function rcCols(c,D,o){
  D=D||[];
  var op=rcOpt(o),w=rcDevW(D.length),cols=[{k:"n",t:"N°",w:RC.nW},{k:"nom",t:"Nom et prénom",w:RC.nomW}],used=RC.nW+RC.nomW+RC.moyW+(op.places?RC.plW:0);
  D.forEach(function(e){cols.push({k:"dev",e:e,t:e.t,w:w,comp:evIsComp(e)});used+=w;});
  cols.push({k:"moy",t:"Moyenne",w:RC.moyW});
  if(op.places)cols.push({k:"place",t:"Place",w:RC.plW});
  cols.push({k:"obs",t:"Observations",w:RC.W-2*RC.M-used});
  return cols;
}
/* Feuillets : les devoirs par paquets de 8 (un feuillet vide s’il n’y a aucun devoir) */
function rcFeuillets(D){var g=[],i;for(i=0;i<D.length;i+=RC.maxDev)g.push(D.slice(i,i+RC.maxDev));return g.length?g:[[]];}
/* Titre d’une colonne de devoir : on réduit d’abord la police (de 8,5 pt à 6,5 pt) pour que tout le titre tienne,
   et on ne coupe qu’ensuite (≈ 0,55 × la taille de police par caractère). */
function rcMaxCh(w){return Math.max(4,Math.floor((w-3)/(6.5*0.55)));}
function rcTitSz(w,t){var n=Math.max(1,String(t).length);return Math.round(Math.max(6.5,Math.min(8.5,(w-3)/(n*0.55)))*10)/10;}
function rcCentre(cx,t,sz){return Math.round((cx-String(t).length*sz*0.26)*10)/10;}
/* Titre + ligne d’informations + en-tête du tableau. Rend le dessin et la position du haut des lignes. */
function rcEntete(c,cols,o2){
  o2=o2||{};
  var o="",M=RC.M,W=RC.W,x=M,j,y=RC.H-M,hh=RC.headH;
  o+=pdTx(rcCentre(W/2,"RELEVE DE NOTES",15),y-12,"RELEVÉ DE NOTES",15,1,PDF_BLUE);
  /* établissement et enseignant(e) : ceux du compte ; une ligne « ____ » à remplir à la main s’ils manquent */
  var sch=ME&&ME.school?String(ME.school).trim():"",ens=ME&&ME.name?String(ME.name).trim():"",bl="____________________";
  o+=pdTx(M,y-34,pdCut("Établissement : "+(sch||bl)+"          Enseignant(e) : "+(ens||bl),150),10,1);
  var info="Classe : "+c.name+"     Matière : "+(String(c.subj||"").trim()||"______________")+"     Effectif : "+c.students.length+"     Année scolaire : "+syLabel(refDate(c))+(typeof o2.p==="number"?"     Période : Trimestre "+o2.p:"")+(o2.bar===10?"     Barème : sur 10":"")+(o2.nf>1?"     Feuillet "+o2.f+" / "+o2.nf:"");
  o+=pdTx(M,y-50,pdCut(info,150),10,0);
  y-=66;
  var tw=W-2*M;
  o+=pdRect(M,y-hh,tw,hh,PDF_SOFT);
  for(j=0;j<cols.length;j++){
    var col=cols[j];
    if(col.k==="dev"){
      if(col.comp)o+=pdRect(x,y-hh,col.w,hh,RC.compFill);   /* composition : en-tête un peu plus foncé */
      var tt=pdCut(col.e.t,rcMaxCh(col.w)),ts=rcTitSz(col.w,tt);   /* titre seul : ni date ni barème sous le nom du devoir */
      o+=pdTx(rcCentre(x+col.w/2,tt,ts),y-hh/2-3,tt,ts,1);
    }else o+=pdTx(col.k==="nom"||col.k==="obs"?x+6:rcCentre(x+col.w/2,col.t,9.5),y-hh/2-3.5,col.t,9.5,1);
    x+=col.w;
  }
  return{o:o,top:y-hh,hh:hh};
}
/* ---- Étape 8 : grilles d’appréciation (fiche « Appréciation du maître – Préscolaire et Primaire ») ----
   On arrondit d’abord à 2 décimales (comme l’affichage), puis on ne garde que la partie entière pour la grille du maître.
   Sur 20 : 0-3 nul · 4-5 mauvais · 6-8 faible · 9 insuffisant · 10 moyen · 11 passable · 12-14 assez bien · 15-16 bien · 17-18 très bien · 19-20 excellent.
   Sur 10 : 0-2 nul · 3 faible · 4 insuffisant · 5 moyen · 6 passable · 7 assez bien · 8 bien · 9 très bien · 10 excellent.
   Enseignant (copies sur 10) : Blâme 0 à 4,99 · Encouragement 5 à 6,99 · Félicitation 7 à 8,99 · Excellent 9 à 10. */
var RC_G20=[[3,"Nul"],[5,"Mauvais"],[8,"Faible"],[9,"Insuffisant"],[10,"Moyen"],[11,"Passable"],[14,"Assez bien"],[16,"Bien"],[18,"Très bien"],[20,"Excellent"]];
var RC_G10=[[2,"Nul"],[3,"Faible"],[4,"Insuffisant"],[5,"Moyen"],[6,"Passable"],[7,"Assez bien"],[8,"Bien"],[9,"Très bien"],[10,"Excellent"]];
var RC_GE=[[4.99,"Blâme"],[6.99,"Encouragement"],[8.99,"Félicitation"],[10,"Excellent"]];
function rcArr(v,max){if(typeof v!=="number"||isNaN(v))return null;return Math.min(max,Math.max(0,Math.round(v*100)/100));}
function rcMaitre(v,bar){
  var G=bar===20?RC_G20:bar===10?RC_G10:null,x=rcArr(v,bar),i;
  if(!G||x===null)return"";
  x=Math.floor(x);
  for(i=0;i<G.length;i++)if(x<=G[i][0])return G[i][1];
  return"";
}
function rcEnseignant(v,bar){
  var x=bar===10?rcArr(v,10):null,i;
  if(x===null)return"";
  for(i=0;i<RC_GE.length;i++)if(x<=RC_GE[i][0])return RC_GE[i][1];
  return"";
}
/* Barème des copies de la période : 10 si toutes les évaluations notées sont sur 10, sinon 20 (y compris sans évaluation). */
function rcBareme(c,p){
  var D=rcDevoirs(c,p);
  return D.length&&D.every(function(e){return e.m===10;})?10:20;
}
/* Texte de la colonne Observations pour une moyenne /20 : « Bien » (sur 20) ou « Assez bien · Félicitation » (sur 10) */
function rcObs(av,bar){
  if(av===null||av===undefined)return"";
  if(bar===10){var v=av/2,m=rcMaitre(v,10),e=rcEnseignant(v,10);return m+(e?" · "+e:"");}
  return rcMaitre(av,20);
}
/* Moyenne /20 de chaque élève sur la période (coefficients pris en compte) ; null sans note.
   L’appréciation (colonne Observations) vient des grilles de l’étape 8 (rcObs). */
function rcMoyennes(c,L,p){var r={};L.forEach(function(s){r[s.id]=sAvg(c,s.id,typeof p==="number"?p:"");});return r;}
/* Une page : en-tête + lignes quadrillées des élèves [i0, i1[ */
function rcPage(c,cols,L,i0,i1,pg,tot,o2){
  var E=rcEntete(c,cols,o2),avs=o2.vierge?{}:rcMoyennes(c,L,o2.p),rm=o2.rm||{},o=E.o,M=RC.M,tw=RC.W-2*M,y=E.top,i,j,x;
  var rows=i1-i0,yTop=y+E.hh,yBot=y-rows*RC.rowH;
  o+=rcLine(M,yTop,M+tw,yTop,0.9)+rcLine(M,y,M+tw,y,0.9);
  for(i=0;i<rows;i++){
    var yy=y-(i+1)*RC.rowH,s=L[i0+i],num=String(i0+i+1);
    o+=rcLine(M,yy,M+tw,yy,i===rows-1?0.9:0.5);
    x=M;
    for(j=0;j<cols.length;j++){
      var col=cols[j];
      if(col.k==="n")o+=pdTx(rcCentre(x+col.w/2,num,10),yy+7,num,10,0);
      else if(col.k==="place"){var pl=rm[s.id]&&rm[s.id].r;if(pl){var tp=String(pl);o+=pdTx(rcCentre(x+col.w/2,tp,10),yy+7,tp,10,1);}}
      else if(col.k==="nom")o+=pdTx(x+6,yy+7,pdCut(s.name,38),10,0);
      else if(col.k==="moy"||col.k==="obs"){
        var av=avs[s.id];
        if(av!==null&&av!==undefined){
          if(col.k==="moy"){var tm=nf(o2.bar===10?av/2:av);o+=pdTx(rcCentre(x+col.w/2,tm,10),yy+7,tm,10,1);}
          else o+=pdTx(x+6,yy+7,pdCut(rcObs(av,o2.bar),Math.max(6,Math.floor((col.w-10)/5))),10,0);
        }
      }
      else if(col.k==="dev"){var v=col.e.s&&col.e.s[s.id];if(typeof v==="number"){var t=nf(v);o+=pdTx(rcCentre(x+col.w/2,t,10),yy+7,t,10,0);}}
      x+=col.w;
    }
  }
  x=M;o+=rcLine(x,yTop,x,yBot,0.9);
  for(j=0;j<cols.length;j++){x+=cols[j].w;o+=rcLine(x,yTop,x,yBot,j===cols.length-1||(cols[j+1]&&cols[j+1].comp&&!cols[j].comp)?0.9:0.5);}
  o+=pdTx(M,18,"Édité le "+fmt(today(),true)+" · Classe Master",8,0,PDF_GREY);
  o+=pdTx(RC.W-M-50,18,"Page "+pg+" / "+tot,8,0,PDF_GREY);
  return o;
}
function releveCahierPDF(c,p,opt){
  var op=rcOpt(opt),L=rcEleves(c),secs=op.vierge?[null]:op.tous?[1,2,3]:[p],plan=[],tot=0,pages=[],pg=0;
  secs.forEach(function(sp){
    var F=op.vierge?[rcBlancs()]:rcFeuillets(rcDevoirs(c,sp,op)),
      rm=op.places&&!op.vierge?rankMap(c,typeof sp==="number"?sp:""):{},bar=op.vierge?20:rcBareme(c,sp);
    F.forEach(function(D,fi){
      var cols=rcCols(c,D,op),E=rcEntete(c,cols),per=Math.max(1,Math.floor((E.top-45)/RC.rowH)),n=Math.max(1,Math.ceil(L.length/per));
      plan.push({cols:cols,per:per,n:n,f:fi+1,nf:F.length,p:sp,rm:rm,bar:bar,vierge:op.vierge});tot+=n;
    });
  });
  plan.forEach(function(P){
    var q;
    for(q=0;q<P.n;q++){pg++;pages.push(rcPage(c,P.cols,L,q*P.per,Math.min(L.length,(q+1)*P.per),pg,tot,{p:P.p,f:P.f,nf:P.nf,rm:P.rm,bar:P.bar,vierge:P.vierge}));}
  });
  return pdfBytes(pages,true);
}

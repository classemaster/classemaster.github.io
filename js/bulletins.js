/* Bulletins et relevés de notes en PDF (A4, hors ligne) */
function fname(t){return String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w-]+/g,"_");}
function bpOf(){return bp||autoTr(today());}
function bcKey(id,p){return id+"|"+p;}
function bcGet(c,id,p){return(c.bc&&c.bc[bcKey(id,p)])||"";}

/* Carte « Bulletin » de la fiche élève */
function ficheBulletin(c,s){
  var p=bpOf();
  return'<div class="card"><h2>Bulletin</h2><div class="flt"><select id="bper" aria-label="Période du bulletin">'+trOpts(p,false)+'</select></div>'+
  '<label class="sub" for="bcm" style="display:block;margin:0 0 4px">Appréciation du professeur (facultative)</label><textarea id="bcm" data-bcs="'+s.id+'" rows="2" placeholder="Ex. Élève sérieux, doit renforcer la conjugaison.">'+esc(bcGet(c,s.id,p))+'</textarea>'+
  '<div class="bar" style="margin:8px 0 0"><button class="btn" id="bone" data-bs="'+s.id+'">Bulletin PDF</button></div><p class="sub" id="bmsg1" role="status" style="margin:6px 0 0"></p></div>';
}
/* Carte « Bulletins » de la page Notes */
/* Relevé de la classe : au choix un trimestre, la moyenne annuelle, toutes les évaluations, ou UN devoir précis.
   Valeur du choix : « p:1 », « p:A », « p: » (toutes les évaluations) ou « e:<id> » (un devoir). */
var brs=null,brPl=false,brCp=true;   /* relevé paysage : « Inclure les places » (décoché) et « Inclure les compositions » (coché) */
function brsVal(){return brs===null?"p:"+bpOf():brs;}
function brsOpts(c,sel){
  var E=evs(c).slice().sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:0;});
  function o(v,t){return'<option value="'+v+'"'+(v===sel?" selected":"")+'>'+t+'</option>';}
  return'<optgroup label="Par période">'+o("p:","Toutes les évaluations (tous les trimestres)")+o("p:1","Trimestre 1")+o("p:2","Trimestre 2")+o("p:3","Trimestre 3")+o("p:A","Moyenne annuelle (T1 + T2 + T3)")+'</optgroup>'+
    '<optgroup label="Relevé de notes en paysage (A4)">'+o("k:1","Relevé paysage · Trimestre 1")+o("k:2","Relevé paysage · Trimestre 2")+o("k:3","Relevé paysage · Trimestre 3")+o("k:","Relevé paysage · toutes les évaluations")+o("k:T","Relevé paysage · les 3 trimestres (3 sections)")+o("k:V","Cahier vierge (sans notes, à remplir à la main)")+'</optgroup>'+(E.length?'<optgroup label="Un devoir précis">'+E.map(function(e){return o("e:"+e.id,esc(e.t)+" · "+esc(fmt(e.d))+" · sur "+nf(e.m));}).join("")+'</optgroup>':"");
}
function bulletinsCard(c){
  var p=bpOf();
  return'<div class="card"><h2>Bulletins et relevé</h2><p class="sub" style="margin-top:0">Documents PDF prêts à imprimer, avec moyennes, rangs, appréciations, absences et retards.</p><div class="flt"><select id="bper" aria-label="Période des bulletins">'+trOpts(p,false)+'</select></div>'+
  '<div class="bar" style="margin:0"><button class="btn" id="ball">Tous les bulletins</button></div>'+
  '<h3 style="font-size:1rem;margin:16px 0 6px">Relevé de notes de la classe</h3><p class="sub" style="margin:0 0 8px">Choisissez une période, tous les trimestres, ou un seul devoir.</p>'+
  '<div class="flt"><select id="brsel" aria-label="Relevé : période ou devoir précis">'+brsOpts(c,brsVal())+'</select></div>'+
  '<p class="sub" style="margin:0 0 4px">Pour le relevé paysage :</p><label for="brpl" style="display:flex;gap:10px;align-items:center;margin:0 0 4px"><input type="checkbox" id="brpl" style="width:auto;min-height:0"'+(brPl?" checked":"")+'> Inclure les places</label><label for="brcp" style="display:flex;gap:10px;align-items:center;margin:0 0 8px"><input type="checkbox" id="brcp" style="width:auto;min-height:0"'+(brCp?" checked":"")+'> Inclure les compositions</label>'+
  '<div class="bar" style="margin:0"><button class="btn ghost" id="brel">Télécharger le relevé</button></div><p class="sub" id="bmsg" role="status"></p></div>';
}

/* ---- Dessin PDF ---- */
function pdTx(x,y,t,sz,bold,col){return(col?col+" rg ":"")+"BT /"+(bold?"F2":"F1")+" "+(sz||10)+" Tf "+x+" "+y+" Td ("+lat(t)+") Tj ET\n"+(col?"0 g\n":"");}
function pdRect(x,y,w,h,fill,stroke){return(fill?fill+" rg ":"")+(stroke?stroke+" RG 0.6 w ":"")+x+" "+y+" "+w+" "+h+" re "+(fill&&stroke?"B":fill?"f":"S")+"\n"+(fill?"0 g\n":"")+(stroke?"0 G\n":"");}
function pdLine(x1,y1,x2,y2,w){return"0.78 0.8 0.84 RG "+(w||0.5)+" w "+x1+" "+y1+" m "+x2+" "+y2+" l S\n0 G\n";}
function pdCut(t,n){t=String(t);return t.length>n?t.slice(0,n-1)+"…":t;}
function pdWrap(t,n){
  var out=[],cur="";
  String(t).replace(/\s+/g," ").trim().split(" ").forEach(function(w){
    if((cur+" "+w).trim().length>n&&cur){out.push(cur);cur=w;}else cur=(cur+" "+w).trim();
  });
  if(cur)out.push(cur);return out;
}
var PDF_BLUE="0.12 0.25 0.54",PDF_SOFT="0.91 0.93 0.97",PDF_GREY="0.4 0.45 0.52";

function perTitle(p,ref){
  var y=syLabel(ref||today());
  return p==="A"?"Bilan annuel – Année scolaire "+y:"Trimestre "+p+" – Année scolaire "+y;
}
/* Date de référence pour l’année scolaire : dernière évaluation, sinon aujourd’hui */
function refDate(c){var d=evs(c).map(function(e){return e.d;}).sort().pop();return d||today();}

/* Une page de bulletin pour un élève */
function bulletinPage(c,s,p,ctx){
  var o="",y,i,rm=ctx.rm[p][s.id],st=ctx.st[p],ab=absPer(c,s.id,p);
  o+=pdRect(0,762,595,80,PDF_BLUE);
  o+=pdTx(40,816,ME&&ME.school?ME.school:"Établissement scolaire",16,1,"1 1 1");
  o+=pdTx(40,794,"BULLETIN DE NOTES",12,1,"1 1 1");
  o+=pdTx(40,776,perTitle(p,ctx.ref),10,0,"1 1 1");
  o+=pdTx(40,734,s.name,15,1);
  o+=pdTx(40,716,"Classe : "+c.name+(c.subj?"   ·   Matière : "+c.subj:"")+"   ·   Effectif : "+c.students.length,10,0);
  if(ME&&ME.name)o+=pdTx(40,702,"Enseignant : "+ME.name,10,0);
  y=676;
  if(p==="A"){
    o+=pdRect(40,y-6,515,20,PDF_SOFT);
    o+=pdTx(46,y,"Période",9,1)+pdTx(220,y,"Moyenne /20",9,1)+pdTx(310,y,"Rang",9,1)+pdTx(380,y,"Moy. classe",9,1)+pdTx(460,y,"Appréciation",9,1);
    y-=22;
    [1,2,3].forEach(function(t){
      var r=ctx.rm[t][s.id],q=ctx.st[t];
      o+=pdTx(46,y,"Trimestre "+t,10,0)+pdTx(220,y,nf(r.a),10,0)+pdTx(310,y,rkTxt(r),10,0)+pdTx(380,y,nf(q.avg),10,0)+pdTx(460,y,apprec(r.a),10,0);
      o+=pdLine(40,y-6,555,y-6,0.3);y-=19;
    });
  }else{
    var E=evs(c).filter(function(e){return trOf(e)===p;}).sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0;});
    var rh=E.length>16?14:18,sz=E.length>16?8.5:10,max=E.length>16?22:16;
    o+=pdRect(40,y-6,515,20,PDF_SOFT);
    o+=pdTx(46,y,"Date",9,1)+pdTx(112,y,"Évaluation",9,1)+pdTx(310,y,"Note",9,1)+pdTx(365,y,"Coef.",9,1)+pdTx(412,y,"Note /20",9,1)+pdTx(478,y,"Moy. classe",9,1);
    y-=22;
    if(!E.length)o+=pdTx(46,y,"Aucune évaluation sur cette période.",10,0,PDF_GREY),y-=rh;
    E.slice(0,max).forEach(function(e){
      var v=e.s&&e.s[s.id],has=typeof v==="number";
      o+=pdTx(46,y,fmt(e.d),sz,0)+pdTx(112,y,pdCut(e.t,34),sz,0)+pdTx(310,y,has?nf(v)+" / "+nf(e.m):"abs.",sz,0)+pdTx(365,y,nf(e.k===undefined?1:e.k),sz,0)+pdTx(412,y,has?nf(n20(e,v)):"–",sz,0)+pdTx(478,y,nf(evAvg20(e,c)),sz,0);
      o+=pdLine(40,y-5,555,y-5,0.3);y-=rh;
    });
    if(E.length>max)o+=pdTx(46,y,"+ "+(E.length-max)+" autre(s) évaluation(s), voir le relevé de la classe.",8.5,0,PDF_GREY),y-=rh;
  }
  y-=10;
  o+=pdRect(40,y-92,515,106,null,"0.7 0.74 0.8");
  var T=p==="A"?"Moyenne annuelle":"Moyenne du trimestre";
  o+=pdTx(52,y-8,T,10,0,PDF_GREY)+pdTx(52,y-30,nf(rm.a)+" / 20",20,1,PDF_BLUE);
  o+=pdTx(52,y-52,"Rang : "+rkTxt(rm),11,1);
  o+=pdTx(52,y-70,"Appréciation : "+(apprec(rm.a)||"–"),11,1);
  o+=pdTx(300,y-12,"Moyenne de la classe : "+nf(st.avg),10,0);
  o+=pdTx(300,y-28,"Plus forte moyenne : "+nf(st.max),10,0);
  o+=pdTx(300,y-44,"Plus faible moyenne : "+nf(st.min),10,0);
  o+=pdTx(300,y-64,"Absences : "+ab.a+(ab.a?" (dont "+ab.j+" justifiée"+(ab.j>1?"s":"")+")":""),10,0);
  o+=pdTx(300,y-80,"Retards : "+ab.r,10,0);
  y-=118;
  o+=pdTx(40,y,"Appréciation du professeur",10,1);y-=16;
  var cm=bcGet(c,s.id,p);
  pdWrap(cm,95).slice(0,Math.max(1,Math.min(5,Math.floor((y-168)/14)))).forEach(function(l){o+=pdTx(40,y,l,10,0);y-=14;});
  if(!cm&&y>200)o+=pdLine(40,y-4,555,y-4,0.5)+pdLine(40,y-24,555,y-24,0.5);
  o+=pdRect(40,70,245,90,null,"0.7 0.74 0.8")+pdRect(310,70,245,90,null,"0.7 0.74 0.8");
  o+=pdTx(48,146,"Le professeur",9,1,PDF_GREY)+pdTx(318,146,"Visa des parents",9,1,PDF_GREY);
  o+=pdTx(40,48,"Édité le "+fmt(today(),true)+" · Classe Master",8,0,PDF_GREY);
  return o;
}
function bulletinCtx(c,p){
  var rm={},st={},ps=p==="A"?[1,2,3,"A"]:[p];
  ps.forEach(function(q){rm[q]=rankMap(c,q);st[q]=clsAvgStat(rm[q]);});
  return{rm:rm,st:st,ref:refDate(c)};
}
function bulletinsPDF(c,p,ids){
  var ctx=bulletinCtx(c,p);
  var L=c.students.filter(function(s){return!ids||ids.indexOf(s.id)>=0;});
  return pdfBytes(L.map(function(s){return bulletinPage(c,s,p,ctx);}));
}

/* Relevé de notes de la classe : une ligne par élève */
function releveRows(c,p){
  var rm=rankMap(c,p),ann=p==="A",tr=ann?[1,2,3].map(function(t){return rankMap(c,t);}):[];
  var L=c.students.slice().sort(function(a,b){var x=rm[a.id].r,y=rm[b.id].r;return(x===null?1e9:x)-(y===null?1e9:y)||a.name.localeCompare(b.name,"fr");});
  return{rm:rm,tr:tr,L:L};
}
/* Relevé d'UN devoir : une ligne par élève, classés par note, avec la moyenne, la plus forte et la plus faible note */
function releveDevoirPDF(c,e){
  var pages=[],cur="",y,X=[40,75,300,385,470],H=["Rang","Élève","Note","Sur 20","Mention"],m=e.m>0?e.m:20;
  var rows=c.students.map(function(s){var v=e.s&&e.s[s.id];return{s:s,v:typeof v==="number"?v:null};});
  var ok=rows.filter(function(r){return r.v!==null;}).sort(function(a,b){return b.v-a.v||a.s.name.localeCompare(b.s.name,"fr");});
  ok.forEach(function(r,i){r.r=i&&Math.round(r.v*100)===Math.round(ok[i-1].v*100)?ok[i-1].r:i+1;});
  var L=ok.concat(rows.filter(function(r){return r.v===null;}).sort(function(a,b){return a.s.name.localeCompare(b.s.name,"fr");}));
  var st=evStat(e,c);
  function head(){
    var o=pdRect(40,y-6,515,20,PDF_SOFT),j;
    for(j=0;j<H.length;j++)o+=pdTx(X[j],y,H[j],9,1);
    y-=22;return o;
  }
  y=800;
  cur=pdTx(40,y,ME&&ME.school?ME.school:"Établissement scolaire",13,1,PDF_BLUE);y-=20;
  cur+=pdTx(40,y,"Relevé du devoir – "+c.name+(c.subj?" ("+c.subj+")":""),14,1);y-=18;
  cur+=pdTx(40,y,pdCut(e.t,56)+" · "+fmt(e.d,true)+" · sur "+nf(m)+(e.k!==undefined&&e.k!==1?" · coefficient "+nf(e.k):"")+" · édité le "+fmt(today(),true),9,0,PDF_GREY);y-=24;
  cur+=pdTx(40,y,"Moyenne : "+nf(st.avg)+" / "+nf(m)+"   ·   Plus forte : "+nf(st.mx)+"   ·   Plus faible : "+nf(st.mn)+"   ·   "+st.n+" note"+(st.n>1?"s":"")+" sur "+c.students.length+" élèves",10,1);y-=26;
  cur+=head();
  L.forEach(function(r){
    if(y<60){pages.push(cur);y=800;cur=head();}
    var v20=r.v===null?null:r.v/m*20,row=[r.v===null?"–":String(r.r),pdCut(r.s.name,40),r.v===null?"–":nf(r.v)+" / "+nf(m),nf(v20),apprec(v20)||"–"],j;
    for(j=0;j<row.length;j++)cur+=pdTx(X[j],y,row[j],10,0);
    cur+=pdLine(40,y-5,555,y-5,0.3);y-=17;
  });
  pages.push(cur);
  return pdfBytes(pages);
}
function relevePDF(c,p){
  var R=releveRows(c,p),ann=p==="A",pages=[],cur="",y;
  var X=ann?[40,75,265,320,375,430,495]:[40,75,330,420];
  var H=ann?["Rang","Élève","T1","T2","T3","Annuelle","Mention"]:["Rang","Élève","Moyenne /20","Mention"];
  var st=clsAvgStat(R.rm);
  function head(){
    var o=pdRect(40,y-6,515,20,PDF_SOFT),j;
    for(j=0;j<H.length;j++)o+=pdTx(X[j],y,H[j],9,1);
    y-=22;return o;
  }
  y=800;
  cur=pdTx(40,y,ME&&ME.school?ME.school:"Établissement scolaire",13,1,PDF_BLUE);y-=20;
  cur+=pdTx(40,y,"Relevé de notes – "+c.name+(c.subj?" ("+c.subj+")":""),14,1);y-=18;
  cur+=pdTx(40,y,(p===""?"Toutes les évaluations":perTitle(p,refDate(c)))+" · "+c.students.length+" élèves · édité le "+fmt(today(),true),9,0,PDF_GREY);y-=24;
  cur+=pdTx(40,y,"Moyenne de la classe : "+nf(st.avg)+"   ·   Plus forte : "+nf(st.max)+"   ·   Plus faible : "+nf(st.min),10,1);y-=26;
  cur+=head();
  R.L.forEach(function(s){
    if(y<60){pages.push(cur);y=800;cur=head();}
    var r=R.rm[s.id],row=[r.r?String(r.r):"–",pdCut(s.name,ann?36:48)];
    if(ann){R.tr.forEach(function(m){row.push(nf(m[s.id].a));});}
    row.push(nf(r.a));row.push(apprec(r.a)||"–");
    for(var j=0;j<row.length;j++)cur+=pdTx(X[j],y,row[j],10,0);
    cur+=pdLine(40,y-5,555,y-5,0.3);y-=17;
  });
  pages.push(cur);
  return pdfBytes(pages);
}

document.getElementById("view").addEventListener("change",function(e){
  var t=e.target,c=cl();
  if(t.id==="ntr"){ntr=trParse(t.value);var y=window.scrollY;render();window.scrollTo(0,y);return;}
  if(t.id==="bper"){bp=trParse(t.value);var y2=window.scrollY;render();window.scrollTo(0,y2);return;}
  if(t.id==="brsel"){brs=t.value;return;}
  if(t.id==="bcm"){
    var k=bcKey(t.dataset.bcs,bpOf()),v=t.value.trim();
    if(!c.bc)c.bc={};
    if(v)c.bc[k]=v;else delete c.bc[k];
    save();return;
  }
});
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl(),p=bpOf();
  var safe=fname(cl().name);
  if(t.id==="bone"){
    var s=c.students.find(function(x){return x.id===t.dataset.bs;});if(!s)return;
    var cm=document.getElementById("bcm");if(cm){var kk=bcKey(s.id,p),vv=cm.value.trim();if(!c.bc)c.bc={};if(vv)c.bc[kk]=vv;else delete c.bc[kk];save();}
    saveFile("bulletin-"+fname(s.name)+"-"+(p==="A"?"annuel":"T"+p)+".pdf",function(){return bulletinsPDF(c,p,[s.id]);},"application/pdf",function(m){var x=document.getElementById("bmsg1");if(x)x.textContent=m;});
    return;
  }
  if(t.id==="ball"){
    saveFile("bulletins-"+safe+"-"+(p==="A"?"annuel":"T"+p)+".pdf",function(){return bulletinsPDF(c,p);},"application/pdf",function(m){var x=document.getElementById("bmsg");if(x)x.textContent=m;});
    return;
  }
  if(t.id==="brel"){
    var sl=document.getElementById("brsel"),v=sl?sl.value:brsVal(),msg=function(m){var x=document.getElementById("bmsg");if(x)x.textContent=m;};
    brs=v;
    if(v.indexOf("e:")===0){
      var ev=evs(c).find(function(x){return x.id===v.slice(2);});
      if(!ev){msg("Ce devoir n’existe plus.");return;}
      saveFile("releve-"+safe+"-"+fname(ev.t)+".pdf",function(){return releveDevoirPDF(c,ev);},"application/pdf",msg);
      return;
    }
    if(v.indexOf("k:")===0){
      var kp=v==="k:T"||v==="k:V"?"":trParse(v.slice(2));
      if(!c.students.length){msg("Ajoutez d’abord des élèves à cette classe.");return;}
      var kpl=document.getElementById("brpl"),kcp=document.getElementById("brcp");
      if(kpl)brPl=kpl.checked;if(kcp)brCp=kcp.checked;
      var ko={places:brPl,comps:brCp},kn="releve-paysage-"+safe+"-"+(typeof kp==="number"?"T"+kp:"toutes-evaluations");
      if(v==="k:T"){ko.tous=true;kn="releve-paysage-"+safe+"-3-trimestres";}
      if(v==="k:V"){ko.vierge=true;kn="cahier-vierge-"+safe;}
      saveFile(kn+".pdf",function(){return releveCahierPDF(c,kp,ko);},"application/pdf",msg);
      return;
    }
    var rp=trParse(v.slice(2));
    saveFile("releve-"+safe+"-"+(rp==="A"?"annuel":rp===""?"toutes-evaluations":"T"+rp)+".pdf",function(){return relevePDF(c,rp);},"application/pdf",msg);
    return;
  }
  if(t.id==="evrel"){
    var e2=evs(c).find(function(x){return x.id===evid;});if(!e2)return;
    saveFile("releve-"+safe+"-"+fname(e2.t)+".pdf",function(){return releveDevoirPDF(c,e2);},"application/pdf",function(m){var x=document.getElementById("evrelmsg");if(x)x.textContent=m;});
    return;
  }
});

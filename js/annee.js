/* Bilan de fin d'année : moyenne annuelle, répartition et propositions de passage en classe supérieure.
   Les propositions sont automatiques (seuil réglable) ; l'enseignant peut les corriger élève par élève.
   Réglages et décisions : c.pa = {t: seuil, d: {idÉlève: "p"|"x"|"r"}} (synchronisés avec la classe). */
var AN_L={p:"Passe",x:"À examiner",r:"Redoublement",n:"Non évalué"};
function anSeuil(c){return c.pa&&typeof c.pa.t==="number"?c.pa.t:10;}
/* Proposition automatique : au-dessus du seuil = passe ; jusqu'à 2 points en dessous = à examiner ; en dessous = redoublement */
function anAuto(a,t){return a===null?"n":a>=t?"p":a>=t-2?"x":"r";}
function anDec(c,id,a){var o=c.pa&&c.pa.d&&c.pa.d[id];return(o==="p"||o==="x"||o==="r")?o:anAuto(a,anSeuil(c));}
function anMed(v){if(!v.length)return null;var s=v.slice().sort(function(x,y){return x-y;}),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;}
function anBands(v){
  var B=[["moins de 8",0,8],["8 à 10",8,10],["10 à 12",10,12],["12 à 14",12,14],["14 à 16",14,16],["16 et plus",16,99]];
  return B.map(function(b){return{l:b[0],n:v.filter(function(x){return x>=b[1]&&x<b[2];}).length};});
}
function anData(c){
  var R=releveRows(c,"A"),t=anSeuil(c),vals=[],cnt={p:0,x:0,r:0,n:0};
  R.L.forEach(function(s){
    var a=R.rm[s.id].a;if(a!==null)vals.push(a);
    cnt[anDec(c,s.id,a)]++;
  });
  return{R:R,t:t,vals:vals,cnt:cnt,st:clsAvgStat(R.rm),med:anMed(vals),trAvg:R.tr.map(function(m){return clsAvgStat(m).avg;})};
}

function renderAnnee(){
  var c=cl(),h='<h1 style="text-transform:none">Bilan de fin d’année</h1><p class="sub">'+esc(c.name)+(c.subj?" · "+esc(c.subj):"")+" · année "+esc(syLabel(refDate(c)))+"</p>";
  if(!c.students.length)return h+'<div class="empty">Ajoutez d’abord des élèves à cette classe.</div>';
  var d=anData(c);
  if(!d.vals.length)return h+'<div class="empty">Le bilan apparaît dès qu’une note est saisie.</div>';
  var ps=Math.round(d.vals.filter(function(x){return x>=d.t;}).length/d.vals.length*100),mx=Math.max.apply(null,anBands(d.vals).map(function(b){return b.n;}))||1;
  h+='<div class="cl-t"><div><b style="color:var(--accent)">'+nf(d.st.avg)+'</b><span>Moyenne annuelle</span></div><div><b style="color:var(--p)">'+ps+' %</b><span>≥ '+nf(d.t)+' / 20</span></div><div><b>'+nf(d.med)+'</b><span>Médiane</span></div></div>';
  h+='<div class="card"><h2>Évolution et répartition</h2><p class="sub" style="margin:0 0 8px">Moyenne de la classe : T1 <b>'+nf(d.trAvg[0])+'</b> · T2 <b>'+nf(d.trAvg[1])+'</b> · T3 <b>'+nf(d.trAvg[2])+'</b> · plus forte '+nf(d.st.max)+' · plus faible '+nf(d.st.min)+'</p>';
  anBands(d.vals).forEach(function(b){h+='<div class="an-b"><span>'+b.l+'</span><div class="sto-m"><i style="width:'+(b.n?Math.max(4,Math.round(b.n/mx*100)):0)+'%"></i></div><b>'+b.n+'</b></div>';});
  h+='</div>';
  h+='<div class="card"><h2>Passage en classe supérieure</h2><p class="sub" style="margin-top:0">Proposition automatique à partir de la moyenne annuelle ; elle sert de base de discussion et reste à valider par le conseil de classe.</p>'+
    '<label class="fld">Seuil de passage (sur 20)<input type="number" id="an-t" min="5" max="15" step="0.5" inputmode="decimal" value="'+d.t+'"></label>'+
    '<p class="sub" style="margin:0 0 8px">Passe : à partir de '+nf(d.t)+' · À examiner : de '+nf(d.t-2)+' à moins de '+nf(d.t)+' · Redoublement : en dessous.</p>'+
    '<div class="cl-t"><div><b style="color:var(--p)">'+d.cnt.p+'</b><span>Passent</span></div><div><b style="color:var(--r)">'+d.cnt.x+'</b><span>À examiner</span></div><div><b style="color:var(--a)">'+d.cnt.r+'</b><span>Redoublement</span></div></div>'+
    '<div class="scroll"><table><tr><th class="n">#</th><th>Élève</th><th class="n">T1</th><th class="n">T2</th><th class="n">T3</th><th class="n">Annuelle</th><th>Décision</th></tr>'+
    d.R.L.map(function(s){
      var r=d.R.rm[s.id],au=anAuto(r.a,d.t),ov=(c.pa&&c.pa.d&&c.pa.d[s.id])||"",tc=d.R.tr.map(function(m){return'<td class="n">'+nf(m[s.id].a)+'</td>';}).join("");
      return'<tr><td class="n">'+(r.r===null?"–":r.r)+'</td><td>'+esc(s.name)+'</td>'+tc+'<td class="n"><b>'+nf(r.a)+'</b></td><td><select class="an-s" data-pad="'+s.id+'" aria-label="Décision pour '+esc(s.name)+'">'+
        '<option value=""'+(ov?"":" selected")+'>Auto · '+AN_L[au]+'</option><option value="p"'+(ov==="p"?" selected":"")+'>Passe</option><option value="x"'+(ov==="x"?" selected":"")+'>À examiner</option><option value="r"'+(ov==="r"?" selected":"")+'>Redoublement</option></select></td></tr>';
    }).join("")+'</table></div>'+
    '<div class="bar two" style="margin:10px 0 0"><button class="btn" id="an-pdf">Bilan PDF</button><button class="btn ghost" id="an-csv">Tableau CSV</button></div><p class="sub" id="an-msg" role="status" style="margin:6px 0 0"></p></div>';
  return h+'<p class="sub note">Les bulletins annuels se trouvent dans Notes > Bulletins et relevé (période « Moyenne annuelle »). Pour ranger l’année, utilisez ensuite « Archiver l’année scolaire ».</p>';
}
function anCard(c){
  return'<div class="card"><h2>Bilan de fin d’année</h2><p class="sub" style="margin-top:0">Moyenne annuelle de la classe, répartition des notes et propositions de passage en classe supérieure.</p><button class="btn" data-go="annee">Ouvrir le bilan</button></div>';
}
(function(){
  var base=renderNotes;
  renderNotes=function(){var h=base.apply(this,arguments),c=cl();return c.students.length?h+anCard(c):h;};
})();

/* Exports */
function anRows(c){
  var d=anData(c);
  return d.R.L.map(function(s){
    var r=d.R.rm[s.id],ab=absPer(c,s.id,"A");
    return{s:s,rk:r.r,t:d.R.tr.map(function(m){return m[s.id].a;}),a:r.a,dec:AN_L[anDec(c,s.id,r.a)],ab:ab};
  });
}
function anCSV(c){
  var L=["Rang;Élève;T1;T2;T3;Moyenne annuelle;Mention;Absences;Retards;Décision proposée"];
  function q(x){return'"'+String(x).replace(/"/g,'""')+'"';}
  anRows(c).forEach(function(x){L.push([x.rk||"",q(x.s.name),nf(x.t[0]),nf(x.t[1]),nf(x.t[2]),nf(x.a),q(apprec(x.a)||""),x.ab.a,x.ab.r,q(x.dec)].join(";"));});
  return"\ufeff"+L.join("\r\n");
}
function anPDF(c){
  var d=anData(c),rows=anRows(c),pages=[],cur="",y=800,X=[40,68,232,278,324,372,432];
  var H=["Rang","Élève","T1","T2","T3","Annuelle","Décision"];
  function head(){var o=pdRect(40,y-6,515,20,PDF_SOFT),j;for(j=0;j<H.length;j++)o+=pdTx(X[j],y,H[j],9,1);y-=22;return o;}
  cur=pdTx(40,y,ME&&ME.school?ME.school:"Établissement scolaire",13,1,PDF_BLUE);y-=20;
  cur+=pdTx(40,y,"Bilan de fin d'année – "+c.name+(c.subj?" ("+c.subj+")":""),14,1);y-=18;
  cur+=pdTx(40,y,"Année scolaire "+syLabel(refDate(c))+" · "+c.students.length+" élèves · édité le "+fmt(today(),true),9,0,PDF_GREY);y-=24;
  cur+=pdTx(40,y,"Moyenne annuelle : "+nf(d.st.avg)+"   ·   Médiane : "+nf(d.med)+"   ·   Plus forte : "+nf(d.st.max)+"   ·   Plus faible : "+nf(d.st.min),10,1);y-=16;
  cur+=pdTx(40,y,"Moyennes de classe : T1 "+nf(d.trAvg[0])+"  ·  T2 "+nf(d.trAvg[1])+"  ·  T3 "+nf(d.trAvg[2]),10,0);y-=16;
  cur+=pdTx(40,y,"Seuil de passage : "+nf(d.t)+"/20   ·   Passent : "+d.cnt.p+"   ·   À examiner : "+d.cnt.x+"   ·   Redoublement : "+d.cnt.r,10,0);y-=26;
  cur+=head();
  rows.forEach(function(x){
    if(y<70){pages.push(cur);y=800;cur=head();}
    var row=[x.rk?String(x.rk):"–",pdCut(x.s.name,30),nf(x.t[0]),nf(x.t[1]),nf(x.t[2]),nf(x.a),x.dec],j;
    for(j=0;j<row.length;j++)cur+=pdTx(X[j],y,row[j],10,j===5?1:0);
    cur+=pdLine(40,y-5,555,y-5,0.3);y-=17;
  });
  if(y<60){pages.push(cur);y=800;cur="";}
  cur+=pdTx(40,y-8,"Propositions établies d'après les moyennes ; décision finale à valider par le conseil de classe.",8,0,PDF_GREY);
  pages.push(cur);
  return pdfBytes(pages);
}

document.getElementById("view").addEventListener("change",function(e){
  var t=e.target,c=cl(),y;
  if(t.id==="an-t"){
    var v=parseFloat(String(t.value).replace(",","."));
    if(isNaN(v))v=10;
    v=Math.round(Math.min(15,Math.max(5,v))*2)/2;
    if(!c.pa)c.pa={};
    c.pa.t=v;save();y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  if(t.dataset&&t.dataset.pad){
    if(!c.pa)c.pa={};
    if(!c.pa.d)c.pa.d={};
    if(t.value)c.pa.d[t.dataset.pad]=t.value;else delete c.pa.d[t.dataset.pad];
    if(!Object.keys(c.pa.d).length)delete c.pa.d;
    save();y=window.scrollY;render();window.scrollTo(0,y);
  }
});
document.getElementById("view").addEventListener("click",function(e){
  var t=e.target,c=cl();
  function say(m){var x=document.getElementById("an-msg");if(x)x.textContent=m;}
  if(t.id==="an-pdf")saveFile("bilan-annuel-"+fname(c.name)+".pdf",anPDF(c),"application/pdf",say);
  else if(t.id==="an-csv")saveFile("bilan-annuel-"+fname(c.name)+".csv",anCSV(c),"text/csv",say);
});

/* Fiche d'appel papier (PDF A4) : noms et grille de dates à remplir à la main, pour les jours sans téléphone */
var FC_N=20;   /* colonnes de dates maximum par page */

function fcDates(c,ym,mode){
  var y=+ym.slice(0,4),m=+ym.slice(5,7)-1,n=new Date(y,m+1,0).getDate(),days=[],list=[],i,w,fb=false;
  if(mode==="tt"){(c.tt||[]).forEach(function(x){if(days.indexOf(x.d)<0)days.push(x.d);});if(!days.length)fb=true;}
  for(i=1;i<=n;i++){
    w=new Date(y,m,i).getDay();
    if(mode==="tt"&&!fb?days.indexOf(w)>=0:w>=1&&w<=5)list.push({d:i,w:w});
  }
  return{list:list,fb:fb};
}
function fcMonth(ym){
  var s=new Date(+ym.slice(0,4),+ym.slice(5,7)-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  return s.charAt(0).toUpperCase()+s.slice(1);
}

/* Carte de l'écran « Sauvegarde et partage » */
function ficheCard(){
  var c=cl();
  if(!c||!c.students.length)return"";
  var hasTt=(c.tt||[]).length>0;
  return'<div class="card"><h2>Fiche d’appel papier</h2><p class="sub" style="margin-top:0">À imprimer pour « '+esc(c.name)+' » : les noms des élèves et une colonne par jour. Utile quand le téléphone est absent ou déchargé ; la saisie se fait ensuite depuis l’écran d’appel.</p>'+
  '<label class="pm-l" for="fm">Mois</label><input type="month" id="fm" aria-label="Mois de la fiche" value="'+esc(today().slice(0,7))+'" style="width:100%">'+
  '<label class="pm-l" for="fc">Colonnes</label><select id="fc" style="width:100%"><option value="tt"'+(hasTt?" selected":"")+'>Jours de cours de l’emploi du temps</option><option value="wk"'+(hasTt?"":" selected")+'>Du lundi au vendredi</option><option value="blank">20 colonnes vides (à dater à la main)</option></select>'+
  '<div class="bar stk" style="margin:12px 0 0"><button class="btn" id="fpdf">Fiche d’appel PDF</button></div><p class="sub" id="fmsg" role="status"></p></div>';
}

/* Pages PDF : plusieurs feuilles si le mois a plus de 20 jours de cours ou la classe plus de ~40 élèves */
function ficheBuild(c,ym,mode){
  var S=c.students.slice().sort(function(a,b){return a.name.localeCompare(b.name,"fr");}),blank=mode==="blank";
  var D=blank?{list:[],fb:false}:fcDates(c,ym,mode),ncol=blank?FC_N:D.list.length;
  if(!ncol||!S.length)return null;
  var np=Math.ceil(ncol/FC_N),per=Math.ceil(ncol/np);
  var rh=Math.max(14,Math.min(19,Math.floor(610/(S.length+1)))),cap=Math.floor(610/rh)-1;
  var sheets=[],p,r0;
  for(p=0;p<np;p++){
    var cols=blank?new Array(per).fill(null):D.list.slice(p*per,(p+1)*per);
    for(r0=0;r0<S.length;r0+=cap)sheets.push({rows:S.slice(r0,r0+cap),r0:r0,cols:cols});
  }
  return{sheets:sheets,rh:rh,fb:D.fb,blank:blank,ym:ym};
}

function ficheDraw(c,sh,B,n,N){
  var o="",X0=40,wN=20,wNm=140,wT=24,rh=B.rh,nc=sh.cols.length;
  var wC=Math.min(26,(515-wN-wNm-2*wT)/nc),W=wN+wNm+nc*wC+2*wT,top=690,hh=26,bot=top-hh-sh.rows.length*rh,i,x;
  var W_="1 1 1";
  o+=pdRect(0,762,595,80,PDF_BLUE);
  o+=pdTx(40,816,ME&&ME.school?ME.school:"Établissement scolaire",16,1,W_);
  o+=pdTx(40,794,"FICHE D'APPEL",12,1,W_);
  o+=pdTx(40,776,B.blank?"Mois : ____________________":fcMonth(B.ym),10,0,W_);
  o+=pdTx(40,740,"Classe : "+c.name+(c.subj?"   ·   Matière : "+c.subj:"")+"   ·   Effectif : "+c.students.length,10,0);
  if(ME&&ME.name)o+=pdTx(40,726,"Enseignant : "+ME.name,10,0);
  o+=pdTx(X0,706,"Notez P (présent), A (absent) ou R (retard) dans la case de chaque élève.",8.5,0,PDF_GREY);
  /* en-tête du tableau */
  o+=pdRect(X0,top-hh,W,hh,PDF_SOFT);
  o+=pdTx(X0+4,top-hh+9,"N°",8,1)+pdTx(X0+wN+4,top-hh+9,"Élève",9,1);
  sh.cols.forEach(function(cd,j){
    var cx=X0+wN+wNm+j*wC;
    if(cd){
      var ini=["D","L","M","M","J","V","S"][cd.w];
      o+=pdTx(cx+wC/2-2.5,top-10,ini,6.5,0,PDF_GREY)+pdTx(cx+(cd.d<10?wC/2-2.5:wC/2-5),top-21,String(cd.d),7.5,1);
    }
  });
  var tx=X0+wN+wNm+nc*wC;
  o+=pdTx(tx+5,top-hh+9,"Abs.",7.5,1)+pdTx(tx+wT+5,top-hh+9,"Ret.",7.5,1);
  /* lignes */
  sh.rows.forEach(function(s,k){
    var yt=top-hh-k*rh;
    if(k%2)o+=pdRect(X0,yt-rh,W,rh,"0.965 0.972 0.99");
    o+=pdTx(X0+4,yt-rh+5,String(sh.r0+k+1),8,0,PDF_GREY)+pdTx(X0+wN+4,yt-rh+5,pdCut(s.name,29),9,0);
    o+=pdLine(X0,yt-rh,X0+W,yt-rh,0.3);
  });
  /* colonnes et cadre */
  for(i=0;i<=nc;i++){x=X0+wN+wNm+i*wC;o+=pdLine(x,top,x,bot,0.4);}
  o+=pdLine(X0+wN,top,X0+wN,bot,0.4)+pdLine(X0+wN+wNm,top,X0+wN+wNm,bot,0.4)+pdLine(tx+wT,top,tx+wT,bot,0.4);
  o+=pdRect(X0,bot,W,top-bot,null,"0.45 0.5 0.58");
  o+=pdTx(40,48,"Édité le "+fmt(today(),true)+" · Classe Master"+(N>1?"   ·   Feuille "+(n+1)+" / "+N:""),8,0,PDF_GREY);
  o+=pdTx(360,48,"Visa du professeur : ______________________",8,0,PDF_GREY);
  return o;
}

function fichePDF(c,ym,mode){
  var B=ficheBuild(c,ym,mode);
  if(!B)return null;
  return{bytes:pdfBytes(B.sheets.map(function(sh,i){return ficheDraw(c,sh,B,i,B.sheets.length);})),fb:B.fb,n:B.sheets.length};
}

document.getElementById("view").addEventListener("click",function(e){
  if(e.target.id!=="fpdf")return;
  var c=cl(),ym=(document.getElementById("fm")||{}).value||today().slice(0,7),mode=(document.getElementById("fc")||{}).value||"wk";
  var r=null,msg=document.getElementById("fmsg");
  try{r=fichePDF(c,ym,mode);}catch(err){msg.textContent="Impossible de créer la fiche. Fermez les autres onglets pour libérer de la mémoire, puis réessayez.";return;}
  if(!r){msg.textContent="Aucun jour de cours ce mois-ci : choisissez « Colonnes vides » ou un autre mois.";return;}
  saveFile("fiche-appel-"+fname(c.name)+"-"+(mode==="blank"?"vierge":ym)+".pdf",r.bytes,"application/pdf",function(m){
    var x=document.getElementById("fmsg");
    if(x)x.textContent=m+(r.fb?" Aucune séance dans l’emploi du temps : les jours du lundi au vendredi ont été utilisés.":"")+(r.n>1?" "+r.n+" feuilles.":"");
  });
});

/* Sauvegarde, import/export, rapports CSV et PDF */
function exportCSV(){
  var c=cl(),L=["Date;Classe;Matière;Élève;Sexe;Statut;Justifiée;Motif"],st={p:"Présent",a:"Absent",r:"Retard"};
  function q(x){return'"'+String(x).replace(/"/g,'""')+'"';}
  Object.keys(c.records).sort().filter(inRange).forEach(function(k){c.students.forEach(function(s){
    var v=c.records[k][s.id];if(!v)return;var n=gn(c,k,s.id);
    L.push([k,q(c.name),q(c.subj||""),q(s.name),(s.g==="F"?"Fille":s.g==="M"?"Garçon":""),st[v],v==="a"?(n.j===true?"Oui":n.j===false?"Non":""):"",q(n.m||"")].join(";"));
  });});
  var data="\ufeff"+L.join("\r\n"),name="presences-"+c.name.replace(/[^\w-]+/g,"_")+".csv";
  saveFile(name,data,"text/csv");
}

function saveFile(name,data,type,cb){
  cb=cb||function(){};
  if(dl){dl.save({filename:name,data:data}).then(function(){cb("Fichier proposé : acceptez le téléchargement dans la fenêtre qui s’affiche.");},function(e){cb(e&&e.code==="declined"?"Téléchargement annulé.":"Le téléchargement n’est pas disponible ici.");});return;}
  if(window.claude){cb("Le téléchargement n’est pas disponible ici.");return;}
  var blob=new Blob([data],{type:type});
  try{
    var f=new File([blob],name,{type:type});
    if(navigator.canShare&&navigator.share&&navigator.canShare({files:[f]})){
      navigator.share({files:[f],title:name}).then(function(){cb("Fichier partagé ou enregistré.");},function(e){if(e&&e.name==="AbortError")cb("Partage annulé.");else classicDownload(blob,name,cb);});
      return;
    }
  }catch(e){}
  classicDownload(blob,name,cb);
}
function classicDownload(blob,name,cb){
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  cb("Téléchargement lancé. Si le fichier n’apparaît pas dans vos téléchargements, utilisez « Copier le texte » plus bas sur cette page.");
}
function exportJSON(all){
  var cls=all?D.classes:[cl()];
  var data=JSON.stringify({app:"appel-matin",version:1,classes:cls});
  shareTxt=data;render();
  saveFile("appel-"+(all?"toutes-les-classes":cl().name.replace(/[^\w-]+/g,"_"))+".json",data,"application/json",function(m){m+=(/disponible/.test(m)?" Utilisez plutôt « Copier le texte » plus bas sur cette page.":"");["xmsg","xmsg0"].forEach(function(i){var e=document.getElementById(i);if(e)e.textContent=m;});});
}
function importJSON(file){
  var fr=typeof file==="string"?{readAsText:function(){fr.result=file;fr.onload();}}:new FileReader();
  fr.onload=function(){
    var add=0,rep=0,bad=0,msg,emp=(!hasData(D)&&D.classes.length===1)?D.classes[0].id:null,nid2=[];
    try{
      var o=JSON.parse(fr.result),ok=/^[\w-]+$/;
      if(!o||o.app!=="appel-matin"||!Array.isArray(o.classes))throw 0;
      o.classes.forEach(function(x){
        if(!x||!ok.test(x.id)||!x.name||!Array.isArray(x.students)||!x.students.every(function(s){return s&&ok.test(s.id)&&s.name})||typeof x.records!=="object"){bad++;return;}
        var n={id:x.id,name:String(x.name),subj:String(x.subj||""),students:x.students.map(function(s){return{id:s.id,name:String(s.name),g:s.g==="F"||s.g==="M"?s.g:""}}),records:x.records||{},notes:x.notes||{},ev:Array.isArray(x.ev)?x.ev:[],ob:Array.isArray(x.ob)?x.ob:[],th:x.th||{a:3,r:3}};
        var i=D.classes.findIndex(function(c){return c.id===n.id});
        if(i<0){D.classes.push(n);add++;nid2.push(n.id);dirty[n.id]=1;}
        else if(confirm("La classe « "+n.name+" » existe déjà. La remplacer par la version du fichier ?")){D.classes[i]=n;rep++;dirty[n.id]=1;}
      });
      if(emp&&add){D.classes=D.classes.filter(function(c){return c.id!==emp});dirty[emp]=1;D.cur=nid2[0];}
      save();
      msg=add+" classe(s) ajoutée(s), "+rep+" remplacée(s)"+(bad?", "+bad+" ignorée(s) (format invalide)":"")+".";
    }catch(e){msg="Ce fichier n’est pas une sauvegarde de cette application.";}
    render();document.getElementById("impmsg").textContent=msg;
  };
  fr.readAsText(file);
}
function renderPart(){
  var f=renderPartFull();
  return'<h1>Sauvegarde et partage</h1><p class="sub">Gardez vos données en sécurité, partagez une classe ou imprimez un bilan.</p>'+(ME?f:f.slice(f.indexOf('<div class="card"><h2>Recevoir des données</h2>')));
}
function renderPartFull(){
  return'<h3 class="sec-t">Sauvegarder</h3>'+
  '<div class="card"><h2>Sauvegarde complète</h2><p class="sub" style="margin-top:0">Toutes vos classes, élèves, appels, notes et réglages dans un seul fichier (.json). Gardez-le en lieu sûr.</p><div class="bar stk" style="margin:0"><button class="btn" id="xall">Télécharger toutes mes données</button></div><p class="sub" id="xmsg0"></p></div>'+
  '<div class="card"><h2>Bilan de présence</h2><p class="sub" style="margin-top:0">Taux de fréquentation et tableau par élève, pour la classe « '+esc(cl().name)+' ».</p>'+filterUI()+'<div class="bar two" style="margin:0"><button class="btn" id="rpdf">Document PDF</button><button class="btn ghost" id="rsvg">Image SVG</button></div><p class="sub" id="rmsg"></p></div>'+
  '<h3 class="sec-t">Partager</h3>'+
  '<div class="card"><h2>Partager une classe</h2><p class="sub" style="margin-top:0">Envoyez uniquement la classe affichée à un collègue.</p><div class="bar stk" style="margin:0"><button class="btn ghost" id="xone">Partager « '+esc(cl().name)+' »</button></div></div>'+
  (shareTxt?'<div class="card"><h2>Texte à copier</h2><p class="sub" style="margin-top:0">Collez-le dans un e-mail ou un message : votre collègue pourra le coller dans « Recevoir des données ».</p><textarea id="sh" readonly style="min-height:90px">'+esc(shareTxt)+'</textarea><div class="bar stk" style="margin:8px 0 0"><button class="btn" id="cpx">Copier le texte</button></div><p class="sub" id="xmsg"></p></div>':"")+
  '<h3 class="sec-t">Recevoir</h3>'+
  '<div class="card"><h2>Recevoir des données</h2><p class="sub" style="margin-top:0">Choisissez un fichier reçu d’un collègue ou une ancienne sauvegarde. Les nouvelles classes sont ajoutées ; si une classe existe déjà, on vous demande si vous voulez la remplacer.</p><input type="file" id="imp" class="sr" accept=".json,application/json"><label class="btn ghost fbtn" for="imp">Choisir un fichier</label><p class="sub" style="margin:12px 0 4px">Ou collez ici le texte reçu :</p><textarea id="pst" style="min-height:80px"></textarea><div class="bar stk" style="margin:8px 0 0"><button class="btn" id="ipt">Importer le texte</button></div><p class="sub" id="impmsg"></p></div>'+
  '<p class="sub note">Le fichier contient les noms des élèves : ne l’envoyez qu’aux personnes autorisées.</p>';
}

function lat(t){return String(t).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/œ/g,"oe").replace(/Œ/g,"OE").replace(/[^\x20-\xFF]/g,"?").replace(/[\\()]/g,"\\$&");}
function reportData(){
  var c=cl(),tot={},ks=Object.keys(c.records).filter(function(k){return Object.keys(c.records[k]).length}).filter(inRange);
  c.students.forEach(function(s){tot[s.id]={a:0,r:0,j:0,n:0}});
  ks.forEach(function(k){Object.keys(c.records[k]).forEach(function(id){
    var v=c.records[k][id];if(!tot[id])return;
    if(v)tot[id].n++;
    if(v==="a"||v==="r"){tot[id][v]++;if(v==="a"&&gn(c,k,id).j===true)tot[id].j++;}
  });});
  var N=0,A=0;c.students.forEach(function(s){N+=tot[s.id].n;A+=tot[s.id].a;});
  var per={all:"Tout l’historique",w:"7 derniers jours",m:"Ce mois-ci",t:"3 derniers mois",c:"Du "+(flt.from?fmt(flt.from):"…")+" au "+(flt.to?fmt(flt.to):"…")}[flt.mode];
  return{title:"Bilan de présence – "+c.name+(c.subj?" ("+c.subj+")":""),
    sub:per+" · "+ks.length+" appel(s) · édité le "+fmt(dstr(new Date()),true),
    rate:fr(N?Math.round((N-A)/N*1000)/10:null),
    head:["Élève","Absences","Justifiées","Retards","Présence"],
    rows:c.students.map(function(s){var t=tot[s.id];return[s.name,String(t.a),String(t.j),String(t.r),fr(rate(t))];})};
}
function pdfBytes(pages){
  var o=[],n=pages.length,i,kids=[];
  for(i=0;i<n;i++)kids.push((5+i*2)+" 0 R");
  o[1]="<< /Type /Catalog /Pages 2 0 R >>";
  o[2]="<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+n+" >>";
  o[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  o[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  for(i=0;i<n;i++){
    o[5+i*2]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+(6+i*2)+" 0 R >>";
    o[6+i*2]="<< /Length "+pages[i].length+" >>\nstream\n"+pages[i]+"\nendstream";
  }
  var out="%PDF-1.4\n",off=[];
  for(i=1;i<o.length;i++){off[i]=out.length;out+=i+" 0 obj\n"+o[i]+"\nendobj\n";}
  var x=out.length;
  out+="xref\n0 "+o.length+"\n0000000000 65535 f \n";
  for(i=1;i<o.length;i++)out+=("0000000000"+off[i]).slice(-10)+" 00000 n \n";
  out+="trailer\n<< /Size "+o.length+" /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF";
  var u=new Uint8Array(out.length);
  for(i=0;i<out.length;i++)u[i]=out.charCodeAt(i)&255;
  return u;
}
function reportPDF(R){
  var pages=[],cur="",y=800,X=[40,300,368,436,500];
  function T(x,yy,t,b,sz){return"BT /"+(b?"F2":"F1")+" "+(sz||10)+" Tf "+x+" "+yy+" Td ("+lat(t)+") Tj ET\n";}
  function head(){var h="",j;for(j=0;j<5;j++)h+=T(X[j],y,R.head[j],1,10);h+="0.5 w 40 "+(y-5)+" m 555 "+(y-5)+" l S\n";y-=20;return h;}
  cur=T(40,y,R.title,1,15);y-=20;
  cur+=T(40,y,R.sub,0,9);y-=26;
  cur+=T(40,y,"Taux de fréquentation de la classe : "+R.rate,1,12);y-=16;
  cur+=T(40,y,"Un retard compte comme une présence.",0,9);y-=28;
  cur+=head();
  R.rows.forEach(function(r){
    if(y<50){pages.push(cur);y=800;cur=head();}
    for(var j=0;j<5;j++)cur+=T(X[j],y,j?r[j]:(r[0].length>40?r[0].slice(0,39)+"…":r[0]),0,10);
    y-=17;
  });
  pages.push(cur);
  return pdfBytes(pages);
}
function reportSVG(R){
  var rh=28,W=760,H=190+R.rows.length*rh+20,X=[24,330,430,530,640],j;
  var o='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+" "+H+'" font-family="Arial, Helvetica, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>';
  o+='<text x="24" y="38" font-size="22" font-weight="700" fill="#16202e">'+esc(R.title)+"</text>";
  o+='<text x="24" y="62" font-size="13" fill="#5d6b7e">'+esc(R.sub)+"</text>";
  o+='<text x="24" y="98" font-size="13" fill="#5d6b7e">Taux de fréquentation de la classe</text>';
  o+='<text x="24" y="132" font-size="32" font-weight="700" fill="#2b4a8b">'+esc(R.rate)+"</text>";
  o+='<rect x="0" y="152" width="'+W+'" height="'+rh+'" fill="#e8edf5"/>';
  for(j=0;j<5;j++)o+='<text x="'+X[j]+'" y="171" font-size="14" font-weight="700" fill="#16202e">'+esc(R.head[j])+"</text>";
  R.rows.forEach(function(r,i){
    var y=152+rh*(i+1);
    if(i%2)o+='<rect x="0" y="'+y+'" width="'+W+'" height="'+rh+'" fill="#f5f7fa"/>';
    for(var k=0;k<5;k++)o+='<text x="'+X[k]+'" y="'+(y+19)+'" font-size="14" fill="#16202e">'+esc(k?r[k]:(r[0].length>40?r[0].slice(0,39)+"…":r[0]))+"</text>";
  });
  return o+"</svg>";
}

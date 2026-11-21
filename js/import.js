/* Import de la liste des élèves : fichier Excel (.xlsx), CSV, ou texte collé depuis Excel */

/* ---- CSV : détecte le séparateur (; , tabulation) et gère les guillemets ---- */
function parseCSV(txt){
  txt=String(txt).replace(/^﻿/,"");
  var first=txt.split(/\r?\n/).filter(function(l){return l.trim();})[0]||"";
  var best=";",bn=0;   /* en cas d’égalité, le point-virgule l’emporte (Excel français) */
  [";","\t",","].forEach(function(d){var n=first.split(d).length;if(n>bn){best=d;bn=n;}});
  var rows=[],row=[],cur="",q=false,i,ch;
  for(i=0;i<txt.length;i++){
    ch=txt[i];
    if(q){if(ch==='"'){if(txt[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else if(ch==='"')q=true;
    else if(ch===best){row.push(cur);cur="";}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&txt[i+1]==="\n")i++;row.push(cur);rows.push(row);row=[];cur="";}
    else cur+=ch;
  }
  if(cur!==""||row.length){row.push(cur);rows.push(row);}
  return rows;
}
/* Texte collé : une ligne par élève ; la tabulation ou le point-virgule sépare les colonnes (copier-coller depuis Excel) */
function textRows(txt){
  return String(txt).split(/\r?\n/).map(function(l){return l.split(/\t|;/);}).filter(function(r){return r.join("").trim();});
}

/* ---- XLSX : lecture directe du classeur (zip + XML), sans bibliothèque ---- */
function u16(b,o){return b[o]|(b[o+1]<<8);}
function u32(b,o){return(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}
function inflateRaw(data){
  if(typeof DecompressionStream==="undefined")return Promise.reject(new Error("nodecomp"));
  var s=new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(s).arrayBuffer().then(function(a){return new Uint8Array(a);});
}
function zipEntries(b){
  var i=b.length-22;
  while(i>=0&&u32(b,i)!==0x06054b50)i--;
  if(i<0)throw new Error("zip");
  var n=u16(b,i+10),p=u32(b,i+16),L={},k,dec=new TextDecoder();
  for(k=0;k<n;k++){
    if(u32(b,p)!==0x02014b50)break;
    var m=u16(b,p+10),cs=u32(b,p+20),nl=u16(b,p+28),el=u16(b,p+30),cl2=u16(b,p+32),lo=u32(b,p+42);
    L[dec.decode(b.subarray(p+46,p+46+nl))]={m:m,cs:cs,lo:lo};
    p+=46+nl+el+cl2;
  }
  return L;
}
function zipRead(b,ent){
  if(!ent)return Promise.resolve(null);
  var o=ent.lo,start=o+30+u16(b,o+26)+u16(b,o+28),data=b.subarray(start,start+ent.cs);
  if(ent.m===0)return Promise.resolve(data);
  if(ent.m===8)return inflateRaw(data);
  return Promise.reject(new Error("zipm"));
}
function xmlDoc(u8){return new DOMParser().parseFromString(new TextDecoder().decode(u8),"application/xml");}
function colIdx(ref){var m=/^([A-Z]+)/.exec(ref||"")||[0,"A"],n=0;for(var i=0;i<m[1].length;i++)n=n*26+m[1].charCodeAt(i)-64;return n-1;}
function readXLSX(buf){
  var b=new Uint8Array(buf),E;
  try{E=zipEntries(b);}catch(e){return Promise.reject(new Error("zip"));}
  var sheetName=Object.keys(E).filter(function(n){return/^xl\/worksheets\/sheet\d+\.xml$/.test(n);}).sort(function(a,c){return parseInt(a.match(/\d+/)[0],10)-parseInt(c.match(/\d+/)[0],10);})[0];
  if(!sheetName)return Promise.reject(new Error("xlsx"));
  return Promise.all([zipRead(b,E["xl/sharedStrings.xml"]),zipRead(b,E[sheetName])]).then(function(r){
    var ss=[];
    if(r[0]){var sd=xmlDoc(r[0]).getElementsByTagName("si");for(var i=0;i<sd.length;i++){var ts=sd[i].getElementsByTagName("t"),s="";for(var j=0;j<ts.length;j++)s+=ts[j].textContent;ss.push(s);}}
    var rows=[],rs=xmlDoc(r[1]).getElementsByTagName("row");
    for(var a=0;a<rs.length;a++){
      var row=[],cs=rs[a].getElementsByTagName("c");
      for(var k=0;k<cs.length;k++){
        var c=cs[k],t=c.getAttribute("t"),v=c.getElementsByTagName("v")[0],val="";
        if(t==="s"&&v)val=ss[+v.textContent]||"";
        else if(t==="inlineStr")val=Array.prototype.map.call(c.getElementsByTagName("t"),function(x){return x.textContent;}).join("");
        else if(v)val=v.textContent;
        row[colIdx(c.getAttribute("r"))]=val;
      }
      for(var z=0;z<row.length;z++)if(row[z]===undefined)row[z]="";
      rows.push(row);
    }
    return rows;
  });
}

/* ---- Lignes de tableau -> élèves ---- */
function sexOf(v){
  var x=nrm(v);
  if(/^(f|fille|feminin|femme|female)$/.test(x))return"F";
  if(/^(m|g|garcon|masculin|homme|male)$/.test(x))return"M";
  return null;
}
function rowsToStudents(rows,defG){
  rows=rows.map(function(r){return r.map(function(x){return String(x===undefined?"":x).trim();});}).filter(function(r){return r.join("")!=="";});
  if(!rows.length)return[];
  var hd=rows[0].map(nrm),isH=hd.some(function(x){return/^(nom|noms|prenom|prenoms|eleve|eleves|nom et prenom|nom prenom|nom complet|sexe|genre|n°|n|no|numero|matricule)/.test(x);});
  var cn=-1,cp=-1,cs=-1,cf=-1;
  if(isH){
    hd.forEach(function(x,i){
      if(/^(sexe|genre)/.test(x))cs=i;
      else if(/^prenom/.test(x)&&cp<0)cp=i;
      else if(/^(nom|noms|eleve|eleves|nom et prenom|nom prenom|nom complet)/.test(x)&&cn<0)cn=i;
    });
    if(cn<0&&cp<0)isH=false;
    else rows=rows.slice(1);
  }
  var out=[];
  rows.forEach(function(r){
    var name,g=null,parts;
    if(isH){
      parts=[];
      if(cn>=0)parts.push(r[cn]);
      if(cp>=0)parts.push(r[cp]);
      name=parts.filter(Boolean).join(" ");
      if(cs>=0)g=sexOf(r[cs]);
    }else{
      parts=[];
      r.forEach(function(x){
        if(!x)return;
        var sx=sexOf(x);
        if(sx&&parts.length&&x.length<=8){g=sx;return;}
        if(/^\d+$/.test(x)||/^\d+[.)]?$/.test(x))return;   /* numéro d’ordre */
        parts.push(x);
      });
      name=parts.join(" ");
    }
    name=name.replace(/\s+/g," ").trim();
    if(name)out.push({name:name,g:g||defG||""});
  });
  return out;
}
/* fichier : true pour un import de fichier (doublons ignorés, confirmation) ; faux pour un texte collé (ajout direct) */
function addStudents(list,fichier){
  var c=cl(),have={},add=0,dup=0;
  c.students.forEach(function(s){have[nrm(s.name)]=1;});
  var fresh=[];
  list.forEach(function(x){var k=nrm(x.name);if(fichier&&have[k]){dup++;return;}have[k]=1;fresh.push(x);});
  var msg;
  if(!fresh.length){msg=list.length?"Aucun nouvel élève : les "+dup+" nom(s) trouvé(s) sont déjà dans la liste.":"Aucun nom d’élève trouvé dans ce fichier.";}
  else{
    var ex=fresh.slice(0,5).map(function(x){return x.name;}).join(", ")+(fresh.length>5?"…":"");
    if(fichier&&!confirm(fresh.length+" élève"+(fresh.length>1?"s":"")+" à ajouter à « "+c.name+" » :\n"+ex+(dup?"\n("+dup+" déjà dans la liste, ignoré"+(dup>1?"s":"")+")":"")+"\n\nContinuer ?"))return false;
    fresh.forEach(function(x){c.students.push({id:uid(),name:x.name,g:x.g});add++;});
    save();
    msg=add+" élève"+(add>1?"s":"")+" ajouté"+(add>1?"s":"")+(dup?", "+dup+" doublon"+(dup>1?"s":"")+" ignoré"+(dup>1?"s":""):"")+".";
  }
  render();
  var m=document.getElementById("immsg");if(m)m.textContent=msg;
  return add>0;
}
function importStudentsFile(f){
  var m=document.getElementById("immsg"),say=function(t){if(m)m.textContent=t;};
  var name=(f.name||"").toLowerCase();
  if(/\.xls$/.test(name)){say("Ancien format .xls non pris en charge : enregistrez le fichier au format .xlsx ou CSV dans Excel, puis réessayez.");return;}
  say("Lecture du fichier…");
  if(/\.xlsx$/.test(name)){
    if(!f.arrayBuffer){say("Ce navigateur ne peut pas lire ce fichier. Utilisez le format CSV.");return;}
    f.arrayBuffer().then(readXLSX).then(function(rows){addStudents(rowsToStudents(rows,""),true);},function(e){
      say(e&&e.message==="nodecomp"?"Ce navigateur ne sait pas ouvrir les fichiers Excel. Enregistrez la liste au format CSV et réessayez.":"Impossible de lire ce fichier Excel. Vérifiez qu’il s’agit d’un .xlsx, ou enregistrez-le au format CSV.");
    });
    return;
  }
  var fr=new FileReader();
  fr.onload=function(){addStudents(rowsToStudents(parseCSV(fr.result),""),true);};
  fr.onerror=function(){say("Impossible de lire ce fichier.");};
  fr.readAsText(f);
}
document.getElementById("view").addEventListener("change",function(e){
  var t=e.target;
  if(t.id==="impl"&&t.files&&t.files[0]){var f=t.files[0];importStudentsFile(f);t.value="";}
});

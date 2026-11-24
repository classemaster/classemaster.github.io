/* Niveaux scolaires : reconnaît le niveau d'un nom de classe (« 6e B », « 6ème A », « 2nde C », « 1ère S », « Tle D », « CM2 »…)
   et donne le nom de la classe de l'année suivante (« 5e B »). Fonctions pures, partagées par l'appli et la page Administration. */
var NIV_NEXT={CP:"CE1",CE1:"CE2",CE2:"CM1",CM1:"CM2",CM2:"6","6":"5","5":"4","4":"3","3":"2nde","2nde":"1ere","1ere":"Tle",Tle:null};
var NIV_LYCEE={"2nde":1,"1ere":1,Tle:1};

/* Découpe un nom de classe : { k: niveau, suf: « e » / « ème »…, sep: séparateur, rest: « B » } ou null si le niveau n'est pas reconnu */
function nivParse(name){
  var s=String(name==null?"":name).replace(/\s+/g," ").trim(),m;
  if((m=/^(CP|CE1|CE2|CM1|CM2)(?![A-Za-z0-9])(\s*)(.*)$/i.exec(s)))return{k:m[1].toUpperCase(),suf:"",sep:m[2],rest:m[3]};
  if((m=/^(Tle|Terminale|Term)(?![A-Za-zÀ-ÿ])(\s*)(.*)$/i.exec(s)))return{k:"Tle",suf:"",sep:m[2],rest:m[3]};
  if((m=/^(1ère|1ere|1re|1ére|première|premiere)(?![A-Za-zÀ-ÿ])(\s*)(.*)$/i.exec(s)))return{k:"1ere",suf:"",sep:m[2],rest:m[3]};
  if((m=/^(2nde|2nd|2de|seconde)(?![A-Za-zÀ-ÿ])(\s*)(.*)$/i.exec(s)))return{k:"2nde",suf:"",sep:m[2],rest:m[3]};
  if((m=/^([3-6])(?![0-9])(?:\s*(èmes?|emes?|ème|eme|è|e|ᵉ)(?![A-Za-zÀ-ÿ]))?(\s*)(.*)$/i.exec(s)))return{k:m[1],suf:m[2]||"",sep:m[3],rest:m[4]};
  return null;
}
/* Nom du niveau « k » écrit dans le style de la classe d'origine (6e / 6ème / 6eme / 6) */
function nivBuild(k,p){
  var digitSrc=/^[3-6]$/.test(p.k),lab;
  if(k==="2nde")lab="2nde";else if(k==="1ere")lab="1ère";else if(k==="Tle")lab="Tle";
  else if(/^[3-6]$/.test(k))lab=k+(digitSrc?p.suf:"e");
  else lab=k;
  if(!p.rest)return lab;
  return lab+(p.sep||(/^[0-9]/.test(p.rest)?" ":""))+p.rest;
}
/* Classe de l'année suivante.
   { known:false } niveau non reconnu · { known:true, last:true } dernière classe (Tle ; 3e si opt.last3) · { known:true, next:"5e B" } */
function nivNext(name,opt){
  var p=nivParse(name),nx;
  if(!p)return{known:false};
  nx=NIV_NEXT[p.k];
  if(p.k==="3"&&opt&&opt.last3)nx=null;
  if(nx===null||nx===undefined)return{known:true,last:true,level:p.k,next:null};
  return{known:true,last:false,level:p.k,next:nivBuild(nx,p)};
}
function nivIsLycee(name){var p=nivParse(name);return!!(p&&NIV_LYCEE[p.k]);}
/* « 2025-2026 » → « 2026-2027 » */
function nivNextYear(lab){var m=/^(\d{4})-(\d{4})$/.exec(String(lab||""));return m?(+m[1]+1)+"-"+(+m[2]+1):"";}

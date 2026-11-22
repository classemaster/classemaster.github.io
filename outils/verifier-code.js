/* Vérification du code avant publication (à lancer depuis la racine du site : node outils/verifier-code.js).
   Nécessite « acorn » (npm install acorn). Contrôle, pour les scripts de index.html pris dans l’ordre :
   1. aucune erreur de syntaxe ;
   2. aucun nom global déclaré dans deux fichiers (le second écraserait le premier sans prévenir) ;
   3. aucune fonction globale d’un fichier réaffectée dans un autre (utiliser hookOn de js/hooks.js à la place) ;
   4. tous les fichiers de index.html existent et sont dans le cache de sw.js, et sw.js ne cite aucun fichier absent. */
var fs=require("fs"),path=require("path"),acorn;
try{acorn=require("acorn");}catch(e){
  try{acorn=require(path.join(process.cwd(),"node_modules","acorn"));}catch(e2){console.error("acorn est introuvable : lancez « npm install acorn » puis relancez.");process.exit(2);}
}
var root=process.cwd(),errors=[],html=fs.readFileSync(path.join(root,"index.html"),"utf8");
function ex(f){return fs.existsSync(path.join(root,f));}

/* fichiers cités par index.html */
var scripts=[],assets=[],m,re=/<script[^>]*\ssrc="([^"]+)"/g;
while((m=re.exec(html)))scripts.push(m[1]);
re=/<(?:link)[^>]*\shref="([^"#?]+\.(?:css|png|svg|webmanifest))"/g;
while((m=re.exec(html)))assets.push(m[1]);
var own=scripts.filter(function(s){return!/^https?:/.test(s)&&s.indexOf("vendor/")<0;});

/* 1-3 : analyse des scripts */
var decl={},fnDecl={},assigns=[];
function walk(node,fn){
  if(!node||typeof node.type!=="string")return;
  fn(node);
  for(var k in node){var v=node[k];if(Array.isArray(v))v.forEach(function(x){walk(x,fn);});else if(v&&typeof v.type==="string")walk(v,fn);}
}
function patNames(p,out){
  if(!p)return;
  if(p.type==="Identifier")out.push(p.name);
  else if(p.type==="ObjectPattern")p.properties.forEach(function(q){patNames(q.value||q.argument,out);});
  else if(p.type==="ArrayPattern")p.elements.forEach(function(q){patNames(q,out);});
  else if(p.type==="AssignmentPattern")patNames(p.left,out);
  else if(p.type==="RestElement")patNames(p.argument,out);
}
/* noms déclarés localement dans une fonction (paramètres, var, fonctions internes) */
function locals(fnNode){
  var out=[];
  fnNode.params.forEach(function(p){patNames(p,out);});
  if(fnNode.id&&fnNode.type==="FunctionExpression")out.push(fnNode.id.name);
  (function inner(n,top){
    if(!n||typeof n.type!=="string")return;
    if(!top&&(n.type==="FunctionDeclaration")){out.push(n.id.name);return;}
    if(!top&&(n.type==="FunctionExpression"||n.type==="ArrowFunctionExpression"))return;
    if(n.type==="VariableDeclaration")n.declarations.forEach(function(d){patNames(d.id,out);});
    if(n.type==="CatchClause"&&n.param)patNames(n.param,out);
    for(var k in n){var v=n[k];if(Array.isArray(v))v.forEach(function(x){inner(x,false);});else if(v&&typeof v.type==="string")inner(v,false);}
  })(fnNode.body,true);
  return out;
}
own.forEach(function(f){
  if(!ex(f)){errors.push("index.html cite « "+f+" » mais le fichier n’existe pas.");return;}
  var src=fs.readFileSync(path.join(root,f),"utf8"),ast;
  try{ast=acorn.parse(src,{ecmaVersion:"latest",sourceType:"script"});}
  catch(e){errors.push(f+" : erreur de syntaxe ("+e.message+")");return;}
  ast.body.forEach(function(n){
    var names=[];
    if(n.type==="FunctionDeclaration"){names.push(n.id.name);(fnDecl[n.id.name]=fnDecl[n.id.name]||[]).push(f);}
    else if(n.type==="VariableDeclaration")n.declarations.forEach(function(d){patNames(d.id,names);});
    names.forEach(function(nm){(decl[nm]=decl[nm]||[]);if(decl[nm].indexOf(f)<0)decl[nm].push(f);});
  });
  /* réaffectations : on suit les portées pour ne pas confondre avec une variable locale de même nom */
  (function visit(node,scopes){
    if(!node||typeof node.type!=="string")return;
    var s=scopes;
    if(node.type==="FunctionDeclaration"||node.type==="FunctionExpression"||node.type==="ArrowFunctionExpression"){s=scopes.concat([locals(node)]);}
    if(node.type==="AssignmentExpression"&&node.left.type==="Identifier"){
      var nm=node.left.name;
      if(!s.some(function(sc){return sc.indexOf(nm)>=0;}))assigns.push([nm,f,node.loc&&node.loc.start.line]);
    }
    for(var k in node){var v=node[k];if(Array.isArray(v))v.forEach(function(x){visit(x,s);});else if(v&&typeof v.type==="string")visit(v,s);}
  })(ast,[]);
});
Object.keys(decl).forEach(function(nm){
  if(decl[nm].length>1)errors.push("Le nom global « "+nm+" » est déclaré dans plusieurs fichiers : "+decl[nm].join(", ")+".");
});
assigns.forEach(function(a){
  var where=fnDecl[a[0]];
  if(where&&where.indexOf(a[1])<0)errors.push("« "+a[0]+" » (déclarée dans "+where.join(", ")+") est réaffectée dans "+a[1]+". Utilisez un point d’extension (hookOn, js/hooks.js).");
});

/* 4 : cache hors ligne */
var sw=fs.readFileSync(path.join(root,"sw.js"),"utf8"),core=[],cm=sw.match(/var CORE=\[([\s\S]*?)\];/);
if(!cm)errors.push("sw.js : liste CORE introuvable.");
else{var r2=/"([^"]+)"/g,x;while((x=r2.exec(cm[1])))core.push(x[1]);}
var vm=sw.match(/var VERSION="([^"]+)"/);
core.forEach(function(f){if(f!=="./"&&!ex(f))errors.push("sw.js : « "+f+" » est dans le cache mais n’existe pas.");});
scripts.concat(assets).filter(function(s){return!/^https?:/.test(s);}).forEach(function(f){
  if(!ex(f))errors.push("index.html cite « "+f+" » mais le fichier n’existe pas.");
  else if(core.indexOf(f)<0)errors.push("« "+f+" » est chargé par index.html mais absent du cache de sw.js (l’application ne s’ouvrirait pas sans internet).");
});

console.log("Version du cache : "+(vm?vm[1]:"?")+" · "+own.length+" scripts analysés · "+core.length+" fichiers en cache");
if(errors.length){console.log("\n"+errors.length+" problème(s) :");errors.forEach(function(e){console.log(" - "+e);});process.exit(1);}
console.log("Aucun problème détecté.");

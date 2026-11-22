/* Fusion à trois voies : combine ce qui a été modifié sur cet appareil et sur un autre, sans rien écraser.
   m3(base, local, remote) renvoie la version fusionnée.
   - base : la dernière version commune (celle de la dernière synchronisation), ou undefined si inconnue.
   - Ce qui n'a changé que d'un côté est repris tel quel (ajouts, modifications, suppressions).
   - Les listes d'objets à identifiant (élèves, évaluations, observations…) sont fusionnées élément par élément.
   - Si la même valeur a été modifiée des deux côtés, celle de cet appareil est gardée et le compteur MG.n augmente.
   - Un élément supprimé d'un côté mais modifié de l'autre est conservé (aucune perte de données). */
var MG={n:0};

function dEq(a,b){
  if(a===b)return true;
  if(a&&b&&typeof a==="object"&&typeof b==="object"){
    if(Array.isArray(a)!==Array.isArray(b))return false;
    var ka=Object.keys(a),kb=Object.keys(b);
    if(ka.length!==kb.length)return false;
    return ka.every(function(k){return Object.prototype.hasOwnProperty.call(b,k)&&dEq(a[k],b[k]);});
  }
  return false;
}
function isObj(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function isKeyed(a){return Array.isArray(a)&&a.every(function(e){return isObj(e)&&typeof e.id==="string";});}

function mergeKeyed(b,l,r){
  var bm={},lm={},rm={},order=[],seen={},out=[];
  (b||[]).forEach(function(e){bm[e.id]=e;});
  l.forEach(function(e){lm[e.id]=e;});
  r.forEach(function(e){rm[e.id]=e;});
  l.concat(r).forEach(function(e){if(!seen[e.id]){seen[e.id]=1;order.push(e.id);}});
  order.forEach(function(id){var v=m3(bm[id],lm[id],rm[id]);if(v!==undefined)out.push(v);});
  return out;
}

function m3(b,l,r){
  if(dEq(l,r))return l;
  if(b!==undefined&&dEq(l,b))return r;       /* seul l'autre appareil a modifié */
  if(b!==undefined&&dEq(r,b))return l;       /* seul cet appareil a modifié */
  if(l===undefined)return r;                 /* absent ici : ajouté ou modifié ailleurs, on le garde */
  if(r===undefined)return l;
  if(isObj(l)&&isObj(r)){
    var out={},seen={};
    Object.keys(l).concat(Object.keys(r)).forEach(function(k){
      if(seen[k])return;seen[k]=1;
      var v=m3(isObj(b)?b[k]:undefined,l[k],r[k]);
      if(v!==undefined)out[k]=v;
    });
    return out;
  }
  if(isKeyed(l)&&isKeyed(r)&&(b===undefined||isKeyed(b)))return mergeKeyed(b,l,r);
  MG.n++;return l;                           /* même valeur modifiée des deux côtés : celle de cet appareil gagne */
}

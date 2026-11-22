/* Stockage des données de l’appareil dans IndexedDB (au lieu de localStorage, limité à environ 5 Mo).
   Principe : au démarrage, tout est lu une fois en mémoire ; le reste de l’application continue de lire et d’écrire
   de façon synchrone (kvGet / kvSet) ; l’écriture réelle sur l’appareil est regroupée et faite juste après.
   Si IndexedDB n’est pas disponible, tout retombe sur localStorage comme avant. */
var IDB={db:null,ok:false,c:{},q:{},t:null,busy:false,failed:false,fail:0,MIG:"appel-idb-v1"};
var KV_SUF=["","-dirty","-base","-trash"];   /* clés volumineuses de chaque compte, rangées dans IndexedDB */

function idbOpen(){
  return new Promise(function(res,rej){
    var r;
    try{r=indexedDB.open("classe-master",1);}catch(e){rej(e);return;}
    r.onupgradeneeded=function(){try{r.result.createObjectStore("kv");}catch(e){}};
    r.onsuccess=function(){res(r.result);};
    r.onerror=function(){rej(r.error||new Error("idb"));};
    r.onblocked=function(){rej(new Error("idb bloqué"));};
  });
}
function idbReadAll(db){
  return new Promise(function(res,rej){
    var o={},tx=db.transaction("kv","readonly"),rq=tx.objectStore("kv").openCursor();
    rq.onsuccess=function(){var c=rq.result;if(c){o[c.key]=c.value;c.continue();}};
    tx.oncomplete=function(){res(o);};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error("lecture"));};
  });
}
function idbPutNow(db,k,v){
  return new Promise(function(res,rej){
    var tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(v,k);
    tx.oncomplete=function(){res();};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error("écriture"));};
  });
}
function idbGetNow(db,k){
  return new Promise(function(res,rej){
    var tx=db.transaction("kv","readonly"),rq=tx.objectStore("kv").get(k);
    tx.oncomplete=function(){res(rq.result);};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error("relecture"));};
  });
}

/* Copie les données déjà présentes dans localStorage vers IndexedDB, vérifie la copie, puis libère localStorage.
   Rien n’est supprimé de localStorage tant que la copie n’a pas été relue à l’identique. */
function idbMigrate(db){
  var bases=["appel-matin-v1"],list=[],chain=Promise.resolve();
  try{var a=JSON.parse(localStorage.getItem("appel-comptes-v1"));if(a&&Array.isArray(a.users))a.users.forEach(function(u){if(u&&u.key&&bases.indexOf(u.key)<0)bases.push(u.key);});}catch(e){}
  bases.forEach(function(b){KV_SUF.forEach(function(s){list.push(b+s);});});
  list.forEach(function(k){
    chain=chain.then(function(){
      var v=null;
      try{v=localStorage.getItem(k);}catch(e){}
      if(v===null)return;
      if(IDB.c[k]!==undefined){try{localStorage.removeItem(k);}catch(e){}return;}   /* déjà copiée auparavant */
      return idbPutNow(db,k,v).then(function(){return idbGetNow(db,k);}).then(function(w){
        if(w===v){IDB.c[k]=v;try{localStorage.removeItem(k);}catch(e){}}
      });
    });
  });
  return chain.then(function(){try{localStorage.setItem(IDB.MIG,"1");}catch(e){}});
}

/* Démarrage : ouvre la base et charge tout en mémoire. Ne rejette jamais : en cas d’échec, IDB.ok reste false. */
function idbInit(){
  var done=false;
  return new Promise(function(resolve){
    function fin(){if(done)return;done=true;resolve();}
    var tm=setTimeout(function(){IDB.failed=true;fin();},4000);   /* certains navigateurs ne répondent jamais en navigation privée */
    if(!window.indexedDB){clearTimeout(tm);IDB.failed=true;fin();return;}
    idbOpen().then(function(db){
      return idbReadAll(db).then(function(all){
        if(done){try{db.close();}catch(e){}return;}   /* trop tard : le démarrage a déjà continué en mode localStorage */
        IDB.db=db;IDB.c=all;
        return idbMigrate(db).then(function(){
          if(done)return;
          IDB.ok=true;clearTimeout(tm);fin();
          if(typeof STO_QUOTA!=="undefined")STO_QUOTA=50000000;   /* valeur prudente en attendant l’estimation du navigateur */
          db.onversionchange=function(){try{db.close();}catch(e){}IDB.ok=false;};
          try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){});}catch(e){}
          try{if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(q){if(q&&q.quota&&typeof STO_QUOTA!=="undefined")STO_QUOTA=q.quota;},function(){});}catch(e){}
        });
      });
    }).catch(function(){clearTimeout(tm);IDB.failed=true;fin();});
  });
}
/* IndexedDB inutilisable alors que les données y ont déjà été rangées : on ne démarre pas à vide */
function idbBlocked(){
  if(IDB.ok||!IDB.failed)return false;
  try{return localStorage.getItem(IDB.MIG)==="1";}catch(e){return false;}
}

function kvGet(k){
  if(!k)return null;
  if(!IDB.ok)return localStorage.getItem(k);
  var p=IDB.q[k];
  if(typeof p==="function"){p=IDB.c[k]=p();IDB.q[k]=p;}
  else if(p===null)return null;
  var v=IDB.c[k];
  return v===undefined?null:v;
}
/* v : texte, ou fonction qui renvoie le texte au moment de l’écriture (regroupe les enregistrements rapprochés) */
function kvSet(k,v){
  if(!k)return;
  if(!IDB.ok){localStorage.setItem(k,typeof v==="function"?v():v);return;}
  if(typeof v!=="function")IDB.c[k]=v;
  IDB.q[k]=v;
  idbPlan(typeof v==="function"?300:50);
}
function kvDel(k){
  if(!k)return;
  if(!IDB.ok){try{localStorage.removeItem(k);}catch(e){}return;}
  delete IDB.c[k];IDB.q[k]=null;
  try{localStorage.removeItem(k);}catch(e){}
  idbPlan(50);
}
function idbPlan(ms){
  if(IDB.t&&!(ms<=50&&!IDB.soon))return;   /* un enregistrement est déjà prévu (au plus tard dans 300 ms) */
  clearTimeout(IDB.t);IDB.soon=ms<=50;
  IDB.t=setTimeout(function(){idbFlush();},ms);
}
/* Écrit tout ce qui est en attente. Renvoie une promesse (résolue aussi en cas d’échec : l’échec est signalé à part). */
function idbFlush(){
  clearTimeout(IDB.t);IDB.t=null;IDB.soon=false;
  if(!IDB.ok||!IDB.db)return Promise.resolve();
  var q=IDB.q,ks=Object.keys(q);
  if(!ks.length)return IDB.busy||Promise.resolve();
  IDB.q={};
  var items=[];
  ks.forEach(function(k){
    var v=q[k];
    if(typeof v==="function"){try{v=v();}catch(e){return;}IDB.c[k]=v;}
    items.push([k,v]);
  });
  var p=new Promise(function(res){
    var tx;
    try{tx=IDB.db.transaction("kv","readwrite");}
    catch(e){back(e);return;}
    var st=tx.objectStore("kv");
    items.forEach(function(x){if(x[1]===null)st.delete(x[0]);else st.put(x[1],x[0]);});
    tx.oncomplete=function(){IDB.fail=0;if(typeof STO_KO!=="undefined"&&STO_KO&&typeof stoOk==="function")stoOk();res();};
    tx.onerror=tx.onabort=function(){back(tx.error);};
    function back(e){
      items.forEach(function(x){if(IDB.q[x[0]]===undefined)IDB.q[x[0]]=x[1];});   /* on garde pour réessayer, sauf si une version plus récente est déjà en attente */
      IDB.fail++;
      if(typeof stoFail==="function")stoFail(e);
      IDB.t=setTimeout(function(){idbFlush();},Math.min(IDB.fail,6)*5000);
      res();
    }
  });
  IDB.busy=p;p.then(function(){if(IDB.busy===p)IDB.busy=false;});
  return p;
}
window.addEventListener("pagehide",function(){idbFlush();});
document.addEventListener("visibilitychange",function(){if(document.hidden)idbFlush();});

/* Efface toutes les données d’un compte sur l’appareil */
function kvWipe(key){
  if(!key)return;
  KV_SUF.forEach(function(s){kvDel(key+s);});
  try{["-shh","-lastbk","-lastsync","-bk0","-bksnz"].forEach(function(x){localStorage.removeItem(key+x);});}catch(e){}
}
/* Taille occupée par les données rangées dans IndexedDB (en caractères) */
function idbSize(){var n=0,k;for(k in IDB.c){var v=IDB.c[k];n+=k.length+(typeof v==="string"?v.length:0);}return n;}

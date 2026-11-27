/* Consultation hors ligne des pages de l'établissement (v99).
   Principe : le réseau d'abord. Si le chef a coché « Garder les données sur cet appareil » (Paramètres), chaque réponse de LECTURE reçue
   est copiée dans IndexedDB ; sans réseau, la dernière copie est rendue à la page. Rien n'est modifiable hors ligne.
   Les codes famille, les téléphones des parents et le code d'accès des enseignants ne sont jamais enregistrés.
   Tout est effacé à la déconnexion (js/supabase.js), si l'accès est retiré, et après 30 jours sans mise à jour.
   Un seul nom global : « EtabOffline ». */
var EtabOffline=(function(){
  var DB="cm-etab-offline",FLAG="cm-etab-offline",AUTH="appel-supabase-auth",MAXAGE=30*864e5,WAIT=8000;
  var TABLES=["registry_students","registry_log","registry_decisions"];
  var RPC=["is_admin","mes_etablissements","etab_membres_liste","admin_dashboard","admin_teaching","admin_discipline","etab_classes_liste",
    "etab_matieres_liste","etab_affectations_liste","admin_assignments","etab_journal","etab_messages_liste","rentrees_liste"];
  var me={used:false,since:0,missing:false,onchange:null};

  function ls(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  /* compte connecté sur cet appareil (même si son jeton a expiré) */
  function user(){try{var s=JSON.parse(ls(AUTH));return s&&s.user&&s.user.id?s.user:null;}catch(e){return null;}}
  function expired(){try{var s=JSON.parse(ls(AUTH));return!s.expires_at||s.expires_at*1000<Date.now()+90000;}catch(e){return true;}}
  function enabled(){var u=user();return!!u&&ls(FLAG)===u.id;}

  /* ---------- Stockage : la base est ouverte puis refermée à chaque opération, pour que l'effacement ne soit jamais bloqué ---------- */
  function tx(mode,work){
    return new Promise(function(res,rej){
      var o;try{o=indexedDB.open(DB,1);}catch(e){rej(e);return;}
      o.onupgradeneeded=function(){o.result.createObjectStore("r");};
      o.onerror=function(){rej(o.error);};
      o.onsuccess=function(){
        var db=o.result,t,q;db.onversionchange=function(){db.close();};
        try{t=db.transaction("r",mode);q=work(t.objectStore("r"));}catch(e){db.close();rej(e);return;}
        t.oncomplete=function(){db.close();res(q&&q.result);};
        t.onerror=t.onabort=function(){db.close();rej(t.error);};
      };
    });
  }
  function get(k){return tx("readonly",function(s){return s.get(k);}).then(function(v){return v&&Date.now()-v.at<MAXAGE?v:null;},function(){return null;});}
  function put(k,v){return tx("readwrite",function(s){s.put(v,k);}).catch(function(){});}
  function clear(){return tx("readwrite",function(s){s.clear();}).catch(function(){});}

  function enable(){var u=user();if(!u)return false;try{localStorage.setItem(FLAG,u.id);}catch(e){return false;}return true;}
  function disable(){try{localStorage.removeItem(FLAG);}catch(e){}return clear();}
  /* date de la copie la plus récente (0 : rien d'enregistré) */
  function saved(){var max=0;return tx("readonly",function(s){var q=s.openCursor();q.onsuccess=function(){var c=q.result;if(c){if(c.value.at>max)max=c.value.at;c.continue();}};}).then(function(){return max;},function(){return 0;});}

  /* ---------- Ce qui est lu, et ce qui ne doit jamais être enregistré ---------- */
  function readName(url,method){
    var m=/\/rest\/v1\/(rpc\/)?([a-z_0-9]+)(\?|$)/.exec(url);if(!m)return"";
    if(m[1])return RPC.indexOf(m[2])>=0?m[2]:"";
    return method==="GET"&&TABLES.indexOf(m[2])>=0?m[2]:"";
  }
  function clean(name,txt){
    var drop=name==="registry_students"?["code","phone"]:name==="mes_etablissements"?["code"]:null;
    if(!drop)return txt;
    var d=JSON.parse(txt);
    [].concat(d).forEach(function(x){if(x)drop.forEach(function(k){delete x[k];});});
    return JSON.stringify(d);
  }
  function hdr(h,n){if(!h)return"";if(typeof h.get==="function")return h.get(n)||"";return h[n]||h[n.toLowerCase()]||"";}
  function changed(){if(me.onchange)me.onchange();}
  function fromCache(v){
    me.used=true;if(!me.since||v.at<me.since)me.since=v.at;changed();
    var h={"content-type":"application/json"};if(v.range)h["content-range"]=v.range;
    return new Response(v.body,{status:200,headers:h});
  }

  /* Remplace fetch pour le client Supabase (voir js/supabase.js) */
  function cmFetch(input,init){
    init=init||{};
    var url=String((input&&input.url)||input),method=String(init.method||"GET").toUpperCase(),name=readName(url,method),u=user();
    if(!name||!u||!enabled())return fetch(input,init);
    var key=u.id+"|"+method+"|"+url+"|"+(init.body||""),auth=hdr(init.headers,"Authorization");
    /* une réponse obtenue sans session (clé publique seule) n'est ni enregistrée ni crue */
    var anon=!auth||auth==="Bearer "+SUPABASE_KEY;
    return get(key).then(function(v){
      function fallback(e){if(v)return fromCache(v);me.missing=true;changed();throw e;}
      var offline=new TypeError("Failed to fetch");
      if(navigator.onLine===false||(anon&&me.forced))return fallback(offline);
      var net=fetch(input,init);
      /* réseau très lent : au bout de quelques secondes, on montre la copie si elle existe */
      if(v)net=Promise.race([net,new Promise(function(_,rej){setTimeout(function(){rej(offline);},WAIT);})]);
      return net.then(function(r){
        if(r.status>=500||r.status===408||r.status===429)return v?fromCache(v):r;
        if(!r.ok)return r;
        if(anon)return v?fromCache(v):r;
        return r.clone().text().then(function(txt){
          var d;try{d=JSON.parse(txt);}catch(e){return v?fromCache(v):r;}   /* page de connexion d'un réseau Wi-Fi, par exemple */
          /* accès retiré : on efface tout */
          if((name==="is_admin"&&d===false)||(name==="mes_etablissements"&&Array.isArray(d)&&!d.some(function(x){return x.role==="admin";})))return clear().then(function(){return r;});
          if(!enabled())return r;
          return put(key,{at:Date.now(),body:clean(name,txt),range:r.headers.get("content-range")||""}).then(function(){return r;});
        });
      },fallback);
    });
  }

  /* Session impossible à renouveler faute de réseau : les lectures passent par un second client sans session, servi par les copies.
     (Le client principal attendrait environ 30 secondes avant chaque lecture.) */
  function force(){
    if(me.forced||!sb||!window.supabase)return;
    me.forced=true;
    var c=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"cm-etab-lecture"},global:{fetch:cmFetch}});
    sb.rpc=c.rpc.bind(c);sb.from=c.from.bind(c);
    me.used=true;
  }
  /* Session à utiliser au démarrage d'une page : done(utilisateur ou null) */
  function session(done){
    var fini=false;
    function end(u){if(fini)return;fini=true;done(u);}
    function local(){if(fini)return;if(enabled()){force();end(user());return true;}return false;}
    if(enabled()&&navigator.onLine===false&&expired()){local();return;}
    var t=enabled()?setTimeout(local,WAIT):0;
    sb.auth.getSession().then(function(r){
      clearTimeout(t);var s=r&&r.data&&r.data.session;
      if(s){end(s.user);return;}
      /* session toujours présente sur l'appareil : le renouvellement a échoué faute de réseau */
      if(!local())end(null);
    },function(){clearTimeout(t);if(!local())end(null);});
  }

  me.fetch=cmFetch;me.session=session;me.enabled=enabled;me.enable=enable;me.disable=disable;me.saved=saved;me.user=user;
  return me;
})();

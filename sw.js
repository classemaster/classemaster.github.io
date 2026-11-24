/* Classe Master : fonctionnement hors ligne.
   Les fichiers de l’application sont gardés sur l’appareil ; les échanges avec Supabase ne passent jamais par ici.
   Changez VERSION à chaque mise à jour pour forcer le rafraîchissement du cache. */
var VERSION="cm-v75";
var CORE=["./", "index.html", "manifest.webmanifest", "css/features.css", "css/carnet.css", "css/design.css", "css/charts.css", "css/graphiques.css", "css/print.css", "css/undo.css", "css/liste.css", "js/liste.js", "js/aide.js", "js/tour.js", "aide-etablissement.html", "css/guide.css", "js/merge.js", "js/undo.js", "js/graphiques.js", "js/graphiques/core.js", "js/graphiques/donut-chart.js", "js/graphiques/charts.js", "js/graphiques/charts-extra.js", "js/graphiques/charts-more.js", "css/style.css", "css/theme.css", "js/appel.js", "js/theme.js", "js/parents.js", "js/share.js", "parent.html", "js/saisie.js", "js/prevention.js", "js/annee.js", "js/stats-eleve.js", "js/compare.js", "js/archive.js", "js/bulletins.js", "js/fiche.js", "js/cahier.js", "js/carnet.js", "js/import.js", "js/moyennes.js", "js/progression.js", "js/auth.js", "js/bilan.js", "js/classes.js", "js/devoirs.js", "js/events.js", "js/telecharger.js", "js/export.js", "js/horaires.js", "js/rappels.js", "js/hooks.js", "js/idb.js", "js/main.js", "js/maj.js", "js/nav.js", "js/notes.js", "js/observations.js", "js/recherche.js", "js/state.js", "js/suivi.js", "js/supabase.js", "js/sync.js", "js/etab.js", "js/niveaux.js", "js/rentree.js", "js/design.js", "js/utils.js", "js/vendor/supabase.js", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/icon-maskable.svg", "icons/icon.svg"];
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){return Promise.all(CORE.map(function(u){return c.add(u).catch(function(){});}));}).then(function(){return self.skipWaiting();}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(e){
  var r=e.request;
  if(r.method!=="GET")return;
  var u=new URL(r.url);
  var same=u.origin===self.location.origin;
  var font=u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com";
  if(!same&&!font)return;   /* Supabase, Google, etc. : réseau uniquement */
  if(same&&/\/(admin|etablissement|contact)\.html$/.test(u.pathname))return;   /* pages d’administration : jamais gardées sur l’appareil */
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(r,{ignoreSearch:same&&r.mode==="navigate"}).then(function(hit){
      var net=fetch(r).then(function(res){
        if(res&&(res.ok||res.type==="opaque"))c.put(r,res.clone());
        return res;
      }).catch(function(){return null;});
      if(hit){e.waitUntil(net);return hit;}
      return net.then(function(res){
        if(res)return res;
        if(r.mode==="navigate")return c.match("index.html").then(function(h){return h||c.match("./");});
        return new Response("",{status:504,statusText:"Hors ligne"});
      });
    });
  }));
});
/* Touche sur une notification de rappel : on ramène l’application au premier plan (ou on l’ouvre) */
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(l){
    for(var i=0;i<l.length;i++){if("focus" in l[i])return l[i].focus();}
    return self.clients.openWindow("./");
  }));
});

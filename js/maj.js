/* Mise à jour de l’application : prévient quand une nouvelle version est prête et propose de recharger.
   Le service worker (sw.js) télécharge la nouvelle version en arrière-plan ; sans ce bandeau, elle n’apparaîtrait qu’à la prochaine ouverture. */
(function(){
  if(!("serviceWorker" in navigator)||!/^https?:$/.test(location.protocol))return;
  var had=!!navigator.serviceWorker.controller,shown=false,dismissed=false;
  navigator.serviceWorker.addEventListener("controllerchange",function(){
    if(!had){had=true;return;}   /* première installation : ce n’est pas une mise à jour */
    showBar();
  });
  function check(){
    try{navigator.serviceWorker.getRegistration().then(function(r){if(r)r.update().catch(function(){});},function(){});}catch(e){}
  }
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&navigator.onLine)check();});
  window.addEventListener("online",check);
  setInterval(function(){if(!document.hidden&&navigator.onLine)check();},30*60*1000);
  setTimeout(check,20000);
  function showBar(){
    if(shown||dismissed)return;shown=true;
    var d=document.createElement("div");
    d.className="gban gban-w";d.setAttribute("role","status");
    d.style.cssText="position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:80;max-width:560px;margin:0 auto;box-shadow:0 4px 18px rgba(0,0,0,.28);background:var(--card,var(--surface,#fff));color:var(--ink,#16202e)";
    d.innerHTML='<span><b>Mise à jour disponible.</b> Rechargez pour utiliser la nouvelle version.</span><button class="btn" id="majgo">Recharger</button><button class="btn ghost" id="majno" aria-label="Plus tard" style="min-width:42px">×</button>';
    document.body.appendChild(d);
    document.getElementById("majgo").onclick=function(){
      try{if(typeof local==="function")local();}catch(e){}   /* enregistre ce qui est en cours avant de recharger */
      var go=function(){location.reload();};
      try{Promise.resolve(typeof idbFlush==="function"&&idbFlush()).then(go,go);setTimeout(go,3000);}catch(e){go();}
    };
    document.getElementById("majno").onclick=function(){dismissed=true;shown=false;d.remove();};
  }
})();

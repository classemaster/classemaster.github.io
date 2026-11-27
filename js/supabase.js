/* Configuration et client Supabase */
var SUPABASE_URL="https://wnlsxtmekyvtizdwxxuc.supabase.co";
/* Clé publique (anon / publishable) : Supabase > Project Settings > API Keys. Elle peut être publiée, la sécurité repose sur les règles RLS. */
var SUPABASE_KEY="sb_publishable_bvqo1dbvZ0b9THOXxqsUDQ_XJJW69AH";
var sb=null,RECOVERY=/type=recovery/.test(location.hash);
function cmEffacerHorsLigne(){
  try{localStorage.removeItem("cm-etab-offline");}catch(e){}
  try{indexedDB.deleteDatabase("cm-etab-offline");}catch(e){}
}
(function(){
  if(!window.supabase||!supabase.createClient||SUPABASE_KEY.indexOf("COLLEZ")===0)return;
  try{sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"appel-supabase-auth"},
    /* pages de l'établissement : lecture hors ligne (js/etab-offline.js) ; ailleurs, fetch ordinaire */
    global:{fetch:function(u,o){return window.EtabOffline?window.EtabOffline.fetch(u,o):fetch(u,o);}}});}catch(e){sb=null;}
  if(!sb||!sb.auth)return;
  /* à la déconnexion (depuis n'importe quelle page), les données gardées pour la consultation hors ligne sont effacées */
  var out=sb.auth.signOut;
  if(out)sb.auth.signOut=function(){cmEffacerHorsLigne();return out.apply(sb.auth,arguments);};
  if(sb.auth.onAuthStateChange)sb.auth.onAuthStateChange(function(ev){if(ev==="SIGNED_OUT")cmEffacerHorsLigne();});
})();

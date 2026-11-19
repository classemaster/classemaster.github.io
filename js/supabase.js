/* Configuration et client Supabase */
var SUPABASE_URL="https://wnlsxtmekyvtizdwxxuc.supabase.co";
/* Clé publique (anon / publishable) : Supabase > Project Settings > API Keys. Elle peut être publiée, la sécurité repose sur les règles RLS. */
var SUPABASE_KEY="COLLEZ_ICI_VOTRE_CLE_PUBLIQUE";
var sb=null,RECOVERY=/type=recovery/.test(location.hash);
(function(){
  if(!window.supabase||!supabase.createClient||SUPABASE_KEY.indexOf("COLLEZ")===0)return;
  try{sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"appel-supabase-auth"}});}catch(e){sb=null;}
})();

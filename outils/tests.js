/* Tests automatiques des calculs et de la fusion — à lancer avant chaque publication :  node outils/tests.js
   Charge les vrais scripts de l'application (sans navigateur) et vérifie les résultats attendus. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");

function stub() { const f = function () { return stub(); }; return new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : k === "length" ? 0 : k === "then" ? undefined : stub()), set: () => true, apply: () => stub(), construct: () => stub() }); }
const store = {};
const ctx = {
  console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, Date, Math, JSON, Promise, Uint8Array, Intl, String, Number, Array, Object, RegExp, Error, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  Blob: class { constructor(p, o) { this.p = p; this.type = o && o.type; } }, File: class {}, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  navigator: { userAgent: "test" }, location: { hash: "", search: "", protocol: "https:", href: "https://x/" }, history: {}, indexedDB: undefined,
  document: new Proxy({ getElementById: () => stub(), addEventListener() {}, querySelector: () => stub(), querySelectorAll: () => [], createElement: () => stub(), body: stub(), documentElement: stub() }, { get: (t, k) => (k in t ? t[k] : stub()) }),
  matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, requestAnimationFrame() {},
};
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/vendor|graphiques\//.test(s));
files.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f }));
const run = code => vm.runInContext(code, ctx);

let ok = 0, ko = 0;
function t(name, fn) { try { const r = fn(); if (r === true) { ok++; } else { ko++; console.log("ÉCHEC :", name, "→", JSON.stringify(r)); } } catch (e) { ko++; console.log("ERREUR :", name, "→", e.message); } }
const J = x => JSON.stringify(x);
ctx.__j = J;

/* ---- Trimestres et année scolaire ---- */
t("T3 au 31 août", () => run('autoTr("2026-08-31")') === 3);
t("T1 au 1er septembre", () => run('autoTr("2026-09-01")') === 1);
t("T1 au 31 décembre", () => run('autoTr("2026-12-31")') === 1);
t("T2 au 1er janvier", () => run('autoTr("2027-01-01")') === 2);
t("T2 au 31 mars", () => run('autoTr("2027-03-31")') === 2);
t("T3 au 1er avril", () => run('autoTr("2027-04-01")') === 3);
t("année scolaire d'octobre 2026", () => run('syLabel("2026-10-05")') === "2026-2027");
t("année scolaire de février 2027", () => run('syLabel("2027-02-05")') === "2026-2027");
t("trimestre choisi par l'enseignant prioritaire", () => run('trOf({tr:3,d:"2026-10-05"})') === 3);

/* ---- Moyennes ---- */
const cls = `({id:"c",name:"6e A",subj:"Maths",students:[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"},{id:"d",name:"D"}],records:{},
  ev:[{id:"e1",d:"2026-10-05",n:"DS1",m:20,s:{a:10,b:10,c:20}},
      {id:"e2",d:"2026-10-20",n:"DS2",m:10,k:2,s:{a:10,b:5,c:"abs"}},
      {id:"e3",d:"2027-01-10",n:"DS3",m:20,s:{a:20}}]})`;
t("moyenne pondérée T1 (coef 1 et 2)", () => Math.abs(run(`sAvg(${cls},"a",1)`) - (10 * 1 + 20 * 2) / 3) < 1e-9);
t("note ramenée sur 20", () => Math.abs(run(`sAvg(${cls},"b",1)`) - (10 * 1 + 10 * 2) / 3) < 1e-9);
t("absence (texte) ignorée", () => run(`sAvg(${cls},"c",1)`) === 20);
t("élève sans note → null", () => run(`sAvg(${cls},"d",1)`) === null);
t("moyenne annuelle = moyenne des trimestres notés", () => Math.abs(run(`sAvg(${cls},"a","A")`) - ((50 / 3 + 20) / 2)) < 1e-9);
t("barème 0 ignoré (pas de division par zéro)", () => run('sAvg({students:[],ev:[{d:"2026-10-01",m:0,s:{a:5}}]},"a","")') === null);
t("rang : ex æquo même rang", () => { const m = run(`rankMap(({id:"x",students:[{id:"a"},{id:"b"},{id:"c"},{id:"d"}],ev:[{d:"2026-10-01",m:20,s:{a:15,b:15,c:10}}]}),1)`); return m.a.r === 1 && m.b.r === 1 && m.c.r === 3 && m.d.r === null && m.a.n === 3; });

/* ---- Présences ---- */
t("taux de présence", () => run("rate({n:20,a:5})") === 75);
t("taux de présence sans appel → null", () => run("rate({n:0,a:0})") === null);
t("comptage absences/retards", () => { const o = run('cnt({records:{"2026-10-01":{a:"a"},"2026-10-02":{a:"r"},"2026-10-03":{a:"a"}}},"a",["2026-10-01","2026-10-02","2026-10-03","2026-10-04"])'); return o.a === 2 && o.r === 1; });
t("alerte au seuil par défaut (3)", () => run('alertTxt({},{a:3,r:0})') === "3 absences" && run('alertTxt({},{a:2,r:2})') === "");
t("seuil 0 = alerte désactivée", () => run('alertTxt({th:{a:0,r:0}},{a:9,r:9})') === "");

/* ---- Fusion entre appareils (aucune perte de données) ---- */
t("seul l'autre appareil a modifié", () => run('m3({x:1},{x:1},{x:2}).x') === 2);
t("seul cet appareil a modifié", () => run('m3({x:1},{x:5},{x:1}).x') === 5);
t("champs différents des deux côtés : tout est gardé", () => { const r = run('m3({a:1,b:1},{a:2,b:1},{a:1,b:3})'); return r.a === 2 && r.b === 3; });
t("même champ des deux côtés : cet appareil gagne + compteur", () => { const n0 = run("MG.n"); const r = run("m3({a:1},{a:2},{a:3})"); return r.a === 2 && run("MG.n") === n0 + 1; });
t("ajouts des deux côtés dans une liste à identifiants", () => { const r = run('m3([{id:"a"}],[{id:"a"},{id:"l"}],[{id:"a"},{id:"r"}])'); return r.length === 3; });
t("supprimé d'un côté, modifié de l'autre : conservé", () => { const r = run('m3([{id:"a",v:1}],[],[{id:"a",v:2}])'); return r.length === 1 && r[0].v === 2; });
t("supprimé d'un côté, inchangé de l'autre : supprimé", () => run('m3([{id:"a",v:1}],[],[{id:"a",v:1}])').length === 0);
t("dEq profond", () => run('dEq({a:[1,{b:2}]},{a:[1,{b:2}]})') === true && run('dEq({a:[1]},{a:[2]})') === false);

/* ---- Échappement HTML ---- */
t("esc neutralise < > & \" '", () => run(`esc("<img src='x' onerror=\\"y\\">&")`) === "&lt;img src=&#39;x&#39; onerror=&quot;y&quot;&gt;&amp;");

/* ---- PDF : fichiers valides ---- */
const cPdf = `({id:"c",name:"6e A",subj:"Maths",students:[{id:"a",name:"Élève Œuvre"},{id:"b",name:"Sans note"}],records:{},th:{a:3,r:3},
  ev:[{id:"e1",d:"2026-10-05",n:"DS1",m:20,s:{a:15}}]})`;
["1", "2", "3", '"A"', '""'].forEach(p => t("relevé PDF valide (période " + p + ")", () => { const b = run(`relevePDF(${cPdf},${p})`); const s = Buffer.from(b).toString("latin1"); return s.startsWith("%PDF-") && s.trimEnd().endsWith("%%EOF"); }));
t("bulletins PDF valides", () => { const s = Buffer.from(run(`bulletinsPDF(${cPdf},1)`)).toString("latin1"); return s.startsWith("%PDF-") && s.trimEnd().endsWith("%%EOF"); });

/* ---- Copie de secours à la fermeture (idb.js) ---- */
t("copie de secours puis restauration", () => {
  run('IDB.ok=true;IDB.c={};IDB.q={"k1":"v1","k2":function(){return "v2";},"k3":null};');
  run("idbEmergency()");
  const saved = JSON.parse(store["cm-idb-pending"]);
  if (saved.k1 !== "v1" || saved.k2 !== "v2" || saved.k3 !== null) return J(saved);
  run('IDB.c={};IDB.q={};');
  const restored = run("idbRestorePending()");
  return restored === true && run("IDB.c.k1") === "v1" && run("IDB.c.k2") === "v2" && run("IDB.q.k3") === null;
});
t("copie de secours illisible ignorée", () => { store["cm-idb-pending"] = "{pas du json"; run("IDB.c={};IDB.q={};"); return run("idbRestorePending()") === false; });

/* Messages d'erreur : jamais de texte anglais brut à l'écran */
t("erreur réseau traduite", () => run('frErr({message:"Failed to fetch"})') === "pas de connexion internet");
t("erreur de droits traduite", () => run('frErr({code:"42501",message:"new row violates row-level security policy"})') === "action non autorisée pour votre compte");
t("session expirée traduite", () => run('frErr({status:401,message:"JWT expired"})') === "votre session a expiré, reconnectez-vous");
t("fonction absente traduite", () => /absent côté serveur/.test(run('frErr({code:"PGRST202",message:"Could not find the function"})')));
t("erreur inconnue : message neutre en français", () => run('frErr({message:"Some weird English thing"})') === "erreur inattendue");
t("frErr ne plante pas sans argument", () => run("frErr()") === "erreur inattendue");

/* Aide intégrée */
t("aide : toutes les rubriques sont affichées", () => { const h = run("renderAide()"); return /Premiers pas/.test(h) && /Ça ne marche pas/.test(h) && (h.match(/<details/g) || []).length === run("AIDE.length"); });
t("aide : aucune rubrique vide", () => run("AIDE.every(function(r){return r[0]&&r[1].length>0;})") === true);
t("carte Aide du compte ouvre l'écran aide", () => /data-go="aide"/.test(run("aideCard()")));

/* Visite guidée */
t("visite : 6 étapes complètes", () => run("TOUR.length") === 6 && run("TOUR.every(function(s){return s.t&&s.x;})") === true);
t("visite : vue une fois, mémorisée par compte", () => { run('ME={id:"u1"};'); const a = run("tourSeen()"); run("tourMark()"); const b = run("tourSeen()"); run('ME={id:"u2"};'); return a === false && b === true && run("tourSeen()") === false; });
t("visite : pas de lancement automatique sans compte", () => { run("ME=null;tourI=-1;"); run("tourAuto()"); return run("tourI") === -1; });

/* ---- Établissements (v60) : code d'accès, rattachement des classes, script SQL ---- */
t("code établissement : espaces, tirets et minuscules ignorés", () => run('etabNorm(" k7m2-qx4p ")') === "K7M2QX4P");
t("code établissement : affichage XXXX-XXXX", () => run('etabFmt("k7m2qx4p")') === "K7M2-QX4P");
t("code établissement : valide", () => run('etabCodeOk("K7M2-QX4P")') === true);
t("code établissement : refuse 0, 1, I, O et les longueurs fausses", () => run('etabCodeOk("K7M2QX40")') === false && run('etabCodeOk("K7M2QXIP")') === false && run('etabCodeOk("K7M2QX4")') === false && run('etabCodeOk("")') === false);
t("code établissement : messages d'erreur clairs", () => /8 caractères/.test(run('etabCodeMsg("AB")')) && /0, 1, I ni O/.test(run('etabCodeMsg("K7M2QX40")')) && /inconnu/i.test(run('etabMsg("unknown_code")')));
t("établissement : la classe garde son établissement à l'envoi et au retour", () => run('fromRow(toRow({id:"a",name:"6e B",students:[],records:{},et:"e1"},"u",0)).et') === "e1");
t("établissement : un compte sans établissement est dirigé vers l'écran de rattachement", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.list=[];ETAB.loaded=true;view="home";etabGate();');
  const a = run("view"); run('ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null}];ETAB.cur="e1";etabGate();');
  const b = run("view"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;"); return a === "etab" && b === "home";
});
t("établissement : l'administrateur voit le code, l'enseignant non", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:"K7M2QX4P",membres:2,ouvert:true}];ETAB.cur="e1";');
  const adm = run("etabCard()"); run('ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null,membres:2}];');
  const ens = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /K7M2-QX4P/.test(adm) && !/K7M2/.test(ens) && /Quitter/.test(ens);
});
t("v63 : l'inscription ne propose plus enseignant / chef d'établissement", () => {
  run('sb={};ACC={users:[]};');
  const h = run("renderSignup()"); run("sb=null;ACC=null;");
  return !/Chef d’établissement|emode|Code de l’établissement/.test(h) && /id="sgo"/.test(h);
});
t("v63 : après la création du compte, l'écran de choix propose les deux types", () => {
  const h = run("renderEtab()"); return /Enseignant/.test(h) && /Chef d’établissement/.test(h) && /validé par un administrateur/.test(h);
});
t("v63 : établissement en attente : pas de code, bouton de vérification", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"en_attente"}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /En attente de validation/.test(h) && /etchk/.test(h) && !/ecode/.test(h);
});
t("v63 : établissement validé : le code s'affiche", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:"K7M2QX4P",statut:"valide",membres:1}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /K7M2-QX4P/.test(h);
});
t("v69 : page de l'administrateur du site (admin.html) distincte de celle du chef (etablissement.html), sans aucun lien dans l'application", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8"), chef = fs.readFileSync(path.join(root, "etablissement.html"), "utf8");
  const src = ["etab.js", "auth.js", "nav.js", "events.js"].map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
  return /est_admin_plateforme/.test(adm) && /sa_etablissements/.test(adm) && /sa_changer_statut/.test(adm) && !/signUp/.test(adm) && !/signUp/.test(chef) && !/Créer le compte administrateur/.test(chef) &&
    !/admin_dashboard|registry_students/.test(adm) &&
    /is_admin/.test(chef) && /admin_dashboard/.test(chef) && !/est_admin_plateforme/.test(chef) &&
    /location\.href="etablissement\.html"/.test(src) && !/admin\.html/.test(src) && !/plateforme/.test(src);
});
const sqlV63 = fs.readFileSync(path.join(root, "supabase", "validation-etablissements-v63.sql"), "utf8");
t("SQL v63 : statut, administrateurs de plateforme, blocage serveur tant que non validé", () =>
  ["plateforme_admins", "est_admin_plateforme", "sa_etablissements", "sa_decider_etablissement", "etab_annuler_demande"].every(n => sqlV63.includes(n)) &&
  /is_etab_admin[\s\S]*x\.statut = 'valide'/.test(sqlV63) && /'err', 'pending'/.test(sqlV63));
t("SQL v63 : l'administrateur du site ne reçoit ni classes, ni élèves, ni salles", () => {
  const f = sqlV63.slice(sqlV63.indexOf("function public.sa_etablissements"), sqlV63.indexOf("function public.sa_decider_etablissement"));
  return f.length > 100 && !/registry_|classes|eleves|salles/i.test(f);
});
const sqlV60 = fs.readFileSync(path.join(root, "supabase", "etablissements-v60.sql"), "utf8");
t("SQL v60 : toutes les fonctions et tables prévues", () => ["etablissements", "etab_membres", "etab_essais", "creer_etablissement", "rejoindre_etablissement", "mes_etablissements", "etab_membres_liste", "etab_retirer", "etab_definir_role", "etab_nouveau_code", "etab_ouvrir", "etab_renommer", "etab_quitter", "is_etab_admin", "can_admin_student", "gen_etab_code", "admin_assign", "admin_unassign", "admin_assignments"].every(n => sqlV60.includes(n)));
t("SQL v60 : plus aucun filtre « mon compte seul » sur les dossiers", () => !/g\.user_id = \(select auth\.uid\(\)\)/.test(sqlV60));
t("SQL v60 : les tableaux de bord filtrent par établissement", () => ["admin_dashboard", "admin_teaching", "admin_discipline"].every(n => new RegExp("function public\\." + n + "\\(p_etab uuid default null\\)").test(sqlV60)) && (sqlV60.match(/is_etab_admin\(g\.etab_id\)/g) || []).length >= 5);
t("SQL v60 : parenthèses et blocs $$ équilibrés", () => (sqlV60.match(/\(/g) || []).length === (sqlV60.match(/\)/g) || []).length && (sqlV60.match(/\$\$/g) || []).length % 2 === 0);
t("SQL v60 : chaque fonction d'établissement a ses droits (grant) et aucune n'est ouverte au public", () => ["creer_etablissement(text, text)", "rejoindre_etablissement(text)", "mes_etablissements()", "etab_quitter(uuid)"].every(n => sqlV60.includes("grant execute on function") && sqlV60.includes("public." + n)));

/* ---- Rentrée (v61) : niveaux, assistant de nouvelle année, script SQL ---- */
const nx = (n, o) => JSON.stringify(run("nivNext(" + JSON.stringify(n) + "," + (o || "null") + ")"));
t("niveaux : 6e B → 5e B, 6ème A → 5ème A, 6eme → 5eme, 6B → 5B", () => run('nivNext("6e B").next') === "5e B" && run('nivNext("6ème A").next') === "5ème A" && run('nivNext("6eme 2").next') === "5eme 2" && run('nivNext("6B").next') === "5B");
t("niveaux : 3e → 2nde, 2nde C → 1ère C, 1ère S → Tle S, CM2 → 6e", () => run('nivNext("3e 2").next') === "2nde 2" && run('nivNext("2nde C").next') === "1ère C" && run('nivNext("1ère S").next') === "Tle S" && run('nivNext("CM2").next') === "6e");
t("niveaux : dernière classe (Tle, ou 3e si demandé) sans suivante", () => run('nivNext("Tle D").last') === true && run('nivNext("3e B").last') === false && run('nivNext("3e B",{last3:true}).last') === true && run('nivNext("Terminale S").last') === true);
t("niveaux : un nom non reconnu n'est pas deviné", () => run('nivNext("Club théâtre").known') === false && run('nivNext("30 élèves").known') === false && run('nivNext("").known') === false);
t("niveaux : le lycée est reconnu, l'année suivante calculée", () => run('nivIsLycee("2nde C")') === true && run('nivIsLycee("5e A")') === false && run('nivNextYear("2025-2026")') === "2026-2027");
t("rentrée : carte d'accueil seulement si des données d'une année terminée restent", () => {
  run('ME={id:"u1"};GUEST=false;D={cur:"a",classes:[{id:"a",name:"6e B",students:[],records:{"2020-10-05":{}},ev:[]}]};');
  const a = run("rentreeCard()").includes("Préparer la rentrée");
  run('D.classes[0].records={};D.classes[0].ev=[];'); const b = run("rentreeCard()") === "";
  run('D.classes[0].records={};D.classes[0].ev=[{d:"2020-11-02"}];rtMark(rtNowLabel());'); const c = run("rentreeCard()") === "";
  run("try{localStorage.removeItem(rtKey())}catch(e){};ME=null;"); return a && b && c;
});
t("rentrée : passage des classes (reconduite, même classe, terminée) avec archive de l'année", () => {
  run('ME={id:"u9"};GUEST=false;uid=function(){return "N"+Math.random().toString(36).slice(2,7)};' +
    'D={cur:"a",classes:[{id:"a",name:"6e B",students:[{id:"s1",name:"A"},{id:"s2",name:"B"}],records:{"2020-10-05":{s1:"p"}},ev:[{d:"2020-11-02"}]},{id:"b",name:"Tle D",students:[{id:"s3",name:"C"}],records:{"2020-10-05":{}},ev:[]},{id:"c",name:"Club",students:[{id:"s4",name:"D"}],records:{"2020-10-05":{}},ev:[]}]};' +
    'view="rentree";RT=null;rtInit();RT.items[0].out={s2:true};' +
    'confirm=function(){return true};saveFile=function(){};toast=function(){};save=function(){};render=function(){};window.scrollTo=function(){};rtRun();');
  const names = run("D.classes.map(function(c){return c.name})");
  const live = run("liveCls().map(function(c){return c.name})");
  const stud = run("liveCls().filter(function(c){return c.name==='5e B'})[0].students.map(function(s){return s.id}).join()");
  const reset = run("liveCls().filter(function(c){return c.name==='5e B'})[0].ev.length") === 0;
  const club = run("liveCls().filter(function(c){return c.name==='Club'})[0].students.length") === 0;
  run("try{localStorage.removeItem(rtKey())}catch(e){};ME=null;D=null;");
  return names.some(n => /^6e B · archive 2020-2021$/.test(n)) && names.some(n => /^Tle D · archive 2020-2021$/.test(n)) && live.length === 2 && live.includes("5e B") && live.includes("Club") && stud === "s1" && reset && club;
});
const sqlV61 = fs.readFileSync(path.join(root, "supabase", "rentree-v61.sql"), "utf8");
t("SQL v61 : fonctions de rentrée, protection des dossiers et du dernier administrateur", () => ["appliquer_rentree", "annuler_rentree", "rentrees_liste", "etab_rentrees", "on delete set null", "last admin", "etab_rentrees_actif_idx"].every(n => sqlV61.includes(n)));
t("SQL v61 : parenthèses et blocs $$ équilibrés", () => (sqlV61.match(/\(/g) || []).length === (sqlV61.match(/\)/g) || []).length && (sqlV61.match(/\$\$/g) || []).length % 2 === 0);

/* ---- v70 : décisions réversibles, page du chef ---- */
const sqlV70 = fs.readFileSync(path.join(root, "supabase", "validation-reversible-v70.sql"), "utf8");
t("SQL v70 : statut « suspendu », changement de statut réservé à l'administrateur du site, décision affichée", () =>
  /'suspendu'/.test(sqlV70) && /sa_changer_statut/.test(sqlV70) && /est_admin_plateforme/.test(sqlV70) && /decide_par_email/.test(sqlV70) &&
  /not \(s = 'suspendu' and x\.statut <> 'valide'\)/.test(sqlV70));
t("SQL v70 : la liste du site ne reçoit ni classes, ni élèves, ni salles", () => {
  const f = sqlV70.slice(sqlV70.indexOf("function public.sa_etablissements"), sqlV70.indexOf("function public.mes_etablissements"));
  return f.length > 100 && !/registry_|classes|eleves|salles/i.test(f);
});
t("SQL v70 : parenthèses et blocs $$ équilibrés", () => (sqlV70.match(/\(/g) || []).length === (sqlV70.match(/\)/g) || []).length && (sqlV70.match(/\$\$/g) || []).length % 2 === 0);
t("v70 : un établissement suspendu : message clair, aucun code affiché", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"suspendu",motif:"Doublon"}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /Suspendu/.test(h) && /Doublon/.test(h) && !/ecode/.test(h) && /etchk/.test(h);
});
t("v70 : la gestion des enseignants est sur la page du chef, plus dans l'onglet Compte", () => {
  const chef = fs.readFileSync(path.join(root, "etablissement.html"), "utf8"), e = fs.readFileSync(path.join(root, "js", "etab.js"), "utf8");
  return /etab_retirer/.test(chef) && /etab_definir_role/.test(chef) && /etab_renommer/.test(chef) && !/etab_retirer|etab_definir_role|etab_renommer/.test(e);
});

/* ---- v71 : validation des enseignants, transferts, seuils, messages, journal ---- */
const sqlV71 = fs.readFileSync(path.join(root, "supabase", "gestion-v71.sql"), "utf8");
t("SQL v71 : toutes les fonctions prévues", () => ["etab_valider_enseignants", "etab_decider_membre", "etab_deplacer_eleves", "etab_seuils", "etab_message_envoyer", "etab_messages_liste", "etab_message_supprimer", "mes_messages_etab", "get_messages_famille", "etab_journal", "journaliser", "seuil_moy", "valider_enseignants", "en_attente"].every(n => sqlV71.includes(n)));
t("SQL v71 : un enseignant en attente n'a aucun accès (membre, accès aux dossiers, affectation)", () =>
  /is_etab_member[\s\S]*m\.statut = 'actif'/.test(sqlV71) && /can_use_ref[\s\S]*m\.statut = 'actif'/.test(sqlV71) && /admin_assign[\s\S]*m\.statut = 'actif'/.test(sqlV71));
t("SQL v71 : le journal n'est pas appelable depuis l'application, les fonctions du chef vérifient is_etab_admin", () => {
  const rev = sqlV71.slice(sqlV71.indexOf("-- 11. Droits"));
  return !/grant execute on function[\s\S]*journaliser/.test(rev) && (sqlV71.match(/is_etab_admin\(p_etab\)/g) || []).length >= 14;
});
t("SQL v71 : parenthèses et blocs $$ équilibrés", () => (sqlV71.match(/\(/g) || []).length === (sqlV71.match(/\)/g) || []).length && (sqlV71.match(/\$\$/g) || []).length % 2 === 0);
t("v71 : un enseignant en attente voit un message clair, pas un accès", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null,statut:"valide",membre_statut:"en_attente",membres:2}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /En attente d’acceptation/.test(h) && /etchk/.test(h);
});
t("v71 : messages du chef : « lu » gardé sur l'appareil", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};ETAB.msgs=[{id:"m1",titre:"A",corps:"b"},{id:"m2",titre:"C",corps:"d"}];');
  const a = run("etabMsgsNew().length"); run('etabReadAdd("m1")'); const b = run("etabMsgsNew().map(function(m){return m.id}).join()");
  run('try{localStorage.removeItem(etabReadKey())}catch(e){};ETAB.msgs=[];ME=null;'); return a === 2 && b === "m2";
});
t("v71 : seuils d'alerte réglables sur la page du chef, plus de valeur fixe", () => {
  const chef = fs.readFileSync(path.join(root, "etablissement.html"), "utf8");
  return /etab_seuils/.test(chef) && /etab_deplacer_eleves/.test(chef) && /etab_journal/.test(chef) && /etab_message_envoyer/.test(chef) && /etab_decider_membre/.test(chef) &&
    !/m>=10|m<10|ra>=3|p<80/.test(chef) && /eq\("event","depart"\)/.test(chef);
});
t("v71 : l'espace parents lit les messages avec le code famille", () => /get_messages_famille/.test(fs.readFileSync(path.join(root, "parent.html"), "utf8")));

/* ---- v87 : classes, matières et affectations (SQL additif) ---- */
const sqlV87 = fs.readFileSync(path.join(root, "supabase", "classes-matieres-v87.sql"), "utf8");
const sqlV87Code = sqlV87.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
t("SQL v87 : toutes les fonctions prévues", () => ["etab_classes_liste", "etab_classe_creer", "etab_classe_archiver", "etab_matieres_liste", "etab_matiere_ajouter", "etab_matiere_supprimer", "etab_matieres_initiales", "etab_affecter", "etab_desaffecter", "etab_affectations_liste", "mes_affectations", "registry_lier_classe", "etab_membre_nettoyer"].every((f) => new RegExp("create or replace function public\\." + f + "\\(").test(sqlV87Code)));
t("SQL v87 : additif — ne redéfinit aucune fonction ni règle de sécurité existante", () =>
  !/create or replace function public\.(admin_assign|admin_unassign|admin_assignments|can_use_ref|is_etab_admin|is_etab_member|rejoindre_etablissement|etab_retirer|etab_deplacer_eleves)\(/.test(sqlV87Code) &&
  !/(drop|create) policy/i.test(sqlV87Code) && !/drop (table|function)/i.test(sqlV87Code) && !/alter table[^;]*drop column/i.test(sqlV87Code));
t("SQL v87 : la reprise n'efface rien et ne retire aucun accès existant", () => {
  const rep = sqlV87Code.slice(sqlV87Code.indexOf("insert into public.etab_classes (etab_id, nom)"), sqlV87Code.indexOf("create or replace function public.registry_lier_classe"));
  return rep.length > 200 && !/\b(delete|truncate|drop)\b/i.test(rep) && !/update public\.registry_access/i.test(rep) && !/insert into public\.registry_access/i.test(rep);
});
t("SQL v87 : les enseignants déjà actifs gardent leurs accès (reprise seulement si accès à toute la classe)", () => /having count\(\*\) = \(select count\(\*\) from public\.registry_students s where s\.classe_id = g\.classe_id\)/.test(sqlV87Code) && /'reprise'/.test(sqlV87Code));
t("SQL v87 : le déclencheur ne bloque jamais l'ajout d'un élève", () => /exception when others then\s+new\.classe_id := null/.test(sqlV87Code) && /before insert or update of class_label on public\.registry_students/.test(sqlV87Code));
t("SQL v87 : seul le chef crée, archive, affecte ; l'enseignant doit être actif ; l'enseignant ne voit que ses classes", () =>
  ["etab_classe_creer", "etab_classe_archiver", "etab_matiere_ajouter", "etab_matiere_supprimer", "etab_matieres_initiales", "etab_affecter", "etab_desaffecter", "etab_affectations_liste"].every((f) => {
    const i = sqlV87Code.indexOf("function public." + f + "("); const b = sqlV87Code.slice(i, sqlV87Code.indexOf("end $$;", i));
    return /is_etab_admin\(p_etab\)/.test(b);
  }) && /m\.user_id = p_user and m\.statut = 'actif'/.test(sqlV87Code) && /adm or exists \(select 1 from public\.etab_affectations f where f\.classe_id = c\.id and f\.teacher_id = uid\)/.test(sqlV87Code));
t("SQL v87 : une matière utilisée ne peut pas être supprimée ; une classe archivée n'efface rien", () => /'in_use'/.test(sqlV87Code) && /on delete restrict/.test(sqlV87Code) && /set archivee = coalesce\(p_on, false\)/.test(sqlV87Code));
t("SQL v87 : droits (revoke public, grant authenticated) et parenthèses / blocs $$ équilibrés", () =>
  /revoke all on function[\s\S]*mes_affectations\(\)\s+from public/.test(sqlV87Code) && /grant execute on function[\s\S]*mes_affectations\(\)\s+to authenticated/.test(sqlV87Code) &&
  (sqlV87Code.match(/\(/g) || []).length === (sqlV87Code.match(/\)/g) || []).length && (sqlV87Code.match(/\$\$/g) || []).length % 2 === 0);

/* ---- v72 : aider un chef, chiffres d'usage anonymes (administrateur du site) ---- */
const sqlV72 = fs.readFileSync(path.join(root, "supabase", "aide-chefs-v72.sql"), "utf8");
t("SQL v72 : trois fonctions réservées à l'administrateur du site, droits accordés", () =>
  ["sa_nouveau_code", "sa_definir_chef", "sa_usage"].every(n => sqlV72.includes("function public." + n) && new RegExp("grant execute on function[\\s\\S]*public\\." + n).test(sqlV72)) &&
  (sqlV72.match(/est_admin_plateforme\(\)/g) || []).length >= 3);
t("SQL v72 : un code n'est généré que pour un établissement validé, et l'action est journalisée", () =>
  /x\.statut = 'valide'/.test(sqlV72) && (sqlV72.match(/journaliser\(/g) || []).length === 2 && !/grant execute on function[\s\S]*journaliser/.test(sqlV72));
t("SQL v72 : les chiffres d'usage ne lisent ni élèves, ni classes, ni contenu des liens", () => {
  const f = sqlV72.slice(sqlV72.indexOf("function public.sa_usage"), sqlV72.indexOf("-- 4. Droits"));
  return f.length > 200 && !/registry_|snapshot|classe|eleve|class_label|notes/i.test(f);
});
t("SQL v72 : parenthèses et blocs $$ équilibrés", () => (sqlV72.match(/\(/g) || []).length === (sqlV72.match(/\)/g) || []).length && (sqlV72.match(/\$\$/g) || []).length % 2 === 0);
t("v72 : admin.html propose nouveau code, changement de chef et chiffres d'usage, sans accès aux élèves", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_nouveau_code/.test(adm) && /sa_definir_chef/.test(adm) && /sa_usage/.test(adm) && /data-snc/.test(adm) && /data-sch/.test(adm) &&
    !/admin_dashboard|registry_students|signUp/.test(adm);
});
t("v72 : le script de admin.html n'a pas d'erreur de syntaxe", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8"), m = adm.match(/<script>([\s\S]*?)<\/script>/);
  try { new vm.Script(m[1]); return true; } catch (e) { return e.message; }
});

/* ---- v73 : contacter les administrateurs du site ---- */
const sqlV73 = fs.readFileSync(path.join(root, "supabase", "contact-v73.sql"), "utf8");
t("SQL v73 : toutes les fonctions prévues, droits accordés", () =>
  ["contact_envoyer", "contact_repondre", "contact_mes_demandes", "contact_marquer_lu", "sa_contact_liste", "sa_contact_repondre", "sa_contact_statut"]
    .every(n => sqlV73.includes("function public." + n) && new RegExp("grant execute on function[\\s\\S]*public\\." + n).test(sqlV73)));
t("SQL v73 : les fonctions de l'administrateur du site vérifient le droit côté serveur (3 fonctions)", () => {
  const sa = sqlV73.slice(sqlV73.indexOf("function public.sa_contact_liste"), sqlV73.indexOf("-- 4. Droits"));
  return (sa.match(/est_admin_plateforme\(\)/g) || []).length === 3;
});
t("SQL v73 : l'expéditeur ne voit pas l'adresse de l'administrateur, l'administrateur ne lit ni élèves ni classes", () => {
  const user = sqlV73.slice(sqlV73.indexOf("function public.contact_mes_demandes"), sqlV73.indexOf("function public.contact_marquer_lu"));
  const sa = sqlV73.slice(sqlV73.indexOf("function public.sa_contact_liste"), sqlV73.indexOf("-- 4. Droits"));
  return user.length > 200 && !/email|auth\.users/.test(user) && !/registry_|snapshot|class_label|parent_shares/.test(sa);
});
t("SQL v73 : limites contre les abus et expéditeur membre de l'établissement cité", () =>
  /interval '24 hours'\) >= 5/.test(sqlV73) && /interval '1 hour'\) >= 10/.test(sqlV73) && /'not_member'/.test(sqlV73) && /enable row level security/.test(sqlV73));
t("SQL v73 : parenthèses et blocs $$ équilibrés", () => (sqlV73.match(/\(/g) || []).length === (sqlV73.match(/\)/g) || []).length && (sqlV73.match(/\$\$/g) || []).length % 2 === 0);
t("v73 : contact.html écrit, lit et marque lu ; aucun accès aux élèves", () => {
  const c = fs.readFileSync(path.join(root, "contact.html"), "utf8");
  return /contact_envoyer/.test(c) && /contact_repondre/.test(c) && /contact_mes_demandes/.test(c) && /contact_marquer_lu/.test(c) && !/admin_dashboard|registry_students|signUp/.test(c);
});
t("v73 : admin.html a la rubrique Demandes (répondre, clore, marquer lu)", () => {
  const a = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_contact_liste/.test(a) && /sa_contact_repondre/.test(a) && /sa_contact_statut/.test(a) && /data-dr=/.test(a) && /data-dst=/.test(a);
});
t("v73 : les scripts de contact.html et admin.html n'ont pas d'erreur de syntaxe", () => {
  for (const f of ["contact.html", "admin.html"]) { const h = fs.readFileSync(path.join(root, f), "utf8"); try { new vm.Script(h.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { return f + " : " + e.message; } }
  return true;
});
t("v73 : l'application propose « Écrire à un administrateur » à tout compte connecté, y compris un établissement suspendu", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"suspendu",motif:"Doublon"}];ETAB.cur="e1";');
  const h1 = run("etabCard()");
  run('ETAB.list=[];ETAB.cur=null;'); const h2 = run("etabCard()");
  run('GUEST=true;'); const h3 = run("etabCard()");
  run("sb=null;ME=null;GUEST=false;ETAB.list=[];ETAB.loaded=false;");
  return /contactbtn/.test(h1) && /contactbtn/.test(h2) && h3 === "" && /contact\.html/.test(fs.readFileSync(path.join(root, "js", "events.js"), "utf8"));
});
t("v73 : le chef a un lien de contact sur sa page et sur l'écran « Accès réservé »", () =>
  (fs.readFileSync(path.join(root, "etablissement.html"), "utf8").match(/href="contact\.html"/g) || []).length >= 2);
/* ---- v74 : plus de confirmation d'e-mail, synchronisation sans écrasement, pages d'administration hors cache ---- */
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
t("v84 : le cache hors ligne est versionné (cm-vNN)", () => /VERSION="cm-v\d+"/.test(rd("sw.js")));
t("v80 : « Vérifier la validation » ouvre une boîte de dialogue avec bouton de contact", () => { const e = rd("js/etab.js"); return /function etabCheck\(/.test(e) && /b\.id==="etchk"\)\{etabCheck\(\)/.test(e) && /Contacter l’administrateur/.test(e) && /contact\.html\?c=etablissement/.test(e) && /Pas encore validé/.test(e) && /Établissement validé/.test(e); });
t("v80 : la page de contact préremplit le formulaire", () => { const c = rd("contact.html"); return /URLSearchParams/.test(c) && /set\("sj",P\.s\)/.test(c); });
t("v80 : le bouton Détails du bandeau reste branché", () => /getElementById\("pend"\)\.addEventListener\("click"/.test(rd("js/etab.js")));
t("v74 : plus aucune trace de la confirmation d'e-mail dans l'application ni les guides", () =>
  !/email_not_confirmed|not confirmed|e-mail de confirmation|Confirmez votre e-mail/i.test(rd("js", "auth.js") + rd("js", "events.js") + rd("js", "etab.js") + rd("aide-etablissement.html")) &&
  !/Si « Confirm email » est activé/.test(rd("supabase", "LISEZ-MOI.md")));
t("v74 : l'inscription n'envoie pas de lien de confirmation (pas d'emailRedirectTo)", () => !/emailRedirectTo:redirectUrl\(\)\}\}\)/.test(rd("js", "events.js") + rd("js", "auth.js")) || !/signUp\([^)]*emailRedirectTo/.test(rd("js", "events.js") + rd("js", "auth.js")));
t("v74 : la synchronisation ne force jamais l'envoi (aucun upsert de classe)", () => !/upsert\(/.test(rd("js", "sync.js")) && !/on force/.test(rd("js", "sync.js")));
t("v74 : l'envoi d'une classe déjà connue reste conditionnel à sa version en ligne", () => /\.eq\("updated_at",rv\[id\]\)/.test(rd("js", "sync.js")));
t("v74 : admin.html, etablissement.html et contact.html ne sont pas gardés dans le cache hors ligne", () => {
  const sw = rd("sw.js"), core = (sw.match(/var CORE=\[([\s\S]*?)\];/) || ["", ""])[1];
  return !/"(admin|etablissement|contact)\.html"/.test(core) && /admin\|etablissement\|contact/.test(sw);
});

/* ---- v75 : rappels d'appel ---- */
const rpClasse = (rec) => `D={cur:"a",classes:[{id:"a",name:"6e A",students:[{id:"s1",name:"A"}],records:${rec},tt:[{id:"t1",d:1,s:"08:00",e:"10:00",r:""},{id:"t2",d:2,s:"14:00",e:"16:00",r:""}],ev:[]}]};`;
const rpAt = (h, m) => { ctx.__d = new Date(2026, 10, 23, h, m); return run("rpDue(__d)"); }; /* lundi 23 novembre 2026 */
run(rpClasse("{}"));
t("rappel : 5 minutes avant la séance → « start »", () => { const r = rpAt(7, 55); return r.length === 1 && r[0].kind === "start" && r[0].min === 5; });
t("rappel : 10 minutes avant la séance → rien", () => rpAt(7, 50).length === 0);
t("rappel : séance en cours → rien", () => rpAt(8, 30).length === 0);
t("rappel : séance terminée sans appel → « missed »", () => { const r = rpAt(10, 12); return r.length === 1 && r[0].kind === "missed" && r[0].min === 12; });
t("rappel : une séance d'un autre jour n'est pas signalée", () => rpAt(15, 0).every(o => o.x.id !== "t2"));
run(rpClasse('{"2026-11-23":{s1:"p"}}'));
t("rappel : appel déjà fait → rien", () => rpAt(7, 57).length === 0 && rpAt(10, 30).length === 0);
run(rpClasse("{}"));
run('Notification={permission:"granted"};var __n=[];rpNotify=function(a,b,c){__n.push(c);};localStorage.setItem("classemaster-rappels","1");localStorage.removeItem("classemaster-rappels-vus");');
const rpTickAt = (h, m) => { ctx.__d = new Date(2026, 10, 23, h, m); return run("rpTick(__d)"); };
t("rappel : une notification avant la séance, une seule fois", () => rpTickAt(7, 57) === 1 && rpTickAt(7, 58) === 0);
t("rappel : appel oublié → notification après 10 min seulement", () => rpTickAt(10, 5) === 0 && rpTickAt(10, 12) === 1 && rpTickAt(10, 13) === 0);
t("rappel : pas de notification pour une séance finie depuis plus de 2 h", () => { run('localStorage.removeItem("classemaster-rappels-vus")'); return rpTickAt(13, 0) === 0; });
t("rappel : réglage désactivé → aucune notification", () => { run('localStorage.removeItem("classemaster-rappels");localStorage.removeItem("classemaster-rappels-vus")'); return rpTickAt(7, 57) === 0; });
t("rappel : permission refusée → aucune notification", () => { run('localStorage.setItem("classemaster-rappels","1");Notification={permission:"denied"};'); return rpTickAt(7, 57) === 0; });
t("rappel : la carte de réglage propose d'activer, de désactiver ou explique le blocage", () => {
  run('localStorage.removeItem("classemaster-rappels");Notification={permission:"default"};');
  const a = run("rappelsCard()");
  run('localStorage.setItem("classemaster-rappels","1");Notification={permission:"granted"};');
  const b = run("rappelsCard()");
  run('Notification={permission:"denied"};');
  const c = run("rappelsCard()");
  return /data-rp="on"/.test(a) && /data-rp="off"/.test(b) && /data-rp="test"/.test(b) && /bloquées/.test(c) && !/data-rp="on"/.test(c);
});
t("rappel : le bandeau est vide sans séance enregistrée", () => { run('D={cur:"a",classes:[{id:"a",name:"6e A",students:[],records:{},ev:[]}]};'); return run("rappelBanner()") === ""; });
t("rappel : l'accueil, Compte, le cache et le service worker sont branchés", () => /rappelBanner/.test(rd("js", "horaires.js")) && (rd("js", "auth.js").match(/rappelsCard\(\)/g) || []).length >= 2 && /js\/rappels\.js/.test(rd("index.html")) && /"js\/rappels\.js"/.test(rd("sw.js")) && /notificationclick/.test(rd("sw.js")));
run("D=null;ME=null;localStorage.removeItem('classemaster-rappels');localStorage.removeItem('classemaster-rappels-vus');");

t("v76 : les boutons des bandeaux de l'accueil (Détails, Lu) ont leur propre écouteur", () => {
  const e = fs.readFileSync(path.join(root, "js", "etab.js"), "utf8");
  return /getElementById\("pend"\)\.addEventListener\("click"/.test(e) && /data-go="compte">Détails/.test(e) && /dataset\.go==="compte"/.test(e);
});

t("v77 : sur l'écran de rattachement, le retour de l'appareil remonte l'historique au lieu de rester piégé", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[];view="etab";var __b=0;history={back:function(){__b++;},pushState:function(){},replaceState:function(){}};');
  run('onPop({state:{view:"signup"}})');
  const skipped = run("__b===1&&view===\"etab\"");
  run('onPop({state:{view:"etab"}})'); const kept = run("__b===1");   /* une entrée « rattachement » s'affiche normalement */
  run('ETAB.list=[{id:"e1",nom:"X",role:"admin"}];view="home";onPop({state:{view:"home"}})'); const normal = run("__b===1&&view===\"home\"");
  run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return skipped && kept && normal;
});

const sqlV78 = fs.readFileSync(path.join(root, "supabase", "suppression-v78.sql"), "utf8");
t("SQL v78 : suppression réservée à l'administrateur du site, établissement suspendu ou refusé, nom retapé, archive", () =>
  (sqlV78.match(/est_admin_plateforme/g) || []).length >= 2 && /not in \('suspendu', 'refuse'\)/.test(sqlV78) && /bad_name/.test(sqlV78) && /plateforme_suppressions/.test(sqlV78) &&
  !/grant execute on function[^;]*to anon/.test(sqlV78) && (sqlV78.match(/\(/g) || []).length === (sqlV78.match(/\)/g) || []).length);
t("SQL v78 : le journal est nettoyé APRÈS la suppression des dossiers (qui inscrit des départs)", () => sqlV78.indexOf("delete from public.etablissements") < sqlV78.indexOf("delete from public.registry_log"));
t("v78 : admin.html propose Supprimer sur un établissement suspendu ou refusé, avec aperçu et nom à retaper", () => {
  const a = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_apercu_suppression/.test(a) && /sa_supprimer_etablissement/.test(a) && /data-sdel/.test(a) && /retapez le nom exact/.test(a);
});

/* ---- v79 : nettoyage du cahier de textes (par mois, ou en entier), annulable ---- */
function cxSetup() {
  run('KEY="test-cx";D={classes:[{id:"c1",name:"5e",ct:[{id:"s1",d:"2026-11-03",t:"a",p:"l1"},{id:"s2",d:"2026-11-10",t:"b",p:""},{id:"s3",d:"2026-12-01",t:"c",p:""}],pg:[{id:"l1",t:"L1",m:"11"},{id:"l2",t:"L2",m:"12"},{id:"l3",t:"L3"},{id:"l4",t:"L4",m:"11"}]}],cur:"c1"};save=function(){};toast=function(){};try{kvDel(tkey())}catch(e){}');
  return run("D.classes[0]");
}
t("v79 cahier : vider un mois de séances ne touche ni les autres mois ni le programme", () => {
  cxSetup();
  const r = run('cxApply(D.classes[0],"s|2026-11")');
  return r.s === 2 && r.p === 0 && run("D.classes[0].ct.map(function(s){return s.id}).join()") === "s3" && run("D.classes[0].pg.length") === 4;
});
t("v79 cahier : retirer les leçons d'un mois détache le lien des séances mais garde leur texte", () => {
  cxSetup();
  const r = run('cxApply(D.classes[0],"p|11")');
  return r.p === 2 && r.s === 0 && run("D.classes[0].pg.map(function(l){return l.id}).join()") === "l2,l3" && run('D.classes[0].ct[0].p===""&&D.classes[0].ct[0].t==="a"&&D.classes[0].ct.length===3');
});
t("v79 cahier : « tout effacer » vide séances et programme ; « toutes les séances » garde le programme", () => {
  cxSetup(); const a = run('cxApply(D.classes[0],"all-s")'); const keep = run("D.classes[0].pg.length") === 4 && run("D.classes[0].ct.length") === 0;
  cxSetup(); const b = run('cxApply(D.classes[0],"all")');
  return a.s === 3 && keep && b.s === 3 && b.p === 4 && run("D.classes[0].ct.length+D.classes[0].pg.length") === 0;
});
t("v79 cahier : rien à effacer → aucune entrée, pas d'erreur", () => { cxSetup(); run('D.classes[0].ct=[];'); return run('cxApply(D.classes[0],"s|2030-01")') === null; });
t("v79 cahier : annuler rétablit séances, leçons, ordre et liens", () => {
  cxSetup(); const r = run('cxApply(D.classes[0],"p|11")');
  const msg = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  const ids = run("D.classes[0].pg.map(function(l){return l.id}).join()"), lien = run("D.classes[0].ct[0].p");
  const again = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  return msg === "" && ids === "l1,l2,l3,l4" && lien === "l1" && again === "Déjà rétabli.";
});
t("v79 cahier : un effacement demande confirmation (aucun effacement au premier clic)", () => {
  const src = fs.readFileSync(path.join(root, "js", "cahier.js"), "utf8");
  return /data-cxc/.test(src) && /data-cxok/.test(src) && /Oui, effacer/.test(src) && /cxConf=cc\.dataset\.cxc;/.test(src) && !/cxConf=cc\.dataset\.cxc;[^}]*cxApply/.test(src);
});
t("v79 cahier : l'écran affiche les boutons par mois et la carte « Nettoyer le cahier »", () => {
  cxSetup(); run('view="cahier";cxConf="";');
  const h = run("renderCahier()"), conf = (run('cxConf="s|2026-11";'), run("renderCahier()")); run('cxConf="";');
  return /Vider ce mois/.test(h) && /Nettoyer le cahier/.test(h) && /Tout effacer : séances et programme/.test(h) && /Oui, effacer/.test(conf) && /Effacer les 2 séances de Novembre 2026/.test(conf) && !/Oui, effacer/.test(h) && /Tout effacer : 3 séances et 4 leçons/.test((run('cxConf="all";'), run("renderCahier()")));
});

/* ---- v81 : retirer tout le programme du cahier d'un seul geste, depuis le haut de la liste ---- */
function cxBig(n, faites) {
  run('KEY="test-cx";D={classes:[{id:"c1",name:"5e",ct:[],pg:[],cur:"c1"}],cur:"c1"};save=function(){};toast=function(){};try{kvDel(tkey())}catch(e){}');
  run('var P=[];for(var i=0;i<' + n + ';i++){var o={id:"l"+i,t:"Leçon "+i};if(i<' + faites + ')o.x=true;P.push(o);}D.classes[0].pg=P;');
}
t("v81 cahier : « Retirer tout le programme » vide 391 leçons d'un coup, et « Annuler » les rétablit", () => {
  cxBig(391, 2);
  const r = run('cxApply(D.classes[0],"top-p")');
  const vide = run("D.classes[0].pg.length") === 0 && r && r.p === 391;
  const msg = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  return vide && msg === "" && run("D.classes[0].pg.length") === 391 && run("D.classes[0].pg[0].id") === "l0";
});
t("v81 cahier : « Retirer les leçons non faites » garde les leçons cochées faites", () => {
  cxBig(391, 2);
  const r = run('cxApply(D.classes[0],"p-undone")');
  return r.p === 389 && run("D.classes[0].pg.length") === 2 && run("D.classes[0].pg.every(function(l){return l.x})") === true;
});
t("v81 cahier : les boutons du haut s'affichent avec le nombre de leçons, et demandent confirmation", () => {
  cxBig(391, 2); run('view="cahier";cxConf="";');
  const a = run("renderCahier()"); run('cxConf="top-p";');
  const b = run("renderCahier()"); run('cxConf="";');
  const iTop = a.indexOf("Retirer tout le programme (391)"), iList = a.indexOf("data-pgx=");
  return iTop > 0 && iTop < iList && /Retirer les leçons non faites \(389\)/.test(a) && /Oui, effacer/.test(b) && /Retirer les 391 leçons du programme/.test(b);
});
t("v81 cahier : le bouton du mois est en haut du mois, avant les leçons", () => {
  cxBig(5, 0); run('view="cahier";cxConf="";');
  const a = run("renderCahier()"); const i = a.indexOf("Retirer les leçons sans mois"), j = a.indexOf('data-pgx="l0"');
  return i > 0 && j > i;
});

t("v81 corbeille : en mode invité aussi, « Annuler » rétablit ce qui vient d'être retiré", () => {
  cxBig(30, 0); run('KEY="";TMEM=[];');
  const r = run('cxApply(D.classes[0],"top-p")');
  const vide = run("D.classes[0].pg.length") === 0;
  run("undoTrash('" + r.id + "')");
  const ok2 = run("D.classes[0].pg.length") === 30; run('KEY="test-cx";TMEM=[];'); return vide && ok2;
});

/* ---- v82 : relevé d'un devoir précis, relevé « tous les trimestres », liste d'appels repliée ---- */
function pdfText(x) { return typeof x === "string" ? x : Buffer.from(x).toString("latin1"); }
function setupRel() {
  run('ME={id:"u1",name:"Prof",school:"CG de Nsou"};GUEST=false;bp=null;brs=null;' +
    'D={cur:"c1",classes:[{id:"c1",name:"6e B",subj:"Français",students:[{id:"a",name:"Awa Mba"},{id:"b",name:"Paul Obiang"},{id:"c",name:"Luc Ndong"}],records:{},' +
    'ev:[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:15,b:8,c:15}},{id:"e2",t:"Dictée",d:"2026-11-09",m:10,s:{a:9,b:4}}]}]};');
}
t("v82 relevé : un devoir précis donne un PDF classé avec la moyenne", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[0])'));
  return b.startsWith("%PDF") && /Relev. du devoir/.test(b) && /Devoir 1/.test(b) && /Awa Mba/.test(b) && /Paul Obiang/.test(b) && /Moyenne : 12,67/.test(b);
});
t("v82 relevé : un devoir sur 10 est ramené sur 20, un élève sans note reste en bas", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[1])'));
  return /9 \/ 10/.test(b) && /18/.test(b) && b.indexOf("Awa Mba") < b.indexOf("Paul Obiang") && b.indexOf("Paul Obiang") < b.indexOf("Luc Ndong");
});
t("v82 relevé : deux élèves à égalité ont le même rang", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[0])'));
  return (b.match(/\(1\) Tj/g) || []).length === 2 && (b.match(/\(3\) Tj/g) || []).length === 1;
});
t("v82 relevé : le choix propose les trimestres, tous les trimestres et chaque devoir", () => {
  setupRel();
  const h = run("bulletinsCard(D.classes[0])");
  return /id="brsel"/.test(h) && /Toutes les évaluations \(tous les trimestres\)/.test(h) && /value="p:A"/.test(h) && /value="e:e1"/.test(h) && /value="e:e2"/.test(h) && /Un devoir précis/.test(h) && /id="brel"/.test(h);
});
t("v82 relevé : le choix mémorisé reste sélectionné", () => {
  setupRel(); run('brs="e:e2";');
  const h = run("bulletinsCard(D.classes[0])"); run("brs=null;");
  return /<option value="e:e2" selected>/.test(h);
});
t("v82 relevé : l'écran d'un devoir a son bouton de relevé", () => {
  setupRel(); run('evid="e1";');
  return /id="evrel"/.test(run("renderEval()"));
});
t("v82 appels : la liste affiche tous les appels récents (et non plus 8), repliée dès 6 lignes", () => {
  setupRel();
  run('var r={};for(var i=1;i<=30;i++){var d="2026-10-"+(i<10?"0"+i:i);r[d]={a:"p",b:"a",c:"p"};}D.classes[0].records=r;view="classe";');
  const h = run("renderClasse()");
  return (h.match(/data-open=/g) || []).length === 30 && run('foldMin("hist")') === 6 && run('foldMin("row")') === 9;
});

t("v83 page établissement : enseignants en pile, onglets visibles, exports repliés, doublons signalés", () => {
  const e = rd("etablissement.html");
  return /\.tb2\.wrap\{flex-wrap:wrap/.test(e) && /class="tb2 wrap" role="tablist"/.test(e) &&
    /class="st mrow"/.test(e) && /class="mb"/.test(e) && !/justify-content:flex-end"><button class="btn ghost" data-mrole/.test(e) &&
    /data-pn="exports"/.test(e) && /même nom/.test(e) && /risk\.slice\(0,5\)/.test(e) && /MEM\.length<=3\|\|pend\.length/.test(e);
});

t("v86 : page établissement épurée (en-tête, pastilles, sections sans numéros, actions élève repliées)", () => {
  const e = rd("etablissement.html");
  return /<style id="v86">/.test(e) && /class="pills"/.test(e) && !/class="sn"/.test(e) && /class="more"/.test(e) && /data-act="wa"/.test(e) && /VERSION="cm-v(8[6-9]|9\d)"/.test(rd("sw.js")) &&
    (e.match(/href="contact\.html"/g) || []).length >= 2;
});

/* ---- v88 : parcours enseignant (classes reçues du chef) ---- */
const sqlV88 = rd("supabase", "parcours-enseignant-v88.sql").split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
t("SQL v88 : une seule fonction ajoutée, additive, réservée aux enseignants actifs, sans code famille ni téléphone", () =>
  (sqlV88.match(/create or replace function/g) || []).length === 1 && /function public\.mes_classes_recues\(\)/.test(sqlV88) &&
  !/(drop|create) (policy|table|function)|alter table|delete from|update public/i.test(sqlV88) &&
  (sqlV88.match(/m\.statut = 'actif'/g) || []).length === 2 && !/\bcode\b|phone/.test(sqlV88.replace(/not authenticated/, "")) &&
  /not c\.archivee/.test(sqlV88) && /grant execute on function public\.mes_classes_recues\(\) to authenticated/.test(sqlV88) &&
  (sqlV88.match(/\(/g) || []).length === (sqlV88.match(/\)/g) || []).length && (sqlV88.match(/\$\$/g) || []).length === 2);
const recuBase = () => {
  run('ME={id:"u1",name:"Awa T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.cur="e1";' +
    'ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",statut:"valide",membre_statut:"actif"}];RECU.ok=true;dirty={};' +
    'RECU.list=[{etab_id:"e1",classe_id:"k1",classe:"6e A",niveau:"",matieres:["Maths","SVT"],eleves:[{ref:"ABCDEFGHJK12",name:"Awa Diop"},{ref:"ZYXWVUTSRQ34",name:"Paul Nkoa"}]}];');
};
const recuEnd = () => run('ME=null;sb=null;ETAB.list=[];ETAB.loaded=false;ETAB.cur="";recuReset();dirty={};');
ctx.crypto = ctx.crypto || require("crypto").webcrypto;
ctx.btoa = ctx.btoa || ((s) => Buffer.from(s, "binary").toString("base64"));
ctx.atob = ctx.atob || ((s) => Buffer.from(s, "base64").toString("binary"));
const D0 = run("JSON.stringify(D)");
t("v88 : verrou — enseignant rattaché verrouillé ; chef, sans établissement ou serveur sans v88 : libres", () => {
  recuBase(); const a = run("recuLocked()");
  run('ETAB.list[0].role="admin"'); const b = run("recuLocked()");
  run('ETAB.list[0].role="enseignant";RECU.ok=false'); const c = run("recuLocked()");
  run('RECU.ok=true;ETAB.list=[]'); const d = run("recuLocked()");
  recuEnd(); return a === true && b === false && c === false && d === false;
});
t("v88 : une classe locale de même nom est reliée (pas de doublon), notes et appels conservés, élèves liés ou ajoutés", () => {
  recuBase();
  run('D.classes=[{id:"c0",name:"Ma classe",students:[],records:{}},{id:"c1",name:"6e A",subj:"",students:[{id:"s1",name:"Diop Awa"}],records:{"2026-10-05":{s1:"a"}}}];D.cur="c0";');
  const ch = run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const c = o.find((x) => x.name === "6e A");
  const r = o.length === 1 && c.id === "c1" && c.ca === "k1" && c.subj === "Maths, SVT" && c.records["2026-10-05"].s1 === "a" &&
    c.students.length === 2 && c.students.find((s) => s.id === "s1").ref === "ABCDEFGHJK12" && c.students.some((s) => s.name === "Paul Nkoa" && s.ref === "ZYXWVUTSRQ34") &&
    run("D.cur") === "c1" && run("Object.keys(dirty).join()") === "c1";
  recuEnd(); return ch === true && r;
});
t("v88 : une classe absente de l'appareil est créée avec ses élèves ; le second passage ne change plus rien", () => {
  recuBase(); run('D.classes=[];D.cur="";');
  const a = run("recuApply(true)"), b = run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const r = a === true && b === false && o.length === 1 && o[0].name === "6e A" && o[0].ca === "k1" && o[0].et === "e1" && o[0].students.length === 2 && o[0].students.every((s) => s.ref && s.sh);
  recuEnd(); return r;
});
t("v88 : une classe locale avec des données n'est jamais supprimée, même sans correspondance", () => {
  recuBase(); run('D.classes=[{id:"c9",name:"Club théâtre",students:[{id:"s9",name:"Zoé"}],records:{}},{id:"c0",name:"Ma classe",students:[],records:{}}];D.cur="c0";');
  run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const r = o.some((x) => x.id === "c9") && !o.some((x) => x.id === "c0") && o.length === 2; recuEnd(); return r;
});
t("v88 : bandeau d'accueil — en attente, aucune classe, rien quand des classes sont reçues", () => {
  recuBase(); run('ETAB.list[0].membre_statut="en_attente";RECU.list=[];'); const a = run("recuCard()");
  run('ETAB.list[0].membre_statut="actif"'); const b = run("recuCard()");
  run('RECU.list=[{classe_id:"k1"}]'); const c = run("recuCard()"); recuEnd();
  return /En attente de validation/.test(a) && /Aucune classe pour le moment/.test(b) && /data-recu/.test(b) && c === "";
});
t("v88 : « Nouvelle classe » bloquée partout (menu, accueil, sélecteur) ; le lien classe du chef est conservé en ligne", () =>
  /recuLocked/.test(rd("js", "nav.js")) && /recuLocked/.test(rd("js", "classes.js")) && (rd("js", "events.js").match(/recuNotice\(\)/g) || []).length === 2 &&
  /recuCard/.test(rd("js", "classes.js")) && /recuApply\(true\)/.test(rd("js", "sync.js")) && /"et","ca"/.test(rd("js", "sync.js")) && run('xPack({ca:"k1",et:"e1"}).ca') === "k1" &&
  /recuLoad/.test(rd("js", "etab.js")) && /js\/recues\.js/.test(rd("index.html")) && /"js\/recues\.js"/.test(rd("sw.js")));
run("D=JSON.parse(" + JSON.stringify(D0) + ")");

console.log(`\n${ok} tests réussis, ${ko} en échec.`);
process.exit(ko ? 1 : 0);

(function(){
"use strict";
var cfg=window.CRM_CONFIG,sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
var STATUSES=[["new","New"],["contacted","Contacted"],["quoted","Quoted"],["won","Won"],["lost","Lost"]];
var TYPES=[["residential","Residential"],["hoa","HOA"],["commercial","Commercial"]];
var leads=[],clients=[],props=[],clientsErr=false,services=[],jobs=[],visits=[],jobsErr=false;
var photos=[],photoErr=false,pf={client:"all",kind:"all",when:"all"},psel=null,pshown=60;
var expenses=[],expErr=false,rtab="overview",rper="month",rfrom="",rto="",exCat="all",exYear=String(new Date().getFullYear()),exq="",exShown=300,exSort=-1,taxYear=String(new Date().getFullYear()),taxMaking=false;
var todos=[],todoErr=false,tfilter="open",team=[];
var role="owner",myEmail="";function isOwner(){return role==="owner"}
var view="leads",lfilter="all",cfilter="active",jfilter="active",smode="day",selDate=today(),crewF="all",query="";
var estimates=[],estErr=false;
var invCats=[],invItems=[],invErr=false,invCat=null,invq="",invSort=null,invFocus=null;
var invoices=[],biz=null,billErr=false,unbilled=[],bfilter="tobill",billThrough=lastMonthEnd();
var crew=[],s3=false,histFrom=addDays(today(),-45),crewMe=null,cwDate=today();
var $=function(id){return document.getElementById(id)};
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function btn(text,cls,fn){var b=el("button",cls||"btn",text);b.type="button";if(fn)b.addEventListener("click",fn);return b}
function ago(iso){var s=(Date.now()-new Date(iso).getTime())/1000;if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+" min ago";if(s<86400)return Math.floor(s/3600)+" hr ago";if(s<604800)return Math.floor(s/86400)+" days ago";return new Date(iso).toLocaleDateString()}
function label(s){var f=STATUSES.filter(function(x){return x[0]===s})[0];return f?f[1]:s}
function tlabel(t){var f=TYPES.filter(function(x){return x[0]===t})[0];return f?f[1]:t}
function digits(p){return(p||"").replace(/[^\d+]/g,"")}
function d10(p){return(p||"").replace(/\D/g,"").slice(-10)}
function byId(arr,id){return arr.filter(function(x){return x.id===id})[0]}
function fld(text,type,val,opts){
  var w=el("label","f");w.appendChild(el("span",null,text));var i;
  if(type==="select"){i=document.createElement("select");opts.forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=o[1];i.appendChild(op)})}
  else if(type==="textarea"){i=document.createElement("textarea");i.style.minHeight="70px"}
  else{i=document.createElement("input");i.type=type}
  i.value=val||"";w.appendChild(i);w.input=i;return w}
function mapsUrl(a){return"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(a)}
function contactRow(phone,email){
  var c=el("div","contact"),dg=digits(phone);
  if(email){var m=el("a","btn alt","Email");m.href="mailto:"+email;c.appendChild(m)}
  if(dg){(isOwner()?["Call","Text"]:["Call"]).forEach(function(t){var a=el("a","btn alt",t);a.href=(t==="Call"?"tel:":"sms:")+dg;c.appendChild(a)})}
  return c}

/* ---- sign in / out ---- */
$("login").addEventListener("submit",function(e){
  e.preventDefault();$("loginmsg").textContent="";
  sb.auth.signInWithPassword({email:$("em").value.trim(),password:$("pw").value}).then(function(r){
    if(r.error){$("loginmsg").textContent="That email or password didn't work.";return}
    afterSignIn();
  });
});
$("signout").addEventListener("click",function(){sb.auth.signOut().then(function(){location.reload()})});
$("refresh").addEventListener("click",function(){if(crewMe)renderCrewApp();else load()});
function start(){$("gsearch").hidden=false;$("loginwrap").hidden=true;$("layout").hidden=false;$("signout").hidden=false;$("refresh").hidden=false;load()}
sb.auth.getSession().then(function(r){if(r.data&&r.data.session)afterSignIn()});
/* Crew logins see only their own route; the owner sees everything. */
function afterSignIn(){
  var done=false;function go(me){if(done)return;done=true;if(me){startCrewApp(me);return}
    sb.auth.getSession().then(function(s){myEmail=((s.data&&s.data.session&&s.data.session.user&&s.data.session.user.email)||"").toLowerCase()}).catch(function(){}).then(function(){
      return sb.rpc("staff_role")}).then(function(r){role=(r&&!r.error)?(r.data||"office"):"owner";start()},function(){role="owner";start()})}
  try{sb.rpc("crew_me").then(function(r){go(r&&!r.error&&r.data&&r.data.length?r.data[0]:null)},function(){go(null)})}catch(e){go(null)}}

/* ---- data ---- */
function fetchAll(table,col){
  var out=[],from=0;
  function page(){return sb.from(table).select("*").order(col,{ascending:false}).order("id",{ascending:true}).range(from,from+999).then(function(r){
    if(r.error)return{data:null,error:r.error};out=out.concat(r.data||[]);if((r.data||[]).length<1000)return{data:out,error:null};from+=1000;return page()})}
  return page()}
function load(){
  $("msg").textContent="";
  Promise.all([
    sb.from("leads").select("*").order("created_at",{ascending:false}).limit(1000),
    sb.from("clients").select("*").order("name",{ascending:true}).limit(5000),
    sb.from("properties").select("*").order("created_at",{ascending:true}).limit(10000),
    sb.from("services").select("*").order("name",{ascending:true}).limit(500),
    sb.from("jobs").select("*").order("created_at",{ascending:true}).limit(5000),
    sb.from("visits").select("*").gte("scheduled_date",addDays(today(),-45)).order("scheduled_date",{ascending:true}).limit(5000),
    sb.from("crew").select("*").order("name",{ascending:true}).limit(200),
    sb.from("invoices").select("*").order("number",{ascending:false}).limit(3000),
    sb.from("business").select("*").eq("id",1),
    sb.from("visits").select("*").eq("status","done").is("invoice_id",null).is("paid_at",null).limit(5000),
    sb.from("todos").select("*").order("created_at",{ascending:false}).limit(3000),
    fetchAll("expenses","spent_on"),
    sb.from("photos").select("*").order("created_at",{ascending:false}).limit(5000),
    sb.from("estimates").select("*").order("number",{ascending:false}).limit(3000),
    sb.from("inventory_cats").select("*").order("sort",{ascending:true}).limit(500),
    sb.from("inventory_items").select("*").order("sort",{ascending:true}).limit(20000)
  ]).then(function(rs){
    if(rs[0].error){$("msg").textContent="Could not load leads. If you just signed in, make sure this email is on the staff list.";return}
    leads=rs[0].data||[];
    clientsErr=!!(rs[1].error||rs[2].error);
    clients=rs[1].error?[]:(rs[1].data||[]);props=rs[2].error?[]:(rs[2].data||[]);
    jobsErr=!!(rs[3].error||rs[4].error||rs[5].error||clientsErr);
    services=rs[3].error?[]:(rs[3].data||[]);jobs=rs[4].error?[]:(rs[4].data||[]);visits=rs[5].error?[]:(rs[5].data||[]);histFrom=addDays(today(),-45);s3=!rs[6].error;crew=rs[6].error?[]:(rs[6].data||[]);
    billErr=!!(rs[7].error||rs[9].error||jobsErr);invoices=rs[7].error?[]:(rs[7].data||[]);biz=rs[8].error?null:((rs[8].data||[])[0]||null);unbilled=rs[9].error?[]:(rs[9].data||[]);photoErr=!!rs[12].error;photos=rs[12].error?[]:(rs[12].data||[]);expErr=!!rs[11].error;expenses=rs[11].error?[]:(rs[11].data||[]);repData=null;todoErr=!!rs[10].error;todos=rs[10].error?[]:(rs[10].data||[]);estErr=!!rs[13].error;estimates=rs[13].error?[]:(rs[13].data||[]);invErr=!!(rs[14].error||rs[15].error);invCats=rs[14].error?[]:(rs[14].data||[]);invItems=rs[15].error?[]:(rs[15].data||[]);
    try{sb.rpc("team_names").then(function(r){if(r&&!r.error&&r.data)team=r.data},function(){})}catch(e){}
    render();topUp().then(function(n){if(n)render()});
  });
}

/* ---- main screen ---- */
var ICONS={leads:'<svg viewBox="0 0 24 24"><path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13"/><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2.5 2.5 0 0 1-5 0z"/></svg>',
 clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
 jobs:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
 billing:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
 schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 expenses:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg>',
 inventory:'<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
 team:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M18.5 3.5v3M17 5h3"/></svg>',
 todo:'<svg viewBox="0 0 24 24"><path d="M4 6.5l1.7 1.7L9 4.8"/><path d="M4 13.5l1.7 1.7L9 11.8"/><path d="M4 20.5l1.7 1.7"/><path d="M13 6h8M13 13h8M13 20h8"/></svg>',
 reports:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
 photos:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>'};
function render(){
  var nav=$("side");nav.textContent="";$("app").classList.toggle("wide",view==="reports"||view==="inventory"||view==="expenses");
  var tdy=today(),stops=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date===tdy}).length,newL=leads.filter(function(l){return l.status==="new"}).length;
  [["leads","Leads",newL],["clients","Clients",0],["jobs","Jobs",0],["schedule","Schedule",stops],["todo","To-Do",todos.filter(function(t){return!t.done&&t.due_date&&t.due_date<=tdy}).length],["billing","Billing",invoices.filter(isOverdue).length],["expenses","Expenses",0],["reports","Reports",0],["photos","Photos",0],["inventory","Inventory",0]].concat(isOwner()?[["team","Team",0]]:[]).forEach(function(v){
    var b=el("button",v[0]===view?"on":"");b.type="button";b.addEventListener("click",function(){view=v[0];render()});b.innerHTML=ICONS[v[0]];b.appendChild(el("span",null,v[1]));
    if(v[2])b.appendChild(el("span","badge",String(v[2])));b.setAttribute("aria-current",v[0]===view?"page":"false");nav.appendChild(b)});
  $("topbtns").textContent="";
  if(view==="leads")renderLeads();else if(view==="clients")renderClients();else if(view==="jobs")renderJobs();else if(view==="billing")renderBilling();else if(view==="todo")renderTodo();else if(view==="reports")renderReports();else if(view==="expenses")renderExpensesView();else if(view==="photos")renderPhotoLib();else if(view==="inventory")renderInventory();else if(view==="team"&&isOwner())renderTeam();else renderSchedule();
}
function renderLeads(){
  var tabs=$("tabs");tabs.textContent="";
  var counts={all:leads.length};STATUSES.forEach(function(s){counts[s[0]]=0});leads.forEach(function(l){counts[l.status]=(counts[l.status]||0)+1});
  [["all","All"]].concat(STATUSES).forEach(function(s){
    var b=el("button","tab"+(lfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+(counts[s[0]]||0)+")"));
    b.addEventListener("click",function(){lfilter=s[0];render()});tabs.appendChild(b)});
  var list=$("list");list.textContent="";
  var shown=leads.filter(function(l){
    if(lfilter!=="all"&&l.status!==lfilter)return false;if(!query)return true;
    return[l.name,l.email,l.phone,l.address,l.service,l.kind,l.notes].join(" ").toLowerCase().indexOf(query)>-1});
  if(!shown.length){list.appendChild(el("div","empty",leads.length?"Nothing matches that.":"No leads yet. New website submissions will show up here."));return}
  shown.forEach(function(l){
    var b=el("button","row "+l.status);b.type="button";
    var left=el("div");left.appendChild(el("b",null,l.name||"(no name)"));
    left.appendChild(el("div","sub",[l.kind,l.service].filter(Boolean).join(" · ")));
    if(l.address)left.appendChild(el("div","sub",l.address));
    var right=el("div");right.style.textAlign="right";
    right.appendChild(el("span","chip "+l.status,label(l.status)));
    if(l.client_id)right.appendChild(el("div","sub","Client ✓"));
    right.appendChild(el("div","sub",ago(l.created_at)));
    b.appendChild(left);b.appendChild(right);b.addEventListener("click",function(){openLead(l.id)});list.appendChild(b)});
}
function clientProps(id){return props.filter(function(p){return p.client_id===id})}
function renderClients(){
  var tabs=$("tabs");tabs.textContent="";
  var act=clients.filter(function(c){return!c.archived});
  var defs=[["active","Active",act.length],["residential","Residential",act.filter(function(c){return c.type==="residential"}).length],["hoa","HOA",act.filter(function(c){return c.type==="hoa"}).length],["commercial","Commercial",act.filter(function(c){return c.type==="commercial"}).length],["archived","Archived",clients.length-act.length]];
  defs.forEach(function(s){var b=el("button","tab"+(cfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){cfilter=s[0];render()});tabs.appendChild(b)});
  var tb=$("topbtns");tb.appendChild(btn("+ New client","btn",function(){openClientForm(null)}));
  tb.appendChild(document.createTextNode(" "));tb.appendChild(btn("Import CSV","btn alt",openImport));
  var list=$("list");list.textContent="";
  if(clientsErr){list.appendChild(el("div","empty","Clients aren't set up yet. Run the Stage 1 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var shown=clients.filter(function(c){
    if(cfilter==="archived"){if(!c.archived)return false}else{if(c.archived)return false;if(cfilter!=="active"&&c.type!==cfilter)return false}
    if(!query)return true;
    var addr=clientProps(c.id).map(function(p){return p.address}).join(" ");
    return[c.name,c.company,c.email,c.phone,c.phone2,c.notes,addr].join(" ").toLowerCase().indexOf(query)>-1});
  if(!shown.length){list.appendChild(el("div","empty",clients.length?"Nothing matches that.":"No clients yet. Add one, import a CSV, or convert a lead."));return}
  shown.forEach(function(c){
    var b=el("button","row client"+(c.archived?" archived":""));b.type="button";
    var ps=clientProps(c.id),left=el("div");
    left.appendChild(el("b",null,c.name+(c.company?" · "+c.company:"")));
    left.appendChild(el("div","sub",[c.phone,c.email].filter(Boolean).join(" · ")));
    if(ps[0])left.appendChild(el("div","sub",ps[0].address+(ps.length>1?"  (+"+(ps.length-1)+" more)":"")));
    var right=el("div");right.style.textAlign="right";right.appendChild(el("span","chip "+c.type,tlabel(c.type)));
    b.appendChild(left);b.appendChild(right);b.addEventListener("click",function(){openClient(c.id)});list.appendChild(b)});
}

/* ---- panel helpers ---- */
function panel(){var p=$("panel");p.textContent="";p.appendChild(btn("×","close",closeDetail)).setAttribute("aria-label","Close");$("detail").classList.add("on");return p}
function closeDetail(){$("detail").classList.remove("on")}
$("detail").addEventListener("click",function(e){if(e.target===$("detail"))closeDetail()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){if(!$("invview").hidden)hideInvoice();else closeDetail()}});
$("invclose").addEventListener("click",function(){hideInvoice()});$("invprint").addEventListener("click",function(){window.print()});

/* ---- lead detail ---- */
function openLead(id){
  var l=byId(leads,id);if(!l)return;var p=panel();
  p.appendChild(el("h2",null,l.name||"(no name)"));
  p.appendChild(el("div","note",l.kind+" · "+new Date(l.created_at).toLocaleString()+(l.lang==="es"?" · Spanish page":"")+(l.photo_count?" · "+l.photo_count+" photo(s) were sent by email":"")));
  p.appendChild(contactRow(l.phone,l.email));
  var st=el("div","status");
  STATUSES.forEach(function(s){st.appendChild(btn(s[1],l.status===s[0]?"on":"",function(){setStatus(l,s[0])}))});
  p.appendChild(st);
  var cl=l.client_id&&byId(clients,l.client_id);
  var cbox=el("div","contact");
  if(cl){cbox.appendChild(btn("View client: "+cl.name,"btn",function(){openClient(cl.id)}))}
  else{var cb=btn("Convert to client","btn",function(){convertLead(l,cb)});cbox.appendChild(cb)}
  p.appendChild(cbox);
  var t=document.createElement("table");
  (Array.isArray(l.fields)?l.fields:[]).forEach(function(f){if(!f||!f.value)return;var tr=document.createElement("tr");tr.appendChild(el("td",null,f.label));tr.appendChild(el("td",null,f.value));t.appendChild(tr)});
  p.appendChild(t);
  p.appendChild(el("label",null,"Notes"));
  var ta=document.createElement("textarea");ta.value=l.notes||"";ta.setAttribute("aria-label","Notes");p.appendChild(ta);
  var a=el("div","actions");
  var save=btn("Save notes","btn",function(){save.disabled=true;sb.from("leads").update({notes:ta.value}).eq("id",l.id).then(function(r){save.disabled=false;if(r.error){alert("Could not save notes.");return}l.notes=ta.value;save.textContent="Saved";setTimeout(function(){save.textContent="Save notes"},1500)})});
  var del=btn("Delete lead","btn danger",function(){if(!confirm("Delete this lead for good?"))return;sb.from("leads").delete().eq("id",l.id).then(function(r){if(r.error){alert("Could not delete.");return}leads=leads.filter(function(z){return z.id!==l.id});closeDetail();render()})});
  a.appendChild(save);a.appendChild(del);p.appendChild(a);
}
function setStatus(l,s){sb.from("leads").update({status:s}).eq("id",l.id).then(function(r){if(r.error){alert("Could not change status.");return}l.status=s;render();openLead(l.id)})}

function convertLead(l,b){
  if(clientsErr){alert("Run the Stage 1 SQL in Supabase first (see the setup steps), then press Refresh.");return}
  var addr=(l.address||"").trim();
  if(!addr){addr=(prompt("This lead has no address. Enter the service address:")||"").trim();if(!addr){alert("A service address is required to make a client.");return}}
  var dup=clients.filter(function(c){return(l.email&&c.email&&c.email.toLowerCase()===l.email.toLowerCase())||(d10(l.phone).length>=7&&(d10(c.phone)===d10(l.phone)||d10(c.phone2)===d10(l.phone)))})[0];
  if(dup){
    if(!confirm('"'+dup.name+'" already has this phone or email. Link this lead to that existing client?'))return;
    b.disabled=true;linkLead(l,dup,addr);return}
  b.disabled=true;
  var type=/proposal|hoa/i.test(l.kind||"")?"hoa":"residential";
  sb.from("clients").insert({name:l.name||"(no name)",email:l.email||"",phone:l.phone||"",type:type,source:l.kind||"",notes:""}).select().single().then(function(r){
    if(r.error||!r.data){b.disabled=false;alert("Could not create the client.");return}
    clients.push(r.data);clients.sort(function(x,y){return x.name.localeCompare(y.name)});linkLead(l,r.data,addr)});
}
function linkLead(l,c,addr){
  function done(){sb.from("leads").update({client_id:c.id}).eq("id",l.id).then(function(r){if(r.error){alert("Client saved, but linking the lead failed.")}else{l.client_id=c.id}render();openClient(c.id)})}
  var has=clientProps(c.id).some(function(p){return p.address.toLowerCase()===addr.toLowerCase()});
  if(!has){sb.from("properties").insert({client_id:c.id,label:clientProps(c.id).length?"":"Main",address:addr}).select().single().then(function(r){if(r.data)props.push(r.data);done()})}else done();
}

/* ---- client detail ---- */
function openClient(id){
  var c=byId(clients,id);if(!c)return;var p=panel();
  p.appendChild(el("h2",null,c.name+(c.company?" · "+c.company:"")));
  p.appendChild(el("div","note",tlabel(c.type)+" · added "+new Date(c.created_at).toLocaleDateString()+(c.source?" · from "+c.source:"")+(c.archived?" · ARCHIVED":"")));
  p.appendChild(contactRow(c.phone||c.phone2,c.email));
  var t=document.createElement("table");
  [["Phone",c.phone],["Phone 2",c.phone2],["Email",c.email],["Notes",c.notes]].forEach(function(r){if(!r[1])return;var tr=document.createElement("tr");tr.appendChild(el("td",null,r[0]));tr.appendChild(el("td",null,r[1]));t.appendChild(tr)});
  p.appendChild(t);
  var acts=el("div","contact");acts.appendChild(btn("Edit details","btn alt sm",function(){openClientForm(c)}));
  acts.appendChild(btn(c.archived?"Unarchive":"Archive","btn alt sm",function(){sb.from("clients").update({archived:!c.archived}).eq("id",c.id).then(function(r){if(r.error){alert("Could not update.");return}c.archived=!c.archived;render();openClient(c.id)})}));
  p.appendChild(acts);
  /* properties */
  var sec=el("div","sec"),h=el("h3",null,"Properties"),addp=btn("+ Add property","btn alt sm",function(){propForm(c,null,sec,h)});h.appendChild(addp);sec.appendChild(h);p.appendChild(sec);
  var holder=el("div");sec.appendChild(holder);drawProps(c,holder);
  p.appendChild(clientJobsSection(c));
  p.appendChild(clientBillingSection(c));
  if(!estErr)p.appendChild(clientEstimatesSection(c));
  p.appendChild(clientPhotosSection(c));
  p.appendChild(historySection(c));
  /* leads */
  var ls=leads.filter(function(l){return l.client_id===c.id});
  if(ls.length){var s2=el("div","sec");s2.appendChild(el("h3",null,"Requests from the website"));
    ls.forEach(function(l){var r=el("div","pcard");r.appendChild(el("b",null,l.kind+" · "+label(l.status)));r.appendChild(el("div","note",new Date(l.created_at).toLocaleDateString()+(l.service?" · "+l.service:"")));r.appendChild(btn("Open","btn alt sm",function(){openLead(l.id)})).style.marginTop="6px";s2.appendChild(r)});p.appendChild(s2)}
  var d=el("div","actions");d.appendChild(el("span"));
  d.appendChild(btn("Delete client","btn danger",function(){if(!confirm("Delete this client and all their properties for good? (Archive keeps the history.)"))return;sb.from("clients").delete().eq("id",c.id).then(function(r){if(r.error){alert("Could not delete. A client with invoices can't be deleted, so Archive them instead.");return}clients=clients.filter(function(z){return z.id!==c.id});props=props.filter(function(z){return z.client_id!==c.id});leads.forEach(function(l){if(l.client_id===c.id)l.client_id=null});closeDetail();render()})}));
  p.appendChild(d);
}
function drawProps(c,holder){
  holder.textContent="";var ps=clientProps(c.id);
  if(!ps.length){holder.appendChild(el("div","note","No properties yet. Add the service address."));return}
  ps.forEach(function(pr){
    var card=el("div","pcard");card.appendChild(el("b",null,(pr.label?pr.label+": ":"")+pr.address));
    if(pr.notes)card.appendChild(el("div","note",pr.notes));
    var a=el("div","acts"),m=el("a","btn alt sm","Map");m.href=mapsUrl(pr.address);m.target="_blank";m.rel="noopener";a.appendChild(m);
    a.appendChild(btn("Edit","btn alt sm",function(){propForm(c,pr,holder)}));
    a.appendChild(btn("Delete","btn danger sm",function(){if(!confirm("Delete this property?"))return;sb.from("properties").delete().eq("id",pr.id).then(function(r){if(r.error){alert("Could not delete.");return}props=props.filter(function(z){return z.id!==pr.id});drawProps(c,holder);render()})}));
    card.appendChild(a);holder.appendChild(card)});
}
function propForm(c,pr,holder){
  var box=el("div","pcard");
  var lab=fld("Label (Main, Rental, Office...)","text",pr?pr.label:"");
  var adr=fld("Address","text",pr?pr.address:"");adr.input.placeholder="123 Example Ln, Kissimmee, FL 34758";
  var nts=fld("Access notes (gate code, dogs, parking...)","textarea",pr?pr.notes:"");
  box.appendChild(lab);box.appendChild(adr);box.appendChild(nts);
  var a=el("div","acts");
  var save=btn("Save property","btn sm",function(){
    if(!adr.input.value.trim()){alert("Enter an address.");return}
    var row={label:lab.input.value.trim(),address:adr.input.value.trim(),notes:nts.input.value.trim()};save.disabled=true;
    var q=pr?sb.from("properties").update(row).eq("id",pr.id).select().single():sb.from("properties").insert(Object.assign({client_id:c.id},row)).select().single();
    q.then(function(r){save.disabled=false;if(r.error||!r.data){alert("Could not save.");return}
      if(pr){Object.assign(pr,r.data)}else props.push(r.data);drawProps(c,holder);render()})});
  a.appendChild(save);a.appendChild(btn("Cancel","btn alt sm",function(){drawProps(c,holder)}));box.appendChild(a);
  if(pr){holder.textContent="";holder.appendChild(box)}else{holder.insertBefore(box,holder.firstChild)}
}
function openClientForm(c){
  var p=panel();p.appendChild(el("h2",null,c?"Edit client":"New client"));
  var n=fld("Name","text",c&&c.name),co=fld("Company / HOA name (optional)","text",c&&c.company);
  var ph=fld("Phone","tel",c&&c.phone),ph2=fld("Phone 2 (optional)","tel",c&&c.phone2);
  var em=fld("Email","email",c&&c.email),ty=fld("Type","select",c?c.type:"residential",TYPES);
  var nt=fld("Notes","textarea",c&&c.notes);
  var g=el("div","grid2");g.appendChild(n);g.appendChild(co);g.appendChild(ph);g.appendChild(ph2);g.appendChild(em);g.appendChild(ty);p.appendChild(g);p.appendChild(nt);
  var addr=null;if(!c){addr=fld("Service address (required, you can add more later)","text","");addr.input.placeholder="123 Example Ln, Kissimmee, FL 34758";p.appendChild(addr)}
  var a=el("div","actions");
  var save=btn("Save","btn",function(){
    if(!n.input.value.trim()){alert("Enter a name.");return}
    if(!c&&!addr.input.value.trim()){alert("Enter the service address.");addr.input.focus();return}
    var row={name:n.input.value.trim(),company:co.input.value.trim(),phone:ph.input.value.trim(),phone2:ph2.input.value.trim(),email:em.input.value.trim(),type:ty.input.value,notes:nt.input.value.trim()};
    save.disabled=true;
    if(c){sb.from("clients").update(row).eq("id",c.id).select().single().then(function(r){save.disabled=false;if(r.error||!r.data){alert("Could not save.");return}Object.assign(c,r.data);render();openClient(c.id)})}
    else{row.source="Added by hand";sb.from("clients").insert(row).select().single().then(function(r){
      if(r.error||!r.data){save.disabled=false;alert("Could not save. Did you run the Stage 1 SQL?");return}
      clients.push(r.data);clients.sort(function(x,y){return x.name.localeCompare(y.name)});
      var ad=addr.input.value.trim();
      sb.from("properties").insert({client_id:r.data.id,label:"Main",address:ad}).select().single().then(function(q){if(q.data)props.push(q.data);else alert("Client saved, but the address did not save. Add it from the client page.");render();openClient(r.data.id)})})}});
  a.appendChild(save);a.appendChild(btn("Cancel","btn alt",function(){if(c)openClient(c.id);else closeDetail()}));p.appendChild(a);
}

/* ---- CSV import (Jobber export or any spreadsheet saved as CSV) ---- */
function parseCSV(text){
  var rows=[],row=[],f="",q=false,i,ch;text=text.replace(/^﻿/,"");
  for(i=0;i<text.length;i++){ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"')q=true;else if(ch===","){row.push(f);f=""}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(f);f="";if(row.some(function(x){return x.trim()}))rows.push(row);row=[]}
    else f+=ch}
  row.push(f);if(row.some(function(x){return x.trim()}))rows.push(row);return rows}
function openImport(){
  if(clientsErr){alert("Run the Stage 1 SQL in Supabase first, then press Refresh.");return}
  var p=panel();p.appendChild(el("h2",null,"Import clients from CSV"));
  p.appendChild(el("p","note","In Jobber: Clients, then the ⋯ menu, then Export (CSV). Or save any spreadsheet as CSV. Columns it understands: Name (or First name + Last name), Company, Email, Phone, Street/Address, City, State, Zip. Clients that match an existing phone or email are skipped."));
  var file=document.createElement("input");file.type="file";file.accept=".csv,text/csv";p.appendChild(file);
  var out=el("div");out.style.marginTop="12px";p.appendChild(out);
  file.addEventListener("change",function(){
    var f=file.files[0];if(!f)return;var rd=new FileReader();
    rd.onload=function(){
      var rows=parseCSV(String(rd.result));out.textContent="";
      if(rows.length<2){out.textContent="That file looks empty.";return}
      var hd=rows[0].map(function(h){return h.trim().toLowerCase()});
      function col(){var a=arguments,i,j;for(j=0;j<a.length;j++)for(i=0;i<hd.length;i++)if(hd[i]===a[j])return i;for(j=0;j<a.length;j++)for(i=0;i<hd.length;i++)if(hd[i].indexOf(a[j])>-1)return i;return-1}
      var cName=col("name","client name","display name"),cF=col("first name"),cL=col("last name"),cCo=col("company"),cEm=col("email","e-mail"),cPh=col("phone","mobile","main phone"),
          cSt=col("street 1","street","address"),cCi=col("city"),cS=col("state","province"),cZ=col("zip","postal");
      function g(r,i){return i>-1&&r[i]?String(r[i]).trim():""}
      var map={},order=[];
      rows.slice(1).forEach(function(r){
        var name=g(r,cName)||[g(r,cF),g(r,cL)].filter(Boolean).join(" ")||g(r,cCo);if(!name)return;
        var key=name.toLowerCase()+"|"+d10(g(r,cPh))+"|"+g(r,cEm).toLowerCase();
        var addr=[g(r,cSt),[g(r,cCi),g(r,cS)].filter(Boolean).join(", "),g(r,cZ)].filter(Boolean).join(" ").replace(/\s+/g," ").trim();
        if(!map[key]){map[key]={name:name,company:g(r,cCo),email:g(r,cEm),phone:g(r,cPh),addrs:[]};order.push(key)}
        if(addr&&map[key].addrs.indexOf(addr)<0)map[key].addrs.push(addr)});
      var fresh=order.map(function(k){return map[k]}).filter(function(x){return!clients.some(function(c){return(x.email&&c.email&&c.email.toLowerCase()===x.email.toLowerCase())||(d10(x.phone).length>=7&&d10(c.phone)===d10(x.phone))})});
      var noAddr=fresh.filter(function(x){return!x.addrs.length}).length;
      fresh=fresh.filter(function(x){return x.addrs.length});
      if(!fresh.length){out.textContent=noAddr?"Nothing imported: "+noAddr+" client(s) have no address, and an address is required. Add an address column to those rows.":"Nothing new to import (everything already matches a client).";return}
      if(noAddr)out.appendChild(el("p","note",noAddr+" row(s) skipped because they have no address."));
      out.appendChild(el("p",null,"Ready to import "+fresh.length+" client(s) with "+fresh.reduce(function(n,x){return n+x.addrs.length},0)+" propert"+"ies."));
      var go=btn("Import now","btn",function(){
        go.disabled=true;go.textContent="Importing...";
        sb.from("clients").insert(fresh.map(function(x){return{name:x.name,company:x.company,email:x.email,phone:x.phone,type:"residential",source:"CSV import"}})).select().then(function(r){
          if(r.error||!r.data){go.disabled=false;go.textContent="Import now";alert("Import failed. Nothing was added.");return}
          var pr=[];r.data.forEach(function(c){var m=fresh.filter(function(x){return x.name===c.name&&x.phone===c.phone&&x.email===c.email})[0];if(m)m.addrs.forEach(function(a,i){pr.push({client_id:c.id,label:i?"":"Main",address:a})})});
          r.data.forEach(function(c){clients.push(c)});clients.sort(function(x,y){return x.name.localeCompare(y.name)});
          var fin=function(){render();closeDetail();alert("Imported "+r.data.length+" client(s).")};
          if(pr.length)sb.from("properties").insert(pr).select().then(function(q){if(q.data)q.data.forEach(function(x){props.push(x)});fin()});else fin()})});
      out.appendChild(go)};
    rd.readAsText(f)});
}

/* ---- global search (header) ---- */
(function(){
  var gs=$("gs"),res=$("gres"),lastQ="";
  function toks(q){return q.toLowerCase().split(/\s+/).filter(Boolean)}
  function all(hay,t){hay=hay.toLowerCase();var dig=hay.replace(/\D/g,"");return t.every(function(x){return hay.indexOf(x)>-1||(/^\d{3,}$/.test(x)&&dig.indexOf(x)>-1)})}
  function sec(title,items,make,go){if(!items.length)return;res.appendChild(el("h4",null,title));items.slice(0,6).forEach(function(it){var m=make(it),b=document.createElement("button");b.type="button";b.appendChild(el("b",null,m[0]));if(m[1])b.appendChild(el("span",null,m[1]));b.addEventListener("click",function(){close();gs.value="";m[2]()});res.appendChild(b)});
    if(go&&items.length>6){var more=document.createElement("button");more.type="button";more.appendChild(el("b",null,"See all "+items.length+" "+title.toLowerCase()+" →"));more.firstChild.style.color="var(--forest)";more.addEventListener("click",function(){close();gs.value="";go()});res.appendChild(more)}}
  var TOPICS=[["Leads","leads lead quote request inquiry website new",function(){view="leads";lfilter="all"}],["Clients","clients client customer customers contact phone email",function(){view="clients"}],["Jobs","jobs job service services recurring price weekly",function(){view="jobs"}],
    ["Schedule","schedule calendar route today tomorrow visit visits crew day week",function(){view="schedule"}],["Weather delay","weather rain delay storm reschedule",function(){view="schedule";openWeather(today())}],["To-Do","todo to-do task tasks reminder",function(){view="todo"}],
    ["Invoices (Billing)","invoices invoice bill billing payment paid unpaid overdue owed zelle",function(){view="billing";bfilter="open"}],["Ready to bill","bill billing unbilled ready to-bill create invoices",function(){view="billing";bfilter="tobill"}],["Estimates (Billing)","estimates estimate quote proposal",function(){view="billing";bfilter="estimates"}],
    ["Reports","reports report revenue profit earnings income money",function(){view="reports";rtab="overview"}],["Tax report","tax taxes report year-end equipment",function(){view="reports";rtab="tax"}],["Expenses","expenses expense receipt spending cost costs vendor scan",function(){view="expenses"}],["Photos","photos photo pictures picture images gallery before after receipt",function(){view="photos"}],
    ["Inventory","inventory stock supplies equipment parts tools chemicals fuel",function(){view="inventory";invq=""}],["Team","team staff users user login access owner office permissions",function(){if(isOwner())view="team";else view="leads"}],["Billing settings","settings business zelle terms footer",function(){view="billing";openBizSettings()}]];
  function topicHit(tp,t){var w=(tp[0]+" "+tp[1]).toLowerCase().split(/\s+/);return t.every(function(x){return w.some(function(y){return y.indexOf(x)===0})})}
  function close(){res.classList.remove("on");res.textContent=""}
  function run(){
    var t=toks(gs.value);lastQ=gs.value.trim();res.textContent="";if(!t.length){close();return}
    var cl=clients.filter(function(c){return all(["client",c.name,c.company,c.phone,c.phone2,c.email,clientProps(c.id).map(function(p){return p.address}).join(" ")].join(" "),t)});
    var jb=jobs.filter(function(j){var sv=byId(services,j.service_id);return all(["job",j.title,sv?sv.name:"",cname(j.client_id),paddr(j.property_id),flabel(j.frequency)].join(" "),t)});
    var ld=leads.filter(function(l){return all(["lead",l.name,l.email,l.phone,l.address,l.service,l.kind].join(" "),t)});
    var tp=TOPICS.filter(function(x){return topicHit(x,t)&&!(x[0]==="Team"&&!isOwner())});
    if(tp.length){res.appendChild(el("h4",null,"Go to"));tp.slice(0,4).forEach(function(x){var b=document.createElement("button");b.type="button";b.appendChild(el("b",null,x[0]));b.addEventListener("click",function(){close();gs.value="";x[2]();render()});res.appendChild(b)})}
    sec("Clients",cl,function(c){var ps=clientProps(c.id);return[c.name+(c.company?" · "+c.company:""),[ps[0]&&ps[0].address,c.phone].filter(Boolean).join(" · "),function(){openClient(c.id)}]});
    sec("Jobs",jb,function(j){return[cname(j.client_id)+" · "+j.title,[paddr(j.property_id),flabel(j.frequency),money(j.price),j.status!=="active"?j.status:""].filter(Boolean).join(" · "),function(){openJob(j.id)}]});
    var iv=billErr?[]:invoices.filter(function(i){return all(["invoice",i.status==="open"&&isOverdue(i)?"overdue":i.status,i.status==="open"?"unpaid":"",String(i.total),invNum(i.number),String(i.number),cname(i.client_id),i.reference||""].join(" "),t)});
    sec("Invoices",iv,function(i){return[invNum(i.number)+" · "+cname(i.client_id),[money(i.total),i.status==="paid"?"Paid":i.status==="void"?"Void":"Due "+dshort(i.due_date),i.reference].filter(Boolean).join(" · "),function(){openInvoice(i.id)}]},function(){view="billing";bfilter="open";render()});
    sec("Leads",ld,function(l){return[l.name||"(no name)",[l.kind,l.service,l.address].filter(Boolean).join(" · "),function(){openLead(l.id)}]});
    var es=estErr?[]:estimates.filter(function(e){return all(["estimate quote",e.status,estNum(e.number),String(e.total),cname(e.client_id),e.title||"",e.scope||""].join(" "),t)});
    sec("Estimates",es,function(e){return[estNum(e.number)+" · "+cname(e.client_id),[e.title,money(e.total),e.status==="accepted"?"Accepted":e.status==="declined"?"Declined":estExpired(e)?"Expired":e.status==="sent"?"Sent":"Draft"].filter(Boolean).join(" · "),function(){openEstimate(e.id)}]},function(){view="billing";bfilter="estimates";render()});
    var td=todoErr?[]:todos.filter(function(x){return all(["task todo",x.done?"done":"open",x.title,x.notes||"",cname(x.client_id),memberName(x.assigned_to)].join(" "),t)});
    sec("To-Do",td,function(x){return[x.title,[x.done?"Done":"Open",x.due_date?"due "+dshort(x.due_date):"",x.client_id?cname(x.client_id):""].filter(Boolean).join(" · "),function(){openTodo(x)}]},function(){view="todo";tfilter=t.indexOf("done")>-1?"done":"open";render()});
    var ex=expErr?[]:expenses.filter(function(x){return all(["expense",x.category,x.vendor,x.note||"",String(x.amount),x.client_id?cname(x.client_id):""].join(" "),t)});
    sec("Expenses",ex,function(x){return[money(x.amount)+" · "+(x.vendor||x.category),[x.category,dshort(x.spent_on),x.note].filter(Boolean).join(" · "),function(){openExpense(x)}]},function(){view="expenses";render()});
    var ph=photoErr?[]:photos.filter(function(x){return all(["photo",x.kind,x.caption||"",x.client_id?cname(x.client_id):""].join(" "),t)});
    sec("Photos",ph,function(x){return[(x.client_id?cname(x.client_id):"No client")+" · "+x.kind,[x.caption,dshort(String(x.created_at).slice(0,10))].filter(Boolean).join(" · "),function(){view="photos";pf.client=x.client_id||"none";pf.kind="all";render()}]},function(){view="photos";render()});
    var ii=[];if(!invErr)invVisible().forEach(function(c){invRows(c).forEach(function(r){if(invHas(c,r,t))ii.push([c,r])})});
    sec("Inventory",ii,function(x){var c=x[0],r=x[1],cols=invCols(c);return[invTitle(c,r),c.name+" · "+cols.slice(1).map(function(col){var v=invVal(r,col.k);return v?col.n+": "+v:""}).filter(Boolean).join(" · "),function(){view="inventory";invCat=c.id;invq=lastQ;render()}]},function(){view="inventory";invq=lastQ;render()});
    if(!res.firstChild)res.appendChild(el("div","none","No matches. Try a name, address, phone, invoice number, or a topic like invoices, photos or inventory."));
    res.classList.add("on")}
  gs.addEventListener("input",run);gs.addEventListener("focus",function(){if(gs.value.trim())run()});
  gs.addEventListener("keydown",function(e){if(e.key==="Escape"){close();gs.blur()}else if(e.key==="Enter"){var f=res.querySelector("button");if(f)f.click()}});
  document.addEventListener("click",function(e){if(!$("gsearch").contains(e.target))close()});
})();

/* ======================= STAGE 2: services, jobs, visits ======================= */
var FREQ=[["weekly","Weekly"],["biweekly","Every 2 weeks"],["once","One-time"]];
function pad(n){return n<10?"0"+n:""+n}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function pd(s){var a=s.split("-");return new Date(+a[0],+a[1]-1,+a[2],12)}
function addDays(s,n){var d=pd(s);d.setDate(d.getDate()+n);return ymd(d)}
function today(){return ymd(new Date())}
function dlabel(s){var t=today();if(s===t)return"Today";if(s===addDays(t,1))return"Tomorrow";return pd(s).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}
function dshort(s){return pd(s).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}
function money(n){return"$"+(Number(n)||0).toFixed(2).replace(/\.00$/,"")}
function flabel(f){var x=FREQ.filter(function(a){return a[0]===f})[0];return x?x[1]:f}
function needSql(){alert("Run the Stage 2 SQL in Supabase first (SQL Editor), then press Refresh.")}

function loadVisits(){
  histFrom=addDays(today(),-45);
  return sb.from("visits").select("*").gte("scheduled_date",addDays(today(),-45)).order("scheduled_date",{ascending:true}).limit(5000).then(function(r){if(!r.error)visits=r.data||[]})}
function visitDates(job){
  var t=today(),end=addDays(t,84);
  if(job.frequency==="once")return[job.start_date];
  if(job.end_date&&job.end_date<end)end=job.end_date;
  var step=job.frequency==="weekly"?7:14,out=[],d=job.start_date,floor=addDays(t,-7);
  if(d<floor){var days=Math.round((pd(floor)-pd(d))/86400000);d=addDays(d,Math.ceil(days/step)*step)}
  while(d<=end){out.push(d);d=addDays(d,step)}
  return out}
function topUp(){
  if(jobsErr)return Promise.resolve(0);
  var rows=[];
  jobs.forEach(function(j){
    if(j.status!=="active")return;
    var lastV=visits.filter(function(v){return v.job_id===j.id}).sort(function(a,b){return a.orig_date<b.orig_date?1:-1})[0],off=lastV&&/#R$/.test(lastV.weather_batch||"")?Math.round((pd(lastV.scheduled_date)-pd(lastV.orig_date))/86400000):0;
    visitDates(j).forEach(function(d){
      if(visits.some(function(v){return v.job_id===j.id&&v.orig_date===d}))return;
      var row={job_id:j.id,client_id:j.client_id,property_id:j.property_id,orig_date:d,scheduled_date:addDays(d,off),status:"scheduled",price:j.price};if(s3)row.crew_id=j.crew_id||null;rows.push(row)})});
  if(!rows.length)return Promise.resolve(0);
  return sb.from("visits").upsert(rows,{onConflict:"job_id,orig_date",ignoreDuplicates:true}).then(function(r){
    if(r.error)return 0;return loadVisits().then(function(){return rows.length})})}
function nextVisit(j){
  var t=today(),a=visits.filter(function(v){return v.job_id===j.id&&v.status==="scheduled"&&v.scheduled_date>=t}).sort(function(x,y){return x.scheduled_date<y.scheduled_date?-1:1});
  return a[0]}
function cname(id){var c=byId(clients,id);return c?c.name:"(deleted client)"}
function paddr(id){var p=byId(props,id);return p?p.address:""}

/* ---- Jobs list ---- */
function renderJobs(){
  var tabs=$("tabs");tabs.textContent="";
  var rec=jobs.filter(function(j){return j.status==="active"&&j.frequency!=="once"}),one=jobs.filter(function(j){return j.status==="active"&&j.frequency==="once"}),off=jobs.filter(function(j){return j.status!=="active"});
  [["active","Recurring",rec.length],["once","One-time",one.length],["inactive","Paused / ended",off.length]].forEach(function(s){
    var b=el("button","tab"+(jfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){jfilter=s[0];render()});tabs.appendChild(b)});
  var tb=$("topbtns");tb.appendChild(btn("+ New job","btn",function(){openJobForm(null,null)}));tb.appendChild(document.createTextNode(" "));tb.appendChild(btn("Services","btn alt",openServices));
  var list=$("list");list.textContent="";
  if(jobsErr){list.appendChild(el("div","empty","Jobs aren't set up yet. Run the Stage 2 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var shown=(jfilter==="active"?rec:jfilter==="once"?one:off).filter(function(j){
    if(!query)return true;return[cname(j.client_id),j.title,paddr(j.property_id)].join(" ").toLowerCase().indexOf(query)>-1});
  if(!shown.length){list.appendChild(el("div","empty",jobs.length?"Nothing here.":"No jobs yet. Add one here, or from a client's page."));return}
  shown.forEach(function(j){
    var b=el("button","row client");b.type="button";var left=el("div");
    left.appendChild(el("b",null,cname(j.client_id)+" · "+j.title));
    left.appendChild(el("div","sub",[paddr(j.property_id),flabel(j.frequency),money(j.price)].filter(Boolean).join(" · ")));
    var right=el("div");right.style.textAlign="right";
    if(j.status!=="active")right.appendChild(el("span","chip lost",j.status==="paused"?"Paused":"Ended"));
    else{var nv=nextVisit(j);right.appendChild(el("span","chip",nv?"Next: "+dshort(nv.scheduled_date):"No visit set"))}
    b.appendChild(left);b.appendChild(right);b.addEventListener("click",function(){openJob(j.id)});list.appendChild(b)})}

/* ---- visit card (used in Schedule and in job detail) ---- */
function visitCard(v,after,showJob,opts){
  opts=opts||{};
  var j=byId(jobs,v.job_id),card=el("div","pcard"),top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px";
  var l=el("div");l.appendChild(el("b",null,(opts.num?opts.num+". ":"")+cname(v.client_id)+(j?" · "+j.title:"")));l.appendChild(el("div","note",[paddr(v.property_id),money(v.price)].filter(Boolean).join(" · ")));
  if(opts.detail){var pp=byId(props,v.property_id),tips=[pp&&pp.notes,j&&j.instructions].filter(Boolean).join("  |  ");if(tips){var tn=el("div","note","⚠ "+tips);tn.style.cssText="color:#7a5b00;white-space:pre-wrap";l.appendChild(tn)}}
  if(s3&&crew.length&&v.crew_id&&crewName(v.crew_id))l.appendChild(el("div","note","Crew: "+crewName(v.crew_id)));
  if(v.status!=="scheduled"||showJob===false)l.appendChild(el("div","note",dshort(v.scheduled_date)));
  if(v.status==="scheduled"&&v.weather_from){var wn=el("div","note","Moved by weather from "+dshort(v.weather_from));wn.style.color="#1f5f9a";l.appendChild(wn)}
  top.appendChild(l);
  if(v.status!=="scheduled")top.appendChild(el("span","chip "+(v.status==="done"?"won":"lost"),v.status==="done"?"Done":"Skipped"));
  card.appendChild(top);
  var a=el("div","acts");
  function patch(p,cb){
    function fin(){if(cb){cb();return}if(!billErr&&(p.status!==undefined||p.paid_at!==undefined))loadUnbilled().then(after);else after()}
    sb.from("visits").update(p).eq("id",v.id).then(function(r){
      if(r.error){alert("Could not save that.");return}
      Object.assign(v,p);
      if(j&&j.frequency==="once"&&(p.status==="done"||p.status==="skipped")&&j.status==="active"){sb.from("jobs").update({status:"ended"}).eq("id",j.id).then(function(){j.status="ended";fin()});return}
      if(j&&j.frequency==="once"&&p.status==="scheduled"&&j.status==="ended"){sb.from("jobs").update({status:"active"}).eq("id",j.id).then(function(){j.status="active";fin()});return}
      fin()})}
  function btns(){
    a.textContent="";
    if(v.status==="scheduled"){
      a.appendChild(btn("Done","btn sm",function(){patch({status:"done",completed_at:new Date().toISOString()})}));
      a.appendChild(btn("Skip","btn alt sm",function(){patch(wxOn()?{status:"skipped",weather_from:null,weather_batch:null}:{status:"skipped"})}));
      a.appendChild(btn("Move","btn alt sm",function(){
        a.textContent="";var di=document.createElement("input");di.type="date";di.value=v.scheduled_date;di.style.width="auto";a.appendChild(di);
        a.appendChild(btn("Save date","btn sm",function(){if(!di.value)return;var nd=di.value,od=v.scheduled_date,pp={scheduled_date:nd};if(wxOn()){pp.weather_from=null;pp.weather_batch=null}if(remOn())pp.reminded_at=null;patch(pp,nd>od?function(){catchup([v],"m|"+Date.now(),after)}:null)}));a.appendChild(btn("Cancel","btn alt sm",btns))}));
    }else{
      if(!v.invoice_id&&!v.paid_at)a.appendChild(btn("Undo","btn alt sm",function(){patch({status:"scheduled",completed_at:null})}));
      if(!billErr&&v.status==="done"){
        if(v.invoice_id){var oi=el("span","note","On an invoice");oi.style.alignSelf="center";a.appendChild(oi)}
        else if(v.paid_at){var pn=el("span","chip won","Paid"+(v.paid_method?" · "+v.paid_method:""));pn.style.alignSelf="center";a.appendChild(pn);a.appendChild(btn("Undo paid","btn alt sm",function(){patch({paid_at:null,paid_method:""})}))}
        else{var pl=el("span","note","Paid at visit:");pl.style.alignSelf="center";a.appendChild(pl);["Cash","Zelle","Check"].forEach(function(m){a.appendChild(btn(m,"btn alt sm",function(){patch({paid_at:new Date().toISOString(),paid_method:m})}))})}
      }
    }
    if(!photoErr&&v.status!=="skipped"){var pb=btn("Photo","btn alt sm",function(){pickPhotos(true,function(fs){pb.textContent="Uploading...";uploadMany(fs,{client_id:v.client_id,property_id:v.property_id,visit_id:v.id,kind:v.status==="done"?"after":"before"}).then(function(res){pb.textContent=res.ok?"Photo added ✓":"Photo";var msg=uploadMsg(res);if(msg)alert(msg);render()})})});a.appendChild(pb)}
    var pr=byId(props,v.property_id);
    if(pr){var m=el("a","btn alt sm","Map");m.href=mapsUrl(pr.address);m.target="_blank";m.rel="noopener";a.appendChild(m)}
    if(showJob!==false&&j)a.appendChild(btn("Job","btn alt sm",function(){openJob(j.id)}));
    if(opts.up!==undefined||opts.down!==undefined){var u=btn("▲","btn alt sm",opts.up||null);u.disabled=!opts.up;u.setAttribute("aria-label","Move earlier");var dn2=btn("▼","btn alt sm",opts.down||null);dn2.disabled=!opts.down;dn2.setAttribute("aria-label","Move later");a.appendChild(u);a.appendChild(dn2)}
    if(s3&&crew.length&&v.status==="scheduled"){var sel=document.createElement("select");sel.style.cssText="width:auto;padding:6px 8px;font-size:.88rem";sel.setAttribute("aria-label","Assign to");[["","Me / unassigned"]].concat(crew.filter(function(c){return c.active!==false}).map(function(c){return[c.id,c.name]})).forEach(function(o){var op=document.createElement("option");op.value=o[0];op.textContent=o[1];sel.appendChild(op)});sel.value=v.crew_id||"";sel.addEventListener("change",function(){patch({crew_id:sel.value||null})});a.appendChild(sel)}}
  btns();card.appendChild(a);return card}

/* ---- Schedule: Today/Day, Week, Month, Upcoming, Overdue, Done ---- */
var DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function mondayOf(s){var d=pd(s),k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return ymd(d)}
function longDate(s){return pd(s).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
function monthName(s){return pd(s).toLocaleDateString(undefined,{month:"long",year:"numeric"})}
function onDay(d){return visits.filter(function(v){return v.scheduled_date===d})}
function crewName(id){var c=byId(crew,id);return c?c.name:""}
function crewOk(v){return crewF==="all"||(crewF==="none"?!v.crew_id:v.crew_id===crewF)}
function dayOrder(a,b){
  var sa=a.status==="scheduled"?0:1,sb2=b.status==="scheduled"?0:1;if(sa!==sb2)return sa-sb2;
  if((a.sort_order||0)!==(b.sort_order||0))return(a.sort_order||0)-(b.sort_order||0);
  return cname(a.client_id).localeCompare(cname(b.client_id))}
function ensureFrom(d){
  if(d>=histFrom)return Promise.resolve();
  return sb.from("visits").select("*").gte("scheduled_date",d).lt("scheduled_date",histFrom).limit(5000).then(function(r){if(!r.error){visits=visits.concat(r.data||[]);histFrom=d}})}
function crewChips(list){
  if(!s3||!crew.length)return;
  var row=el("div","tabs");row.style.marginTop="8px";
  [["all","Everyone"],["none","Me"]].concat(crew.map(function(c){return[c.id,c.name]})).forEach(function(x){
    var b=el("button","tab"+(crewF===x[0]?" on":""),x[1]);b.type="button";b.addEventListener("click",function(){crewF=x[0];render()});row.appendChild(b)});
  list.appendChild(row)}
function calNav(title,prev,next,todayFn,showToday){
  var n=el("div","calnav");n.appendChild(btn("‹","btn alt sm",prev));var b=el("b",null,title);n.appendChild(b);n.appendChild(btn("›","btn alt sm",next));
  if(showToday)n.appendChild(btn("Today","btn alt sm",todayFn));return n}

function renderSchedule(){
  var tabs=$("tabs");tabs.textContent="";var t=today();
  var up=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date>=t}),od=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date<t}),dn=visits.filter(function(v){return v.status!=="scheduled"});
  [["day",selDate===t?"Today":"Day",-1],["week","Week",-1],["month","Month",-1],["upcoming","Upcoming",up.length],["overdue","Overdue",od.length],["done","Done",dn.length]].forEach(function(s){
    var b=el("button","tab"+(smode===s[0]?" on":""),s[1]);b.type="button";if(s[2]>=0)b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){smode=s[0];render()});tabs.appendChild(b)});
  if(s3&&isOwner())$("topbtns").appendChild(btn("Crew","btn alt",openCrew));
  var list=$("list");list.textContent="";
  if(jobsErr){list.appendChild(el("div","empty","The schedule isn't set up yet. Run the Stage 2 SQL in Supabase, then press Refresh."));return}
  if(smode==="day")return renderDay(list,od.length);
  if(smode==="week")return renderWeek(list);
  if(smode==="month")return renderMonth(list);
  var set=smode==="upcoming"?up:smode==="overdue"?od:dn;
  set=set.filter(function(v){if(!query)return true;var j=byId(jobs,v.job_id);return[cname(v.client_id),paddr(v.property_id),j?j.title:""].join(" ").toLowerCase().indexOf(query)>-1});
  set.sort(function(a,b){return smode==="done"?(a.scheduled_date<b.scheduled_date?1:-1):(a.scheduled_date<b.scheduled_date?-1:1)});
  if(smode==="done")set=set.slice(0,150);
  if(!set.length){list.appendChild(el("div","empty",smode==="upcoming"?"Nothing scheduled. Add a job to a client and its visits appear here.":smode==="overdue"?"Nothing overdue. Nice.":"No completed visits yet."));return}
  var groups={},order=[];set.forEach(function(v){if(!groups[v.scheduled_date]){groups[v.scheduled_date]=[];order.push(v.scheduled_date)}groups[v.scheduled_date].push(v)});
  order.forEach(function(d){
    var g=groups[d],box=el("div"),h=el("h3",null,dlabel(d)+"  ·  "+g.length+" stop"+(g.length>1?"s":"")+"  ·  "+money(g.reduce(function(s,v){return s+Number(v.price||0)},0)));
    h.style.cssText="margin:14px 0 6px;font-size:.98rem;color:var(--forest);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";
    var go=btn("Open day","btn alt sm",function(){selDate=d;smode="day";render()});h.appendChild(go);
    if(smode!=="done"){h.appendChild(btn("Push to next day","btn alt sm",function(){pushDay(d,g.length)}))}
    box.appendChild(h);g.forEach(function(v){box.appendChild(visitCard(v,function(){render()}))});list.appendChild(box)})}

function routeUrl(stops){
  var addrs=stops.map(function(v){return paddr(v.property_id)}).filter(Boolean).slice(0,10);if(!addrs.length)return"";
  var dest=addrs[addrs.length-1],w=addrs.slice(0,-1);
  return"https://www.google.com/maps/dir/?api=1&travelmode=driving&destination="+encodeURIComponent(dest)+(w.length?"&waypoints="+encodeURIComponent(w.join("|")):"")}
function moveVisit(v,dir,filtered){
  var ds=onDay(v.scheduled_date).filter(function(x){return x.status==="scheduled"}).sort(dayOrder);
  var fi=filtered.indexOf(v),nb=filtered[fi+dir];if(!nb)return;
  var i=ds.indexOf(v),j=ds.indexOf(nb);ds[i]=nb;ds[j]=v;
  var jobsToDo=[];ds.forEach(function(x,k){var n=k*10;if((x.sort_order||0)!==n){x.sort_order=n;jobsToDo.push(sb.from("visits").update({sort_order:n}).eq("id",x.id))}});
  Promise.all(jobsToDo).then(function(rs){if(rs.some(function(r){return r.error}))alert("Could not save the new order.");render()})}

function renderDay(list,odCount){
  var d=selDate,t=today();
  list.appendChild(calNav(longDate(d),function(){selDate=addDays(d,-1);render()},function(){selDate=addDays(d,1);render()},function(){selDate=t;render()},d!==t));
  var di=document.createElement("input");di.type="date";di.value=d;di.style.cssText="width:auto;margin-left:auto";di.setAttribute("aria-label","Jump to date");di.addEventListener("change",function(){if(di.value){selDate=di.value;render()}});list.lastChild.appendChild(di);
  if(d===t&&odCount){var ob=btn(odCount+" overdue visit"+(odCount>1?"s":"")+" need attention. Tap to review.","btn alt",function(){smode="overdue";render()});ob.style.cssText="margin-bottom:10px;border-color:#b3261e;color:#b3261e;width:100%";list.appendChild(ob)}
  crewChips(list);
  wxBanners(list,d);
  var all=onDay(d).filter(crewOk).sort(dayOrder),sched=all.filter(function(v){return v.status==="scheduled"});
  if(!all.length){list.appendChild(el("div","empty","Nothing scheduled for this day."));return}
  var done=all.filter(function(v){return v.status==="done"}).length,total=all.reduce(function(s,v){return s+(v.status==="skipped"?0:Number(v.price||0))},0);
  var sum=el("div","daysum");sum.appendChild(el("b",null,all.length+" stop"+(all.length>1?"s":"")+" · "+money(total)+(done?" · "+done+" done":"")));
  var bt=el("span");
  if(sched.length){
    var ru=routeUrl(sched);if(ru){var a=el("a","btn sm","Start route");a.href=ru;a.target="_blank";a.rel="noopener";bt.appendChild(a);bt.appendChild(document.createTextNode(" "))}
    if(s3&&isOwner()){bt.appendChild(btn("Send route","btn alt sm",function(){openSendRoute(d)}));bt.appendChild(document.createTextNode(" "))}
    bt.appendChild(btn("Reminders","btn alt sm",function(){remindPanel(sched,"visit","Reminders · "+dlabel(d))}));bt.appendChild(document.createTextNode(" "));bt.appendChild(btn("Weather delay","btn alt sm",function(){openWeather(d)}))}
  sum.appendChild(bt);list.appendChild(sum);
  if(sched.length>10)list.appendChild(el("div","note","The route link covers the first 10 stops in your order."));
  all.forEach(function(v){
    var idx=sched.indexOf(v),opts={detail:true};
    if(s3&&idx>-1){opts.up=idx>0?function(){moveVisit(v,-1,sched)}:null;opts.down=idx<sched.length-1?function(){moveVisit(v,1,sched)}:null;opts.num=idx+1}
    list.appendChild(visitCard(v,function(){render()},true,opts))})}

function renderWeek(list){
  var ws=mondayOf(selDate),we=addDays(ws,6),t=today();
  list.appendChild(calNav(pd(ws).toLocaleDateString(undefined,{month:"short",day:"numeric"})+" – "+pd(we).toLocaleDateString(undefined,{month:"short",day:"numeric"}),function(){selDate=addDays(ws,-7);render()},function(){selDate=addDays(ws,7);render()},function(){selDate=t;render()},!(t>=ws&&t<=we)));
  if(ws<histFrom){ensureFrom(ws).then(function(){if(smode==="week")render()})}
  crewChips(list);
  var g=el("div","weekgrid");
  for(var i=0;i<7;i++){(function(d,i){
    var vs=onDay(d).filter(crewOk).sort(dayOrder),col=el("div","daycol"+(d===t?" today":"")+(i>=5?" wkend":""));
    var h=el("button","dayhd");h.type="button";h.appendChild(el("b",null,DOW[i]+" "+pd(d).getDate()));
    var tot=vs.reduce(function(s,v){return s+(v.status==="skipped"?0:Number(v.price||0))},0);
    h.appendChild(el("span",null,vs.length?vs.length+" stop"+(vs.length>1?"s":"")+" · "+money(tot):"—"));
    h.addEventListener("click",function(){selDate=d;smode="day";render()});col.appendChild(h);
    vs.slice(0,8).forEach(function(v){var b=el("button","vline "+v.status);b.type="button";b.textContent=cname(v.client_id)+(v.crew_id&&crewName(v.crew_id)?" ("+crewName(v.crew_id).split(" ")[0]+")":"");b.addEventListener("click",function(){selDate=d;smode="day";render()});col.appendChild(b)});
    if(vs.length>8)col.appendChild(el("div","note","+"+(vs.length-8)+" more"));
    g.appendChild(col)})(addDays(ws,i),i)}
  list.appendChild(g)}

function renderMonth(list){
  var first=selDate.slice(0,8)+"01",t=today(),gs=mondayOf(first);
  list.appendChild(calNav(monthName(first),function(){selDate=addDays(first,-1).slice(0,8)+"01";render()},function(){selDate=addDays(first,32).slice(0,8)+"01";render()},function(){selDate=t;render()},t.slice(0,7)!==first.slice(0,7)));
  if(gs<histFrom){ensureFrom(gs).then(function(){if(smode==="month")render()})}
  crewChips(list);
  var g=el("div","monthgrid");DOW.forEach(function(n){g.appendChild(el("div","mh",n))});
  for(var i=0;i<42;i++){(function(d){
    if(i>=35&&d.slice(0,7)!==first.slice(0,7))return;
    var vs=onDay(d).filter(crewOk),cell=el("button","mcell"+(d.slice(0,7)!==first.slice(0,7)?" other":"")+(d===t?" today":""));cell.type="button";
    cell.appendChild(el("span","mn",String(pd(d).getDate())));
    if(vs.length){cell.appendChild(el("span","mc",vs.length+(vs.length>1?" stops":" stop")));cell.appendChild(el("span","mt",money(vs.reduce(function(s,v){return s+(v.status==="skipped"?0:Number(v.price||0))},0))))}
    cell.addEventListener("click",function(){selDate=d;smode="day";render()});g.appendChild(cell)})(addDays(gs,i))}
  list.appendChild(g)}
function wxOn(){return visits.some(function(v){return"weather_batch" in v})}
function gk(v){return v.weather_batch?String(v.weather_batch).split("#")[0]:"L|"+v.weather_from}
function ddiff(a,b){return Math.round((pd(b)-pd(a))/86400000)}

/* Weather delay: pick "just this day" or roll the next few days forward too. Every moved stop remembers where it came from so one tap can undo it. */
function openWeather(d){
  var p=panel();p.appendChild(el("h2",null,"Weather delay"));
  p.appendChild(el("p","note","Moves scheduled stops to the following day. Done and skipped stops stay put. Rolling forward keeps your route order and stops days from piling up on top of each other. You can undo it afterward."));
  var lab=el("label",null,"How many days?"),sel=document.createElement("select");
  for(var n=0;n<=6;n++){var o=document.createElement("option");o.value=n;o.textContent=n===0?"Just this day ("+dlabel(d)+")":"This day and the next "+n+" day"+(n>1?"s":"")+" (rolls everything forward)";sel.appendChild(o)}
  lab.appendChild(sel);p.appendChild(lab);
  var pv=el("div","note");pv.style.cssText="margin:10px 0;white-space:pre-line";p.appendChild(pv);
  function cnt(day){return onDay(day).filter(function(v){return v.status==="scheduled"}).length}
  function prev(){var n=+sel.value,ls=[],tot=0;for(var i=0;i<=n;i++){var day=addDays(d,i),c=cnt(day);tot+=c;ls.push(dshort(day)+": "+c+" stop"+(c===1?"":"s")+" → "+dshort(addDays(day,1)))}pv.textContent=ls.join("\n");go.disabled=!tot;go.textContent=tot?"Delay "+tot+" stop"+(tot>1?"s":""):"Nothing to move"}
  var go=btn("Delay","btn",function(){go.disabled=true;doDelay(d,+sel.value)});go.style.marginTop="6px";
  sel.addEventListener("change",prev);p.appendChild(go);prev()}
function doDelay(d,n){
  var key="w|"+d+"|"+Date.now(),chain=Promise.resolve(null);
  for(var i=n;i>=0;i--){(function(day){chain=chain.then(function(err){if(err)return err;return sb.from("visits").update(Object.assign({scheduled_date:addDays(day,1),weather_from:day,weather_batch:key},remOn()?{reminded_at:null}:{})).eq("scheduled_date",day).eq("status","scheduled").then(function(r){return r.error||null})})})(addDays(d,i))}
  chain.then(function(err){
    if(err){closeDetail();alert(/weather_/.test(err.message||"")?"Weather delay needs a one-time setup. Run the weather SQL in Supabase (SQL Editor), then try again.":"Something went wrong while moving the stops. Check the schedule; Undo weather delay will put back anything that moved.");loadVisits().then(render);return}
    loadVisits().then(function(){closeDetail();render();catchup(visits.filter(function(v){return v.weather_batch===key&&v.status==="scheduled"}),key,function(){render();remindPanel(visits.filter(function(v){return v.weather_batch===key&&v.status==="scheduled"}),"delay","Let clients know")})})})}
function undoWeather(key){
  var vs=visits.filter(function(v){return v.weather_from&&gk(v)===key&&(v.status==="scheduled"||v.status==="skipped")});
  if(!vs.length)return;
  if(!confirm("Put "+vs.length+" visit"+(vs.length>1?"s":"")+" back on their original days (including any catch-up changes made with this)?"))return;
  var by={};vs.forEach(function(v){(by[v.weather_from]=by[v.weather_from]||[]).push(v.id)});
  Promise.all(Object.keys(by).map(function(f){return sb.from("visits").update({scheduled_date:f,weather_from:null,weather_batch:null,status:"scheduled"}).in("id",by[f])})).then(function(rs){
    if(rs.some(function(r){return r.error}))alert("Could not undo everything.");loadVisits().then(render)})}
function wxBanners(list,d){
  var g={};
  visits.forEach(function(v){if(!v.weather_from)return;var rst=/#R$/.test(v.weather_batch||"");
    if(v.status==="skipped"&&!v.weather_batch)return;if(v.status!=="scheduled"&&v.status!=="skipped")return;if(v.status==="scheduled"&&v.scheduled_date===v.weather_from)return;
    var k=gk(v),x=g[k]=g[k]||{moved:0,adj:0,first:null,hit:false};
    if(v.status==="skipped"||rst)x.adj++;else{x.moved++;if(!x.first||v.weather_from<x.first)x.first=v.weather_from}
    if(v.weather_from===d||v.scheduled_date===d)x.hit=true});
  Object.keys(g).sort().forEach(function(k){var x=g[k];if(!x.hit)return;
    var man=k.charAt(0)==="m",t=man?"↔ Catch-up change: "+x.adj+" visit"+(x.adj>1?"s":"")+" adjusted.":"☔ Weather delay"+(x.first?" from "+dshort(x.first):"")+": "+x.moved+" stop"+(x.moved===1?"":"s")+" moved"+(x.adj?" · "+x.adj+" catch-up change"+(x.adj>1?"s":""):"")+".";
    var b=el("div","wxbar");b.appendChild(el("span",null,t));b.appendChild(btn(man?"Undo":"Undo weather delay","btn alt sm",function(){undoWeather(k)}));list.appendChild(b)})}

/* Smart catch-up: after a repeating (weekly / every 2 weeks) visit is pushed later, check whether the next one is now too close. */
function catchup(moved,key,after){
  var cons=[],seen={};
  moved.slice().sort(function(a,b){return a.orig_date<b.orig_date?-1:1}).forEach(function(mv){
    var jb=byId(jobs,mv.job_id);if(!jb||jb.status!=="active"||(jb.frequency!=="weekly"&&jb.frequency!=="biweekly")||seen[jb.id])return;seen[jb.id]=1;
    var iv=jb.frequency==="weekly"?7:14,nx=visits.filter(function(v){return v.job_id===jb.id&&v.status==="scheduled"&&v.id!==mv.id&&v.orig_date>mv.orig_date}).sort(function(a,b){return a.orig_date<b.orig_date?-1:1})[0];
    if(!nx)return;var gap=ddiff(mv.scheduled_date,nx.scheduled_date);
    if(gap<=Math.floor(iv/2))cons.push({mv:mv.id,nx:nx.id,job:jb,iv:iv,gap:gap})});
  if(!cons.length){after();return}
  var p=panel();p.appendChild(el("h2",null,"Catch-up check"));
  p.appendChild(el("p","note","These repeating jobs now have a cut very close to the next one. Choose what to do for each. Leaving it alone keeps both visits."));
  var cards=[];
  function act(c,kind,card,row){
    var mv=byId(visits,c.mv),nx=byId(visits,c.nx);if(!mv||!nx)return Promise.resolve();
    var f=wxOn()?{weather_from:nx.scheduled_date,weather_batch:key}:{},ps;
    if(kind==="skip"){ps=[sb.from("visits").update(Object.assign({status:"skipped"},f)).eq("id",nx.id)]}
    else{var delta=ddiff(nx.scheduled_date,addDays(mv.scheduled_date,c.iv));
      ps=visits.filter(function(v){return v.job_id===c.job.id&&v.status==="scheduled"&&v.orig_date>=nx.orig_date}).map(function(v){return sb.from("visits").update(Object.assign({scheduled_date:addDays(v.scheduled_date,delta)},wxOn()?{weather_from:v.scheduled_date,weather_batch:key+"#R"}:{})).eq("id",v.id)})}
    return Promise.all(ps).then(function(rs){row.textContent="";row.appendChild(el("div","note",rs.some(function(r){return r.error})?"Could not save that.":kind==="skip"?"✓ Next visit skipped.":"✓ Schedule reset: every "+(c.iv===7?"week":"2 weeks")+" from "+dshort(mv.scheduled_date)+"."));return loadVisits().then(render)})}
  cons.forEach(function(c){
    var mv=byId(visits,c.mv),nx=byId(visits,c.nx),card=el("div","pcard"),row=el("div","acts");
    card.appendChild(el("b",null,cname(mv.client_id)+" · "+c.job.title+" ("+flabel(c.job.frequency).toLowerCase()+")"));
    card.appendChild(el("div","note","This cut is now "+dshort(mv.scheduled_date)+" and the next is "+dshort(nx.scheduled_date)+(c.gap>0?", only "+c.gap+" day"+(c.gap>1?"s":"")+" later.":", the same day or earlier.")));
    var rs=btn("Reset: next one "+(c.iv===7?"1 week":"2 weeks")+" after this cut (recommended)","btn sm",function(){act(c,"reset",card,row)});
    row.appendChild(rs);row.appendChild(btn("Skip the next one","btn alt sm",function(){act(c,"skip",card,row)}));row.appendChild(btn("Keep both","btn alt sm",function(){row.textContent="";row.appendChild(el("div","note","Kept as scheduled."))}));
    card.appendChild(row);card.style.marginBottom="10px";p.appendChild(card);cards.push({c:c,card:card,row:row})});
  var dn=btn("Done","btn",function(){closeDetail();after()});dn.style.marginTop="8px";p.appendChild(dn)}

/* ---- Text reminders (tap-to-text: opens your own Messages app, nothing is sent until you press Send there) ---- */
function remOn(){return visits.some(function(v){return"reminded_at" in v})}
function firstName(c){return String((c&&c.name)||"").split(" ")[0]||"there"}
function remMsg(mode,c,vs){
  var nm=bizv("name","Latta Corp"),addrs=[];vs.forEach(function(v){var a=paddr(v.property_id);if(a&&addrs.indexOf(a)<0)addrs.push(a)});
  var dts=vs.map(function(v){return v.scheduled_date}).sort(),when=dlabel(dts[0]);
  if(mode==="delay")return"Hi "+firstName(c)+", this is "+nm+". Because of the weather we've moved your service"+(addrs.length===1?" at "+addrs[0]:"")+" to "+(dts[0]===addDays(today(),1)?"tomorrow, "+dshort(dts[0]):dshort(dts[0]))+". Thank you for understanding!";
  return"Hi "+firstName(c)+", this is "+nm+". We're scheduled to take care of your property"+(addrs.length===1?" at "+addrs[0]:"")+" "+(dts[0]===today()?"today":dts[0]===addDays(today(),1)?"tomorrow, "+dshort(dts[0]):"on "+dshort(dts[0]))+". If anything needs to change (gate, pets, etc.), just reply here. Thank you!"}
function remindPanel(vs,mode,title){
  var p=panel();p.appendChild(el("h2",null,title));
  p.appendChild(el("p","note",mode==="delay"?"Let these clients know their visit moved. Tap Email to open a ready-to-send message in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send.":"Tap Email to open a ready-to-send reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."));
  var by={},order=[];vs.slice().sort(mode==="delay"?function(a,b){return a.scheduled_date<b.scheduled_date?-1:1}:dayOrder).forEach(function(v){if(!by[v.client_id]){by[v.client_id]=[];order.push(v.client_id)}by[v.client_id].push(v)});
  if(!order.length){p.appendChild(el("div","empty","No stops to text about."))}
  var sent={};
  order.forEach(function(cid){
    var c=byId(clients,cid)||{},list=by[cid],card=el("div","pcard"),top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l=el("div");l.appendChild(el("b",null,c.name||"(deleted client)"));
    var ad=[];list.forEach(function(v){var a=paddr(v.property_id);if(a&&ad.indexOf(a)<0)ad.push(a)});l.appendChild(el("div","note",ad.join(" · ")+(mode==="delay"?" · now "+dshort(list[0].scheduled_date):"")));top.appendChild(l);
    var r=el("div");r.style.cssText="display:flex;gap:8px;align-items:center";
    var chip=el("span","chip won","✓ Sent");chip.hidden=!(mode==="visit"&&list.every(function(v){return v.reminded_at}));
    r.appendChild(chip);
    msgActions(r,c,remMsg(mode,c,list),remSubj(mode),function(){chip.hidden=false;if(mode==="visit"){var on=remOn(),now=new Date().toISOString();list.forEach(function(v){v.reminded_at=now});if(on)sb.from("visits").update({reminded_at:now}).in("id",list.map(function(v){return v.id})).then(function(){})}});
    top.appendChild(r);card.appendChild(top);p.appendChild(card)});
  var dn=btn(mode==="delay"?"Skip / Done":"Done","btn alt");dn.style.marginTop="10px";dn.addEventListener("click",function(){closeDetail();render()});p.appendChild(dn)}
function invRemind(inv,c){
  return"Hi "+firstName(c)+", a friendly reminder from "+bizv("name","Latta Corp")+": invoice "+invNum(inv.number)+" ("+money(inv.total)+") "+(isOverdue(inv)?"was due "+dshort(inv.due_date):"is due "+dshort(inv.due_date))+"."+(inv.share_token?" You can view it here: "+docUrl(inv.share_token)+" ":"")+(bizv("zelle","")?" Pay with Zelle: "+biz.zelle+".":"")+" If you've already paid, thank you!"}
function stampInv(inv){var on="reminded_at" in inv,now=new Date().toISOString();inv.reminded_at=now;if(on)sb.from("invoices").update({reminded_at:now}).eq("id",inv.id).then(function(){})}
function remindOverdue(od){
  var p=panel();p.appendChild(el("h2",null,"Remind overdue clients"));
  p.appendChild(el("p","note","Tap Email to open a ready-to-send payment reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."));
  od.slice().sort(function(a,b){return a.due_date<b.due_date?-1:1}).forEach(function(i){
    var c=byId(clients,i.client_id)||{},card=el("div","pcard"),top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l=el("div");l.appendChild(el("b",null,invNum(i.number)+" · "+cname(i.client_id)));l.appendChild(el("div","note",money(i.total)+" · due "+dshort(i.due_date)+(i.reminded_at?" · last reminded "+dshort(String(i.reminded_at).slice(0,10)):"")));top.appendChild(l);
    var r=el("div");r.style.cssText="display:flex;gap:8px;align-items:center";var chip=el("span","chip won","✓ Sent");chip.hidden=true;r.appendChild(chip);
    msgActions(r,c,invRemind(i,c),"Payment reminder: invoice "+invNum(i.number),function(){chip.hidden=false;stampInv(i)});
    top.appendChild(r);card.appendChild(top);p.appendChild(card)});
  var dn=btn("Done","btn alt");dn.style.marginTop="10px";dn.addEventListener("click",function(){closeDetail();render()});p.appendChild(dn)}

function mailHref(to,subject,body){return"mailto:"+encodeURIComponent(to).replace("%40","@")+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body)}
function remSubj(mode){return mode==="delay"?"Schedule change from "+bizv("name","Latta Corp"):"Service reminder from "+bizv("name","Latta Corp")}
function copyBtn(label,text,small,cb){
  var b=btn(label,"btn alt"+(small?" sm":""),function(){
    function ok(){var o=b.textContent;b.textContent="Copied ✓";setTimeout(function(){b.textContent=o},1400);if(cb)cb()}
    function fb(){var t=document.createElement("textarea");t.value=text;t.style.cssText="position:fixed;opacity:0";document.body.appendChild(t);t.select();try{document.execCommand("copy");ok()}catch(e){alert("Could not copy. Select the text and copy it yourself.")}document.body.removeChild(t)}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(ok,fb);else fb()});
  return b}
/* Email is the normal way to reach clients. Text (opens Messages on a phone) is for owners only; Copy lets anyone paste the message elsewhere. */
function msgActions(r,c,body,subject,onUse){
  var any=false;
  if(c.email){var e=el("a","btn sm","Email");e.href=mailHref(c.email,subject,body);e.addEventListener("click",onUse);r.appendChild(e);any=true}
  if(isOwner()&&c.phone){var a=el("a","btn alt sm","Text");a.href=smsHref(c.phone,body);a.addEventListener("click",onUse);r.appendChild(a);any=true}
  if(any)r.appendChild(copyBtn("Copy",body,true,onUse));
  else r.appendChild(el("span","note",isOwner()?"No email or phone on file":"No email on file"))}

/* ---- Team: owners add office staff and co-owners ---- */
function renderTeam(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  var intro=el("div","note","Everyone here signs in at this same address with their own email and password. Owners and co-owners can do everything. Office staff can use clients, jobs, schedule, billing and invoices, and email clients, but they can't add people, manage crew logins, or text from the CRM.");intro.style.marginBottom="12px";list.appendChild(intro);
  var holder=el("div");list.appendChild(holder);holder.appendChild(el("div","empty","Loading the team..."));
  var ROLES=[["office","Office (clients, jobs, schedule, billing)"],["owner","Owner / co-owner (everything)"]];
  function draw(members){
    holder.textContent="";
    members.forEach(function(m){
      var card=el("div","pcard"),top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
      var l=el("div");l.appendChild(el("b",null,(m.name||m.email)+(m.email===myEmail?" (you)":"")));l.appendChild(el("div","note",m.email));top.appendChild(l);
      top.appendChild(el("span","chip "+(m.role==="owner"?"won":""),m.role==="owner"?"Owner":"Office"));card.appendChild(top);
      var a=el("div","acts");a.style.marginTop="8px";
      if(m.email!==myEmail){
        a.appendChild(btn(m.role==="owner"?"Make office":"Make owner","btn alt sm",function(){if(!confirm(m.role==="owner"?"Change "+(m.name||m.email)+" to office staff?":"Make "+(m.name||m.email)+" an owner? Owners can see and do everything, including adding and removing people."))return;callApi("/api/team","role",{email:m.email,role:m.role==="owner"?"office":"owner"}).then(function(res){if(!res.ok){alert(res.error);return}load2()})}));
        if(m.hasLogin)a.appendChild(btn("Reset password","btn alt sm",function(){
          a.textContent="";var np=document.createElement("input");np.type="text";np.placeholder="New password (8+ characters)";np.autocomplete="off";np.style.width="auto";a.appendChild(np);
          a.appendChild(btn("Set password","btn sm",function(){callApi("/api/team","reset",{email:m.email,password:np.value}).then(function(res){if(!res.ok){alert(res.error);return}alert("Password changed. Tell them the new password.");load2()})}));a.appendChild(btn("Cancel","btn alt sm",load2))}));
        a.appendChild(btn("Remove","btn danger sm",function(){if(!confirm("Remove "+(m.name||m.email)+"? They won't be able to sign in any more."))return;callApi("/api/team","remove",{email:m.email}).then(function(res){if(!res.ok){alert(res.error);return}load2()})}))}
      card.appendChild(a);holder.appendChild(card)});
    var h=el("h3",null,"Add a team member");h.style.margin="18px 0 6px";holder.appendChild(h);
    var box=el("div","pcard"),g=el("div","grid2"),nm=fld("Name","text",""),em=fld("Their login email","email",""),rl=fld("Role","select","office",ROLES),pw=fld("Starting password (8+ characters, you tell them)","text","");pw.input.autocomplete="off";
    g.appendChild(nm);g.appendChild(em);box.appendChild(g);box.appendChild(rl);box.appendChild(pw);
    var add=btn("Add to team","btn",function(){
      if(!nm.input.value.trim()){alert("Enter a name.");return}if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())){alert("Enter their login email.");return}if(pw.input.value.length<8){alert("The password needs at least 8 characters.");return}
      add.disabled=true;callApi("/api/team","create",{name:nm.input.value.trim(),email:em.input.value.trim(),role:rl.input.value,password:pw.input.value}).then(function(res){add.disabled=false;if(!res.ok){alert(res.error);return}alert("Added. Give them the email and password; they sign in at this same address.");load2()})});
    add.style.marginTop="10px";box.appendChild(add);holder.appendChild(box)}
  function load2(){callApi("/api/team","list",{}).then(function(res){
    if(!res.ok){holder.textContent="";holder.appendChild(el("div","empty",res.error));return}
    myEmail=res.data.me||myEmail;draw(res.data.members||[])})}
  load2()}

/* ---- To-Do list (shared by the whole team) ---- */
function memberName(e){if(!e)return"";var m=team.filter(function(x){return String(x.email).toLowerCase()===String(e).toLowerCase()})[0];return m&&m.name?m.name:String(e).split("@")[0]}
function todoDueState(t){return t.done||!t.due_date?"":t.due_date<today()?"od":t.due_date===today()?"today":""}
function toggleTodo(t,done){
  var now=done?new Date().toISOString():null,by=done?myEmail:"";
  sb.from("todos").update({done:done,done_at:now,done_by:by}).eq("id",t.id).then(function(r){if(r.error){alert("Could not save that.");return}t.done=done;t.done_at=now;t.done_by=by;render()})}
function renderTodo(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  if(todoErr){list.appendChild(el("div","empty","To-Do isn't set up yet. Run the Stage 8 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var me=(myEmail||"").toLowerCase(),open=todos.filter(function(t){return!t.done}),mine=open.filter(function(t){return String(t.assigned_to).toLowerCase()===me&&me}),dn=todos.filter(function(t){return t.done});
  [["open","Open",open.length],["mine","Mine",mine.length],["done","Done",dn.length]].forEach(function(s){
    var b=el("button","tab"+(tfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){tfilter=s[0];render()});tabs.appendChild(b)});
  $("topbtns").appendChild(btn("+ New task","btn",function(){openTodo(null)}));
  var qa=el("div","qadd"),ti=document.createElement("input");ti.type="text";ti.placeholder="Add a task and press Enter...";ti.setAttribute("aria-label","New task");
  var di=document.createElement("input");di.type="date";di.setAttribute("aria-label","Due date (optional)");di.title="Due date (optional)";
  function add(){var v=ti.value.trim();if(!v)return;ab.disabled=true;
    sb.from("todos").insert({title:v,due_date:di.value||null,created_by:myEmail||"",assigned_to:tfilter==="mine"?(myEmail||""):""}).select().single().then(function(r){ab.disabled=false;if(r.error||!r.data){alert("Could not add the task.");return}todos.unshift(r.data);render()})}
  var ab=btn("Add","btn",add);ti.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();add()}});
  qa.appendChild(ti);qa.appendChild(di);qa.appendChild(ab);list.appendChild(qa);
  var set=tfilter==="done"?dn.slice().sort(function(a,b){return String(b.done_at||"")<String(a.done_at||"")?-1:1}):(tfilter==="mine"?mine:open);
  if(query)set=set.filter(function(t){return[t.title,t.notes,cname(t.client_id),memberName(t.assigned_to)].join(" ").toLowerCase().indexOf(query)>-1});
  if(!set.length){list.appendChild(el("div","empty",tfilter==="done"?"Nothing completed yet.":tfilter==="mine"?"Nothing assigned to you.":"Nothing to do. Add a task above."));return}
  var groups=[];
  if(tfilter==="done")groups=[["Completed",set]];
  else{
    var t0=today(),by=function(f){return set.filter(f).sort(function(a,b){return(a.due_date||"")<(b.due_date||"")?-1:1})};
    groups=[["Overdue",by(function(t){return t.due_date&&t.due_date<t0})],["Today",by(function(t){return t.due_date===t0})],["Upcoming",by(function(t){return t.due_date&&t.due_date>t0})],["No date",set.filter(function(t){return!t.due_date})]]}
  groups.forEach(function(g){if(!g[1].length)return;
    var h=el("h3",null,g[0]+" ("+g[1].length+")");h.style.cssText="margin:14px 0 6px;font-size:.95rem;color:"+(g[0]==="Overdue"?"var(--red)":"var(--muted)");list.appendChild(h);
    g[1].forEach(function(t){
      var row=el("div","todo"+(t.done?" done":"")),ck=el("button","ck",t.done?"✓":"");ck.type="button";ck.setAttribute("aria-label",t.done?"Mark not done":"Mark done");ck.addEventListener("click",function(e){e.stopPropagation();toggleTodo(t,!t.done)});
      var body=el("div","tb");body.appendChild(el("div","tt",t.title));
      var sub=[];if(t.due_date)sub.push(dshort(t.due_date));if(t.assigned_to)sub.push(memberName(t.assigned_to));if(t.client_id)sub.push(cname(t.client_id));if(t.done&&t.done_at)sub.push("done "+dshort(String(t.done_at).slice(0,10))+(t.done_by?" by "+memberName(t.done_by):""));
      if(sub.length){var sd=el("div","note",sub.join(" · "));if(todoDueState(t)==="od")sd.style.color="var(--red)";body.appendChild(sd)}
      if(t.notes)body.appendChild(el("div","note",t.notes.length>110?t.notes.slice(0,110)+"…":t.notes));
      row.appendChild(ck);row.appendChild(body);row.addEventListener("click",function(){openTodo(t)});list.appendChild(row)})})}
function openTodo(t){
  var p=panel();p.appendChild(el("h2",null,t?"Task":"New task"));
  var ti=fld("Task","text",t?t.title:""),no=fld("Notes (optional)","textarea",t?t.notes:""),du=fld("Due date (optional)","date",t&&t.due_date?t.due_date:"");
  var tm=[["","Anyone"]].concat(team.map(function(m){return[m.email,m.name||m.email]}));
  if(t&&t.assigned_to&&!tm.some(function(x){return String(x[0]).toLowerCase()===String(t.assigned_to).toLowerCase()}))tm.push([t.assigned_to,memberName(t.assigned_to)]);
  var as=fld("Assigned to","select",t?t.assigned_to:"",tm);
  var cl=fld("Client (optional)","select",t&&t.client_id?t.client_id:"",[["","None"]].concat(clients.filter(function(c){return!c.archived||(t&&t.client_id===c.id)}).map(function(c){return[c.id,c.name]})));
  [ti,no,du,as,cl].forEach(function(f){p.appendChild(f)});
  var acts=el("div","acts");acts.style.marginTop="12px";
  var sv=btn("Save","btn",function(){
    var title=ti.input.value.trim();if(!title){alert("Enter a task.");return}
    var row={title:title,notes:no.input.value.trim(),due_date:du.input.value||null,assigned_to:as.input.value,client_id:cl.input.value||null};sv.disabled=true;
    var q=t?sb.from("todos").update(row).eq("id",t.id).select().single():sb.from("todos").insert(Object.assign({created_by:myEmail||""},row)).select().single();
    q.then(function(r){sv.disabled=false;if(r.error||!r.data){alert("Could not save.");return}if(t)Object.assign(t,r.data);else todos.unshift(r.data);closeDetail();render()})});
  acts.appendChild(sv);
  if(t){acts.appendChild(btn(t.done?"Mark not done":"Mark done","btn alt",function(){toggleTodo(t,!t.done);closeDetail()}));
    acts.appendChild(btn("Delete","btn danger",function(){if(!confirm("Delete this task?"))return;sb.from("todos").delete().eq("id",t.id).then(function(r){if(r.error){alert("Could not delete.");return}todos=todos.filter(function(z){return z.id!==t.id});closeDetail();render()})}))}
  p.appendChild(acts)}

/* ---- Reports & expenses ---- */
var EXP_LIST=["Chemicals","Dump/Recycling","Entertainment","Equipment","Equipment Repairs & Maintenance","Fuel","Groceries","Insurance","Licensing & Permits","Meal","Office Repairs & Maintenance","Office Supplies","Postage & Shipping","Repairs & Maintenance","Safety Supplies","Supplies","Tools","Transportation","Travel","Uniform","Vehicle Repairs & Maintenance"];
var PAYMENTS=["Debit","Credit","Cash","Check","Zelle","Other"];
function expCats(){var l=EXP_LIST.slice();expenses.forEach(function(e){if(e.category&&l.indexOf(e.category)<0)l.push(e.category)});return l}
function monthStart(s){return s.slice(0,8)+"01"}
function monthEndOf(s){return addDays(addDays(monthStart(s),32).slice(0,8)+"01",-1)}
function periodRange(){
  var t=today(),y=t.slice(0,4);
  if(rper==="month")return[monthStart(t),monthEndOf(t)];
  if(rper==="last"){var lm=addDays(monthStart(t),-1);return[monthStart(lm),lm]}
  if(rper==="quarter"){var m=+t.slice(5,7),q=Math.floor((m-1)/3)*3+1,qs=y+"-"+pad(q)+"-01";return[qs,monthEndOf(addDays(qs,70))]}
  if(rper==="ytd")return[y+"-01-01",t];
  if(rper==="lastyear")return[(+y-1)+"-01-01",(+y-1)+"-12-31"];
  return[rfrom||monthStart(t),rto||t]}
function periodBar(list){
  var bar=el("div","pbar");
  [["month","This month"],["last","Last month"],["quarter","This quarter"],["ytd","Year to date"],["lastyear","Last year"],["custom","Custom"]].forEach(function(p){
    var b=el("button","tab"+(rper===p[0]?" on":""),p[1]);b.type="button";b.addEventListener("click",function(){if(p[0]==="custom"&&!rfrom){var r=periodRange();rfrom=r[0];rto=r[1]}rper=p[0];render()});bar.appendChild(b)});
  list.appendChild(bar);
  if(rper==="custom"){var cr=el("div","pbar");[["From","from"],["To","to"]].forEach(function(x){var l=el("label","f");l.style.margin="0";l.appendChild(el("span",null,x[0]));var di=document.createElement("input");di.type="date";di.style.width="auto";di.value=x[1]==="from"?rfrom:rto;di.addEventListener("change",function(){if(x[1]==="from")rfrom=di.value||rfrom;else rto=di.value||rto;render()});l.appendChild(di);cr.appendChild(l)});list.appendChild(cr)}
  var r=periodRange();list.appendChild(el("div","note",dshort(r[0])+" – "+dshort(r[1])))}
function inRange(d,a,b){return d>=a&&d<=b}
function computeReport(from,to){
  var a=sb.from("visits").select("id,client_id,scheduled_date,price").eq("status","done").gte("scheduled_date",from).lte("scheduled_date",to).limit(20000);
  var b=sb.from("visits").select("id,client_id,price,paid_at,paid_method").is("invoice_id",null).gte("paid_at",from+"T00:00:00").lte("paid_at",to+"T23:59:59").limit(20000);
  return Promise.all([a,b]).then(function(rs){
    if(rs[0].error||rs[1].error)return{error:true};
    var done=rs[0].data||[],pays=[];
    invoices.forEach(function(i){var d=i.paid_at?String(i.paid_at).slice(0,10):"";if(i.status==="paid"&&d&&inRange(d,from,to)&&Number(i.total)>0)pays.push({date:d,type:"Invoice",client_id:i.client_id,ref:invNum(i.number),method:i.paid_method||"",amount:Number(i.total)})});
    (rs[1].data||[]).forEach(function(v){if(Number(v.price)>0&&v.paid_at)pays.push({date:String(v.paid_at).slice(0,10),type:"Paid at visit",client_id:v.client_id,ref:"",method:v.paid_method||"",amount:Number(v.price)})});
    pays.sort(function(x,y){return x.date<y.date?-1:1});
    var exs=expenses.filter(function(e){return inRange(e.spent_on,from,to)}).sort(function(x,y){return x.spent_on<y.spent_on?1:-1});
    var earned=r2(done.reduce(function(s,v){return s+Number(v.price||0)},0)),collected=r2(pays.reduce(function(s,p){return s+p.amount},0)),spent=r2(exs.reduce(function(s,e){return s+Number(e.amount)},0));
    var months=[],m=monthStart(from);while(m<=to&&months.length<36){months.push({k:m.slice(0,7),label:monthName(m),earned:0,collected:0,spent:0});m=addDays(monthEndOf(m),1)}
    function mo(k){return months.filter(function(x){return x.k===k})[0]}
    done.forEach(function(v){var x=mo(v.scheduled_date.slice(0,7));if(x)x.earned+=Number(v.price||0)});pays.forEach(function(p){var x=mo(p.date.slice(0,7));if(x)x.collected+=p.amount});exs.forEach(function(e){var x=mo(e.spent_on.slice(0,7));if(x)x.spent+=Number(e.amount)});
    var cat={};exs.forEach(function(e){cat[e.category||"Other"]=(cat[e.category||"Other"]||0)+Number(e.amount)});
    var cats=Object.keys(cat).map(function(k){return{k:k,v:r2(cat[k])}}).sort(function(x,y){return y.v-x.v});
    var cl={};done.forEach(function(v){cl[v.client_id]=(cl[v.client_id]||0)+Number(v.price||0)});
    var top=Object.keys(cl).map(function(k){return{k:k,v:r2(cl[k])}}).filter(function(x){return x.v>0}).sort(function(x,y){return y.v-x.v}).slice(0,8);
    var meth={};pays.forEach(function(p){var k=p.method||"Other";meth[k]=(meth[k]||0)+p.amount});
    return{from:from,to:to,earned:earned,collected:collected,spent:spent,net:r2(collected-spent),months:months,cats:cats,top:top,meth:meth,pays:pays,exs:exs,visitsDone:done.length}})}
function sm(n){n=r2(n);return n<0?"-"+money(-n):money(n)}
function bars(list,rows,fmt,labelFn){
  var max=rows.reduce(function(m,x){return Math.max(m,x.v)},0)||1;
  rows.forEach(function(x){var r=el("div","hrow"),lb=labelFn?labelFn(x):x.k;r.title=lb+": "+fmt(x.v);
    r.appendChild(el("span","hl",lb));var tr=el("span","ht"),f=el("span","hf");f.style.width=Math.max(1,Math.round(x.v/max*100))+"%";tr.appendChild(f);r.appendChild(tr);r.appendChild(el("span","hv",fmt(x.v)));list.appendChild(r)})}
function agingBuckets(){
  var t=today(),b=[["Not yet due",0],["1–30 days late",0],["31–60 days late",0],["Over 60 days late",0]];
  invoices.forEach(function(i){if(i.status!=="open")return;var late=i.due_date&&i.due_date<t?ddiff(i.due_date,t):0,k=late<=0?0:late<=30?1:late<=60?2:3;b[k][1]+=Number(i.total||0)});return b}
function downloadCsv(name,rows){
  var csv=rows.map(function(r){return r.map(function(c){c=String(c==null?"":c);return/[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(",")}).join("\r\n");
  var blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);document.body.removeChild(a)},500)}
var repKey="",repData=null,repAt=0;
function renderReports(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  [["overview","Overview"],["tax","Tax Report"]].forEach(function(s){var b=el("button","tab"+(rtab===s[0]?" on":""),s[1]);b.type="button";b.addEventListener("click",function(){rtab=s[0];render()});tabs.appendChild(b)});
  if(rtab==="tax")return renderTaxReport(list);
  if(billErr){list.appendChild(el("div","empty","Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var r=periodRange(),key=r[0]+"|"+r[1]+"|"+invoices.length+"|"+expenses.length+"|"+invoices.filter(function(i){return i.status==="paid"}).length;
  var grid=el("div","repgrid"),left=el("div","repleft"),right=el("div","repright");grid.appendChild(left);grid.appendChild(right);list.appendChild(grid);
  periodBar(left);var out=el("div");left.appendChild(out);
  function draw(d,d3){
    out.textContent="";right.textContent="";
    if(d.error||d3.error){out.appendChild(el("div","empty","Could not load the report. Check your connection and press Refresh."));return}
    drawCharts(right,d,d3);
    $("topbtns").textContent="";
    $("topbtns").appendChild(btn("Income CSV","btn alt",function(){downloadCsv("income_"+d.from+"_to_"+d.to+".csv",[["Date","Type","Client","Invoice","Method","Amount"]].concat(d.pays.map(function(p){return[p.date,p.type,cname(p.client_id),p.ref,p.method,p.amount.toFixed(2)]})))}));
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(btn("Expenses CSV","btn alt",function(){downloadCsv("expenses_"+d.from+"_to_"+d.to+".csv",[["Date","Category","Vendor","Note","Client","Amount"]].concat(d.exs.map(function(e){return[e.spent_on,e.category,e.vendor,e.note,e.client_id?cname(e.client_id):"",Number(e.amount).toFixed(2)]})))}));
    var st=el("div","stats");
    [["Collected",money(d.collected),""],["Earned",money(d.earned),""],["Expenses",money(d.spent),""],["Net (collected − expenses)",sm(d.net),d.net<0?"bad":""]].forEach(function(x){var c=el("div","stat "+x[2]);c.appendChild(el("span",null,x[0]));c.appendChild(el("b",null,x[1]));st.appendChild(c)});out.appendChild(st);
    var nt=el("div","note","Collected = money actually received (paid invoices plus payments at the visit). Earned = work completed in the period, whether or not it's paid yet."+(expErr?" Expenses aren't set up yet, so they show as $0. Run the Stage 9 SQL.":""));nt.style.marginBottom="10px";out.appendChild(nt);
    var h1=el("h3",null,"By month");h1.style.margin="14px 0 6px";out.appendChild(h1);
    var tb=document.createElement("table");tb.className="rtable";var hd=document.createElement("tr");["Month","Earned","Collected","Expenses","Net"].forEach(function(x,i){var th=document.createElement("th");th.textContent=x;if(i)th.className="r";hd.appendChild(th)});tb.appendChild(hd);
    d.months.forEach(function(m){var tr=document.createElement("tr"),net=r2(m.collected-m.spent);[m.label,money(r2(m.earned)),money(r2(m.collected)),money(r2(m.spent)),sm(net)].forEach(function(x,i){var td=document.createElement("td");td.textContent=x;if(i)td.className="r";if(i===4&&net<0)td.style.color="var(--red)";tr.appendChild(td)});tb.appendChild(tr)});
    var wrap=el("div","tscroll");wrap.appendChild(tb);out.appendChild(wrap);
    var h2=el("h3",null,"Expenses by category");h2.style.margin="18px 0 6px";out.appendChild(h2);
    if(d.cats.length)bars(out,d.cats,money);else out.appendChild(el("div","note","No expenses in this period."));
    var h3=el("h3",null,"Top clients (work completed)");h3.style.margin="18px 0 6px";out.appendChild(h3);
    if(d.top.length)bars(out,d.top,money,function(x){return cname(x.k)});else out.appendChild(el("div","note","No completed work in this period."));
    var ms=Object.keys(d.meth);if(ms.length){var h4=el("h3",null,"How you were paid");h4.style.margin="18px 0 6px";out.appendChild(h4);out.appendChild(el("div","note",ms.map(function(k){return k+" "+money(r2(d.meth[k]))}).join(" · ")))}
    var h5=el("h3",null,"Unpaid invoices (as of today)");h5.style.margin="18px 0 6px";out.appendChild(h5);
    var ag=agingBuckets(),tot=r2(ag.reduce(function(s,x){return s+x[1]},0));
    if(!tot)out.appendChild(el("div","note","Nothing owed right now."));else{var t2=document.createElement("table");t2.className="rtable";ag.forEach(function(x){var tr=document.createElement("tr");var a=document.createElement("td");a.textContent=x[0];var b2=document.createElement("td");b2.className="r";b2.textContent=money(r2(x[1]));if(x[0]!=="Not yet due"&&x[1]>0)b2.style.color="var(--red)";tr.appendChild(a);tr.appendChild(b2);t2.appendChild(tr)});var tr2=document.createElement("tr");var a2=document.createElement("td");a2.innerHTML="<b>Total owed</b>";var b3=document.createElement("td");b3.className="r";b3.innerHTML="<b>"+esc(money(tot))+"</b>";tr2.appendChild(a2);tr2.appendChild(b3);t2.appendChild(tr2);var w2=el("div","tscroll");w2.appendChild(t2);out.appendChild(w2)}}
  if(repData&&repKey===key&&Date.now()-repAt<20000){draw(repData.d,repData.d3);return}
  out.appendChild(el("div","empty","Loading the report..."));
  var m1=monthStart(today()),f3=monthStart(addDays(monthStart(addDays(m1,-1)),-1));
  Promise.all([computeReport(r[0],r[1]),computeReport(f3,today())]).then(function(rs){repKey=key;repData={d:rs[0],d3:rs[1]};repAt=Date.now();if(view==="reports"&&rtab==="overview"&&out.isConnected)draw(rs[0],rs[1])})}

/* ======= Expenses tab: the tax ledger (Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total) ======= */
/* The "amount" column in the database holds the TOTAL paid (amount + tax), so Reports keep working. The Amount shown here is total minus tax. */
var LCOLS=["Code","Date","Vendor","Description","Category","Payment","Receipt #","Amount","Tax","Total"];
function m2(n){return"$"+(Number(n)||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function mdy(s){var m=String(s||"").slice(0,10).split("-");return m.length===3?(+m[1])+"/"+(+m[2])+"/"+m[0]:""}
function expTax(e){return r2(Number(e.tax)||0)}
function expTotal(e){return r2(Number(e.amount)||0)}
function expNet(e){return r2(expTotal(e)-expTax(e))}
function expYears(extra){var ys={};ys[String(new Date().getFullYear())]=1;if(extra)ys[extra]=1;expenses.forEach(function(e){if(e.spent_on)ys[String(e.spent_on).slice(0,4)]=1});return Object.keys(ys).sort().reverse()}
function expInYear(y){return expenses.filter(function(e){return String(e.spent_on).slice(0,4)===y})}
function lastBy(fn){for(var i=0;i<expenses.length;i++){if(fn(expenses[i]))return expenses[i]}return null}
/* duplicate check: same receipt # from the same vendor, or same vendor + date + total */
function findDup(r,ignoreId){
  var v=String(r.vendor||"").trim().toLowerCase(),rn=String(r.receipt_no||"").trim().toLowerCase(),tot=Number(r.amount);
  for(var i=0;i<expenses.length;i++){var x=expenses[i];if(ignoreId&&x.id===ignoreId)continue;var xv=String(x.vendor||"").trim().toLowerCase();if(xv!==v)continue;
    if(rn&&String(x.receipt_no||"").trim().toLowerCase()===rn)return x;
    if(x.spent_on===r.spent_on&&Math.abs(expTotal(x)-tot)<0.005)return x}
  return null}
function dupText(x){return(x.vendor||"(no vendor)")+" on "+mdy(x.spent_on)+" for "+m2(expTotal(x))+(x.receipt_no?" (receipt # "+x.receipt_no+")":"")}
function expCells(e){return[e.code||"",mdy(e.spent_on),e.vendor||"",e.note||"",e.category||"",e.payment||"",e.receipt_no||"",m2(expNet(e)),expTax(e)?m2(expTax(e)):"",m2(expTotal(e))]}
function expCsv(rows){return[LCOLS].concat(rows.slice().sort(function(a,b){return a.spent_on<b.spent_on?-1:a.spent_on>b.spent_on?1:0}).map(function(e){return[e.code||"",mdy(e.spent_on),e.vendor||"",e.note||"",e.category||"",e.payment||"",e.receipt_no||"",expNet(e).toFixed(2),expTax(e).toFixed(2),expTotal(e).toFixed(2)]}))}
/* the small "Expenses" box: every category with its total for the year */
function expenseBox(year){
  var rows=expInYear(year),by={},box=el("div","taxbox"),t=document.createElement("table");
  rows.forEach(function(e){var c=e.category||"Other";by[c]=r2((by[c]||0)+expTotal(e))});
  var hr=document.createElement("tr");["Category","Totals for each"].forEach(function(x,i){var th=document.createElement("th");th.textContent=x;if(i)th.className="r";hr.appendChild(th)});t.appendChild(hr);
  var total=0;
  expCats().forEach(function(c){var tr=document.createElement("tr"),a=document.createElement("td"),b=document.createElement("td");a.textContent=c;b.className="r";b.textContent=by[c]?m2(by[c]):"";total+=by[c]||0;tr.appendChild(a);tr.appendChild(b);t.appendChild(tr)});
  var ft=document.createElement("tr");ft.className="tot";var a2=document.createElement("td");a2.textContent="Overall Total";var b2=document.createElement("td");b2.className="r";b2.textContent=m2(r2(total));ft.appendChild(a2);ft.appendChild(b2);t.appendChild(ft);
  box.appendChild(t);return box}
function renderExpensesView(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  if(expErr){list.appendChild(el("div","empty","Expenses aren't set up yet. Run the Stage 9 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var tb=$("topbtns");tb.appendChild(btn("+ Add expense","btn",function(){openExpense(null)}));tb.appendChild(document.createTextNode(" "));tb.appendChild(btn("Scan receipt","btn alt",openScan));tb.appendChild(document.createTextNode(" "));tb.appendChild(btn("Paste from Excel","btn alt",openExpPaste));
  if(expenses.length&&!("tax" in expenses[0])){var wn=el("div","note","Run the Stage 13 SQL in Supabase to turn on Code, Payment, Receipt # and Tax, then press Refresh.");wn.style.cssText="color:#7a5b00;margin-bottom:8px";list.appendChild(wn)}
  var bar=el("div","invbar");
  var ys=fld("Year","select",exYear,expYears(exYear).map(function(y){return[y,y]}));ys.style.cssText="margin:0;min-width:110px";ys.input.addEventListener("change",function(){exYear=ys.input.value;exShown=300;render()});
  var cf=fld("Category","select",exCat,[["all","All categories"]].concat(expCats().map(function(c){return[c,c]})));cf.style.cssText="margin:0;min-width:200px";cf.input.addEventListener("change",function(){exCat=cf.input.value;exShown=300;render()});
  var si=document.createElement("input");si.type="search";si.placeholder="Search vendor, description, receipt #...";si.value=exq;si.setAttribute("aria-label","Search expenses");si.style.cssText="flex:1;min-width:200px";
  bar.appendChild(ys);bar.appendChild(cf);bar.appendChild(si);list.appendChild(bar);
  var det=document.createElement("details");det.open=true;det.className="exbox";var sum=document.createElement("summary");sum.textContent="Expenses by category · "+exYear;det.appendChild(sum);det.appendChild(expenseBox(exYear));
  var lay=el("div","exlayout"),body=el("div","exmain");det.classList.add("exside");lay.appendChild(body);lay.appendChild(det);list.appendChild(lay);
  function draw(){
    body.textContent="";var t=invToks(exq);
    var rows=expInYear(exYear).filter(function(e){return(exCat==="all"||e.category===exCat)&&(!t.length||t.every(function(x){return expCells(e).join(" ").toLowerCase().indexOf(x)>-1}))});
    rows.sort(function(a,b){return a.spent_on===b.spent_on?0:(a.spent_on<b.spent_on?exSort*-1:exSort)});
    var sn=0,st=0,sT=0;rows.forEach(function(e){sn+=expNet(e);st+=expTax(e);sT+=expTotal(e)});
    var hd=el("div","note",rows.length+" expense"+(rows.length===1?"":"s")+" · Amount "+m2(r2(sn))+" · Tax "+m2(r2(st))+" · Total "+m2(r2(sT)));hd.style.cssText="font-weight:700;margin:12px 0 6px";body.appendChild(hd);
    if(!rows.length){body.appendChild(el("div","empty",expenses.length?"Nothing matches. Try another year or category.":"No expenses yet. Tap + Add expense, Scan receipt, or Paste from Excel."));return}
    var wrap=el("div","invwrap"),t2=document.createElement("table");t2.className="exgrid";
    var cg=document.createElement("colgroup");[4.5,8.5,9,20.5,14.5,7.5,11,8.5,7,8.5].forEach(function(w){var c=document.createElement("col");c.style.width=w+"%";cg.appendChild(c)});t2.appendChild(cg);
    var hr=document.createElement("tr");LCOLS.forEach(function(c,i){var th=document.createElement("th");if(i>=7)th.className="num";
      if(c==="Date"){var b=btn("Date "+(exSort<0?"▼":"▲"),"hcol",function(){exSort=-exSort;draw()});th.appendChild(b)}else th.textContent=c;hr.appendChild(th)});
    var th_=document.createElement("thead");th_.appendChild(hr);t2.appendChild(th_);
    var tbd=document.createElement("tbody");
    rows.slice(0,exShown).forEach(function(e){var tr=document.createElement("tr");tr.tabIndex=0;expCells(e).forEach(function(v,i){var td=document.createElement("td");td.textContent=v;if(i>=7)td.className="num";tr.appendChild(td)});
      tr.addEventListener("click",function(){openExpense(e)});tr.addEventListener("keydown",function(ev){if(ev.key==="Enter")openExpense(e)});tbd.appendChild(tr)});
    t2.appendChild(tbd);
    var tf=document.createElement("tfoot"),fr=document.createElement("tr");LCOLS.forEach(function(c,i){var td=document.createElement("td");if(i===0)td.textContent="Total";if(i===7){td.textContent=m2(r2(sn));td.className="num"}if(i===8){td.textContent=m2(r2(st));td.className="num"}if(i===9){td.textContent=m2(r2(sT));td.className="num"}fr.appendChild(td)});tf.appendChild(fr);t2.appendChild(tf);
    wrap.appendChild(t2);body.appendChild(wrap);
    if(rows.length>exShown)body.appendChild(btn("Show more ("+(rows.length-exShown)+" left)","btn alt sm",function(){exShown+=300;draw()}));
    var acts=el("div","invacts");acts.appendChild(btn("Download "+exYear+" as CSV (opens in Excel)","btn alt sm",function(){downloadCsv("expenses_"+exYear+".csv",expCsv(rows))}));body.appendChild(acts)}
  si.addEventListener("input",function(){exq=si.value;exShown=300;draw()});draw()}

function openExpense(e,pre,scanFile){
  pre=pre||{};var src=e||pre;
  var p=panel();p.appendChild(el("h2",null,e?"Expense":"Add expense"));
  if(scanFile&&!e){var sn_=el("div","pcard","✓ Read from your receipt photo"+(pre.known?" and filled in from your last purchase at "+pre.vendor:"")+". Please check every field before saving.");sn_.style.cssText="background:var(--mint);font-weight:600";p.appendChild(sn_)}
  var codes={},vendors={};expenses.forEach(function(x){if(x.code)codes[x.code]=1;if(x.vendor)vendors[x.vendor]=1});
  function dl(id,obj){var d=document.createElement("datalist");d.id=id;Object.keys(obj).sort().forEach(function(k){var o=document.createElement("option");o.value=k;d.appendChild(o)});p.appendChild(d)}
  dl("exCodes",codes);dl("exVendors",vendors);
  var code=fld("Code (up to 4 characters)","text",src.code||""),dt=fld("Date","date",e?e.spent_on:(pre.date||today()));code.input.setAttribute("list","exCodes");code.input.maxLength=4;
  var g1=el("div","grid2");g1.appendChild(code);g1.appendChild(dt);p.appendChild(g1);
  var ve=fld("Vendor","text",src.vendor||"");ve.input.setAttribute("list","exVendors");p.appendChild(ve);
  var no=fld("Description","text",e?e.note:(pre.description||""));p.appendChild(no);
  var cats=expCats();if(src.category&&cats.indexOf(src.category)<0)cats.push(src.category);
  var cat=fld("Category","select",src.category||"",[["","Choose a category..."]].concat(cats.map(function(c){return[c,c]})));
  var pays=PAYMENTS.slice();if(src.payment&&pays.indexOf(src.payment)<0)pays.push(src.payment);
  var pay=fld("Payment","select",src.payment||"Debit",pays.map(function(c){return[c,c]}));
  var g2=el("div","grid2");g2.appendChild(cat);g2.appendChild(pay);p.appendChild(g2);
  var rn=fld("Receipt #","text",src.receipt_no||"");p.appendChild(rn);
  var am=fld("Amount ($, before tax)","number",e?expNet(e):(pre.amount!=null?pre.amount:"")),tx=fld("Tax ($)","number",e?(expTax(e)||""):(pre.tax||""));
  [am,tx].forEach(function(f){f.input.step="0.01";f.input.inputMode="decimal"});
  var g3=el("div","grid2");g3.appendChild(am);g3.appendChild(tx);p.appendChild(g3);
  var tot=el("div","invtotal");function upd(){var a=parseFloat(am.input.value)||0,t=parseFloat(tx.input.value)||0;tot.textContent="Total "+m2(r2(a+t))}upd();am.input.addEventListener("input",upd);tx.input.addEventListener("input",upd);p.appendChild(tot);
  var dw=el("div","pcard");dw.style.cssText="background:#fff3c4;border-color:#e0c25a;color:#7a5b00;font-weight:600";dw.hidden=true;p.appendChild(dw);
  function cur(){var a=parseFloat(am.input.value)||0,t=parseFloat(tx.input.value)||0;return{spent_on:dt.input.value,amount:r2(a+t),vendor:ve.input.value,receipt_no:rn.input.value}}
  function chk(){var d=findDup(cur(),e&&e.id);dw.hidden=!d;if(d)dw.textContent="⚠ Possible duplicate: "+dupText(d)+" is already saved."}
  [dt,ve,rn,am,tx].forEach(function(f){f.input.addEventListener("input",chk);f.input.addEventListener("change",chk)});setTimeout(chk,0);
  var cl=fld("For a client's job (optional)","select",e&&e.client_id?e.client_id:"",[["","None"]].concat(clients.filter(function(c){return!c.archived||(e&&e.client_id===c.id)}).map(function(c){return[c.id,c.name]})));p.appendChild(cl);
  /* remember the code and details you used last time for the same category or vendor */
  var touched={code:!!(e||pre.code),cat:!!(e||pre.category)};
  code.input.addEventListener("input",function(){touched.code=true});
  cat.input.addEventListener("change",function(){touched.cat=true;if(!code.input.value||!touched.code){var l=lastBy(function(x){return x.category===cat.input.value&&x.code});if(l){code.input.value=l.code;touched.code=false}}});
  ve.input.addEventListener("change",function(){if(e)return;var v=ve.input.value.trim().toLowerCase();if(!v)return;var l=lastBy(function(x){return x.vendor&&x.vendor.toLowerCase()===v});if(!l)return;
    if(!touched.cat&&l.category){cat.input.value=l.category}if(!code.input.value&&l.code)code.input.value=l.code;if(!no.input.value&&l.note)no.input.value=l.note;if(l.payment)pay.input.value=l.payment});
  var pend=[],keep=null;
  if(!photoErr){
    var rc=el("div","sec"),rh=el("h3",null,scanFile&&!e?"Receipt photo":"Receipt photos (optional)");rc.appendChild(rh);
    if(scanFile&&!e){
      var lb=el("label");lb.style.cssText="display:flex;gap:8px;align-items:center;font-weight:600";keep=document.createElement("input");keep.type="checkbox";keep.style.width="auto";lb.appendChild(keep);lb.appendChild(document.createTextNode(" Keep a copy of the receipt photo (uses storage)"));rc.appendChild(lb);
      rc.appendChild(el("div","note","Leave this off to save space. The photo was only read on your device. Nothing has been uploaded, and it's discarded when you close this."))}
    else{var rg=el("div");rc.appendChild(rg);
      var have=e?photos.filter(function(x){return x.expense_id===e.id}):[];if(have.length)photoGrid(rg,have,{onTile:function(ph,i){openLightbox(have,i)}});
      var pn=el("div","note");function pnTxt(){pn.textContent=pend.length?pend.length+" photo"+(pend.length>1?"s":"")+" ready. They upload when you press Save.":(have.length?"":"No receipt photo kept. Photos use storage, so only keep the ones you need.")}pnTxt();
      var rb=el("div","pbar2");rb.appendChild(btn("Take photo","btn alt sm",function(){pickPhotos(true,function(fs){pend=pend.concat(fs);pnTxt()})}));rb.appendChild(btn("Choose photo","btn alt sm",function(){pickPhotos(false,function(fs){pend=pend.concat(fs);pnTxt()})}));rc.appendChild(rb);rc.appendChild(pn)}
    p.appendChild(rc)}
  var acts=el("div","acts");acts.style.marginTop="12px";
  var sv=btn("Save","btn",function(){
    var a=parseFloat(am.input.value),t=parseFloat(tx.input.value);if(isNaN(t))t=0;
    if(isNaN(a)||a<0||t<0){alert("Enter the amount (and tax if any).");return}if(!dt.input.value){alert("Pick the date.");return}if(!cat.input.value){alert("Pick a category.");return}
    var row={spent_on:dt.input.value,amount:r2(a+t),tax:r2(t),category:cat.input.value,vendor:ve.input.value.trim(),note:no.input.value.trim(),code:code.input.value.trim(),payment:pay.input.value,receipt_no:rn.input.value.trim(),client_id:cl.input.value||null};
    var dup=findDup(row,e&&e.id);if(dup&&!confirm("This looks like a duplicate of "+dupText(dup)+".\n\nSave it anyway?"))return;sv.disabled=true;
    var q=e?sb.from("expenses").update(row).eq("id",e.id).select().single():sb.from("expenses").insert(Object.assign({created_by:myEmail||""},row)).select().single();
    q.then(function(r){sv.disabled=false;if(r.error||!r.data){alert("Could not save. Did you run the Stage 9 and Stage 13 SQL in Supabase?");return}if(e)Object.assign(e,r.data);else expenses.unshift(r.data);repData=null;
      var files=pend.slice();if(keep&&keep.checked&&scanFile)files.push(scanFile);
      if(!files.length){closeDetail();render();return}
      sv.disabled=true;sv.textContent="Uploading photo...";uploadMany(files,{expense_id:r.data.id,client_id:r.data.client_id,kind:"receipt"}).then(function(res){var msg=uploadMsg(res);if(msg)alert(msg);closeDetail();render()})})});acts.appendChild(sv);
  if(e)acts.appendChild(btn("Delete","btn danger",function(){if(!confirm("Delete this expense?"))return;sb.from("expenses").delete().eq("id",e.id).then(function(r){if(r.error){alert("Could not delete.");return}expenses=expenses.filter(function(z){return z.id!==e.id});repData=null;closeDetail();render()})}));
  p.appendChild(acts)}

/* ---- scan a receipt: read on this device, fill the form, throw the photo away ---- */
/*PARSE_START*/
function parseReceipt(text,known){
  var raw=String(text||""),low=raw.toLowerCase(),lines=raw.split(/\r?\n/).map(function(l){return l.replace(/\s+/g," ").trim()}).filter(Boolean),out={};
  function nums(str){var m=String(str).match(/\d[\d,]*[.,]\d{2}(?!\d)/g)||[];return m.map(function(s){var i=Math.max(s.lastIndexOf("."),s.lastIndexOf(","));return parseFloat(s.slice(0,i).replace(/[.,]/g,"")+"."+s.slice(i+1))}).filter(function(n){return!isNaN(n)})}
  function iso(y,mo,d){y=+y;mo=+mo;d=+d;if(y<100)y+=2000;if(y<2000||y>2100||mo<1||mo>12||d<1||d>31)return null;return y+"-"+("0"+mo).slice(-2)+"-"+("0"+d).slice(-2)}
  var m,date=null;
  if((m=low.match(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/)))date=iso(m[1],m[2],m[3]);
  if(!date&&(m=low.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/))){var a=+m[1],b=+m[2];if(a>12&&b<=12){var t_=a;a=b;b=t_}date=iso(m[3],a,b)}
  if(!date&&(m=raw.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i))){date=iso(m[3],["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1].toLowerCase())+1,m[2])}
  if(date)out.date=date;
  var total=null,sub=null,tax=0,taxFound=false,totalTax=null,all=nums(raw);
  lines.forEach(function(l){var ll=l.toLowerCase(),n=nums(l);if(!n.length)return;
    if(/sub\s*-?\s*total/.test(ll)){sub=n[n.length-1];return}
    if(/total\s*tax|tax\s*total/.test(ll)){totalTax=n[n.length-1];taxFound=true;return}
    if(/\btax\b/.test(ll)&&!/taxable|tax\s*id|exempt/.test(ll)){tax+=n[n.length-1];taxFound=true;return}
    if(/(grand\s*)?total|amount\s*due|balance\s*due|amount\s*paid|total\s*due|sale\s*amount|visa|mastercard|debit/.test(ll)&&!/savings|change|points|items/.test(ll)){var mx=Math.max.apply(null,n);if(total==null||mx>total)total=mx}});
  if(totalTax!=null)tax=totalTax;
  if(total==null&&all.length)total=Math.max.apply(null,all);
  if(total!=null){tax=taxFound?Math.round(tax*100)/100:0;if(tax>=total)tax=0;
    var amt=Math.round((total-tax)*100)/100;if(sub!=null&&tax&&Math.abs(sub+tax-total)<0.02)amt=sub;
    out.amount=amt;out.tax=tax}
  var vend="",kn=[];(known||[]).forEach(function(x){if(x.vendor&&x.vendor.length>=3&&kn.indexOf(x.vendor)<0)kn.push(x.vendor)});
  kn.sort(function(a,b){return b.length-a.length});
  for(var i=0;i<kn.length;i++){if(low.indexOf(kn[i].toLowerCase())>-1){vend=kn[i];out.known=true;break}}
  if(!vend){for(var j=0;j<Math.min(lines.length,8);j++){var l=lines[j],letters=(l.match(/[a-z]/gi)||[]).length;
    if(letters>=3&&letters/l.length>0.6&&l.length<=40&&!/receipt|invoice|welcome|thank|www|\.com|tel|phone|customer|cashier|store\s*#|date|time/i.test(l)){vend=l;break}}
    if(vend&&vend===vend.toUpperCase())vend=vend.toLowerCase().replace(/\b[a-z]/g,function(c){return c.toUpperCase()})}
  if(vend)out.vendor=vend;
  for(var k=0;k<lines.length;k++){var mm=lines[k].match(/(?:receipt|rcpt|invoice|inv|trans(?:action)?|ref|order|ticket)\s*(?:no\.?|number|num|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i);if(mm&&/\d/.test(mm[1])){out.receipt_no=mm[1];break}}
  out.payment=/\bcash\b/.test(low)&&!/cash\s*back/.test(low)?"Cash":/\bcheck\b|\bcheque\b/.test(low)?"Check":/\bcredit\b/.test(low)?"Credit":"Debit";
  var head=(vend+" "+low.slice(0,400)).toLowerCase(),G=[[/shell|chevron|racetrac|wawa|sunoco|exxon|bp\b|speedway|7-eleven|murphy|unleaded|gasoline|diesel|fuel|pump/,"Fuel"],[/autozone|o'?reilly|advance auto|napa|pep boys|tire|oil change/,"Vehicle Repairs & Maintenance"],
    [/mcdonald|subway|wendy|burger|pizza|cafe|grill|dunkin|starbucks|chick-?fil|taco|restaurant|kitchen|diner|bbq|waffle|sonic|domino/,"Meal"],[/publix|aldi|winn|walmart|sam'?s|costco|target|grocer|market/,"Groceries"],[/dump|landfill|solid waste|recycl/,"Dump/Recycling"],
    [/usps|postal|fedex|ups store|stamps|postage/,"Postage & Shipping"],[/home depot|lowe'?s|ace hardware|harbor freight|tractor supply|hardware/,"Supplies"],[/staples|office depot|officemax/,"Office Supplies"],[/insurance|geico|progressive|state farm/,"Insurance"]];
  for(var g=0;g<G.length;g++){if(G[g][0].test(head)){out.category=G[g][1];break}}
  var prev=null;if(out.known&&vend){for(var q=0;q<(known||[]).length;q++){if(known[q].vendor===vend){prev=known[q];break}}}
  if(prev){if(prev.category)out.category=prev.category;if(prev.code)out.code=prev.code;if(prev.note)out.description=prev.note;if(prev.payment)out.payment=prev.payment}
  return out}
/*PARSE_END*/
function loadTess(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  return new Promise(function(res,rej){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.onload=function(){window.Tesseract?res(window.Tesseract):rej(new Error("ocr"))};s.onerror=function(){rej(new Error("ocr"))};document.head.appendChild(s)})}
function openScan(){
  var p=panel();p.appendChild(el("h2",null,"Scan a receipt"));
  p.appendChild(el("p","note","Take a photo of the receipt or choose one. Foreman reads it right on this device and fills in the date, vendor, amount and tax for you to check. The photo is not uploaded or stored, so it uses no space (you can choose to keep a copy on the next screen). The first scan downloads a small reading tool, so it needs internet and takes a little longer."));
  var st=el("div","note");st.style.cssText="font-weight:700;margin:10px 0;min-height:1.4em";
  function go(files){var f=files[0];if(!f)return;st.textContent="Preparing the photo...";
    loadImg(f).then(function(img){return toJpeg(img,1600,.9)}).then(function(r){st.textContent="Loading the reading tool...";return loadTess().then(function(T){return T.recognize(r.blob,"eng",{logger:function(m){if(m&&m.status==="recognizing text")st.textContent="Reading the receipt... "+Math.round((m.progress||0)*100)+"%"}})})}).then(function(res){
      var text=(res&&res.data&&res.data.text)||"";var pre=parseReceipt(text,expenses);openExpense(null,pre,f)}).catch(function(){
      st.textContent="";alert("Couldn't read that receipt automatically (it may need internet, or the photo may be too blurry). The form will open so you can type it in. Your photo was not uploaded.");openExpense(null,{},f)})}
  var row=el("div","pbar2");row.appendChild(btn("Take photo","btn",function(){pickPhotos(true,go)}));row.appendChild(btn("Choose photo","btn alt",function(){pickPhotos(false,go)}));p.appendChild(row);p.appendChild(st)}

/* ---- paste rows from Excel / Google Sheets ---- */
function parseDateLoose(s){s=String(s||"").trim();var m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return m[1]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[3]).slice(-2);
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))){var y=+m[3];if(y<100)y+=2000;var mo=+m[1],d=+m[2];if(mo<1||mo>12||d<1||d>31)return null;return y+"-"+("0"+mo).slice(-2)+"-"+("0"+d).slice(-2)}
  return null}
function numLoose(s){var t=String(s==null?"":s).replace(/[$,\s]/g,"");if(/^\(.*\)$/.test(t))t="-"+t.slice(1,-1);return/^-?\d*\.?\d+$/.test(t)?parseFloat(t):null}
function openExpPaste(){
  var p=panel();p.appendChild(el("h2",null,"Paste from Excel"));
  p.appendChild(el("p","note","In your spreadsheet, select the rows, copy, and paste them below. Columns must be in this order: Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total. A header row is skipped. If Total is filled in, it is used; otherwise Total = Amount + Tax."));
  var ta=document.createElement("textarea");ta.style.cssText="width:100%;min-height:180px;font:13px/1.3 monospace";ta.placeholder="Paste here";p.appendChild(ta);
  var out=el("div","note");out.style.cssText="margin:8px 0;font-weight:700";p.appendChild(out);var ready=[],dupes=[];
  var sl=el("label");sl.style.cssText="display:flex;gap:8px;align-items:center;font-weight:600;margin:6px 0";var skip=document.createElement("input");skip.type="checkbox";skip.checked=true;skip.style.width="auto";sl.appendChild(skip);sl.appendChild(document.createTextNode(" Skip possible duplicates (recommended)"));sl.hidden=true;p.appendChild(sl);
  var go=btn("Import","btn",function(){
    var use=skip.checked?ready.filter(function(r){return dupes.indexOf(r)<0}):ready;if(!use.length){alert("Nothing to import. Every row looks like a duplicate.");return}go.disabled=true;go.textContent="Importing...";var chunks=[];for(var i=0;i<use.length;i+=200)chunks.push(use.slice(i,i+200));
    chunks.reduce(function(pr,ch){return pr.then(function(){return sb.from("expenses").insert(ch).select().then(function(r){if(r.error)return Promise.reject(r.error);(r.data||[]).forEach(function(x){expenses.push(x)})})})},Promise.resolve()).then(function(){repData=null;closeDetail();render();alert("Imported "+use.length+" expenses."+(use.length<ready.length?" Skipped "+(ready.length-use.length)+" possible duplicates.":""))},function(){go.disabled=false;go.textContent="Import";alert("Something went wrong part way. Check the list before trying again, so nothing is added twice. Did you run the Stage 13 SQL?");render()})});
  go.disabled=true;
  ta.addEventListener("input",function(){
    ready=[];var skipped=0,lines=ta.value.replace(/\r/g,"").split("\n").filter(function(l){return l.trim()});
    lines.forEach(function(l){var c=l.split("\t").map(function(x){return x.trim()});if(c.length<8){skipped++;return}
      var d=parseDateLoose(c[1]);if(!d){if(!/date/i.test(c[1])||!/code/i.test(c[0]))skipped++;return}
      var amt=numLoose(c[7]),tx=numLoose(c[8])||0,tot=numLoose(c[9]);if(tot==null&&amt==null){skipped++;return}if(tot==null)tot=Math.round(((amt||0)+tx)*100)/100;
      if(tot<0||tx<0){skipped++;return}
      ready.push({spent_on:d,amount:tot,tax:tx,code:c[0],vendor:c[2],note:c[3],category:c[4]||"Other",payment:c[5],receipt_no:c[6],created_by:myEmail||""})});
    dupes=[];var seen={};ready.forEach(function(r){var k=[r.spent_on,String(r.vendor).toLowerCase(),r.amount.toFixed(2)].join("|"),k2=r.receipt_no?[String(r.vendor).toLowerCase(),String(r.receipt_no).toLowerCase()].join("|"):"";
      if(findDup(r)||seen[k]||(k2&&seen[k2]))dupes.push(r);seen[k]=1;if(k2)seen[k2]=1});
    sl.hidden=!dupes.length;
    var sum=ready.reduce(function(s,x){return s+x.amount},0);
    out.textContent=ready.length?"Ready to import "+ready.length+" expense"+(ready.length===1?"":"s")+" totaling "+m2(Math.round(sum*100)/100)+(skipped?" ("+skipped+" row"+(skipped>1?"s":"")+" skipped)":"")+(dupes.length?". "+dupes.length+" look like duplicates of saved expenses or repeats in this paste":""):(ta.value.trim()?"No usable rows found. Check the column order.":"");
    go.disabled=!ready.length});
  go.style.marginTop="8px";p.appendChild(go)}

/* ---- Reports > Tax Report ---- */
function printReport(){document.body.classList.add("printreport");setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove("printreport")},800)},60)}
var TAX_ROWS=[["New Blowers","N.B"],["New Chainsaws","N.C"],["New Edgers","N.E"],["New Hand Tools","N.HT"],["New Mowers","N.M"],["New Trimmers","N.T"]];
var TAX_OLD=[["Blowers"],["Chainsaws"],["Edgers"],["Hand Tools"],["Mowers"],["Trimmers"]];
var TAX_COLS=["Category","Code","SN","Purchase date","Totals"];
function taxSheet(kind){return invCats.filter(function(c){return c.kind===kind})[0]}
function ensureTaxSheets(){
  if(taxMaking||invErr)return Promise.resolve(false);
  var need=[["tax_new","New Equipment Inventory","New Equipment Purchases",TAX_ROWS],["tax_old","Old/Existing Equipment Inventory","",TAX_OLD]].filter(function(x){return!taxSheet(x[0])});
  if(!need.length)return Promise.resolve(false);
  taxMaking=true;
  return need.reduce(function(pr,x){return pr.then(function(){
    var adopt=x[2]&&invCats.filter(function(c){return!c.kind&&c.name===x[2]})[0];
    if(adopt)return sb.from("inventory_cats").update({kind:x[0],name:x[1]}).eq("id",adopt.id).then(function(r){if(r.error)return Promise.reject("Run the Stage 13 SQL in Supabase first.");adopt.kind=x[0];adopt.name=x[1]});
    return makeSheet(x[1],["",TAX_COLS,x[3]],x[0]).then(function(){},function(m){return Promise.reject(m)})})},Promise.resolve()).then(function(){taxMaking=false;return true},function(m){taxMaking=false;taxErr=String(m||"Could not set up the equipment lists.");return true})}
var taxErr="";
function renderTaxReport(list){
  var tb=$("topbtns");tb.appendChild(btn("Print / Save PDF","btn",printReport));tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Expenses CSV","btn alt",function(){downloadCsv("expenses_"+taxYear+".csv",expCsv(expInYear(taxYear)))}));
  var bar=el("div","invbar tax-noprint"),ys=fld("Tax year","select",taxYear,expYears(taxYear).map(function(y){return[y,y]}));ys.style.cssText="margin:0;min-width:130px";ys.input.addEventListener("change",function(){taxYear=ys.input.value;render()});bar.appendChild(ys);
  bar.appendChild(el("span","note","Expense totals include tax. Equipment lists below are editable. Click a cell to type, or use Sheet settings to rename."));list.appendChild(bar);
  var h=el("h2",null,"Tax Report · "+taxYear);h.className="taxh";list.appendChild(h);
  var s1=el("div","taxsec");s1.appendChild(el("h3",null,"Expenses"));
  if(expErr)s1.appendChild(el("div","note","Expenses aren't set up yet (Stage 9 SQL)."));else s1.appendChild(expenseBox(taxYear));list.appendChild(s1);
  var host=el("div");list.appendChild(host);
  if(invErr){host.appendChild(el("div","note","Run the Stage 12 SQL (Inventory) and Stage 13 SQL in Supabase to turn on the equipment lists."));return}
  function drawSheets(){
    host.textContent="";
    [["tax_new","New Equipment Inventory","(included in Equipment expenses)"],["tax_old","Old/Existing Equipment Inventory",""]].forEach(function(x){
      var c=taxSheet(x[0]),sec=el("div","taxsec"),hh=el("h3",null,x[1]);if(x[2]){var sm_=el("span","note"," "+x[2]);hh.appendChild(sm_)}sec.appendChild(hh);
      if(!c){sec.appendChild(el("div","note",taxErr||"Setting this list up..."));host.appendChild(sec);return}
      sec.appendChild(invGrid(c,invRows(c),false));
      var st=btn("Sheet settings","btn alt sm tax-noprint",function(){openInvCat(c)});st.style.marginTop="6px";sec.appendChild(st);host.appendChild(sec)})}
  if(!taxSheet("tax_new")||!taxSheet("tax_old")){host.appendChild(el("div","note","Setting up your equipment lists..."));ensureTaxSheets().then(function(ch){if(ch&&view==="reports"&&rtab==="tax")render()})}
  else drawSheets()}

/* ---- Pie (donut) charts on the Reports screen ---- */
var PIECOL={slot1:"#2a78d6",slot2:"#eb6834",slot3:"#1baf7a",slot4:"#eda100",slot5:"#e87ba4",slot6:"#008300"};
function svgEl(n,a){var e=document.createElementNS("http://www.w3.org/2000/svg",n);for(var k in a)e.setAttribute(k,a[k]);return e}
function arcPath(cx,cy,r0,r1,a0,a1){
  if(a1-a0>=Math.PI*2-0.0001)a1=a0+Math.PI*2-0.0001;
  var big=(a1-a0)>Math.PI?1:0;function X(r,a){return(cx+r*Math.sin(a)).toFixed(2)}function Y(r,a){return(cy-r*Math.cos(a)).toFixed(2)}
  return"M"+X(r1,a0)+" "+Y(r1,a0)+" A"+r1+" "+r1+" 0 "+big+" 1 "+X(r1,a1)+" "+Y(r1,a1)+" L"+X(r0,a1)+" "+Y(r0,a1)+" A"+r0+" "+r0+" 0 "+big+" 0 "+X(r0,a0)+" "+Y(r0,a0)+" Z"}
/* slices: [{label,v,color}] in a fixed order; the legend lists every slice with its amount and share, so no value depends on color alone. */
function pieChart(title,sub,slices,center,note){
  var box=el("div","pcard chart");box.appendChild(el("h3",null,title));box.appendChild(el("div","note",sub));
  slices=slices.filter(function(s){return s.v>0.004});
  var total=r2(slices.reduce(function(s,x){return s+x.v},0));
  if(!total){box.appendChild(el("div","note","Nothing to show yet for this period."));return box}
  var wrap=el("div","donut"),svg=svgEl("svg",{viewBox:"0 0 120 120",role:"img","aria-label":title+": "+slices.map(function(s){return s.label+" "+money(r2(s.v))}).join(", ")});
  var a=0;
  slices.forEach(function(s){var ang=s.v/total*Math.PI*2,pct=Math.round(s.v/total*100),p=svgEl("path",{d:arcPath(60,60,34,56,a,a+ang),fill:s.color,"class":"sl",tabindex:"0"});
    var t=svgEl("title",{});t.textContent=s.label+": "+money(r2(s.v))+" ("+pct+"%)";p.appendChild(t);svg.appendChild(p);a+=ang});
  if(center){var t1=svgEl("text",{x:60,y:center.small?58:64,"text-anchor":"middle","class":"cbig"});t1.textContent=center.big;svg.appendChild(t1);
    if(center.small){var t2=svgEl("text",{x:60,y:72,"text-anchor":"middle","class":"csm"});t2.textContent=center.small;svg.appendChild(t2)}}
  wrap.appendChild(svg);
  var lg=el("div","lg2");
  slices.forEach(function(s){var r=el("div","lr"),sw=el("span","sw");sw.style.background=s.color;r.appendChild(sw);r.appendChild(el("span",null,s.label));r.appendChild(el("span","lv",money(r2(s.v))));r.appendChild(el("span","lp",Math.round(s.v/total*100)+"%"));lg.appendChild(r)});
  wrap.appendChild(lg);box.appendChild(wrap);
  if(note)box.appendChild(el("div","note",note));
  return box}
function pLabel(){return{month:"This month",last:"Last month",quarter:"This quarter",ytd:"Year to date",lastyear:"Last year",custom:"Custom range"}[rper]||""}
function drawCharts(host,d,d3){
  host.textContent="";
  /* 1: last 3 months of money received, by how it was paid */
  var order=["Zelle","Cash","Check","Other"],cols=[PIECOL.slot1,PIECOL.slot2,PIECOL.slot3,PIECOL.slot4],m={};
  Object.keys(d3.meth).forEach(function(k){var kk=order.indexOf(k)>-1?k:"Other";m[kk]=(m[kk]||0)+d3.meth[k]});
  host.appendChild(pieChart("Revenue by payment type","Last 3 months · "+dshort(d3.from)+" – "+dshort(d3.to)+" · money received",order.map(function(k,i){return{label:k,v:m[k]||0,color:cols[i]}}),{big:money(d3.collected),small:"received"}));
  /* 2: where each dollar of money received went: costs, then what's left as profit */
  var c=function(k){return d.cats.filter(function(x){return x.k===k}).reduce(function(s,x){return s+x.v},0)};
  var labor=c("Crew pay"),fuel=c("Fuel")+c("Vehicle"),equip=c("Equipment & repairs"),mat=c("Materials & supplies"),over=c("Insurance & licenses")+c("Marketing")+c("Software & phone")+c("Other");
  var profit=Math.max(0,r2(d.collected-d.spent)),loss=d.spent>d.collected;
  host.appendChild(pieChart("Where the money goes",pLabel()+" · "+dshort(d.from)+" – "+dshort(d.to)+" · received money split into costs and profit",
    [{label:"Labor (crew pay)",v:labor,color:PIECOL.slot1},{label:"Fuel & vehicle",v:fuel,color:PIECOL.slot2},{label:"Equipment & repairs",v:equip,color:PIECOL.slot3},{label:"Materials & supplies",v:mat,color:PIECOL.slot4},{label:"Overhead (insurance, marketing, software, other)",v:over,color:PIECOL.slot5},{label:"Profit",v:profit,color:PIECOL.slot6}],
    {big:sm(d.net),small:d.collected>0&&!loss?Math.round(d.net/d.collected*100)+"% profit":"net"},loss?"Spending is higher than the money received in this period, so there is no profit slice.":""));
  /* 3: overall earnings: money made minus money spent */
  host.appendChild(pieChart("Overall earnings",pLabel()+" · "+dshort(d.from)+" – "+dshort(d.to)+" · money made minus money spent",
    [{label:"Kept (net earnings)",v:Math.max(0,r2(d.collected-d.spent)),color:PIECOL.slot6},{label:"Spent",v:Math.min(d.spent,d.collected)||(d.collected?0:d.spent),color:PIECOL.slot2}],
    {big:sm(d.net),small:"net earnings"},"Made "+money(d.collected)+" − spent "+money(d.spent)+" = "+sm(d.net)+"."))}

/* ---- Photos: stored in a private Supabase bucket, shrunk on the phone/computer before upload ---- */
var KINDS=[["before","Before"],["after","After"],["property","Property"],["issue","Issue / damage"],["receipt","Receipt"],["other","Other"]];
function kindLabel(k){var x=KINDS.filter(function(a){return a[0]===k})[0];return x?x[1]:"Other"}
function uid(){return(window.crypto&&crypto.randomUUID)?crypto.randomUUID():"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function viaImg(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){URL.revokeObjectURL(u);res(i)};i.onerror=function(){URL.revokeObjectURL(u);rej(new Error("read"))};i.src=u})}
function loadImg(file){if(window.createImageBitmap)return createImageBitmap(file,{imageOrientation:"from-image"}).catch(function(){return viaImg(file)});return viaImg(file)}
function toJpeg(img,max,q){
  var w=img.width||img.naturalWidth,h=img.height||img.naturalHeight,s=Math.min(1,max/Math.max(w,h)),cw=Math.max(1,Math.round(w*s)),ch=Math.max(1,Math.round(h*s)),c=document.createElement("canvas");c.width=cw;c.height=ch;
  var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cw,ch);x.drawImage(img,0,0,cw,ch);
  return new Promise(function(res,rej){c.toBlob(function(b){b?res({blob:b,w:cw,h:ch}):rej(new Error("encode"))},"image/jpeg",q)})}
function pickPhotos(capture,cb){
  var i=document.createElement("input");i.type="file";i.accept="image/*";if(capture)i.setAttribute("capture","environment");else i.multiple=true;i.style.display="none";document.body.appendChild(i);
  i.addEventListener("change",function(){var fs=Array.prototype.slice.call(i.files||[]);document.body.removeChild(i);if(fs.length)cb(fs)});i.click()}
function uploadPhoto(file,meta){
  return loadImg(file).then(function(img){return Promise.all([toJpeg(img,1600,.82),toJpeg(img,360,.7)])}).then(function(rs){
    var full=rs[0],th=rs[1],id=uid(),folder=meta.client_id||"general",path=folder+"/"+id+".jpg",tpath=folder+"/"+id+"_t.jpg",st=sb.storage.from("photos");
    return st.upload(path,full.blob,{contentType:"image/jpeg"}).then(function(u){
      if(u.error)throw new Error("upload");
      return st.upload(tpath,th.blob,{contentType:"image/jpeg"}).then(function(u2){
        if(u2.error){st.remove([path]);throw new Error("upload")}
        var row={client_id:meta.client_id||null,property_id:meta.property_id||null,visit_id:meta.visit_id||null,expense_id:meta.expense_id||null,kind:meta.kind||"other",caption:meta.caption||"",path:path,thumb_path:tpath,size_bytes:full.blob.size+th.blob.size,width:full.w,height:full.h,created_by:myEmail||""};
        return sb.from("photos").insert(row).select().single().then(function(r){
          if(r.error||!r.data){st.remove([path,tpath]);throw new Error("save")}
          photos.unshift(r.data);return r.data})})})})}
function uploadMany(files,meta,onProg){
  var ok=0,bad=[];
  return files.reduce(function(p,f,i){return p.then(function(){if(onProg)onProg(i+1,files.length);return uploadPhoto(f,meta).then(function(){ok++},function(){bad.push(f.name||"photo")})})},Promise.resolve()).then(function(){return{ok:ok,bad:bad}})}
function uploadMsg(res){return res.bad.length?"Added "+res.ok+". Could not add: "+res.bad.join(", ")+". (Photos must be JPEG, PNG or WebP images; if you picked an iPhone HEIC on a computer, choose the same photo from the phone instead.)":""}
var pcache={};
function signPaths(paths){
  var need=paths.filter(function(p){var c=pcache[p];return p&&(!c||c.exp<Date.now()+60000)});if(!need.length)return Promise.resolve();
  var ch=[];for(var i=0;i<need.length;i+=100)ch.push(need.slice(i,i+100));
  return Promise.all(ch.map(function(c){return sb.storage.from("photos").createSignedUrls(c,3600).then(function(r){if(r.error||!r.data)return;r.data.forEach(function(d){if(d.signedUrl&&d.path)pcache[d.path]={url:d.signedUrl,exp:Date.now()+3500000}})},function(){})}))}
function photoLabel(ph){var c=ph.client_id?byId(clients,ph.client_id):null;return(c?c.name:"No client")+" · "+kindLabel(ph.kind)+" · "+dshort(String(ph.created_at).slice(0,10))}
function photoGrid(host,rows,opts){
  opts=opts||{};host.textContent="";
  if(!rows.length)return;
  var grid=el("div","pgrid"),imgs=[];
  rows.forEach(function(ph,i){
    var t=el("button","ptile"+(opts.sel&&opts.sel[ph.id]?" picked":""));t.type="button";t.title=photoLabel(ph)+(ph.caption?" · "+ph.caption:"");
    var im=document.createElement("img");im.alt=ph.caption||photoLabel(ph);im.loading="lazy";t.appendChild(im);imgs.push([im,ph.thumb_path||ph.path]);
    if(opts.sel){var ck=el("span","pck",opts.sel[ph.id]?"✓":"");t.appendChild(ck)}
    if(!opts.sel&&ph.caption)t.appendChild(el("span","pcap",ph.caption));
    t.addEventListener("click",function(){if(opts.onTile)opts.onTile(ph,i);else openLightbox(rows,i)});grid.appendChild(t)});
  host.appendChild(grid);
  signPaths(imgs.map(function(x){return x[1]})).then(function(){imgs.forEach(function(x){var c=pcache[x[1]];if(c)x[0].src=c.url})})}
function removePhotos(rows){
  var paths=[];rows.forEach(function(p){paths.push(p.path);if(p.thumb_path)paths.push(p.thumb_path)});
  return sb.storage.from("photos").remove(paths).then(function(r){
    if(r.error)return false;
    return sb.from("photos").delete().in("id",rows.map(function(p){return p.id})).then(function(d){
      if(d.error)return false;var ids={};rows.forEach(function(p){ids[p.id]=1;delete pcache[p.path];delete pcache[p.thumb_path]});photos=photos.filter(function(p){return!ids[p.id]});return true})})}
function deletePhotos(rows,done){
  if(!rows.length)return;
  if(!confirm("Delete "+rows.length+" photo"+(rows.length>1?"s":"")+"? This frees up the space and can't be undone."))return;
  removePhotos(rows).then(function(ok){if(!ok){alert("Could not delete. Check your connection and try again.");return}if(done)done();render()})}

/* full-size viewer */
var lbx=null;
function openLightbox(rows,idx){
  if(!lbx){lbx=document.createElement("div");lbx.id="lbx";lbx.hidden=true;document.body.appendChild(lbx)}
  var cur=idx;lbx.hidden=false;document.body.classList.add("lbopen");
  function close(){lbx.hidden=true;lbx.textContent="";document.body.classList.remove("lbopen");document.removeEventListener("keydown",key)}
  function key(e){if(e.key==="Escape"){e.stopPropagation();close()}else if(e.key==="ArrowLeft")go(-1);else if(e.key==="ArrowRight")go(1)}
  function go(d){var n=cur+d;if(n<0||n>=rows.length)return;cur=n;draw()}
  function draw(){
    var ph=rows[cur];lbx.textContent="";
    var bar=el("div","lbbar");bar.appendChild(btn("‹ Close","hb",close));bar.appendChild(el("span","lbct",(cur+1)+" of "+rows.length));lbx.appendChild(bar);
    var stage=el("div","lbstage"),im=document.createElement("img");im.alt=photoLabel(ph);stage.appendChild(im);
    var pv=btn("‹","lbnav l",function(){go(-1)});pv.disabled=cur===0;pv.setAttribute("aria-label","Previous photo");var nx=btn("›","lbnav r",function(){go(1)});nx.disabled=cur===rows.length-1;nx.setAttribute("aria-label","Next photo");stage.appendChild(pv);stage.appendChild(nx);lbx.appendChild(stage);
    signPaths([ph.path]).then(function(){var c=pcache[ph.path];if(c&&rows[cur]===ph)im.src=c.url});
    var info=el("div","lbinfo"),pr=ph.property_id?byId(props,ph.property_id):null;
    info.appendChild(el("div","lbt",photoLabel(ph)+(pr?" · "+pr.address:"")));
    var cap=document.createElement("input");cap.type="text";cap.placeholder="Add a caption...";cap.value=ph.caption||"";cap.setAttribute("aria-label","Caption");
    var kd=document.createElement("select");kd.setAttribute("aria-label","Photo type");KINDS.forEach(function(k){var o=document.createElement("option");o.value=k[0];o.textContent=k[1];kd.appendChild(o)});kd.value=ph.kind;
    var sv=btn("Save","btn sm",function(){sb.from("photos").update({caption:cap.value.trim(),kind:kd.value}).eq("id",ph.id).then(function(r){if(r.error){alert("Could not save.");return}ph.caption=cap.value.trim();ph.kind=kd.value;sv.textContent="Saved ✓";setTimeout(function(){sv.textContent="Save"},1200)})});
    var row=el("div","lbrow");row.appendChild(cap);row.appendChild(kd);row.appendChild(sv);info.appendChild(row);
    var acts=el("div","lbrow");
    var full=el("a","btn alt sm","Open full size");full.target="_blank";full.rel="noopener";signPaths([ph.path]).then(function(){var c=pcache[ph.path];if(c)full.href=c.url});acts.appendChild(full);
    if(ph.client_id)acts.appendChild(btn("Open client","btn alt sm",function(){close();openClient(ph.client_id)}));
    acts.appendChild(btn("Delete","btn danger sm",function(){if(!confirm("Delete this photo? This frees up the space and can't be undone."))return;removePhotos([ph]).then(function(ok){if(!ok){alert("Could not delete. Check your connection and try again.");return}rows.splice(cur,1);if(!rows.length){close();render();return}if(cur>=rows.length)cur=rows.length-1;draw();render()})}));
    info.appendChild(acts);lbx.appendChild(info)}
  document.addEventListener("keydown",key,true);draw()}

/* photos on a client profile */
function addPhotoControls(host,meta,onDone,withKind){
  var bar=el("div","pbar2"),kd=document.createElement("select");kd.setAttribute("aria-label","Photo type");KINDS.forEach(function(k){var o=document.createElement("option");o.value=k[0];o.textContent=k[1];kd.appendChild(o)});kd.value=meta.kind||"other";kd.style.width="auto";
  var st=el("span","note");
  function run(files){var m=Object.assign({},meta,{kind:withKind===false?meta.kind:kd.value});st.textContent="Uploading...";uploadMany(files,m,function(i,n){st.textContent="Uploading "+i+" of "+n+"..."}).then(function(res){st.textContent=res.ok?"Added "+res.ok+" photo"+(res.ok>1?"s":"")+".":"";var msg=uploadMsg(res);if(msg)alert(msg);onDone()})}
  bar.appendChild(btn("Take photo","btn alt sm",function(){pickPhotos(true,run)}));bar.appendChild(btn("Add photos","btn alt sm",function(){pickPhotos(false,run)}));
  if(withKind!==false)bar.appendChild(kd);bar.appendChild(st);host.appendChild(bar)}
function clientPhotosSection(c){
  var sec=el("div","sec"),h=el("h3",null,"Photos");sec.appendChild(h);
  if(photoErr){sec.appendChild(el("div","note","Run the Stage 10 SQL in Supabase to turn on photos."));return sec}
  var holder=el("div"),more=false;
  function mine(){return photos.filter(function(p){return p.client_id===c.id}).sort(function(a,b){return String(b.created_at)<String(a.created_at)?-1:1})}
  function draw(){var all=mine();h.textContent="Photos"+(all.length?" ("+all.length+")":"");var rows=more?all:all.slice(0,12);holder.textContent="";
    var g=el("div");holder.appendChild(g);photoGrid(g,rows,{onTile:function(ph,i){openLightbox(rows,i)}});
    if(!all.length)holder.appendChild(el("div","note","No photos yet. Take one or add some from your phone or computer."));
    if(all.length>12&&!more)holder.appendChild(btn("Show all "+all.length,"btn alt sm",function(){more=true;draw()}))}
  var ps=props.filter(function(p){return p.client_id===c.id});
  addPhotoControls(sec,{client_id:c.id,property_id:ps.length===1?ps[0].id:null,kind:"other"},function(){draw();render()});
  sec.appendChild(holder);draw();return sec}

/* the Photos tab: every photo, in bulk */
function renderPhotoLib(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  if(photoErr){list.appendChild(el("div","empty","Photos aren't set up yet. Run the Stage 10 SQL in Supabase (SQL Editor), then press Refresh."));return}
  $("topbtns").appendChild(btn("+ Add photos","btn",openAddPhotos));$("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn(psel?"Cancel selecting":"Select","btn alt",function(){psel=psel?null:{};render()}));
  var used=photos.reduce(function(s,p){return s+(p.size_bytes||0)},0),cap=1024*1024*1024,pct=Math.min(100,used/cap*100),avg=Math.max(250000,photos.length?used/photos.length:350000);
  var mt=el("div","meterbox");mt.appendChild(el("div","note",photos.length+" photo"+(photos.length===1?"":"s")+" · using "+(used>=1048576*100?(used/1073741824).toFixed(2)+" GB":(used/1048576).toFixed(1)+" MB")+" of 1 GB on the free plan (room for about "+Math.max(0,Math.floor((cap-used)/avg)).toLocaleString()+" more)"));
  var tr=el("div","meter"),f=el("span");f.style.width=Math.max(1,pct)+"%";if(pct>85)f.style.background="var(--red)";tr.appendChild(f);mt.appendChild(tr);list.appendChild(mt);
  var cs={};photos.forEach(function(p){if(p.client_id)cs[p.client_id]=1});
  var fb=el("div","pbar");
  var fc=fld("Client","select",pf.client,[["all","All clients"],["none","No client"]].concat(Object.keys(cs).map(function(k){return[k,cname(k)]}).sort(function(a,b){return a[1].localeCompare(b[1])})));
  var fk=fld("Type","select",pf.kind,[["all","All types"]].concat(KINDS));
  var fw=fld("When","select",pf.when,[["all","All time"],["month","This month"],["3m","Last 3 months"],["year","This year"]]);
  [[fc,"client"],[fk,"kind"],[fw,"when"]].forEach(function(x){x[0].style.cssText="margin:0;min-width:150px";x[0].input.addEventListener("change",function(){pf[x[1]]=x[0].input.value;pshown=60;render()});fb.appendChild(x[0])});list.appendChild(fb);
  var t=today(),from=pf.when==="month"?t.slice(0,8)+"01":pf.when==="3m"?addDays(t,-92):pf.when==="year"?t.slice(0,4)+"-01-01":"";
  var set=photos.filter(function(p){return(pf.client==="all"||(pf.client==="none"?!p.client_id:p.client_id===pf.client))&&(pf.kind==="all"||p.kind===pf.kind)&&(!from||String(p.created_at).slice(0,10)>=from)&&(!query||[p.caption,p.client_id?cname(p.client_id):"",kindLabel(p.kind)].join(" ").toLowerCase().indexOf(query)>-1)}).sort(function(a,b){return String(b.created_at)<String(a.created_at)?-1:1});
  if(psel){var n=Object.keys(psel).length,bar=el("div","selbar");bar.appendChild(el("b",null,n+" selected"));
    bar.appendChild(btn("Select all shown ("+set.length+")","btn alt sm",function(){set.forEach(function(p){psel[p.id]=1});render()}));
    bar.appendChild(btn("Clear","btn alt sm",function(){psel={};render()}));
    var dl=btn("Delete selected","btn danger sm",function(){var rows=photos.filter(function(p){return psel[p.id]});deletePhotos(rows,function(){psel={}})});dl.disabled=!n;bar.appendChild(dl);list.appendChild(bar)}
  if(!set.length){list.appendChild(el("div","empty",photos.length?"No photos match those filters.":"No photos yet. Add some here, from a client's page, or from a visit."));return}
  var shown=set.slice(0,pshown),g=el("div");list.appendChild(g);
  photoGrid(g,shown,{sel:psel,onTile:psel?function(ph){if(psel[ph.id])delete psel[ph.id];else psel[ph.id]=1;render()}:null});
  if(set.length>pshown)list.appendChild(btn("Show more ("+(set.length-pshown)+" left)","btn alt",function(){pshown+=60;render()}))}
function openAddPhotos(){
  var p=panel();p.appendChild(el("h2",null,"Add photos"));
  var cl=fld("Client (optional)","select","",[["","No client"]].concat(clients.filter(function(c){return!c.archived}).map(function(c){return[c.id,c.name]})));p.appendChild(cl);
  var holder=el("div");p.appendChild(holder);
  function build(){holder.textContent="";var ps=props.filter(function(x){return x.client_id===cl.input.value});addPhotoControls(holder,{client_id:cl.input.value||null,property_id:ps.length===1?ps[0].id:null,kind:"other"},function(){render()})}
  cl.input.addEventListener("change",build);build();
  var dn=btn("Done","btn alt");dn.style.marginTop="12px";dn.addEventListener("click",function(){closeDetail();render()});p.appendChild(dn)}

/* ---- job detail ---- */
function openJob(id){
  var j=byId(jobs,id);if(!j)return;var c=byId(clients,j.client_id),pr=byId(props,j.property_id),p=panel();
  p.appendChild(el("h2",null,j.title));
  p.appendChild(el("div","note",flabel(j.frequency)+" · "+money(j.price)+" per visit · "+(j.status==="active"?"Active":j.status==="paused"?"Paused":"Ended")+" · starts "+dshort(j.start_date)+(j.end_date?" · ends "+dshort(j.end_date):"")));
  var who=el("div","pcard");who.style.marginTop="12px";
  if(c){var cl=el("button","link",c.name);cl.type="button";cl.addEventListener("click",function(){openClient(c.id)});who.appendChild(cl)}
  if(pr){var ad=el("div",null,pr.address);who.appendChild(ad);if(pr.notes)who.appendChild(el("div","note",pr.notes));var m=el("a","btn alt sm","Map");m.href=mapsUrl(pr.address);m.target="_blank";m.rel="noopener";m.style.marginTop="6px";who.appendChild(m)}
  p.appendChild(who);
  if(j.instructions){var ins=el("div","note","Instructions: "+j.instructions);ins.style.cssText="margin-top:8px;white-space:pre-wrap";p.appendChild(ins)}
  var acts=el("div","contact");
  acts.appendChild(btn("Edit","btn alt sm",function(){openJobForm(c,j)}));
  if(j.status==="active"&&j.frequency!=="once")acts.appendChild(btn("Pause","btn alt sm",function(){setJobStatus(j,"paused")}));
  if(j.status==="paused")acts.appendChild(btn("Resume","btn sm",function(){setJobStatus(j,"active")}));
  if(j.status!=="ended")acts.appendChild(btn("End job","btn alt sm",function(){if(confirm("End this job? Future visits will be removed; history stays."))setJobStatus(j,"ended")}));
  else acts.appendChild(btn("Reactivate","btn sm",function(){setJobStatus(j,"active")}));
  p.appendChild(acts);
  var sec=el("div","sec");sec.appendChild(el("h3",null,"Visits"));p.appendChild(sec);
  var t=today(),mine=visits.filter(function(v){return v.job_id===j.id}).sort(function(a,b){return a.scheduled_date<b.scheduled_date?-1:1});
  var upc=mine.filter(function(v){return v.scheduled_date>=t||v.status==="scheduled"}).slice(0,8),past=mine.filter(function(v){return upc.indexOf(v)<0}).reverse().slice(0,6);
  if(!upc.length&&!past.length)sec.appendChild(el("div","note","No visits yet."));
  function again(){render();openJob(j.id)}
  upc.forEach(function(v){var cd=visitCard(v,again,false);var d=el("div","note",dshort(v.scheduled_date));d.style.fontWeight="700";cd.insertBefore(d,cd.firstChild);sec.appendChild(cd)});
  if(past.length){var h=el("div","note","Recent history");h.style.margin="10px 0 4px";sec.appendChild(h);past.forEach(function(v){sec.appendChild(visitCard(v,again,false))})}
  var d=el("div","actions");d.appendChild(el("span"));
  d.appendChild(btn("Delete job","btn danger",function(){if(!confirm("Delete this job and all its visits for good? (End job keeps the history.)"))return;sb.from("jobs").delete().eq("id",j.id).then(function(r){if(r.error){alert("Could not delete.");return}jobs=jobs.filter(function(z){return z.id!==j.id});visits=visits.filter(function(z){return z.job_id!==j.id});closeDetail();render()})}));
  p.appendChild(d)}
function setJobStatus(j,s){
  sb.from("jobs").update({status:s}).eq("id",j.id).then(function(r){
    if(r.error){alert("Could not update the job.");return}
    j.status=s;
    var clear=(s!=="active")?sb.from("visits").delete().eq("job_id",j.id).eq("status","scheduled").gte("scheduled_date",today()):Promise.resolve({});
    Promise.resolve(clear).then(function(){return loadVisits()}).then(function(){return topUp()}).then(function(){render();openJob(j.id)})})}

/* ---- job form ---- */
function openJobForm(client,job){
  if(jobsErr){needSql();return}
  var p=panel();p.appendChild(el("h2",null,job?"Edit job":"New job"));
  var active=clients.filter(function(c){return!c.archived||(client&&c.id===client.id)});
  if(!active.length){p.appendChild(el("p",null,"Add a client first."));return}
  var cid=job?job.client_id:client?client.id:active[0].id;
  var cs=fld("Client","select",cid,active.map(function(c){return[c.id,c.name]}));if(job||client)cs.input.disabled=true;
  var ps=fld("Property","select","",[]);
  function fillProps(){ps.input.textContent="";clientProps(cs.input.value).forEach(function(x){var o=document.createElement("option");o.value=x.id;o.textContent=(x.label?x.label+": ":"")+x.address;ps.input.appendChild(o)});if(job&&job.client_id===cs.input.value)ps.input.value=job.property_id}
  cs.input.addEventListener("change",fillProps);fillProps();
  var svcs=services.filter(function(s){return s.active!==false});
  var sv=fld("Service","select",job&&job.service_id||"",[["","Custom / other"]].concat(svcs.map(function(s){return[s.id,s.name]})));
  var ti=fld("Job name","text",job?job.title:""),pr=fld("Price per visit ($)","number",job?job.price:"");pr.input.step="0.01";pr.input.min="0";pr.input.inputMode="decimal";
  var fq=fld("How often","select",job?job.frequency:"weekly",FREQ);
  var sd=fld("First visit / start date","date",job?job.start_date:today());
  var ed=fld("Ends on (optional)","date",job&&job.end_date||"");
  var ins=fld("Instructions for the crew (gate, dogs, edging, etc.)","textarea",job?job.instructions:"");
  var cw=null;if(s3&&crew.length){cw=fld("Assigned to","select",job&&job.crew_id||"",[["","Me / unassigned"]].concat(crew.filter(function(c){return c.active!==false}).map(function(c){return[c.id,c.name]})))}
  var lastSvc=sv.input.value;
  sv.input.addEventListener("change",function(){var s=byId(services,sv.input.value),old=byId(services,lastSvc);
    if(s){if(!ti.input.value.trim()||(old&&ti.input.value===old.name))ti.input.value=s.name;if((!pr.input.value||Number(pr.input.value)===0||(old&&Number(pr.input.value)===Number(old.default_price)))&&s.default_price!=null)pr.input.value=s.default_price}
    lastSvc=sv.input.value});
  fq.input.addEventListener("change",function(){ed.hidden=fq.input.value==="once"});ed.hidden=fq.input.value==="once";
  p.appendChild(cs);p.appendChild(ps);p.appendChild(sv);p.appendChild(ti);
  var g=el("div","grid2");g.appendChild(pr);g.appendChild(fq);g.appendChild(sd);g.appendChild(ed);p.appendChild(g);if(cw)p.appendChild(cw);p.appendChild(ins);
  var a=el("div","actions");
  var save=btn("Save job","btn",function(){
    if(!ps.input.value){alert("This client needs a property first. Add one on the client page.");return}
    if(!ti.input.value.trim()){alert("Enter a job name.");return}
    if(!sd.input.value){alert("Pick a start date.");return}
    var price=parseFloat(pr.input.value);if(isNaN(price)||price<0){alert("Enter the price per visit (0 if unknown).");return}
    var once=fq.input.value==="once";
    var row={client_id:cs.input.value,property_id:ps.input.value,service_id:sv.input.value||null,title:ti.input.value.trim(),price:price,frequency:fq.input.value,start_date:sd.input.value,end_date:(!once&&ed.input.value)?ed.input.value:null,instructions:ins.input.value.trim()};
    if(s3&&cw)row.crew_id=cw.input.value||null;
    save.disabled=true;
    if(!job){
      sb.from("jobs").insert(row).select().single().then(function(r){
        if(r.error||!r.data){save.disabled=false;alert("Could not save the job.");return}
        jobs.push(r.data);topUp().then(function(){render();openJob(r.data.id)})});
      return}
    var sched=job.frequency!==row.frequency||job.start_date!==row.start_date||(job.end_date||null)!==row.end_date;
    sb.from("jobs").update(row).eq("id",job.id).select().single().then(function(r){
      if(r.error||!r.data){save.disabled=false;alert("Could not save the job.");return}
      Object.assign(job,r.data);
      var fut;
      if(sched&&job.status==="active")fut=sb.from("visits").delete().eq("job_id",job.id).eq("status","scheduled").gte("scheduled_date",today());
      else fut=sb.from("visits").update(s3&&cw?{price:job.price,property_id:job.property_id,crew_id:job.crew_id||null}:{price:job.price,property_id:job.property_id}).eq("job_id",job.id).eq("status","scheduled").gte("scheduled_date",today());
      Promise.resolve(fut).then(function(){return loadVisits()}).then(function(){return topUp()}).then(function(){render();openJob(job.id)})})});
  a.appendChild(save);a.appendChild(btn("Cancel","btn alt",function(){if(job)openJob(job.id);else closeDetail()}));p.appendChild(a)}

/* ---- services catalog ---- */
function openServices(){
  if(jobsErr){needSql();return}
  var p=panel();p.appendChild(el("h2",null,"Services"));p.appendChild(el("p","note","Your menu of work. The default price fills in when you pick a service on a new job. Changing it later doesn't touch existing jobs."));
  var holder=el("div");p.appendChild(holder);
  function row(s){
    var box=el("div","pcard"),g=el("div","grid2");
    var n=fld("Name","text",s?s.name:""),d=fld("Default price ($, optional)","number",s&&s.default_price!=null?s.default_price:"");d.input.step="0.01";d.input.min="0";d.input.inputMode="decimal";
    g.appendChild(n);g.appendChild(d);box.appendChild(g);var a=el("div","acts");
    a.appendChild(btn(s?"Save":"Add service","btn sm",function(){
      var name=n.input.value.trim();if(!name){alert("Enter a name.");return}
      var price=d.input.value===""?null:parseFloat(d.input.value);if(price!==null&&(isNaN(price)||price<0)){alert("Enter a valid price.");return}
      var q=s?sb.from("services").update({name:name,default_price:price}).eq("id",s.id).select().single():sb.from("services").insert({name:name,default_price:price}).select().single();
      q.then(function(r){if(r.error||!r.data){alert("Could not save. Is that name already in the list?");return}
        if(s)Object.assign(s,r.data);else services.push(r.data);services.sort(function(x,y){return x.name.localeCompare(y.name)});draw()})}));
    if(s)a.appendChild(btn("Delete","btn danger sm",function(){if(!confirm("Delete this service? Jobs that use it keep their name and price."))return;sb.from("services").delete().eq("id",s.id).then(function(r){if(r.error){alert("Could not delete.");return}services=services.filter(function(z){return z.id!==s.id});draw()})}));
    box.appendChild(a);return box}
  function draw(){holder.textContent="";services.forEach(function(s){holder.appendChild(row(s))});var h=el("div","note","Add a new service");h.style.margin="14px 0 6px";holder.appendChild(h);holder.appendChild(row(null))}
  draw()}

/* ---- jobs on the client page ---- */
function clientJobsSection(c){
  var sec=el("div","sec"),h=el("h3",null,"Jobs");
  h.appendChild(btn("+ New job","btn alt sm",function(){if(!clientProps(c.id).length){alert("Add a property (service address) first.");return}openJobForm(c,null)}));sec.appendChild(h);
  var mine=jobs.filter(function(j){return j.client_id===c.id});
  if(jobsErr)sec.appendChild(el("div","note","Run the Stage 2 SQL in Supabase to turn on jobs."));
  else if(!mine.length)sec.appendChild(el("div","note","No jobs yet."));
  mine.forEach(function(j){var card=el("div","pcard");card.appendChild(el("b",null,j.title));
    var nv=j.status==="active"?nextVisit(j):null;
    card.appendChild(el("div","note",[flabel(j.frequency),money(j.price),j.status!=="active"?(j.status==="paused"?"Paused":"Ended"):nv?"Next: "+dshort(nv.scheduled_date):""].filter(Boolean).join(" · ")));
    var a=el("div","acts");a.appendChild(btn("Open","btn alt sm",function(){openJob(j.id)}));card.appendChild(a);sec.appendChild(card)});
  return sec}

/* ---- job history on the client page (all-time, not just recent) ---- */
function historySection(c){
  var sec=el("div","sec"),h=el("h3",null,"Job history");sec.appendChild(h);
  var body=el("div");sec.appendChild(body);
  if(jobsErr){body.appendChild(el("div","note","Run the Stage 2 SQL in Supabase to turn on job history."));return sec}
  body.appendChild(el("div","note","Loading..."));
  sb.from("visits").select("*").eq("client_id",c.id).order("scheduled_date",{ascending:false}).limit(1000).then(function(r){
    body.textContent="";
    if(r.error){body.appendChild(el("div","note","Could not load history."));return}
    var all=(r.data||[]).filter(function(v){return v.status!=="scheduled"}).sort(function(a,b){return a.scheduled_date<b.scheduled_date?1:-1});
    if(!all.length){body.appendChild(el("div","note","No completed work yet. Visits show up here once you mark them Done."));return}
    var done=all.filter(function(v){return v.status==="done"}),total=done.reduce(function(s,v){return s+Number(v.price||0)},0);
    var sum=el("div","note",done.length+" visit"+(done.length===1?"":"s")+" completed · "+money(total)+" total"+(all.length>done.length?" · "+(all.length-done.length)+" skipped":"")+(done[0]?" · last: "+dshort(done[0].scheduled_date):""));
    sum.style.cssText="margin-bottom:8px;font-weight:700";body.appendChild(sum);
    var list=el("div");body.appendChild(list);var shown=0;
    function more(n){
      all.slice(shown,shown+n).forEach(function(v){
        var j=byId(jobs,v.job_id),row=el("div","pcard");row.style.cssText="display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:"+(j?"pointer":"default");
        var l=el("div");l.appendChild(el("b",null,dshort(v.scheduled_date)+" · "+(j?j.title:"(deleted job)")));l.appendChild(el("div","note",[paddr(v.property_id),money(v.price)].filter(Boolean).join(" · ")));
        var rt=el("span","chip "+(v.status==="done"?"won":"lost"),v.status==="done"?"Done":"Skipped");row.appendChild(l);row.appendChild(rt);
        if(j)row.addEventListener("click",function(){openJob(j.id)});list.appendChild(row)});
      shown=Math.min(all.length,shown+n);mb.hidden=shown>=all.length}
    var mb=btn("Show more","btn alt sm",function(){more(50)});body.appendChild(mb);more(15)});
  return sec}

/* ---- crew: temps get a texted route, full-timers get their own limited login ---- */
function callApi(path,action,payload){
  return sb.auth.getSession().then(function(r){
    var t=r.data&&r.data.session&&r.data.session.access_token;
    return fetch(path,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+t},body:JSON.stringify(Object.assign({action:action},payload))})
      .then(function(res){return res.json().catch(function(){return{}}).then(function(j){return{ok:res.ok,error:j.error||("Error "+res.status),data:j}})},function(){return{ok:false,error:"Could not reach the server."}})})}
function callCrewApi(action,payload){return callApi("/api/crew-login",action,payload)}
function refreshCrew(){return sb.from("crew").select("*").order("name",{ascending:true}).limit(200).then(function(r){if(!r.error)crew=r.data||[]})}
function openCrew(){
  var p=panel();p.appendChild(el("h2",null,"Crew"));
  var intro=el("p","note","Temp (text only): no login. You text them the day's route. Full-time (login): they sign in at this same address and see only their own stops: address, notes and a Done button. They never see prices, client names, phone numbers, income or anything else. Leave this empty if you work alone.");p.appendChild(intro);
  var holder=el("div");p.appendChild(holder);
  function row(m){
    var box=el("div","pcard"),g=el("div","grid2");
    var n=fld("Name","text",m?m.name:""),ph=fld("Phone (for texting routes)","tel",m?m.phone:"");g.appendChild(n);g.appendChild(ph);box.appendChild(g);
    var hasLogin=m&&m.kind==="login"&&m.user_id,extra=el("div");box.appendChild(extra);var ty=null,em=null,pw=null;
    if(hasLogin){
      var lg=el("div","note","Has a login: "+(m.email||""));lg.style.margin="8px 0 0";extra.appendChild(lg);
    }else{
      ty=fld("Type","select","temp",[["temp","Temp (text only)"],["login","Full-time (own login)"]]);extra.appendChild(ty);
      var lw=el("div");lw.hidden=true;em=fld("Login email","email","");pw=fld("Starting password (8+ characters, you tell them)","text","");pw.input.autocomplete="off";lw.appendChild(em);lw.appendChild(pw);extra.appendChild(lw);
      ty.input.addEventListener("change",function(){lw.hidden=ty.input.value!=="login"});
    }
    var a=el("div","acts");
    a.appendChild(btn(m?"Save":"Add crew member","btn sm",function(){
      var name=n.input.value.trim();if(!name){alert("Enter a name.");return}
      var wantLogin=!!ty&&ty.input.value==="login";
      if(wantLogin){if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())){alert("Enter the login email.");return}if(pw.input.value.length<8){alert("The password needs at least 8 characters.");return}}
      var q=m?sb.from("crew").update({name:name,phone:ph.input.value.trim()}).eq("id",m.id).select().single():sb.from("crew").insert({name:name,phone:ph.input.value.trim()}).select().single();
      q.then(function(r){
        if(r.error||!r.data){alert("Could not save.");return}
        if(!wantLogin){return refreshCrew().then(function(){draw();render()})}
        callCrewApi("create",{crew_id:r.data.id,email:em.input.value.trim(),password:pw.input.value}).then(function(res){
          refreshCrew().then(function(){draw();render();if(!res.ok)alert("Saved as a temp, but the login was not created: "+res.error);else alert("Login created. Give "+name+" the email and password; they sign in at this same address.")})})})}));
    if(hasLogin){
      var rp=btn("Reset password","btn alt sm",function(){
        a.textContent="";var np=document.createElement("input");np.type="text";np.placeholder="New password (8+ characters)";np.autocomplete="off";np.style.width="auto";a.appendChild(np);
        a.appendChild(btn("Set password","btn sm",function(){callCrewApi("reset",{crew_id:m.id,password:np.value}).then(function(res){if(!res.ok){alert(res.error);return}alert("Password changed.");draw()})}));a.appendChild(btn("Cancel","btn alt sm",draw))});
      a.appendChild(rp);
      a.appendChild(btn("Remove login","btn alt sm",function(){if(!confirm("Remove "+m.name+"'s login? They keep their name here as a temp."))return;callCrewApi("remove",{crew_id:m.id}).then(function(res){if(!res.ok){alert(res.error);return}refreshCrew().then(function(){draw();render()})})}))}
    if(m)a.appendChild(btn("Delete","btn danger sm",function(){
      if(!confirm("Delete "+m.name+"? Their login (if any) is removed and their visits become unassigned."))return;
      var go=function(){sb.from("crew").delete().eq("id",m.id).then(function(r){if(r.error){alert("Could not delete.");return}crew=crew.filter(function(z){return z.id!==m.id});visits.forEach(function(v){if(v.crew_id===m.id)v.crew_id=null});jobs.forEach(function(j){if(j.crew_id===m.id)j.crew_id=null});if(crewF===m.id)crewF="all";draw();render()})};
      if(m.user_id)callCrewApi("remove",{crew_id:m.id}).then(function(res){if(!res.ok){alert(res.error);return}go()});else go()}));
    box.appendChild(a);return box}
  function draw(){holder.textContent="";crew.forEach(function(m){holder.appendChild(row(m))});var h=el("div","note",crew.length?"Add another":"Add your first crew member");h.style.margin="14px 0 6px";holder.appendChild(h);holder.appendChild(row(null))}
  draw()}

/* ---- send a route to a crew member (text message) ---- */
function smsHref(phone,body){var ios=/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)&&"ontouchend" in document;return"sms:"+digits(phone)+(ios?"&":"?")+"body="+encodeURIComponent(body)}
function routeMessage(d,sel){
  var lines=["Latta Corp route for "+dshort(d)+":",""];
  sel.forEach(function(v,i){
    var j=byId(jobs,v.job_id),pp=byId(props,v.property_id),notes=[pp&&pp.notes,j&&j.instructions].filter(Boolean).join(" / ");
    lines.push((i+1)+". "+paddr(v.property_id)+(j?" - "+j.title:""));if(notes)lines.push("   Note: "+notes)});
  var u=routeUrl(sel);if(u)lines.push("","Map route: "+u);
  return lines.join("\n")}
function openSendRoute(d){
  var p=panel();p.appendChild(el("h2",null,"Send route · "+dlabel(d)));
  var members=crew.filter(function(c){return c.active!==false});
  if(!members.length){p.appendChild(el("p",null,"Add a crew member first."));p.appendChild(btn("Open Crew","btn",openCrew));return}
  var stops=onDay(d).filter(function(v){return v.status==="scheduled"}).sort(dayOrder);
  if(!stops.length){p.appendChild(el("p",null,"No scheduled stops on this day."));return}
  var who=fld("Send to","select",members[0].id,members.map(function(m){return[m.id,m.name+(m.kind==="login"?" (has login)":"")+(m.phone?"":" (no phone saved)")]}));p.appendChild(who);
  p.appendChild(el("div","note","Pick the stops for this person, in your route order:"));
  var checks=el("div");p.appendChild(checks);var boxes=[];
  function defaults(){var mine=stops.filter(function(v){return v.crew_id===who.input.value});return mine.length?mine:stops.filter(function(v){return!v.crew_id})}
  function build(){
    checks.textContent="";boxes=[];var def=defaults();
    stops.forEach(function(v,i){
      var j=byId(jobs,v.job_id),lab=el("label","pcard");lab.style.cssText="display:flex;gap:10px;align-items:flex-start;cursor:pointer";
      var cb=document.createElement("input");cb.type="checkbox";cb.style.cssText="width:22px;height:22px;flex:none;margin-top:2px";cb.checked=def.indexOf(v)>-1;cb.addEventListener("change",msg);
      var t=el("div");t.appendChild(el("b",null,(i+1)+". "+paddr(v.property_id)));t.appendChild(el("div","note",(j?j.title:"")+(v.crew_id&&crewName(v.crew_id)?" · now assigned to "+crewName(v.crew_id):"")));
      lab.appendChild(cb);lab.appendChild(t);checks.appendChild(lab);boxes.push([cb,v])});
    msg()}
  var ta=document.createElement("textarea");ta.style.minHeight="170px";ta.setAttribute("aria-label","Message");var dirty=false;ta.addEventListener("input",function(){dirty=true});
  function picked(){return boxes.filter(function(b){return b[0].checked}).map(function(b){return b[1]})}
  function msg(){if(!dirty)ta.value=routeMessage(d,picked())}
  who.input.addEventListener("change",function(){dirty=false;build()});
  var asg=el("label");asg.style.cssText="display:flex;gap:10px;align-items:center;margin:10px 0;font-weight:600";var ac=document.createElement("input");ac.type="checkbox";ac.checked=true;ac.style.cssText="width:20px;height:20px";asg.appendChild(ac);asg.appendChild(document.createTextNode("Also assign these stops to them"));
  p.appendChild(asg);p.appendChild(el("div","note","The message has addresses and notes only: no prices or client names."));p.appendChild(ta);
  var acts=el("div","actions");
  function assign(){
    var sel=picked(),m=byId(crew,who.input.value);if(!sel.length){alert("Pick at least one stop.");return Promise.resolve(false)}
    if(!ac.checked||!s3)return Promise.resolve(true);
    return Promise.all(sel.map(function(v,i){return sb.from("visits").update({crew_id:m.id,sort_order:i*10}).eq("id",v.id).then(function(r){if(!r.error){v.crew_id=m.id;v.sort_order=i*10}return r})})).then(function(rs){render();return!rs.some(function(r){return r.error})})}
  var send=btn("Open text message","btn",function(){
    var m=byId(crew,who.input.value);if(!m.phone&&!confirm("No phone number saved for "+m.name+". Open a blank text anyway?"))return;
    assign().then(function(ok){if(!ok)return;window.location.href=smsHref(m.phone,ta.value)})});
  var cp=btn("Copy message","btn alt",function(){
    function done(){cp.textContent="Copied";setTimeout(function(){cp.textContent="Copy message"},1500)}
    assign().then(function(ok){if(!ok)return;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(ta.value).then(done,function(){ta.select();document.execCommand("copy");done()});else{ta.select();document.execCommand("copy");done()}})});
  acts.appendChild(send);acts.appendChild(cp);p.appendChild(acts);build()}

/* ---- the crew member's own limited screen ---- */
function startCrewApp(me){
  crewMe=me;$("loginwrap").hidden=true;$("layout").hidden=true;$("gsearch").hidden=true;$("crewapp").hidden=false;$("signout").hidden=false;$("refresh").hidden=false;renderCrewApp()}
function renderCrewApp(){
  var box=$("crewapp"),d=cwDate,t=today();box.textContent="";
  box.appendChild(el("h2",null,"Hi, "+String(crewMe.name||"").split(" ")[0]));
  box.appendChild(calNav(longDate(d),function(){cwDate=addDays(d,-1);renderCrewApp()},function(){cwDate=addDays(d,1);renderCrewApp()},function(){cwDate=t;renderCrewApp()},d!==t));
  var body=el("div");body.appendChild(el("div","note","Loading..."));box.appendChild(body);
  sb.rpc("crew_route",{p_from:d,p_to:d}).then(function(r){
    if(cwDate!==d)return;body.textContent="";
    if(r.error){body.appendChild(el("div","note","Could not load your route. Pull to refresh or sign in again."));return}
    var rows=r.data||[];if(!rows.length){body.appendChild(el("div","empty","No stops for this day."));return}
    var todo=rows.filter(function(x){return x.status==="scheduled"}),done=rows.length-todo.length;
    var sum=el("div","daysum");sum.appendChild(el("b",null,rows.length+" stop"+(rows.length>1?"s":"")+(done?" · "+done+" done":"")));
    var addrs=todo.map(function(x){return x.address}).filter(Boolean).slice(0,10);
    if(addrs.length){var a=el("a","btn sm","Start route");a.href="https://www.google.com/maps/dir/?api=1&travelmode=driving&destination="+encodeURIComponent(addrs[addrs.length-1])+(addrs.length>1?"&waypoints="+encodeURIComponent(addrs.slice(0,-1).join("|")):"");a.target="_blank";a.rel="noopener";sum.appendChild(a)}
    body.appendChild(sum);
    rows.forEach(function(x,i){
      var card=el("div","pcard cwstop"+(x.status==="done"?" isdone":""));
      card.appendChild(el("div","cwtitle",(i+1)+". "+x.job_title));card.appendChild(el("div","cwaddr",x.address));
      var tips=[x.property_notes,x.instructions].filter(Boolean).join("\n");if(tips){var n=el("div","note","⚠ "+tips);n.style.cssText="color:#7a5b00;white-space:pre-wrap;margin-top:4px";card.appendChild(n)}
      var acts=el("div","acts"),m=el("a","btn alt","Map");m.href=mapsUrl(x.address);m.target="_blank";m.rel="noopener";acts.appendChild(m);
      var isDone=x.status==="done";
      acts.appendChild(btn(isDone?"Undo":"Done",isDone?"btn alt":"btn",function(){sb.rpc("crew_set_done",{p_visit:x.visit_id,p_done:!isDone}).then(function(r2){if(r2.error)alert("Could not save that. Try again.");renderCrewApp()})}));
      card.appendChild(acts);body.appendChild(card)})})}

/* ======================= BILLING ======================= */
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function r2(x){return Math.round((Number(x)||0)*100)/100}
function invNum(n){var s=String(n||0);while(s.length<4)s="0"+s;return"LC-"+s}
function lastMonthEnd(){return addDays(today().slice(0,8)+"01",-1)}
function thisMonthEnd(){return addDays(addDays(today().slice(0,8)+"01",32).slice(0,8)+"01",-1)}
function bizv(k,d){return biz&&biz[k]!=null&&biz[k]!==""?biz[k]:d}
function jobTitle(id){var j=byId(jobs,id);return j?j.title:"Lawn service"}
function loadUnbilled(){
  return sb.from("visits").select("*").eq("status","done").is("invoice_id",null).is("paid_at",null).limit(5000).then(function(r){if(r.error){billErr=true;unbilled=[]}else unbilled=r.data||[]})}
function reloadInvoices(){return sb.from("invoices").select("*").order("number",{ascending:false}).limit(3000).then(function(r){if(!r.error)invoices=r.data||[]})}
function isOverdue(i){return i.status==="open"&&i.due_date&&i.due_date<today()}
function openTotal(arr){return r2(arr.filter(function(i){return i.status==="open"}).reduce(function(s,i){return s+Number(i.total||0)},0))}
function eligible(){return unbilled.filter(function(v){return v.scheduled_date<=billThrough&&Number(v.price)>0})}
function billGroups(){
  var g={},order=[];eligible().forEach(function(v){if(!g[v.client_id]){g[v.client_id]=[];order.push(v.client_id)}g[v.client_id].push(v)});
  order.sort(function(a,b){return cname(a).localeCompare(cname(b))});order.forEach(function(k){g[k].sort(function(a,b){return a.scheduled_date<b.scheduled_date?-1:1})});
  return{g:g,order:order}}

function createInvoice(cid,vs,through){
  vs=vs.slice().sort(function(a,b){return a.scheduled_date<b.scheduled_date?-1:1});
  var issue=today(),terms=Number(bizv("terms_days",10)),total=r2(vs.reduce(function(s,v){return s+Number(v.price||0)},0));
  var row={client_id:cid,issue_date:issue,due_date:addDays(issue,isNaN(terms)?10:terms),period_start:vs[0].scheduled_date,period_end:through,total:total};
  return sb.from("invoices").insert(row).select().single().then(function(r){
    if(r.error||!r.data)return Promise.reject("Could not create the invoice. Did you run the Stage 5 SQL?");
    var inv=r.data;
    var lines=vs.map(function(v){return{invoice_id:inv.id,visit_id:v.id,service_date:v.scheduled_date,address:paddr(v.property_id),description:jobTitle(v.job_id),amount:v.price}});
    function undo(msg){return sb.from("invoices").delete().eq("id",inv.id).then(function(){return Promise.reject(msg)})}
    return sb.from("invoice_items").insert(lines).then(function(r2_){
      if(r2_.error)return undo("Could not add the invoice lines.");
      return sb.from("visits").update({invoice_id:inv.id}).in("id",vs.map(function(v){return v.id})).is("invoice_id",null).then(function(r3){
        if(r3.error)return undo("Could not link the visits to the invoice.");
        invoices.unshift(inv);return inv})})})}

/* ---- Billing screen ---- */
function renderBilling(){
  var tabs=$("tabs");tabs.textContent="";
  var op=invoices.filter(function(i){return i.status==="open"}),pd_=invoices.filter(function(i){return i.status==="paid"}),od=op.filter(isOverdue);
  var bg=billGroups();
  [["tobill","To bill",bg.order.length],["open","Open",op.length],["paid","Paid",pd_.length],["estimates","Estimates",estimates.filter(function(e){return(e.status==="draft"||e.status==="sent")&&!estExpired(e)}).length]].forEach(function(s){
    var b=el("button","tab"+(bfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){bfilter=s[0];render()});tabs.appendChild(b)});
  $("topbtns").appendChild(btn("Billing settings","btn alt",openBizSettings));
  var list=$("list");list.textContent="";
  if(bfilter==="estimates")return renderEstimates(list);
  if(billErr){list.appendChild(el("div","empty","Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var mon=today().slice(0,7),paidMonth=r2(pd_.filter(function(i){return i.paid_at&&String(i.paid_at).slice(0,7)===mon}).reduce(function(s,i){return s+Number(i.total||0)},0));
  var stats=el("div","stats");
  [["Outstanding",money(openTotal(invoices)),""],["Overdue",money(openTotal(od)),od.length?"bad":""],["Ready to bill",money(r2(eligible().reduce(function(s,v){return s+Number(v.price||0)},0))),""],["Paid this month",money(paidMonth),""]].forEach(function(x){
    var c=el("div","stat "+x[2]);c.appendChild(el("span",null,x[0]));c.appendChild(el("b",null,x[1]));stats.appendChild(c)});
  list.appendChild(stats);
  if(bfilter==="tobill")return renderToBill(list,bg);
  var set=(bfilter==="open"?op.slice().sort(function(a,b){return a.due_date<b.due_date?-1:1}):pd_).filter(function(i){
    if(!query)return true;return[invNum(i.number),i.number,cname(i.client_id),i.reference].join(" ").toLowerCase().indexOf(query)>-1});
  if(bfilter==="open"&&od.length){var ro=btn("Remind overdue clients ("+od.length+")","btn alt",function(){remindOverdue(od)});ro.style.margin="8px 0";list.appendChild(ro)}
  if(!set.length){list.appendChild(el("div","empty",bfilter==="open"?"No open invoices.":"No paid invoices yet."));return}
  set.forEach(function(i){list.appendChild(invoiceRow(i))})}
function invoiceRow(i){
  var b=el("button","row client"+(isOverdue(i)?" overdue":""));b.type="button";var l=el("div");
  l.appendChild(el("b",null,invNum(i.number)+" · "+cname(i.client_id)));
  l.appendChild(el("div","sub",[i.period_end?monthName(i.period_end):"",i.status==="paid"?"Paid "+(i.paid_at?dshort(String(i.paid_at).slice(0,10)):"")+(i.paid_method?" ("+i.paid_method+")":""):"Due "+dshort(i.due_date),i.reference?"Ref "+i.reference:"",i.status==="open"&&i.reminded_at?"Reminded "+dshort(String(i.reminded_at).slice(0,10)):""].filter(Boolean).join(" · ")));
  var r=el("div");r.style.textAlign="right";r.appendChild(el("b",null,money(i.total)));
  var chip=i.status==="void"?el("span","chip lost","Void"):i.status==="paid"?el("span","chip won","Paid"):isOverdue(i)?el("span","chip od","Overdue"):el("span","chip",i.sent_at?"Sent":"Not sent");r.appendChild(el("div"));r.appendChild(chip);
  b.appendChild(l);b.appendChild(r);b.addEventListener("click",function(){openInvoice(i.id)});return b}
function renderToBill(list,bg){
  var bar=el("div","billbar");
  var lab=el("label","f");lab.style.margin="0";lab.appendChild(el("span",null,"Bill completed visits through"));var di=document.createElement("input");di.type="date";di.value=billThrough;di.style.width="auto";di.addEventListener("change",function(){if(di.value){billThrough=di.value;render()}});lab.appendChild(di);bar.appendChild(lab);
  var q=el("span");q.appendChild(btn("End of last month","btn alt sm",function(){billThrough=lastMonthEnd();render()}));q.appendChild(document.createTextNode(" "));q.appendChild(btn("Today","btn alt sm",function(){billThrough=today();render()}));bar.appendChild(q);
  list.appendChild(bar);
  var zero=unbilled.filter(function(v){return v.scheduled_date<=billThrough&&!(Number(v.price)>0)});
  if(zero.length){var zn=el("div","note","⚠ "+zero.length+" completed visit"+(zero.length>1?"s have":" has")+" no price set, so "+(zero.length>1?"they are":"it is")+" left out. Set the job's price, then they can be billed.");zn.style.cssText="color:#7a5b00;margin:6px 0";list.appendChild(zn)}
  if(!bg.order.length){list.appendChild(el("div","empty","Nothing to bill through "+dshort(billThrough)+". Completed visits that haven't been paid or invoiced show up here."));return}
  var all=btn("Create all invoices ("+bg.order.length+")","btn",function(){
    if(!confirm("Create "+bg.order.length+" invoice"+(bg.order.length>1?"s":"")+" for completed visits through "+dshort(billThrough)+"?"))return;
    all.disabled=true;var made=0,fails=[],through=billThrough;
    bg.order.reduce(function(p,cid){return p.then(function(){return createInvoice(cid,bg.g[cid],through).then(function(){made++},function(e){fails.push(cname(cid)+": "+e)})})},Promise.resolve()).then(function(){return loadUnbilled()}).then(function(){render();alert("Created "+made+" invoice"+(made===1?"":"s")+"."+(fails.length?"\n\nProblems:\n"+fails.join("\n"):""));bfilter="open";render()})});
  all.style.margin="8px 0 4px";list.appendChild(all);
  bg.order.forEach(function(cid){
    var vs=bg.g[cid],tot=r2(vs.reduce(function(s,v){return s+Number(v.price||0)},0)),card=el("div","pcard");
    var top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l=el("div");l.appendChild(el("b",null,cname(cid)));l.appendChild(el("div","note",vs.length+" visit"+(vs.length>1?"s":"")+" · "+money(tot)));top.appendChild(l);
    var one=btn("Create invoice","btn sm",function(){one.disabled=true;createInvoice(cid,vs,billThrough).then(function(inv){return loadUnbilled().then(function(){render();openInvoice(inv.id)})},function(e){one.disabled=false;alert(e)})});top.appendChild(one);card.appendChild(top);
    var det=document.createElement("details");det.appendChild(el("summary",null,"See the visits"));
    vs.forEach(function(v){det.appendChild(el("div","note",dshort(v.scheduled_date)+" · "+jobTitle(v.job_id)+" · "+paddr(v.property_id)+" · "+money(v.price)))});card.appendChild(det);list.appendChild(card)})}

/* ---- Invoice detail ---- */
function openInvoice(id){
  var inv=byId(invoices,id);if(!inv)return;var c=byId(clients,inv.client_id),p=panel();
  p.appendChild(el("h2",null,invNum(inv.number)+" · "+cname(inv.client_id)));
  var st=inv.status==="paid"?"Paid":inv.status==="void"?"Void":isOverdue(inv)?"Overdue":"Open";
  p.appendChild(el("div","note",st+" · issued "+dshort(inv.issue_date)+" · due "+dshort(inv.due_date)+(inv.sent_at?" · sent "+dshort(String(inv.sent_at).slice(0,10)):" · not sent yet")));
  var body=el("div");body.appendChild(el("div","note","Loading..."));p.appendChild(body);
  sb.from("invoice_items").select("*").eq("invoice_id",inv.id).order("service_date",{ascending:true}).limit(1000).then(function(r){
    var items=r.error?[]:(r.data||[]);body.textContent="";
    var locked=inv.status!=="open";
    var t=document.createElement("table");t.className="itable";
    items.forEach(function(it){var tr=document.createElement("tr");tr.appendChild(el("td",null,it.service_date?dshort(it.service_date):""));
      var d=el("td",null,it.description+(it.address?" · "+it.address:""));tr.appendChild(d);var a=el("td","amt",money(it.amount));tr.appendChild(a);
      if(!locked){var x=el("td");var rm=btn("×","link",function(){removeLine(inv,it,function(){openInvoice(inv.id)})});rm.setAttribute("aria-label","Remove line");rm.style.cssText="font-size:1.2rem;text-decoration:none;color:var(--red)";x.appendChild(rm);tr.appendChild(x)}t.appendChild(tr)});
    body.appendChild(t);
    var tot=el("div","invtotal","Total "+money(inv.total));body.appendChild(tot);
    if(!locked){
      var add=el("div","pcard"),g=el("div","grid2");var dsc=fld("Add a line (extra work, discount, late fee)","text",""),amt=fld("Amount ($, negative = discount)","number","");amt.input.step="0.01";amt.input.inputMode="decimal";g.appendChild(dsc);g.appendChild(amt);add.appendChild(g);
      var ab=btn("Add line","btn alt sm",function(){var a2=parseFloat(amt.input.value);if(!dsc.input.value.trim()||isNaN(a2)){alert("Enter a description and an amount.");return}
        sb.from("invoice_items").insert({invoice_id:inv.id,service_date:today(),description:dsc.input.value.trim(),amount:a2}).then(function(r2_){if(r2_.error){alert("Could not add the line.");return}setTotal(inv,r2(Number(inv.total)+a2),function(){openInvoice(inv.id)})})});ab.style.marginTop="8px";add.appendChild(ab);body.appendChild(add)}
    var ref=fld("Reference / PO number (shows on the invoice)","text",inv.reference||"");body.appendChild(ref);
    var rb=btn("Save reference","btn alt sm",function(){sb.from("invoices").update({reference:ref.input.value.trim()}).eq("id",inv.id).then(function(r2_){if(r2_.error){alert("Could not save.");return}inv.reference=ref.input.value.trim();rb.textContent="Saved";setTimeout(function(){rb.textContent="Save reference"},1200)})});rb.style.marginTop="6px";body.appendChild(rb);
    var acts=el("div","contact");acts.style.marginTop="14px";
    acts.appendChild(btn("View / Print / PDF","btn",function(){showInvoice(inv,items)}));
    var msg=invMessage(inv,c);
    if(c&&c.email){var a2=el("a","btn","Email invoice");a2.href=mailHref(c.email,"Invoice "+invNum(inv.number)+" from "+bizv("name","Latta Corp"),msg+(inv.share_token?"":"\n\n(The invoice PDF is attached.)"));a2.addEventListener("click",function(){markSent(inv)});acts.appendChild(a2)}
    acts.appendChild(copyBtn("Copy message",msg,false,function(){markSent(inv)}));
    if(inv.share_token){acts.appendChild(copyBtn("Copy link",docUrl(inv.share_token),false,function(){markSent(inv)}));var pv=el("a","btn alt","Preview link");pv.href=docUrl(inv.share_token,true);pv.target="_blank";pv.rel="noopener";acts.appendChild(pv)}
    if(isOwner()&&c&&c.phone){var a1=el("a","btn alt","Text");a1.href=smsHref(c.phone,msg);a1.addEventListener("click",function(){markSent(inv)});acts.appendChild(a1)}
    if(inv.status==="open"&&c&&(isOverdue(inv)||inv.sent_at)){
      var rem=invRemind(inv,c);
      if(c.email){var a4=el("a","btn alt","Email a reminder");a4.href=mailHref(c.email,"Payment reminder: invoice "+invNum(inv.number),rem);a4.addEventListener("click",function(){stampInv(inv)});acts.appendChild(a4)}
      if(isOwner()&&c.phone){var a3=el("a","btn alt","Text a reminder");a3.href=smsHref(c.phone,rem);a3.addEventListener("click",function(){stampInv(inv)});acts.appendChild(a3)}}
    body.appendChild(acts);
    if(inv.share_token&&inv.viewed_at)body.appendChild(el("div","note","✓ Client opened the invoice link "+ago(inv.viewed_at)+"."));
    else if(inv.share_token&&inv.sent_at)body.appendChild(el("div","note","The client hasn't opened the link yet."));
    if(!inv.share_token)body.appendChild(el("div","note","Run the Stage 11 SQL in Supabase to give each invoice a private link clients can open."));
    if(inv.status==="open"&&inv.reminded_at)body.appendChild(el("div","note","Last reminder texted "+dshort(String(inv.reminded_at).slice(0,10))+"."));
    if(c&&!c.email)body.appendChild(el("div","note","Tip: add an email on the client page to get an Email button here. To email the PDF: tap View / Print / PDF, choose Save as PDF, then attach it."));
    var pay=el("div","sec");
    if(inv.status==="open"){
      pay.appendChild(el("h3",null,"Record payment"));var pg=el("div","grid2");
      var pm=fld("Method","select","Zelle",[["Zelle","Zelle"],["Cash","Cash"],["Check","Check"],["Other","Other"]]),pdt=fld("Date received","date",today());pg.appendChild(pm);pg.appendChild(pdt);pay.appendChild(pg);
      var pb=btn("Mark paid","btn",function(){var when=(pdt.input.value||today())+"T12:00:00";sb.from("invoices").update({status:"paid",paid_at:when,paid_method:pm.input.value}).eq("id",inv.id).then(function(r2_){if(r2_.error){alert("Could not save.");return}inv.status="paid";inv.paid_at=when;inv.paid_method=pm.input.value;render();openInvoice(inv.id)})});pb.style.marginTop="8px";pay.appendChild(pb);
    }else if(inv.status==="paid"){
      pay.appendChild(el("div","note","Paid "+(inv.paid_at?dshort(String(inv.paid_at).slice(0,10)):"")+(inv.paid_method?" by "+inv.paid_method:"")));
      pay.appendChild(btn("Mark unpaid","btn alt sm",function(){sb.from("invoices").update({status:"open",paid_at:null,paid_method:""}).eq("id",inv.id).then(function(r2_){if(r2_.error){alert("Could not save.");return}inv.status="open";inv.paid_at=null;inv.paid_method="";render();openInvoice(inv.id)})}));
    }
    var dz=el("div","actions");dz.appendChild(el("span"));
    if(inv.status!=="void")dz.appendChild(btn("Void invoice","btn danger",function(){if(!confirm("Void this invoice? Its visits go back to 'To bill' so you can bill them again."))return;releaseVisits(inv,function(){sb.from("invoices").update({status:"void"}).eq("id",inv.id).then(function(){inv.status="void";render();openInvoice(inv.id)})})}));
    else dz.appendChild(btn("Delete","btn danger",function(){if(!confirm("Delete this voided invoice for good?"))return;sb.from("invoices").delete().eq("id",inv.id).then(function(r2_){if(r2_.error){alert("Could not delete.");return}invoices=invoices.filter(function(z){return z.id!==inv.id});closeDetail();render()})}));
    body.appendChild(pay);body.appendChild(dz)})}
function setTotal(inv,total,cb){sb.from("invoices").update({total:total}).eq("id",inv.id).then(function(r){if(r.error){alert("Could not update the total.");return}inv.total=total;render();cb()})}
function removeLine(inv,it,cb){
  sb.from("invoice_items").delete().eq("id",it.id).then(function(r){
    if(r.error){alert("Could not remove the line.");return}
    var after=function(){setTotal(inv,r2(Number(inv.total)-Number(it.amount)),function(){loadUnbilled().then(cb)})};
    if(it.visit_id)sb.from("visits").update({invoice_id:null}).eq("id",it.visit_id).then(after);else after()})}
function releaseVisits(inv,cb){sb.from("visits").update({invoice_id:null}).eq("invoice_id",inv.id).then(function(r){if(r.error){alert("Could not release the visits.");return}loadUnbilled().then(cb)})}
function markSent(inv){if(inv.sent_at)return;var now=new Date().toISOString();sb.from("invoices").update({sent_at:now}).eq("id",inv.id).then(function(r){if(!r.error){inv.sent_at=now;render()}})}
function invMessage(inv,c){
  var first=String((c&&c.name)||"").split(" ")[0]||"there";
  return"Hi "+first+", this is "+bizv("name","Latta Corp")+". Your invoice "+invNum(inv.number)+(inv.period_end?" for "+monthName(inv.period_end):"")+" is "+money(inv.total)+", due "+dshort(inv.due_date)+"."+(inv.share_token?" View or print it here: "+docUrl(inv.share_token)+" ":"")+(bizv("zelle","")?" Pay with Zelle: "+biz.zelle+".":"")+" Thank you!"}

/* ---- printable invoice (works as a PDF too) ---- */
function showInvoice(inv,items){
  var c=byId(clients,inv.client_id)||{},paper=$("invpaper"),addrs=[];
  items.forEach(function(it){if(it.address&&addrs.indexOf(it.address)<0)addrs.push(it.address)});
  var rows=items.map(function(it){return"<tr><td>"+esc(it.service_date?dshort(it.service_date):"")+"</td><td>"+esc(it.description)+(it.address?'<div class="sm">'+esc(it.address)+"</div>":"")+'</td><td class="r">'+esc(money(it.amount))+"</td></tr>"}).join("");
  var paidBox=inv.status==="paid"?'<div class="paidstamp">PAID '+esc(inv.paid_at?dshort(String(inv.paid_at).slice(0,10)):"")+(inv.paid_method?" · "+esc(inv.paid_method):"")+"</div>":inv.status==="void"?'<div class="paidstamp void">VOID</div>':"";
  var due=inv.status==="paid"?"Paid":inv.status==="void"?"Void":money(inv.total);
  paper.innerHTML='<div class="ihead"><div class="ibrand"><div class="lg"><img src="../images/logo-tree-header.png" alt=""></div><div><div class="bn">'+esc(bizv("name","LattaCorp of Central Florida"))+'</div><div class="sm">'+[bizv("address",""),bizv("phone",""),bizv("email","")].filter(Boolean).map(esc).join("<br>")+"</div></div></div>"
    +'<div class="it">INVOICE</div></div><div class="body">'
    +'<div class="facts"><div class="fact"><div class="k">Invoice</div><div class="v">'+esc(invNum(inv.number))+'</div></div><div class="fact"><div class="k">Issued</div><div class="v">'+esc(dshort(inv.issue_date))+'</div></div><div class="fact"><div class="k">Due</div><div class="v">'+esc(dshort(inv.due_date))+'</div></div><div class="fact due"><div class="k">'+(inv.status==="open"?"Amount due":"Total")+'</div><div class="v">'+esc(inv.status==="open"?money(inv.total):inv.status==="paid"?money(inv.total):due)+"</div></div></div>"
    +'<div class="bill"><div class="k">Bill to</div><b>'+esc(c.name||"")+"</b>"+(c.company?"<div>"+esc(c.company)+"</div>":"")+(inv.reference?'<div class="sm">Ref: '+esc(inv.reference)+"</div>":"")+(addrs.length?'<div class="sm">Service address'+(addrs.length>1?"es":"")+": "+addrs.map(esc).join("; ")+"</div>":"")+"</div>"
    +'<table class="itab"><thead><tr><th>Date</th><th>Service</th><th class="r">Amount</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td></td><td class="r"><b>Total</b></td><td class="r"><b>'+esc(money(inv.total))+"</b></td></tr></tfoot></table>"+paidBox
    +'<div class="pay"><b>How to pay</b><div>'+(bizv("zelle","")?"Zelle: "+esc(biz.zelle)+"<br>":"")+esc(bizv("payment_note",""))+"</div></div>"
    +'<div class="foot">'+esc(bizv("footer","Thank you!"))+"</div></div>";
  var v=$("invview");v.hidden=false;document.body.classList.add("printing");v.scrollTop=0}
function hideInvoice(){$("invview").hidden=true;document.body.classList.remove("printing")}

/* ---- Estimates (clients open a private link and can accept) ---- */
function estNum(n){var s=String(n||0);while(s.length<4)s="0"+s;return"EST-"+s}
function docUrl(tok,peek){return location.origin+"/d/?t="+tok+(peek?"&p=1":"")}
function estExpired(e){return(e.status==="draft"||e.status==="sent")&&!!e.valid_until&&e.valid_until<today()}
function estOpen(e){return(e.status==="draft"||e.status==="sent")}
function estChip(e){
  if(e.status==="accepted")return el("span","chip won","Accepted");if(e.status==="declined")return el("span","chip lost","Declined");
  if(estExpired(e))return el("span","chip od","Expired");return el("span","chip",e.status==="sent"?(e.viewed_at?"Viewed":"Sent"):"Draft")}
function estMessage(e,c){return"Hi "+firstName(c)+", this is "+bizv("name","Latta Corp")+". Here is your estimate"+(e.title?" for "+e.title:"")+" ("+money(e.total)+"): "+docUrl(e.share_token)+" You can look it over and accept it right on that page. Thank you!"}
function markEstSent(e){if(e.status!=="draft")return;var now=new Date().toISOString();sb.from("estimates").update({status:"sent",sent_at:now}).eq("id",e.id).then(function(r){if(!r.error){e.status="sent";e.sent_at=now;render()}})}
function estRow(e){
  var b=el("button","row client");b.type="button";var l=el("div");
  l.appendChild(el("b",null,estNum(e.number)+" · "+cname(e.client_id)));
  l.appendChild(el("div","sub",[e.title,e.status==="accepted"?"Accepted "+(e.responded_at?dshort(String(e.responded_at).slice(0,10)):""):e.valid_until?"Valid until "+dshort(e.valid_until):""].filter(Boolean).join(" · ")));
  var r=el("div");r.style.textAlign="right";r.appendChild(el("b",null,money(e.total)));r.appendChild(el("div"));r.appendChild(estChip(e));
  b.appendChild(l);b.appendChild(r);b.addEventListener("click",function(){openEstimate(e.id)});return b}
function renderEstimates(list){
  $("topbtns").appendChild(btn("New estimate","btn",function(){openEstimateForm(null)}));
  if(estErr){list.appendChild(el("div","empty","Estimates aren't set up yet. Run the Stage 11 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var set=estimates.filter(function(e){if(!query)return true;return[estNum(e.number),cname(e.client_id),e.title].join(" ").toLowerCase().indexOf(query)>-1});
  if(!set.length){list.appendChild(el("div","empty",estimates.length?"Nothing matches that.":"No estimates yet. Tap New estimate, write it up, and send the client a link they can accept."));return}
  var waiting=set.filter(function(e){return estOpen(e)&&!estExpired(e)}),rest=set.filter(function(e){return waiting.indexOf(e)<0});
  [["Waiting for a response",waiting],["Accepted, declined or expired",rest]].forEach(function(g){
    if(!g[1].length)return;var h=el("div","note",g[0]);h.style.cssText="font-weight:700;margin:12px 0 4px";list.appendChild(h);g[1].forEach(function(e){list.appendChild(estRow(e))})})}
function clientEstimatesSection(c){
  var sec=el("div","sec"),h=el("h3",null,"Estimates");h.appendChild(btn("+ New estimate","btn alt sm",function(){openEstimateForm(c.id)}));sec.appendChild(h);
  var mine=estimates.filter(function(e){return e.client_id===c.id});
  if(!mine.length)sec.appendChild(el("div","note","None yet."));
  mine.slice(0,5).forEach(function(e){var r=el("div","pcard");r.style.cssText="display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer";
    var l=el("div");l.appendChild(el("b",null,estNum(e.number)+" · "+money(e.total)));l.appendChild(el("div","note",e.title||"Estimate"));r.appendChild(l);r.appendChild(estChip(e));r.addEventListener("click",function(){openEstimate(e.id)});sec.appendChild(r)});
  if(mine.length>5)sec.appendChild(el("div","note","+ "+(mine.length-5)+" older estimates in Billing > Estimates."));
  return sec}
function openEstimateForm(cid){
  if(estErr){alert("Run the Stage 11 SQL in Supabase first, then press Refresh.");return}
  var p=panel();p.appendChild(el("h2",null,"New estimate"));
  var list=clients.filter(function(c){return!c.archived||c.id===cid});
  var cs=fld("Client","select",cid||"",[["","Choose a client..."]].concat(list.map(function(c){return[c.id,c.name+(c.company?" · "+c.company:"")]})));
  var ttl=fld("Title (for example: Spring cleanup and mulch)","text",""),scp=fld("Details the client will see (optional)","textarea",""),vd=fld("Valid for (days)","number","30");
  p.appendChild(cs);p.appendChild(ttl);p.appendChild(scp);p.appendChild(vd);
  p.appendChild(el("h3",null,"Lines"));var box=el("div"),rows=[];p.appendChild(box);
  function addRow(){var r=el("div","grid2"),d=fld("Description","text",""),a=fld("Amount ($)","number","");a.input.step="0.01";a.input.inputMode="decimal";r.appendChild(d);r.appendChild(a);box.appendChild(r);rows.push({d:d,a:a})}
  addRow();var more=btn("+ Add another line","btn alt sm",addRow);p.appendChild(more);
  var go=btn("Save estimate","btn",function(){
    if(!cs.input.value){alert("Choose a client.");return}
    var items=[];for(var i=0;i<rows.length;i++){var d=rows[i].d.input.value.trim(),a=parseFloat(rows[i].a.input.value);if(!d&&isNaN(a))continue;if(!d||isNaN(a)){alert("Each line needs a description and an amount.");return}items.push({description:d,amount:a})}
    if(!items.length){alert("Add at least one line.");return}
    var days=parseInt(vd.input.value,10),total=r2(items.reduce(function(s2,x){return s2+x.amount},0));
    go.disabled=true;
    sb.from("estimates").insert({client_id:cs.input.value,title:ttl.input.value.trim(),scope:scp.input.value.trim(),valid_until:days>0?addDays(today(),days):null,total:total}).select().single().then(function(r){
      if(r.error||!r.data){go.disabled=false;alert("Could not save. Did you run the Stage 11 SQL?");return}
      var e=r.data;items.forEach(function(x){x.estimate_id=e.id});
      sb.from("estimate_items").insert(items).then(function(r2_){
        if(r2_.error){sb.from("estimates").delete().eq("id",e.id).then(function(){go.disabled=false;alert("Could not save the lines.")});return}
        estimates.unshift(e);render();openEstimate(e.id)})})});
  go.style.marginTop="14px";p.appendChild(go)}
function openEstimate(id){
  var e=byId(estimates,id);if(!e)return;var c=byId(clients,e.client_id),p=panel();
  p.appendChild(el("h2",null,estNum(e.number)+" · "+cname(e.client_id)));
  var st=e.status==="accepted"?"Accepted":e.status==="declined"?"Declined":estExpired(e)?"Expired":e.status==="sent"?"Sent":"Draft";
  p.appendChild(el("div","note",st+" · issued "+dshort(e.issue_date)+(e.valid_until?" · valid until "+dshort(e.valid_until):"")+(e.sent_at?" · sent "+dshort(String(e.sent_at).slice(0,10)):" · not sent yet")));
  var body=el("div");body.appendChild(el("div","note","Loading..."));p.appendChild(body);
  sb.from("estimate_items").select("*").eq("estimate_id",e.id).order("created_at",{ascending:true}).limit(500).then(function(r){
    var items=r.error?[]:(r.data||[]);body.textContent="";var edit=estOpen(e);
    if(e.status==="accepted"||e.status==="declined"){
      var ans=el("div","pcard",(e.status==="accepted"?"✓ Accepted":"Declined")+(e.response_name?(/^Recorded/.test(e.response_name)?" ("+e.response_name.toLowerCase()+")":" by "+e.response_name):"")+(e.responded_at?" on "+dshort(String(e.responded_at).slice(0,10)):"")+(e.response_note?'. Note: "'+e.response_note+'"':""));ans.style.fontWeight="700";body.appendChild(ans)}
    var ttl=fld("Title","text",e.title||""),scp=fld("Details the client will see","textarea",e.scope||""),vu=fld("Valid until","date",e.valid_until||"");
    if(edit){body.appendChild(ttl);body.appendChild(scp);body.appendChild(vu);
      var sv=btn("Save details","btn alt sm",function(){var row={title:ttl.input.value.trim(),scope:scp.input.value.trim(),valid_until:vu.input.value||null};sb.from("estimates").update(row).eq("id",e.id).then(function(r2_){if(r2_.error){alert("Could not save.");return}e.title=row.title;e.scope=row.scope;e.valid_until=row.valid_until;sv.textContent="Saved";render();setTimeout(function(){sv.textContent="Save details"},1200)})});sv.style.marginBottom="10px";body.appendChild(sv)}
    else{if(e.title)body.appendChild(el("b",null,e.title));if(e.scope){var sc=el("div","note",e.scope);sc.style.whiteSpace="pre-wrap";body.appendChild(sc)}}
    var t=document.createElement("table");t.className="itable";
    items.forEach(function(it){var tr=document.createElement("tr");tr.appendChild(el("td",null,it.description));tr.appendChild(el("td","amt",money(it.amount)));
      if(edit&&items.length>1){var x=el("td");var rm=btn("×","link",function(){sb.from("estimate_items").delete().eq("id",it.id).then(function(r2_){if(r2_.error){alert("Could not remove the line.");return}setEstTotal(e,r2(Number(e.total)-Number(it.amount)),function(){openEstimate(e.id)})})});rm.setAttribute("aria-label","Remove line");rm.style.cssText="font-size:1.2rem;text-decoration:none;color:var(--red)";x.appendChild(rm);tr.appendChild(x)}t.appendChild(tr)});
    body.appendChild(t);body.appendChild(el("div","invtotal","Total "+money(e.total)));
    if(edit){var add=el("div","pcard"),g=el("div","grid2"),dsc=fld("Add a line","text",""),amt=fld("Amount ($)","number","");amt.input.step="0.01";amt.input.inputMode="decimal";g.appendChild(dsc);g.appendChild(amt);add.appendChild(g);
      var ab=btn("Add line","btn alt sm",function(){var a2=parseFloat(amt.input.value);if(!dsc.input.value.trim()||isNaN(a2)){alert("Enter a description and an amount.");return}
        sb.from("estimate_items").insert({estimate_id:e.id,description:dsc.input.value.trim(),amount:a2}).then(function(r2_){if(r2_.error){alert("Could not add the line.");return}setEstTotal(e,r2(Number(e.total)+a2),function(){openEstimate(e.id)})})});ab.style.marginTop="8px";add.appendChild(ab);body.appendChild(add)}
    var acts=el("div","contact");acts.style.marginTop="14px";var msg=estMessage(e,c);
    if(c&&c.email){var a2=el("a","btn","Email estimate");a2.href=mailHref(c.email,"Estimate "+estNum(e.number)+" from "+bizv("name","Latta Corp"),msg);a2.addEventListener("click",function(){markEstSent(e)});acts.appendChild(a2)}
    acts.appendChild(copyBtn("Copy message",msg,false,function(){markEstSent(e)}));acts.appendChild(copyBtn("Copy link",docUrl(e.share_token),false,function(){markEstSent(e)}));
    if(isOwner()&&c&&c.phone){var a1=el("a","btn alt","Text");a1.href=smsHref(c.phone,msg);a1.addEventListener("click",function(){markEstSent(e)});acts.appendChild(a1)}
    var pv=el("a","btn alt","Preview / Print");pv.href=docUrl(e.share_token,true);pv.target="_blank";pv.rel="noopener";acts.appendChild(pv);body.appendChild(acts);
    if(e.viewed_at)body.appendChild(el("div","note","✓ Client opened the link "+ago(e.viewed_at)+"."));else if(e.sent_at)body.appendChild(el("div","note","The client hasn't opened the link yet."));
    var dz=el("div","actions");dz.style.marginTop="14px";
    function setStatus(s2,extra){var row={status:s2};Object.keys(extra||{}).forEach(function(k){row[k]=extra[k]});sb.from("estimates").update(row).eq("id",e.id).then(function(r2_){if(r2_.error){alert("Could not save.");return}Object.keys(row).forEach(function(k){e[k]=row[k]});render();openEstimate(e.id)})}
    if(edit){var sp=el("span");sp.appendChild(btn("Client said yes","btn alt sm",function(){setStatus("accepted",{responded_at:new Date().toISOString(),response_name:"Recorded by our team"})}));sp.appendChild(document.createTextNode(" "));sp.appendChild(btn("Client said no","btn alt sm",function(){setStatus("declined",{responded_at:new Date().toISOString(),response_name:"Recorded by our team"})}));dz.appendChild(sp)}
    else dz.appendChild(btn("Reopen","btn alt sm",function(){setStatus("sent",{responded_at:null,response_name:"",response_note:""})}));
    dz.appendChild(btn("Delete","btn danger",function(){if(!confirm("Delete this estimate for good? Its link stops working."))return;sb.from("estimates").delete().eq("id",e.id).then(function(r2_){if(r2_.error){alert("Could not delete.");return}estimates=estimates.filter(function(z){return z.id!==e.id});closeDetail();render()})}));
    body.appendChild(dz);
    if(e.status==="accepted")body.appendChild(el("div","note","Next: add the work under Jobs for this client so it lands on the schedule."))})}
function setEstTotal(e,total,cb){sb.from("estimates").update({total:total}).eq("id",e.id).then(function(r){if(r.error){alert("Could not update the total.");return}e.total=total;render();cb()})}

/* ---- Inventory: Excel-style sheets with your own categories and columns ---- */
var INV_PRESETS=[["Blank sheet",["Item","Qty","Notes"]],["Equipment",["Item","Qty","Serial number","Condition","Location","Notes"]],["Supplies",["Item","Qty","Unit","Min","Cost","Location"]]];
function invKey(){return"c"+Math.random().toString(36).slice(2,8)}
function invColType(n){return/^(qty|quantity|min|cost|price|count|totals?( for each)?|amount|hours)$/i.test(n)?"number":"text"}
function invCols(c){return Array.isArray(c.columns)?c.columns:[]}
function invRows(c){return invItems.filter(function(r){return r.cat_id===c.id}).sort(function(a,b){return((a.sort||0)-(b.sort||0))||(String(a.created_at)<String(b.created_at)?-1:1)})}
function invVal(r,k){var v=r.data&&r.data[k];return v==null?"":String(v)}
function invNumber(x){var t=String(x==null?"":x).replace(/[$,\s]/g,"");return/^-?\d*\.?\d+$/.test(t)?parseFloat(t):null}
function invHay(c,r){return(c.name+" inventory "+invCols(c).map(function(x){return invVal(r,x.k)}).join(" ")).toLowerCase()}
function invToks(q){return String(q||"").toLowerCase().split(/\s+/).filter(Boolean)}
function invHas(c,r,t){var h=invHay(c,r);return t.every(function(x){return h.indexOf(x)>-1})}
function invTitle(c,r){var cols=invCols(c);for(var i=0;i<cols.length;i++){var v=invVal(r,cols[i].k);if(v)return v}return"(empty row)"}
function invVisible(){return invCats.filter(function(c){return!c.kind})}
/* Colour code per category: 24 distinct colours (12 light with dark text, 12 dark with white text; every pair is at least 6.5:1 contrast). */
var INV_COLORS=[["Yellow","#fde68a","#1f2a1f"],["Orange","#fdba74","#1f2a1f"],["Pink","#f9a8d4","#1f2a1f"],["Lavender","#d8b4fe","#1f2a1f"],["Sky","#93c5fd","#1f2a1f"],["Mint","#86efac","#1f2a1f"],["Aqua","#67e8f9","#1f2a1f"],["Lime","#d9f99d","#1f2a1f"],["Rose","#fecaca","#1f2a1f"],["Sand","#e7d3a7","#1f2a1f"],["Periwinkle","#c7d2fe","#1f2a1f"],["Seafoam","#99f6e4","#1f2a1f"],
["Navy","#1e3a8a","#ffffff"],["Forest","#166534","#ffffff"],["Maroon","#7f1d1d","#ffffff"],["Purple","#581c87","#ffffff"],["Teal","#115e59","#ffffff"],["Brown","#78350f","#ffffff"],["Magenta","#9d174d","#ffffff"],["Slate","#334155","#ffffff"],["Olive","#4d5d0f","#ffffff"],["Red","#b91c1c","#ffffff"],["Indigo","#3730a3","#ffffff"],["Rust","#9a3412","#ffffff"]];
function invPal(name){return INV_COLORS.filter(function(x){return x[0]===name})[0]}
/* Chosen colour if saved, otherwise the first colour nobody else is using (same order every time). */
function invColorMap(){
  var vis=invVisible().slice().sort(function(a,b){return String(a.created_at||"").localeCompare(String(b.created_at||""))||(a.sort||0)-(b.sort||0)}),used={},m={};
  vis.forEach(function(c){if(invPal(c.color)&&!used[c.color]){used[c.color]=1;m[c.id]=invPal(c.color)}});
  vis.forEach(function(c){if(m[c.id])return;var f=INV_COLORS.filter(function(x){return!used[x[0]]})[0]||INV_COLORS[(Object.keys(m).length)%INV_COLORS.length];used[f[0]]=1;m[c.id]=f});
  return m}
function invCol_(c){return invColorMap()[c.id]||INV_COLORS[0]}
function invPaint(node,c){var k=invCol_(c);node.style.background=k[1];node.style.color=k[2];node.style.borderColor=k[1];return node}
function invChip(c){var ch=el("span","invchip",c.name);return invPaint(ch,c)}
/* Save the automatic colours so they never change when a category is added or deleted (needs the Stage 14 column). */
function ensureInvColors(){
  if(!invCats.length||!("color" in invCats[0]))return;var m=invColorMap();
  invVisible().forEach(function(c){if(invPal(c.color))return;var k=m[c.id];if(!k)return;c.color=k[0];sb.from("inventory_cats").update({color:k[0]}).eq("id",c.id).then(function(){})})}
function renderInventory(){
  var tabs=$("tabs");tabs.textContent="";var list=$("list");list.textContent="";
  $("topbtns").appendChild(btn("+ New category","btn",openInvCatForm));
  if(invErr){list.appendChild(el("div","empty","Inventory isn't set up yet. Run the Stage 12 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var vis=invVisible();
  if(!vis.length){list.appendChild(el("div","empty","No inventory yet. Tap New category to start a sheet, for example Equipment, Supplies, or Fuel & Oil."));return}
  if(invCat!=="all"&&!byId(vis,invCat))invCat="all";
  var tb=[];
  function paintTabs(){var on=invToks(invq).length===0;tb.forEach(function(x){x[1].className="tab"+(x[0].id==="all"?"":" ctab")+((x[0].id==="all"?invCat==="all":(on&&x[0].id===invCat))?" on":"")})}
  var ab_=el("button","tab","All inventory");ab_.type="button";ab_.appendChild(el("span",null,"("+invItems.filter(function(r){return vis.some(function(c){return c.id===r.cat_id})}).length+")"));ab_.addEventListener("click",function(){invCat="all";render()});tabs.appendChild(ab_);tb.push([{id:"all"},ab_]);
  vis.forEach(function(c){var n=invItems.filter(function(r){return r.cat_id===c.id}).length,b=el("button","tab",c.name);b.type="button";b.appendChild(el("span",null,"("+n+")"));invPaint(b,c);b.addEventListener("click",function(){invCat=c.id;invq="";render()});tabs.appendChild(b);tb.push([c,b])});
  ensureInvColors();
  var bar=el("div","invbar"),si=document.createElement("input");si.type="search";si.placeholder="Search inventory: items, categories, notes...";si.value=invq;si.setAttribute("aria-label","Search inventory");bar.appendChild(si);
  if(invCat!=="all")bar.appendChild(btn("Sheet settings","btn alt sm",function(){var c=byId(invCats,invCat);if(c)openInvCat(c)}));
  list.appendChild(bar);var body=el("div");list.appendChild(body);
  si.addEventListener("input",function(){invq=si.value;paintTabs();drawInvBody(body)});
  paintTabs();drawInvBody(body)}
function drawInvBody(body){
  body.textContent="";var t=invToks(invq);
  if(invCat==="all"){body.appendChild(invAllGrid(invVisible(),t));return}
  if(t.length){var any=false;
    invVisible().forEach(function(c){var rows=invRows(c).filter(function(r){return invHas(c,r,t)});if(!rows.length)return;any=true;
      var h=el("div",null);h.appendChild(invChip(c));h.appendChild(document.createTextNode(" "+rows.length+" match"+(rows.length>1?"es":"")+" (tap to open this sheet)"));h.style.cssText="font-weight:700;color:var(--forest);margin:14px 0 4px;cursor:pointer";h.addEventListener("click",function(){invCat=c.id;invq="";render()});
      body.appendChild(h);body.appendChild(invGrid(c,rows,true))});
    if(!any)body.appendChild(el("div","empty","Nothing in your inventory matches that."));return}
  var c=byId(invVisible(),invCat);if(c){var hd=el("div","invhead");hd.appendChild(invChip(c));body.appendChild(hd);body.appendChild(invGrid(c,invRows(c),false))}}
/* "All inventory": every item from every category in one sheet. Columns are matched by name; a cell is greyed out when an item's category doesn't have that column. */
function invAllGrid(cats,t){
  var names=[],info={};cats.forEach(function(c){invCols(c).forEach(function(col){var k=col.n.toLowerCase();if(names.indexOf(k)<0){names.push(k);info[k]={n:col.n,t:col.t}}})});
  var rows=[];cats.forEach(function(c){invRows(c).forEach(function(r){if(!t.length||invHas(c,r,t))rows.push([c,r])})});
  var box=el("div"),wrap=el("div","invwrap"),tbl=document.createElement("table");tbl.className="invgrid";
  function cellOf(c,k){return invCols(c).filter(function(x){return x.n.toLowerCase()===k})[0]}
  if(invSort&&invSort.cat==="all"){var sk=invSort.k;rows.sort(function(a,b){var x,y,r;
    if(sk==="__cat"){x=a[0].name.toLowerCase();y=b[0].name.toLowerCase()}else{var ca=cellOf(a[0],sk),cb=cellOf(b[0],sk);x=ca?invVal(a[1],ca.k):"";y=cb?invVal(b[1],cb.k):"";
      if(info[sk].t==="number"){var nx=invNumber(x),ny=invNumber(y);if(nx==null||ny==null)return nx==null&&ny==null?0:(nx==null?1:-1);return invSort.dir*(nx-ny)}x=x.toLowerCase();y=y.toLowerCase()}
    r=x<y?-1:x>y?1:0;return invSort.dir*r})}
  var hr=document.createElement("tr");hr.appendChild(el("th","rn","#"));
  function head(label,k,num){var th=document.createElement("th");if(num)th.className="num";var cur=invSort&&invSort.cat==="all"&&invSort.k===k;
    var b=btn(label+(cur?(invSort.dir>0?" ▲":" ▼"):""),"hcol",function(){invSort=cur?(invSort.dir>0?{cat:"all",k:k,dir:-1}:null):{cat:"all",k:k,dir:1};render()});b.title="Click to sort";th.appendChild(b);hr.appendChild(th)}
  head("Category","__cat",false);names.forEach(function(k){head(info[k].n,k,info[k].t==="number")});hr.appendChild(el("th","xc",""));
  var th_=document.createElement("thead");th_.appendChild(hr);tbl.appendChild(th_);
  var tb=document.createElement("tbody");
  rows.forEach(function(x,ri){var c=x[0],r=x[1],tr=document.createElement("tr");tr.appendChild(el("td","rn",String(ri+1)));
    var cd=document.createElement("td"),cb=btn(c.name,"hcol",function(){invCat=c.id;invq="";render()});cb.title="Open the "+c.name+" sheet";cb.className="hcol invchip";cb.style.cssText="margin:4px 8px;cursor:pointer;font:inherit;font-weight:700";invPaint(cb,c);cd.appendChild(cb);tr.appendChild(cd);
    names.forEach(function(k){var td=document.createElement("td"),col=cellOf(c,k);
      if(!col){td.style.background="#f1f3f0";tr.appendChild(td);return}
      var inp=document.createElement("input");inp.type="text";inp.value=invVal(r,col.k);inp.dataset.v=inp.value;inp.dataset.r=r.id;inp.dataset.k=col.k;inp.dataset.n=k;inp.setAttribute("aria-label",info[k].n);inp.autocomplete="off";if(col.t==="number"){inp.inputMode="decimal";inp.className="num"}
      inp.addEventListener("change",function(){invCommit(inp)});inp.addEventListener("focus",function(){inp.select()});
      inp.addEventListener("keydown",function(e){if(e.key!=="Enter"&&e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;e.preventDefault();
        var all=Array.prototype.slice.call(tbl.querySelectorAll('tbody input[data-n="'+k+'"]')),i=all.indexOf(inp),n=all[e.key==="ArrowUp"?i-1:i+1];if(n)n.focus()});
      td.appendChild(inp);tr.appendChild(td)});
    var xd=el("td","xc"),xb=btn("×","hgear",function(){var has=invCols(c).some(function(col){return invVal(r,col.k)});if(has&&!confirm("Delete this item?"))return;
      sb.from("inventory_items").delete().eq("id",r.id).then(function(res){if(res.error){alert("Could not delete.");return}invItems=invItems.filter(function(z){return z.id!==r.id});render()})});xb.setAttribute("aria-label","Delete row");xb.style.color="var(--red)";xd.appendChild(xb);tr.appendChild(xd);tb.appendChild(tr)});
  tbl.appendChild(tb);
  var tf=document.createElement("tfoot"),fr=document.createElement("tr");fr.appendChild(el("td","rn","Σ"));var ft=el("td","foot","Overall total · "+rows.length+" item"+(rows.length===1?"":"s"));fr.appendChild(ft);for(var i=0;i<names.length;i++)fr.appendChild(el("td","foot",""));fr.appendChild(el("td","xc",""));tf.appendChild(fr);tbl.appendChild(tf);
  wrap.appendChild(tbl);box.appendChild(wrap);
  if(!rows.length)box.appendChild(el("div","empty",t.length?"Nothing in your inventory matches that.":"No items yet. Open a category tab and add a row, or add one below."));
  var acts=el("div","invacts"),sel=document.createElement("select");sel.style.cssText="width:auto";cats.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.name;sel.appendChild(o)});
  acts.appendChild(el("span","note","Add an item to:"));acts.appendChild(sel);acts.appendChild(btn("+ Add row","btn sm",function(){var c=byId(cats,sel.value);if(!c)return;invq="";invCat=c.id;addInvRow(c)}));
  acts.appendChild(el("span","note","Greyed cells mean that category doesn't have that column. Click a category name to open its sheet."));box.appendChild(acts);
  return box}
function invCommit(inp){
  if(inp.value===inp.dataset.v)return Promise.resolve();
  var r=byId(invItems,inp.dataset.r),c=r&&byId(invCats,r.cat_id),col=c&&invCols(c).filter(function(x){return x.k===inp.dataset.k})[0];if(!col)return Promise.resolve();
  var val=inp.value.trim(),d=Object.assign({},r.data),n=invNumber(val);d[col.k]=(col.t==="number"&&n!=null)?n:val;inp.dataset.v=inp.value;
  return sb.from("inventory_items").update({data:d,updated_at:new Date().toISOString()}).eq("id",r.id).then(function(res){
    if(res.error){inp.dataset.v="\u0000";alert("Could not save that cell. Check your connection and try again.");return}
    r.data=d;var t=inp.closest("table");if(t&&t._foot)t._foot()})}
function addInvRow(c,fk){
  var mx=invRows(c).reduce(function(m,r){return Math.max(m,r.sort||0)},0);
  return sb.from("inventory_items").insert({cat_id:c.id,data:{},sort:mx+1}).select().single().then(function(r){
    if(r.error||!r.data){alert("Could not add a row.");return}invItems.push(r.data);invFocus={id:r.data.id,k:fk||(invCols(c)[0]||{}).k};render()})}
function invPaste(c,vr,startRow,startCol,txt){
  var cols=invCols(c),lines=txt.replace(/\r/g,"").replace(/\n$/,"").split("\n").map(function(l){return l.split("\t")}),ci=cols.indexOf(startCol),ri=vr.indexOf(startRow);
  var mx=invRows(c).reduce(function(m,r){return Math.max(m,r.sort||0)},0),ups=[],news=[];
  lines.forEach(function(cells,i){
    var row=vr[ri+i],d=row?Object.assign({},row.data):{};
    cells.forEach(function(v,j){var col=cols[ci+j];if(!col)return;v=v.trim();var n=invNumber(v);d[col.k]=(col.t==="number"&&n!=null)?n:v});
    if(row)ups.push([row,d]);else news.push({cat_id:c.id,data:d,sort:++mx})});
  var jobs_=ups.map(function(u){return sb.from("inventory_items").update({data:u[1],updated_at:new Date().toISOString()}).eq("id",u[0].id).then(function(r){if(!r.error)u[0].data=u[1];return r.error})});
  if(news.length)jobs_.push(sb.from("inventory_items").insert(news).select().then(function(r){if(!r.error&&r.data)r.data.forEach(function(x){invItems.push(x)});return r.error}));
  Promise.all(jobs_).then(function(errs){if(errs.some(Boolean))alert("Some pasted cells could not be saved.");render()})}
function invGrid(c,rows,searching){
  var cols=invCols(c),box=el("div"),wrap=el("div","invwrap"),t=document.createElement("table");t.className="invgrid";
  var vr=rows.slice();
  if(invSort&&invSort.cat===c.id){var sc=cols.filter(function(x){return x.k===invSort.k})[0];
    if(sc)vr.sort(function(a,b){var x=invVal(a,sc.k),y=invVal(b,sc.k),r;
      if(sc.t==="number"){var nx=invNumber(x),ny=invNumber(y);r=nx==null&&ny==null?0:nx==null?1:ny==null?-1:nx-ny;if(nx==null||ny==null)return r}
      else{x=x.toLowerCase();y=y.toLowerCase();r=x<y?-1:x>y?1:0}
      return invSort.dir*r})}
  var hr=document.createElement("tr");hr.appendChild(el("th","rn","#"));
  cols.forEach(function(col){var th=document.createElement("th"),cur=invSort&&invSort.cat===c.id&&invSort.k===col.k;if(col.t==="number")th.className="num";
    var sbtn=btn(col.n+(cur?(invSort.dir>0?" ▲":" ▼"):""),"hcol",function(){invSort=cur?(invSort.dir>0?{cat:c.id,k:col.k,dir:-1}:null):{cat:c.id,k:col.k,dir:1};render()});sbtn.title="Click to sort";th.appendChild(sbtn);
    var g=btn("⋯","hgear",function(){openInvCol(c,col)});g.setAttribute("aria-label","Column settings: "+col.n);g.title="Column settings";th.appendChild(g);hr.appendChild(th)});
  hr.appendChild(el("th","xc",""));var th_=document.createElement("thead");th_.appendChild(hr);t.appendChild(th_);
  var qtyCol=cols.filter(function(x){return/^(qty|quantity)$/i.test(x.n)})[0],minCol=cols.filter(function(x){return/^min/i.test(x.n)})[0];
  var tb=document.createElement("tbody");
  vr.forEach(function(r,ri){
    var tr=document.createElement("tr");tr.appendChild(el("td","rn",String(ri+1)));
    cols.forEach(function(col){
      var td=document.createElement("td"),inp=document.createElement("input");inp.type="text";inp.value=invVal(r,col.k);inp.dataset.v=inp.value;inp.dataset.r=r.id;inp.dataset.k=col.k;inp.setAttribute("aria-label",col.n);inp.autocomplete="off";
      if(col.t==="number"){inp.inputMode="decimal";inp.className="num"}
      if(qtyCol&&minCol&&col.k===qtyCol.k){var q=invNumber(invVal(r,qtyCol.k)),m=invNumber(invVal(r,minCol.k));if(q!=null&&m!=null&&q<=m){inp.className+=" low";inp.title="At or below the minimum"}}
      inp.addEventListener("change",function(){invCommit(inp)});
      inp.addEventListener("focus",function(){inp.select()});
      inp.addEventListener("keydown",function(e){
        if(e.key!=="Enter"&&e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;e.preventDefault();
        var trs=t.querySelectorAll("tbody tr"),idx=Array.prototype.indexOf.call(trs,tr),nr=trs[e.key==="ArrowUp"?idx-1:idx+1];
        if(nr){var ni=nr.querySelector('input[data-k="'+col.k+'"]');if(ni)ni.focus();return}
        if(e.key==="Enter"&&!searching)Promise.resolve(invCommit(inp)).then(function(){addInvRow(c,col.k)})});
      inp.addEventListener("paste",function(e){var txt=(e.clipboardData||window.clipboardData).getData("text")||"";if(!/[\t\n]/.test(txt.replace(/\r?\n$/,"")))return;e.preventDefault();invPaste(c,vr,r,col,txt)});
      td.appendChild(inp);tr.appendChild(td)});
    var xd=el("td","xc"),x=btn("×","hgear",function(){
      var has=cols.some(function(col){return invVal(r,col.k)});if(has&&!confirm("Delete this row?"))return;
      sb.from("inventory_items").delete().eq("id",r.id).then(function(res){if(res.error){alert("Could not delete the row.");return}invItems=invItems.filter(function(z){return z.id!==r.id});render()})});
    x.setAttribute("aria-label","Delete row");x.title="Delete row";x.style.color="var(--red)";xd.appendChild(x);tr.appendChild(xd);tb.appendChild(tr)});
  t.appendChild(tb);
  var tf=document.createElement("tfoot"),fr=document.createElement("tr"),fc={};fr.appendChild(el("td","rn","Σ"));
  cols.forEach(function(col){var td=document.createElement("td");td.className="foot"+(col.t==="number"?" num":"");fc[col.k]=td;fr.appendChild(td)});fr.appendChild(el("td","xc",""));tf.appendChild(fr);t.appendChild(tf);
  t._foot=function(){cols.forEach(function(col,i){var td=fc[col.k];
    if(col.t==="number"){var sum=0,n=0;vr.forEach(function(r){var v=invNumber(invVal(r,col.k));if(v!=null){sum+=v;n++}});td.textContent=n?String(Math.round(sum*100)/100):""}
    else td.textContent=i===0?"Overall total · "+vr.length+" row"+(vr.length===1?"":"s"):""})};t._foot();
  wrap.appendChild(t);box.appendChild(wrap);
  if(!searching){
    var acts=el("div","invacts");acts.appendChild(btn("+ Add row","btn sm",function(){addInvRow(c)}));acts.appendChild(btn("+ Add column","btn alt sm",function(){openInvCol(c,null)}));
    acts.appendChild(el("span","note","Tip: press Enter to move down (and add a row at the bottom), or paste straight from Excel or Google Sheets."));box.appendChild(acts)}
  if(invFocus){var f=invFocus;invFocus=null;setTimeout(function(){var i=t.querySelector('input[data-r="'+f.id+'"][data-k="'+f.k+'"]');if(i)i.focus()},0)}
  return box}
function saveCols(c,cols){sb.from("inventory_cats").update({columns:cols}).eq("id",c.id).then(function(r){if(r.error){alert("Could not save.");return}c.columns=cols;closeDetail();render()})}
function openInvCol(c,col){
  var p=panel(),cols=invCols(c).slice(),isNew=!col;
  p.appendChild(el("h2",null,isNew?"Add a column":"Column settings"));
  var nm=fld("Column name","text",isNew?"":col.n),ty=fld("Type (number columns get a total at the bottom)","select",isNew?"text":col.t,[["text","Text"],["number","Number"]]);p.appendChild(nm);p.appendChild(ty);
  var sv=btn(isNew?"Add column":"Save","btn",function(){
    var n=nm.input.value.trim();if(!n){alert("Give the column a name.");return}
    if(cols.some(function(x){return x!==col&&x.n.toLowerCase()===n.toLowerCase()})){alert("You already have a column with that name.");return}
    if(isNew)cols.push({k:invKey(),n:n,t:ty.input.value});else cols[cols.indexOf(col)]={k:col.k,n:n,t:ty.input.value};
    saveCols(c,cols)});sv.style.marginTop="10px";p.appendChild(sv);
  if(!isNew){
    var i=cols.indexOf(col),mv=el("div","contact");mv.style.marginTop="14px";
    function move(d){var a=cols.slice(),x=a.splice(i,1)[0];a.splice(i+d,0,x);saveCols(c,a)}
    if(i>0)mv.appendChild(btn("← Move left","btn alt sm",function(){move(-1)}));if(i<cols.length-1)mv.appendChild(btn("Move right →","btn alt sm",function(){move(1)}));p.appendChild(mv);
    if(cols.length>1){var dz=el("div","actions");dz.style.marginTop="18px";dz.appendChild(el("span"));dz.appendChild(btn("Delete column","btn danger",function(){if(!confirm('Delete the "'+col.n+'" column? Its values are removed from view.'))return;saveCols(c,cols.filter(function(x){return x!==col}))}));p.appendChild(dz)}}}
function makeSheet(name,pre,kind){
  var cols=pre[1].map(function(x){return{k:invKey(),n:x,t:invColType(x)}}),mx=invCats.reduce(function(m,x){return Math.max(m,x.sort||0)},0);
  return sb.from("inventory_cats").insert(kind?{name:name,columns:cols,sort:mx+1,kind:kind}:{name:name,columns:cols,sort:mx+1}).select().single().then(function(r){
    if(r.error||!r.data)return Promise.reject("Could not create it. Did you run the Stage 12"+(kind?" and Stage 13":"")+" SQL?");
    var cat=r.data;invCats.push(cat);
    var rows=(pre[2]||[]).map(function(vals,i){var d={};vals.forEach(function(v,j){if(v)d[cols[j].k]=v});return{cat_id:cat.id,data:d,sort:i+1}});
    if(!rows.length)return cat;
    return sb.from("inventory_items").insert(rows).select().then(function(r2_){if(r2_.error)return Promise.reject("The sheet was made but its starting rows could not be added.");(r2_.data||[]).forEach(function(x){invItems.push(x)});return cat})})}
function openInvCatForm(){
  if(invErr){alert("Run the Stage 12 SQL in Supabase first, then press Refresh.");return}
  var p=panel();p.appendChild(el("h2",null,"New category"));p.appendChild(el("p","note","A category is a sheet, like a tab in Excel. You can add, rename and reorder columns afterwards."));
  var nm=fld("Category name (for example: Equipment, Chemicals, Fuel & Oil)","text",""),st=fld("Start with","select","1",INV_PRESETS.map(function(x,i){return[String(i),x[0]+" ("+x[1].join(", ")+")"]}));p.appendChild(nm);p.appendChild(st);
  var go=btn("Create category","btn",function(){var n=nm.input.value.trim();if(!n){alert("Give the category a name.");return}
    if(invCats.some(function(x){return x.name.toLowerCase()===n.toLowerCase()})){alert("You already have a category with that name.");return}
    go.disabled=true;makeSheet(n,INV_PRESETS[parseInt(st.input.value,10)]).then(function(c){invCat=c.id;invq="";closeDetail();render()},function(msg){go.disabled=false;alert(msg)})});
  go.style.marginTop="12px";p.appendChild(go)}
function openInvCat(c){
  var p=panel();p.appendChild(el("h2",null,c.name+" · sheet settings"));
  var nm=fld("Category name","text",c.name);p.appendChild(nm);
  var sv=btn("Rename","btn alt sm",function(){var n=nm.input.value.trim();if(!n){alert("Give it a name.");return}sb.from("inventory_cats").update({name:n}).eq("id",c.id).then(function(r){if(r.error){alert("Could not save.");return}c.name=n;closeDetail();render()})});sv.style.marginTop="6px";p.appendChild(sv);
  var cl=el("div",null);cl.style.marginTop="16px";cl.appendChild(el("div","note","Colour code (shown on the tab and in the All inventory sheet)"));var used={};invVisible().forEach(function(z){if(z.id!==c.id)used[invCol_(z)[0]]=1});var sw=el("div","swatches"),cur=invCol_(c)[0];
  INV_COLORS.forEach(function(k){var b=el("button","sw"+(k[0]===cur?" on":""),"Aa");b.type="button";b.style.background=k[1];b.style.color=k[2];b.title=k[0]+(used[k[0]]?" (already used by another category)":"");b.setAttribute("aria-label",k[0]);if(used[k[0]])b.style.opacity=".45";
    b.addEventListener("click",function(){if(used[k[0]]&&!confirm("Another category already uses "+k[0]+". Use it for both?"))return;sb.from("inventory_cats").update({color:k[0]}).eq("id",c.id).then(function(r){if(r.error){alert("Could not save the colour. Run the Stage 14 SQL in Supabase first.");return}c.color=k[0];closeDetail();render()})});sw.appendChild(b)});
  cl.appendChild(sw);p.appendChild(cl);
  var ex=btn("Download as CSV (opens in Excel)","btn alt",function(){var cols=invCols(c);downloadCsv("inventory-"+c.name.replace(/[^\w-]+/g,"_")+".csv",[cols.map(function(x){return x.n})].concat(invRows(c).map(function(r){return cols.map(function(x){return invVal(r,x.k)})})))});ex.style.cssText="display:block;margin-top:16px";p.appendChild(ex);
  var n=invItems.filter(function(r){return r.cat_id===c.id}).length,dz=el("div","actions");dz.style.marginTop="22px";dz.appendChild(el("span"));
  dz.appendChild(btn("Delete category","btn danger",function(){if(!confirm('Delete "'+c.name+'" and its '+n+" row"+(n===1?"":"s")+" for good?"))return;sb.from("inventory_cats").delete().eq("id",c.id).then(function(r){if(r.error){alert("Could not delete.");return}invCats=invCats.filter(function(x){return x.id!==c.id});invItems=invItems.filter(function(x){return x.cat_id!==c.id});invCat=null;closeDetail();render()})}));p.appendChild(dz)}

/* ---- billing settings ---- */
function openBizSettings(){
  var p=panel();p.appendChild(el("h2",null,"Billing settings"));p.appendChild(el("p","note","This is what appears on every invoice and in the text or email message."));
  var f={name:fld("Business name","text",bizv("name","")),phone:fld("Phone","tel",bizv("phone","")),email:fld("Email","email",bizv("email","")),address:fld("Mailing address (optional)","text",bizv("address","")),
    zelle:fld("Zelle info (for example: the phone number or email you receive Zelle on)","text",bizv("zelle","")),payment_note:fld("Other payment note","text",bizv("payment_note","")),
    terms_days:fld("Payment due within (days after the invoice date; 0 = due on receipt)","number",bizv("terms_days",10)),footer:fld("Thank-you line at the bottom","text",bizv("footer",""))};
  Object.keys(f).forEach(function(k){p.appendChild(f[k])});
  var s=btn("Save","btn",function(){
    var row={id:1};Object.keys(f).forEach(function(k){row[k]=k==="terms_days"?(parseInt(f[k].input.value,10)||0):f[k].input.value.trim()});
    s.disabled=true;sb.from("business").upsert(row).select().single().then(function(r){s.disabled=false;if(r.error||!r.data){alert("Could not save. Did you run the Stage 5 SQL?");return}biz=r.data;closeDetail();render()})});
  s.style.marginTop="14px";p.appendChild(s)}

/* ---- billing on the client page ---- */
function clientBillingSection(c){
  var sec=el("div","sec"),h=el("h3",null,"Billing");sec.appendChild(h);
  if(billErr){sec.appendChild(el("div","note","Run the Stage 5 SQL in Supabase to turn on billing."));return sec}
  var mine=invoices.filter(function(i){return i.client_id===c.id}),bal=openTotal(mine),od=mine.filter(isOverdue).length,ub=unbilled.filter(function(v){return v.client_id===c.id&&Number(v.price)>0});
  var ubt=r2(ub.reduce(function(s,v){return s+Number(v.price||0)},0));
  var sm=el("div","note",[bal?"Balance due "+money(bal)+(od?" ("+od+" overdue)":""):"Nothing owed",ubt?money(ubt)+" not yet billed":""].filter(Boolean).join(" · "));sm.style.fontWeight="700";sec.appendChild(sm);
  if(ub.length){var cb=btn("Create invoice for completed visits ("+ub.length+")","btn alt sm",function(){cb.disabled=true;createInvoice(c.id,ub,today()).then(function(inv){return loadUnbilled().then(function(){render();openInvoice(inv.id)})},function(e){cb.disabled=false;alert(e)})});cb.style.margin="6px 0";sec.appendChild(cb)}
  mine.slice(0,8).forEach(function(i){var r=el("div","pcard");r.style.cssText="display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer";
    var l=el("div");l.appendChild(el("b",null,invNum(i.number)+" · "+money(i.total)));l.appendChild(el("div","note",(i.period_end?monthName(i.period_end)+" · ":"")+(i.status==="paid"?"Paid":i.status==="void"?"Void":"Due "+dshort(i.due_date))));
    r.appendChild(l);r.appendChild(el("span","chip "+(i.status==="paid"?"won":i.status==="void"?"lost":isOverdue(i)?"od":""),i.status==="paid"?"Paid":i.status==="void"?"Void":isOverdue(i)?"Overdue":"Open"));r.addEventListener("click",function(){openInvoice(i.id)});sec.appendChild(r)});
  if(mine.length>8)sec.appendChild(el("div","note","+ "+(mine.length-8)+" older invoices in the Billing tab."));
  return sec}

})();

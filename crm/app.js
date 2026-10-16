(function(){
"use strict";
var cfg=window.CRM_CONFIG,sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
var STATUSES=[["new","New"],["contacted","Contacted"],["quoted","Quoted"],["won","Won"],["lost","Lost"]];
var TYPES=[["residential","Residential"],["hoa","HOA"],["commercial","Commercial"]];
var leads=[],clients=[],props=[],clientsErr=false,services=[],jobs=[],visits=[],jobsErr=false;
var view="leads",lfilter="all",cfilter="active",jfilter="active",smode="day",selDate=today(),crewF="all",query="";
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
  if(dg){["Call","Text"].forEach(function(t){var a=el("a","btn alt",t);a.href=(t==="Call"?"tel:":"sms:")+dg;c.appendChild(a)})}
  if(email){var m=el("a","btn alt","Email");m.href="mailto:"+email;c.appendChild(m)}
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
  var done=false;function go(me){if(done)return;done=true;if(me)startCrewApp(me);else start()}
  try{sb.rpc("crew_me").then(function(r){go(r&&!r.error&&r.data&&r.data.length?r.data[0]:null)},function(){go(null)})}catch(e){go(null)}}

/* ---- data ---- */
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
    sb.from("visits").select("*").eq("status","done").is("invoice_id",null).is("paid_at",null).limit(5000)
  ]).then(function(rs){
    if(rs[0].error){$("msg").textContent="Could not load leads. If you just signed in, make sure this email is on the staff list.";return}
    leads=rs[0].data||[];
    clientsErr=!!(rs[1].error||rs[2].error);
    clients=rs[1].error?[]:(rs[1].data||[]);props=rs[2].error?[]:(rs[2].data||[]);
    jobsErr=!!(rs[3].error||rs[4].error||rs[5].error||clientsErr);
    services=rs[3].error?[]:(rs[3].data||[]);jobs=rs[4].error?[]:(rs[4].data||[]);visits=rs[5].error?[]:(rs[5].data||[]);histFrom=addDays(today(),-45);s3=!rs[6].error;crew=rs[6].error?[]:(rs[6].data||[]);
    billErr=!!(rs[7].error||rs[9].error||jobsErr);invoices=rs[7].error?[]:(rs[7].data||[]);biz=rs[8].error?null:((rs[8].data||[])[0]||null);unbilled=rs[9].error?[]:(rs[9].data||[]);
    render();topUp().then(function(n){if(n)render()});
  });
}

/* ---- main screen ---- */
var ICONS={leads:'<svg viewBox="0 0 24 24"><path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13"/><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2.5 2.5 0 0 1-5 0z"/></svg>',
 clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
 jobs:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
 billing:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
 schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'};
function render(){
  var nav=$("side");nav.textContent="";
  var tdy=today(),stops=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date===tdy}).length,newL=leads.filter(function(l){return l.status==="new"}).length;
  [["leads","Leads",newL],["clients","Clients",0],["jobs","Jobs",0],["schedule","Schedule",stops],["billing","Billing",invoices.filter(isOverdue).length]].forEach(function(v){
    var b=el("button",v[0]===view?"on":"");b.type="button";b.addEventListener("click",function(){view=v[0];render()});b.innerHTML=ICONS[v[0]];b.appendChild(el("span",null,v[1]));
    if(v[2])b.appendChild(el("span","badge",String(v[2])));b.setAttribute("aria-current",v[0]===view?"page":"false");nav.appendChild(b)});
  $("topbtns").textContent="";
  if(view==="leads")renderLeads();else if(view==="clients")renderClients();else if(view==="jobs")renderJobs();else if(view==="billing")renderBilling();else renderSchedule();
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
  var gs=$("gs"),res=$("gres");
  function toks(q){return q.toLowerCase().split(/\s+/).filter(Boolean)}
  function all(hay,t){hay=hay.toLowerCase();var dig=hay.replace(/\D/g,"");return t.every(function(x){return hay.indexOf(x)>-1||(/^\d{3,}$/.test(x)&&dig.indexOf(x)>-1)})}
  function sec(title,items,make){if(!items.length)return;res.appendChild(el("h4",null,title));items.slice(0,8).forEach(function(it){var m=make(it),b=document.createElement("button");b.type="button";b.appendChild(el("b",null,m[0]));if(m[1])b.appendChild(el("span",null,m[1]));b.addEventListener("click",function(){close();gs.value="";m[2]()});res.appendChild(b)})}
  function close(){res.classList.remove("on");res.textContent=""}
  function run(){
    var t=toks(gs.value);res.textContent="";if(!t.length){close();return}
    var cl=clients.filter(function(c){return all([c.name,c.company,c.phone,c.phone2,c.email,clientProps(c.id).map(function(p){return p.address}).join(" ")].join(" "),t)});
    var jb=jobs.filter(function(j){var sv=byId(services,j.service_id);return all([j.title,sv?sv.name:"",cname(j.client_id),paddr(j.property_id),flabel(j.frequency)].join(" "),t)});
    var ld=leads.filter(function(l){return all([l.name,l.email,l.phone,l.address,l.service,l.kind].join(" "),t)});
    sec("Clients",cl,function(c){var ps=clientProps(c.id);return[c.name+(c.company?" · "+c.company:""),[ps[0]&&ps[0].address,c.phone].filter(Boolean).join(" · "),function(){openClient(c.id)}]});
    sec("Jobs",jb,function(j){return[cname(j.client_id)+" · "+j.title,[paddr(j.property_id),flabel(j.frequency),money(j.price),j.status!=="active"?j.status:""].filter(Boolean).join(" · "),function(){openJob(j.id)}]});
    var iv=billErr?[]:invoices.filter(function(i){return all([invNum(i.number),String(i.number),cname(i.client_id),i.reference||""].join(" "),t)});
    sec("Invoices",iv,function(i){return[invNum(i.number)+" · "+cname(i.client_id),[money(i.total),i.status==="paid"?"Paid":i.status==="void"?"Void":"Due "+dshort(i.due_date),i.reference].filter(Boolean).join(" · "),function(){openInvoice(i.id)}]});
    sec("Leads",ld,function(l){return[l.name||"(no name)",[l.kind,l.service,l.address].filter(Boolean).join(" · "),function(){openLead(l.id)}]});
    if(!res.firstChild)res.appendChild(el("div","none","No matches."));
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
    visitDates(j).forEach(function(d){
      if(visits.some(function(v){return v.job_id===j.id&&v.orig_date===d}))return;
      var row={job_id:j.id,client_id:j.client_id,property_id:j.property_id,orig_date:d,scheduled_date:d,status:"scheduled",price:j.price};if(s3)row.crew_id=j.crew_id||null;rows.push(row)})});
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
  top.appendChild(l);
  if(v.status!=="scheduled")top.appendChild(el("span","chip "+(v.status==="done"?"won":"lost"),v.status==="done"?"Done":"Skipped"));
  card.appendChild(top);
  var a=el("div","acts");
  function patch(p,cb){
    function fin(){if(!billErr&&(p.status!==undefined||p.paid_at!==undefined))loadUnbilled().then(after);else after()}
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
      a.appendChild(btn("Skip","btn alt sm",function(){patch({status:"skipped"})}));
      a.appendChild(btn("Move","btn alt sm",function(){
        a.textContent="";var di=document.createElement("input");di.type="date";di.value=v.scheduled_date;di.style.width="auto";a.appendChild(di);
        a.appendChild(btn("Save date","btn sm",function(){if(!di.value)return;patch({scheduled_date:di.value})}));a.appendChild(btn("Cancel","btn alt sm",btns))}));
    }else{
      if(!v.invoice_id&&!v.paid_at)a.appendChild(btn("Undo","btn alt sm",function(){patch({status:"scheduled",completed_at:null})}));
      if(!billErr&&v.status==="done"){
        if(v.invoice_id){var oi=el("span","note","On an invoice");oi.style.alignSelf="center";a.appendChild(oi)}
        else if(v.paid_at){var pn=el("span","chip won","Paid"+(v.paid_method?" · "+v.paid_method:""));pn.style.alignSelf="center";a.appendChild(pn);a.appendChild(btn("Undo paid","btn alt sm",function(){patch({paid_at:null,paid_method:""})}))}
        else{var pl=el("span","note","Paid at visit:");pl.style.alignSelf="center";a.appendChild(pl);["Cash","Zelle","Check"].forEach(function(m){a.appendChild(btn(m,"btn alt sm",function(){patch({paid_at:new Date().toISOString(),paid_method:m})}))})}
      }
    }
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
  if(s3)$("topbtns").appendChild(btn("Crew","btn alt",openCrew));
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
  var all=onDay(d).filter(crewOk).sort(dayOrder),sched=all.filter(function(v){return v.status==="scheduled"});
  if(!all.length){list.appendChild(el("div","empty","Nothing scheduled for this day."));return}
  var done=all.filter(function(v){return v.status==="done"}).length,total=all.reduce(function(s,v){return s+(v.status==="skipped"?0:Number(v.price||0))},0);
  var sum=el("div","daysum");sum.appendChild(el("b",null,all.length+" stop"+(all.length>1?"s":"")+" · "+money(total)+(done?" · "+done+" done":"")));
  var bt=el("span");
  if(sched.length){
    var ru=routeUrl(sched);if(ru){var a=el("a","btn sm","Start route");a.href=ru;a.target="_blank";a.rel="noopener";bt.appendChild(a);bt.appendChild(document.createTextNode(" "))}
    if(s3){bt.appendChild(btn("Send route","btn alt sm",function(){openSendRoute(d)}));bt.appendChild(document.createTextNode(" "))}
    bt.appendChild(btn("Push to next day","btn alt sm",function(){pushDay(d,onDay(d).filter(function(v){return v.status==="scheduled"}).length)}))}
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
function pushDay(d,n){
  if(!confirm("Move all "+n+" scheduled stop"+(n>1?"s":"")+" on "+dlabel(d)+" to "+dlabel(addDays(d,1))+"? (Good for rain days.)"))return;
  sb.from("visits").update({scheduled_date:addDays(d,1)}).eq("scheduled_date",d).eq("status","scheduled").then(function(r){
    if(r.error){alert("Could not move them.");return}loadVisits().then(render)})}

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
function callCrewApi(action,payload){
  return sb.auth.getSession().then(function(r){
    var t=r.data&&r.data.session&&r.data.session.access_token;
    return fetch("/api/crew-login",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+t},body:JSON.stringify(Object.assign({action:action},payload))})
      .then(function(res){return res.json().catch(function(){return{}}).then(function(j){return{ok:res.ok,error:j.error||("Error "+res.status)}})},function(){return{ok:false,error:"Could not reach the server."}})})}
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
  [["tobill","To bill",bg.order.length],["open","Open",op.length],["paid","Paid",pd_.length]].forEach(function(s){
    var b=el("button","tab"+(bfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){bfilter=s[0];render()});tabs.appendChild(b)});
  $("topbtns").appendChild(btn("Billing settings","btn alt",openBizSettings));
  var list=$("list");list.textContent="";
  if(billErr){list.appendChild(el("div","empty","Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."));return}
  var mon=today().slice(0,7),paidMonth=r2(pd_.filter(function(i){return i.paid_at&&String(i.paid_at).slice(0,7)===mon}).reduce(function(s,i){return s+Number(i.total||0)},0));
  var stats=el("div","stats");
  [["Outstanding",money(openTotal(invoices)),""],["Overdue",money(openTotal(od)),od.length?"bad":""],["Ready to bill",money(r2(eligible().reduce(function(s,v){return s+Number(v.price||0)},0))),""],["Paid this month",money(paidMonth),""]].forEach(function(x){
    var c=el("div","stat "+x[2]);c.appendChild(el("span",null,x[0]));c.appendChild(el("b",null,x[1]));stats.appendChild(c)});
  list.appendChild(stats);
  if(bfilter==="tobill")return renderToBill(list,bg);
  var set=(bfilter==="open"?op.slice().sort(function(a,b){return a.due_date<b.due_date?-1:1}):pd_).filter(function(i){
    if(!query)return true;return[invNum(i.number),i.number,cname(i.client_id),i.reference].join(" ").toLowerCase().indexOf(query)>-1});
  if(!set.length){list.appendChild(el("div","empty",bfilter==="open"?"No open invoices.":"No paid invoices yet."));return}
  set.forEach(function(i){list.appendChild(invoiceRow(i))})}
function invoiceRow(i){
  var b=el("button","row client"+(isOverdue(i)?" overdue":""));b.type="button";var l=el("div");
  l.appendChild(el("b",null,invNum(i.number)+" · "+cname(i.client_id)));
  l.appendChild(el("div","sub",[i.period_end?monthName(i.period_end):"",i.status==="paid"?"Paid "+(i.paid_at?dshort(String(i.paid_at).slice(0,10)):"")+(i.paid_method?" ("+i.paid_method+")":""):"Due "+dshort(i.due_date),i.reference?"Ref "+i.reference:""].filter(Boolean).join(" · ")));
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
    if(c&&c.phone){var a1=el("a","btn alt","Text");a1.href=smsHref(c.phone,msg);a1.addEventListener("click",function(){markSent(inv)});acts.appendChild(a1)}
    if(c&&c.email){var a2=el("a","btn alt","Email");a2.href="mailto:"+encodeURIComponent(c.email).replace("%40","@")+"?subject="+encodeURIComponent("Invoice "+invNum(inv.number)+" from Latta Corp")+"&body="+encodeURIComponent(msg+"\n\n(The invoice PDF is attached.)");a2.addEventListener("click",function(){markSent(inv)});acts.appendChild(a2)}
    body.appendChild(acts);
    if(c&&(!c.phone||!c.email))body.appendChild(el("div","note","Tip: add a "+(!c.phone?"phone number":"email")+" on the client page to get "+(!c.phone?"a Text":"an Email")+" button here. To email the PDF: tap View / Print / PDF, choose Save as PDF, then attach it."));
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
  return"Hi "+first+", this is "+bizv("name","Latta Corp")+". Your invoice "+invNum(inv.number)+(inv.period_end?" for "+monthName(inv.period_end):"")+" is "+money(inv.total)+", due "+dshort(inv.due_date)+"."+(bizv("zelle","")?" Pay with Zelle: "+biz.zelle+".":"")+" Thank you!"}

/* ---- printable invoice (works as a PDF too) ---- */
function showInvoice(inv,items){
  var c=byId(clients,inv.client_id)||{},paper=$("invpaper"),addrs=[];
  items.forEach(function(it){if(it.address&&addrs.indexOf(it.address)<0)addrs.push(it.address)});
  var rows=items.map(function(it){return"<tr><td>"+esc(it.service_date?dshort(it.service_date):"")+"</td><td>"+esc(it.description)+(it.address?'<div class="sm">'+esc(it.address)+"</div>":"")+'</td><td class="r">'+esc(money(it.amount))+"</td></tr>"}).join("");
  var paidBox=inv.status==="paid"?'<div class="paidstamp">PAID '+esc(inv.paid_at?dshort(String(inv.paid_at).slice(0,10)):"")+(inv.paid_method?" · "+esc(inv.paid_method):"")+"</div>":inv.status==="void"?'<div class="paidstamp void">VOID</div>':"";
  paper.innerHTML='<div class="ihead"><div class="ibrand"><img src="../images/logo-tree-header.png" alt=""><div><div class="bn">'+esc(bizv("name","LattaCorp of Central Florida"))+'</div><div class="sm">'+[bizv("address",""),bizv("phone",""),bizv("email","")].filter(Boolean).map(esc).join("<br>")+'</div></div></div>'
    +'<div class="imeta"><div class="it">INVOICE</div><div><b>'+esc(invNum(inv.number))+'</b></div><div class="sm">Issued '+esc(dshort(inv.issue_date))+"<br>Due "+esc(dshort(inv.due_date))+(inv.reference?"<br>Ref: "+esc(inv.reference):"")+"</div></div></div>"
    +'<div class="bill"><div class="sm">BILL TO</div><b>'+esc(c.name||"")+"</b>"+(c.company?"<div>"+esc(c.company)+"</div>":"")+(addrs.length?'<div class="sm">Service address'+(addrs.length>1?"es":"")+": "+addrs.map(esc).join("; ")+"</div>":"")+"</div>"
    +'<table class="itab"><thead><tr><th>Date</th><th>Service</th><th class="r">Amount</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td></td><td class="r"><b>Total due</b></td><td class="r"><b>'+esc(money(inv.total))+"</b></td></tr></tfoot></table>"+paidBox
    +'<div class="pay"><b>How to pay</b><div>'+(bizv("zelle","")?"Zelle: "+esc(biz.zelle)+"<br>":"")+esc(bizv("payment_note",""))+"</div></div>"
    +'<div class="foot">'+esc(bizv("footer","Thank you!"))+"</div>";
  var v=$("invview");v.hidden=false;document.body.classList.add("printing");v.scrollTop=0}
function hideInvoice(){$("invview").hidden=true;document.body.classList.remove("printing")}

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

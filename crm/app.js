(function(){
"use strict";
var cfg=window.CRM_CONFIG,sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
var STATUSES=[["new","New"],["contacted","Contacted"],["quoted","Quoted"],["won","Won"],["lost","Lost"]];
var TYPES=[["residential","Residential"],["hoa","HOA"],["commercial","Commercial"]];
var leads=[],clients=[],props=[],clientsErr=false,services=[],jobs=[],visits=[],jobsErr=false;
var view="leads",lfilter="all",cfilter="active",jfilter="active",sfilter="upcoming",query="";
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
    start();
  });
});
$("signout").addEventListener("click",function(){sb.auth.signOut().then(function(){location.reload()})});
$("refresh").addEventListener("click",load);
function start(){$("gsearch").hidden=false;$("loginwrap").hidden=true;$("layout").hidden=false;$("signout").hidden=false;$("refresh").hidden=false;load()}
sb.auth.getSession().then(function(r){if(r.data&&r.data.session)start()});

/* ---- data ---- */
function load(){
  $("msg").textContent="";
  Promise.all([
    sb.from("leads").select("*").order("created_at",{ascending:false}).limit(1000),
    sb.from("clients").select("*").order("name",{ascending:true}).limit(5000),
    sb.from("properties").select("*").order("created_at",{ascending:true}).limit(10000),
    sb.from("services").select("*").order("name",{ascending:true}).limit(500),
    sb.from("jobs").select("*").order("created_at",{ascending:true}).limit(5000),
    sb.from("visits").select("*").gte("scheduled_date",addDays(today(),-45)).order("scheduled_date",{ascending:true}).limit(5000)
  ]).then(function(rs){
    if(rs[0].error){$("msg").textContent="Could not load leads. If you just signed in, make sure this email is on the staff list.";return}
    leads=rs[0].data||[];
    clientsErr=!!(rs[1].error||rs[2].error);
    clients=rs[1].error?[]:(rs[1].data||[]);props=rs[2].error?[]:(rs[2].data||[]);
    jobsErr=!!(rs[3].error||rs[4].error||rs[5].error||clientsErr);
    services=rs[3].error?[]:(rs[3].data||[]);jobs=rs[4].error?[]:(rs[4].data||[]);visits=rs[5].error?[]:(rs[5].data||[]);
    render();topUp().then(function(n){if(n)render()});
  });
}

/* ---- main screen ---- */
var ICONS={leads:'<svg viewBox="0 0 24 24"><path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13"/><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2.5 2.5 0 0 1-5 0z"/></svg>',
 clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
 jobs:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
 schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'};
function render(){
  var nav=$("side");nav.textContent="";
  var tdy=today(),stops=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date===tdy}).length,newL=leads.filter(function(l){return l.status==="new"}).length;
  [["leads","Leads",newL],["clients","Clients",0],["jobs","Jobs",0],["schedule","Schedule",stops]].forEach(function(v){
    var b=el("button",v[0]===view?"on":"");b.type="button";b.addEventListener("click",function(){view=v[0];render()});b.innerHTML=ICONS[v[0]];b.appendChild(el("span",null,v[1]));
    if(v[2])b.appendChild(el("span","badge",String(v[2])));b.setAttribute("aria-current",v[0]===view?"page":"false");nav.appendChild(b)});
  $("topbtns").textContent="";
  if(view==="leads")renderLeads();else if(view==="clients")renderClients();else if(view==="jobs")renderJobs();else renderSchedule();
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
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeDetail()});

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
  /* leads */
  var ls=leads.filter(function(l){return l.client_id===c.id});
  if(ls.length){var s2=el("div","sec");s2.appendChild(el("h3",null,"Requests from the website"));
    ls.forEach(function(l){var r=el("div","pcard");r.appendChild(el("b",null,l.kind+" · "+label(l.status)));r.appendChild(el("div","note",new Date(l.created_at).toLocaleDateString()+(l.service?" · "+l.service:"")));r.appendChild(btn("Open","btn alt sm",function(){openLead(l.id)})).style.marginTop="6px";s2.appendChild(r)});p.appendChild(s2)}
  var d=el("div","actions");d.appendChild(el("span"));
  d.appendChild(btn("Delete client","btn danger",function(){if(!confirm("Delete this client and all their properties for good? (Archive keeps the history.)"))return;sb.from("clients").delete().eq("id",c.id).then(function(r){if(r.error){alert("Could not delete.");return}clients=clients.filter(function(z){return z.id!==c.id});props=props.filter(function(z){return z.client_id!==c.id});leads.forEach(function(l){if(l.client_id===c.id)l.client_id=null});closeDetail();render()})}));
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
  return sb.from("visits").select("*").gte("scheduled_date",addDays(today(),-45)).order("scheduled_date",{ascending:true}).limit(5000).then(function(r){if(!r.error)visits=r.data||[]})}
function visitDates(job){
  var t=today(),end=addDays(t,56);
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
      rows.push({job_id:j.id,client_id:j.client_id,property_id:j.property_id,orig_date:d,scheduled_date:d,status:"scheduled",price:j.price})})});
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
function visitCard(v,after,showJob){
  var j=byId(jobs,v.job_id),card=el("div","pcard"),top=el("div");top.style.cssText="display:flex;justify-content:space-between;gap:8px";
  var l=el("div");l.appendChild(el("b",null,cname(v.client_id)+(j?" · "+j.title:"")));l.appendChild(el("div","note",[paddr(v.property_id),money(v.price)].filter(Boolean).join(" · ")));
  if(v.status!=="scheduled"||showJob===false)l.appendChild(el("div","note",dshort(v.scheduled_date)));
  top.appendChild(l);
  if(v.status!=="scheduled")top.appendChild(el("span","chip "+(v.status==="done"?"won":"lost"),v.status==="done"?"Done":"Skipped"));
  card.appendChild(top);
  var a=el("div","acts");
  function patch(p,cb){
    sb.from("visits").update(p).eq("id",v.id).then(function(r){
      if(r.error){alert("Could not save that.");return}
      Object.assign(v,p);
      if(j&&j.frequency==="once"&&(p.status==="done"||p.status==="skipped")&&j.status==="active"){sb.from("jobs").update({status:"ended"}).eq("id",j.id).then(function(){j.status="ended";after()});return}
      if(j&&j.frequency==="once"&&p.status==="scheduled"&&j.status==="ended"){sb.from("jobs").update({status:"active"}).eq("id",j.id).then(function(){j.status="active";after()});return}
      after()})}
  function btns(){
    a.textContent="";
    if(v.status==="scheduled"){
      a.appendChild(btn("Done","btn sm",function(){patch({status:"done",completed_at:new Date().toISOString()})}));
      a.appendChild(btn("Skip","btn alt sm",function(){patch({status:"skipped"})}));
      a.appendChild(btn("Move","btn alt sm",function(){
        a.textContent="";var di=document.createElement("input");di.type="date";di.value=v.scheduled_date;di.style.width="auto";a.appendChild(di);
        a.appendChild(btn("Save date","btn sm",function(){if(!di.value)return;patch({scheduled_date:di.value})}));a.appendChild(btn("Cancel","btn alt sm",btns))}));
    }else a.appendChild(btn("Undo","btn alt sm",function(){patch({status:"scheduled",completed_at:null})}));
    var pr=byId(props,v.property_id);
    if(pr){var m=el("a","btn alt sm","Map");m.href=mapsUrl(pr.address);m.target="_blank";m.rel="noopener";a.appendChild(m)}
    if(showJob!==false&&j)a.appendChild(btn("Job","btn alt sm",function(){openJob(j.id)}))}
  btns();card.appendChild(a);return card}

/* ---- Schedule (agenda) ---- */
function renderSchedule(){
  var tabs=$("tabs");tabs.textContent="";var t=today();
  var up=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date>=t}),od=visits.filter(function(v){return v.status==="scheduled"&&v.scheduled_date<t}),dn=visits.filter(function(v){return v.status!=="scheduled"});
  [["upcoming","Upcoming",up.length],["overdue","Overdue",od.length],["done","Done",dn.length]].forEach(function(s){
    var b=el("button","tab"+(sfilter===s[0]?" on":""),s[1]);b.type="button";b.appendChild(el("span",null,"("+s[2]+")"));b.addEventListener("click",function(){sfilter=s[0];render()});tabs.appendChild(b)});
  var list=$("list");list.textContent="";
  if(jobsErr){list.appendChild(el("div","empty","The schedule isn't set up yet. Run the Stage 2 SQL in Supabase, then press Refresh."));return}
  var set=sfilter==="upcoming"?up:sfilter==="overdue"?od:dn;
  set=set.filter(function(v){if(!query)return true;var j=byId(jobs,v.job_id);return[cname(v.client_id),paddr(v.property_id),j?j.title:""].join(" ").toLowerCase().indexOf(query)>-1});
  set.sort(function(a,b){return sfilter==="done"?(a.scheduled_date<b.scheduled_date?1:-1):(a.scheduled_date<b.scheduled_date?-1:1)});
  if(sfilter==="done")set=set.slice(0,150);
  if(!set.length){list.appendChild(el("div","empty",sfilter==="upcoming"?"Nothing scheduled. Add a job to a client and its visits appear here.":sfilter==="overdue"?"Nothing overdue. Nice.":"No completed visits yet."));return}
  var groups={},order=[];set.forEach(function(v){if(!groups[v.scheduled_date]){groups[v.scheduled_date]=[];order.push(v.scheduled_date)}groups[v.scheduled_date].push(v)});
  order.forEach(function(d){
    var g=groups[d],box=el("div"),h=el("h3",null,dlabel(d)+"  ·  "+g.length+" stop"+(g.length>1?"s":"")+"  ·  "+money(g.reduce(function(s,v){return s+Number(v.price||0)},0)));
    h.style.cssText="margin:14px 0 6px;font-size:.98rem;color:var(--forest);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";
    if(sfilter!=="done"){h.appendChild(btn("Push to next day","btn alt sm",function(){pushDay(d,g.length)}))}
    box.appendChild(h);g.forEach(function(v){box.appendChild(visitCard(v,function(){render()}))});list.appendChild(box)})}
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
  var lastSvc=sv.input.value;
  sv.input.addEventListener("change",function(){var s=byId(services,sv.input.value),old=byId(services,lastSvc);
    if(s){if(!ti.input.value.trim()||(old&&ti.input.value===old.name))ti.input.value=s.name;if((!pr.input.value||Number(pr.input.value)===0||(old&&Number(pr.input.value)===Number(old.default_price)))&&s.default_price!=null)pr.input.value=s.default_price}
    lastSvc=sv.input.value});
  fq.input.addEventListener("change",function(){ed.hidden=fq.input.value==="once"});ed.hidden=fq.input.value==="once";
  p.appendChild(cs);p.appendChild(ps);p.appendChild(sv);p.appendChild(ti);
  var g=el("div","grid2");g.appendChild(pr);g.appendChild(fq);g.appendChild(sd);g.appendChild(ed);p.appendChild(g);p.appendChild(ins);
  var a=el("div","actions");
  var save=btn("Save job","btn",function(){
    if(!ps.input.value){alert("This client needs a property first. Add one on the client page.");return}
    if(!ti.input.value.trim()){alert("Enter a job name.");return}
    if(!sd.input.value){alert("Pick a start date.");return}
    var price=parseFloat(pr.input.value);if(isNaN(price)||price<0){alert("Enter the price per visit (0 if unknown).");return}
    var once=fq.input.value==="once";
    var row={client_id:cs.input.value,property_id:ps.input.value,service_id:sv.input.value||null,title:ti.input.value.trim(),price:price,frequency:fq.input.value,start_date:sd.input.value,end_date:(!once&&ed.input.value)?ed.input.value:null,instructions:ins.input.value.trim()};
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
      else fut=sb.from("visits").update({price:job.price,property_id:job.property_id}).eq("job_id",job.id).eq("status","scheduled").gte("scheduled_date",today());
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
})();

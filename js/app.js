// Site behavior: page routing, language switch, forms, gallery lightbox, header details.

var lang="en";try{if(localStorage.getItem("lang")==="es")lang="es"}catch(e){}
function t(x){return lang==="es"&&ES[x]?ES[x]:x}

function esc(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;")}
function drawDetail(kind,key){var d=(kind==="a"?AR:SV)[key];if(!d)return false;var h='<div class="band tband"><div class="wrap"><h1>'+esc(d.t)+'</h1><p>'+esc(d.lead)+'</p></div></div><section><div class="wrap"><a class="back" href="#/services">&larr; Back to Services</a><div class="dgrid"><div class="dtext">';
if(kind==="a"){h+='<h2>About this area</h2><p>'+esc(d.body)+'</p><h2>What we do here</h2><ul>';Object.keys(SVN).forEach(function(k){h+='<li><a href="#/services/'+k+'">'+esc(SVN[k])+'</a></li>'});h+='</ul><p><a href="'+d.extra[1]+'">'+esc(d.extra[0])+'</a></p>'}
else{h+='<h2>What\'s included</h2><ul>'+d.inc.map(function(x){return'<li>'+esc(x)+'</li>'}).join("")+'</ul><h2>Good to know</h2><ul>'+d.know.map(function(x){return'<li>'+esc(x)+'</li>'}).join("")+'</ul>'}
h+='<div class="cta"><a class="btn" href="#/services/quote">Get a quote</a><a class="btn alt" href="tel:4074705309">Call or text 407-470-5309</a></div></div><div class="dimg"><img data-img="'+d.img+'" width="1400" height="1050" alt=""></div></div></div></section>';
h+='<section class="mint"><div class="wrap"><h2>'+(kind==="a"?"Our services":"Related services")+'</h2><div class="chips">';
if(kind==="a"){Object.keys(SVN).forEach(function(k){h+='<a href="#/services/'+k+'">'+esc(SVN[k])+'</a>'})}else{d.rel.forEach(function(k){h+='<a href="#/services/'+k+'">'+esc(SVN[k])+'</a>'})}
h+='</div><h2 style="margin-top:28px">Other areas we serve</h2><div class="chips">';Object.keys(AR).forEach(function(k){if(!(kind==="a"&&k===key))h+='<a href="#/services/areas/'+k+'">'+esc(AR[k].t)+'</a>'});
h+='</div></div></section>';
var b=document.getElementById("dbody");b.innerHTML=h;[].forEach.call(b.querySelectorAll("img[data-img]"),function(i){i.src=IMG[i.getAttribute("data-img")]});
document.title=t(d.title)+" | Latta Corp";if(lang==="es"){walkText();walkAttrs()}return true}

function setHoa(k){var v=HV[k],b=document.querySelector("#hoa .band .wrap");b.innerHTML="<h1></h1><p></p>";b.firstChild.textContent=v.h;b.lastChild.textContent=v.p;
function li(a){return"<ul>"+a.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+"</ul>"}
var tail=(k==="hoa"||k==="property-managers")?' <a href="#/community">Service Requests</a>.':' <a href="tel:4074705309">407-470-5309</a>.';
var h='<div class="svcbox"><h2>'+esc(v.bt)+'</h2><p>'+esc(v.bp)+'</p>'+li(v.bl)+'<p class="res">'+esc(HRES)+'</p><p>'+esc(v.br)+tail+'</p></div>'
+'<h2>'+esc(v.wt)+'</h2>'+li(v.wl)+'<h2>'+esc(v.jt)+'</h2>'+li(v.jl)+'<h2>'+esc(v.pt)+'</h2><p>'+esc(v.pp)+(v.pl?' <a href="#/services">See our maintenance plans</a>.':'')+'</p><h2>Coverage</h2><p>'+esc(v.cv||HCOV)+'</p>'
+'<div class="cta"><a class="btn alt" href="tel:4074705309">Call or text 407-470-5309</a><a class="btn alt" href="#/portfolio">See our work</a></div><div class="pnote"><b>Client Portal</b> <span class="soon">Coming Soon!</span><p>Track your requests online. <a href="#/portal">Learn more</a></p></div>';
document.getElementById("hdt").innerHTML=h;
var sel=document.querySelector("#hf select");if(sel&&!sel.dataset.manual){[].forEach.call(sel.options,function(o){if(o.text===v.r)sel.value=o.value||o.text})}
if(lang==="es"){walkText()}document.title=t(v.t)+" | Latta Corp"}
function closeDd(){var d=document.querySelector(".dd");if(d){d.classList.remove("open");document.getElementById("ddb").setAttribute("aria-expanded","false")}}
document.getElementById("ddb").addEventListener("click",function(e){e.stopPropagation();var d=this.parentNode,o=!d.classList.contains("open");d.classList.toggle("open",o);this.setAttribute("aria-expanded",o?"true":"false")});
document.addEventListener("click",function(e){if(!e.target.closest(".dd"))closeDd();else if(e.target.closest(".ddm a")){closeDd();if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()}});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeDd()});
window.addEventListener("hashchange",closeDd);
function route(){var h=location.hash||"#/",hv=h.match(/^#\/services\/(hoa|property-managers|landlords|commercial)\/?$/),ishoa=!!hv,dm=h.match(/^#\/services\/(areas\/)?([a-z-]+)$/),dk=!ishoa&&dm&&drawDetail(dm[1]?"a":"s",dm[2]),pg=ishoa?"hoa":dk?"detail":h.indexOf("/portal")>-1?"portal":h.indexOf("/community")>-1?"community":h.indexOf("/faqs")>-1?"faqs":h.indexOf("/about")>-1?"about":h.indexOf("/career")>-1?"career":h.indexOf("/portfolio")>-1?"portfolio":h.indexOf("/contact")>-1?"contact":h.indexOf("/services")>-1?"services":"home";
["home","services","portfolio","career","about","contact","community","faqs","detail","hoa","portal"].forEach(function(id){document.getElementById(id).classList.toggle("on",id===pg);var n=(id==="detail"||id==="hoa")?(pg===id?document.getElementById("n-services"):null):document.getElementById("n-"+id);if(n){if(pg===id)n.setAttribute("aria-current","page");else n.removeAttribute("aria-current")}});
[].slice.call(document.querySelectorAll("#ddm a")).forEach(function(a){var on=pg==="hoa"?a.getAttribute("href")==="#/services/"+hv[1]:(pg==="services"&&a.getAttribute("href")==="#/services");if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
if(pg==="hoa"){setHoa(hv[1])}else if(pg!=="detail")document.title=lang==="es"?"Latta Corp of Central Florida | Cuidado de césped en Kissimmee, FL":"Latta Corp of Central Florida | Lawn Care in Kissimmee, FL";if(h.indexOf("quote")>-1){setTimeout(function(){document.getElementById("quote").scrollIntoView()},0)}else{window.scrollTo(0,0)}}
window.addEventListener("hashchange",route);route();
function showDisc(){var v=document.getElementById("svc").value,d=document.getElementById("disc");d.textContent=T[v]?t(T[v]):"";d.classList.toggle("on",!!T[v])}
document.getElementById("svc").addEventListener("change",function(e){var d=document.getElementById("disc");showDisc()});


var tr=t;var sv=document.getElementById("svcs"),curList=NODOG;
function build(list){var keep=[].slice.call(sv.querySelectorAll("input:checked")).map(function(i){return i.value});sv.innerHTML="";sv.style.setProperty("--rows",Math.ceil(list.length/2));
list.forEach(function(n){var l=document.createElement("label");l.className="chk";var t=TIPS[n];if(t)l.setAttribute("data-t",tr(t));l.innerHTML='<input type="checkbox" value="'+n+'"'+(keep.indexOf(n)>-1?" checked":"")+'> '+tr(n)+(t?' <span class="i" aria-hidden="true">i</span><span class="sr">('+tr(t)+')</span>':'');sv.appendChild(l);
if(n==="Other"){l.classList.add("oth");var ti=document.createElement("span");ti.className="tipi";ti.id="legtip";ti.tabIndex=0;ti.textContent="i";ti.setAttribute("role","note");ti.setAttribute("aria-label",tr(LEG));ti.setAttribute("data-tip",tr(LEG));ti.addEventListener("click",function(e){e.preventDefault()});l.appendChild(ti)}})}
build(NODOG);
function showBox(id,on,html){var b=document.getElementById(id);if(html!==undefined)b.innerHTML=html;b.classList.toggle("on",on)}
function refresh(){var c=document.getElementById("comm").value,inc=CONTRACT[c]||null,list=LISTS[c]||NODOG;if(list!==curList){build(list);curList=list}var isCmd=c==="Commander at Shingle Creek Reserve";var showO=isCmd||c==="Shingle Creek Reserve";document.getElementById("legtip").classList.toggle("on",showO);[].forEach.call(sv.querySelectorAll("label[data-t]"),function(l){if(isCmd||ALWAYS[l.querySelector("input").value])l.setAttribute("data-tip",l.getAttribute("data-t"));else l.removeAttribute("data-tip")});

var flagged=[].some.call(sv.querySelectorAll("input:checked"),function(i){var l=i.parentNode;return l.hasAttribute("data-tip")||(showO&&l.classList.contains("oth"))});var ack=document.getElementById("ack");document.getElementById("ackrow").style.display=flagged?"flex":"none";ack.required=flagged;if(!flagged)ack.checked=false}
document.getElementById("comm").addEventListener("change",refresh);sv.addEventListener("change",refresh);



function walkText(){var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;while(n=w.nextNode()){var p=n.parentNode;if(p.closest&&p.closest("#svcs,script,style"))continue;if(n._o===undefined)n._o=n.data;var k=n._o.trim();n.data=(lang==="es"&&k&&ES[k])?n._o.replace(k,function(){return ES[k]}):n._o}}
function walkAttrs(){["placeholder","aria-label","alt"].forEach(function(a){[].forEach.call(document.querySelectorAll("["+a+"]"),function(e){if(e.id==="langsw"||e.closest("#svcs"))return;var key="_o_"+a;if(e[key]===undefined)e[key]=e.getAttribute(a);e.setAttribute(a,lang==="es"&&ES[e[key]]?ES[e[key]]:e[key])})})}
function applyLang(){document.documentElement.lang=lang;walkText();walkAttrs();build(curList);refresh();showDisc();
var sw=document.getElementById("langsw");sw.setAttribute("aria-checked",lang==="es"?"true":"false");sw.setAttribute("aria-label",lang==="es"?ES["Switch to English"]:"Switch to Spanish");
document.getElementById("l-en").classList.toggle("on",lang==="en");document.getElementById("l-es").classList.toggle("on",lang==="es");renderPlan()}
document.getElementById("langsw").addEventListener("click",function(){lang=lang==="es"?"en":"es";try{localStorage.setItem("lang",lang)}catch(e){}applyLang()});

[].forEach.call(document.querySelectorAll("img[data-img]"),function(i){i.src=IMG[i.getAttribute("data-img")]});
var pbs=[].slice.call(document.querySelectorAll(".pfb")),lcur=0,lb=document.getElementById("lb"),lbi=document.getElementById("lbi"),lbc=document.getElementById("lbc"),lfocus=null;
function showLb(i){lcur=(i+pbs.length)%pbs.length;var im=pbs[lcur].querySelector("img");lbi.src=im.src;lbi.alt=im.alt;lbc.textContent=im.alt}
function closeLb(){lb.classList.remove("on");if(lfocus)lfocus.focus()}
pbs.forEach(function(b,i){b.addEventListener("click",function(){lfocus=b;lb.classList.add("on");showLb(i);document.getElementById("lbx").focus()})});
document.getElementById("lbx").addEventListener("click",closeLb);document.getElementById("lbp").addEventListener("click",function(){showLb(lcur-1)});document.getElementById("lbnx").addEventListener("click",function(){showLb(lcur+1)});
lb.addEventListener("click",function(e){if(e.target===lb)closeLb()});
document.addEventListener("keydown",function(e){if(!lb.classList.contains("on"))return;if(e.key==="Escape")closeLb();else if(e.key==="ArrowLeft")showLb(lcur-1);else if(e.key==="ArrowRight")showLb(lcur+1)});
if(lang==="es")applyLang();

document.querySelectorAll(".brand").forEach(function(a){a.addEventListener("click",function(){if((location.hash||"#/")==="#/")window.scrollTo(0,0)})});

document.getElementById("dlapp").addEventListener("click",function(e){
if(!(window.claude&&claude.use))return;e.preventDefault();
claude.use("downloads").then(function(d){
if(!d){location.href="assets/LattaCorp_Job_Application.pdf";return}
return fetch("assets/LattaCorp_Job_Application.pdf").then(function(r){return r.blob()}).then(function(b){return d.save({filename:"LattaCorp_Job_Application.pdf",data:b})});
}).catch(function(){});
});

var plan=null,freq="Weekly";
function renderPlan(){var sv=document.getElementById("svc").value==="Lawn maintenance";
document.getElementById("planw").style.display=sv?"grid":"none";document.getElementById("freqw").style.display=sv?"grid":"none";
document.getElementById("plansel").value=plan||"";document.getElementById("freqsel").value=freq||"";
Array.prototype.forEach.call(document.querySelectorAll(".tier"),function(c){c.classList.toggle("on",c.getAttribute("data-plan")===plan)});
Array.prototype.forEach.call(document.querySelectorAll(".freq button"),function(x){var on=x.getAttribute("data-f")===freq;x.classList.toggle("on",on);x.setAttribute("aria-checked",on?"true":"false")})}
Array.prototype.forEach.call(document.querySelectorAll(".freq button"),function(x){x.addEventListener("click",function(){freq=x.getAttribute("data-f");renderPlan()})});
Array.prototype.forEach.call(document.querySelectorAll(".tier .pick"),function(x){x.addEventListener("click",function(){plan=x.parentNode.getAttribute("data-plan");document.getElementById("svc").value="Lawn maintenance";showDisc();renderPlan();document.getElementById("quote").scrollIntoView({behavior:"smooth"})})});
document.getElementById("plansel").addEventListener("change",function(e){plan=e.target.value||null;renderPlan()});
document.getElementById("freqsel").addEventListener("change",function(e){freq=e.target.value||null;renderPlan()});
document.getElementById("svc").addEventListener("change",renderPlan);
renderPlan();
document.getElementById("seeplans").addEventListener("click",function(e){e.preventDefault();document.getElementById("plans").scrollIntoView({behavior:"smooth",block:"start"})});
var phs=[];
function renderPh(){var box=document.getElementById("pthumbs");box.innerHTML="";phs.forEach(function(o,ix){var d=document.createElement("div");d.className="pth";var im=document.createElement("img");im.src=o.u;im.alt="";var x=document.createElement("button");x.type="button";x.textContent="\u00d7";x.setAttribute("aria-label","Remove photo");x.addEventListener("click",function(){URL.revokeObjectURL(o.u);phs.splice(ix,1);renderPh()});d.appendChild(im);d.appendChild(x);box.appendChild(d)});walkAttrs()}
document.getElementById("phb").addEventListener("click",function(){document.getElementById("phin").click()});
document.getElementById("phin").addEventListener("change",function(e){var over=false;[].forEach.call(e.target.files,function(f){if(f.type.indexOf("image/")!==0)return;if(phs.length>=8||f.size>10485760){over=true;return}phs.push({f:f,u:URL.createObjectURL(f)})});e.target.value="";document.getElementById("phn").style.display=over?"inline":"none";renderPh()});
function placeArrows(){var lb=document.getElementById("lb");if(!lb.classList.contains("on"))return;var r=lbi.getBoundingClientRect();if(!r.width)return;var p=document.getElementById("lbp"),n=document.getElementById("lbnx"),w=44,g=10,vw=document.documentElement.clientWidth;
p.style.left=Math.max(6,r.left-w-g)+"px";n.style.right="auto";n.style.left=Math.min(vw-w-6,r.right+g)+"px"}
lbi.addEventListener("load",placeArrows);window.addEventListener("resize",placeArrows);
new MutationObserver(function(){requestAnimationFrame(placeArrows)}).observe(document.getElementById("lb"),{attributes:true,attributeFilter:["class"]});
[].forEach.call(document.querySelectorAll("a[data-social]"),function(a){a.addEventListener("click",function(e){e.preventDefault()})});
function dots(){document.querySelectorAll("header .hnav").forEach(function(n){var l=[].slice.call(n.querySelectorAll("a")).filter(function(a){return!a.closest(".ddm")});if(n.tagName!=="NAV"&&n.querySelector("nav"))l=[].slice.call(n.querySelectorAll("nav a")).filter(function(a){return!a.closest(".ddm")});for(var i=1;i<l.length;i++){l[i].style.setProperty("--dx",(((l[i-1].closest(".dd")||l[i-1]).getBoundingClientRect().right-l[i].getBoundingClientRect().left)/2)+"px")}})}
window.addEventListener("resize",dots);window.addEventListener("hashchange",function(){setTimeout(dots,0)});window.addEventListener("load",dots);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(dots);setTimeout(dots,300);

[["qf","t-qf"],["cf","t-cf"],["ctf","t-ctf"]].forEach(function(a){var f=document.getElementById(a[0]),t=document.getElementById(a[1]);
f.addEventListener("submit",function(e){submitForm(f,t,e)});
t.querySelector("[data-again]").addEventListener("click",function(){f.reset();t.style.display="none";f.style.display="";var x=f.querySelector("input,select,textarea");if(x)x.focus()})});
[["hf","t-hf"]].forEach(function(a){var f=document.getElementById(a[0]),t=document.getElementById(a[1]);f.addEventListener("submit",function(e){submitForm(f,t,e)});t.querySelector("[data-again]").addEventListener("click",function(){f.reset();t.style.display="none";f.style.display="";var x=f.querySelector("input,select,textarea");if(x)x.focus()})});
document.querySelector("#hf select").addEventListener("change",function(){this.dataset.manual="1"});
document.getElementById("hf").addEventListener("reset",function(){var sl=this.querySelector("select");if(sl)delete sl.dataset.manual});

// Form sending: collects a form's answers (and photos), sends them to /api/submit, then shows the thank-you message.
// In the claude.ai preview (or when opened as a file) nothing is sent and the thank-you message is shown as a demo.
var FORM_LIVE=(location.protocol==="http:"||location.protocol==="https:")&&!/claude|localhost|127\.0\.0\.1/.test(location.hostname)||/[?&]live\b/.test(location.search);
if(FORM_LIVE)document.documentElement.classList.add("live");
var FORM_KINDS={qf:"Quote request",cf:"Service request",ctf:"Contact message",hf:"Proposal request"};
function formLabel(el){
  var lab=el.closest("label");
  if(lab){var c=lab.cloneNode(true);[].forEach.call(c.querySelectorAll("input,select,textarea,a,small,.ptt"),function(n){n.remove()});var s=c.textContent.replace(/\s+/g," ").replace(/\s*\*$/,"").trim();if(s)return s}
  return el.getAttribute("aria-label")||el.getAttribute("placeholder")||el.name||"Field";
}
function formCollect(f){
  var out=[],groups={};
  [].forEach.call(f.querySelectorAll("input,select,textarea"),function(el){
    if(el.type==="file"||el.type==="hidden"||el.type==="submit"||el.name==="lc_trap_7")return;
    if(el.type==="checkbox"){
      if(!el.checked)return;
      var fs=el.closest("fieldset"),key=fs?(fs.querySelector("legend")||{}).textContent||"Options":formLabel(el);
      var txt=el.value&&el.value!=="on"?el.value:(el.closest("label")?el.closest("label").textContent.replace(/\s+/g," ").trim():"Yes");
      if(!fs){out.push({label:key,value:"Yes"});return}
      (groups[key]=groups[key]||[]).push(txt);return}
    var v=(el.value||"").trim();if(!v)return;
    out.push({label:formLabel(el),value:v});
  });
  Object.keys(groups).forEach(function(k){out.push({label:k.trim(),value:groups[k].join(", ")})});
  return out;
}
function formPhotos(f){
  if(f.id==="qf")return phs.map(function(o){return o.f});
  var inp=f.querySelector('input[type=file]'),r=[];
  if(inp)[].forEach.call(inp.files,function(x){if(x.type.indexOf("image/")===0)r.push(x)});
  return r.slice(0,8);
}
function shrinkImage(file){
  return new Promise(function(res){
    if(!window.createImageBitmap||file.type==="image/gif"){res(file);return}
    createImageBitmap(file).then(function(bm){
      var max=1600,sc=Math.min(1,max/Math.max(bm.width,bm.height)),w=Math.round(bm.width*sc),h=Math.round(bm.height*sc);
      var c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(bm,0,0,w,h);
      c.toBlob(function(b){res(b&&b.size<file.size?new File([b],(file.name||"photo").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}):file)},"image/jpeg",0.8);
    }).catch(function(){res(file)});
  });
}
function formShowThanks(f,t){f.style.display="none";t.style.display="block";t.scrollIntoView({block:"center"});t.focus({preventScroll:true})}
function formError(f,show,ref){
  var e=f.querySelector(".ferr");
  if(!e){e=document.createElement("p");e.className="ferr";e.setAttribute("role","alert");f.appendChild(e)}
  e.textContent=show?t("Sorry, something went wrong. Please try again or call or text 407-470-5309."):"";
  if(show&&ref){var sm=document.createElement("small");sm.style.cssText="display:block;font-weight:400;opacity:.8;margin-top:4px";sm.textContent="Ref: "+ref;e.appendChild(sm)}
  e.style.display=show?"block":"none";
}
function fileToBase64(file){
  return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result).split(",")[1]||"")};r.onerror=rej;r.readAsDataURL(file)});
}
function submitForm(f,th,ev){
  ev.preventDefault();
  if(!FORM_LIVE){formShowThanks(f,th);return}
  var btn=f.querySelector('button[type=submit]'),old=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent=t("Sending...")}
  formError(f,false);
  var msg={kind:FORM_KINDS[f.id]||"Form",lang:lang,lc_trap_7:(f.querySelector("[name=lc_trap_7]")||{}).value||"",fields:formCollect(f),photos:[]};
  tsToken(f).then(function(tok){msg.ts_token=tok;return Promise.all(formPhotos(f).map(function(x){return shrinkImage(x).then(function(y){return fileToBase64(y).then(function(b){return {filename:y.name||"photo.jpg",content:b}})})})).then(function(photos){
    msg.photos=photos;
    return fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(msg)});
  })}).then(function(r){
    if(!r.ok)return r.text().then(function(tx){var e=new Error("send failed");e.ref=r.status+" "+tx.replace(/[\r\n]+/g," ").slice(0,80);throw e});
    if(f.id==="qf"){phs.forEach(function(o){URL.revokeObjectURL(o.u)});phs.length=0;renderPh()}
    formShowThanks(f,th);
  }).catch(function(e){formError(f,true,e&&e.ref||String(e&&e.message||e))}).then(function(){tsReset(f);if(btn){btn.disabled=false;btn.textContent=old}});
}
// Hidden spam trap: real people never see or fill this box; bots usually do.
function addTrap(f){
  if(!f||f.querySelector("[name=lc_trap_7]"))return;
  var hp=document.createElement("input");hp.type="text";hp.name="lc_trap_7";hp.tabIndex=-1;hp.autocomplete="off";hp.setAttribute("aria-hidden","true");
  hp.style.cssText="position:absolute;left:-9999px;width:1px;height:1px";f.appendChild(hp);
}
["qf","cf","ctf","hf"].forEach(function(id){addTrap(document.getElementById(id))});

// Cloudflare Turnstile: Cloudflare's "not a robot" check. Usually invisible; it only shows a checkbox if a visitor looks suspicious.
// It is OFF until the site key from Cloudflare (Turnstile > the LattaCorp widget) is put here. The matching secret key
// goes in Cloudflare as TURNSTILE_SECRET_KEY; src/worker.js then rejects form messages that fail the check.
var TURNSTILE_SITEKEY="";
var tsReady=null;
function tsOn(){return !!TURNSTILE_SITEKEY&&FORM_LIVE}
function tsLoad(){
  if(!tsOn())return Promise.resolve(false);
  if(!tsReady)tsReady=new Promise(function(res){
    window.lcTsLoaded=function(){res(true)};
    var s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=lcTsLoaded";s.async=true;s.defer=true;
    s.onerror=function(){res(false)};document.head.appendChild(s);
  });
  return tsReady;
}
function tsAttach(f){
  if(!tsOn()||!f||f._tsBox)return;
  var box=document.createElement("div");box.className="tsbox";f._tsBox=box;
  var b=f.querySelector("button[type=submit]");if(b)b.parentNode.insertBefore(box,b);else f.appendChild(box);
  tsLoad().then(function(ok){if(ok&&window.turnstile)f._ts=window.turnstile.render(box,{sitekey:TURNSTILE_SITEKEY,appearance:"interaction-only",language:lang==="es"?"es":"en"})});
}
// Resolves with the check's token (or "" when Turnstile is off or could not load; the server decides what to do then).
function tsToken(f){
  if(!tsOn())return Promise.resolve("");
  return tsLoad().then(function(ok){
    if(!ok||!window.turnstile||f._ts===undefined)return "";
    return new Promise(function(res){var n=0;(function w(){var t=window.turnstile.getResponse(f._ts);if(t||n++>40)return res(t||"");setTimeout(w,250)})()});
  });
}
function tsReset(f){try{if(f&&f._ts!==undefined&&window.turnstile)window.turnstile.reset(f._ts)}catch(e){}}
["qf","cf","ctf","hf"].forEach(function(id){tsAttach(document.getElementById(id))});

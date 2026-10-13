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
    if(el.type==="file"||el.type==="hidden"||el.type==="submit"||el.name==="website")return;
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
function formError(f,show){
  var e=f.querySelector(".ferr");
  if(!e){e=document.createElement("p");e.className="ferr";e.setAttribute("role","alert");f.appendChild(e)}
  e.textContent=show?t("Sorry, something went wrong. Please try again or call or text 407-470-5309."):"";
  e.style.display=show?"block":"none";
}
function submitForm(f,th,ev){
  ev.preventDefault();
  if(!FORM_LIVE){formShowThanks(f,th);return}
  var btn=f.querySelector('button[type=submit]'),old=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent=t("Sending...")}
  formError(f,false);
  var fd=new FormData();
  fd.append("kind",FORM_KINDS[f.id]||"Form");
  fd.append("lang",lang);
  fd.append("website",(f.querySelector('input[name=website]')||{}).value||"");
  fd.append("fields",JSON.stringify(formCollect(f)));
  Promise.all(formPhotos(f).map(shrinkImage)).then(function(files){
    files.forEach(function(x,i){fd.append("photo"+i,x,x.name||("photo"+i+".jpg"))});
    return fetch("/api/submit",{method:"POST",body:fd});
  }).then(function(r){
    if(!r.ok)throw new Error("send failed");
    if(f.id==="qf"){phs.forEach(function(o){URL.revokeObjectURL(o.u)});phs.length=0;renderPh()}
    formShowThanks(f,th);
  }).catch(function(){formError(f,true)}).then(function(){if(btn){btn.disabled=false;btn.textContent=old}});
}

// Hidden spam trap: real people never see or fill this box; bots usually do.
["qf","cf","ctf","hf"].forEach(function(id){var f=document.getElementById(id);if(!f)return;var d=document.createElement("div");d.className="hp";d.setAttribute("aria-hidden","true");d.innerHTML='<input name="website" tabindex="-1" autocomplete="off">';f.appendChild(d)});

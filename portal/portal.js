/* LattaCorp client portal (lattacorpfl.com/portal/).
   Sign in: the server emails a one-time code (6 or 8 digits, set in Supabase) (src/worker.js, /api/portal/code); the code is checked by Supabase here.
   Data: everything comes from the database lookups portal_accounts() and portal_account(id) (supabase/stages/stage23),
   which only ever return the signed-in person's own account(s). This page never reads CRM tables directly.
   Sections: Home, Schedule, Billing, Requests, Photos, Account. English and Spanish. */
(function () {
  "use strict";

  /* ---------- setup ---------- */
  var CFG = window.CRM_CONFIG || {};
  // Its own sign-in storage, so a client's sign-in never mixes with a staff sign-in to the CRM on the same device.
  var sb = window.supabase.createClient(CFG.url, CFG.key, {
    auth: { storageKey: "lc-portal-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  // Cloudflare "not a robot" check (same key as js/forms.js). Off while empty.
  var TURNSTILE_SITEKEY = "";
  var PHONE = "4074705309", PHONE_TXT = "407-470-5309", SUPPORT = "Support@lattacorpfl.com";

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- language ---------- */
  var qs = new URLSearchParams(location.search);
  var lang = qs.get("lang") === "es" ? "es" : store("lc-portal-lang") || ((navigator.language || "").slice(0, 2) === "es" ? "es" : "en");
  var ES = {
    "Paid up": "Al día", "Amount due": "Monto pendiente", "Nothing due": "Nada pendiente", "Last invoice": "Última factura",
    "See invoices": "Ver facturas", "Total past due": "Total atrasado", "Total amount due": "Total pendiente", "For all": "Para las",
    "properties": "propiedades", "Each property is billed on its own; see the amounts below.": "Cada propiedad se factura por separado; vea los montos abajo.",
    "Your properties": "Sus propiedades", "Total balance due": "Saldo total pendiente", "Show invoices for": "Mostrar facturas de",
    "All properties": "Todas las propiedades", "Balance for": "Saldo de", "For": "Para",
    "Pick All properties above for one statement covering everything.": "Elija Todas las propiedades arriba para un estado de cuenta con todo.",
    "Client portal": "Portal de clientes", "Sign in to your account": "Entre a su cuenta",
    "Enter the email we have on file. We'll send you a sign-in code. No password needed.": "Escriba el correo que tenemos en su cuenta. Le enviaremos un código de acceso. No necesita contraseña.",
    "Email": "Correo electrónico", "Send my code": "Enviar mi código", "Check your email": "Revise su correo",
    "If this email is on file with us, a code is on its way to": "Si este correo está en nuestros registros, le enviamos un código a",
    "Sign-in code": "Código de acceso", "Sign in": "Entrar", "Send a new code": "Enviar otro código", "Use a different email": "Usar otro correo",
    "No code, or not on file yet? Call or text": "¿No le llegó el código o aún no está registrado? Llame o envíe un texto al",
    "Home": "Inicio", "Schedule": "Calendario", "Billing": "Facturación", "Requests": "Solicitudes", "Photos": "Fotos", "Account": "Cuenta", "More": "Más",
    "Enter a valid email.": "Escriba un correo válido.", "Sending...": "Enviando...", "Checking...": "Verificando...",
    "That code didn't work. Check it, or send a new code.": "Ese código no funcionó. Revíselo o pida uno nuevo.",
    "Something went wrong. Please try again, or call or text 407-470-5309.": "Algo salió mal. Intente de nuevo, o llame o envíe un texto al 407-470-5309.",
    "We sent a new code.": "Le enviamos un código nuevo.",
    "Info": "Información", "Guides and tips from LattaCorp. More lawn-care guides are on the way.": "Guías y consejos de LattaCorp. Pronto habrá más guías sobre el cuidado del césped.",
    "You're already using the portal as an app on this device.": "Ya está usando el portal como app en este dispositivo.", "Install the app now": "Instalar la app ahora", "This device": "Este dispositivo",
    "Client Portal": "Portal de Clientes", "Back to website": "Volver al sitio web", "Website": "Sitio web", "No matches": "Sin resultados",
    "Staff view": "Vista del personal", "Open the CRM": "Abrir el CRM", "accounts": "cuentas", "archived": "archivado", "Find a client": "Buscar cliente", "What the client sees": "Lo que ve el cliente",
    "Staff view: sending is turned off here so nothing goes out in the client's name. Their form looks like this for them, with their properties and phone filled in.": "Vista del personal: el envío está desactivado para que nada salga a nombre del cliente. Así ve el cliente su formulario.",
    "Can't find it? Check your Spam or Junk folder. It comes from website@lattacorpfl.com.": "¿No lo encuentra? Revise su carpeta de Spam o Correo no deseado. Llega de website@lattacorpfl.com.",
    "Too many codes were requested for this email. Please use the newest code we sent, or try again in": "Se pidieron demasiados códigos para este correo. Use el código más reciente que le enviamos, o intente de nuevo en",
    "minutes": "minutos", "We just sent a code. Please wait a minute before asking for another.": "Acabamos de enviarle un código. Espere un minuto antes de pedir otro.",
    "This email isn't linked to an account yet. Call or text 407-470-5309 and we'll set it up.": "Este correo aún no está vinculado a una cuenta. Llame o envíe un texto al 407-470-5309 y lo configuramos.",
    "Hi": "Hola", "You're all set": "Todo está al día", "Your account is up to date.": "Su cuenta está al día.",
    "Payment due": "Pago pendiente", "Past due": "Pago atrasado", "Service paused": "Servicio en pausa",
    "Due by": "Vence el", "Overdue since": "Atrasado desde",
    "Please pay as soon as you can to keep your service on schedule.": "Por favor pague lo antes posible para mantener su servicio al día.",
    "You have no visits scheduled. Want to start again? Send us a request.": "No tiene visitas programadas. ¿Quiere reanudar? Envíenos una solicitud.",
    "How to pay": "Cómo pagar", "Request service": "Pedir servicio", "Next visit": "Próxima visita", "No visits scheduled right now.": "No hay visitas programadas por ahora.",
    "Call": "Llamar", "Text": "Texto", "Email us": "Correo", "Recent invoices": "Facturas recientes", "See all billing": "Ver toda la facturación",
    "Upcoming visits": "Próximas visitas", "Past visits": "Visitas realizadas", "Moved from": "Movida del", "because of weather": "por el clima",
    "No upcoming visits are scheduled.": "No hay próximas visitas programadas.", "No past visits yet.": "Aún no hay visitas realizadas.",
    "Show more": "Ver más", "Balance due": "Saldo pendiente", "Credit on account": "Crédito en la cuenta",
    "Pay with Zelle": "Pague con Zelle", "Cash or check is welcome too.": "También aceptamos efectivo o cheque.",
    "Online card and bank payments are coming soon.": "Muy pronto podrá pagar en línea con tarjeta o cuenta bancaria.",
    "Please include your invoice number in the Zelle note.": "Por favor incluya su número de factura en la nota de Zelle.",
    "Open invoices": "Facturas pendientes", "All invoices": "Todas las facturas", "Payments": "Pagos", "No payments yet.": "Aún no hay pagos.",
    "No invoices yet.": "Aún no hay facturas.", "View": "Ver", "Invoice": "Factura", "Paid": "Pagada", "Due": "Pendiente", "Void": "Anulada",
    "Statement": "Estado de cuenta", "This year": "Este año", "Last year": "Año pasado", "Last 12 months": "Últimos 12 meses", "All time": "Todo",
    "Print statement": "Imprimir estado de cuenta", "Payment": "Pago",
    "New request": "Nueva solicitud", "What do you need?": "¿Qué necesita?", "Service or a problem": "Servicio o un problema", "Quote for other work": "Cotización para otro trabajo",
    "Property": "Propiedad", "Other address": "Otra dirección", "Details": "Detalles", "Phone": "Teléfono",
    "Tell us what you need, where, and any timing that matters.": "Díganos qué necesita, dónde y si hay alguna fecha importante.",
    "Send request": "Enviar solicitud", "Sent! We'll get back to you within 1 to 3 business days.": "¡Enviada! Le responderemos en 1 a 3 días hábiles.",
    "Please describe what you need.": "Por favor describa lo que necesita.", "Your requests": "Sus solicitudes", "No requests yet.": "Aún no hay solicitudes.",
    "Received": "Recibida", "In progress": "En proceso", "Quote sent": "Cotización enviada", "Approved": "Aprobada", "Closed": "Cerrada",
    "Service request": "Solicitud de servicio", "Quote request": "Solicitud de cotización",
    "No photos yet. We'll add photos from your visits here.": "Aún no hay fotos. Aquí agregaremos fotos de sus visitas.",
    "Your account": "Su cuenta", "Contact info": "Información de contacto", "Properties": "Propiedades", "People with access": "Personas con acceso",
    "Signed in as": "Sesión iniciada como", "Sign out": "Cerrar sesión", "Need to change something?": "¿Necesita cambiar algo?",
    "Send us a note and we'll update your account.": "Envíenos una nota y actualizaremos su cuenta.", "Ask for a change": "Pedir un cambio",
    "Please update my account information:": "Por favor actualicen la información de mi cuenta:",
    "Loading your account...": "Cargando su cuenta...", "Account holder": "Titular de la cuenta",
    "Opening balance": "Saldo inicial", "Closing balance": "Saldo final", "Charges": "Cargos", "Date": "Fecha", "Description": "Descripción", "Balance": "Saldo"
  };
  function t(s) { return (lang === "es" && ES[s]) || s; }
  var LOC = function () { return lang === "es" ? "es-US" : "en-US"; };
  function applyStatic() {
    document.documentElement.lang = lang;
    [].forEach.call(document.querySelectorAll("[data-t]"), function (e) { e.textContent = t(e.getAttribute("data-t")); });
    [].forEach.call(document.querySelectorAll("[data-ph]"), function (e) { e.placeholder = t(e.getAttribute("data-ph")); });
    [].forEach.call(document.querySelectorAll("[data-al]"), function (e) { e.setAttribute("aria-label", t(e.getAttribute("data-al"))); });
    [].forEach.call(document.querySelectorAll("[data-lang]"), function (b) { b.textContent = lang === "es" ? "English" : "Español"; });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-lang]");
    if (!b) return;
    lang = lang === "es" ? "en" : "es"; store("lc-portal-lang", lang); applyStatic(); if (data) show(view);
  });

  /* ---------- formatting ---------- */
  function money(n) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0); }
  function pd(s) { if (!s) return null; var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fdate(s, opt) { var d = pd(s); return d ? d.toLocaleDateString(LOC(), opt || { month: "short", day: "numeric", year: "numeric" }) : ""; }
  function invNum(n) { var s = String(n || 0); while (s.length < 4) s = "0" + s; return "LC-" + s; }
  function dateBlock(s) {
    var d = pd(s), b = el("div", "date");
    b.appendChild(el("b", null, d ? String(d.getDate()) : "–"));
    b.appendChild(el("span", null, d ? d.toLocaleDateString(LOC(), { month: "short" }) : ""));
    return b;
  }
  function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }

  /* ---------- sign in ---------- */
  var ts = { id: undefined, ready: null };
  function tsInit() {
    if (!TURNSTILE_SITEKEY || ts.ready) return;
    ts.ready = new Promise(function (res) {
      window.lcPortalTs = function () { res(true); };
      var s = document.createElement("script"); s.async = true;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=lcPortalTs"; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    }).then(function (ok) { if (ok && window.turnstile) ts.id = window.turnstile.render($("sits"), { sitekey: TURNSTILE_SITEKEY, appearance: "interaction-only", language: lang }); return ok; });
  }
  function tsToken() {
    if (!ts.ready) return Promise.resolve("");
    return ts.ready.then(function () {
      if (ts.id === undefined) return "";
      return new Promise(function (res) { var n = 0; (function w() { var v = window.turnstile.getResponse(ts.id); if (v || n++ > 40) return res(v || ""); setTimeout(w, 250); })(); });
    });
  }
  function showErr(id, msg) { var e = $(id); e.textContent = msg || ""; e.classList.toggle("hide", !msg); }
  function requestCode(email) {
    return tsToken().then(function (tok) {
      return fetch("/api/portal/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, lang: lang, ts_token: tok }) });
    }).then(function (r) {
      try { if (ts.id !== undefined) window.turnstile.reset(ts.id); } catch (e) {}
      if (!r.ok) throw new Error(String(r.status));
      return r.json().catch(function () { return {}; });
    }).then(function (j) {
      if (j && j.wait === "minutes") { var e = new Error("limit"); e.msg = t("Too many codes were requested for this email. Please use the newest code we sent, or try again in") + " " + j.minutes + " " + t("minutes") + "."; throw e; }
      if (j && j.wait === "seconds") { var e2 = new Error("limit"); e2.msg = t("We just sent a code. Please wait a minute before asking for another."); throw e2; }
    });
  }
  function showSignin(msg) {
    $("app").classList.add("hide"); $("signin").classList.remove("hide"); $("acctsel").classList.add("hide");
    $("emailform").classList.remove("hide"); $("codeform").classList.add("hide");
    showErr("sierr", msg || ""); tsInit();
    var last = store("lc-portal-email"); if (last && !$("siemail").value) $("siemail").value = last;
  }
  $("emailform").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("siemail").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showErr("sierr", t("Enter a valid email.")); return; }
    var b = $("sendbtn"); b.disabled = true; b.textContent = t("Sending...");
    requestCode(email).then(function () {
      store("lc-portal-email", email); $("sentto").textContent = email;
      $("emailform").classList.add("hide"); $("codeform").classList.remove("hide"); showErr("codeerr", ""); $("sicode").value = ""; $("sicode").focus();
    }).catch(function (er) { showErr("sierr", (er && er.msg) || t("Something went wrong. Please try again, or call or text 407-470-5309.")); })
      .then(function () { b.disabled = false; b.textContent = t("Send my code"); });
  });
  $("sicode").addEventListener("input", function () { this.value = this.value.replace(/\D/g, "").slice(0, 8); if (this.value.length === 8) $("codeform").requestSubmit(); });
  $("codeform").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = store("lc-portal-email") || $("siemail").value.trim().toLowerCase(), code = $("sicode").value.trim();
    if (code.length < 6) { showErr("codeerr", t("That code didn't work. Check it, or send a new code.")); return; }
    var b = $("verifybtn"); b.disabled = true; b.textContent = t("Checking...");
    // Supabase makes the code as a "recovery" code for people who already have a sign-in, and an "email" code
    // for first-timers, so try the kinds in that order until one matches.
    verifyAny({ email: email, token: code }, ["recovery", "email", "magiclink"]).then(function (r) {
      if (r.error) { showErr("codeerr", t("That code didn't work. Check it, or send a new code.")); return; }
      boot();
    }).catch(function () { showErr("codeerr", t("Something went wrong. Please try again, or call or text 407-470-5309.")); })
      .then(function () { b.disabled = false; b.textContent = t("Sign in"); });
  });
  $("resend").addEventListener("click", function () {
    requestCode(store("lc-portal-email") || "").then(function () { showErr("codeerr", ""); var p = $("codeerr"); p.textContent = t("We sent a new code."); p.classList.remove("hide"); p.className = "ok"; setTimeout(function () { p.className = "err hide"; }, 4000); })
      .catch(function (er) { showErr("codeerr", (er && er.msg) || t("Something went wrong. Please try again, or call or text 407-470-5309.")); });
  });
  $("otheremail").addEventListener("click", function () { store("lc-portal-email", null); $("siemail").value = ""; showSignin(); $("siemail").focus(); });

  function verifyAny(params, types) {
    var i = 0, last = null;
    function next() {
      if (i >= types.length) return Promise.resolve(last || { error: { message: "invalid" } });
      var p = Object.assign({ type: types[i++] }, params);
      return sb.auth.verifyOtp(p).then(function (r) { last = r; return r.error ? next() : r; });
    }
    return next();
  }

  /* ---------- account data ---------- */
  var accounts = [], curId = null, data = null, view = "home", photoUrls = {}, flash = "", isStaff = false, siteKey = "";
  function boot() {
    var th = qs.get("th");
    var tys = [qs.get("ty") || "magiclink"].concat(["recovery", "email", "magiclink"].filter(function (x) { return x !== qs.get("ty"); }));
    var first = th ? verifyAny({ token_hash: th }, tys).then(function (r) {
      history.replaceState(null, "", location.pathname + (lang === "es" ? "?lang=es" : ""));
      qs = new URLSearchParams(""); return r;
    }) : Promise.resolve(null);
    return first.then(function () { return sb.auth.getSession(); }).then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { showSignin(); return; }
      $("signin").classList.add("hide"); $("app").classList.remove("hide");
      $("view").innerHTML = ""; $("view").appendChild(el("p", "loading", t("Loading your account...")));
      return sb.rpc("portal_accounts").then(function (a) {
        accounts = (a && a.data) || [];
        if (!accounts.length) { sb.auth.signOut(); showSignin(t("This email isn't linked to an account yet. Call or text 407-470-5309 and we'll set it up.")); return; }
        isStaff = !!accounts[0].staff;
        var want = qs.get("acct") || store("lc-portal-acct");
        curId = accounts.some(function (x) { return x.id === want; }) ? want : accounts[0].id;
        if (qs.get("acct")) history.replaceState(null, "", location.pathname + (lang === "es" ? "?lang=es" : ""));
        drawAcctSel(); return loadAccount();
      });
    }).catch(function () { showSignin(t("Something went wrong. Please try again, or call or text 407-470-5309.")); });
  }
  function drawAcctSel() {
    var s = $("acctsel"); s.textContent = "";
    s.classList.toggle("hide", accounts.length < 2 || isStaff);
    accounts.forEach(function (a) { var o = el("option", null, a.name); o.value = a.id; if (a.id === curId) o.selected = true; s.appendChild(o); });
    drawStaffBar();
  }
  /* Staff master view: a bar under the header to search for and switch to any client's account. */
  function drawStaffBar() {
    var bar = $("staffbar");
    bar.classList.toggle("hide", !isStaff);
    if (!isStaff) return;
    var sel = $("staffsel"), q = ($("staffq").value || "").toLowerCase().trim();
    sel.textContent = "";
    var shown = accounts.filter(function (a) { return !q || (a.name + " " + (a.company || "")).toLowerCase().indexOf(q) > -1 || a.id === curId; });
    shown.forEach(function (a) {
      var o = el("option", null, a.name + (a.company && a.company !== a.name ? " (" + a.company + ")" : "") + (a.archived ? " · " + t("archived") : ""));
      o.value = a.id; if (a.id === curId) o.selected = true; sel.appendChild(o);
    });
    $("staffcount").textContent = accounts.length + " " + t("accounts");
    var cur = accounts.filter(function (a) { return a.id === curId; })[0];
    if (document.activeElement !== $("staffcombo")) $("staffcombo").value = cur ? cur.name : "";
  }
  function pickAccount(id) {
    if (!id || id === curId) return;
    curId = id; store("lc-portal-acct", curId); photoUrls = {};
    $("view").innerHTML = ""; $("view").appendChild(el("p", "loading", t("Loading your account...")));
    drawStaffBar(); loadAccount();
  }

  /* Computers: one box to type a name and pick from the list that drops down under it. */
  var combo = $("staffcombo"), clist = $("stafflist"), cIdx = -1, cItems = [], typed = false;
  function comboLabel(a) { return a.name + (a.company && a.company !== a.name ? " (" + a.company + ")" : ""); }
  function comboOpen(open) { clist.classList.toggle("hide", !open); combo.setAttribute("aria-expanded", open ? "true" : "false"); }
  function comboDraw() {
    // Until something is typed the box still shows the current client's name, so list everyone.
    var q = typed ? combo.value.toLowerCase().trim() : "";
    cItems = accounts.filter(function (a) { return !q || comboLabel(a).toLowerCase().indexOf(q) > -1; });
    clist.textContent = "";
    if (!cItems.length) { clist.appendChild(el("li", "none", t("No matches"))); cIdx = -1; return; }
    if (cIdx >= cItems.length) cIdx = cItems.length - 1;
    cItems.forEach(function (a, k) {
      var li = el("li", null, comboLabel(a)); li.id = "sl-" + k; li.setAttribute("role", "option");
      li.setAttribute("aria-selected", k === cIdx ? "true" : "false");
      if (a.archived) li.appendChild(el("small", null, t("archived")));
      if (a.id === curId) li.style.fontWeight = "700";
      li.addEventListener("mousedown", function (e) { e.preventDefault(); comboChoose(a); });
      clist.appendChild(li);
    });
    if (cIdx > -1) { combo.setAttribute("aria-activedescendant", "sl-" + cIdx); var on = $("sl-" + cIdx); if (on) on.scrollIntoView({ block: "nearest" }); }
    else combo.removeAttribute("aria-activedescendant");
  }
  function comboChoose(a) { comboOpen(false); combo.blur(); combo.value = a.name; pickAccount(a.id); }
  combo.addEventListener("focus", function () { typed = false; combo.select(); cIdx = -1; comboDraw(); comboOpen(true); });
  combo.addEventListener("input", function () { typed = true; cIdx = 0; comboDraw(); comboOpen(true); });
  combo.addEventListener("blur", function () { comboOpen(false); drawStaffBar(); });
  combo.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); cIdx = Math.min(cItems.length - 1, cIdx + 1); comboDraw(); comboOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cIdx = Math.max(0, cIdx - 1); comboDraw(); }
    else if (e.key === "Enter") { e.preventDefault(); if (cItems[cIdx < 0 ? 0 : cIdx]) comboChoose(cItems[cIdx < 0 ? 0 : cIdx]); }
    else if (e.key === "Escape") { comboOpen(false); combo.blur(); }
  });
  $("staffq").addEventListener("input", drawStaffBar);
  $("staffsel").addEventListener("change", function () { pickAccount(this.value); });
  $("acctsel").addEventListener("change", function () { curId = this.value; store("lc-portal-acct", curId); photoUrls = {}; loadAccount(); });
  function loadAccount() {
    return sb.rpc("portal_account", { cid: curId }).then(function (r) {
      if (r.error || !r.data) throw r.error || new Error("no data");
      if (!data || data.client.id !== r.data.client.id) siteKey = "";
      data = r.data; store("lc-portal-acct", curId); show(view);
    });
  }

  /* ---------- navigation ---------- */
  var VIEWS = { home: home, schedule: schedule, billing: billing, requests: requests, photos: photos, info: info, account: account, more: more };
  [].forEach.call(document.querySelectorAll("nav.tabs [data-v]"), function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-v")); }); });
  function show(v) {
    view = VIEWS[v] ? v : "home";
    [].forEach.call(document.querySelectorAll("nav.tabs [data-v]"), function (b) {
      var on = b.getAttribute("data-v") === view || (b.getAttribute("data-v") === "more" && (view === "photos" || view === "info" || view === "account"));
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var host = $("view"); host.textContent = ""; VIEWS[view](host);
    window.scrollTo(0, 0);
  }
  function panel(host, title) { var p = el("section", "panel"); if (title) p.appendChild(el("h2", null, title)); host.appendChild(p); return p; }
  function li(list, opts) {
    var i = el("li"); if (opts.date) i.appendChild(dateBlock(opts.date));
    var m = el("div", "main"); m.appendChild(el("b", null, opts.title)); if (opts.sub) m.appendChild(el("div", "sub", opts.sub)); i.appendChild(m);
    if (opts.right) i.appendChild(opts.right); list.appendChild(i); return i;
  }
  function pill(text, cls) { return el("span", "pill" + (cls ? " " + cls : ""), text); }
  /* Properties billed separately (an HOA or management company with several). Only used when there are 2 or more. */
  function sites() { var x = data.sites || []; return x.length > 1 ? x : []; }
  function siteOf(key) { return sites().filter(function (x) { return x.key === key; })[0]; }
  function sitePill(x) { return Number(x.past_due) > 0 ? pill(t("Past due"), "past_due") : Number(x.balance) > 0 ? pill(t("Due"), "due") : pill(t("Paid up")); }
  function siteCards(host, onPick) {
    var g = el("div", "propgrid");
    sites().forEach(function (x) {
      var c = el("button", "propbox" + (Number(x.past_due) > 0 ? " past_due" : Number(x.balance) > 0 ? " due" : "")); c.type = "button";
      var top = el("div", "stop"), nm = el("div", "snm");
      nm.appendChild(el("b", null, x.name));
      if (x.address && x.address !== x.name) nm.appendChild(el("span", null, x.address));
      top.appendChild(nm); top.appendChild(sitePill(x)); c.appendChild(top);
      c.appendChild(el("div", "samt", money(x.balance)));
      c.appendChild(el("div", "slab", Number(x.past_due) > 0 ? t("Past due") : Number(x.balance) > 0 ? t("Amount due") : t("Nothing due")));
      var meta = [];
      if (x.next_due && Number(x.balance) > 0) meta.push(t("Due by") + " " + fdate(x.next_due));
      if (x.next_visit) meta.push(t("Next visit") + ": " + fdate(x.next_visit, { month: "short", day: "numeric" }));
      if (x.last_invoice) meta.push(t("Last invoice") + " " + invNum(x.last_invoice.number) + " · " + fdate(x.last_invoice.date));
      meta.forEach(function (m) { c.appendChild(el("div", "smeta", m)); });
      c.appendChild(el("div", "sgo", t("See invoices") + " ›"));
      c.onclick = function () { onPick(x); };
      g.appendChild(c);
    });
    host.appendChild(g);
  }
  function toPick() { var e = document.querySelector(".sitepick"); if (e) e.scrollIntoView({ block: "start" }); }
  function invPill(s) { return s === "past_due" ? pill(t("Past due"), "past_due") : s === "due" ? pill(t("Due"), "due") : s === "void" ? pill(t("Void"), "gray") : pill(t("Paid")); }
  function docLink(tok, label) { var a = el("a", "btn alt", label || t("View")); a.href = "../d/?t=" + encodeURIComponent(tok); a.target = "_blank"; a.rel = "noopener"; a.style.minHeight = "38px"; a.style.padding = "0 14px"; return a; }

  /* ---------- Home ---------- */
  function home(host) {
    var s = data.summary, c = data.client, st = s.status;
    var band = el("section", "band " + st);
    band.appendChild(el("p", "who", isStaff ? t("What the client sees") + ": " + c.name
      : t("Hi") + ", " + (firstName(data.me && data.me.name) || firstName(c.nickname || c.name)) + (accounts.length > 1 ? " · " + c.name : "")));
    var many = sites().length;
    if (st === "past_due") {
      band.appendChild(el("h1", null, t(many ? "Total past due" : "Past due")));
      band.appendChild(el("div", "amt", money(s.balance)));
      band.appendChild(el("p", null, (s.past_due_since ? t("Overdue since") + " " + fdate(s.past_due_since) + ". " : "") + t("Please pay as soon as you can to keep your service on schedule.")));
    } else if (st === "due") {
      var nextDue = (data.invoices || []).filter(function (i) { return i.status === "due" && i.due_date; }).map(function (i) { return i.due_date; }).sort()[0];
      band.appendChild(el("h1", null, t(many ? "Total amount due" : "Payment due")));
      band.appendChild(el("div", "amt", money(s.balance)));
      if (nextDue) band.appendChild(el("p", null, t("Due by") + " " + fdate(nextDue) + "."));
    } else if (st === "paused") {
      band.appendChild(el("h1", null, t("Service paused")));
      band.appendChild(el("p", null, t("You have no visits scheduled. Want to start again? Send us a request.")));
    } else {
      band.appendChild(el("h1", null, t("You're all set")));
      band.appendChild(el("p", null, t("Your account is up to date.")));
    }
    var acts = el("div", "acts");
    if (Number(s.balance) > 0) { var pb = el("button", "btn", t("How to pay")); pb.type = "button"; pb.onclick = function () { show("billing"); }; acts.appendChild(pb); }
    var rb = el("button", "btn ghost", t("Request service")); rb.type = "button"; rb.onclick = function () { show("requests"); }; acts.appendChild(rb);
    if (many && Number(s.balance) > 0) band.appendChild(el("p", "small", t("For all") + " " + many + " " + t("properties") + ". " + t("Each property is billed on its own; see the amounts below.")));
    band.appendChild(acts); host.appendChild(band);

    if (many) {
      var sp = panel(host, t("Your properties"));
      siteCards(sp, function (x) { siteKey = x.key; show("billing"); toPick(); });
    }

    var nv = panel(host, t("Next visit"));
    if (s.next_visit) { var l = el("ul", "list"); li(l, { date: s.next_visit.date, title: s.next_visit.service || "", sub: fdate(s.next_visit.date, { weekday: "long", month: "long", day: "numeric" }) + (s.next_visit.address ? " · " + s.next_visit.address : "") }); nv.appendChild(l); }
    else nv.appendChild(el("p", "muted", t("No visits scheduled right now.")));

    var q = el("div", "quick");
    [["tel:" + PHONE, t("Call"), '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'],
     ["sms:" + PHONE, t("Text"), '<path d="M4 5h16v11H8l-4 4z"/>'],
     ["mailto:" + SUPPORT, t("Email us"), '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>']].forEach(function (x) {
      var a = el("a"); a.href = x[0];
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + x[2] + "</svg>";
      a.appendChild(el("span", null, x[1])); q.appendChild(a);
    });
    host.appendChild(q);

    var inv = (data.invoices || []).slice(0, 3);
    if (inv.length) {
      var p = panel(host, t("Recent invoices")), l2 = el("ul", "list");
      inv.forEach(function (i) {
        var r = el("div"); r.style.textAlign = "right"; r.appendChild(el("div", "amt", money(i.total))); r.appendChild(invPill(i.status));
        li(l2, { title: t("Invoice") + " " + invNum(i.number), sub: fdate(i.issue_date), right: r });
      });
      p.appendChild(l2);
      var more = el("button", "linkbtn", t("See all billing")); more.type = "button"; more.onclick = function () { show("billing"); }; p.appendChild(more);
    }
  }

  /* ---------- Schedule ---------- */
  function schedule(host) {
    var up = panel(host, t("Upcoming visits")), ul = el("ul", "list");
    (data.upcoming || []).forEach(function (v) {
      var sub = [fdate(v.date, { weekday: "long", month: "long", day: "numeric" }), v.property || v.address].filter(Boolean).join(" · ");
      var i = li(ul, { date: v.date, title: v.service || "", sub: sub });
      if (v.delayed_from) i.querySelector(".main").appendChild(el("div", "sub", t("Moved from") + " " + fdate(v.delayed_from, { month: "short", day: "numeric" }) + " " + t("because of weather")));
    });
    if (!(data.upcoming || []).length) up.appendChild(el("p", "muted", t("No upcoming visits are scheduled."))); else up.appendChild(ul);

    var past = panel(host, t("Past visits")), hist = data.history || [], shown = 24;
    if (!hist.length) { past.appendChild(el("p", "muted", t("No past visits yet."))); return; }
    var box = el("div"); past.appendChild(box);
    function draw() {
      box.textContent = ""; var lastM = "", l = null;
      hist.slice(0, shown).forEach(function (v) {
        var m = fdate(v.date, { month: "long", year: "numeric" });
        if (m !== lastM) { box.appendChild(el("h3", "month", m)); l = el("ul", "list"); box.appendChild(l); lastM = m; }
        li(l, { date: v.date, title: v.service || "", sub: v.property || v.address || "" });
      });
      if (hist.length > shown) { var b = el("button", "btn alt", t("Show more")); b.type = "button"; b.style.marginTop = "12px"; b.onclick = function () { shown += 48; draw(); }; box.appendChild(b); }
    }
    draw();
  }

  /* ---------- Billing ---------- */
  function billing(host) {
    var s = data.summary, b = data.business || {};
    var top = panel(host);
    var many = sites().length;
    var r = el("div", "row"); r.appendChild(el("h2", null, t(many ? "Total balance due" : "Balance due")));
    r.appendChild(s.status === "past_due" ? pill(t("Past due"), "past_due") : Number(s.balance) > 0 ? pill(t("Due"), "due") : pill(t("Paid")));
    top.appendChild(r);
    var big = el("div", null, money(s.balance)); big.style.cssText = "font-family:var(--serif);font-size:2.2rem;font-weight:700;color:var(--forest);line-height:1.1"; top.appendChild(big);
    if (Number(s.credit) > 0) top.appendChild(el("p", "muted small", t("Credit on account") + ": " + money(s.credit)));
    if (many) {
      var bl = el("ul", "list sitebal");
      sites().forEach(function (x) {
        var rt = el("div"); rt.style.textAlign = "right"; rt.appendChild(el("div", "amt", money(x.balance))); rt.appendChild(sitePill(x));
        var item = li(bl, { title: x.name, sub: x.address && x.address !== x.name ? x.address : "", right: rt });
        item.classList.add("tap"); item.tabIndex = 0; item.setAttribute("role", "button");
        var pick = function () { siteKey = x.key; show("billing"); toPick(); };
        item.onclick = pick; item.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
      });
      top.appendChild(bl);
    }

    var pay = el("div", "paybox"); pay.appendChild(el("h3", null, t("How to pay")));
    if (b.zelle) { var z = el("p"); z.appendChild(el("b", null, t("Pay with Zelle") + ": ")); z.appendChild(document.createTextNode(b.zelle)); pay.appendChild(z); pay.appendChild(el("p", "small muted", t("Please include your invoice number in the Zelle note."))); }
    if (b.payment_note) pay.appendChild(el("p", "small", b.payment_note)); else pay.appendChild(el("p", "small", t("Cash or check is welcome too.")));
    pay.appendChild(el("p", "small muted", t("Online card and bank payments are coming soon.")));
    host.appendChild(pay);

    // With several properties, the lists below can show one property at a time.
    var cur = siteOf(siteKey); if (!cur) siteKey = "";
    if (many) {
      var fp = el("div", "panel sitepick"), fl = el("label", "f"), fs = el("select");
      fl.appendChild(el("span", null, t("Show invoices for")));
      var oa = el("option", null, t("All properties")); oa.value = ""; fs.appendChild(oa);
      sites().forEach(function (x) { var o = el("option", null, x.name + " · " + money(x.balance)); o.value = x.key; if (x.key === siteKey) o.selected = true; fs.appendChild(o); });
      fs.onchange = function () { siteKey = fs.value; show("billing"); };
      fl.appendChild(fs); fp.appendChild(fl);
      if (cur) {
        var cs = el("div", "row"); cs.style.marginTop = "10px";
        var cb = el("div"); cb.appendChild(el("b", null, t("Balance for") + " " + cur.name + ": " + money(cur.balance)));
        cs.appendChild(cb); cs.appendChild(sitePill(cur)); fp.appendChild(cs);
      }
      host.appendChild(fp);
    }
    var inSite = function (x) { return !siteKey || x.site === siteKey; };
    var invs = (data.invoices || []).filter(inSite), open = invs.filter(function (i) { return i.status === "due" || i.status === "past_due"; });
    if (open.length) {
      var op = panel(host, t("Open invoices")), ol = el("ul", "list");
      open.forEach(function (i) {
        var rt = el("div"); rt.style.cssText = "display:flex;gap:10px;align-items:center";
        var a = el("div"); a.style.textAlign = "right"; a.appendChild(el("div", "amt", money(i.balance))); a.appendChild(invPill(i.status)); rt.appendChild(a); rt.appendChild(docLink(i.token));
        li(ol, { title: t("Invoice") + " " + invNum(i.number), sub: fdate(i.issue_date) + (i.due_date ? " · " + t("Due by") + " " + fdate(i.due_date) : "") + (many && !siteKey && siteOf(i.site) ? " · " + siteOf(i.site).name : ""), right: rt });
      });
      op.appendChild(ol);
    }

    var stp = panel(host, t("Statement")), seg = el("div", "seg"), range = "year";
    [["year", t("This year")], ["last", t("Last year")], ["12m", t("Last 12 months")], ["all", t("All time")]].forEach(function (x) {
      var bt = el("button", null, x[1]); bt.type = "button"; bt.setAttribute("aria-pressed", x[0] === range ? "true" : "false");
      bt.onclick = function () { range = x[0]; [].forEach.call(seg.children, function (c) { c.setAttribute("aria-pressed", c === bt ? "true" : "false"); }); };
      seg.appendChild(bt);
    });
    stp.appendChild(seg);
    if (cur) stp.appendChild(el("p", "small muted", t("For") + " " + cur.name + ". " + t("Pick All properties above for one statement covering everything.")));
    var pr = el("button", "btn alt", t("Print statement")); pr.type = "button"; pr.onclick = function () { printStatement(range, siteKey); }; stp.appendChild(pr);

    var all = panel(host, t("All invoices"));
    if (!invs.length) all.appendChild(el("p", "muted", t("No invoices yet.")));
    else {
      var al = el("ul", "list"), n = 12; all.appendChild(al);
      var drawInv = function () {
        al.textContent = "";
        invs.slice(0, n).forEach(function (i) {
          var rt = el("div"); rt.style.cssText = "display:flex;gap:10px;align-items:center";
          var a = el("div"); a.style.textAlign = "right"; a.appendChild(el("div", "amt", money(i.total))); a.appendChild(invPill(i.status)); rt.appendChild(a); rt.appendChild(docLink(i.token));
          li(al, { title: t("Invoice") + " " + invNum(i.number), sub: fdate(i.issue_date) + (siteKey ? "" : i.address ? " · " + (siteOf(i.site) ? siteOf(i.site).name : i.address) : ""), right: rt });
        });
        if (invs.length > n) { var mb = el("li"); var bt = el("button", "btn alt", t("Show more")); bt.type = "button"; bt.onclick = function () { n += 24; drawInv(); }; mb.appendChild(bt); al.appendChild(mb); }
      };
      drawInv();
    }

    var pp = panel(host, t("Payments")), pays = (data.payments || []).filter(inSite);
    if (!pays.length) pp.appendChild(el("p", "muted", t("No payments yet.")));
    else {
      var pl = el("ul", "list"); pays.slice(0, 24).forEach(function (x) {
        li(pl, { date: x.date, title: money(x.amount), sub: [x.method, x.invoice ? t("Invoice") + " " + invNum(x.invoice) : ""].filter(Boolean).join(" · ") });
      });
      pp.appendChild(pl);
    }
  }

  function printStatement(range, key) {
    var only = function (x) { return !key || x.site === key; }, site = siteOf(key);
    var today = pd(data.summary.today) || new Date(), y = today.getFullYear(), from = null, to = today;
    if (range === "year") from = new Date(y, 0, 1);
    else if (range === "last") { from = new Date(y - 1, 0, 1); to = new Date(y - 1, 11, 31); }
    else if (range === "12m") from = new Date(y - 1, today.getMonth(), today.getDate() + 1);
    var ev = [];
    (data.invoices || []).filter(only).forEach(function (i) { if (i.status !== "void") ev.push({ d: pd(i.issue_date), desc: t("Invoice") + " " + invNum(i.number), chg: Number(i.total) || 0, pay: 0 }); });
    (data.payments || []).filter(only).forEach(function (p) { ev.push({ d: pd(p.date), desc: t("Payment") + (p.method ? " · " + p.method : "") + (p.invoice ? " (" + invNum(p.invoice) + ")" : ""), chg: 0, pay: Number(p.amount) || 0 }); });
    ev = ev.filter(function (e) { return e.d; }).sort(function (a, b) { return a.d - b.d || b.chg - a.chg; });
    var open = 0, rows = [];
    ev.forEach(function (e) { if (from && e.d < from) open += e.chg - e.pay; else if (e.d <= to) rows.push(e); });
    var bal = open, esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var df = function (d) { return d.toLocaleDateString(LOC(), { month: "short", day: "numeric", year: "numeric" }); };
    var tr = rows.map(function (e) { bal += e.chg - e.pay; return "<tr><td>" + df(e.d) + "</td><td>" + esc(e.desc) + "</td><td class=n>" + (e.chg ? money(e.chg) : "") + "</td><td class=n>" + (e.pay ? money(e.pay) : "") + "</td><td class=n>" + money(bal) + "</td></tr>"; }).join("");
    var c = data.client, b = data.business || {};
    var html = "<!doctype html><html lang=" + lang + "><head><meta charset=utf-8><title>" + esc(t("Statement") + " · " + c.name) + "</title><style>" +
      "body{font:14px/1.45 system-ui,Arial,sans-serif;color:#1c2a20;margin:32px}h1{font-family:Lora,Georgia,serif;color:#1b552b;margin:0 0 4px;font-size:24px}" +
      ".hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1b552b;padding-bottom:14px;margin-bottom:18px}.hd img{width:54px;vertical-align:middle;margin-right:10px}" +
      ".biz{font-family:Lora,Georgia,serif;font-size:18px;color:#1b552b;font-weight:600}table{width:100%;border-collapse:collapse}th{background:#1b552b;color:#fff;text-align:left;padding:8px}" +
      "td{padding:8px;border-bottom:1px solid #e4ece1}td.n,th.n{text-align:right;white-space:nowrap}.tot td{font-weight:700;font-size:16px;border-bottom:0}.muted{color:#58675c}" +
      "@media print{body{margin:14mm}}</style></head><body>" +
      "<div class=hd><div><img src='" + location.origin + "/images/logo-tree-header.png' alt=''><span class=biz>" + esc(b.name || "Latta Corp of Central Florida") + "</span><div class=muted>" + esc(b.phone || PHONE_TXT) + " · " + esc(b.email || SUPPORT) + "</div></div>" +
      "<div style='text-align:right'><h1>" + esc(t("Statement")) + "</h1><div>" + esc(c.name) + "</div>" + (site ? "<div><b>" + esc(site.name) + "</b>" + (site.address && site.address !== site.name ? " · " + esc(site.address) : "") + "</div>" : "") + "<div class=muted>" + (from ? df(from) + " – " : "") + df(to) + "</div></div></div>" +
      "<table><thead><tr><th>" + t("Date") + "</th><th>" + t("Description") + "</th><th class=n>" + t("Charges") + "</th><th class=n>" + t("Payments") + "</th><th class=n>" + t("Balance") + "</th></tr></thead><tbody>" +
      (from ? "<tr><td></td><td>" + t("Opening balance") + "</td><td></td><td></td><td class=n>" + money(open) + "</td></tr>" : "") + tr +
      "<tr class=tot><td></td><td>" + t("Closing balance") + "</td><td></td><td></td><td class=n>" + money(bal) + "</td></tr></tbody></table>" +
      (b.zelle ? "<p style='margin-top:22px'><b>Zelle:</b> " + esc(b.zelle) + "</p>" : "") + "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>";
    var w = window.open("", "_blank");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ---------- Requests ---------- */
  var REQ_STATUS = { "new": ["Received", ""], contacted: ["In progress", "due"], quoted: ["Quote sent", "due"], won: ["Approved", ""], lost: ["Closed", "gray"] };
  function requests(host, prefill) {
    if (isStaff) {
      var sp = panel(host, t("Staff view"));
      sp.appendChild(el("p", "muted", t("Staff view: sending is turned off here so nothing goes out in the client's name. Their form looks like this for them, with their properties and phone filled in.")));
      host = el("div"); host.style.cssText = "opacity:.55;pointer-events:none"; host.setAttribute("aria-hidden", "true"); $("view").appendChild(host);
    }
    var p = panel(host, t("New request"));
    if (flash) { var ok = el("p", "ok", t(flash)); ok.setAttribute("role", "status"); p.appendChild(ok); flash = ""; }
    var f = el("form"); f.noValidate = true; p.appendChild(f);
    var kind = "service";
    f.appendChild(el("p", "muted", t("What do you need?")));
    var seg = el("div", "seg");
    [["service", t("Service or a problem")], ["quote", t("Quote for other work")]].forEach(function (x) {
      var bt = el("button", null, x[1]); bt.type = "button"; bt.setAttribute("aria-pressed", x[0] === kind ? "true" : "false");
      bt.onclick = function () { kind = x[0]; [].forEach.call(seg.children, function (c) { c.setAttribute("aria-pressed", c === bt ? "true" : "false"); }); };
      seg.appendChild(bt);
    });
    f.appendChild(seg);
    var props = data.properties || [];
    var pl = el("label", "f"); pl.appendChild(el("span", null, t("Property"))); var ps = el("select"); pl.appendChild(ps);
    props.forEach(function (x) { var o = el("option", null, (x.label && x.label !== x.address ? x.label + " · " : "") + (x.address || "")); o.value = x.address || x.label || ""; ps.appendChild(o); });
    var oo = el("option", null, t("Other address")); oo.value = ""; ps.appendChild(oo); f.appendChild(pl);
    var dl = el("label", "f"); dl.appendChild(el("span", null, t("Details"))); var ta = el("textarea"); ta.placeholder = t("Tell us what you need, where, and any timing that matters."); if (prefill) ta.value = prefill; dl.appendChild(ta); f.appendChild(dl);
    var phl = el("label", "f"); phl.appendChild(el("span", null, t("Phone"))); var ph = el("input"); ph.type = "tel"; ph.autocomplete = "tel"; ph.value = data.client.phone || ""; phl.appendChild(ph); f.appendChild(phl);
    var er = el("p", "err hide"); er.setAttribute("role", "alert"); f.appendChild(er);
    var sb2 = el("button", "btn", t("Send request")); sb2.type = "submit"; f.appendChild(sb2);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!ta.value.trim()) { er.textContent = t("Please describe what you need."); er.classList.remove("hide"); ta.focus(); return; }
      sb2.disabled = true; sb2.textContent = t("Sending..."); er.classList.add("hide");
      sb.auth.getSession().then(function (r) {
        var tok = r.data && r.data.session && r.data.session.access_token;
        return fetch("/api/portal/request", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok },
          body: JSON.stringify({ client_id: curId, kind: kind, address: ps.value, details: ta.value.trim(), phone: ph.value.trim(), lang: lang }) });
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        flash = "Sent! We'll get back to you within 1 to 3 business days.";
        return loadAccount();
      }).catch(function () { er.textContent = t("Something went wrong. Please try again, or call or text 407-470-5309."); er.classList.remove("hide"); sb2.disabled = false; sb2.textContent = t("Send request"); });
    });

    var rp = panel(host, t("Your requests")), rq = data.requests || [];
    if (!rq.length) { rp.appendChild(el("p", "muted", t("No requests yet."))); return; }
    var l = el("ul", "list"); rq.forEach(function (x) {
      var st = REQ_STATUS[x.status] || REQ_STATUS["new"];
      li(l, { date: x.date, title: t(x.kind) || x.kind, sub: x.service || "", right: pill(t(st[0]), st[1]) });
    });
    rp.appendChild(l);
  }

  /* ---------- Photos ---------- */
  function photos(host) {
    var p = panel(host, t("Photos")), list = data.photos || [];
    if (!list.length) { p.appendChild(el("p", "empty", t("No photos yet. We'll add photos from your visits here."))); return; }
    var g = el("div", "grid"); p.appendChild(g);
    var need = [];
    list.forEach(function (x) { [x.thumb || x.path, x.path].forEach(function (k) { if (k && !photoUrls[k] && need.indexOf(k) < 0) need.push(k); }); });
    var go = need.length ? sb.storage.from("photos").createSignedUrls(need, 3600).then(function (r) {
      (r.data || []).forEach(function (x) { if (x.signedUrl) photoUrls[x.path] = x.signedUrl; });
    }) : Promise.resolve();
    go.then(function () {
      list.forEach(function (x) {
        var src = photoUrls[x.thumb || x.path]; if (!src) return;
        var b = el("button"); b.type = "button"; b.setAttribute("aria-label", x.caption || t("Photos"));
        var im = el("img"); im.src = src; im.alt = x.caption || ""; im.loading = "lazy"; b.appendChild(im);
        b.onclick = function () { var d = $("lb"); d.querySelector("img").src = photoUrls[x.path] || src; d.querySelector(".cap").textContent = [x.caption, x.property, fdate(x.date)].filter(Boolean).join(" · "); d.showModal(); };
        g.appendChild(b);
      });
    });
  }
  $("lb").querySelector(".x").onclick = function () { $("lb").close(); };
  $("lb").addEventListener("click", function (e) { if (e.target === $("lb")) $("lb").close(); });

  /* ---------- Account ---------- */
  function account(host) {
    var c = data.client;
    var a = panel(host, t("Your account"));
    a.appendChild(el("p", null, c.name + (c.company && c.company !== c.name ? " (" + c.company + ")" : "")));
    var ci = panel(host, t("Contact info")), cl = el("ul", "list");
    [[t("Phone"), c.phone], [t("Phone") + " 2", c.phone2], [t("Email"), c.email]].forEach(function (x) { if (x[1]) li(cl, { title: x[1], sub: x[0] }); });
    ci.appendChild(cl);
    var pp = panel(host, t("Properties")), pl = el("ul", "list");
    (data.properties || []).forEach(function (x) { li(pl, { title: x.address || x.label, sub: x.label && x.label !== x.address ? x.label : "" }); });
    if (!(data.properties || []).length) pp.appendChild(el("p", "muted", "–")); else pp.appendChild(pl);
    if ((data.contacts || []).length) {
      var pe = panel(host, t("People with access")), el2 = el("ul", "list");
      li(el2, { title: c.name, sub: t("Account holder") });
      data.contacts.forEach(function (x) { li(el2, { title: x.name, sub: x.role || "" }); });
      pe.appendChild(el2);
    }
    var ch = panel(host, t("Need to change something?"));
    ch.appendChild(el("p", "muted", t("Send us a note and we'll update your account.")));
    var cb = el("button", "btn alt", t("Ask for a change")); cb.type = "button";
    cb.onclick = function () { view = "requests"; show("requests"); var h = $("view"); h.textContent = ""; requests(h, t("Please update my account information:") + "\n"); };
    ch.appendChild(cb);
    var so = panel(host);
    sb.auth.getSession().then(function (r) { var em = r.data && r.data.session && r.data.session.user.email; if (em) so.insertBefore(el("p", "muted small", t("Signed in as") + " " + em), so.firstChild); });
    var out = el("button", "btn alt", t("Sign out")); out.type = "button"; out.onclick = signOut; so.appendChild(out);
  }
  function signOut() { sb.auth.signOut().then(function () { data = null; accounts = []; store("lc-portal-acct", null); view = "home"; showSignin(); }); }

  /* ---------- Info (guides live in portal/guides.js) ---------- */
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; });
  function myDevice() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  }
  function isApp() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function L(o) { return o ? (lang === "es" && o.es ? o.es : o.en) : ""; }
  // Guide text: phone numbers and emails become tap-to-call / tap-to-email links (kept on one line).
  function linkify(node, text) {
    var re = /(\d{3}-\d{3}-\d{4})|([^\s@]+@[^\s@]+\.[a-z]{2,})/gi, last = 0, m;
    text = String(text || "");
    while ((m = re.exec(text))) {
      node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el("a", null, m[0].replace(/[.,]$/, "")); a.style.whiteSpace = "nowrap";
      a.href = m[1] ? "tel:" + m[1].replace(/-/g, "") : "mailto:" + a.textContent;
      node.appendChild(a); last = m.index + a.textContent.length; re.lastIndex = last;
    }
    node.appendChild(document.createTextNode(text.slice(last)));
    return node;
  }
  function info(host) {
    var p = panel(host, t("Info"));
    p.appendChild(el("p", "muted", t("Guides and tips from LattaCorp. More lawn-care guides are on the way.")));
    var guides = window.PORTAL_GUIDES || [], lastTopic = "", dev = myDevice();
    guides.forEach(function (g, gi) {
      var tp = L(g.topic);
      if (tp && tp !== lastTopic) { host.appendChild(el("h2", "topic", tp)); lastTopic = tp; }
      var d = el("details", "guide"); if (gi === 0) d.open = true; d.id = "guide-" + g.id;
      d.appendChild(el("summary", null, L(g.title)));
      var body = el("div", "gbody"); d.appendChild(body);
      if (g.intro) body.appendChild(el("p", null, L(g.intro)));
      if (g.id === "app" && isApp()) body.appendChild(el("p", "ok", t("You're already using the portal as an app on this device.")));
      if (g.id === "app" && installEvt && !isApp()) {
        var ib = el("button", "btn", t("Install the app now")); ib.type = "button";
        ib.onclick = function () { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; ib.remove(); }); };
        body.appendChild(ib); ib.style.marginBottom = "12px";
      }
      var secs = (g.sections || []).slice();
      secs.sort(function (a, b) { return (b.device === dev) - (a.device === dev); });
      secs.forEach(function (sc) {
        var sec = el("div", "gsec" + (sc.device && sc.device === dev ? " mine" : ""));
        var h3 = el("h3", null, L(sc.heading)); if (sc.device === dev) h3.appendChild(pill(t("This device")));
        sec.appendChild(h3);
        if (sc.steps) { var ol = el("ol"); L(sc.steps).forEach(function (x) { ol.appendChild(linkify(el("li"), x)); }); sec.appendChild(ol); }
        if (sc.text) sec.appendChild(linkify(el("p"), L(sc.text)));
        body.appendChild(sec);
      });
      host.appendChild(d);
    });
  }

  /* ---------- More (phones) ---------- */
  function more(host) {
    var p = panel(host), l = el("ul", "list more-menu");
    [["photos", t("Photos")], ["info", t("Info")], ["account", t("Account")]].forEach(function (x) { var i = li(l, { title: x[1] }); i.onclick = function () { show(x[0]); }; i.tabIndex = 0; i.onkeydown = function (e) { if (e.key === "Enter") show(x[0]); }; });
    var o = li(l, { title: t("Sign out") }); o.onclick = signOut; o.tabIndex = 0;
    p.appendChild(l);
  }

  /* ---------- start ---------- */
  applyStatic();
  boot();
})();

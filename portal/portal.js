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
  var PHONE = "4074705309", PHONE_TXT = "407-470-5309", SUPPORT = "Support@LattaCorpFL.com";

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- language ---------- */
  var qs = new URLSearchParams(location.search);
  var lang = qs.get("lang") === "es" ? "es" : store("lc-portal-lang") || ((navigator.language || "").slice(0, 2) === "es" ? "es" : "en");
  var ES = {
    "Something went wrong. Please try again.": "Algo salió mal. Inténtelo de nuevo.",
    "Offers for you": "Ofertas para usted",
    "View & approve": "Ver y aprobar",
    "News from Latta Corp": "Noticias de Latta Corp",
    "Learn more": "Más información",
    "Phone notifications": "Notificaciones en el teléfono",
    "Appearance": "Apariencia",
    "Original": "Original",
    "Charcoal": "Carbón",
    "Slate": "Pizarra",
    "Deep Forest": "Bosque",
    "Charcoal, Slate and Deep Forest are dark styles, easier on the eyes at night.": "Carbón, Pizarra y Bosque son estilos oscuros, más cómodos para la vista de noche.",
    "Get a notification on your phone when something happens on your account.": "Reciba una notificación en su teléfono cuando pase algo en su cuenta.",
    "On iPhone: tap the Share button, then Add to Home Screen. Open the portal from your home screen and come back here.": "En iPhone: toque Compartir y luego Agregar a pantalla de inicio. Abra el portal desde su pantalla de inicio y vuelva aquí.",
    "This browser can't get notifications. On Android, use Chrome.": "Este navegador no puede recibir notificaciones. En Android, use Chrome.",
    "Notifications are blocked for this site. Allow them in your phone's settings, then come back here.": "Las notificaciones están bloqueadas para este sitio. Permítalas en los ajustes de su teléfono y vuelva aquí.",
    "Notifications are on for this phone.": "Las notificaciones están activadas en este teléfono.",
    "Send a test": "Enviar una prueba",
    "Sent. It should pop up in a few seconds.": "Enviada. Debería aparecer en unos segundos.",
    "Turn off on this phone": "Desactivar en este teléfono",
    "Turn on notifications": "Activar notificaciones",
    "Notifications weren't allowed. Tap the button again and choose Allow.": "No se permitieron las notificaciones. Toque el botón otra vez y elija Permitir.",
    "Turned on.": "Activadas.",
    "Notify me about:": "Notificarme sobre:",
    "Saved": "Guardado",
    "New invoices": "Facturas nuevas",
    "Lawn maintenance completed": "Mantenimiento de césped terminado",
    "Offers and recommended services": "Ofertas y servicios recomendados",
    "People on this account": "Personas en esta cuenta",
    "Please enter a name.": "Escriba un nombre.",
    "An email is needed to sign in to the portal.": "Se necesita un correo para entrar al portal.",
    "This account already has the most people allowed. Remove one first.": "Esta cuenta ya tiene el máximo de personas permitido. Quite una primero.",
    "Change this person": "Cambiar esta persona",
    "Add a person": "Agregar una persona",
    "Name": "Nombre",
    "Who they are (spouse, manager, board member...)": "Quién es (cónyuge, administrador, miembro de la junta...)",
    "Can sign in to this portal with their email": "Puede entrar a este portal con su correo",
    "People who can sign in see this account's visits, invoices, balance and photos.": "Las personas que pueden entrar ven las visitas, facturas, saldo y fotos de esta cuenta.",
    "If you change your email, sign in with the new one next time.": "Si cambia su correo, entre con el nuevo la próxima vez.",
    "Save": "Guardar",
    "Cancel": "Cancelar",
    "To change the email you sign in with, send us a note and we'll update it.": "Para cambiar el correo con el que entra, envíenos una nota y lo actualizamos.",
    "Can sign in": "Puede entrar",
    "Change": "Cambiar",
    "Remove": "Quitar",
    "Remove this person from the account?": "¿Quitar a esta persona de la cuenta?",
    "you": "usted",
    "Add a spouse, a property manager or anyone else who should be on your account. You choose who can sign in.": "Agregue a su cónyuge, un administrador o cualquier otra persona que deba estar en su cuenta. Usted decide quién puede entrar.",
    "Change phone": "Cambiar teléfono",
    "Account number": "Número de cuenta", "Paid up": "Al día", "Amount due": "Monto pendiente", "Nothing due": "Nada pendiente", "Last invoice": "Última factura",
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
    "Show more": "Ver más", "Pay by bank": "Pagar con banco", "Also send them our invoice emails": "Enviarle también nuestras facturas por correo", "Gets invoices": "Recibe facturas", "An email is needed to send them invoices.": "Se necesita un correo para enviarle facturas.", "Pay by card": "Pagar con tarjeta", "Opening…": "Abriendo…", "Pay any open invoice online from your bank. No card fees; it takes about 4 business days to clear.": "Pague cualquier factura abierta en línea desde su banco. Sin cargos de tarjeta; tarda unos 4 días hábiles.", "Balance due": "Saldo pendiente", "Credit on account": "Crédito en la cuenta",
    "Pay with Zelle": "Pague con Zelle", "Agreements": "Acuerdos", "Signed agreements are kept permanently and can't be changed or deleted.": "Los acuerdos firmados se guardan permanentemente y no se pueden cambiar ni borrar.", "Loading...": "Cargando...", "Agreements aren't available right now.": "Los acuerdos no están disponibles en este momento.", "Service Agreement": "Acuerdo de Servicio", "Automatic Payment Authorization": "Autorización de Pago Automático", "Signed": "Firmado", "Turned off": "Desactivado", "Active": "Activo", "Nothing signed yet.": "Aún no hay nada firmado.", "Read and sign the Service Agreement": "Leer y firmar el Acuerdo de Servicio", "Set up automatic payments": "Configurar pagos automáticos", "Please sign your Service Agreement": "Por favor firme su Acuerdo de Servicio", "It covers your service, billing and our responsibilities. It takes about two minutes, and a copy stays in your account.": "Cubre su servicio, la facturación y nuestras responsabilidades. Toma unos dos minutos y una copia queda en su cuenta.", "Read and sign": "Leer y firmar", "Back": "Atrás", "This agreement is written in English. Call or text 407-470-5309 if you'd like us to go over it in Spanish.": "Este acuerdo está escrito en inglés. Llame o envíe un texto al 407-470-5309 si desea que lo revisemos en español.", "Client": "Cliente", "Account type": "Tipo de cuenta", "HOA": "HOA", "Commercial": "Comercial", "Residential": "Residencial", "Service property": "Propiedad de servicio", "Service plan": "Plan de servicio", "Payment method": "Método de pago", "Bank account (ACH), no fee": "Cuenta bancaria (ACH), sin cargo", "Credit card, 3% surcharge": "Tarjeta de crédito, recargo del 3%", "Version": "Versión", "How should we charge your invoices?": "¿Cómo debemos cobrar sus facturas?", "Credit card, 3% surcharge (debit cards not accepted)": "Tarjeta de crédito, recargo del 3% (no se aceptan tarjetas de débito)", "You'll connect your bank or card on our secure payment page once online payments open. Nothing is charged until then.": "Conectará su banco o tarjeta en nuestra página de pago segura cuando abran los pagos en línea. No se cobra nada hasta entonces.", "Your full name": "Su nombre completo", "Your title (for example Board President or Property Manager)": "Su cargo (por ejemplo, Presidente de la Junta o Administrador de Propiedades)", "Sign below with your finger or mouse": "Firme abajo con el dedo o el ratón", "Signature": "Firma", "Clear": "Borrar", "I authorize Latta Corp Of Central Florida to charge my invoices automatically as described above, and I agree to sign electronically.": "Autorizo a Latta Corp Of Central Florida a cobrar mis facturas automáticamente como se describe arriba, y acepto firmar electrónicamente.", "I have read and agree to this Service Agreement and the Terms of Service, I am authorized to sign for this account, and I agree to sign electronically.": "He leído y acepto este Acuerdo de Servicio y los Términos de Servicio, estoy autorizado para firmar por esta cuenta y acepto firmar electrónicamente.", "Sign": "Firmar", "Pick bank account or credit card.": "Elija cuenta bancaria o tarjeta de crédito.", "Type your full name.": "Escriba su nombre completo.", "Please sign in the box.": "Por favor firme en el recuadro.", "Please check the box to agree.": "Por favor marque la casilla para aceptar.", "Signing...": "Firmando...", "Signed. A copy was emailed to you and is saved in your account.": "Firmado. Le enviamos una copia por correo y está guardada en su cuenta.", "Signature of": "Firma de", "Signed by": "Firmado por", "Signed on": "Firmado el", "From IP address": "Desde la dirección IP", "Document fingerprint (SHA-256)": "Huella del documento (SHA-256)", "Status": "Estado", "This signed copy is permanent. It can't be changed or deleted by you or by us.": "Esta copia firmada es permanente. Ni usted ni nosotros podemos cambiarla o borrarla.", "Print or save as PDF": "Imprimir o guardar como PDF", "Email me a copy": "Enviarme una copia", "Sent": "Enviada", "Couldn't send": "No se pudo enviar", "Turn off automatic payments": "Desactivar pagos automáticos", "Turn off automatic payments? Your service continues, and you'll pay each invoice yourself.": "¿Desactivar los pagos automáticos? Su servicio continúa y usted pagará cada factura.", "Credit card, 3% surcharge (coming soon)": "Tarjeta de crédito, recargo del 3% (próximamente)", "Next, you'll connect your bank on Stripe's secure page. We never see your bank login or full account number.": "Después conectará su banco en la página segura de Stripe. Nunca vemos su usuario bancario ni su número de cuenta completo.", "Paying from": "Pagando desde", "Bank account": "Cuenta bancaria", "Each invoice is charged on its due date, at least 10 days after we email it.": "Cada factura se cobra en su fecha de vencimiento, al menos 10 días después de enviarla por correo.", "Remove this bank": "Quitar este banco", "Remove this bank? Automatic payments stop until you connect another one.": "¿Quitar este banco? Los pagos automáticos se detienen hasta que conecte otro.", "That card can't be used. We only accept credit cards and bank accounts.": "Esa tarjeta no se puede usar. Solo aceptamos tarjetas de crédito y cuentas bancarias.", "Online payments are opening soon. We'll let you know when you can connect your bank.": "Los pagos en línea abrirán pronto. Le avisaremos cuando pueda conectar su banco.", "No bank connected yet. Nothing will be charged until you connect one.": "Aún no hay banco conectado. No se cobrará nada hasta que conecte uno.", "Connect your bank account": "Conectar su cuenta bancaria", "Opening...": "Abriendo...", "Bank connected. It can take a minute to show here.": "Banco conectado. Puede tardar un minuto en aparecer aquí.", "Bank connection was cancelled. You can try again any time.": "Se canceló la conexión del banco. Puede intentarlo de nuevo cuando quiera.", "Online bank payments are coming soon.": "Los pagos bancarios en línea llegan pronto.", "Automatic bank payments": "Pagos bancarios automáticos", "On": "Activados", "Off": "Desactivados", "Manage automatic payments": "Administrar pagos automáticos", "Cash is welcome too.": "También aceptamos efectivo.", "Checks are accepted for HOA and commercial accounts.": "Aceptamos cheques de cuentas de HOA y comerciales.", "Cash is also accepted.": "También aceptamos efectivo.",
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
  function fdate(s, opt) { var d = pd(s); return d && !isNaN(d) ? d.toLocaleDateString(LOC(), opt || { month: "short", day: "numeric", year: "numeric" }) : ""; }
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
  var payReturn = qs.get("pay"), payMsg = null;
  if (payReturn) history.replaceState(null, "", location.pathname + (qs.get("lang") === "es" ? "?lang=es" : ""));
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
      data = r.data; store("lc-portal-acct", curId);
      if (payReturn) { view = "account"; payMsg = payReturn === "connected" ? { ok: true, text: t("Bank connected. It can take a minute to show here.") } : { ok: false, text: t("Bank connection was cancelled. You can try again any time.") }; payReturn = null; }
      show(view);
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
    if (view === "home") { feed(host); signBanner(host); }
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
  /* credit card (when the business has it on): opens the invoice page with the card form, which shows the fee first */
  var cardOpt = null;
  function cardInfo(tok) {
    if (cardOpt) return cardOpt;
    cardOpt = fetch("/api/card", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "options", t: tok }) })
      .then(function (r) { return r.json(); }).catch(function () { return {}; });
    return cardOpt;
  }
  function cardBtn(tok, fee) {
    var a = el("a", "btn ghost", t("Pay by card") + " (+" + String(fee).replace(/\.0+$/, "") + "%)");
    a.href = "../d/?t=" + encodeURIComponent(tok) + "&card=1";
    a.style.minHeight = "38px"; a.style.padding = "0 14px"; a.style.display = "inline-flex"; a.style.alignItems = "center";
    return a;
  }
  /* one-time "Pay by bank" for an open invoice: opens Stripe's secure page */
  function payBtn(tok) {
    var b = el("button", "btn", t("Pay by bank")); b.type = "button"; b.style.minHeight = "38px"; b.style.padding = "0 14px";
    b.onclick = function () {
      var old = b.textContent; b.disabled = true; b.textContent = t("Opening…");
      fetch("/api/pay-invoice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: tok }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.url) { location.href = j.url; return; } b.disabled = false; b.textContent = old; alert((j && j.error) || t("Something went wrong. Please try again.")); },
              function () { b.disabled = false; b.textContent = old; alert(t("Something went wrong. Please try again.")); });
    };
    return b;
  }
  function docLink(tok, label) { var a = el("a", "btn alt", label || t("View")); a.href = "../d/?t=" + encodeURIComponent(tok); a.target = "_blank"; a.rel = "noopener"; a.style.minHeight = "38px"; a.style.padding = "0 14px"; return a; }

  /* News from Latta Corp and offers (recommended services) for this account */
  function feed(host) {
    var cid = curId;
    sb.rpc("portal_feed", { cid: cid }).then(function (r) {
      if (r.error || !r.data || cid !== curId || view !== "home") return;
      var offers = r.data.offers || [], news = r.data.news || [];
      if (offers.length) {
        var op = panel(host, t("Offers for you")), ol = el("ul", "list");
        offers.forEach(function (o) { li(ol, { title: o.title, sub: money(o.total) + (o.date ? " · " + fdate(String(o.date).slice(0, 10)) : ""), right: docLink(o.token, t("View & approve")) }); });
        op.appendChild(ol);
      }
      if (news.length) {
        var np = panel(host, t("News from Latta Corp"));
        news.forEach(function (n) {
          var b = el("div", "newsitem");
          b.appendChild(el("b", null, n.title));
          if (n.date) b.appendChild(el("div", "muted small", fdate(String(n.date).slice(0, 10))));
          if (n.body) { var bd = el("p", null, n.body); bd.style.whiteSpace = "pre-wrap"; b.appendChild(bd); }
          if (n.link) { var a = el("a", "btn alt sm", t("Learn more")); a.href = n.link; a.target = "_blank"; a.rel = "noopener"; b.appendChild(a); }
          np.appendChild(b);
        });
      }
    });
  }
  /* Phone notifications for this account: each person turns on what they want */
  function pushApi(action, extra) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token;
      return fetch("/api/portal/push", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok },
        body: JSON.stringify(Object.assign({ action: action, client_id: curId }, extra || {})) });
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { j.ok = res.ok && j.ok !== false; return j; }); },
      function () { return { ok: false, error: "offline" }; });
  }
  function keyBytes(b64) { var s2 = b64.replace(/-/g, "+").replace(/_/g, "/"); while (s2.length % 4) s2 += "="; var bin = atob(s2), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function mySub() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return Promise.resolve(null);
    return Promise.race([navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }),
      new Promise(function (res) { setTimeout(function () { res(null); }, 2500); })]);
  }
  // Original (light, the default) or one of three dark styles; each phone remembers its own choice
  function themePanel(tp) {
    var cur = store("theme") || "light", row = el("div", "seg");
    if (cur === "dark") cur = "charcoal";
    if (cur === "auto") cur = "light";
    [["light", t("Original")], ["charcoal", t("Charcoal")], ["slate", t("Slate")], ["forest", t("Deep Forest")]].forEach(function (x) {
      var b = el("button", x[0] === cur ? "on" : "", x[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", x[0] === cur ? "true" : "false");
      b.addEventListener("click", function () {
        try { localStorage.setItem("theme", x[0]); } catch (e) {}
        var h = document.documentElement;
        h.setAttribute("data-theme", x[0] === "light" ? "light" : "dark");
        if (x[0] === "slate" || x[0] === "forest") h.setAttribute("data-dark", x[0]); else h.removeAttribute("data-dark");
        tp.textContent = "";
        tp.appendChild(el("h2", null, t("Appearance")));
        themePanel(tp);
      });
      row.appendChild(b);
    });
    tp.appendChild(row);
    tp.appendChild(el("p", "muted small", t("Charcoal, Slate and Deep Forest are dark styles, easier on the eyes at night.")));
  }
  function notifyPanel(np) {
    var box = el("div"), list = el("div"), msg = el("p", "muted small");
    np.appendChild(el("p", "muted", t("Get a notification on your phone when something happens on your account.")));
    np.appendChild(box); np.appendChild(list); np.appendChild(msg);
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = window.matchMedia && matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    function draw() {
      box.textContent = "";
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        box.appendChild(el("p", "muted small", ios && !standalone
          ? t("On iPhone: tap the Share button, then Add to Home Screen. Open the portal from your home screen and come back here.")
          : t("This browser can't get notifications. On Android, use Chrome.")));
        return;
      }
      if (Notification.permission === "denied") { box.appendChild(el("p", "muted small", t("Notifications are blocked for this site. Allow them in your phone's settings, then come back here."))); return; }
      mySub().then(function (sub) {
        if (sub) {
          box.appendChild(el("p", null, "✓ " + t("Notifications are on for this phone.")));
          var row = el("div", "prow");
          var tb = el("button", "btn alt sm", t("Send a test")); tb.type = "button";
          tb.onclick = function () { pushApi("test").then(function (r) { msg.textContent = r.ok ? t("Sent. It should pop up in a few seconds.") : t("Something went wrong. Please try again."); }); };
          var ob = el("button", "btn alt sm", t("Turn off on this phone")); ob.type = "button";
          ob.onclick = function () { var ep = sub.endpoint; sub.unsubscribe().then(function () { return pushApi("unsubscribe", { endpoint: ep }); }).then(draw); };
          row.appendChild(tb); row.appendChild(ob); box.appendChild(row);
        } else {
          var on = el("button", "btn", t("Turn on notifications")); on.type = "button";
          on.onclick = function () {
            on.disabled = true; msg.textContent = "";
            Notification.requestPermission().then(function (perm) {
              if (perm !== "granted") { on.disabled = false; msg.textContent = t("Notifications weren't allowed. Tap the button again and choose Allow."); return; }
              return pushApi("key").then(function (k) {
                if (!k.ok) throw new Error("key");
                return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.key) }); });
              }).then(function (s2) { return pushApi("subscribe", { sub: s2.toJSON(), label: ios ? "iPhone" : "Phone" }); })
                .then(function (r) { if (!r.ok) throw new Error("save"); msg.textContent = "✓ " + t("Turned on."); draw(); });
            }).catch(function () { on.disabled = false; msg.textContent = t("Something went wrong. Please try again."); });
          };
          box.appendChild(on);
        }
      });
    }
    function drawPrefs() {
      pushApi("get").then(function (r) {
        list.textContent = "";
        if (!r.ok || !r.events) return;
        list.appendChild(el("p", "muted small", t("Notify me about:")));
        var prefs = {};
        r.events.forEach(function (e) { prefs[e.key] = e.on; });
        r.events.forEach(function (e) {
          var l = el("label", "chk"), c = el("input"); c.type = "checkbox"; c.checked = e.on;
          c.onchange = function () { prefs[e.key] = c.checked; pushApi("set", { prefs: prefs }).then(function (x) { msg.textContent = x.ok ? t("Saved") + " ✓" : t("Something went wrong. Please try again."); }); };
          l.appendChild(c); l.appendChild(el("span", null, t(e.label))); list.appendChild(l);
        });
      });
    }
    draw(); drawPrefs();
  }

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
    pay.appendChild(el("p", "small", t(b.payment_note || "Cash is welcome too.")));
    var ct = data.client && data.client.type;
    if ((ct === "hoa" || ct === "commercial") && !/check|cheque/i.test(b.payment_note || "")) pay.appendChild(el("p", "small", t("Checks are accepted for HOA and commercial accounts.")));
    // automatic bank payments: show whether it's set up, with a way to set it up or manage it
    var apx = el("div", "apbox"); pay.appendChild(apx);
    if (!isStaff) Promise.all([payApi("status"), loadAgr()]).then(function (res) {
      var j = res[0] || {}, m = j.method;
      if (!j.enabled) { apx.appendChild(el("p", "small muted", t("Online bank payments are coming soon."))); return; }
      var h = el("p", "small"); h.appendChild(el("b", null, t("Automatic bank payments") + ": "));
      var ap = activeAutopay();
      if (m && m.status === "active" && ap) h.appendChild(document.createTextNode(t("On") + " · " + (m.bank_name || t("Bank account")) + " ••••" + (m.last4 || "")));
      else h.appendChild(document.createTextNode(t("Off")));
      apx.appendChild(h);
      var b = el("button", "btn alt sm", ap ? (m && m.status === "active" ? t("Manage automatic payments") : t("Connect your bank account")) : t("Set up automatic payments")); b.type = "button";
      b.onclick = function () { if (ap) viewSigned(ap); else signView("autopay"); };
      apx.appendChild(b);
    });
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
        var row = li(ol, { title: t("Invoice") + " " + invNum(i.number), sub: fdate(i.issue_date) + (i.due_date ? " · " + t("Due by") + " " + fdate(i.due_date) : "") + (many && !siteKey && siteOf(i.site) ? " · " + siteOf(i.site).name : ""), right: rt });
        if (i.token && Number(i.balance) >= 0.5) {
          var pw = el("div"); pw.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px";
          pw.appendChild(payBtn(i.token)); row.querySelector(".main").appendChild(pw);
          cardInfo(i.token).then(function (o) { if (o && o.on) pw.appendChild(cardBtn(i.token, o.fee)); });
        }
      });
      op.appendChild(ol);
      op.appendChild(el("p", "small muted", t("Pay any open invoice online from your bank. No card fees; it takes about 4 business days to clear.")));
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

  /* ---------- Agreements: the Service Agreement and the Automatic Payment Authorization ----------
     Signed copies are permanent (the database refuses any change or deletion) and always viewable here. */
  var agr = null, agrFor = null;
  function loadAgr(force) {
    if (agr && agrFor === curId && !force) return Promise.resolve(agr);
    var cid = curId;
    return sb.rpc("portal_agreements", { cid: cid }).then(function (r) {
      if (r.error) return null;
      agr = r.data; agrFor = cid; return agr;
    }, function () { return null; });
  }
  function ldate(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(LOC(), { month: "short", day: "numeric", year: "numeric" }); }
  function curVer(kind) { return ((agr && agr.current) || []).filter(function (v) { return v.kind === kind; })[0]; }
  function signedOf(kind) { return ((agr && agr.signed) || []).filter(function (s) { return s.kind === kind; }); }
  function serviceSigned() { var v = curVer("service"); return signedOf("service").some(function (s) { return !v || s.version_id === v.id; }); }
  function activeAutopay() { return signedOf("autopay").filter(function (s) { return !s.cancelled_at; })[0]; }
  function mdBlock(host, text) {
    var list = null, listTag = "";
    function inline(s) {
      var out = document.createDocumentFragment(), parts = String(s).split(/(\*\*[^*]+\*\*)/);
      parts.forEach(function (p) { if (/^\*\*[^*]+\*\*$/.test(p)) out.appendChild(el("b", null, p.slice(2, -2))); else if (p) out.appendChild(document.createTextNode(p)); });
      return out;
    }
    String(text || "").split("\n").forEach(function (line) {
      var m;
      if (!line.trim()) { list = null; return; }
      if ((m = line.match(/^##\s+(.*)/))) { list = null; host.appendChild(el("h3", "agrh", m[1])); return; }
      if ((m = line.match(/^-\s+(.*)/)) || (m = line.match(/^\d+\.\s+(.*)/))) {
        var tag = /^-/.test(line) ? "ul" : "ol";
        if (!list || listTag !== tag) { list = el(tag, "agrlist"); listTag = tag; host.appendChild(list); }
        var li2 = el("li"); li2.appendChild(inline(m[1])); list.appendChild(li2); return;
      }
      list = null; var p = el("p"); p.appendChild(inline(line)); host.appendChild(p);
    });
  }
  function detailsBox(host, d, method) {
    var box = el("div", "agrdet"), rows = [[t("Client"), d.client + (d.company && d.company !== d.client ? " (" + d.company + ")" : "")], [t("Account type"), t(({ hoa: "HOA", commercial: "Commercial" })[d.type] || "Residential")]];
    if (d.account_no) rows.push([t("Account number"), String(d.account_no)]);
    if (d.property) rows.push([t("Service property"), d.property]);
    (d.services || []).forEach(function (s) { rows.push([t("Service plan"), s.title + (s.frequency ? " · " + s.frequency : "") + (s.price != null ? " · " + money(s.price) : "")]); });
    if (method) rows.push([t("Payment method"), method === "ach" ? t("Bank account (ACH), no fee") : t("Credit card, 3% surcharge")]);
    rows.forEach(function (r) { var row = el("div", "agrrow"); row.appendChild(el("span", "muted", r[0])); row.appendChild(el("b", null, r[1])); box.appendChild(row); });
    host.appendChild(box);
  }
  function liveDetails() {
    var c = data.client, prop = (data.properties || []).filter(function (p) { return p.address; })[0];
    return { client: c.name, company: c.company, type: c.type, account_no: c.account_no, property: prop ? prop.address : "",
      services: (data.jobs || []).filter(function (j) { return j.status === "active"; }).map(function (j) { return { title: j.title, frequency: j.frequency, price: j.price }; }) };
  }
  function agreementsPanel(host) {
    var p = panel(host, t("Agreements"));
    if (payMsg) { var pm = el("p", payMsg.ok ? "ok" : "muted", payMsg.text); pm.setAttribute("role", "status"); p.appendChild(pm); payMsg = null; }
    p.appendChild(el("p", "muted small", t("Signed agreements are kept permanently and can't be changed or deleted.")));
    var box = el("div"); box.appendChild(el("p", "muted", t("Loading...")));
    p.appendChild(box);
    loadAgr().then(function (a) {
      box.textContent = "";
      if (!a) { box.appendChild(el("p", "muted", t("Agreements aren't available right now."))); return; }
      var ul = el("ul", "list");
      a.signed.forEach(function (s) {
        var item = li(ul, { title: t(s.title), sub: t("Signed") + " " + ldate(s.signed_at) + " · " + s.typed_name + (s.kind === "autopay" ? " · " + (s.cancelled_at ? t("Turned off") + " " + ldate(s.cancelled_at) : t("Active")) : "") });
        item.classList.add("tap"); item.tabIndex = 0; item.setAttribute("role", "button");
        item.onclick = function () { viewSigned(s); };
        item.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); viewSigned(s); } };
      });
      if (a.signed.length) box.appendChild(ul); else box.appendChild(el("p", "muted", t("Nothing signed yet.")));
      if (isStaff) return;
      var acts = el("div", "acts");
      if (!serviceSigned() && curVer("service")) { var b1 = el("button", "btn", t("Read and sign the Service Agreement")); b1.type = "button"; b1.onclick = function () { signView("service"); }; acts.appendChild(b1); }
      if (!activeAutopay() && curVer("autopay")) { var b2 = el("button", "btn alt", t("Set up automatic payments")); b2.type = "button"; b2.onclick = function () { signView("autopay"); }; acts.appendChild(b2); }
      if (acts.children.length) box.appendChild(acts);
    });
  }
  function signBanner(host) {
    if (isStaff) return;
    loadAgr().then(function (a) {
      if (!a || serviceSigned() || !curVer("service") || view !== "home") return;
      var p = el("section", "panel signnote");
      p.appendChild(el("h2", null, t("Please sign your Service Agreement")));
      p.appendChild(el("p", null, t("It covers your service, billing and our responsibilities. It takes about two minutes, and a copy stays in your account.")));
      var b = el("button", "btn", t("Read and sign")); b.type = "button"; b.onclick = function () { signView("service"); };
      p.appendChild(b);
      var band = host.querySelector(".band");
      if (band && band.nextSibling) host.insertBefore(p, band.nextSibling); else host.appendChild(p);
    });
  }
  function agrPage(title) {
    var host = $("view"); host.textContent = ""; window.scrollTo(0, 0);
    var back = el("button", "btn alt sm", "‹ " + t("Back")); back.type = "button"; back.onclick = function () { show("account"); };
    host.appendChild(back);
    var p = panel(host, title); p.classList.add("agrdoc");
    if (lang === "es") p.appendChild(el("p", "muted small", t("This agreement is written in English. Call or text 407-470-5309 if you'd like us to go over it in Spanish.")));
    return p;
  }
  function signView(kind) {
    var v = curVer(kind); if (!v) return;
    var p = agrPage(t(v.title));
    detailsBox(p, liveDetails(), null);
    var bodyBox = el("div", "agrbody"); mdBlock(bodyBox, v.body); p.appendChild(bodyBox);
    p.appendChild(el("p", "muted small", t("Version") + " " + v.id));
    var f = el("form", "agrsign"); f.noValidate = true;
    var method = null;
    if (kind === "autopay") {
      f.appendChild(el("h3", "agrh", t("How should we charge your invoices?")));
      [["ach", t("Bank account (ACH), no fee")], ["card", t("Credit card, 3% surcharge (coming soon)")]].forEach(function (o) {
        var lb = el("label", "chk"), r = el("input"); r.type = "radio"; r.name = "apm"; r.value = o[0];
        if (o[0] === "card") { r.disabled = true; lb.style.opacity = ".55"; } else { r.checked = true; method = "ach"; }
        r.onchange = function () { method = o[0]; }; lb.appendChild(r); lb.appendChild(document.createTextNode(" " + o[1])); f.appendChild(lb);
      });
      f.appendChild(el("p", "muted small", t("Next, you'll connect your bank on Stripe's secure page. We never see your bank login or full account number.")));
    }
    var nl = el("label", "f"); nl.appendChild(el("span", null, t("Your full name"))); var nm = el("input"); nm.autocomplete = "name"; nm.maxLength = 120;
    nm.value = (data.me && data.me.name) || ""; nl.appendChild(nm); f.appendChild(nl);
    var tl = null;
    if (data.client.type === "hoa" || data.client.type === "commercial") {
      var tlab = el("label", "f"); tlab.appendChild(el("span", null, t("Your title (for example Board President or Property Manager)"))); tl = el("input"); tl.maxLength = 80; tlab.appendChild(tl); f.appendChild(tlab);
    }
    f.appendChild(el("p", "small", t("Sign below with your finger or mouse")));
    var cvw = el("div", "sigwrap"), cv = document.createElement("canvas"); cv.width = 900; cv.height = 260; cv.className = "sigpad"; cv.setAttribute("aria-label", t("Signature")); cvw.appendChild(cv);
    var clr = el("button", "btn alt sm", t("Clear")); clr.type = "button"; cvw.appendChild(clr); f.appendChild(cvw);
    var ink = false, cx = cv.getContext("2d"), drawing = false, last = null;
    cx.lineWidth = 3.2; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#12301b";
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
    cv.addEventListener("pointerdown", function (e) { drawing = true; last = pt(e); cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(last.x, last.y, 1.4, 0, 6.3); cx.fillStyle = cx.strokeStyle; cx.fill(); ink = true; e.preventDefault(); });
    cv.addEventListener("pointermove", function (e) { if (!drawing) return; var q = pt(e); cx.beginPath(); cx.moveTo(last.x, last.y); cx.lineTo(q.x, q.y); cx.stroke(); last = q; e.preventDefault(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { cv.addEventListener(ev, function () { drawing = false; }); });
    clr.onclick = function () { cx.clearRect(0, 0, cv.width, cv.height); ink = false; };
    var ag = el("label", "chk"), ck = el("input"); ck.type = "checkbox"; ag.appendChild(ck);
    ag.appendChild(document.createTextNode(" " + (kind === "autopay"
      ? t("I authorize Latta Corp Of Central Florida to charge my invoices automatically as described above, and I agree to sign electronically.")
      : t("I have read and agree to this Service Agreement and the Terms of Service, I am authorized to sign for this account, and I agree to sign electronically."))));
    f.appendChild(ag);
    var err = el("p", "err hide"); f.appendChild(err);
    var go = el("button", "btn", t("Sign")); go.type = "submit"; f.appendChild(go);
    p.appendChild(f);
    f.onsubmit = function (e) {
      e.preventDefault();
      function bad(m) { err.textContent = m; err.classList.remove("hide"); }
      if (kind === "autopay" && !method) return bad(t("Pick bank account or credit card."));
      if (nm.value.trim().length < 2) return bad(t("Type your full name."));
      if (!ink) return bad(t("Please sign in the box."));
      if (!ck.checked) return bad(t("Please check the box to agree."));
      err.classList.add("hide"); go.disabled = true; go.textContent = t("Signing...");
      sb.rpc("portal_sign", { cid: curId, ver: v.id, p_name: nm.value.trim(), p_title: tl ? tl.value.trim() : null, p_sig: cv.toDataURL("image/png"), p_method: method }).then(function (r) {
        if (r.error) { go.disabled = false; go.textContent = t("Sign"); return bad(r.error.message || t("Something went wrong. Please try again, or call or text 407-470-5309.")); }
        var id = r.data && r.data.id;
        pushApi("agreement-copy", { id: id });
        if (kind === "autopay") { flash = ""; payApi("connect").then(function (j) { if (j.ok && j.url) location.href = j.url; else loadAgr(true).then(function () { show("account"); }); }); return; }
        loadAgr(true).then(function () {
          var s = ((agr && agr.signed) || []).filter(function (x) { return x.id === id; })[0];
          flash = t("Signed. A copy was emailed to you and is saved in your account.");
          if (s) viewSigned(s, true); else show("account");
        });
      }, function () { go.disabled = false; go.textContent = t("Sign"); bad(t("Something went wrong. Please try again, or call or text 407-470-5309.")); });
    };
  }
  function payApi(action) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session && r.data.session.access_token;
      return fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + tok }, body: JSON.stringify({ action: action, client_id: curId }) });
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { j.ok = res.ok && j.ok !== false; return j; }); }, function () { return { ok: false, error: "offline" }; });
  }
  // the bank account automatic payments come from (connected on Stripe's page)
  function bankBox(host) {
    var b = el("div", "agrmeta"); b.appendChild(el("p", "muted", t("Loading..."))); host.appendChild(b);
    payApi("status").then(function (j) {
      b.textContent = "";
      var m = j.method;
      if (m && m.status === "active") {
        var row = el("div", "agrrow"); row.appendChild(el("span", "muted", t("Paying from"))); row.appendChild(el("b", null, (m.bank_name || t("Bank account")) + " ••••" + (m.last4 || ""))); b.appendChild(row);
        b.appendChild(el("p", "small muted", t("Each invoice is charged on its due date, at least 10 days after we email it.")));
        if (!isStaff) {
          var rm = el("button", "btn alt sm", t("Remove this bank")); rm.type = "button";
          rm.onclick = function () { if (!confirm(t("Remove this bank? Automatic payments stop until you connect another one."))) return; rm.disabled = true; payApi("remove").then(function () { b.remove(); bankBox(host); }); };
          b.appendChild(rm);
        }
        return;
      }
      if (m && m.status === "rejected") b.appendChild(el("p", "err", t("That card can't be used. We only accept credit cards and bank accounts.")));
      if (!j.enabled) { b.appendChild(el("p", "muted", t("Online payments are opening soon. We'll let you know when you can connect your bank."))); return; }
      b.appendChild(el("p", null, t("No bank connected yet. Nothing will be charged until you connect one.")));
      if (!isStaff) {
        var c = el("button", "btn", t("Connect your bank account")); c.type = "button";
        c.onclick = function () { c.disabled = true; c.textContent = t("Opening..."); payApi("connect").then(function (r) { if (r.ok && r.url) location.href = r.url; else { c.disabled = false; c.textContent = t("Connect your bank account"); alert(r.error || t("Something went wrong. Please try again, or call or text 407-470-5309.")); } }); };
        b.appendChild(c);
      }
    });
  }
  function viewSigned(s, justSigned) {
    var p = agrPage(t(s.title));
    if (justSigned) { var ok = el("p", "ok"); ok.textContent = t("Signed. A copy was emailed to you and is saved in your account."); p.insertBefore(ok, p.children[1] || null); flash = ""; }
    detailsBox(p, s.details || {}, s.method);
    var bodyBox = el("div", "agrbody"); mdBlock(bodyBox, s.body); p.appendChild(bodyBox);
    var sg = el("div", "agrsig");
    sg.appendChild(el("h3", "agrh", t("Signature")));
    var im = el("img", "sigimg"); im.src = s.signature_png; im.alt = t("Signature of") + " " + s.typed_name; sg.appendChild(im);
    var meta = el("div", "agrmeta");
    [[t("Signed by"), s.typed_name + (s.signer_title ? ", " + s.signer_title : "")], [t("Email"), s.signer_email],
     [t("Signed on"), new Date(s.signed_at).toLocaleString(LOC(), { dateStyle: "long", timeStyle: "short" })], [t("From IP address"), s.ip || "–"],
     [t("Version"), s.version_id], [t("Document fingerprint (SHA-256)"), s.body_sha256]].forEach(function (r) {
      var row = el("div", "agrrow"); row.appendChild(el("span", "muted", r[0])); row.appendChild(el("b", null, r[1])); meta.appendChild(row);
    });
    if (s.kind === "autopay") { var st = el("div", "agrrow"); st.appendChild(el("span", "muted", t("Status"))); st.appendChild(el("b", null, s.cancelled_at ? t("Turned off") + " " + ldate(s.cancelled_at) : t("Active"))); meta.appendChild(st); }
    sg.appendChild(meta); p.appendChild(sg);
    if (s.kind === "autopay" && !s.cancelled_at) { p.appendChild(el("h3", "agrh", t("Bank account"))); bankBox(p); }
    p.appendChild(el("p", "muted small", t("This signed copy is permanent. It can't be changed or deleted by you or by us.")));
    var acts = el("div", "acts");
    var pr = el("button", "btn alt", t("Print or save as PDF")); pr.type = "button"; pr.onclick = function () { window.print(); }; acts.appendChild(pr);
    var em = el("button", "btn alt", t("Email me a copy")); em.type = "button";
    em.onclick = function () { em.disabled = true; pushApi("agreement-copy", { id: s.id, resend: true }).then(function (r) { em.textContent = r.ok ? t("Sent") : t("Couldn't send"); }); };
    acts.appendChild(em);
    if (s.kind === "autopay" && !s.cancelled_at && !isStaff) {
      var off = el("button", "btn alt", t("Turn off automatic payments")); off.type = "button";
      off.onclick = function () {
        if (!confirm(t("Turn off automatic payments? Your service continues, and you'll pay each invoice yourself."))) return;
        off.disabled = true;
        sb.rpc("portal_autopay_cancel", { cid: curId, agreement: s.id }).then(function (r) {
          if (r.error) { off.disabled = false; alert(t("Something went wrong. Please try again, or call or text 407-470-5309.")); return; }
          pushApi("agreement-copy", { id: s.id, cancelled: true });
          loadAgr(true).then(function () { var n = ((agr && agr.signed) || []).filter(function (x) { return x.id === s.id; })[0]; if (n) viewSigned(n); });
        });
      };
      acts.appendChild(off);
    }
    p.appendChild(acts);
  }
  function account(host) {
    var c = data.client;
    var a = panel(host, t("Your account"));
    a.appendChild(el("p", null, c.name + (c.company && c.company !== c.name ? " (" + c.company + ")" : "")));
    if (c.account_no) a.appendChild(el("p", "muted", t("Account number") + ": " + c.account_no));
    var ci = panel(host, t("Contact info")), cl = el("ul", "list");
    [[t("Phone"), c.phone], [t("Phone") + " 2", c.phone2], [t("Email"), c.email]].forEach(function (x) { if (x[1]) li(cl, { title: x[1], sub: x[0] }); });
    ci.appendChild(cl);
    var pp = panel(host, t("Properties")), pl = el("ul", "list");
    (data.properties || []).forEach(function (x) { li(pl, { title: x.address || x.label, sub: x.label && x.label !== x.address ? x.label : "" }); });
    if (!(data.properties || []).length) pp.appendChild(el("p", "muted", "–")); else pp.appendChild(pl);
    var pe = panel(host, t("People on this account"));
    people(pe, ci, cl);
    agreementsPanel(host);
    themePanel(panel(host, t("Appearance")));
    if (!isStaff) notifyPanel(panel(host, t("Phone notifications")));
    var ch = panel(host, t("Need to change something?"));
    ch.appendChild(el("p", "muted", t("Send us a note and we'll update your account.")));
    var cb = el("button", "btn alt", t("Ask for a change")); cb.type = "button";
    cb.onclick = function () { view = "requests"; show("requests"); var h = $("view"); h.textContent = ""; requests(h, t("Please update my account information:") + "\n"); };
    ch.appendChild(cb);
    var so = panel(host);
    sb.auth.getSession().then(function (r) { var em = r.data && r.data.session && r.data.session.user.email; if (em) so.insertBefore(el("p", "muted small", t("Signed in as") + " " + em), so.firstChild); });
    var out = el("button", "btn alt", t("Sign out")); out.type = "button"; out.onclick = signOut; so.appendChild(out);
  }
  /* People on the account: the account holder can add, change and remove people; a contact can change their own entry. */
  function people(pe, ci, cl) {
    var box = el("div"); pe.appendChild(box);
    var c = data.client, cid = c.id;
    function fail(er, e) {
      var m = String((e && e.message) || "");
      er.textContent = t(/name_required/.test(m) ? "Please enter a name." : /bad_email/.test(m) ? "Enter a valid email." : /invoice_email_required/.test(m) ? "An email is needed to send them invoices." : /email_required/.test(m) ? "An email is needed to sign in to the portal." : /too_many/.test(m) ? "This account already has the most people allowed. Remove one first." : "Something went wrong. Please try again, or call or text 407-470-5309.");
      er.classList.remove("hide");
    }
    function field(f, label, type, val, ac) { var l = el("label", "f"); l.appendChild(el("span", null, label)); var i = el("input"); i.type = type; if (ac) i.autocomplete = ac; i.value = val || ""; l.appendChild(i); f.appendChild(l); return i; }
    function load() {
      return sb.rpc("portal_contacts", { cid: cid }).then(function (r) {
        if (r.error || !r.data) throw r.error || new Error("no data");
        draw(r.data);
      }).catch(function () {
        // older database, or offline: fall back to the plain list
        box.textContent = ""; var l = el("ul", "list"); li(l, { title: c.name, sub: t("Account holder") });
        (data.contacts || []).forEach(function (x) { li(l, { title: x.name, sub: x.role || "" }); }); box.appendChild(l);
      });
    }
    function form(d, x) {
      box.textContent = "";
      var own = !d.can_manage, f = el("form"); f.noValidate = true; box.appendChild(f);
      f.appendChild(el("h3", null, t(x ? "Change this person" : "Add a person")));
      var nm = field(f, t("Name"), "text", x && x.name, "off"),
        rl = own ? null : field(f, t("Who they are (spouse, manager, board member...)"), "text", x && x.role, "off"),
        ph = field(f, t("Phone"), "tel", x && x.phone, "off"),
        em = field(f, t("Email"), "email", x && x.email, "off"), ac = null, gi = null;
      if (!own) {
        var al = el("label", "chk"); ac = el("input"); ac.type = "checkbox"; ac.checked = x ? !!x.portal_access : true;
        al.appendChild(ac); al.appendChild(el("span", null, t("Can sign in to this portal with their email"))); f.appendChild(al);
        f.appendChild(el("p", "muted small", t("People who can sign in see this account's visits, invoices, balance and photos.")));
        var il = el("label", "chk"); gi = el("input"); gi.type = "checkbox"; gi.checked = !!(x && x.gets_invoices);
        il.appendChild(gi); il.appendChild(el("span", null, t("Also send them our invoice emails"))); f.appendChild(il);
      } else f.appendChild(el("p", "muted small", t("If you change your email, sign in with the new one next time.")));
      var er = el("p", "err hide"); er.setAttribute("role", "alert"); f.appendChild(er);
      var row = el("div", "prow"), sv = el("button", "btn", t("Save")); sv.type = "submit"; row.appendChild(sv);
      var cn = el("button", "btn alt", t("Cancel")); cn.type = "button"; cn.onclick = load; row.appendChild(cn); f.appendChild(row);
      f.addEventListener("submit", function (e) {
        e.preventDefault(); er.classList.add("hide"); sv.disabled = true;
        sb.rpc("portal_contact_save", { cid: cid, contact: x ? x.id : null, p_name: nm.value, p_role: rl ? rl.value : (x && x.role) || "", p_phone: ph.value, p_email: em.value, p_access: ac ? ac.checked : !!(x && x.portal_access), p_invoices: gi ? gi.checked : null })
          .then(function (r) { sv.disabled = false; if (r.error) return fail(er, r.error); load(); });
      });
      nm.focus();
    }
    function phoneForm(d) {
      ci.textContent = ""; ci.appendChild(el("h2", null, t("Contact info")));
      var f = el("form"); f.noValidate = true; ci.appendChild(f);
      var p1 = field(f, t("Phone"), "tel", d.holder.phone, "tel"), p2 = field(f, t("Phone") + " 2", "tel", d.holder.phone2, "off");
      f.appendChild(el("p", "muted small", t("To change the email you sign in with, send us a note and we'll update it.")));
      var er = el("p", "err hide"); er.setAttribute("role", "alert"); f.appendChild(er);
      var row = el("div", "prow"), sv = el("button", "btn", t("Save")); sv.type = "submit"; row.appendChild(sv);
      var cn = el("button", "btn alt", t("Cancel")); cn.type = "button"; cn.onclick = function () { show("account"); }; row.appendChild(cn); f.appendChild(row);
      f.addEventListener("submit", function (e) {
        e.preventDefault(); sv.disabled = true;
        sb.rpc("portal_holder_phone", { cid: cid, p_phone: p1.value, p_phone2: p2.value }).then(function (r) {
          sv.disabled = false; if (r.error) return fail(er, r.error);
          loadAccount();
        });
      });
    }
    function draw(d) {
      box.textContent = "";
      var l = el("ul", "list"); li(l, { title: d.holder.name || c.name, sub: t("Account holder") });
      (d.contacts || []).forEach(function (x) {
        var mine = d.my_contact_id && x.id === d.my_contact_id, acts = el("div", "pacts");
        if (x.portal_access) acts.appendChild(pill(t("Can sign in")));
        if (x.gets_invoices) acts.appendChild(pill(t("Gets invoices")));
        if (d.can_manage || mine) { var eb = el("button", "btn alt sm", t("Change")); eb.type = "button"; eb.onclick = function () { form(d, x); }; acts.appendChild(eb); }
        if (d.can_manage) {
          var rb = el("button", "btn alt sm danger", t("Remove")); rb.type = "button";
          rb.onclick = function () {
            if (!confirm(t("Remove this person from the account?") + "\n" + x.name)) return;
            rb.disabled = true;
            sb.rpc("portal_contact_remove", { cid: cid, contact: x.id }).then(function (r) { if (r.error) { rb.disabled = false; alert(t("Something went wrong. Please try again, or call or text 407-470-5309.")); return; } load(); });
          };
          acts.appendChild(rb);
        }
        li(l, { title: x.name + (mine ? " (" + t("you") + ")" : ""), sub: [x.role, x.email, x.phone].filter(Boolean).join(" · "), right: acts.firstChild ? acts : null });
      });
      box.appendChild(l);
      if (d.can_manage) {
        var ab = el("button", "btn", t("Add a person")); ab.type = "button"; ab.style.marginTop = "12px"; ab.onclick = function () { form(d, null); }; box.appendChild(ab);
        box.appendChild(el("p", "muted small", t("Add a spouse, a property manager or anyone else who should be on your account. You choose who can sign in.")));
        if (!ci.querySelector(".chg")) { var cb2 = el("button", "btn alt sm chg", t("Change phone")); cb2.type = "button"; cb2.style.marginTop = "10px"; cb2.onclick = function () { phoneForm(d); }; ci.appendChild(cb2); }
      }
    }
    // show the plain list right away, then the live one with its buttons
    var l0 = el("ul", "list"); li(l0, { title: c.name, sub: t("Account holder") });
    (data.contacts || []).forEach(function (x) { li(l0, { title: x.name, sub: x.role || "" }); }); box.appendChild(l0);
    load();
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

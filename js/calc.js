// Instant Price Calculator on the Services page: a rough price per visit for lawn maintenance.
// Rates and options are set in the CRM (Billing > Price calculator > Edit rates and options) and read through one public
// database function (public_pricing). If that cannot be reached, the built-in rates below are used, so the calculator always works.
(function () {
  var root = document.getElementById("pcalc");
  if (!root) return;
  var DEF_OPTS = [
    { id: "fence", en: "Is the yard fenced?", es: "¿El patio tiene cerca?", pct: 25, on: 1 },
    { id: "plants", en: "Lots of plants, trees or obstacles in the lawn?", es: "¿Muchas plantas, árboles u obstáculos en el césped?", pct: 12.5, on: 1 },
    { id: "slope", en: "Steep slope or uneven ground?", es: "¿Pendiente pronunciada o terreno desigual?", pct: 12.5, on: 1 },
    { id: "walks", en: "Long driveway or lots of sidewalks to edge and blow?", es: "¿Entrada larga o muchas aceras para bordear y soplar?", pct: 12.5, on: 1 },
    { id: "water", en: "Pond or lake bank to trim around?", es: "¿Orilla de estanque o lago para recortar?", pct: 12.5, on: 1 }
  ];
  var DEF = { base: 20, per1000: 4, bi: 1.2, minw: 35, minb: 40, step: 5, grass: 52, adderp: 8, maxg: 45000, show: 1, taperAt: 10000, taper: 75 };
  var P = Object.assign({ options: DEF_OPTS }, DEF);
  var L = {
    en: {
      sub: "Pick your lawn size and options to see a rough price per visit. Your final quote is confirmed after we review your property.",
      measure: "I know the size of my", grass: "Lawn (grass only)", lot: "Whole property (house, driveway and yard)",
      sq: "Square feet", ph: "For example: 7500", often: "How often?", weekly: "Weekly", biweekly: "Bi-weekly",
      opts: "Anything that applies to your yard?", est: "Estimated price per visit", about: "About", of: "sq ft of grass",
      other: "Other option", rough: "A rough estimate. Final pricing depends on your property and is confirmed in your quote.",
      big: "That's a large property. Please request a custom quote and we'll price it for you.",
      enter: "Enter your square footage to see a rough price.", cta: "Request an exact quote", min: "Minimum visit price applies.",
      note: "Calculator estimate",
      signup: "Sign up at this price", exact: "Or request an exact quote instead",
      sh: "Sign up at your instant quote price", sd: "We'll lock in this price to start. If, after we review your property, we find something that changes the work, we'll let you know before anything changes. This is not a final contract.",
      nm: "Full name", ph2: "Phone", em: "Email", ad: "Service address", send: "Sign up", sending: "Sending...", back: "Cancel",
      ok: "You're signed up!", ok2: "We received your sign-up at the instant quote price. We'll review your property and confirm within 1 to 3 business days. Need us sooner? Call or text 407-470-5309.",
      err: "Sorry, something went wrong. Please try again or call or text 407-470-5309."
    },
    es: {
      sub: "Elija el tamaño de su césped y las opciones para ver un precio aproximado por visita. Su cotización final se confirma después de revisar su propiedad.",
      measure: "Conozco el tamaño de mi", grass: "Césped (solo pasto)", lot: "Propiedad completa (casa, entrada y patio)",
      sq: "Pies cuadrados", ph: "Por ejemplo: 7500", often: "¿Con qué frecuencia?", weekly: "Semanal", biweekly: "Quincenal",
      opts: "¿Algo de esto aplica a su patio?", est: "Precio estimado por visita", about: "Aproximadamente", of: "pies cuadrados de césped",
      other: "Otra opción", rough: "Un estimado aproximado. El precio final depende de su propiedad y se confirma en su cotización.",
      big: "Es una propiedad grande. Solicite una cotización personalizada y le daremos un precio.",
      enter: "Ingrese sus pies cuadrados para ver un precio aproximado.", cta: "Solicitar una cotización exacta", min: "Se aplica el precio mínimo por visita.",
      note: "Estimado de la calculadora",
      signup: "Inscribirme con este precio", exact: "O solicitar una cotización exacta",
      sh: "Inscríbase con su precio de cotización instantánea", sd: "Reservamos este precio para comenzar. Si después de revisar su propiedad encontramos algo que cambie el trabajo, se lo informaremos antes de cualquier cambio. Esto no es un contrato final.",
      nm: "Nombre completo", ph2: "Teléfono", em: "Correo electrónico", ad: "Dirección del servicio", send: "Inscribirme", sending: "Enviando...", back: "Cancelar",
      ok: "¡Está inscrito!", ok2: "Recibimos su inscripción con el precio de cotización instantánea. Revisaremos su propiedad y confirmaremos en 1 a 3 días hábiles. ¿Nos necesita antes? Llame o envíe un mensaje al 407-470-5309.",
      err: "Lo sentimos, algo salió mal. Inténtelo de nuevo o llame o envíe un mensaje al 407-470-5309."
    }
  };
  var S = { basis: "grass", sq: "", freq: "weekly", pick: {} };

  function num(v, d) { var x = parseFloat(v); return isNaN(x) || x < 0 ? d : x; }
  function merge(p) {
    if (!p || typeof p !== "object") return;
    Object.keys(DEF).forEach(function (k) { P[k] = num(p[k], DEF[k]); });
    if (Array.isArray(p.options)) {
      P.options = p.options.map(function (o, i) {
        return { id: String(o.id || "o" + i), en: String(o.en || ""), es: String(o.es || o.en || ""), pct: isNaN(parseFloat(o.pct)) ? num(o.amt, 0) / 40 * 100 : num(o.pct, 0), on: (o.on === 0 || o.on === false) ? 0 : 1 };
      }).filter(function (o) { return o.en; });
    }
  }
  function ceilStep(x) { return P.step > 0 ? Math.ceil(x / P.step - 1e-9) * P.step : Math.ceil(x - 1e-9); }
  function base(g, freq) {
    var eff = Math.min(g, P.taperAt) + (P.taper / 100) * Math.max(g - P.taperAt, 0);
    var w = P.base + P.per1000 * eff / 1000, raw = freq === "biweekly" ? w * P.bi : w;
    var r = P.step > 0 ? Math.round(raw / P.step) * P.step : Math.round(raw), mn = freq === "biweekly" ? P.minb : P.minw;
    return { price: Math.max(r, mn), atMin: r <= mn };
  }
  // Options add a percentage of the base price; the website adds a % cushion; both round UP to the next $5.
  function web(g, freq, pct) { var b = base(g, freq); return { total: ceilStep(b.price * (1 + pct / 100) * (1 + P.adderp / 100)), atMin: b.atMin }; }
  function ce(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function draw() {
    if (!P.show) { var par = root.closest(".calc"); if (par) par.style.display = "none"; return; }
    var X = L[window.lang === "es" ? "es" : "en"], es = window.lang === "es";
    root.textContent = "";
    root.appendChild(ce("p", "pc-sub", X.sub));

    var row1 = ce("div", "pc-row");
    var l1 = ce("label", null, X.measure), sel = document.createElement("select");
    [["grass", X.grass], ["lot", X.lot]].forEach(function (o) { var op = ce("option", null, o[1]); op.value = o[0]; sel.appendChild(op); });
    sel.value = S.basis; l1.appendChild(sel); row1.appendChild(l1);
    var l2 = ce("label", null, X.sq), inp = document.createElement("input");
    inp.type = "number"; inp.inputMode = "numeric"; inp.min = "0"; inp.placeholder = X.ph; inp.value = S.sq; inp.id = "pc-sq"; l2.appendChild(inp); row1.appendChild(l2);
    root.appendChild(row1);

    var fr = ce("div", "pc-freq"); fr.appendChild(ce("span", null, X.often));
    var grp = ce("div", "freq"); grp.setAttribute("role", "radiogroup"); grp.setAttribute("aria-label", X.often);
    [["weekly", X.weekly], ["biweekly", X.biweekly]].forEach(function (f) {
      var b = ce("button", S.freq === f[0] ? "on" : "", f[1]); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", S.freq === f[0] ? "true" : "false");
      b.addEventListener("click", function () { S.freq = f[0]; draw(); }); grp.appendChild(b);
    });
    fr.appendChild(grp); root.appendChild(fr);

    var opts = P.options.filter(function (o) { return o.on; });
    if (opts.length) {
      root.appendChild(ce("div", "pc-oh", X.opts));
      var ol = ce("div", "pc-opts");
      opts.forEach(function (o) {
        var lb = ce("label", "pc-opt"), c = document.createElement("input"); c.type = "checkbox"; c.checked = !!S.pick[o.id];
        c.addEventListener("change", function () { S.pick[o.id] = c.checked; upd(); });
        lb.appendChild(c); lb.appendChild(ce("span", null, es ? o.es : o.en)); ol.appendChild(lb);
      });
      root.appendChild(ol);
    }
    var out = ce("div", "pc-out"); out.setAttribute("aria-live", "polite"); root.appendChild(out);

    function upd() {
      out.textContent = "";
      var n = parseFloat(S.sq);
      if (!(n > 0)) { out.appendChild(ce("div", "pc-hint", X.enter)); return; }
      var g = S.basis === "lot" ? n * P.grass / 100 : n, gr = Math.round(g);
      if (g > P.maxg) { out.appendChild(ce("div", "pc-big", X.big)); out.appendChild(cta(null)); return; }
      var chosen = P.options.filter(function (o) { return o.on && S.pick[o.id]; }), pct = chosen.reduce(function (t, o) { return t + o.pct; }, 0);
      var b = web(g, S.freq, pct), total = b.total;
      out.appendChild(ce("div", "pc-lbl", X.est));
      var price = ce("div", "pc-price", "$" + total); price.id = "pc-price"; out.appendChild(price);
      var wk = web(g, "weekly", pct).total, bw = web(g, "biweekly", pct).total;
      out.appendChild(ce("div", "pc-alt", X.weekly + ": $" + wk + "  ·  " + X.biweekly + ": $" + bw));
      if (S.basis === "lot") out.appendChild(ce("div", "pc-alt", X.about + " " + gr.toLocaleString(es ? "es-US" : "en-US") + " " + X.of));
      if (b.atMin) out.appendChild(ce("div", "pc-alt", X.min));
      out.appendChild(ce("div", "pc-rough", X.rough));
      var desc = "Lawn maintenance, " + (S.freq === "weekly" ? "weekly" : "bi-weekly") + ", about " + gr.toLocaleString("en-US") + " sq ft of grass" +
        (chosen.length ? " (" + chosen.map(function (o) { return o.en.replace(/\?$/, ""); }).join("; ") + ")" : "");
      var su = ce("button", "btn", X.signup); su.type = "button"; su.addEventListener("click", function () { su.style.display = "none"; out.appendChild(signupForm(desc, total)); });
      out.appendChild(su);
      var ex = cta(desc + ", estimate $" + total + " per visit"); ex.textContent = X.exact; ex.className = "pc-link"; out.appendChild(ex);
    }
    function signupForm(desc, total) {
      var f = ce("form", "pc-su"); f.setAttribute("novalidate", "");
      f.appendChild(ce("h3", null, X.sh)); f.appendChild(ce("p", "pc-rough", X.sd));
      var ins = {};
      [["nm", "text", "name", "name"], ["ph2", "tel", "tel", "phone"], ["em", "email", "email", "email"], ["ad", "text", "street-address", "addr"]].forEach(function (d) {
        var l = ce("label", null, X[d[0]]), i = document.createElement("input"); i.type = d[1]; i.required = true; i.autocomplete = d[2]; l.appendChild(i); f.appendChild(l); ins[d[3]] = i;
      });
      var hp = document.createElement("input"); hp.type = "text"; hp.tabIndex = -1; hp.autocomplete = "off"; hp.setAttribute("aria-hidden", "true"); hp.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px"; f.appendChild(hp);
      var err = ce("p", "pc-err"); err.setAttribute("role", "alert"); err.style.display = "none"; f.appendChild(err);
      var b = ce("button", "btn", X.send); b.type = "submit"; f.appendChild(b);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        for (var k in ins) if (!ins[k].value.trim() || !ins[k].checkValidity()) { ins[k].focus(); ins[k].reportValidity && ins[k].reportValidity(); return; }
        b.disabled = true; b.textContent = X.sending; err.style.display = "none";
        var fields = [{ label: "Full name", value: ins.name.value }, { label: "Phone", value: ins.phone.value }, { label: "Email", value: ins.email.value },
          { label: "Service address", value: ins.addr.value }, { label: "Service", value: "Lawn maintenance" }, { label: "Signed up at instant quote price", value: "$" + total + " per visit" },
          { label: "Calculator details", value: desc }, { label: "Note", value: "Customer signed up at the Instant Quote Calculator price. Price is subject to change after property review." }];
        var done = function () { root.textContent = ""; var t = ce("div", "pc-thanks"); t.setAttribute("role", "status"); t.appendChild(ce("h3", null, X.ok)); t.appendChild(ce("p", null, X.ok2)); root.appendChild(t); t.scrollIntoView({ block: "center" }); };
        if (window.FORM_LIVE === false) { done(); return; }
        fetch("/api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "Instant quote signup", lang: window.lang === "es" ? "es" : "en", lc_trap_7: hp.value, fields: fields, photos: [] }) })
          .then(function (r) { if (!r.ok) throw 0; done(); })
          .catch(function () { err.textContent = X.err; err.style.display = "block"; b.disabled = false; b.textContent = X.send; });
      });
      return f;
    }
    function cta(noteText) {
      var b = ce("button", "btn", X.cta); b.type = "button";
      b.addEventListener("click", function () {
        var s = document.getElementById("svc"), f = document.getElementById("qf"), ta = document.getElementById("qnotes");
        if (s && !s.value) { s.value = "Lawn maintenance"; s.dispatchEvent(new Event("change")); }
        if (ta && noteText && (!ta.value || ta.dataset.calc === "1")) { ta.value = X.note + ": " + noteText; ta.dataset.calc = "1"; }
        if (f) f.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return b;
    }
    sel.addEventListener("change", function () { S.basis = sel.value; upd(); });
    inp.addEventListener("input", function () { S.sq = inp.value; upd(); });
    upd();
  }

  window.drawCalc = draw;
  draw();
  try {
    var cfg = window.CRM_CONFIG;
    if (cfg && cfg.url && window.fetch) {
      fetch(cfg.url + "/rest/v1/rpc/public_pricing", { method: "POST", headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key, "Content-Type": "application/json" }, body: "{}" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j) { merge(j); draw(); } })
        .catch(function () {});
    }
  } catch (e) {}
})();

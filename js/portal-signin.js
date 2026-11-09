/* Sign-in card on the website's Client Portal page (#/portal).
   It does the same thing as the sign-in screen at /portal/: asks for the email on file, has src/worker.js email a
   one-time code, checks the code with Supabase, then opens /portal/. Both pages share the "lc-portal-auth" sign-in
   saved in the browser, so the client lands in the portal already signed in.
   Supabase's script only loads when someone actually uses the card. */
(function () {
  var card = document.getElementById("psi");
  if (!card) return;
  var $ = function (id) { return document.getElementById(id); };
  var AUTH_KEY = "lc-portal-auth", EMAIL_KEY = "lc-portal-email";
  var SB_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  var T = function (s) { return typeof tr === "function" ? tr(s) : s; };
  var curLang = function () { return typeof lang !== "undefined" && lang === "es" ? "es" : "en"; };
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function portalUrl() { return "/portal/" + (curLang() === "es" ? "?lang=es" : ""); }

  var sbReady = null;
  function client() {
    if (!sbReady) sbReady = new Promise(function (res, rej) {
      function make() {
        var C = window.CRM_CONFIG || {};
        res(window.supabase.createClient(C.url, C.key, {
          auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
        }));
      }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement("script"); s.src = SB_SRC; s.async = true;
      s.onload = make; s.onerror = function () { sbReady = null; rej(new Error("load")); };
      document.head.appendChild(s);
    });
    return sbReady;
  }

  // Sets English text shown in the current language; remembering the English lets the site's EN/ES switch redo it.
  function say(node, en) { node.textContent = T(en); if (node.firstChild) node.firstChild._o = en; }
  function msg(id, en, ok) { var p = $(id); if (en) say(p, en); else p.textContent = ""; p.hidden = !en; p.classList.toggle("ok", !!ok); }
  var OOPS = "Something went wrong. Please try again, or call or text 407-470-5309.";
  var BADCODE = "That code didn't work. Check it, or send a new code.";

  function showState() {
    var signedIn = !!store(AUTH_KEY);
    $("psi-in").hidden = !signedIn; $("psi-out").hidden = signedIn;
    say($("psih"), signedIn ? "Welcome back" : "Sign in to your account");
    $("psiopen").href = portalUrl();
    if (!signedIn) {
      $("psiemail").hidden = false; $("psicode").hidden = true;
      var last = store(EMAIL_KEY); if (last && !$("psiem").value) $("psiem").value = last;
    }
  }

  function requestCode(email) {
    var tok = typeof tsToken === "function" ? tsToken($("psiemail")) : Promise.resolve("");
    return tok.then(function (t) {
      return fetch("/api/portal/code", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, lang: curLang(), ts_token: t || "" }) });
    }).then(function (r) {
      if (typeof tsReset === "function") tsReset($("psiemail"));
      if (!r.ok) throw new Error(String(r.status));
      return r.json().catch(function () { return {}; });
    }).then(function (j) {
      var e;
      if (j && j.wait === "minutes") { e = new Error("limit"); e.msg = T("Too many codes were requested for this email. Please use the newest code we sent, or try again in") + " " + j.minutes + " " + T("minutes") + "."; throw e; }
      if (j && j.wait === "seconds") { e = new Error("limit"); e.msg = T("We just sent a code. Please wait a minute before asking for another."); throw e; }
    });
  }

  $("psiemail").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("psiem").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg("psierr", "Enter a valid email."); return; }
    var b = $("psisend"); b.disabled = true; say(b, "Sending...");
    client().catch(function () {}); // start loading Supabase while the email goes out
    requestCode(email).then(function () {
      store(EMAIL_KEY, email); $("psito").textContent = email; msg("psierr", "");
      $("psiemail").hidden = true; $("psicode").hidden = false; msg("psicerr", ""); $("psicd").value = ""; $("psicd").focus();
    }).catch(function (er) { msg("psierr", (er && er.msg) || OOPS); })
      .then(function () { b.disabled = false; say(b, "Send my code"); });
  });

  $("psicd").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 8);
    if (this.value.length === 8) $("psicode").requestSubmit();
  });

  $("psicode").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = store(EMAIL_KEY) || $("psiem").value.trim().toLowerCase(), code = $("psicd").value.trim();
    if (code.length < 6) { msg("psicerr", BADCODE); return; }
    var b = $("psigo"); b.disabled = true; say(b, "Checking...");
    // Supabase makes a "recovery" code for people who already have a sign-in and an "email" code for first-timers.
    var types = ["recovery", "email", "magiclink"], i = 0;
    client().then(function (sb) {
      function next() {
        if (i >= types.length) return Promise.resolve({ error: true });
        return sb.auth.verifyOtp({ email: email, token: code, type: types[i++] }).then(function (r) { return r.error ? next() : r; });
      }
      return next();
    }).then(function (r) {
      if (r.error) { msg("psicerr", BADCODE); b.disabled = false; say(b, "Sign in"); return; }
      say(b, "Opening your portal...");
      location.href = portalUrl();
    }).catch(function () { msg("psicerr", OOPS); b.disabled = false; say(b, "Sign in"); });
  });

  $("psire").addEventListener("click", function () {
    requestCode(store(EMAIL_KEY) || "").then(function () {
      msg("psicerr", "We sent a new code.", true); setTimeout(function () { msg("psicerr", ""); }, 4000);
    }).catch(function (er) { msg("psicerr", (er && er.msg) || OOPS); });
  });
  $("psiother").addEventListener("click", function () { store(EMAIL_KEY, null); $("psiem").value = ""; showState(); $("psiem").focus(); });
  $("psiout").addEventListener("click", function () {
    var done = function () { store(AUTH_KEY, null); showState(); };
    client().then(function (sb) { return sb.auth.signOut({ scope: "local" }); }).then(done, done);
  });

  if (typeof tsAttach === "function") tsAttach($("psiemail"));
  showState();
  window.addEventListener("hashchange", function () { if (location.hash.indexOf("/portal") > -1) showState(); });
  window.addEventListener("storage", function (e) { if (e.key === AUTH_KEY) showState(); });
})();

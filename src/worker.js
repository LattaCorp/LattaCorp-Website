import { makeVapidKeys, sendPush } from "./push.js";
// Latta Corp website server code (Cloudflare Worker).
// The static website is served automatically. This file only handles form submissions sent to /api/submit:
// it emails them to the business through Resend. Settings: TO_EMAIL (wrangler.jsonc) and RESEND_API_KEY (a secret
// set in the Cloudflare dashboard: Workers & Pages > lattacorp-website > Settings > Variables and Secrets).

// Used if the TO_EMAIL setting is missing in Cloudflare.
const DEFAULT_TO = "lattacorpofcentralfl@gmail.com";
// Who form emails come FROM. FROM_EMAIL (wrangler.jsonc) uses our own verified domain; this shared Resend address is
// the backup if Resend ever refuses it.
const FALLBACK_FROM = "Latta Corp Website <onboarding@resend.dev>";
// Emails to CUSTOMERS come from two automated addresses (not monitored); replies are routed to Support@:
//   website@  -> account emails: sign-in codes, portal invitations
//   billing@  -> billing emails: invoices, reminders, receipts (used when automatic billing emails are added)
// Form notifications to the business still come from FROM_EMAIL. Support@ is the one address people talk to.
const AUTO_FROM = "Latta Corp of Central Florida <website@lattacorpfl.com>";
const BILLING_FROM = "Latta Corp Billing <billing@lattacorpfl.com>";
const SUPPORT_EMAIL = "Support@LattaCorpFL.com";
// Marks a message as automatic, so mail programs don't send vacation auto-replies to it.
const AUTO_HEADERS = { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" };
// The CRM database (Supabase). The URL is public; the secret key SUPABASE_SECRET_KEY is set in Cloudflare (Settings > Variables and Secrets).
const DEFAULT_SUPABASE_URL = "https://lvaofwtfxwlqwvzesckt.supabase.co";
// Public (browser-safe) key, the same one in crm/config.js. Used only to ask Supabase who a signed-in person is.
const PUBLISHABLE_KEY = "sb_publishable_1N8kZ8Zk5YvMA0W8Fzpsnw_jWvkrVlK";
const KINDS = ["Quote request", "Service request", "Contact message", "Proposal request", "Instant quote signup"];
const MAX_FIELDS = 60, MAX_VALUE = 5000, MAX_PHOTOS = 8, MAX_PHOTO_BYTES = 4 * 1024 * 1024, MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// Saves the submission as a lead in the CRM database. Never throws; returns true if saved.
async function saveLead(env, kind, lang, fields, photoCount, clientId) {
  if (!env.SUPABASE_SECRET_KEY) return false;
  const pick = (re) => (fields.find((f) => re.test(f.label)) || {}).value || "";
  const row = {
    kind, lang: String(lang || "en").slice(0, 5),
    name: pick(/name/i).slice(0, 200), email: pick(/^e-?mail/i).slice(0, 200), phone: pick(/phone/i).slice(0, 60),
    address: (pick(/address/i) || pick(/community/i)).slice(0, 300), service: pick(/^service(s)?\b|which services/i).slice(0, 300),
    fields, photo_count: photoCount,
  };
  if (clientId) row.client_id = clientId;
  try {
    const res = await fetch(`${env.SUPABASE_URL || DEFAULT_SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SECRET_KEY, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) console.log("lead save failed", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) { console.log("lead save error"); return false; }
}

// Sends one email through Resend. If Resend refuses our own sender address (for example the domain isn't verified
// yet), it is sent again from Resend's shared address so it still arrives (that address can only reach our own inbox).
async function sendViaResend(env, payload) {
  const send = (body) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    let res = await send(payload);
    if (!res.ok && payload.from !== FALLBACK_FROM && (res.status === 403 || res.status === 422)) {
      console.log("sender refused, retrying from the fallback address", res.status, (await res.text()).slice(0, 200));
      res = await send({ ...payload, from: FALLBACK_FROM });
    }
    if (!res.ok) console.log("email not sent", res.status);
    return res.ok;
  } catch { return false; }
}

// Email subject by form, so the inbox can be scanned at a glance:
//   Quote – Jane Doe – 123 Main St          Service Request – Jane Doe – 45 Oak Ln (The Oaks)
//   Message – Jane Doe                      Proposal – Jane Doe – Oak Grove HOA, 9 Palm Dr
//   Sign-up $45/visit – Jane Doe – 123 Main St
// "(Spanish)" is added when the visitor used the Spanish site, so you know to reply in Spanish.
const SUBJECT_WORD = { "Quote request": "Quote", "Service request": "Service Request", "Contact message": "Message", "Proposal request": "Proposal", "Instant quote signup": "Sign-up" };
function emailSubject(kind, fields, lang) {
  const get = (re) => ((fields.find((f) => re.test(f.label)) || {}).value || "").replace(/\s+/g, " ").trim();
  const name = get(/name$/i) || get(/name/i);
  let where = "";
  if (kind === "Service request") {
    const home = get(/home address/i), com = get(/^community$/i);
    where = home && com ? `${home} (${com})` : home || com || get(/address/i);
  } else if (kind === "Proposal request") {
    where = [get(/community or property name/i), get(/property address/i)].filter(Boolean).join(", ");
  } else if (kind !== "Contact message") {
    where = get(/address/i);
  }
  let word = SUBJECT_WORD[kind] || kind;
  if (kind === "Instant quote signup") { const p = get(/instant quote price/i).replace(/\s*per visit/i, "/visit"); if (p) word += " " + p; }
  const parts = [word, name.slice(0, 60), where.slice(0, 90)].filter(Boolean);
  const portal = get(/^sent from$/i) === "Client portal" ? " · Portal" : "";
  return (parts.join(" – ") + portal + (String(lang || "") === "es" ? " (Spanish)" : "")).replace(/[\r\n]/g, " ").slice(0, 200);
}

// Cloudflare Turnstile ("not a robot" check). Only runs once the secret TURNSTILE_SECRET_KEY is set in Cloudflare.
// A message that fails the check is rejected. If Cloudflare's check itself can't be reached, the message is let through
// (the hidden spam trap still applies), so a Cloudflare hiccup never loses a real customer's request.
async function passesTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET_KEY);
    form.append("response", String(token).slice(0, 2048));
    if (ip) form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    if (!res.ok) { console.log("turnstile check unavailable", res.status); return true; }
    const out = await res.json();
    if (!out.success) console.log("turnstile failed", JSON.stringify(out["error-codes"] || []));
    return Boolean(out.success);
  } catch { console.log("turnstile check unreachable"); return true; }
}

export async function handleSubmit(request, env) {
  // The browser sends one JSON message: { kind, lang, lc_trap_7, ts_token, fields: [...], photos: [{ filename, content (base64) }] }.
  // Photos are encoded to base64 in the visitor's browser so this server code stays very light.
  let data;
  try { data = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  if (!data || typeof data !== "object") return json({ error: "bad request" }, 400);

  // Spam trap: a hidden box people never fill in.
  if (String(data.lc_trap_7 || "").trim() !== "") { console.log("spam trap triggered; message dropped"); return json({ error: "rejected" }, 400); }

  const kind = String(data.kind || "");
  if (!KINDS.includes(kind)) return json({ error: "bad kind" }, 400);

  if (!(await passesTurnstile(env, data.ts_token, request.headers.get("CF-Connecting-IP")))) return json({ error: "verification failed" }, 403);

  let fields = data.fields;
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > MAX_FIELDS) return json({ error: "bad fields" }, 400);
  fields = fields.map((f) => ({ label: String((f && f.label) || "").slice(0, 200), value: String((f && f.value) || "").slice(0, MAX_VALUE) }));

  const attachments = [];
  let total = 0;
  for (const ph of Array.isArray(data.photos) ? data.photos : []) {
    if (attachments.length >= MAX_PHOTOS) break;
    const content = String((ph && ph.content) || "");
    if (!/^[A-Za-z0-9+/=]+$/.test(content.slice(0, 200))) continue;
    const bytes = Math.floor(content.length * 0.75);
    if (bytes > MAX_PHOTO_BYTES) continue;
    total += bytes;
    if (total > MAX_TOTAL_BYTES) break;
    const name = String((ph && ph.filename) || "photo.jpg").replace(/[^\w.\- ]/g, "_").slice(0, 80);
    attachments.push({ filename: name, content });
  }

  const pick = (re) => (fields.find((f) => re.test(f.label)) || {}).value || "";
  const name = pick(/name/i);
  const email = pick(/^e-?mail/i);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const rows = fields.map((f) => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555"><b>${esc(f.label)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(f.value)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px"><h2 style="color:#1b552b;margin:0 0 12px">${esc(kind)}</h2><table>${rows}</table>`
    + `<p style="color:#777;margin-top:16px">Sent from the Latta Corp website (${esc(String(data.lang || "en") === "es" ? "Spanish" : "English")} page)`
    + `${attachments.length ? `, with ${attachments.length} photo${attachments.length > 1 ? "s" : ""} attached` : ""}.</p></div>`;

  const payload = {
    from: env.FROM_EMAIL || FALLBACK_FROM,
    to: [env.TO_EMAIL || DEFAULT_TO],
    subject: emailSubject(kind, fields, data.lang),
    html,
  };
  if (emailOk) payload.reply_to = email;
  if (attachments.length) payload.attachments = attachments;

  // Save to the CRM and (depending on the setting in Foreman) email it at the same time, then ping the office phones.
  // The visitor sees success if at least one of them worked. If saving to Foreman fails, the email always goes out.
  const fe = await formEmailSetting(env);
  const wantEmail = fe === "all" || (fe === "photos" && attachments.length > 0);
  const saved = await saveLead(env, kind, data.lang, fields, attachments.length);
  const emailed = wantEmail || !saved ? await sendViaResend(env, payload) : false;
  if (!emailed && !saved) return json({ error: "email failed" }, 502);
  const ev = kind === "Service request" ? "service" : kind === "Contact message" ? "contact" : "lead";
  const what = pick(/^service(s)?\b|which services/i) || pick(/community/i) || pick(/address/i);
  await notify(env, ev, `${kind}: ${name || "New"}`, [what, attachments.length ? attachments.length + " photo" + (attachments.length > 1 ? "s" : "") : ""].filter(Boolean).join(" · ") || "Open Foreman to see it.", "/crm/?go=leads");
  return json({ ok: true });
}

// ---- Crew logins: the owner creates / resets / removes a crew member's login from inside the CRM. ----
// The caller must be signed in to the CRM as the owner (their email is on the staff list). The secret key never leaves this server.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const baseUrl = (env) => env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const adminHeaders = (env) => ({ apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, "content-type": "application/json" });
const errText = async (res) => { try { const j = await res.json(); return String(j.msg || j.message || j.error_description || j.error || res.status).slice(0, 200); } catch { return String(res.status); } };

async function callerEmail(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return "";
  try {
    const u = await fetch(`${baseUrl(env)}/auth/v1/user`, { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return "";
    return String((await u.json()).email || "").toLowerCase();
  } catch { return ""; }
}
// Owners (and co-owners) may manage crew logins and the team. Before the Stage 7 SQL is run, anyone on the staff list counts as an owner.
async function callerIsOwner(request, env) {
  const email = await callerEmail(request, env);
  if (!email) return "";
  const row = await staffRow(env, email);
  return row && row.role === "owner" ? email : "";
}
async function staffRow(env, email) {
  let res = await fetch(`${baseUrl(env)}/rest/v1/staff?select=email,name,role,user_id&email=ilike.${encodeURIComponent(email)}`, { headers: { apikey: env.SUPABASE_SECRET_KEY } });
  if (!res.ok) res = await fetch(`${baseUrl(env)}/rest/v1/staff?select=email&email=ilike.${encodeURIComponent(email)}`, { headers: { apikey: env.SUPABASE_SECRET_KEY } });
  if (!res.ok) return null;
  const r = (await res.json()).find((x) => String(x.email).toLowerCase() === email.toLowerCase());
  return r ? { role: "owner", name: "", user_id: null, ...r } : null;
}
async function emailOnStaff(env, email) { return Boolean(await staffRow(env, email)); }

export async function handleCrewLogin(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "The CRM key is not set up on the server." }, 500);
  if (!(await callerIsOwner(request, env))) return json({ error: "Not allowed." }, 403);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String((d && d.action) || ""), crewId = String((d && d.crew_id) || "");
  if (!UUID.test(crewId)) return json({ error: "bad crew member" }, 400);
  const base = baseUrl(env), H = adminHeaders(env);
  const cr = await fetch(`${base}/rest/v1/crew?select=id,user_id&id=eq.${crewId}`, { headers: { apikey: env.SUPABASE_SECRET_KEY } });
  if (!cr.ok) return json({ error: "Could not look up that crew member. Did you run the Stage 4 SQL?" }, 502);
  const row = (await cr.json())[0];
  if (!row) return json({ error: "Crew member not found." }, 404);
  const password = String((d && d.password) || "");
  const setCrew = (patch) => fetch(`${base}/rest/v1/crew?id=eq.${crewId}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });

  if (action === "create") {
    const email = String(d.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);
    if (row.user_id) return json({ error: "This person already has a login." }, 409);
    if (await emailOnStaff(env, email)) return json({ error: "That email belongs to the owner account. Use a different one." }, 400);
    const cu = await fetch(`${base}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true }) });
    if (!cu.ok) return json({ error: await errText(cu) }, 400);
    const user = await cu.json();
    const up = await setCrew({ kind: "login", user_id: user.id, email });
    if (!up.ok) { await fetch(`${base}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: H }); return json({ error: "Could not link the login. Did you run the Stage 4 SQL?" }, 502); }
    return json({ ok: true });
  }
  if (!row.user_id) return json({ error: "This person has no login." }, 400);
  if (action === "reset") {
    if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);
    const r = await fetch(`${base}/auth/v1/admin/users/${row.user_id}`, { method: "PUT", headers: H, body: JSON.stringify({ password }) });
    return r.ok ? json({ ok: true }) : json({ error: await errText(r) }, 400);
  }
  if (action === "remove") {
    const r = await fetch(`${base}/auth/v1/admin/users/${row.user_id}`, { method: "DELETE", headers: H });
    if (!r.ok && r.status !== 404) return json({ error: await errText(r) }, 400);
    await setCrew({ kind: "temp", user_id: null, email: "" });
    return json({ ok: true });
  }
  return json({ error: "bad action" }, 400);
}

// ---- Team: owners add / change / remove the people who can sign in to the CRM. ----
export async function handleTeam(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "The CRM key is not set up on the server." }, 500);
  const me = await callerIsOwner(request, env);
  if (!me) return json({ error: "Not allowed." }, 403);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String((d && d.action) || ""), base = baseUrl(env), H = adminHeaders(env);
  const email = String((d && d.email) || "").trim().toLowerCase(), password = String((d && d.password) || "");
  const role = String((d && d.role) || "");
  if (action === "list") {
    const r = await fetch(`${base}/rest/v1/staff?select=email,name,role,user_id&order=email.asc`, { headers: { apikey: env.SUPABASE_SECRET_KEY } });
    if (!r.ok) return json({ error: "Could not read the team. Did you run the Stage 7 SQL?" }, 502);
    return json({ ok: true, me, members: (await r.json()).map((m) => ({ email: m.email, name: m.name || "", role: m.role, hasLogin: Boolean(m.user_id) })) });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
  const patchStaff = (patch) => fetch(`${base}/rest/v1/staff?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (action === "create") {
    const name = String((d && d.name) || "").trim().slice(0, 80);
    if (!name) return json({ error: "Enter a name." }, 400);
    if (role !== "owner" && role !== "office") return json({ error: "Pick a role." }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);
    if (await emailOnStaff(env, email)) return json({ error: "That email is already on the team." }, 409);
    const cu = await fetch(`${base}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true }) });
    if (!cu.ok) return json({ error: await errText(cu) }, 400);
    const user = await cu.json();
    const ins = await fetch(`${base}/rest/v1/staff`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ email, name, role, user_id: user.id }) });
    if (!ins.ok) { await fetch(`${base}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: H }); return json({ error: "Could not add them to the team. Did you run the Stage 7 SQL?" }, 502); }
    return json({ ok: true });
  }
  const row = await staffRow(env, email);
  if (!row) return json({ error: "That person is not on the team." }, 404);
  if (action === "role") {
    if (role !== "owner" && role !== "office") return json({ error: "Pick a role." }, 400);
    if (email === me) return json({ error: "You can't change your own role." }, 400);
    const r = await patchStaff({ role });
    return r.ok ? json({ ok: true }) : json({ error: "Could not change the role." }, 502);
  }
  if (action === "reset") {
    if (password.length < 8 || password.length > 72) return json({ error: "Password must be 8 to 72 characters." }, 400);
    if (!row.user_id) return json({ error: "This account wasn't created from the Team screen, so its password can't be reset here." }, 400);
    const r = await fetch(`${base}/auth/v1/admin/users/${row.user_id}`, { method: "PUT", headers: H, body: JSON.stringify({ password }) });
    return r.ok ? json({ ok: true }) : json({ error: await errText(r) }, 400);
  }
  if (action === "remove") {
    if (email === me) return json({ error: "You can't remove yourself." }, 400);
    if (row.user_id) { const r = await fetch(`${base}/auth/v1/admin/users/${row.user_id}`, { method: "DELETE", headers: H }); if (!r.ok && r.status !== 404) return json({ error: await errText(r) }, 400); }
    const del = await fetch(`${base}/rest/v1/staff?email=eq.${encodeURIComponent(email)}`, { method: "DELETE", headers: { ...H, Prefer: "return=minimal" } });
    return del.ok ? json({ ok: true }) : json({ error: "Could not remove them." }, 502);
  }
  return json({ error: "bad action" }, 400);
}

// ============================ Client portal (lattacorpfl.com/portal/) ============================
// Clients sign in with a one-time code emailed to them. A code is only sent to an email that belongs to a client
// or to an Other contact with "Portal access" ticked in the CRM; every visitor gets the same "check your email" reply,
// so nobody can find out who is a customer. What a signed-in client can see is decided inside the database (Stage 23).
const PORTAL_URL = "https://lattacorpfl.com/portal/";
const SITE = "https://lattacorpfl.com";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const sbRest = (env, path, init = {}) => fetch(`${baseUrl(env)}/rest/v1/${path}`, {
  ...init, headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`, "content-type": "application/json", ...(init.headers || {}) },
});
const bearer = (request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

// Branded email (logo, green header, one big button). Used for sign-in codes and invitations.
function portalEmail({ heading, lines, code, button, link, small, es, foot }) {
  const p = (t) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#1c2a20">${t}</p>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f7f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f1;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4ece1;font-family:Georgia,'Times New Roman',serif">
<tr><td style="background:#1b552b;padding:20px 24px" align="left">
<img src="${SITE}/images/logo-tree-header.png" width="40" height="37" alt="" style="vertical-align:middle;border:0">
<span style="vertical-align:middle;color:#ffffff;font-size:19px;font-weight:600;margin-left:10px">Latta Corp of Central Florida</span></td></tr>
<tr><td style="padding:28px 28px 8px">
<h1 style="margin:0 0 16px;font-size:22px;color:#1b552b;font-weight:600">${heading}</h1>
${lines.map(p).join("")}
${code ? `<div style="margin:6px 0 20px;padding:16px;text-align:center;background:#eff8ec;border-radius:10px;font-family:Arial,sans-serif;font-size:32px;letter-spacing:8px;font-weight:700;color:#1b552b">${esc(code)}</div>` : ""}
${button ? `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#1b552b;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:16px;padding:13px 26px;border-radius:6px">${button}</a></p>` : ""}
${small ? `<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#58675c">${small}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e4ece1;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#58675c">
${foot || (es ? "Este es un mensaje automático. Por favor no responda a este correo. ¿Preguntas? Escriba a" : "This is an automated message. Please don't reply to this email. Questions? Email")} <a href="mailto:${SUPPORT_EMAIL}" style="color:#1b552b">${SUPPORT_EMAIL}</a> ${es ? "o llame o envíe un texto al" : "or call or text"} <a href="tel:4074705309" style="color:#1b552b">407-470-5309</a>.<br>
Latta Corp of Central Florida · Kissimmee, FL · <a href="${SITE}" style="color:#1b552b">lattacorpfl.com</a></td></tr>
</table></td></tr></table></body></html>`;
}
// Plain-text twin of portalEmail (mail filters trust messages that include one).
function portalText({ heading, lines, code, button, link, small, es, foot }) {
  const strip = (s) => String(s).replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  return [strip(heading), "", ...lines.map(strip), code ? "\n" + code + "\n" : "", button ? strip(button) + ": " + link : "", small ? "\n" + strip(small) : "",
    "\n--", foot ? foot.replace(/<[^>]+>/g, "") + " " + SUPPORT_EMAIL + " or 407-470-5309." : es ? "Este es un mensaje automático. Por favor no responda. ¿Preguntas? " + SUPPORT_EMAIL + " o 407-470-5309."
               : "This is an automated message. Please don't reply. Questions? " + SUPPORT_EMAIL + " or 407-470-5309.",
    "Latta Corp of Central Florida · Kissimmee, FL · lattacorpfl.com"].filter((x) => x !== "").join("\n");
}

export async function handlePortalCode(request, env) {
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return json({ error: "The portal is not set up on the server." }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const email = String((d && d.email) || "").trim().toLowerCase().slice(0, 200);
  const es = String((d && d.lang) || "") === "es";
  if (!EMAIL_RE.test(email)) return json({ error: "bad email" }, 400);
  if (!(await passesTurnstile(env, d.ts_token, request.headers.get("CF-Connecting-IP")))) return json({ error: "verification failed" }, 403);

  // At most one code every 45 seconds and 5 an hour per email, so nobody can flood an inbox.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const rl = await sbRest(env, `portal_signins?select=created_at&email=eq.${encodeURIComponent(email)}&created_at=gte.${since}&order=created_at.desc&limit=10`);
  if (rl.ok) {
    const rows = await rl.json();
    // Say so (it doesn't reveal whether the email is a customer: the same limit applies to every email).
    if (rows[0] && Date.now() - Date.parse(rows[0].created_at) < 45000) return json({ ok: true, wait: "seconds" });
    if (rows.length >= 5) {
      const mins = Math.max(1, Math.ceil((Date.parse(rows[rows.length - 1].created_at) + 3600 * 1000 - Date.now()) / 60000));
      return json({ ok: true, wait: "minutes", minutes: mins });
    }
  }
  let sent = false;
  const al = await sbRest(env, "rpc/portal_email_allowed", { method: "POST", body: JSON.stringify({ e: email }) });
  if (al.ok && (await al.json()) === true) {
    // Make sure this person has a sign-in (created the first time; "already exists" is fine), then make a one-time code.
    try { await fetch(`${baseUrl(env)}/auth/v1/admin/users`, { method: "POST", headers: adminHeaders(env), body: JSON.stringify({ email, email_confirm: true }) }); } catch {}
    const gl = await fetch(`${baseUrl(env)}/auth/v1/admin/generate_link`, { method: "POST", headers: adminHeaders(env), body: JSON.stringify({ type: "magiclink", email }) });
    if (gl.ok) {
      const g = await gl.json(), pr = g.properties || g;
      const code = String(pr.email_otp || ""), th = String(pr.hashed_token || "");
      if (code && th) {
        const link = `${PORTAL_URL}?th=${encodeURIComponent(th)}&ty=${encodeURIComponent(pr.verification_type || "magiclink")}${es ? "&lang=es" : ""}`;
        const m = es ? {
          es, heading: "Su código de acceso", lines: ["Use este código para entrar a su cuenta de cliente de LattaCorp. Vence en 1 hora."], code,
          button: "O entre con un toque", link,
          small: "Si usted no pidió este código, puede ignorar este correo. Nadie puede entrar a su cuenta sin él.",
        } : {
          heading: "Your sign-in code", lines: ["Use this code to sign in to your LattaCorp client account. It expires in 1 hour."], code,
          button: "Or sign in with one tap", link,
          small: "If you didn't ask for this code, you can ignore this email. No one can get into your account without it.",
        };
        sent = await sendViaResend(env, {
          from: AUTO_FROM, to: [email], reply_to: SUPPORT_EMAIL, headers: AUTO_HEADERS,
          subject: es ? `Su código de acceso de LattaCorp: ${code}` : `Your LattaCorp sign-in code: ${code}`,
          html: portalEmail(m), text: portalText(m),
        });
      }
    } else console.log("portal code: could not make a code", gl.status, await errText(gl));
  }
  await sbRest(env, "portal_signins", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email, sent }) });
  return json({ ok: true });
}

// The signed-in client's own account, asked of the database AS the client (so the database decides access).
async function portalAccountAs(env, token, cid) {
  if (!token || !UUID.test(String(cid || ""))) return null;
  const r = await fetch(`${baseUrl(env)}/rest/v1/rpc/portal_account`, {
    method: "POST", headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ cid }),
  });
  return r.ok ? r.json() : null;
}

// A service request or quote request sent from inside the portal: saved to CRM Leads (linked to the client) and emailed.
export async function handlePortalRequest(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "not set up" }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const token = bearer(request);
  const acct = await portalAccountAs(env, token, d && d.client_id);
  if (!acct) return json({ error: "Not allowed." }, 403);
  const email = await callerEmail(request, env);
  const isQuote = String(d.kind) === "quote";
  const kind = isQuote ? "Quote request" : "Service request";
  const details = String(d.details || "").trim().slice(0, 3000);
  if (!details) return json({ error: "Please describe what you need." }, 400);
  const fields = [
    { label: "Full name", value: String((acct.me && acct.me.name) || acct.client.name || "") },
    { label: "Account", value: String(acct.client.name || "") },
    { label: "Email", value: email },
    { label: "Phone", value: String(d.phone || acct.client.phone || "").slice(0, 60) },
    { label: "Service address", value: String(d.address || "").slice(0, 300) },
    { label: isQuote ? "Work wanted" : "Details", value: details },
    { label: "Sent from", value: "Client portal" },
  ].filter((f) => f.value);
  const rows = fields.map((f) => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555"><b>${esc(f.label)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(f.value)}</td></tr>`).join("");
  const payload = {
    from: env.FROM_EMAIL || FALLBACK_FROM, to: [env.TO_EMAIL || DEFAULT_TO],
    subject: emailSubject(kind, fields, d.lang),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px"><h2 style="color:#1b552b;margin:0 0 12px">${esc(kind)} (client portal)</h2><table>${rows}</table></div>`,
  };
  if (EMAIL_RE.test(email)) payload.reply_to = email;
  const fe = await formEmailSetting(env);
  const saved = await saveLead(env, kind, d.lang, fields, 0, acct.client.id);
  const emailed = fe === "all" || !saved ? await sendViaResend(env, payload) : false;
  if (!emailed && !saved) return json({ error: "Could not send. Please call or text 407-470-5309." }, 502);
  await notify(env, "portal", `Portal request: ${acct.client.name || "a client"}`, kind, "/crm/?go=leads");
  return json({ ok: true });
}

// "Invite to portal" from the CRM (staff only): emails a welcome message with the portal link.
export async function handlePortalInvite(request, env) {
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return json({ error: "The portal is not set up on the server." }, 500);
  const staffEmail = await callerEmail(request, env);
  if (!staffEmail || !(await emailOnStaff(env, staffEmail))) return json({ error: "Not allowed." }, 403);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const cid = String((d && d.client_id) || ""), to = String((d && d.email) || "").trim().toLowerCase();
  if (!UUID.test(cid) || !EMAIL_RE.test(to)) return json({ error: "Pick a client and an email." }, 400);
  const al = await sbRest(env, "rpc/portal_email_allowed", { method: "POST", body: JSON.stringify({ e: to }) });
  if (!al.ok || (await al.json()) !== true) return json({ error: "That email doesn't have portal access yet. Turn on portal access for it first." }, 400);
  const es = String(d.lang || "") === "es";
  const name = String(d.name || "").trim().split(/\s+/)[0] || "";
  const m = es ? {
      es, heading: `Bienvenido${name ? ", " + esc(name) : ""}`,
      lines: ["Ahora puede ver su cuenta con LattaCorp en línea, cuando quiera:",
        "• Sus próximas visitas y las ya realizadas<br>• Facturas, pagos y estados de cuenta para imprimir<br>• Fotos de su propiedad<br>• Pedir servicio o una cotización",
        `Para entrar, abra el portal y escriba este correo (${esc(to)}). Le enviaremos un código de un solo uso. No necesita contraseña.`,
        "Consejo: agregue website@lattacorpfl.com a sus contactos para que sus códigos no lleguen a Spam."],
      button: "Abrir mi portal", link: PORTAL_URL + "?lang=es",
      small: "¿Preguntas? Llame o envíe un texto al 407-470-5309.",
    } : {
      heading: `Welcome${name ? ", " + esc(name) : ""}`,
      lines: ["You can now view your LattaCorp account online, any time:",
        "• Upcoming and past visits<br>• Invoices, payments and printable statements<br>• Photos of your property<br>• Request service or a quote",
        `To sign in, open the portal and enter this email (${esc(to)}). We'll send you a one-time code. No password needed.`,
        "Tip: add website@lattacorpfl.com to your contacts so your sign-in codes don't land in Spam."],
      button: "Open my portal", link: PORTAL_URL,
      small: "Questions? Call or text 407-470-5309.",
    };
  const ok = await sendViaResend(env, {
    from: AUTO_FROM, to: [to], reply_to: SUPPORT_EMAIL, headers: AUTO_HEADERS,
    subject: es ? "Su portal de cliente de LattaCorp está listo" : "Your LattaCorp client portal is ready",
    html: portalEmail(m), text: portalText(m),
  });
  if (!ok) return json({ error: "The email could not be sent." }, 502);
  await sbRest(env, `clients?id=eq.${cid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ portal_invited_at: new Date().toISOString() }) });
  return json({ ok: true });
}


// ---- Quote approved: the client's quote page calls this right after they sign. Emails the business once per quote.
// Only accepted quotes signed online are emailed (declines are not). The database records when it was emailed so a
// second call never sends it twice.
const money2 = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export async function handleQuoteApproved(request, env) {
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return json({ error: "not set up" }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const tok = String(d && d.t || "");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(tok)) return json({ error: "bad request" }, 400);
  // claim it: only an accepted, client-signed quote that hasn't been emailed yet
  const now = new Date().toISOString();
  const cr = await sbRest(env, `estimates?share_token=eq.${tok}&status=eq.accepted&response_signature=not.is.null&approval_emailed_at=is.null&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ approval_emailed_at: now }) });
  if (!cr.ok) return json({ error: "lookup failed" }, 502);
  const e = ((await cr.json()) || [])[0];
  if (!e) return json({ ok: true, sent: false });
  let c = {};
  try { const r = await sbRest(env, `clients?id=eq.${e.client_id}&select=name,company`); c = ((await r.json()) || [])[0] || {}; } catch {}
  const word = e.doc_type === "estimate" ? "Estimate" : "Quote", num = (word === "Estimate" ? "EST-" : "QTE-") + String(e.number).padStart(4, "0");
  const dep = e.deposit ? (e.deposit.mode === "pct" ? Math.round(Number(e.total) * Number(e.deposit.pct || 0)) / 100 : Number(e.deposit.amt || 0)) : 0;
  const who = (c.name || "A client") + (c.company ? " · " + c.company : "");
  const when = new Date(e.responded_at || now).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const rows = [["Signed by", e.response_name], ["PO / Approval #", e.response_po], ["Deposit due", dep > 0 ? money2(dep) : ""], ["Signed", when]].filter((x) => x[1]);
  const link = `${SITE}/d/?t=${tok}&p=1`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f3f7f1;font-family:Arial,sans-serif;color:#1c2a20">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4ece1;border-radius:12px;overflow:hidden">
<tr><td style="background:#1b552b;padding:16px 22px;color:#fff;font-size:18px;font-weight:700">&#10003; ${word} approved</td></tr>
<tr><td style="padding:22px">
<p style="margin:0 0 14px;font-size:16px;line-height:1.5"><b>${esc(who)}</b> signed ${word.toLowerCase()} <b>${num}</b>${e.title ? ` (“${esc(e.title)}”)` : ""} for <b>${money2(e.total)}</b>.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 18px">${rows.map((r) => `<tr><td style="padding:3px 16px 3px 0;color:#58675c">${r[0]}</td><td style="padding:3px 0">${esc(r[1])}</td></tr>`).join("")}</table>
<p style="margin:0"><a href="${link}" style="display:inline-block;background:#1b552b;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:6px">See the signed ${word.toLowerCase()}</a>
&nbsp; <a href="${SITE}/crm/" style="color:#1b552b">Open Foreman</a></p></td></tr></table></body></html>`;
  const text = [`${word} approved`, "", `${who} signed ${word.toLowerCase()} ${num}${e.title ? ` ("${e.title}")` : ""} for ${money2(e.total)}.`, ...rows.map((r) => `${r[0]}: ${r[1]}`), "", `See the signed ${word.toLowerCase()}: ${link}`].join("\n");
  await notify(env, "quote", `${word} approved ✓`, `${who} · ${num} · ${money2(e.total)}`, "/crm/?go=leads");
  const ok = await sendViaResend(env, { from: "Foreman <website@lattacorpfl.com>", to: [env.TO_EMAIL || DEFAULT_TO],
    subject: `${word} approved: ${who} · ${num} · ${money2(e.total)}`, html, text, headers: AUTO_HEADERS });
  if (!ok) {
    // let a later call try again
    await sbRest(env, `estimates?id=eq.${e.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ approval_emailed_at: null }) });
    return json({ error: "The email could not be sent." }, 502);
  }
  return json({ ok: true, sent: true });
}

// ---- Invoices emailed from Foreman in batches (staff only). The CRM sends up to 25 ids per call;
// at most INVOICE_DAILY_LIMIT invoices go out per day (Eastern time) so the email plan's daily cap is never hit.
const INVOICE_FROM = "Latta Corp Billing <billing@lattacorpfl.com>";
function etMidnightIso() {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const off = (new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(now)
    .find((x) => x.type === "timeZoneName") || {}).value || "GMT-5";
  const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/), sign = m ? m[1] : "-", hh = String(m ? m[2] : 5).padStart(2, "0"), mm = m && m[3] ? m[3] : "00";
  return new Date(`${day}T00:00:00${sign}${hh}:${mm}`).toISOString();
}
const fmtDay = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
const fmtMonth = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
export async function handleInvoiceEmail(request, env) {
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY) return json({ error: "Email is not set up on the server." }, 500);
  const me = await callerEmail(request, env);
  const who = me && await staffRow(env, me);
  if (!who || (who.role !== "owner" && who.role !== "office")) return json({ error: "Not allowed." }, 403);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const ids = Array.isArray(d && d.ids) ? d.ids.filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 25) : [];
  if (!ids.length) return json({ error: "No invoices picked." }, 400);
  const limit = Number(env.INVOICE_DAILY_LIMIT) > 0 ? Number(env.INVOICE_DAILY_LIMIT) : 90;
  const cr = await sbRest(env, `invoices?emailed_at=gte.${encodeURIComponent(etMidnightIso())}&select=id`);
  if (!cr.ok) return json({ error: "Run the Stage 43 SQL in Supabase first." }, 502);
  const room = limit - ((await cr.json()) || []).length;
  if (room <= 0) return json({ error: `Today's limit of ${limit} invoice emails is reached. Send the rest tomorrow.` }, 429);
  const ir = await sbRest(env, `invoices?id=in.(${ids.join(",")})&select=id,number,total,due_date,period_end,share_token,client_id,status,emailed_at,title`);
  if (!ir.ok) return json({ error: "Could not read the invoices." }, 502);
  const invs = (await ir.json()) || [];
  const cids = [...new Set(invs.map((i) => i.client_id))];
  const cl = cids.length ? await (await sbRest(env, `clients?id=in.(${cids.join(",")})&select=id,name,email`)).json() : [];
  let biz = {}; try { biz = ((await (await sbRest(env, "business?select=*&limit=1")).json()) || [])[0] || {}; } catch {}
  const zelle = String(biz.zelle || "407-470-5309");
  const failed = [], msgs = [], meta = [];
  for (const inv of invs) {
    const c = cl.find((x) => x.id === inv.client_id) || {};
    const to = String(c.email || "").trim();
    if (inv.emailed_at) { failed.push({ id: inv.id, error: "already emailed" }); continue; }
    if (inv.status === "void") { failed.push({ id: inv.id, error: "void" }); continue; }
    if (!EMAIL_RE.test(to)) { failed.push({ id: inv.id, error: "no email on file" }); continue; }
    if (!inv.share_token) { failed.push({ id: inv.id, error: "no link" }); continue; }
    if (msgs.length >= room) { failed.push({ id: inv.id, error: "over today's limit, send tomorrow" }); continue; }
    const num = "LC-" + String(inv.number || 0).padStart(4, "0"), first = String(c.name || "").split(" ")[0] || "there";
    const link = `${SITE}/d/?t=${inv.share_token}`, month = fmtMonth(inv.period_end);
    const parts = {
      heading: `Your invoice ${num}`,
      lines: [`Hi ${esc(first)},`, `Your invoice${month ? " for " + esc(month) : ""} from Latta Corp of Central Florida is ready.`,
        `<b>Amount due: ${money2(inv.total)}</b>${inv.due_date ? " · Due " + esc(fmtDay(inv.due_date)) : ""}`],
      button: "View your invoice", link,
      small: `Pay with Zelle to ${esc(zelle)} (please include ${num} in the note), or cash or check on our next visit. Thank you for letting us treat your lawn with a "Latta" love!`,
      foot: "Questions about this invoice? Reply to this email, or write to",
    };
    msgs.push({ from: INVOICE_FROM, to: [to], reply_to: SUPPORT_EMAIL, subject: `Invoice ${num} from Latta Corp · ${money2(inv.total)}`,
      html: portalEmail(parts), text: portalText(parts) });
    meta.push({ id: inv.id, to });
  }
  const sent = [];
  if (msgs.length) {
    const post = (arr) => fetch("https://api.resend.com/emails/batch", { method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify(arr) });
    let res = await post(msgs);
    if (!res.ok && (res.status === 403 || res.status === 422)) {
      console.log("billing sender refused, retrying from website@", res.status, (await res.text()).slice(0, 200));
      res = await post(msgs.map((m) => ({ ...m, from: "Latta Corp Billing <website@lattacorpfl.com>" })));
    }
    if (!res.ok) {
      console.log("invoice batch failed", res.status, (await res.text()).slice(0, 300));
      meta.forEach((m) => failed.push({ id: m.id, error: "the email service refused it" }));
    } else {
      const at = new Date().toISOString();
      for (const m of meta) {
        await sbRest(env, `invoices?id=eq.${m.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ emailed_at: at, emailed_to: m.to }) });
        await sbRest(env, `invoices?id=eq.${m.id}&sent_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_at: at }) });
        sent.push({ id: m.id, to: m.to, at });
      }
    }
  }
  return json({ ok: true, sent, failed, left: Math.max(0, room - sent.length) });
}


// ---- Phone notifications (Web Push) for owners and office staff ----
const PUSH_EVENTS = {
  lead: "New quote requests",
  service: "Service requests from communities",
  contact: "Contact messages",
  portal: "Requests from the client portal",
  quote: "Quotes approved by clients",
  receipt: "Receipts uploaded by the crew",
};
const PUSH_SUBJECT = "mailto:Support@LattaCorpFL.com";
async function vapidKeys(env) {
  const get = async () => {
    const r = await sbRest(env, "app_secrets?name=in.(vapid_public,vapid_private)&select=name,value");
    if (!r.ok) return null;
    const rows = (await r.json()) || [], f = (n) => (rows.find((x) => x.name === n) || {}).value;
    return f("vapid_public") && f("vapid_private") ? { publicKey: f("vapid_public"), privateKey: f("vapid_private") } : null;
  };
  let k = await get();
  if (k) return k;
  // first use: make the key pair once and keep it (if two calls race, the first one saved wins)
  const nk = await makeVapidKeys();
  await sbRest(env, "app_secrets", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify([{ name: "vapid_public", value: nk.publicKey }, { name: "vapid_private", value: nk.privateKey }]) });
  return await get();
}
const prefsOn = (prefs, ev) => !prefs || prefs[ev] !== false;
// Sends one notification to every owner/office phone that wants this kind of event. Never throws.
async function notify(env, ev, title, body, url, onlyEmail) {
  try {
    if (!env.SUPABASE_SECRET_KEY) return 0;
    const keys = await vapidKeys(env);
    if (!keys) return 0;
    const dr = await sbRest(env, "push_devices?select=id,email,endpoint,p256dh,auth");
    if (!dr.ok) return 0;
    let devs = (await dr.json()) || [];
    if (onlyEmail) devs = devs.filter((d) => d.email.toLowerCase() === onlyEmail.toLowerCase());
    if (!devs.length) return 0;
    const sr = await fetch(`${baseUrl(env)}/rest/v1/staff?select=email,role`, { headers: { apikey: env.SUPABASE_SECRET_KEY } });
    const staff = sr.ok ? (await sr.json()) || [] : [];
    const roleOf = (e) => ((staff.find((x) => String(x.email).toLowerCase() === e.toLowerCase()) || {}).role || "owner");
    const pr = await sbRest(env, "push_prefs?select=email,prefs");
    const prefs = pr.ok ? (await pr.json()) || [] : [];
    const prefOf = (e) => (prefs.find((x) => x.email.toLowerCase() === e.toLowerCase()) || {}).prefs;
    devs = devs.filter((d) => staff.some((x) => String(x.email).toLowerCase() === d.email.toLowerCase()) &&
      (roleOf(d.email) === "owner" || roleOf(d.email) === "office") && (ev === "test" || prefsOn(prefOf(d.email), ev)));
    const msg = { title: String(title).slice(0, 120), body: String(body || "").slice(0, 240), url: url || "/crm/", tag: ev + "-" + Date.now() };
    let ok = 0;
    await Promise.all(devs.map(async (d) => {
      const st = await sendPush(d, msg, keys, PUSH_SUBJECT);
      if (st >= 200 && st < 300) {
        ok++;
        await sbRest(env, `push_devices?id=eq.${d.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_ok_at: new Date().toISOString() }) });
      } else if (st === 404 || st === 410) {
        await sbRest(env, `push_devices?id=eq.${d.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      } else console.log("push failed", st);
    }));
    return ok;
  } catch (e) { console.log("notify error", String(e).slice(0, 200)); return 0; }
}
async function callerUser(request, env) {
  const token = bearer(request);
  if (!token) return null;
  try {
    const u = await fetch(`${baseUrl(env)}/auth/v1/user`, { headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return null;
    const j = await u.json();
    return { id: j.id, email: String(j.email || "").toLowerCase() };
  } catch { return null; }
}
async function formEmailSetting(env) {
  try {
    const r = await sbRest(env, "business?select=form_emails&limit=1");
    if (!r.ok) return "all";
    return ((await r.json()) || [])[0]?.form_emails || "all";
  } catch { return "all"; }
}
export async function handlePush(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "Notifications are not set up on the server." }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String((d && d.action) || "");
  const u = await callerUser(request, env);
  if (!u) return json({ error: "Not allowed." }, 403);
  if (action === "receipt") {
    // a crew member just uploaded a receipt from their own login
    const cr = await sbRest(env, `crew?user_id=eq.${u.id}&active=eq.true&kind=eq.login&select=name`);
    const c = cr.ok ? ((await cr.json()) || [])[0] : null;
    if (!c) return json({ error: "Not allowed." }, 403);
    await notify(env, "receipt", "Receipt uploaded", `${c.name || "A crew member"} uploaded a receipt to enter.`, "/crm/?go=expenses");
    return json({ ok: true });
  }
  const who = await staffRow(env, u.email);
  if (!who || (who.role !== "owner" && who.role !== "office")) return json({ error: "Not allowed." }, 403);
  const me = u.email;
  if (action === "key") {
    const k = await vapidKeys(env);
    return k ? json({ ok: true, key: k.publicKey }) : json({ error: "Run the Stage 44 SQL in Supabase first." }, 502);
  }
  if (action === "subscribe") {
    const sub = d.sub || {}, keys = sub.keys || {};
    const endpoint = String(sub.endpoint || "");
    if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(String(keys.p256dh || "")) || !/^[A-Za-z0-9_-]{10,60}$/.test(String(keys.auth || "")))
      return json({ error: "bad subscription" }, 400);
    const row = { email: me, endpoint, p256dh: keys.p256dh, auth: keys.auth, label: String(d.label || "").slice(0, 80) };
    const r = await sbRest(env, "push_devices?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    if (!r.ok) return json({ error: "Could not save this phone. Run the Stage 44 SQL in Supabase first." }, 502);
    return json({ ok: true });
  }
  if (action === "unsubscribe") {
    const endpoint = String(d.endpoint || "");
    const id = String(d.id || "");
    const q = endpoint ? `endpoint=eq.${encodeURIComponent(endpoint)}` : UUID.test(id) ? `id=eq.${id}` : "";
    if (!q) return json({ error: "bad request" }, 400);
    await sbRest(env, `push_devices?${q}&email=eq.${encodeURIComponent(me)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return json({ ok: true });
  }
  if (action === "get") {
    const [pr, dr] = await Promise.all([
      sbRest(env, `push_prefs?email=eq.${encodeURIComponent(me)}&select=prefs`),
      sbRest(env, `push_devices?email=eq.${encodeURIComponent(me)}&select=id,label,created_at,last_ok_at,endpoint&order=created_at.asc`),
    ]);
    if (!pr.ok || !dr.ok) return json({ error: "Run the Stage 44 SQL in Supabase first." }, 502);
    const prefs = ((await pr.json()) || [])[0]?.prefs || {};
    const events = Object.keys(PUSH_EVENTS).map((k) => ({ key: k, label: PUSH_EVENTS[k], on: prefsOn(prefs, k) }));
    return json({ ok: true, events, devices: (await dr.json()) || [], formEmails: who.role === "owner" ? await formEmailSetting(env) : null });
  }
  if (action === "set") {
    const prefs = {};
    for (const k of Object.keys(PUSH_EVENTS)) prefs[k] = !(d.prefs && d.prefs[k] === false);
    const r = await sbRest(env, "push_prefs?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ email: me, prefs, updated_at: new Date().toISOString() }) });
    if (!r.ok) return json({ error: "Could not save." }, 502);
    if (who.role === "owner" && ["all", "photos", "off"].includes(d.formEmails)) {
      await sbRest(env, "business?id=not.is.null", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ form_emails: d.formEmails }) });
    }
    return json({ ok: true });
  }
  if (action === "test") {
    const n = await notify(env, "test", "Foreman notifications are on ✓", "This is how new leads and requests will show up.", "/crm/", me);
    return n ? json({ ok: true, sent: n }) : json({ error: "No phone got it. Turn notifications on for this phone first." }, 404);
  }
  return json({ error: "bad action" }, 400);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      // Safe status check (shows whether the settings exist, never their values).
      return json({ ok: true, emailKeySet: Boolean(env.RESEND_API_KEY), crmKeySet: Boolean(env.SUPABASE_SECRET_KEY), turnstileSet: Boolean(env.TURNSTILE_SECRET_KEY), sendsTo: (env.TO_EMAIL || DEFAULT_TO) ? (env.TO_EMAIL || DEFAULT_TO).replace(/^(.).*(@.*)$/, "$1***$2") : null });
    }
    if (url.pathname === "/api/submit") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleSubmit(request, env);
    }
    if (url.pathname === "/api/crew-login") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleCrewLogin(request, env);
    }
    if (url.pathname === "/api/team") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleTeam(request, env);
    }
    if (url.pathname === "/api/push") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handlePush(request, env);
    }
    if (url.pathname === "/api/invoices/email") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleInvoiceEmail(request, env);
    }
    if (url.pathname === "/api/quote-approved") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleQuoteApproved(request, env);
    }
    if (url.pathname === "/api/portal/code" || url.pathname === "/api/portal/request" || url.pathname === "/api/portal/invite") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      if (url.pathname === "/api/portal/code") return handlePortalCode(request, env);
      if (url.pathname === "/api/portal/request") return handlePortalRequest(request, env);
      return handlePortalInvite(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

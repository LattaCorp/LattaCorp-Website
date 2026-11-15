import { makeVapidKeys, sendPush } from "./push.js";
import { stripe, stripeMode, verifyStripeSignature, cents } from "./stripe.js";
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
        try { await clientInvoiceNotice(env, m.id); } catch {}
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
  chat: "New messages",
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
    const dr = await sbRest(env, "push_devices?kind=eq.staff&select=id,email,endpoint,p256dh,auth");
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

// ---- Client notifications (client portal phones) ----
const CLIENT_EVENTS = {
  invoice: "New invoices",
  visit: "Lawn maintenance completed",
  offer: "Offers and recommended services",
  news: "News from Latta Corp",
};
// HOA and Commercial accounts start with only News on; each person can turn the rest on.
const clientDefault = (type, ev) => ev === "news" || !(type === "hoa" || type === "commercial");
const clientPrefOn = (prefs, type, ev) => (prefs && typeof prefs[ev] === "boolean" ? prefs[ev] : clientDefault(type, ev));
async function clientPeople(env, cid) {
  const cr = await sbRest(env, `clients?id=eq.${cid}&select=id,name,type,email`);
  const c = cr.ok ? ((await cr.json()) || [])[0] : null;
  if (!c) return null;
  const kr = await sbRest(env, `client_contacts?client_id=eq.${cid}&portal_access=eq.true&select=email`);
  const emails = new Set([String(c.email || "").trim().toLowerCase()]);
  if (kr.ok) for (const k of (await kr.json()) || []) emails.add(String(k.email || "").trim().toLowerCase());
  emails.delete("");
  return { client: c, emails: [...emails] };
}
// one notification to everyone on this account who wants it (on their phones with the portal installed)
async function notifyClient(env, cid, ev, title, body, url) {
  try {
    const who = await clientPeople(env, cid);
    if (!who || !who.emails.length) return 0;
    const keys = await vapidKeys(env);
    if (!keys) return 0;
    const list = who.emails.map((e) => encodeURIComponent(`"${e}"`)).join(",");
    const [dr, pr] = await Promise.all([
      sbRest(env, `push_devices?kind=eq.client&email=in.(${list})&select=id,email,endpoint,p256dh,auth`),
      sbRest(env, `portal_push_prefs?client_id=eq.${cid}&select=email,prefs`),
    ]);
    if (!dr.ok) return 0;
    const prefs = pr.ok ? (await pr.json()) || [] : [];
    const prefOf = (e) => (prefs.find((x) => x.email.toLowerCase() === e.toLowerCase()) || {}).prefs;
    const devs = ((await dr.json()) || []).filter((d) => ev === "test" || clientPrefOn(prefOf(d.email), who.client.type, ev));
    const msg = { title: String(title).slice(0, 120), body: String(body || "").slice(0, 240), url: url || "/portal/", tag: ev + "-" + Date.now() };
    let ok = 0;
    await Promise.all(devs.map(async (d) => {
      const st = await sendPush(d, msg, keys, PUSH_SUBJECT);
      if (st >= 200 && st < 300) ok++;
      else if (st === 404 || st === 410) await sbRest(env, `push_devices?id=eq.${d.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    }));
    return ok;
  } catch (e) { console.log("notifyClient error", String(e).slice(0, 200)); return 0; }
}
const claimOnce = async (env, table, id) => {
  const r = await sbRest(env, `${table}?id=eq.${id}&client_notified_at=is.null&select=*`, { method: "PATCH",
    headers: { Prefer: "return=representation" }, body: JSON.stringify({ client_notified_at: new Date().toISOString() }) });
  try { return r.ok ? ((await r.json()) || [])[0] || null : null; } catch { return null; }
};
async function clientInvoiceNotice(env, id) {
  const inv = await claimOnce(env, "invoices", id);
  if (!inv || inv.status === "void") return 0;
  const num = "LC-" + String(inv.number || 0).padStart(4, "0");
  return notifyClient(env, inv.client_id, "invoice", `New invoice ${num} · ${money2(inv.total)}`,
    (inv.due_date ? "Due " + fmtDay(inv.due_date) + ". " : "") + "Tap to view it.", inv.share_token ? `/d/?t=${inv.share_token}` : "/portal/");
}
async function clientVisitNotice(env, id) {
  const vr = await sbRest(env, `visits?id=eq.${id}&select=id,status,kind,client_id,property_id,client_notified_at`);
  const v = vr.ok ? ((await vr.json()) || [])[0] : null;
  if (!v || v.status !== "done" || v.kind === "addon" || v.client_notified_at) return 0;
  if (!(await claimOnce(env, "visits", id))) return 0;
  let addr = "";
  try { addr = ((await (await sbRest(env, `properties?id=eq.${v.property_id}&select=address`)).json()) || [])[0]?.address || ""; } catch {}
  return notifyClient(env, v.client_id, "visit", "Lawn maintenance completed ✓", (addr ? addr.split(",")[0] + " is all done. " : "Your lawn is all done. ") + "Thank you!", "/portal/");
}
// Staff (and crew, for finished visits) tell clients' phones about something
async function handleClientPush(env, action, d, u, role) {
  const id = String(d.id || "");
  if (action === "client-visit") {
    if (!UUID.test(id)) return json({ error: "bad request" }, 400);
    return json({ ok: true, sent: await clientVisitNotice(env, id) });
  }
  if (role !== "owner" && role !== "office") return json({ error: "Not allowed." }, 403);
  if (action === "client-invoice") {
    if (!UUID.test(id)) return json({ error: "bad request" }, 400);
    return json({ ok: true, sent: await clientInvoiceNotice(env, id) });
  }
  if (action === "client-offer") {
    if (!UUID.test(id)) return json({ error: "bad request" }, 400);
    const now = new Date().toISOString();
    const er = await sbRest(env, `estimates?id=eq.${id}&status=in.(draft,sent)&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ offered_at: now, status: "sent" }) });
    const e = er.ok ? ((await er.json()) || [])[0] : null;
    if (!e) return json({ error: "That quote can't be offered (it may already be approved or declined)." }, 409);
    const who = await clientPeople(env, e.client_id);
    const n = await notifyClient(env, e.client_id, "offer", `Latta Corp recommends: ${e.title || "a service for your property"}`,
      `${money2(e.total)} · Tap to see the details and approve it online.`, `/d/?t=${e.share_token}`);
    return json({ ok: true, sent: n, people: who ? who.emails.length : 0 });
  }
  if (action === "news") {
    const title = String(d.title || "").trim().slice(0, 100), body = String(d.body || "").trim().slice(0, 1000);
    const link = /^https:\/\/[^\s]{3,300}$/.test(String(d.link || "")) ? String(d.link) : "";
    const audience = ["all", "residential", "hoa", "commercial"].includes(d.audience) ? d.audience : "all";
    if (!title) return json({ error: "Give it a title." }, 400);
    const pr = await sbRest(env, "news_posts", { method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ title, body, link, audience, created_by: u.email }) });
    if (!pr.ok) return json({ error: "Run the Stage 45 SQL in Supabase first." }, 502);
    const post = ((await pr.json()) || [])[0];
    // everyone with a client phone signed up, on accounts that match the audience
    const cr = await sbRest(env, `clients?select=id,type${audience === "all" ? "" : "&type=eq." + audience}`);
    const cls = cr.ok ? (await cr.json()) || [] : [];
    const dr = await sbRest(env, "push_devices?kind=eq.client&select=email");
    const devEmails = new Set(dr.ok ? ((await dr.json()) || []).map((x) => x.email.toLowerCase()) : []);
    let sent = 0;
    for (const c of cls) {
      const who = await clientPeople(env, c.id);
      if (!who || !who.emails.some((e) => devEmails.has(e))) continue;
      sent += await notifyClient(env, c.id, "news", title, body.slice(0, 160) || "Tap to read more.", link || "/portal/");
    }
    if (post) await sbRest(env, `news_posts?id=eq.${post.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ sent_count: sent }) });
    return json({ ok: true, sent });
  }
  return json({ error: "bad action" }, 400);
}
// The client portal's own notification settings (signed-in portal people)
// ---- Signed agreements: email the signer (or whoever asks, to their own address) a full copy ----
function agreementHtml(body) {
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  let out = "", list = "";
  for (const line of String(body || "").split("\n")) {
    let m;
    const close = () => { if (list) { out += `</${list}>`; list = ""; } };
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^##\s+(.*)/))) { close(); out += `<h3 style="margin:18px 0 6px;font-size:16px;color:#1b552b">${inline(m[1])}</h3>`; continue; }
    if ((m = line.match(/^-\s+(.*)/)) || (m = line.match(/^\d+\.\s+(.*)/))) {
      const tag = /^-/.test(line) ? "ul" : "ol";
      if (list !== tag) { close(); out += `<${tag} style="margin:0 0 10px;padding-left:22px">`; list = tag; }
      out += `<li style="margin:0 0 6px">${inline(m[1])}</li>`; continue;
    }
    close(); out += `<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#1c2a20">${inline(line)}</p>`;
  }
  if (list) out += `</${list}>`;
  return out;
}
async function agreementCopy(env, token, me, cid, acct, d) {
  const r = await fetch(`${baseUrl(env)}/rest/v1/rpc/portal_agreements`, {
    method: "POST", headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ cid }),
  });
  const a = r.ok ? await r.json() : null;
  const s = a && (a.signed || []).find((x) => x.id === String(d.id || ""));
  if (!s) return json({ error: "not found" }, 404);
  const det = s.details || {};
  const when = new Date(s.signed_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET";
  const rows = [["Client", det.client], ["Account number", det.account_no], ["Service property", det.property],
    ...(det.services || []).map((x) => ["Service plan", [x.title, x.frequency, x.price != null ? "$" + Number(x.price).toFixed(2) : ""].filter(Boolean).join(" · ")]),
    ...(s.method ? [["Payment method", s.method === "ach" ? "Bank account (ACH), no fee" : "Credit card, 3% surcharge"]] : []),
    ["Signed by", s.typed_name + (s.signer_title ? ", " + s.signer_title : "")], ["Signer email", s.signer_email], ["Signed on", when],
    ["From IP address", s.ip || "-"], ["Version", s.version_id], ["Document fingerprint (SHA-256)", s.body_sha256],
    ...(s.cancelled_at ? [["Automatic payments turned off", new Date(s.cancelled_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET"]] : [])]
    .filter((x) => x[1] != null && x[1] !== "");
  const table = `<table style="border-collapse:collapse;margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px">${rows.map((x) => `<tr><td style="padding:3px 12px 3px 0;color:#58675c;vertical-align:top">${esc(x[0])}</td><td style="padding:3px 0;color:#1c2a20"><b>${esc(String(x[1]))}</b></td></tr>`).join("")}</table>`;
  const cancelled = !!d.cancelled && !!s.cancelled_at;
  const heading = cancelled ? "Automatic payments turned off" : `Your signed ${s.title}`;
  const intro = cancelled
    ? "Automatic payments are now off for this account. Your service continues; please pay each invoice yourself. Your original signed authorization stays in your client portal."
    : `Here is your copy of the ${s.title} you signed. It is also saved in your client portal under Account, where it can't be changed or deleted.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f7f1"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;border:1px solid #e4ece1;font-family:Georgia,'Times New Roman',serif">
<tr><td style="background:#1b552b;padding:18px 24px;color:#fff;font-size:19px;font-weight:600">Latta Corp Of Central Florida</td></tr>
<tr><td style="padding:24px 26px 10px"><h1 style="margin:0 0 12px;font-size:22px;color:#1b552b;font-weight:600">${esc(heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#1c2a20">${esc(intro)}</p>${table}${cancelled ? "" : agreementHtml(s.body)}
<p style="margin:16px 0 8px;font-size:13px;color:#58675c;font-family:Arial,sans-serif">Signed electronically under the federal E-SIGN Act and Florida Statutes section 668.50.</p></td></tr>
<tr><td style="padding:14px 26px 20px;border-top:1px solid #e4ece1;font-family:Arial,sans-serif;font-size:13px;color:#58675c">Questions? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#1b552b">${SUPPORT_EMAIL}</a> or call or text 407-470-5309.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${rows.map((x) => x[0] + ": " + x[1]).join("\n")}\n\n${cancelled ? "" : String(s.body).replace(/\*\*/g, "")}\n\nQuestions? ${SUPPORT_EMAIL} or 407-470-5309.`;
  const ok = await sendViaResend(env, { from: AUTO_FROM, to: [me], reply_to: SUPPORT_EMAIL, headers: AUTO_HEADERS,
    subject: cancelled ? "Automatic payments turned off" : `Your signed ${s.title} - LattaCorp`, html, text });
  if (!d.resend) await notify(env, "portal", cancelled ? `Autopay turned off: ${acct.client.name || "a client"}` : `${s.title} signed: ${acct.client.name || "a client"}`,
    `${s.typed_name}${s.method ? " · " + (s.method === "ach" ? "bank" : "credit card") : ""}`, "/crm/?go=clients");
  return ok ? json({ ok: true }) : json({ error: "Could not send the email." }, 502);
}

export async function handlePortalPush(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "not set up" }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String((d && d.action) || "");
  const token = bearer(request);
  const me = await callerEmail(request, env);
  if (!me) return json({ error: "Not allowed." }, 403);
  if (action === "key") {
    const k = await vapidKeys(env);
    return k ? json({ ok: true, key: k.publicKey }) : json({ error: "not set up" }, 502);
  }
  if (action === "subscribe") {
    const sub = d.sub || {}, keys = sub.keys || {};
    const endpoint = String(sub.endpoint || "");
    if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(String(keys.p256dh || "")) || !/^[A-Za-z0-9_-]{10,60}$/.test(String(keys.auth || "")))
      return json({ error: "bad subscription" }, 400);
    const r = await sbRest(env, "push_devices?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ email: me, endpoint, p256dh: keys.p256dh, auth: keys.auth, label: String(d.label || "").slice(0, 80), kind: "client" }) });
    return r.ok ? json({ ok: true }) : json({ error: "Could not save this phone." }, 502);
  }
  if (action === "unsubscribe") {
    await sbRest(env, `push_devices?endpoint=eq.${encodeURIComponent(String(d.endpoint || ""))}&email=eq.${encodeURIComponent(me)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return json({ ok: true });
  }
  const acct = await portalAccountAs(env, token, d && d.client_id);
  if (!acct || !acct.client) return json({ error: "Not allowed." }, 403);
  const cid = d.client_id, type = acct.client.type || "residential";
  if (action === "agreement-copy") return agreementCopy(env, token, me, cid, acct, d);
  if (action === "get") {
    const r = await sbRest(env, `portal_push_prefs?client_id=eq.${cid}&email=eq.${encodeURIComponent(me)}&select=prefs`);
    const prefs = r.ok ? ((await r.json()) || [])[0]?.prefs : null;
    return json({ ok: true, events: Object.keys(CLIENT_EVENTS).map((k) => ({ key: k, label: CLIENT_EVENTS[k], on: clientPrefOn(prefs, type, k) })) });
  }
  if (action === "set") {
    const prefs = {};
    for (const k of Object.keys(CLIENT_EVENTS)) if (d.prefs && typeof d.prefs[k] === "boolean") prefs[k] = d.prefs[k];
    const r = await sbRest(env, "portal_push_prefs?on_conflict=email,client_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ email: me, client_id: cid, prefs, updated_at: new Date().toISOString() }) });
    return r.ok ? json({ ok: true }) : json({ error: "Could not save." }, 502);
  }
  if (action === "test") {
    const dr = await sbRest(env, `push_devices?kind=eq.client&email=eq.${encodeURIComponent(me)}&select=id,email,endpoint,p256dh,auth`);
    const keys = await vapidKeys(env);
    let n = 0;
    for (const dv of (dr.ok ? (await dr.json()) || [] : [])) {
      const st = await sendPush(dv, { title: "Notifications are on ✓", body: "This is how Latta Corp updates will show up.", url: "/portal/", tag: "test" }, keys, PUSH_SUBJECT);
      if (st >= 200 && st < 300) n++;
    }
    return n ? json({ ok: true }) : json({ error: "This phone isn't signed up yet." }, 404);
  }
  return json({ error: "bad action" }, 400);
}

// ---- Messages: notify everyone in the room except the sender ----
async function crewPushAction(env, action, d, u) {
  if (action === "key") {
    const k = await vapidKeys(env);
    return k ? json({ ok: true, key: k.publicKey }) : json({ error: "Notifications are not set up yet." }, 502);
  }
  if (action === "subscribe") {
    const sub = d.sub || {}, keys = sub.keys || {};
    const endpoint = String(sub.endpoint || "");
    if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(String(keys.p256dh || "")) || !/^[A-Za-z0-9_-]{10,60}$/.test(String(keys.auth || "")))
      return json({ error: "bad subscription" }, 400);
    const row = { email: u.email, endpoint, p256dh: keys.p256dh, auth: keys.auth, label: String(d.label || "").slice(0, 80), kind: "crew" };
    const r = await sbRest(env, "push_devices?on_conflict=endpoint", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
    return r.ok ? json({ ok: true }) : json({ error: "Could not save this phone." }, 502);
  }
  if (action === "unsubscribe") {
    const endpoint = String(d.endpoint || "");
    if (!endpoint) return json({ error: "bad request" }, 400);
    await sbRest(env, `push_devices?endpoint=eq.${encodeURIComponent(endpoint)}&email=eq.${encodeURIComponent(u.email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    return json({ ok: true });
  }
  // test
  const n = await pushTo(env, [u.email], ["crew"], { title: "Notifications are on ✓", body: "New messages will show up here.", url: "/crm/?go=messages", tag: "test" });
  return n ? json({ ok: true, sent: n }) : json({ error: "No phone got it. Turn notifications on for this phone first." }, 404);
}
// sends one message to every phone of these emails (of the given device kinds); returns how many got it
async function pushTo(env, emails, kinds, msg) {
  const keys = await vapidKeys(env);
  if (!keys || !emails.length) return 0;
  const want = new Set(emails.map((e) => String(e).toLowerCase()));
  const dr = await sbRest(env, `push_devices?kind=in.(${kinds.join(",")})&select=id,email,endpoint,p256dh,auth`);
  if (!dr.ok) return 0;
  const devs = ((await dr.json()) || []).filter((x) => want.has(String(x.email).toLowerCase()));
  let ok = 0;
  await Promise.all(devs.map(async (x) => {
    const st = await sendPush(x, msg, keys, PUSH_SUBJECT);
    if (st >= 200 && st < 300) ok++;
    else if (st === 404 || st === 410) await sbRest(env, `push_devices?id=eq.${x.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  }));
  return ok;
}
async function handleChatPush(env, d, u) {
  const id = String(d.id || "");
  if (!UUID.test(id)) return json({ error: "bad request" }, 400);
  const mr = await sbRest(env, `messages?id=eq.${id}&select=room,sender_id,sender_name,body,photo_path,created_at`);
  const m = mr.ok ? ((await mr.json()) || [])[0] : null;
  if (!m || m.sender_id !== u.id) return json({ error: "Not allowed." }, 403);
  if (Date.now() - new Date(m.created_at).getTime() > 5 * 60 * 1000) return json({ ok: true, sent: 0 });
  const [sr, cr, pr] = await Promise.all([
    sbRest(env, "staff?select=email,role,user_id"),
    sbRest(env, "crew?active=eq.true&kind=eq.login&select=email,user_id"),
    sbRest(env, "push_prefs?select=email,prefs"),
  ]);
  const staff = sr.ok ? (await sr.json()) || [] : [];
  const crewRows = cr.ok ? (await cr.json()) || [] : [];
  const prefs = pr.ok ? (await pr.json()) || [] : [];
  const wantsChat = (e) => prefsOn((prefs.find((x) => String(x.email).toLowerCase() === String(e).toLowerCase()) || {}).prefs, "chat");
  let to = [];
  if (m.room === "all") to = staff.map((x) => x.email).concat(crewRows.map((x) => x.email));
  else if (m.room === "office") to = staff.map((x) => x.email);
  else if (/^dm:/.test(m.room)) {
    const other = m.room.split(":").slice(1).find((x) => x !== u.id);
    let em = (staff.find((x) => x.user_id === other) || crewRows.find((x) => x.user_id === other) || {}).email;
    if (!em && UUID.test(other || "")) {
      const ar = await fetch(`${baseUrl(env)}/auth/v1/admin/users/${other}`, { headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` } });
      if (ar.ok) em = (await ar.json()).email;
    }
    if (em) to = [em];
  }
  const isStaff = (e) => staff.some((x) => String(x.email).toLowerCase() === String(e).toLowerCase());
  to = to.filter((e) => e && String(e).toLowerCase() !== u.email && (!isStaff(e) || wantsChat(e)));
  const roomName = m.room === "all" ? "Everyone" : m.room === "office" ? "Office" : "";
  const sent = await pushTo(env, to, ["staff", "crew"], {
    title: String((m.sender_name || "New message") + (roomName ? " · " + roomName : "")).slice(0, 120),
    body: String(m.body || (m.photo_path ? "📷 Photo" : "")).slice(0, 240),
    url: "/crm/?go=messages",
    tag: "chat-" + m.room,
  });
  return json({ ok: true, sent });
}

export async function handlePush(request, env) {
  if (!env.SUPABASE_SECRET_KEY) return json({ error: "Notifications are not set up on the server." }, 500);
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String((d && d.action) || "");
  const u = await callerUser(request, env);
  if (!u) return json({ error: "Not allowed." }, 403);
  if (action === "client-visit") {
    // a finished visit: staff or a crew login may report it
    const cr = await sbRest(env, `crew?user_id=eq.${u.id}&active=eq.true&kind=eq.login&select=id`);
    const isCrew = cr.ok && ((await cr.json()) || []).length > 0;
    const st = isCrew ? null : await staffRow(env, u.email);
    if (!isCrew && !(st && (st.role === "owner" || st.role === "office"))) return json({ error: "Not allowed." }, 403);
    return handleClientPush(env, action, d, u, isCrew ? "crew" : st.role);
  }
  if (action === "receipt") {
    // a crew member just uploaded a receipt from their own login
    const cr = await sbRest(env, `crew?user_id=eq.${u.id}&active=eq.true&kind=eq.login&select=name`);
    const c = cr.ok ? ((await cr.json()) || [])[0] : null;
    if (!c) return json({ error: "Not allowed." }, 403);
    await notify(env, "receipt", "Receipt uploaded", `${c.name || "A crew member"} uploaded a receipt to enter.`, "/crm/?go=expenses");
    return json({ ok: true });
  }
  if (action === "chat") return handleChatPush(env, d, u);
  const who = await staffRow(env, u.email);
  if (!who || (who.role !== "owner" && who.role !== "office")) {
    // crew logins can turn on notifications for their own phone (for Messages)
    if (["key", "subscribe", "unsubscribe", "test"].includes(action)) {
      const cr = await sbRest(env, `crew?user_id=eq.${u.id}&active=eq.true&kind=eq.login&select=id`);
      if (cr.ok && ((await cr.json()) || []).length) return crewPushAction(env, action, d, u);
    }
    return json({ error: "Not allowed." }, 403);
  }
  const me = u.email;
  if (/^client-|^news$/.test(action)) return handleClientPush(env, action, d, u, who.role);
  if (action === "key") {
    const k = await vapidKeys(env);
    return k ? json({ ok: true, key: k.publicKey }) : json({ error: "Run the Stage 44 SQL in Supabase first." }, 502);
  }
  if (action === "subscribe") {
    const sub = d.sub || {}, keys = sub.keys || {};
    const endpoint = String(sub.endpoint || "");
    if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}$/.test(String(keys.p256dh || "")) || !/^[A-Za-z0-9_-]{10,60}$/.test(String(keys.auth || "")))
      return json({ error: "bad subscription" }, 400);
    const row = { email: me, endpoint, p256dh: keys.p256dh, auth: keys.auth, label: String(d.label || "").slice(0, 80), kind: "staff" };
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
      sbRest(env, `push_devices?kind=eq.staff&email=eq.${encodeURIComponent(me)}&select=id,label,created_at,last_ok_at,endpoint&order=created_at.asc`),
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


// ============================ Bank (ACH) automatic payments through Stripe ============================
// Rules: a client must have signed the Automatic Payment Authorization (bank) and connected a bank on Stripe's page;
// the owner's "Automatic payments" switch in Foreman must be on; we only charge open invoices that are due and were
// emailed at least 10 days earlier; each invoice is charged at most twice (one retry, 3+ days later).
const etDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
async function rows(env, path) { const r = await sbRest(env, path); return r.ok ? (await r.json()) || [] : []; }
async function activeAutopayAgreement(env, cid) {
  const ag = await rows(env, `signed_agreements?client_id=eq.${cid}&kind=eq.autopay&select=id,method,signed_at&order=signed_at.desc`);
  for (const a of ag) {
    const ev = await rows(env, `agreement_events?agreement_id=eq.${a.id}&kind=eq.autopay_cancelled&select=id`);
    if (!ev.length) return a;
  }
  return null;
}
async function autopayOn(env) { return (((await rows(env, "business?select=autopay_on&id=eq.1"))[0]) || {}).autopay_on === true; }

export async function handlePay(request, env) {
  let d; try { d = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const action = String(d.action || "");
  const token = bearer(request);
  const me = await callerEmail(request, env);
  if (!me) return json({ error: "Please sign in again." }, 403);
  const staff = await staffRow(env, me);
  if (action === "run") {
    if (!staff || staff.role !== "owner") return json({ error: "Only an owner can run automatic payments." }, 403);
    return json({ ok: true, ...(await runAutopay(env, { manual: true })) });
  }
  if (action === "settings") {
    if (!staff) return json({ error: "Not allowed." }, 403);
    return json({ ok: true, connected: Boolean(env.STRIPE_SECRET_KEY), webhook: Boolean(env.STRIPE_WEBHOOK_SECRET), mode: stripeMode(env), on: await autopayOn(env) });
  }
  const cid = String(d.client_id || "");
  const acct = await portalAccountAs(env, token, cid);
  if (!acct || !acct.client) return json({ error: "Not allowed." }, 403);
  let method = (await rows(env, `autopay_methods?client_id=eq.${cid}&select=kind,bank_name,last4,status,created_at`))[0] || null;
  if (action === "status" && !method && env.STRIPE_SECRET_KEY) {
    // In case Stripe's webhook message hasn't arrived (or failed): look the bank up straight from Stripe.
    const c = (await rows(env, `clients?id=eq.${cid}&select=stripe_customer_id`))[0];
    if (c && c.stripe_customer_id) {
      const list = await stripe(env, "GET", "setup_intents", { customer: c.stripe_customer_id, limit: 5 });
      const ok = ((list && list.data) || []).find((x) => x.status === "succeeded" && x.payment_method);
      if (ok) {
        await saveSetup(env, ok.id, { client_id: cid, agreement_id: (ok.metadata || {}).agreement_id });
        method = (await rows(env, `autopay_methods?client_id=eq.${cid}&select=kind,bank_name,last4,status,created_at`))[0] || null;
      }
    }
  }
  if (action === "status") {
    return json({ ok: true, enabled: Boolean(env.STRIPE_SECRET_KEY), mode: stripeMode(env), method, agreement: Boolean(await activeAutopayAgreement(env, cid)) });
  }
  if (staff) return json({ error: "Only the client can connect or remove their bank." }, 403);
  if (action === "connect") {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Online payments aren't open yet." }, 503);
    const ag = await activeAutopayAgreement(env, cid);
    if (!ag) return json({ error: "Please sign the Automatic Payment Authorization first." }, 400);
    if (ag.method !== "ach") return json({ error: "Card automatic payments aren't open yet. Please choose bank." }, 400);
    const c = (await rows(env, `clients?id=eq.${cid}&select=id,name,email,stripe_customer_id`))[0];
    let cust = c && c.stripe_customer_id;
    if (!cust) {
      const r = await stripe(env, "POST", "customers", { name: c.name, email: EMAIL_RE.test(c.email || "") ? c.email : me, metadata: { client_id: cid } }, `cust-${cid}`);
      if (r.error) return json({ error: r.error.message }, 502);
      cust = r.id;
      await sbRest(env, `clients?id=eq.${cid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ stripe_customer_id: cust }) });
    }
    const back = `${PORTAL_URL}?pay=`;
    const s = await stripe(env, "POST", "checkout/sessions", {
      mode: "setup", customer: cust, currency: "usd", payment_method_types: ["us_bank_account"],
      payment_method_options: { us_bank_account: { verification_method: "automatic", financial_connections: { permissions: ["payment_method"] } } },
      success_url: back + "connected", cancel_url: back + "cancelled",
      metadata: { client_id: cid, agreement_id: ag.id, email: me },
      setup_intent_data: { metadata: { client_id: cid, agreement_id: ag.id } },
    });
    if (s.error) return json({ error: s.error.message }, 502);
    return json({ ok: true, url: s.url });
  }
  if (action === "remove") {
    if (!method) return json({ ok: true });
    const m = (await rows(env, `autopay_methods?client_id=eq.${cid}&select=stripe_pm`))[0];
    if (m && m.stripe_pm) await stripe(env, "POST", `payment_methods/${m.stripe_pm}/detach`, {});
    await sbRest(env, `autopay_methods?client_id=eq.${cid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "removed", updated_at: new Date().toISOString() }) });
    await notify(env, "portal", `Bank removed from autopay: ${acct.client.name || "a client"}`, me, "/crm/?go=clients");
    return json({ ok: true });
  }
  return json({ error: "bad action" }, 400);
}

async function saveSetup(env, setupIntentId, meta) {
  const si = await stripe(env, "GET", `setup_intents/${setupIntentId}`, { expand: ["payment_method"] });
  if (si.error || si.status !== "succeeded" || !si.payment_method) return;
  const pm = si.payment_method, cid = (meta && meta.client_id) || (si.metadata || {}).client_id;
  if (!UUID.test(String(cid || ""))) return;
  let status = "active", note = null, kind = pm.type === "card" ? "card" : "ach", bank = null, last4 = null;
  if (pm.type === "us_bank_account") { bank = pm.us_bank_account && pm.us_bank_account.bank_name; last4 = pm.us_bank_account && pm.us_bank_account.last4; }
  if (pm.type === "card") {
    bank = pm.card && pm.card.brand; last4 = pm.card && pm.card.last4;
    if (pm.card && pm.card.funding !== "credit") { status = "rejected"; note = "Debit and prepaid cards are not accepted."; await stripe(env, "POST", `payment_methods/${pm.id}/detach`, {}); }
  }
  const row = { client_id: cid, agreement_id: (meta && meta.agreement_id) || (si.metadata || {}).agreement_id || null, stripe_customer: si.customer, stripe_pm: pm.id,
    stripe_mandate: si.mandate || null, kind, bank_name: bank, last4, status, note, updated_at: new Date().toISOString() };
  await sbRest(env, "autopay_methods?on_conflict=client_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) });
  const c = (await rows(env, `clients?id=eq.${cid}&select=name`))[0] || {};
  await notify(env, "portal", `Autopay bank connected: ${c.name || "a client"}`, `${bank || "Bank"} ending ${last4 || "----"}`, "/crm/?go=clients");
}

async function recordAutopayPaid(env, pi) {
  const ch = (await rows(env, `autopay_charges?payment_intent=eq.${pi.id}&select=id,invoice_id,client_id,amount,status`))[0];
  if (!ch) return;
  await sbRest(env, `autopay_charges?id=eq.${ch.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "succeeded", updated_at: new Date().toISOString() }) });
  const dup = await rows(env, `invoice_payments?reference=eq.${pi.id}&select=id`);
  const today = etDay();
  if (!dup.length) {
    await sbRest(env, "invoice_payments", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ invoice_id: ch.invoice_id, client_id: ch.client_id, paid_on: today, amount: ch.amount, method: "Bank autopay", reference: pi.id, note: "Automatic payment (Stripe)" }) });
  }
  const inv = (await rows(env, `invoices?id=eq.${ch.invoice_id}&select=id,number,total,status`))[0];
  const paid = (await rows(env, `invoice_payments?invoice_id=eq.${ch.invoice_id}&select=amount`)).reduce((a, p) => a + Number(p.amount || 0), 0);
  if (inv && inv.status === "open" && paid + 0.005 >= Number(inv.total || 0)) {
    await sbRest(env, `invoices?id=eq.${inv.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), paid_method: "Bank autopay" }) });
  }
  const c = (await rows(env, `clients?id=eq.${ch.client_id}&select=name`))[0] || {};
  await notify(env, "portal", `Autopay received: ${c.name || "a client"}`, `$${Number(ch.amount).toFixed(2)}${inv ? " · invoice " + inv.number : ""}`, "/crm/?go=billing");
  await notifyClient(env, ch.client_id, "invoice", "Payment received ✓", `Your automatic payment of $${Number(ch.amount).toFixed(2)} went through. Thank you!`, `${PORTAL_URL}?go=billing`);
}
async function recordAutopayFailed(env, pi) {
  const ch = (await rows(env, `autopay_charges?payment_intent=eq.${pi.id}&select=id,invoice_id,client_id,amount,status`))[0];
  if (!ch || ch.status === "failed") return;
  const why = String((pi.last_payment_error && (pi.last_payment_error.message || pi.last_payment_error.code)) || "The bank didn't approve the payment.").slice(0, 300);
  await sbRest(env, `autopay_charges?id=eq.${ch.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", failure: why, updated_at: new Date().toISOString() }) });
  // If it had been recorded as paid (a late bank return), take the payment back off.
  const pay = await rows(env, `invoice_payments?reference=eq.${pi.id}&select=id`);
  if (pay.length) {
    await sbRest(env, `invoice_payments?reference=eq.${pi.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    await sbRest(env, `invoices?id=eq.${ch.invoice_id}&status=eq.paid`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "open", paid_at: null, paid_method: null }) });
  }
  const c = (await rows(env, `clients?id=eq.${ch.client_id}&select=name,email`))[0] || {};
  await notify(env, "portal", `Autopay FAILED: ${c.name || "a client"}`, `$${Number(ch.amount).toFixed(2)} · ${why}`, "/crm/?go=billing");
  await notifyClient(env, ch.client_id, "invoice", "Automatic payment didn't go through", "Please check your bank account or pay another way. We'll try once more in a few days.", `${PORTAL_URL}?go=billing`);
}

export async function handleStripeWebhook(request, env) {
  const raw = await request.text();
  if (!(await verifyStripeSignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) return json({ error: "bad signature" }, 400);
  let ev; try { ev = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
  const o = (ev.data && ev.data.object) || {};
  try {
    if (ev.type === "checkout.session.completed" && o.mode === "setup" && o.setup_intent) await saveSetup(env, o.setup_intent, o.metadata || {});
    else if (ev.type === "setup_intent.succeeded" && o.id) await saveSetup(env, o.id, o.metadata || {});
    else if (ev.type === "payment_intent.succeeded") await recordAutopayPaid(env, o);
    else if (ev.type === "payment_intent.payment_failed") await recordAutopayFailed(env, o);
    else if (ev.type === "mandate.updated" && o.status === "inactive" && o.payment_method) {
      await sbRest(env, `autopay_methods?stripe_pm=eq.${o.payment_method}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "removed", note: "The bank authorization was revoked.", updated_at: new Date().toISOString() }) });
    }
  } catch (e) { console.log("stripe webhook error", ev.type, String(e)); return json({ error: "handler failed" }, 500); }
  return json({ received: true });
}

// The daily job (and the owner's "Run now" button). Returns what it did.
export async function runAutopay(env, opts = {}) {
  const out = { charged: 0, skipped: [], errors: [] };
  if (!env.STRIPE_SECRET_KEY || !env.SUPABASE_SECRET_KEY) { out.skipped.push("Stripe is not connected."); return out; }
  if (!(await autopayOn(env))) { out.skipped.push("Automatic payments are switched off in Foreman."); return out; }
  const today = etDay(), tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  const methods = await rows(env, "autopay_methods?status=eq.active&kind=eq.ach&select=client_id,stripe_customer,stripe_pm,stripe_mandate");
  for (const m of methods) {
    if (!(await activeAutopayAgreement(env, m.client_id))) { out.skipped.push(`${m.client_id}: authorization turned off`); continue; }
    const invs = await rows(env, `invoices?client_id=eq.${m.client_id}&status=eq.open&due_date=lte.${today}&select=id,number,total,sent_at,emailed_at&order=due_date.asc`);
    for (const inv of invs) {
      const sentAt = inv.emailed_at || inv.sent_at;
      if (!sentAt || sentAt > tenDaysAgo) { out.skipped.push(`#${inv.number}: emailed less than 10 days ago`); continue; }
      const tries = await rows(env, `autopay_charges?invoice_id=eq.${inv.id}&select=status,updated_at&order=created_at.desc`);
      if (tries.some((x) => x.status !== "failed")) continue;
      if (tries.length >= 2) { out.skipped.push(`#${inv.number}: already tried twice`); continue; }
      if (tries.length && Date.now() - new Date(tries[0].updated_at).getTime() < 3 * 86400000) continue;
      const paid = (await rows(env, `invoice_payments?invoice_id=eq.${inv.id}&select=amount`)).reduce((a, p) => a + Number(p.amount || 0), 0);
      const due = Math.round((Number(inv.total || 0) - paid) * 100) / 100;
      if (due < 0.5) continue;
      const pi = await stripe(env, "POST", "payment_intents", {
        amount: cents(due), currency: "usd", customer: m.stripe_customer, payment_method: m.stripe_pm, payment_method_types: ["us_bank_account"],
        confirm: true, off_session: true, mandate: m.stripe_mandate || undefined, description: `Latta Corp invoice ${inv.number}`,
        metadata: { invoice_id: inv.id, client_id: m.client_id, invoice_number: String(inv.number) },
      }, `inv-${inv.id}-try-${tries.length + 1}`);
      if (pi.error) { out.errors.push(`#${inv.number}: ${pi.error.message}`); continue; }
      await sbRest(env, "autopay_charges", { method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ invoice_id: inv.id, client_id: m.client_id, payment_intent: pi.id, amount: due, status: "processing" }) });
      if (pi.status === "succeeded") await recordAutopayPaid(env, pi);
      else if (pi.status === "requires_payment_method" || pi.status === "canceled") await recordAutopayFailed(env, pi);
      out.charged++;
    }
  }
  if (opts.manual || out.charged || out.errors.length) await notify(env, "portal", "Automatic payments run", `${out.charged} charged${out.errors.length ? " · " + out.errors.length + " errors" : ""}`, "/crm/?go=billing");
  return out;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutopay(env).catch((e) => console.log("autopay run failed", String(e))));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      // Safe status check (shows whether the settings exist, never their values).
      return json({ ok: true, emailKeySet: Boolean(env.RESEND_API_KEY), crmKeySet: Boolean(env.SUPABASE_SECRET_KEY), turnstileSet: Boolean(env.TURNSTILE_SECRET_KEY), stripeSet: Boolean(env.STRIPE_SECRET_KEY), stripeWebhookSet: Boolean(env.STRIPE_WEBHOOK_SECRET), sendsTo: (env.TO_EMAIL || DEFAULT_TO) ? (env.TO_EMAIL || DEFAULT_TO).replace(/^(.).*(@.*)$/, "$1***$2") : null });
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
    if (url.pathname === "/api/portal/push") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handlePortalPush(request, env);
    }
    if (url.pathname === "/api/push") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handlePush(request, env);
    }
    if (url.pathname === "/api/invoices/email") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleInvoiceEmail(request, env);
    }
    if (url.pathname === "/api/pay") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handlePay(request, env);
    }
    if (url.pathname === "/api/stripe/webhook") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleStripeWebhook(request, env);
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

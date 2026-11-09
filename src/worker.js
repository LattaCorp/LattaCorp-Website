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
//   payments@ -> billing emails: invoices, reminders, receipts (used when automatic billing emails are added)
// Form notifications to the business still come from FROM_EMAIL. Support@ is the one address people talk to.
const AUTO_FROM = "Latta Corp of Central Florida <website@lattacorpfl.com>";
const BILLING_FROM = "Latta Corp Billing <payments@lattacorpfl.com>";
const SUPPORT_EMAIL = "Support@lattacorpfl.com";
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

  // Save to the CRM and send the email at the same time. The visitor sees success if at least one of them worked.
  const sendEmail = () => sendViaResend(env, payload);
  const [emailed, saved] = await Promise.all([sendEmail(), saveLead(env, kind, data.lang, fields, attachments.length)]);
  if (!emailed && !saved) return json({ error: "email failed" }, 502);
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
// Clients sign in with a 6-digit code emailed to them. A code is only sent to an email that belongs to a client
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
function portalEmail({ heading, lines, code, button, link, small, es }) {
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
${es ? "Este es un mensaje automático. Por favor no responda a este correo. ¿Preguntas? Escriba a" : "This is an automated message. Please don't reply to this email. Questions? Email"} <a href="mailto:${SUPPORT_EMAIL}" style="color:#1b552b">${SUPPORT_EMAIL}</a> ${es ? "o llame o envíe un texto al" : "or call or text"} <a href="tel:4074705309" style="color:#1b552b">407-470-5309</a>.<br>
Latta Corp of Central Florida · Kissimmee, FL · <a href="${SITE}" style="color:#1b552b">lattacorpfl.com</a></td></tr>
</table></td></tr></table></body></html>`;
}
// Plain-text twin of portalEmail (mail filters trust messages that include one).
function portalText({ heading, lines, code, button, link, small, es }) {
  const strip = (s) => String(s).replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  return [strip(heading), "", ...lines.map(strip), code ? "\n" + code + "\n" : "", button ? strip(button) + ": " + link : "", small ? "\n" + strip(small) : "",
    "\n--", es ? "Este es un mensaje automático. Por favor no responda. ¿Preguntas? " + SUPPORT_EMAIL + " o 407-470-5309."
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
    if (rows.length >= 5 || (rows[0] && Date.now() - Date.parse(rows[0].created_at) < 45000)) return json({ ok: true });
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
  const [emailed, saved] = await Promise.all([sendViaResend(env, payload), saveLead(env, kind, d.lang, fields, 0, acct.client.id)]);
  if (!emailed && !saved) return json({ error: "Could not send. Please call or text 407-470-5309." }, 502);
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
        `Para entrar, abra el portal y escriba este correo (${esc(to)}). Le enviaremos un código de un solo uso. No necesita contraseña.`],
      button: "Abrir mi portal", link: PORTAL_URL + "?lang=es",
      small: "¿Preguntas? Llame o envíe un texto al 407-470-5309.",
    } : {
      heading: `Welcome${name ? ", " + esc(name) : ""}`,
      lines: ["You can now view your LattaCorp account online, any time:",
        "• Upcoming and past visits<br>• Invoices, payments and printable statements<br>• Photos of your property<br>• Request service or a quote",
        `To sign in, open the portal and enter this email (${esc(to)}). We'll send you a one-time code. No password needed.`],
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
    if (url.pathname === "/api/portal/code" || url.pathname === "/api/portal/request" || url.pathname === "/api/portal/invite") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      if (url.pathname === "/api/portal/code") return handlePortalCode(request, env);
      if (url.pathname === "/api/portal/request") return handlePortalRequest(request, env);
      return handlePortalInvite(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

// Latta Corp website server code (Cloudflare Worker).
// The static website is served automatically. This file only handles form submissions sent to /api/submit:
// it emails them to the business through Resend. Settings: TO_EMAIL (wrangler.jsonc) and RESEND_API_KEY (a secret
// set in the Cloudflare dashboard: Workers & Pages > lattacorp-website > Settings > Variables and Secrets).

// Used if the TO_EMAIL setting is missing in Cloudflare.
const DEFAULT_TO = "lattacorpofcentralfl@gmail.com";
// The CRM database (Supabase). The URL is public; the secret key SUPABASE_SECRET_KEY is set in Cloudflare (Settings > Variables and Secrets).
const DEFAULT_SUPABASE_URL = "https://lvaofwtfxwlqwvzesckt.supabase.co";
// Public (browser-safe) key, the same one in crm/config.js. Used only to ask Supabase who a signed-in person is.
const PUBLISHABLE_KEY = "sb_publishable_1N8kZ8Zk5YvMA0W8Fzpsnw_jWvkrVlK";
const KINDS = ["Quote request", "Service request", "Contact message", "Proposal request"];
const MAX_FIELDS = 60, MAX_VALUE = 5000, MAX_PHOTOS = 8, MAX_PHOTO_BYTES = 4 * 1024 * 1024, MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// Saves the submission as a lead in the CRM database. Never throws; returns true if saved.
async function saveLead(env, kind, lang, fields, photoCount) {
  if (!env.SUPABASE_SECRET_KEY) return false;
  const pick = (re) => (fields.find((f) => re.test(f.label)) || {}).value || "";
  const row = {
    kind, lang: String(lang || "en").slice(0, 5),
    name: pick(/name/i).slice(0, 200), email: pick(/^e-?mail/i).slice(0, 200), phone: pick(/phone/i).slice(0, 60),
    address: (pick(/address/i) || pick(/community/i)).slice(0, 300), service: pick(/^service(s)?\b|which services/i).slice(0, 300),
    fields, photo_count: photoCount,
  };
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

export async function handleSubmit(request, env) {
  // The browser sends one JSON message: { kind, lang, lc_trap_7, fields: [...], photos: [{ filename, content (base64) }] }.
  // Photos are encoded to base64 in the visitor's browser so this server code stays very light.
  let data;
  try { data = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  if (!data || typeof data !== "object") return json({ error: "bad request" }, 400);

  // Spam trap: a hidden box people never fill in.
  if (String(data.lc_trap_7 || "").trim() !== "") { console.log("spam trap triggered; message dropped"); return json({ error: "rejected" }, 400); }

  const kind = String(data.kind || "");
  if (!KINDS.includes(kind)) return json({ error: "bad kind" }, 400);

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
    from: env.FROM_EMAIL || "Latta Corp Website <onboarding@resend.dev>",
    to: [env.TO_EMAIL || DEFAULT_TO],
    subject: `${kind}${name ? " from " + name.slice(0, 80) : ""}`.replace(/[\r\n]/g, " "),
    html,
  };
  if (emailOk) payload.reply_to = email;
  if (attachments.length) payload.attachments = attachments;

  // Save to the CRM and send the email at the same time. The visitor sees success if at least one of them worked.
  const sendEmail = async () => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch { return false; }
  };
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      // Safe status check (shows whether the settings exist, never their values).
      return json({ ok: true, emailKeySet: Boolean(env.RESEND_API_KEY), crmKeySet: Boolean(env.SUPABASE_SECRET_KEY), sendsTo: (env.TO_EMAIL || DEFAULT_TO) ? (env.TO_EMAIL || DEFAULT_TO).replace(/^(.).*(@.*)$/, "$1***$2") : null });
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
    return env.ASSETS.fetch(request);
  },
};

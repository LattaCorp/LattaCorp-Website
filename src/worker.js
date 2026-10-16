// Latta Corp website server code (Cloudflare Worker).
// The static website is served automatically. This file only handles form submissions sent to /api/submit:
// it emails them to the business through Resend. Settings: TO_EMAIL (wrangler.jsonc) and RESEND_API_KEY (a secret
// set in the Cloudflare dashboard: Workers & Pages > lattacorp-website > Settings > Variables and Secrets).

// Used if the TO_EMAIL setting is missing in Cloudflare.
const DEFAULT_TO = "lattacorpofcentralfl@gmail.com";
// The CRM database (Supabase). The URL is public; the secret key SUPABASE_SECRET_KEY is set in Cloudflare (Settings > Variables and Secrets).
const DEFAULT_SUPABASE_URL = "https://lvaofwtfxwlqwvzesckt.supabase.co";
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
    return env.ASSETS.fetch(request);
  },
};

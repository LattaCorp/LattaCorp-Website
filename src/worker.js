// Latta Corp website server code (Cloudflare Worker).
// The static website is served automatically. This file only handles form submissions sent to /api/submit:
// it emails them to the business through Resend. Settings: TO_EMAIL (wrangler.jsonc) and RESEND_API_KEY (a secret
// set in the Cloudflare dashboard: Workers & Pages > lattacorp-website > Settings > Variables and Secrets).

const KINDS = ["Quote request", "Service request", "Contact message", "Proposal request"];
const MAX_FIELDS = 60, MAX_VALUE = 5000, MAX_PHOTOS = 8, MAX_PHOTO_BYTES = 4 * 1024 * 1024, MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function handleSubmit(request, env) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: "bad request" }, 400); }

  // Spam trap: a hidden box people never fill in.
  if (String(form.get("website") || "").trim() !== "") return json({ ok: true });

  const kind = String(form.get("kind") || "");
  if (!KINDS.includes(kind)) return json({ error: "bad kind" }, 400);

  let fields;
  try { fields = JSON.parse(String(form.get("fields") || "[]")); } catch { return json({ error: "bad fields" }, 400); }
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > MAX_FIELDS) return json({ error: "bad fields" }, 400);
  fields = fields.map((f) => ({ label: String(f.label || "").slice(0, 200), value: String(f.value || "").slice(0, MAX_VALUE) }));

  const attachments = [];
  let total = 0;
  for (const [key, val] of form.entries()) {
    if (!/^photo\d+$/.test(key) || typeof val === "string") continue;
    if (attachments.length >= MAX_PHOTOS) break;
    if (!String(val.type).startsWith("image/") || val.size > MAX_PHOTO_BYTES) continue;
    total += val.size;
    if (total > MAX_TOTAL_BYTES) break;
    const name = (val.name || "photo.jpg").replace(/[^\w.\- ]/g, "_").slice(0, 80);
    attachments.push({ filename: name, content: toBase64(await val.arrayBuffer()) });
  }

  const pick = (re) => (fields.find((f) => re.test(f.label)) || {}).value || "";
  const name = pick(/name/i);
  const email = pick(/^e-?mail/i);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  const rows = fields.map((f) => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555"><b>${esc(f.label)}</b></td><td style="padding:6px 0;white-space:pre-wrap">${esc(f.value)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px"><h2 style="color:#1b552b;margin:0 0 12px">${esc(kind)}</h2><table>${rows}</table>`
    + `<p style="color:#777;margin-top:16px">Sent from the Latta Corp website (${esc(String(form.get("lang") || "en") === "es" ? "Spanish" : "English")} page)`
    + `${attachments.length ? `, with ${attachments.length} photo${attachments.length > 1 ? "s" : ""} attached` : ""}.</p></div>`;

  const payload = {
    from: env.FROM_EMAIL || "Latta Corp Website <onboarding@resend.dev>",
    to: [env.TO_EMAIL],
    subject: `${kind}${name ? " from " + name.slice(0, 80) : ""}`.replace(/[\r\n]/g, " "),
    html,
  };
  if (emailOk) payload.reply_to = email;
  if (attachments.length) payload.attachments = attachments;

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { return json({ error: "email service unreachable" }, 502); }
  if (!res.ok) return json({ error: "email failed" }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/submit") {
      if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
      return handleSubmit(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

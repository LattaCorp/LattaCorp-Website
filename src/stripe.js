// Stripe for bank (ACH) automatic payments.
// Clients connect their bank on Stripe's own hosted page (Checkout in "setup" mode), so bank logins and account
// numbers never touch our site. Charges are made by the daily job in worker.js, and Stripe tells us how each one
// went through the webhook below. Needs two Cloudflare secrets: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.

const API = "https://api.stripe.com/v1/";

// Stripe takes form-encoded bodies with nested keys like a[b][0]=c.
export function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? formEncode(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

// `version` sets a Stripe-Version for one call (card surcharges need a preview version).
export async function stripe(env, method, path, params, idempotencyKey, version) {
  if (!env.STRIPE_SECRET_KEY) return { error: { message: "Stripe is not connected yet." } };
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (version) headers["Stripe-Version"] = version;
  let url = API + path, body;
  if (method === "GET") { if (params) url += "?" + formEncode(params); }
  else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = formEncode(params || {}); }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  try {
    const r = await fetch(url, { method, headers, body });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || { message: `Stripe error ${r.status}` } };
  } catch (e) {
    return { error: { message: "Could not reach Stripe." } };
  }
}

export const stripeMode = (env) => (String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_") || String(env.STRIPE_SECRET_KEY || "").startsWith("rk_live_") ? "live" : "test");

// Checks the Stripe-Signature header (HMAC-SHA256 of "timestamp.body"), allowing 5 minutes of clock difference.
export async function verifyStripeSignature(payload, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(",").map((p) => p.split("=").map((s) => s.trim())).filter((p) => p.length === 2 && p[0] !== "v1"));
  const sigs = String(header).split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(now - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((a, c, i) => a | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

export const cents = (n) => Math.round(Number(n || 0) * 100);
// Stripe's card surcharge field (amount_details[surcharge]) is in public preview: it marks the fee as a surcharge for
// the card networks, and Stripe refuses it on debit/prepaid cards or above the allowed maximum.
export const SURCHARGE_VERSION = "2026-10-28.preview";

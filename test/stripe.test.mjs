// Checks for bank autopay: node test/stripe.test.mjs
import { formEncode, verifyStripeSignature } from "../src/stripe.js";
import { runAutopay, handleStripeWebhook } from "../src/worker.js";
import assert from "node:assert";

// form encoding the way Stripe wants it
assert.equal(formEncode({ a: 1, b: { c: "x y" }, d: ["p", "q"] }), "a=1&b%5Bc%5D=x%20y&d%5B0%5D=p&d%5B1%5D=q");

// webhook signatures
const secret = "whsec_test";
async function sign(body, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return `t=${t},v1=${[...mac].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
assert.equal(await verifyStripeSignature("{}", await sign("{}"), secret), true);
assert.equal(await verifyStripeSignature("{x}", await sign("{}"), secret), false, "changed body fails");
assert.equal(await verifyStripeSignature("{}", await sign("{}", Math.floor(Date.now() / 1000) - 1000), secret), false, "old timestamp fails");

// a tiny fake database + fake Stripe
const day = (n) => new Date(Date.now() + n * 86400000).toISOString();
const ymd = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + n * 86400000));
function fresh(on) {
  return {
    business: [{ id: 1, autopay_on: on }],
    autopay_methods: [{ client_id: "c1", stripe_customer: "cus_1", stripe_pm: "pm_1", stripe_mandate: "mandate_1", status: "active", kind: "ach" }],
    signed_agreements: [{ id: "a1", client_id: "c1", kind: "autopay", method: "ach", signed_at: day(-30) }],
    agreement_events: [],
    invoices: [
      { id: "i1", client_id: "c1", number: 101, total: 150, status: "open", due_date: ymd(-1), emailed_at: day(-12) },
      { id: "i2", client_id: "c1", number: 102, total: 80, status: "open", due_date: ymd(-1), emailed_at: day(-3) }, // emailed too recently
      { id: "i3", client_id: "c1", number: 103, total: 60, status: "open", due_date: ymd(5), emailed_at: day(-12) }, // not due yet
    ],
    invoice_payments: [], autopay_charges: [], clients: [{ id: "c1", name: "Test Client" }], push_devices: [], push_prefs: [], staff: [],
  };
}
let db, stripeCalls;
function filt(rows, qs) {
  for (const [k, v] of qs) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    rows = rows.filter((r) => {
      const x = r[k] == null ? "" : String(r[k]);
      if (op === "eq") return x === val;
      if (op === "lte") return x <= val;
      if (op === "in") return val.replace(/[()]/g, "").split(",").includes(x);
      return true;
    });
  }
  return rows;
}
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith("https://api.stripe.com/")) {
    stripeCalls.push({ url, body: opts.body, idem: opts.headers && opts.headers["Idempotency-Key"] });
    return new Response(JSON.stringify({ id: "pi_" + stripeCalls.length, status: "processing" }), { status: 200 });
  }
  const m = url.match(/\/rest\/v1\/([a-z_]+)(\?.*)?$/);
  if (!m) return new Response("{}", { status: 200 });
  const table = m[1], qs = [...new URLSearchParams(m[2] || "")];
  db[table] = db[table] || [];
  const method = opts.method || "GET";
  if (method === "GET") return new Response(JSON.stringify(filt(db[table], qs)), { status: 200 });
  if (method === "POST") { const b = JSON.parse(opts.body); db[table].push({ id: "r" + Math.random(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...b }); return new Response("", { status: 201 }); }
  if (method === "PATCH") { const b = JSON.parse(opts.body); filt(db[table], qs).forEach((r) => Object.assign(r, b)); return new Response(null, { status: 204 }); }
  if (method === "DELETE") { const keep = new Set(filt(db[table], qs)); db[table] = db[table].filter((r) => !keep.has(r)); return new Response(null, { status: 204 }); }
  return new Response("{}", { status: 200 });
};
const env = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: secret, SUPABASE_SECRET_KEY: "sb", SUPABASE_URL: "https://db.test" };

// switch off => nothing charged
db = fresh(false); stripeCalls = [];
let out = await runAutopay(env);
assert.equal(out.charged, 0); assert.equal(stripeCalls.length, 0);

// switch on => only the due invoice emailed 10+ days ago is charged, once, with the mandate
db = fresh(true); stripeCalls = [];
out = await runAutopay(env);
assert.equal(out.charged, 1, JSON.stringify(out));
assert.equal(stripeCalls.length, 1);
assert(stripeCalls[0].body.includes("amount=15000") && stripeCalls[0].body.includes("mandate=mandate_1") && stripeCalls[0].body.includes("off_session=true"));
assert.equal(stripeCalls[0].idem, "inv-i1-try-1");
assert.equal(db.autopay_charges.length, 1);
out = await runAutopay(env);
assert.equal(out.charged, 0, "a processing charge is never charged again");

// authorization turned off => no charge
db = fresh(true); stripeCalls = []; db.agreement_events.push({ agreement_id: "a1", kind: "autopay_cancelled" });
out = await runAutopay(env); assert.equal(out.charged, 0);

// webhook: success records the payment and marks the invoice paid
db = fresh(true); stripeCalls = [];
await runAutopay(env);
const pid = db.autopay_charges[0].payment_intent;
const body = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: pid, status: "succeeded" } } });
let r = await handleStripeWebhook(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": await sign(body) }, body }), env);
assert.equal(r.status, 200);
assert.equal(db.invoice_payments.length, 1); assert.equal(db.invoice_payments[0].amount, 150);
assert.equal(db.invoices.find((i) => i.id === "i1").status, "paid");
// replaying the same event doesn't record it twice
r = await handleStripeWebhook(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": await sign(body) }, body }), env);
assert.equal(db.invoice_payments.length, 1);
// a later bank return takes the payment back off and reopens the invoice
const fb = JSON.stringify({ type: "payment_intent.payment_failed", data: { object: { id: pid, last_payment_error: { message: "Insufficient funds" } } } });
r = await handleStripeWebhook(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": await sign(fb) }, body: fb }), env);
assert.equal(db.invoice_payments.length, 0); assert.equal(db.invoices.find((i) => i.id === "i1").status, "open");
assert.equal(db.autopay_charges[0].status, "failed");
// bad signature is refused
r = await handleStripeWebhook(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body }), env);
assert.equal(r.status, 400);
console.log("stripe autopay checks passed");

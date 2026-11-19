// Checks for bank autopay: node test/stripe.test.mjs
import { formEncode, verifyStripeSignature } from "../src/stripe.js";
import { runAutopay, handleStripeWebhook, handlePayInvoice, handleCard } from "../src/worker.js";
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
    stripeCalls.push({ url, body: opts.body, idem: opts.headers && opts.headers["Idempotency-Key"], version: opts.headers && opts.headers["Stripe-Version"] });
    const ct = url.match(/confirmation_tokens\/(ctoken_\w+)/);
    if (ct) return new Response(JSON.stringify({ id: ct[1], payment_method_preview: { type: "card", card: { brand: "visa", last4: "4242", funding: ct[1].split("_")[1] } } }), { status: 200 });
    if (url.endsWith("/payment_intents") && String(opts.body).includes("confirmation_token")) return new Response(JSON.stringify({ id: "pi_card" + stripeCalls.length, status: "succeeded", metadata: {} }), { status: 200 });
    if (url.includes("checkout/sessions")) return new Response(JSON.stringify({ id: "cs_" + stripeCalls.length, url: "https://checkout.stripe.com/x" }), { status: 200 });
    if (url.endsWith("/customers")) return new Response(JSON.stringify({ id: "cus_new" }), { status: 200 });
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

// "Pay now by bank" from the invoice link
const C1 = "11111111-1111-1111-1111-111111111111", I1 = "22222222-2222-2222-2222-222222222222", TOK = "a".repeat(40);
const payReq = (tok) => new Request("https://x/api/pay-invoice", { method: "POST", body: JSON.stringify({ t: tok }) });
db = fresh(false); stripeCalls = [];
db.clients.push({ id: C1, name: "Pay Client", email: "p@x.com" });
db.invoices.push({ id: I1, client_id: C1, number: 200, total: 90, status: "open", share_token: TOK });
db.invoice_payments.push({ invoice_id: I1, amount: 15 });
r = await handlePayInvoice(payReq("short"), env); assert.equal(r.status, 400);
r = await handlePayInvoice(payReq(TOK), env); let j = await r.json();
assert.equal(j.url, "https://checkout.stripe.com/x", JSON.stringify(j));
const cs = stripeCalls.find((c) => c.url.includes("checkout/sessions"));
assert(cs.body.includes("unit_amount%5D=7500") && cs.body.includes("mode=payment") && cs.body.includes("excluded_payment_method_types"), "charges only what's left, bank only");
assert.equal(db.clients.find((c) => c.id === C1).stripe_customer_id, "cus_new");
// Stripe finishes checkout -> processing, then success marks it paid as an online bank payment
const md = { invoice_id: I1, client_id: C1, invoice_number: "200", source: "paynow" };
const done = JSON.stringify({ type: "checkout.session.completed", data: { object: { mode: "payment", payment_intent: "pi_pay", amount_total: 7500, payment_status: "unpaid", metadata: md } } });
await handleStripeWebhook(new Request("https://x", { method: "POST", headers: { "stripe-signature": await sign(done) }, body: done }), env);
assert.equal(db.autopay_charges.filter((c) => c.source === "paynow" && c.status === "processing").length, 1);
r = await handlePayInvoice(payReq(TOK), env); assert.equal(r.status, 409, "can't start a second payment while one is processing");
const ok = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_pay", amount: 7500, metadata: md } } });
await handleStripeWebhook(new Request("https://x", { method: "POST", headers: { "stripe-signature": await sign(ok) }, body: ok }), env);
assert.equal(db.invoices.find((i) => i.id === I1).status, "paid");
assert.equal(db.invoice_payments.filter((p) => p.invoice_id === I1 && p.method === "Bank (online)").length, 1);
r = await handlePayInvoice(payReq(TOK), env); assert.equal(r.status, 400, "paid invoice can't be paid again");

// ---------- credit card with a surcharge ----------
const cardReq = (b) => new Request("https://x/api/card", { method: "POST", body: JSON.stringify({ t: TOK, ...b }) });
const envC = { ...env, STRIPE_PUBLISHABLE_KEY: "pk_test_x" };
db = fresh(false); stripeCalls = [];
db.clients.push({ id: C1, name: "Pay Client", email: "p@x.com" });
db.invoices.push({ id: I1, client_id: C1, number: 200, total: 120, status: "open", share_token: TOK });
// switched off: no card option, nothing charged
r = await handleCard(cardReq({ action: "options" }), envC); j = await r.json(); assert.equal(j.on, false); assert.equal(j.pk, null);
db.business[0].card_on = true; db.business[0].card_fee_pct = 3;
// not before the start date (30 days after notifying)
db.business[0].card_start = ymd(5);
r = await handleCard(cardReq({ action: "options" }), envC); j = await r.json();
assert.equal(j.on, true); assert.equal(j.fee, 0, "before the start date: cards with no fee");
r = await handleCard(cardReq({ action: "quote", ct: "ctoken_credit" }), envC); j = await r.json();
assert.deepEqual([j.surcharge, j.total], [0, 120]);
r = await handleCard(cardReq({ action: "quote", ct: "ctoken_debit" }), envC); assert.equal(r.status, 400, "debit still refused");
// (a no-fee payment: charged $120, no surcharge field, normal API version)
{
  const saveDb = JSON.parse(JSON.stringify(db)), saveCalls = stripeCalls.length;
  r = await handleCard(cardReq({ action: "pay", ct: "ctoken_credit", total: 120 }), envC); j = await r.json();
  assert.equal(j.paid, true, JSON.stringify(j));
  const c0 = stripeCalls.slice(saveCalls).find((c) => c.url.endsWith("/payment_intents"));
  assert(c0.body.includes("amount=12000") && !c0.body.includes("amount_details") && !c0.version);
  assert(db.invoice_payments.find((p) => p.invoice_id === I1).note.includes("no surcharge"));
  db = saveDb; stripeCalls = stripeCalls.slice(0, saveCalls);
}
db.business[0].card_start = ymd(0);
r = await handleCard(cardReq({ action: "options" }), envC); j = await r.json(); assert.equal(j.on, true); assert.equal(j.fee, 3); assert.equal(j.due, 120);
// debit and prepaid cards are refused before any charge
for (const f of ["debit", "prepaid", "unknown"]) {
  r = await handleCard(cardReq({ action: "quote", ct: "ctoken_" + f }), envC); j = await r.json();
  assert.equal(r.status, 400); assert(j.refused, f);
}
r = await handleCard(cardReq({ action: "pay", ct: "ctoken_debit", total: 120 }), envC); assert.equal(r.status, 400);
assert(!stripeCalls.some((c) => c.url.endsWith("/payment_intents")), "a debit card is never charged");
// a credit card gets the price with the fee shown
r = await handleCard(cardReq({ action: "quote", ct: "ctoken_credit" }), envC); j = await r.json();
assert.deepEqual([j.due, j.surcharge, j.total, j.card], [120, 3.6, 123.6, "Visa ending 4242"]);
// paying a different total than quoted is refused
r = await handleCard(cardReq({ action: "pay", ct: "ctoken_credit", total: 120 }), envC); assert.equal(r.status, 409);
// paying: one charge of $123.60, invoice paid with $120 recorded, the $3.60 fee kept on the charge
r = await handleCard(cardReq({ action: "pay", ct: "ctoken_credit", total: 123.6 }), envC); j = await r.json();
assert.equal(j.paid, true, JSON.stringify(j));
const piCall = stripeCalls.find((c) => c.url.endsWith("/payment_intents"));
assert(piCall.body.includes("amount=12360") && piCall.body.includes("payment_method_types%5B0%5D=card"));
assert(piCall.body.includes("amount_details%5Bsurcharge%5D%5Bamount%5D=360") && piCall.body.includes("enforce_validation%5D=enabled"), "the $3.60 is flagged as a surcharge");
assert.equal(piCall.version, "2026-03-25.preview");
assert.equal(db.invoices.find((i) => i.id === I1).status, "paid");
const cp = db.invoice_payments.find((p) => p.invoice_id === I1);
assert.equal(cp.amount, 120); assert.equal(cp.method, "Credit card"); assert(cp.note.includes("$3.60"));
assert.equal(db.autopay_charges.find((c) => c.source === "card").surcharge, 3.6);
console.log("stripe autopay checks passed");

// Checks for Zelle alerts: node test/zelle.test.mjs
import assert from "node:assert";
import { readEmail, readZelle, looksLikeZelle, fromBank, invoiceNumbers, nameScore } from "../src/zelle.js";
import { handleZelleEmail } from "../src/worker.js";

const CF_OK = "Authentication-Results: mx.cloudflare.net; dkim=pass header.d=ealerts.bankofamerica.com header.s=s1; spf=pass";
const html = (sender, amt, memo) => `<html><body><table><tr><td><p>${sender} sent you $${amt}</p></td></tr>
<tr><td>Memo</td></tr><tr><td>${memo}</td></tr><tr><td>The money is in your account.</td></tr></table></body></html>`;
function email({ top = CF_OK, from = "Bank of America <customerservice@ealerts.bankofamerica.com>", subject, body, qp = true, id }) {
  const enc = qp ? body.replace(/=/g, "=3D").replace(/(.{70})/g, "$1=\r\n") : body;
  return `${top ? top + "\r\n" : ""}Received: by mx.google.com\r\nFrom: ${from}\r\nTo: zelle@lattacorpfl.com\r\nSubject: ${subject}\r\nMessage-ID: <${id || Math.random()}@bofa>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="b1"\r\n\r\n--b1\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: ${qp ? "quoted-printable" : "7bit"}\r\n\r\n${enc}\r\n--b1--\r\n`;
}

// reading the email
let m = readEmail(email({ subject: "=?UTF-8?Q?Zelle=C2=AE:_You_received_$125.50_from_JOHN_A_SMITH?=", body: html("JOHN A SMITH", "125.50", "Invoice LC-0317 thanks") }));
assert.equal(m.subject, "Zelle®: You received $125.50 from JOHN A SMITH");
assert(looksLikeZelle(m));
let z = readZelle(m);
assert.deepEqual(z, { amount: 125.5, sender: "JOHN A SMITH", memo: "Invoice LC-0317 thanks" });
assert.equal(fromBank(m), true);
// a plain-text alert with "sent you" and a thousands separator
m = readEmail(`From: alerts@bankofamerica.com\r\nSubject: You've received money with Zelle\r\nContent-Type: text/plain\r\n\r\nMaria Lopez sent you $1,240.00\r\nMessage: #318\r\n`);
assert.deepEqual(readZelle(m), { amount: 1240, sender: "Maria Lopez", memo: "#318" });
// not from the bank / faked results lower down are not trusted
assert.equal(fromBank(readEmail(email({ top: "", subject: "Zelle: You received $5.00 from X", body: html("X", "5.00", "") }))), false, "no Cloudflare result");
assert.equal(fromBank(readEmail(email({ top: "Authentication-Results: mx.cloudflare.net; dkim=fail", subject: "s", body: "x" }).replace("Received:", CF_OK + "\r\nReceived:"))), false, "a faked pass further down is ignored");
assert.equal(fromBank(readEmail(email({ from: "Bank <alerts@bankofamerica.com.evil.io>", subject: "s", body: "x" }))), false, "look-alike domain");
// invoice numbers and names
assert.deepEqual(invoiceNumbers("Invoice LC-0317 and #12"), { labeled: [317, 12], bare: [] });
assert.deepEqual(invoiceNumbers("for 318"), { labeled: [], bare: [318] });
assert.equal(nameScore("JOHN A SMITH", "Smith, John"), 2);
assert.equal(nameScore("MARY SMITH", "Smith, John"), 1);
assert.equal(nameScore("ACME PROPERTY MGMT", "Smith, John"), 0);
assert.equal(nameScore("SHINGLE CREEK RESERVE HOA", "Shingle Creek Reserve HOA"), 2);

// ---------- matching against a fake database ----------
const C1 = "11111111-1111-1111-1111-111111111111", C2 = "22222222-2222-2222-2222-222222222222";
const I1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", I2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", I3 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
let db;
function fresh(auto = true) {
  db = {
    business: [{ id: 1, zelle_auto: auto }],
    clients: [{ id: C1, name: "Smith, John" }, { id: C2, name: "Shingle Creek Reserve HOA" }],
    client_contacts: [{ client_id: C2, name: "Dana Whitfield" }],
    invoices: [
      { id: I1, client_id: C1, number: 317, total: 125.5, status: "open" },
      { id: I2, client_id: C2, number: 320, total: 450, status: "open" },
      { id: I3, client_id: C2, number: 321, total: 90, status: "open" },
    ],
    invoice_payments: [], zelle_payments: [], push_devices: [], staff: [], app_secrets: [],
  };
}
function filt(rows, qs) {
  for (const [k, v] of qs) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    rows = rows.filter((r) => {
      const x = r[k] == null ? "" : String(r[k]);
      if (op === "eq") return x === val;
      if (op === "in") return val.replace(/[()]/g, "").split(",").includes(x);
      return true;
    });
  }
  return rows;
}
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const mm = url.match(/\/rest\/v1\/([a-z_]+)(\?.*)?$/);
  if (!mm) return new Response("{}", { status: 200 });
  const table = mm[1], qs = [...new URLSearchParams(mm[2] || "")];
  db[table] = db[table] || [];
  const method = opts.method || "GET";
  if (method === "GET") return new Response(JSON.stringify(filt(db[table], qs)), { status: 200 });
  if (method === "POST") {
    const b = JSON.parse(opts.body);
    if (table === "zelle_payments" && db.zelle_payments.some((r) => r.message_id === b.message_id)) return new Response("[]", { status: 201 });
    const row = { id: "r" + Math.random().toString(16).slice(2), ...b };
    db[table].push(row);
    return new Response(JSON.stringify([row]), { status: 201 });
  }
  if (method === "PATCH") { const b = JSON.parse(opts.body); filt(db[table], qs).forEach((r) => Object.assign(r, b)); return new Response(null, { status: 204 }); }
  return new Response("{}", { status: 200 });
};
const env = { SUPABASE_SECRET_KEY: "sb", SUPABASE_URL: "https://db.test" };
const last = () => db.zelle_payments[db.zelle_payments.length - 1];

// memo names the invoice and the amount matches: recorded, invoice paid
fresh();
let out = await handleZelleEmail(env, email({ id: "m1", subject: "Zelle: You received $125.50 from JOHN A SMITH", body: html("JOHN A SMITH", "125.50", "LC-0317") }));
assert.equal(out.status, "recorded", JSON.stringify(last()));
assert.equal(db.invoice_payments.length, 1);
assert.equal(db.invoice_payments[0].method, "Zelle");
assert.equal(db.invoices[0].status, "paid");
// the same email again is ignored
out = await handleZelleEmail(env, email({ id: "m1", subject: "Zelle: You received $125.50 from JOHN A SMITH", body: html("JOHN A SMITH", "125.50", "LC-0317") }));
assert.equal(out.status, "duplicate"); assert.equal(db.invoice_payments.length, 1);

// no memo, but the HOA manager (a contact) paid the exact amount of one invoice: recorded
fresh();
out = await handleZelleEmail(env, email({ subject: "Zelle: You received $90.00 from DANA WHITFIELD", body: html("DANA WHITFIELD", "90.00", "") }));
assert.equal(out.status, "recorded"); assert.equal(db.invoice_payments[0].invoice_id, I3);

// same email, but it didn't provably come from the bank: waits for a tap, nothing recorded
fresh();
out = await handleZelleEmail(env, email({ top: "", subject: "Zelle: You received $125.50 from JOHN A SMITH", body: html("JOHN A SMITH", "125.50", "LC-0317") }));
assert.equal(out.status, "suggested"); assert.equal(db.invoice_payments.length, 0); assert.equal(last().invoice_id, I1);

// owner switched automatic recording off
fresh(false);
out = await handleZelleEmail(env, email({ subject: "Zelle: You received $125.50 from JOHN A SMITH", body: html("JOHN A SMITH", "125.50", "LC-0317") }));
assert.equal(out.status, "suggested"); assert.equal(db.invoice_payments.length, 0);

// a family member (same last name) paying: suggested, not recorded
fresh();
out = await handleZelleEmail(env, email({ subject: "Zelle: You received $125.50 from MARY SMITH", body: html("MARY SMITH", "125.50", "") }));
assert.equal(out.status, "suggested"); assert.equal(db.invoice_payments.length, 0);

// a stranger paying an amount that fits no invoice: unmatched
fresh();
out = await handleZelleEmail(env, email({ subject: "Zelle: You received $33.00 from PAT DOE", body: html("PAT DOE", "33.00", "yard") }));
assert.equal(out.status, "unmatched");

// Gmail's "confirm forwarding" email is kept so the owner can read it
fresh();
out = await handleZelleEmail(env, `From: Gmail Team <forwarding-noreply@google.com>\r\nSubject: (#123456) Gmail Forwarding Confirmation\r\nContent-Type: text/plain\r\n\r\nConfirmation code: 123456\r\nhttps://mail.google.com/mail/vf-abc\r\n`);
assert.equal(out.status, "other"); assert(last().body.includes("123456"));
console.log("zelle checks passed");

// Quick check of the form-sending code: node test/worker.test.mjs
import worker from "../src/worker.js";
import assert from "node:assert";
let sent = null;
globalThis.fetch = async (url, opts) => { sent = { url, opts, body: JSON.parse(opts.body) }; return new Response("{}", { status: 200 }); };
const env = { TO_EMAIL: "owner@example.com", RESEND_API_KEY: "re_test" };
const mk = (extra = {}) => {
  const fd = new FormData();
  fd.append("kind", "Quote request"); fd.append("lang", "en"); fd.append("lc_trap_7", extra.lc_trap_7 ?? ""); delete extra.lc_trap_7;
  fd.append("fields", JSON.stringify([{ label: "Full name", value: "Jane <b>Doe</b>" }, { label: "Email", value: "jane@example.com" }, { label: "Service", value: "Mulching" }]));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return new Request("https://x.test/api/submit", { method: "POST", body: fd });
};
let r = await worker.fetch(mk({ photo0: new File([new Uint8Array(1000)], "yard.jpg", { type: "image/jpeg" }) }), env);
assert.equal(r.status, 200);
assert.equal(sent.body.to[0], "owner@example.com");
assert.equal(sent.body.reply_to, "jane@example.com");
assert.equal(sent.body.attachments.length, 1);
assert(sent.body.html.includes("Jane &lt;b&gt;Doe&lt;/b&gt;"), "html is escaped");
assert(sent.body.subject.startsWith("Quote request from Jane"));
sent = null;
r = await worker.fetch(mk({ lc_trap_7: "spam" }), env); // spam trap: pretend success, send nothing
assert.equal(r.status, 400); assert.equal(sent, null);
r = await worker.fetch(new Request("https://x.test/api/submit", { method: "GET" }), env); assert.equal(r.status, 405);
const bad = new FormData(); bad.append("kind", "Hack"); bad.append("fields", "[]");
r = await worker.fetch(new Request("https://x.test/api/submit", { method: "POST", body: bad }), env); assert.equal(r.status, 400);
globalThis.fetch = async () => new Response("no", { status: 500 });
r = await worker.fetch(mk(), env); assert.equal(r.status, 502);
console.log("all worker checks passed");

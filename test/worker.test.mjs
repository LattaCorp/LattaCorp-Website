// Quick check of the form-sending code: node test/worker.test.mjs
import worker from "../src/worker.js";
import assert from "node:assert";
let sent = null;
let saved = null, dbStatus = 200;
globalThis.fetch = async (url, opts) => {
  if (String(url).includes("/rest/v1/leads")) { saved = { url, opts, body: JSON.parse(opts.body) }; return new Response("", { status: dbStatus }); }
  sent = { url, opts, body: JSON.parse(opts.body) }; return new Response("{}", { status: 200 });
};
const env = { TO_EMAIL: "owner@example.com", RESEND_API_KEY: "re_test", SUPABASE_SECRET_KEY: "sb_secret_test" };
const mk = (extra = {}) => {
  const body = { kind: "Quote request", lang: "en", lc_trap_7: extra.lc_trap_7 ?? "",
    fields: [{ label: "Full name", value: "Jane <b>Doe</b>" }, { label: "Email", value: "jane@example.com" }, { label: "Service", value: "Mulching" }],
    photos: extra.photos || [] };
  return new Request("https://x.test/api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
};
let r = await worker.fetch(mk({ photos: [{ filename: "yard.jpg", content: Buffer.alloc(1000).toString("base64") }] }), env);
assert.equal(r.status, 200);
assert.equal(sent.body.to[0], "owner@example.com");
assert.equal(sent.body.reply_to, "jane@example.com");
assert.equal(sent.body.attachments.length, 1);
assert(sent.body.html.includes("Jane &lt;b&gt;Doe&lt;/b&gt;"), "html is escaped");
assert(sent.body.subject.startsWith("Quote request from Jane"));
assert(saved, "lead saved to CRM"); assert.equal(saved.opts.headers.apikey, "sb_secret_test"); assert.equal(saved.body.name, "Jane <b>Doe</b>"); assert.equal(saved.body.email, "jane@example.com"); assert.equal(saved.body.photo_count, 1); assert.equal(saved.body.kind, "Quote request");
sent = null;
r = await worker.fetch(mk({ lc_trap_7: "spam" }), env); // spam trap: pretend success, send nothing
assert.equal(r.status, 400); assert.equal(sent, null);
r = await worker.fetch(new Request("https://x.test/api/submit", { method: "GET" }), env); assert.equal(r.status, 405);
const bad = JSON.stringify({ kind: "Hack", fields: [] });
r = await worker.fetch(new Request("https://x.test/api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: bad }), env); assert.equal(r.status, 400);
globalThis.fetch = async () => new Response("no", { status: 500 });
r = await worker.fetch(mk(), env); assert.equal(r.status, 502);
// email down but CRM saved => still success; CRM down but email ok => still success
globalThis.fetch = async (url) => String(url).includes("/rest/v1/leads") ? new Response("", { status: 201 }) : new Response("no", { status: 500 });
r = await worker.fetch(mk(), env); assert.equal(r.status, 200);
globalThis.fetch = async (url) => String(url).includes("/rest/v1/leads") ? new Response("bad", { status: 500 }) : new Response("{}", { status: 200 });
r = await worker.fetch(mk(), env); assert.equal(r.status, 200);

// ---- crew login endpoint ----
const CID = "11111111-1111-4111-8111-111111111111", UID = "22222222-2222-4222-8222-222222222222";
let calls = [], crewRow = { id: CID, user_id: null }, ownerToken = "good-owner", staffEmails = ["owner@example.com"];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); calls.push({ url, opts });
  if (url.endsWith("/auth/v1/user")) { const t = (opts.headers.Authorization || "").replace("Bearer ", ""); return t === ownerToken ? new Response(JSON.stringify({ email: "Owner@Example.com" })) : t === "crew-token" ? new Response(JSON.stringify({ email: "luis@example.com" })) : new Response("{}", { status: 401 }); }
  if (url.includes("/rest/v1/staff")) { const e = decodeURIComponent(url.split("email=ilike.")[1]); return new Response(JSON.stringify(staffEmails.filter((x) => x.toLowerCase() === e.toLowerCase()).map((email) => ({ email })))); }
  if (url.includes("/rest/v1/crew") && (opts.method || "GET") === "GET") return new Response(JSON.stringify(crewRow ? [crewRow] : []));
  if (url.includes("/rest/v1/crew") && opts.method === "PATCH") return new Response(null, { status: 204 });
  if (url.endsWith("/auth/v1/admin/users") && opts.method === "POST") { const b = JSON.parse(opts.body); return b.email === "dup@example.com" ? new Response(JSON.stringify({ msg: "A user with this email address has already been registered" }), { status: 422 }) : new Response(JSON.stringify({ id: UID, email: b.email })); }
  if (url.includes("/auth/v1/admin/users/")) return new Response("{}", { status: 200 });
  return new Response("{}", { status: 200 });
};
const cl = (body, token = ownerToken, method = "POST") => new Request("https://x.test/api/crew-login", { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: method === "POST" ? JSON.stringify(body) : undefined });
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "luis@example.com", password: "longenough1" }, null), env); assert.equal(r.status, 403, "no token refused");
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "luis@example.com", password: "longenough1" }, "crew-token"), env); assert.equal(r.status, 403, "crew member cannot create logins");
r = await worker.fetch(cl({}, ownerToken, "GET"), env); assert.equal(r.status, 405);
r = await worker.fetch(cl({ action: "create", crew_id: "nope", email: "a@b.co", password: "longenough1" }), env); assert.equal(r.status, 400);
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "luis@example.com", password: "short" }), env); assert.equal(r.status, 400);
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "owner@example.com", password: "longenough1" }), env); assert.equal(r.status, 400, "owner email refused");
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "dup@example.com", password: "longenough1" }), env); assert.equal(r.status, 400); assert((await r.json()).error.includes("already"));
calls = [];
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "Luis@Example.com", password: "longenough1" }), env); assert.equal(r.status, 200);
const mkUser = calls.find((c) => c.url.endsWith("/auth/v1/admin/users")); assert.equal(JSON.parse(mkUser.opts.body).email, "luis@example.com"); assert.equal(JSON.parse(mkUser.opts.body).email_confirm, true);
const patch = calls.find((c) => c.opts.method === "PATCH"); assert.deepEqual(JSON.parse(patch.opts.body), { kind: "login", user_id: UID, email: "luis@example.com" });
crewRow = { id: CID, user_id: UID };
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "x@y.co", password: "longenough1" }), env); assert.equal(r.status, 409);
r = await worker.fetch(cl({ action: "reset", crew_id: CID, password: "newpassword9" }), env); assert.equal(r.status, 200);
calls = []; r = await worker.fetch(cl({ action: "remove", crew_id: CID }), env); assert.equal(r.status, 200);
assert(calls.some((c) => c.opts.method === "DELETE" && c.url.includes("/auth/v1/admin/users/" + UID)), "auth user deleted");
assert.deepEqual(JSON.parse(calls.find((c) => c.opts.method === "PATCH").opts.body), { kind: "temp", user_id: null, email: "" });
crewRow = { id: CID, user_id: null }; r = await worker.fetch(cl({ action: "reset", crew_id: CID, password: "newpassword9" }), env); assert.equal(r.status, 400);
console.log("all worker checks passed");

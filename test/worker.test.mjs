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
assert.equal(sent.body.subject, "Quote – Jane <b>Doe</b>");
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


// ---- Turnstile ("not a robot" check) ----
{
  const envT = { ...env, TURNSTILE_SECRET_KEY: "ts_secret" };
  let verdict = true, checked = null, verifyStatus = 200;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("turnstile/v0/siteverify")) { checked = Object.fromEntries(opts.body); if (verifyStatus !== 200) return new Response("down", { status: verifyStatus }); return new Response(JSON.stringify({ success: verdict }), { status: 200 }); }
    if (String(url).includes("/rest/v1/leads")) return new Response("", { status: 201 });
    sent = { body: JSON.parse(opts.body) }; return new Response("{}", { status: 200 });
  };
  const mkT = (tok) => new Request("https://x.test/api/submit", { method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
    body: JSON.stringify({ kind: "Contact message", lang: "en", lc_trap_7: "", ts_token: tok, fields: [{ label: "Full name", value: "A" }], photos: [] }) });
  sent = null; r = await worker.fetch(mkT("good"), envT); assert.equal(r.status, 200); assert.equal(checked.secret, "ts_secret"); assert.equal(checked.response, "good"); assert.equal(checked.remoteip, "1.2.3.4"); assert(sent);
  sent = null; verdict = false; r = await worker.fetch(mkT("bad"), envT); assert.equal(r.status, 403); assert.equal(sent, null);
  sent = null; r = await worker.fetch(mkT(""), envT); assert.equal(r.status, 403); assert.equal(sent, null);
  sent = null; verifyStatus = 500; r = await worker.fetch(mkT("x"), envT); assert.equal(r.status, 200, "check down: let it through");
  verifyStatus = 200; verdict = false; checked = null; sent = null; r = await worker.fetch(mkT(""), env); assert.equal(r.status, 200, "no secret set: check is off"); assert.equal(checked, null);
}

// ---- email subjects and sender ----
{
  let bodies = [], refuse = false;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("/rest/v1/leads")) return new Response("", { status: 201 });
    const b = JSON.parse(opts.body); bodies.push(b);
    if (refuse && b.from.includes("lattacorpfl.com")) return new Response('{"message":"domain is not verified"}', { status: 403 });
    return new Response("{}", { status: 200 });
  };
  const envF = { ...env, FROM_EMAIL: "Latta Corp Website <website@lattacorpfl.com>" };
  const send = async (kind, fields, lang = "en") => { bodies = []; const r = await worker.fetch(new Request("https://x.test/api/submit", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, lang, lc_trap_7: "", fields, photos: [] }) }), envF); assert.equal(r.status, 200); return bodies; };
  let b = await send("Quote request", [{ label: "Full name", value: "Jane Doe" }, { label: "Service address", value: "123 Main St, Kissimmee" }, { label: "Service", value: "Mulching" }]);
  assert.equal(b[0].subject, "Quote – Jane Doe – 123 Main St, Kissimmee"); assert.equal(b[0].from, "Latta Corp Website <website@lattacorpfl.com>");
  b = await send("Service request", [{ label: "Full name", value: "Al Ruiz" }, { label: "Home address", value: "45 Oak Ln" }, { label: "Community", value: "The Oaks" }], "es");
  assert.equal(b[0].subject, "Service Request – Al Ruiz – 45 Oak Ln (The Oaks) (Spanish)");
  b = await send("Contact message", [{ label: "Full name", value: "Kim" }, { label: "Message", value: "Hi at 9 Elm St" }]);
  assert.equal(b[0].subject, "Message – Kim");
  b = await send("Proposal request", [{ label: "Your name", value: "Pat Lee" }, { label: "Community or property name", value: "Oak Grove HOA" }, { label: "Property address", value: "9 Palm Dr" }]);
  assert.equal(b[0].subject, "Proposal – Pat Lee – Oak Grove HOA, 9 Palm Dr");
  b = await send("Instant quote signup", [{ label: "Full name", value: "Sam" }, { label: "Service address", value: "1 A St" }, { label: "Signed up at instant quote price", value: "$45 per visit" }]);
  assert.equal(b[0].subject, "Sign-up $45/visit – Sam – 1 A St");
  refuse = true; b = await send("Contact message", [{ label: "Full name", value: "Kim" }]);
  assert.equal(b.length, 2, "retried"); assert.equal(b[1].from, "Latta Corp Website <onboarding@resend.dev>");
}

// ---- client portal ----
{
  const envP = { ...env, FROM_EMAIL: "Latta Corp Website <website@lattacorpfl.com>" };
  let calls = [], allowed = true, recent = [], staff = true, acctOk = true;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); const body = opts.body ? (() => { try { return JSON.parse(opts.body); } catch { return opts.body; } })() : null;
    calls.push({ u, body, headers: opts.headers || {} });
    if (u.includes("/rest/v1/portal_signins?select")) return new Response(JSON.stringify(recent), { status: 200 });
    if (u.includes("/rest/v1/portal_signins")) return new Response("", { status: 201 });
    if (u.includes("rpc/portal_email_allowed")) return new Response(JSON.stringify(allowed), { status: 200 });
    if (u.includes("/auth/v1/admin/users")) return new Response("{}", { status: 422 });
    if (u.includes("/auth/v1/admin/generate_link")) return new Response(JSON.stringify({ properties: { email_otp: "482913", hashed_token: "abc123", verification_type: "magiclink" } }), { status: 200 });
    if (u.includes("/auth/v1/user")) return new Response(JSON.stringify({ email: "pat@example.com" }), { status: 200 });
    if (u.includes("/rest/v1/staff")) return new Response(JSON.stringify(staff ? [{ email: "pat@example.com", role: "office" }] : []), { status: 200 });
    if (u.includes("rpc/portal_account")) return acctOk ? new Response(JSON.stringify({ client: { id: "11111111-1111-4111-8111-111111111111", name: "Oak Grove HOA", phone: "407" }, me: { name: "Pat Lee" } }), { status: 200 }) : new Response("{}", { status: 400 });
    if (u.includes("/rest/v1/leads")) return new Response("", { status: 201 });
    if (u.includes("/rest/v1/clients")) return new Response(null, { status: 204 });
    if (u.includes("api.resend.com")) return new Response("{}", { status: 200 });
    return new Response("{}", { status: 404 });
  };
  const post = (path, b, auth) => worker.fetch(new Request("https://x.test" + path, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer usertoken" } : {}) }, body: JSON.stringify(b) }), envP);
  // known email: code is made and emailed to that person, from our domain, with the code in the subject
  calls = []; r = await post("/api/portal/code", { email: "Jane@Example.com", lang: "en" });
  assert.equal(r.status, 200);
  let mail = calls.find((c) => c.u.includes("api.resend.com"));
  assert(mail, "code emailed"); assert.deepEqual(mail.body.to, ["jane@example.com"]); assert(mail.body.subject.includes("482913"));
  assert.equal(mail.body.from, "Latta Corp of Central Florida <website@lattacorpfl.com>"); assert(mail.body.html.includes("portal/?th=abc123"));
  assert.equal(mail.body.reply_to, "Support@LattaCorpFL.com"); assert(mail.body.html.includes("automated message")); assert(mail.body.text.includes("482913"));
  assert.equal(mail.body.headers["Auto-Submitted"], "auto-generated");
  assert(calls.find((c) => c.u.includes("/rest/v1/portal_signins") && c.body && c.body.sent === true), "logged");
  // unknown email: same answer, but nothing is created or sent
  calls = []; allowed = false; r = await post("/api/portal/code", { email: "stranger@example.com" });
  assert.equal(r.status, 200); assert(!calls.some((c) => c.u.includes("generate_link") || c.u.includes("resend")), "nothing sent to strangers");
  // too soon after the last code: no new email
  allowed = true; recent = [{ created_at: new Date().toISOString() }]; calls = []; r = await post("/api/portal/code", { email: "jane@example.com" });
  assert.equal(r.status, 200); assert(!calls.some((c) => c.u.includes("resend")), "rate limited"); recent = [];
  r = await post("/api/portal/code", { email: "not-an-email" }); assert.equal(r.status, 400);
  // portal request: only for an account the signed-in person can see; saved to Leads linked to the client
  calls = []; r = await post("/api/portal/request", { client_id: "11111111-1111-4111-8111-111111111111", kind: "quote", details: "Mulch the front beds", address: "9 Palm Dr" }, true);
  assert.equal(r.status, 200);
  const lead = calls.find((c) => c.u.includes("/rest/v1/leads")); assert.equal(lead.body.client_id, "11111111-1111-4111-8111-111111111111"); assert.equal(lead.body.kind, "Quote request");
  mail = calls.find((c) => c.u.includes("api.resend.com")); assert.equal(mail.body.subject, "Quote – Pat Lee – 9 Palm Dr · Portal"); assert.equal(mail.body.reply_to, "pat@example.com");
  const asUser = calls.find((c) => c.u.includes("rpc/portal_account")); assert.equal(asUser.headers.Authorization, "Bearer usertoken", "asked as the client, not with the secret key");
  acctOk = false; r = await post("/api/portal/request", { client_id: "11111111-1111-4111-8111-111111111111", kind: "service", details: "x" }, true); assert.equal(r.status, 403); acctOk = true;
  // invite: staff only
  calls = []; r = await post("/api/portal/invite", { client_id: "11111111-1111-4111-8111-111111111111", email: "jane@example.com", name: "Jane Doe" }, true);
  assert.equal(r.status, 200); mail = calls.find((c) => c.u.includes("api.resend.com")); assert.deepEqual(mail.body.to, ["jane@example.com"]); assert(mail.body.html.includes("Welcome, Jane")); assert(mail.body.from.includes("website@")); assert(mail.body.text.includes("Open my portal: https://lattacorpfl.com/portal/"));
  assert(calls.find((c) => c.u.includes("/rest/v1/clients?id=eq.") && c.body.portal_invited_at), "invite date saved");
  staff = false; r = await post("/api/portal/invite", { client_id: "11111111-1111-4111-8111-111111111111", email: "jane@example.com" }, true); assert.equal(r.status, 403); staff = true;
}
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


// ---- team endpoint ----
let staff = [{ email: "owner@example.com", name: "Matteo", role: "owner", user_id: null }, { email: "mom@example.com", name: "Mom", role: "owner", user_id: "u-mom" }, { email: "sis@example.com", name: "Sis", role: "office", user_id: "u-sis" }];
let tcalls = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); tcalls.push({ url, opts });
  if (url.endsWith("/auth/v1/user")) { const tk = (opts.headers.Authorization || "").replace("Bearer ", ""); const m = { "t-owner": "owner@example.com", "t-mom": "mom@example.com", "t-sis": "sis@example.com" }[tk]; return m ? new Response(JSON.stringify({ email: m })) : new Response("{}", { status: 401 }); }
  if (url.includes("/rest/v1/staff") && (opts.method || "GET") === "GET") { if (url.includes("email=ilike.")) { const e = decodeURIComponent(url.split("email=ilike.")[1]); return new Response(JSON.stringify(staff.filter((x) => x.email === e.toLowerCase()))); } return new Response(JSON.stringify(staff)); }
  if (url.includes("/rest/v1/staff") && opts.method === "POST") return new Response(null, { status: 201 });
  if (url.includes("/rest/v1/staff") && (opts.method === "PATCH" || opts.method === "DELETE")) return new Response(null, { status: 204 });
  if (url.endsWith("/auth/v1/admin/users") && opts.method === "POST") { const b = JSON.parse(opts.body); return b.email === "dup@example.com" ? new Response(JSON.stringify({ msg: "already registered" }), { status: 422 }) : new Response(JSON.stringify({ id: "u-new", email: b.email })); }
  if (url.includes("/auth/v1/admin/users/")) return new Response("{}", { status: 200 });
  return new Response("{}", { status: 200 });
};
const tm = (body, token = "t-owner", method = "POST") => new Request("https://x.test/api/team", { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: method === "POST" ? JSON.stringify(body) : undefined });
r = await worker.fetch(tm({ action: "list" }, null), env); assert.equal(r.status, 403, "no token");
r = await worker.fetch(tm({ action: "list" }, "t-sis"), env); assert.equal(r.status, 403, "office staff cannot manage the team");
r = await worker.fetch(tm({}, "t-owner", "GET"), env); assert.equal(r.status, 405);
r = await worker.fetch(tm({ action: "list" }, "t-mom"), env); assert.equal(r.status, 200); let lj = await r.json(); assert.equal(lj.members.length, 3); assert.equal(lj.me, "mom@example.com"); assert.equal(lj.members[2].hasLogin, true); assert(!JSON.stringify(lj).includes("u-sis"), "user ids not leaked");
r = await worker.fetch(tm({ action: "create", name: "New", email: "new@example.com", role: "boss", password: "longenough1" }), env); assert.equal(r.status, 400, "bad role");
r = await worker.fetch(tm({ action: "create", name: "New", email: "new@example.com", role: "office", password: "short" }), env); assert.equal(r.status, 400, "short password");
r = await worker.fetch(tm({ action: "create", name: "", email: "new@example.com", role: "office", password: "longenough1" }), env); assert.equal(r.status, 400, "needs a name");
r = await worker.fetch(tm({ action: "create", name: "Sis2", email: "SIS@example.com", role: "office", password: "longenough1" }), env); assert.equal(r.status, 409, "already on team");
r = await worker.fetch(tm({ action: "create", name: "Dup", email: "dup@example.com", role: "office", password: "longenough1" }), env); assert.equal(r.status, 400, "auth refuses");
tcalls = []; r = await worker.fetch(tm({ action: "create", name: "Aunt", email: "Aunt@Example.com", role: "office", password: "longenough1" }), env); assert.equal(r.status, 200);
const ins = tcalls.find((c) => c.url.includes("/rest/v1/staff") && c.opts.method === "POST"); assert.deepEqual(JSON.parse(ins.opts.body), { email: "aunt@example.com", name: "Aunt", role: "office", user_id: "u-new" });
assert.equal(JSON.parse(tcalls.find((c) => c.url.endsWith("/auth/v1/admin/users")).opts.body).email_confirm, true);
r = await worker.fetch(tm({ action: "role", email: "owner@example.com", role: "office" }), env); assert.equal(r.status, 400, "cannot demote self");
r = await worker.fetch(tm({ action: "role", email: "sis@example.com", role: "owner" }), env); assert.equal(r.status, 200);
r = await worker.fetch(tm({ action: "role", email: "nobody@example.com", role: "owner" }), env); assert.equal(r.status, 404);
r = await worker.fetch(tm({ action: "reset", email: "owner@example.com", password: "newpassword9" }), env); assert.equal(r.status, 400, "no login id on the founding owner");
r = await worker.fetch(tm({ action: "reset", email: "sis@example.com", password: "newpassword9" }), env); assert.equal(r.status, 200);
r = await worker.fetch(tm({ action: "remove", email: "owner@example.com" }), env); assert.equal(r.status, 400, "cannot remove self");
tcalls = []; r = await worker.fetch(tm({ action: "remove", email: "sis@example.com" }), env); assert.equal(r.status, 200);
assert(tcalls.some((c) => c.opts.method === "DELETE" && c.url.includes("/auth/v1/admin/users/u-sis")), "auth user deleted"); assert(tcalls.some((c) => c.opts.method === "DELETE" && c.url.includes("/rest/v1/staff?email=eq.sis%40example.com")), "staff row deleted");
// crew logins now require an owner, not just anyone on staff
calls = []; globalThis.fetch = async (url, opts = {}) => { url = String(url); if (url.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ email: "sis@example.com" })); if (url.includes("/rest/v1/staff")) return new Response(JSON.stringify([{ email: "sis@example.com", role: "office" }])); return new Response("{}", { status: 200 }); };
r = await worker.fetch(cl({ action: "create", crew_id: CID, email: "z@y.co", password: "longenough1" }, "any"), env); assert.equal(r.status, 403, "office staff cannot create crew logins");
console.log("all worker checks passed");

// ---- quote approved email ----
{
  let qcalls = [], claimed = false, mailOk = true;
  globalThis.fetch = async (url, opts = {}) => {
    url = String(url); qcalls.push({ url, opts });
    if (url.includes("/rest/v1/estimates?share_token=")) {
      if (claimed) return new Response("[]");
      claimed = true;
      return new Response(JSON.stringify([{ id: "e1", client_id: "c1", number: 4, doc_type: "quote", title: "Shrub <Removal>", total: 167.74, status: "accepted", response_name: "Don <b>Asher</b>", response_po: "HOA-7", deposit: { mode: "pct", pct: 50 }, responded_at: "2026-11-11T10:20:00Z" }]));
    }
    if (url.includes("/rest/v1/clients?id=eq.c1")) return new Response(JSON.stringify([{ name: "Shingle Creek", company: "" }]));
    if (url.includes("api.resend.com")) return new Response("{}", { status: mailOk ? 200 : 500 });
    return new Response("[]");
  };
  const qa = (t) => new Request("https://x.test/api/quote-approved", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t }) });
  let r = await worker.fetch(qa("short"), env); assert.equal(r.status, 400, "bad token");
  const T = "a".repeat(64);
  r = await worker.fetch(qa(T), env); assert.equal(r.status, 200); assert.equal((await r.json()).sent, true);
  const m = qcalls.find((c) => c.url.includes("api.resend.com")), mb = JSON.parse(m.opts.body);
  assert.equal(mb.to[0], "owner@example.com"); assert.equal(mb.subject, "Quote approved: Shingle Creek · QTE-0004 · $167.74");
  assert(mb.html.includes("Don &lt;b&gt;Asher&lt;/b&gt;") && mb.html.includes("$83.87") && mb.html.includes("HOA-7"), "email content");
  qcalls = []; r = await worker.fetch(qa(T), env); assert.equal((await r.json()).sent, false, "only once");
  assert(!qcalls.some((c) => c.url.includes("api.resend.com")), "no second email");
  r = await worker.fetch(new Request("https://x.test/api/quote-approved", { method: "GET" }), env); assert.equal(r.status, 405);
  console.log("quote approved checks passed");
}

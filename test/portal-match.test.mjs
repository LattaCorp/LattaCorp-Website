import assert from "node:assert/strict";
import { matchEmail, sameInbox, editDistance } from "../src/portal-match.js";
const onFile = ["cowanmollya@gmail.com", "Jane.Doe@Example.com ", "jsmith@gmail.com", "jsmith1@gmail.com", "bo@aol.com", "pat.lee@outlook.com"];
const m = (e) => { const r = matchEmail(e, onFile); return r && r.email; };
// exact, ignoring capitals and spaces
assert.equal(m(" JANE.DOE@example.com"), "jane.doe@example.com");
// Gmail: dots and +tags don't matter
assert.equal(m("cowan.mollya@gmail.com"), "cowanmollya@gmail.com");
assert.equal(m("cowanmollya+portal@gmail.com"), "cowanmollya@gmail.com");
assert.equal(m("cowan.mollya@googlemail.com"), "cowanmollya@gmail.com");
// dots DO matter outside Gmail, but one extra dot is still a small typo
assert.equal(m("patlee@outlook.com"), "pat.lee@outlook.com");
// small typos
assert.equal(m("cowanmollya@gmial.com"), "cowanmollya@gmail.com");
assert.equal(m("cowanmolly@gmail.com"), "cowanmollya@gmail.com");
assert.equal(m("cowanmollya@gmail.co"), "cowanmollya@gmail.com");
// two emails on file that close: never guess
assert.equal(m("jsmith2@gmail.com"), null);
// exact still wins when a near one exists
assert.equal(m("jsmith@gmail.com"), "jsmith@gmail.com");
// too different, or too short to guess safely
assert.equal(m("someone.else@gmail.com"), null);
assert.equal(m("bo@aol.co"), "bo@aol.com");
assert.equal(m("b@aol.com"), "bo@aol.com");
assert.equal(m("x@aol.com"), null);
assert.equal(m("mollycowan@gmail.com"), null);
assert.equal(sameInbox("A.B+x@GMAIL.com"), "ab@gmail.com");
assert.equal(editDistance("gmial", "gmail"), 1);
console.log("portal-match ok");

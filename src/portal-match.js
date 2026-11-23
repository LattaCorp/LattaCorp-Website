// Client Portal sign-in: finds the email on file that the person meant, even if they typed it a little differently.
// The sign-in code is always sent to the email ON FILE, never to what was typed, so a near-miss can't let a
// stranger into someone else's account: the worst case is the real client gets a code they didn't ask for.
//
//   1. Exact (ignoring capitals and spaces).
//   2. Same inbox: Gmail ignores dots and anything after "+", so cowan.mollya@gmail.com = cowanmollya@gmail.com.
//   3. Small typo: 1 character off (2 for longer emails), like "gmial.com" or a swapped letter,
//      but only when exactly ONE email on file is that close. If two are, nothing is sent (we never guess).

const GMAIL = new Set(["gmail.com", "googlemail.com"]);

export function cleanEmail(e) { return String(e || "").trim().toLowerCase(); }

// The "same inbox" form of an email.
export function sameInbox(e) {
  const s = cleanEmail(e), at = s.lastIndexOf("@");
  if (at < 1) return s;
  let local = s.slice(0, at), domain = s.slice(at + 1);
  if (GMAIL.has(domain)) { local = local.split("+")[0].replace(/\./g, ""); domain = "gmail.com"; }
  return local + "@" + domain;
}

// Number of single-letter changes (add, remove, replace, or swap two neighbors) between two strings.
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}

// typed: what the person entered. onFile: every email allowed into the portal.
// Returns { email, how } (email = the one on file to send to) or null if nothing matches.
export function matchEmail(typed, onFile) {
  const t = cleanEmail(typed);
  const list = [...new Set((onFile || []).map(cleanEmail).filter((e) => e.includes("@")))];
  if (list.includes(t)) return { email: t, how: "exact" };

  const ti = sameInbox(t);
  const inbox = [...new Set(list.filter((e) => sameInbox(e) === ti))];
  if (inbox.length === 1) return { email: inbox[0], how: "same-inbox" };
  if (inbox.length > 1) return null;

  const allowed = ti.length >= 14 ? 2 : ti.length >= 6 ? 1 : 0;
  if (!allowed) return null;
  const close = list.filter((e) => editDistance(ti, sameInbox(e)) <= allowed);
  return close.length === 1 ? { email: close[0], how: "typo" } : null;
}

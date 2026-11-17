// Zelle: reads a Bank of America "you received money with Zelle" email (forwarded by a Gmail filter to the
// website's Zelle address) and pulls out the amount, who sent it and their memo. The matching to invoices lives in
// worker.js (it needs the database). Everything here is plain text work, so it is easy to test.

// ---------- a small email (MIME) reader ----------
function splitHead(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m) return { head: raw, body: "" };
  return { head: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}
// headers in order (top = newest), folded lines joined
export function parseHeaders(head) {
  const out = [];
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) out.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
  }
  return out;
}
const hget = (hs, name) => (hs.find((h) => h[0] === name) || [])[1] || "";
function param(v, name) {
  const m = String(v).match(new RegExp(name + '\\s*=\\s*("([^"]*)"|[^;\\s]+)', "i"));
  return m ? (m[2] != null ? m[2] : m[1]) : "";
}
function bytesToText(bytes, charset) {
  try { return new TextDecoder(/^(utf-?8|us-ascii|)$/i.test(charset || "") ? "utf-8" : charset).decode(bytes); }
  catch { return new TextDecoder("utf-8").decode(bytes); }
}
function decodeQP(s, charset) {
  s = s.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
    else { const c = s.charCodeAt(i); if (c < 128) bytes.push(c); else for (const b of new TextEncoder().encode(s[i])) bytes.push(b); }
  }
  return bytesToText(new Uint8Array(bytes), charset);
}
function decodeB64(s, charset) {
  try {
    const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ""));
    return bytesToText(Uint8Array.from(bin, (c) => c.charCodeAt(0)), charset);
  } catch { return ""; }
}
// =?UTF-8?Q?...?= and =?UTF-8?B?...?= in subjects and names
export function decodeWords(s) {
  return String(s || "").replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=\s*/gi, (_, cs, enc, txt) =>
    enc.toUpperCase() === "B" ? decodeB64(txt, cs) : decodeQP(txt.replace(/_/g, " "), cs));
}
export function htmlToText(h) {
  return String(h)
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h\d|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&reg;|&#174;/gi, "®").replace(/&#36;/g, "$")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// walks the parts; returns { text, html } of the first plain-text and HTML parts
function walk(head, body, acc) {
  const hs = parseHeaders(head);
  const ct = hget(hs, "content-type") || "text/plain";
  const te = hget(hs, "content-transfer-encoding").toLowerCase();
  const cs = param(ct, "charset");
  if (/^multipart\//i.test(ct)) {
    const b = param(ct, "boundary");
    if (!b) return;
    for (const part of body.split("--" + b).slice(1)) {
      if (/^--/.test(part)) break;
      const p = splitHead(part.replace(/^\r?\n/, ""));
      walk(p.head, p.body, acc);
    }
    return;
  }
  if (/^message\/rfc822/i.test(ct)) { const p = splitHead(body); walk(p.head, p.body, acc); return; }
  const dec = te === "quoted-printable" ? decodeQP(body, cs) : te === "base64" ? decodeB64(body, cs) : body;
  if (/^text\/html/i.test(ct) && acc.html == null) acc.html = dec;
  else if (/^text\/plain/i.test(ct) && acc.text == null) acc.text = dec;
}
export function readEmail(raw) {
  const { head, body } = splitHead(String(raw || ""));
  const headers = parseHeaders(head);
  const acc = {};
  walk(head, body, acc);
  const text = (acc.text && acc.text.trim()) ? acc.text.replace(/\r/g, "").trim() : acc.html ? htmlToText(acc.html) : "";
  return {
    headers,
    from: decodeWords(hget(headers, "from")),
    subject: decodeWords(hget(headers, "subject")),
    messageId: hget(headers, "message-id").replace(/[<>]/g, ""),
    text,
  };
}

// ---------- did this really come from Bank of America? ----------
// Cloudflare checks each incoming email's DKIM signature and writes the result at the top of the email.
// We only trust the newest (topmost) result written by Cloudflare, never ones further down that anyone could fake.
const BANK_DOMAINS = /(^|\.)bankofamerica\.com$/i;
export function fromBank(mail) {
  const addr = (mail.from.match(/<([^>]+)>/) || [, mail.from])[1].trim().toLowerCase();
  const dom = addr.split("@")[1] || "";
  if (!BANK_DOMAINS.test(dom)) return false;
  const auth = mail.headers.find((h) => (h[0] === "authentication-results" || h[0] === "arc-authentication-results") && /cloudflare/i.test(h[1]));
  if (!auth) return false;
  return /dkim=pass[^;]*header\.(d|i)=@?([a-z0-9.-]*\.)?bankofamerica\.com/i.test(auth[1]);
}

// ---------- what the alert says ----------
const MONEY = /\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/;
const num = (s) => Number(String(s).replace(/,/g, ""));
const clean = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s:,-]+|[\s.,:-]+$/g, "").trim();
export function looksLikeZelle(mail) {
  const t = (mail.subject + "\n" + mail.text).toLowerCase();
  if (/\b(you sent|you've sent|you have sent|your payment to|payment request|you requested|sent to [a-z])/i.test(t)) return false; // money going out, or requests
  return /zelle/.test(t) && /(received|sent you|deposited|has been sent to you)/.test(t) && MONEY.test(t);
}
export function readZelle(mail) {
  const s = mail.subject, t = mail.text.replace(/®/g, "");
  const all = s + "\n" + t;
  let amount = null, sender = "", memo = "";
  // amount: next to "received" / "sent you", else the first dollar figure
  const am = all.match(new RegExp("(?:received|sent you|deposited)[^$\\n]{0,40}" + MONEY.source, "i")) || all.match(MONEY);
  if (am) amount = num(am[1]);
  // who sent it
  const pats = [
    /received\s+\$[0-9,.]+\s+from\s+([^\n]+?)(?:\s+(?:on|via|with|through)\b|[.!]|$)/im,
    /^\s*([^\n$]{2,60}?)\s+sent you\s+\$/im,
    /^\s*(?:sender|from|sent by)\s*[:\-]?\s*\n?\s*([^\n]{2,60})$/im,
    /money from\s+([^\n]+?)(?:\s+(?:on|via|with)\b|[.!]|$)/im,
  ];
  for (const p of pats) {
    const m = s.match(p) || t.match(p);
    if (m && !/@|bank of america|zelle/i.test(m[1])) { sender = clean(m[1]); break; }
  }
  // the memo / message they typed
  const mm = t.match(/^\s*(?:memo|message|note|what it'?s for|for)\s*[:\-]?\s*\n?\s*([^\n]{1,200})$/im);
  if (mm && !/^(none|n\/a|-+)$/i.test(clean(mm[1]))) memo = clean(mm[1]).replace(/^["“']|["”']$/g, "");
  return { amount: amount && amount > 0 ? Math.round(amount * 100) / 100 : null, sender, memo };
}

// ---------- matching helpers ----------
// invoice numbers the client may have typed: "LC-0317", "#317", "invoice 317", or a bare number
export function invoiceNumbers(memo) {
  const labeled = new Set(), bare = new Set();
  const m1 = String(memo || "").matchAll(/(?:lc\s*-?\s*|#\s*|inv(?:oice)?\.?\s*(?:no\.?|num(?:ber)?|#)?\s*)0*(\d{1,6})\b/gi);
  for (const m of m1) labeled.add(Number(m[1]));
  for (const m of String(memo || "").matchAll(/\b0*(\d{2,6})\b/g)) if (!labeled.has(Number(m[1]))) bare.add(Number(m[1]));
  return { labeled: [...labeled], bare: [...bare] };
}
const STOP = new Set(["the", "and", "of", "llc", "inc", "co", "corp", "hoa", "association", "assoc", "mr", "mrs", "ms", "jr", "sr", "ii", "iii"]);
export function nameTokens(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}
// 2 = the same person/company (2+ name words in common, or the whole sender name), 1 = likely family (last name), 0 = no
export function nameScore(sender, name) {
  const a = nameTokens(sender), b = new Set(nameTokens(name));
  if (!a.length || !b.size) return 0;
  const hits = a.filter((w) => b.has(w)).length;
  if (hits >= 2 || (hits === a.length && hits >= 1 && b.size === 1)) return 2;
  if (hits === 1 && a.length === 1) return 2;
  const last = a[a.length - 1];
  return hits >= 1 && b.has(last) ? 1 : 0;
}

// Web Push for Foreman: phone notifications without any outside service.
// Encryption follows RFC 8291 (aes128gcm) and the sender signs each request with a VAPID key (RFC 8292).
// Everything uses the built-in Web Crypto, so it runs on Cloudflare Workers and in Node for tests.

const te = new TextEncoder();
export const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const unb64u = (s) => {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const cat = (...parts) => {
  const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// A VAPID key pair as { publicKey: base64url of the 65-byte point, privateKey: base64url of the 32-byte scalar }.
export async function makeVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { publicKey: b64u(pub), privateKey: jwk.d };
}
function jwkFrom(pubB64u, dB64u) {
  const p = unb64u(pubB64u);
  return { kty: "EC", crv: "P-256", x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: dB64u, ext: true };
}

// The signed "who is sending" header for one push service (aud = the push service's origin).
export async function vapidAuth(endpoint, keys, subject, now = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", jwkFrom(keys.publicKey, keys.privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(head + "." + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Encrypts one message for one phone (RFC 8291). `fixed` is only for the RFC test vector.
export async function encryptPush(plain, p256dhB64u, authB64u, fixed) {
  const uaPub = unb64u(p256dhB64u), auth = unb64u(authB64u);
  let asPriv, asPub;
  if (fixed) {
    asPub = unb64u(fixed.asPublic);
    asPriv = await crypto.subtle.importKey("jwk", jwkFrom(fixed.asPublic, fixed.asPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPriv = kp.privateKey;
    asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const prkKey = await hmac(auth, ecdh);
  const ikm = await hmac(prkKey, cat(te.encode("WebPush: info\0"), uaPub, asPub, new Uint8Array([1])));
  const salt = fixed ? unb64u(fixed.salt) : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = typeof plain === "string" ? te.encode(plain) : plain;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(data, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// Sends one notification. Returns the push service's status (201 = delivered; 404/410 = that phone unsubscribed).
export async function sendPush(sub, message, keys, subject) {
  const body = await encryptPush(JSON.stringify(message), sub.p256dh, sub.auth);
  try {
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuth(sub.endpoint, keys, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body,
    });
    return res.status;
  } catch {
    return 0;
  }
}

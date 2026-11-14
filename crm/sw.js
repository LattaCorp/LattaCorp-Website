// Minimal service worker: caches the app shell so the CRM opens instantly.
// Never caches Supabase/API calls, so lead data is always live.
const V = "lc-crm-v227";
const SHELL = ["./", "config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;           // leave Supabase/CDN alone
  e.respondWith(fetch(r,{cache:"no-store"}).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r).then(m => m || caches.match("./"))));
});
// Phone notifications from Foreman (new leads, approved quotes, receipts...). Tapping one opens that tab.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Foreman", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Foreman", {
    body: d.body || "", icon: "icon-192.png", badge: "badge-96.png", tag: d.tag || undefined, vibrate: [80, 40, 80], data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  const go = new URL(url).searchParams.get("go");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) { c.postMessage({ go }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

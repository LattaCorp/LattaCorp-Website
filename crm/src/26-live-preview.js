/* Live preview for the New invoice and New estimate forms: the panel splits in two, with the form on the left and
   the exact page the client will get (d/index.html in preview mode) on the right, redrawn as you type. On narrow
   screens the preview sits under the form. */
var lpFrame = null,
  lpReady = false,
  lpLast = null;
window.addEventListener("message", function (e) {
  if (!lpFrame || e.source !== lpFrame.contentWindow || !e.data) return;
  if (e.data.type === "lc-doc-ready") {
    lpReady = true;
    if (lpLast) lpSend(lpLast);
  } else if (e.data.type === "lc-doc-h") {
    lpFrame._h = e.data.h;
    lpFit();
  }
});
function lpSend(d) {
  lpLast = d;
  if (lpFrame && lpReady) lpFrame.contentWindow.postMessage({ type: "lc-doc", data: d }, location.origin);
}
function lpFit() {
  if (!lpFrame) return;
  var wrap = lpFrame.parentNode,
    h = lpFrame._h || 1100,
    s;
  if (window.innerWidth > 1000) {
    // the window fits the screen: the whole page preview is scaled to fit its box, centered
    var ww = wrap.clientWidth || 520,
      wh = wrap.clientHeight || 700;
    s = Math.min(1, ww / 860, wh / h);
    wrap.style.height = "";
    lpFrame.style.marginLeft = Math.max(0, Math.round((ww - 860 * s) / 2)) + "px";
    lpFrame.style.marginTop = Math.max(0, Math.round((wh - h * s) / 2)) + "px";
  } else {
    s = Math.min(1, (wrap.clientWidth || 520) / 860);
    wrap.style.height = Math.ceil(h * s) + "px";
    lpFrame.style.marginLeft = lpFrame.style.marginTop = "";
  }
  lpFrame.style.transform = "scale(" + s + ")";
  lpFrame.style.height = h + "px";
}
window.addEventListener("resize", lpFit);

/* Turns the open panel into form + preview. Returns a function to call with the draft document. */
function livePreview(p) {
  p.classList.add("withprev");
  var form = el("div", "pform"),
    side = el("div", "pprev");
  [].slice.call(p.childNodes).forEach(function (n) {
    if (!(n.classList && n.classList.contains("close"))) form.appendChild(n);
  });
  p.appendChild(form);
  p.appendChild(side);
  side.appendChild(el("div", "pphd", "Live preview · what the client will see"));
  var wrap = el("div", "ppwrap"),
    f = document.createElement("iframe");
  f.title = "Live preview";
  f.src = "/d/?preview=1&embed=1&lang=en";
  wrap.appendChild(f);
  side.appendChild(wrap);
  lpFrame = f;
  lpReady = false;
  lpLast = null;
  setTimeout(lpFit, 0);
  return lpSend;
}
function lpBusiness() {
  return {
    name: bizv("name", "LattaCorp of Central Florida"),
    phone: bizv("phone", ""),
    email: bizv("email", ""),
    address: bizv("address", ""),
    zelle: bizv("zelle", ""),
    payment_note: bizv("payment_note", ""),
    footer: bizv("footer", "")
  };
}
function lpClient(c) {
  return c
    ? { name: c.name, company: c.company || "", account_no: c.account_no || null, phone: c.phone || "", email: c.email || "" }
    : { name: "" };
}
function lpMainAddress(cid) {
  var ps = clientProps(cid);
  var m =
    ps.filter(function (x) {
      return x.label === "Main" && x.address;
    })[0] ||
    ps.filter(function (x) {
      return x.address;
    })[0];
  return m ? m.address : "";
}
function lpNextNumber(list) {
  var n = 0;
  list.forEach(function (x) {
    if (Number(x.number) > n) n = Number(x.number);
  });
  return n + 1;
}
/* The Invoice Summary for a draft, worked out the same way as the invoice page (Stage 26). */
function lpSummary(c, pid, total, dueDate) {
  var byProp = !!(c && c.bill_by_property && pid),
    prev = 0,
    late = 0,
    t0 = today();
  if (c)
    invoices.forEach(function (i) {
      if (i.client_id !== c.id || i.status !== "open") return;
      if (byProp && i.property_id !== pid) return;
      var b = balOf(i);
      prev += b;
      if (b > 0 && i.due_date && i.due_date < t0) late += b;
    });
  var credit = c && !byProp ? creditOf(c.id) : 0;
  prev = r2(prev);
  return {
    previous: prev,
    previous_past_due: r2(late),
    this_total: total,
    this_paid: 0,
    this_balance: total,
    credit: credit,
    by_property: byProp,
    today: t0,
    total_due: Math.max(0, r2(prev + total - credit))
  };
}

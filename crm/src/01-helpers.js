/* Small tools used everywhere: building buttons and form fields, dates, money formatting, phone numbers. */

var $ = function (id) {
  return document.getElementById(id);
};
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(text, cls, fn) {
  var b = el("button", cls || "btn", text);
  b.type = "button";
  if (fn) b.addEventListener("click", fn);
  return b;
}
function ago(iso) {
  var s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  if (s < 604800) return Math.floor(s / 86400) + " days ago";
  return new Date(iso).toLocaleDateString();
}
function label(s) {
  var f = STATUSES.filter(function (x) {
    return x[0] === s;
  })[0];
  return f ? f[1] : s;
}
function tlabel(t) {
  var f = TYPES.filter(function (x) {
    return x[0] === t;
  })[0];
  return f ? f[1] : t;
}
function digits(p) {
  return (p || "").replace(/[^\d+]/g, "");
}
function d10(p) {
  return (p || "").replace(/\D/g, "").slice(-10);
}
function byId(arr, id) {
  return arr.filter(function (x) {
    return x.id === id;
  })[0];
}
function fld(text, type, val, opts) {
  var w = el("label", "f");
  w.appendChild(el("span", null, text));
  var i;
  if (type === "select") {
    i = document.createElement("select");
    opts.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o[0];
      op.textContent = o[1];
      i.appendChild(op);
    });
  } else if (type === "textarea") {
    i = document.createElement("textarea");
    i.style.minHeight = "70px";
  } else {
    i = document.createElement("input");
    i.type = type;
  }
  i.value = val || "";
  w.appendChild(i);
  w.input = i;
  return w;
}
function mapsUrl(a) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(a);
}
function contactRow(phone, email) {
  var c = el("div", "contact"),
    dg = digits(phone);
  if (email) {
    var m = el("a", "btn alt", "Email");
    m.href = "mailto:" + email;
    c.appendChild(m);
  }
  if (dg) {
    (isOwner() ? ["Call", "Text"] : ["Call"]).forEach(function (t) {
      var a = el("a", "btn alt", t);
      a.href = (t === "Call" ? "tel:" : "sms:") + dg;
      c.appendChild(a);
    });
  }
  return c;
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}
function ymd(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function pd(s) {
  var a = s.split("-");
  return new Date(+a[0], +a[1] - 1, +a[2], 12);
}
function addDays(s, n) {
  var d = pd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function today() {
  return ymd(new Date());
}
function dlabel(s) {
  var t = today();
  if (s === t) return "Today";
  if (s === addDays(t, 1)) return "Tomorrow";
  return pd(s).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function dshort(s) {
  return pd(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function money(n) {
  return (
    "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function r2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

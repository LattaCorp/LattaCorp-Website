/* Foreman CRM. GENERATED FILE: do not edit here. Edit the section files in crm/src/,
   then run: node tools/build_crm.mjs */
(function () {
"use strict";

/* ======================= crm/src/00-state.js ======================= */
/* Settings and shared data: the database connection, drop-down lists, and the variables every screen reads (lists of clients, jobs, invoices, filters...). */

var cfg = window.CRM_CONFIG,
  sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
var STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["quoted", "Quoted"],
  ["won", "Won"],
  ["lost", "Lost"]
];
var TYPES = [
  ["residential", "Residential"],
  ["hoa", "HOA"],
  ["commercial", "Commercial"]
];
var leads = [],
  clients = [],
  props = [],
  clientsErr = false,
  services = [],
  jobs = [],
  visits = [],
  jobsErr = false;
var photos = [],
  photoErr = false,
  pf = { client: "all", kind: "all", when: "all" },
  psel = null,
  pshown = 60;
var expenses = [],
  expErr = false,
  rtab = "overview",
  rper = "month",
  rfrom = "",
  rto = "",
  exCat = "all",
  exYear = String(new Date().getFullYear()),
  exq = "",
  exShown = 300,
  exCol = 1,
  exDir = -1,
  exF = {},
  taxYear = String(new Date().getFullYear()),
  taxMaking = false;
var todos = [],
  todoErr = false,
  tfilter = "open",
  team = [];
var role = "owner",
  myEmail = "";
function isOwner() {
  return role === "owner";
}
var view = "leads",
  lfilter = "all",
  cfilter = "active",
  jfilter = "active",
  smode = "day",
  selDate = today(),
  crewF = "all",
  query = "";
var estimates = [],
  estErr = false;
var ccontacts = [],
  ccErr = false;
var CROLES = [
  "Spouse",
  "Partner",
  "Board member",
  "HOA president",
  "Property manager",
  "Tenant",
  "Family member",
  "Office / billing"
];
var teamSyncAt = 0,
  teamSyncing = false,
  invPays = [],
  payErr = false;
var people = [],
  payRows = [],
  benRows = [],
  docRows = [],
  persErr = false,
  pfilter = "all";
var invCats = [],
  invItems = [],
  invErr = false,
  invCat = null,
  invq = "",
  invSort = null,
  invFocus = null;
var invoices = [],
  biz = null,
  billErr = false,
  unbilled = [],
  bfilter = "tobill",
  billThrough = lastMonthEnd();
var crew = [],
  s3 = false,
  histFrom = addDays(today(), -45),
  crewMe = null,
  cwDate = today();

/* ======================= crm/src/01-helpers.js ======================= */
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

/* ======================= crm/src/02-signin-and-loading.js ======================= */
/* Signing in and out, and loading all the data from Supabase when the CRM opens or Refresh is pressed. */

/* ---- sign in / out ---- */
$("login").addEventListener("submit", function (e) {
  e.preventDefault();
  $("loginmsg").textContent = "";
  sb.auth.signInWithPassword({ email: $("em").value.trim(), password: $("pw").value }).then(function (r) {
    if (r.error) {
      $("loginmsg").textContent = "That email or password didn't work.";
      return;
    }
    afterSignIn();
  });
});
$("signout").addEventListener("click", function () {
  sb.auth.signOut().then(function () {
    location.reload();
  });
});
$("refresh").addEventListener("click", function () {
  if (crewMe) renderCrewApp();
  else load();
});
function start() {
  $("gsearch").hidden = false;
  $("loginwrap").hidden = true;
  $("layout").hidden = false;
  $("signout").hidden = false;
  $("refresh").hidden = false;
  load();
}
sb.auth.getSession().then(function (r) {
  if (r.data && r.data.session) afterSignIn();
});
/* Crew logins see only their own route; the owner sees everything. */
function afterSignIn() {
  var done = false;
  function go(me) {
    if (done) return;
    done = true;
    if (me) {
      startCrewApp(me);
      return;
    }
    sb.auth
      .getSession()
      .then(function (s) {
        myEmail = (
          (s.data && s.data.session && s.data.session.user && s.data.session.user.email) ||
          ""
        ).toLowerCase();
      })
      .catch(function () {})
      .then(function () {
        return sb.rpc("staff_role");
      })
      .then(
        function (r) {
          role = r && !r.error ? r.data || "office" : "owner";
          start();
        },
        function () {
          role = "owner";
          start();
        }
      );
  }
  try {
    sb.rpc("crew_me").then(
      function (r) {
        go(r && !r.error && r.data && r.data.length ? r.data[0] : null);
      },
      function () {
        go(null);
      }
    );
  } catch (e) {
    go(null);
  }
}

/* ---- data ---- */
function fetchAll(table, col) {
  var out = [],
    from = 0;
  function page() {
    return sb
      .from(table)
      .select("*")
      .order(col, { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999)
      .then(function (r) {
        if (r.error) return { data: null, error: r.error };
        out = out.concat(r.data || []);
        if ((r.data || []).length < 1000) return { data: out, error: null };
        from += 1000;
        return page();
      });
  }
  return page();
}
function load() {
  $("msg").textContent = "";
  Promise.all([
    sb.from("leads").select("*").order("created_at", { ascending: false }).limit(1000),
    sb.from("clients").select("*").order("name", { ascending: true }).limit(5000),
    sb.from("properties").select("*").order("created_at", { ascending: true }).limit(10000),
    sb.from("services").select("*").order("name", { ascending: true }).limit(500),
    sb.from("jobs").select("*").order("created_at", { ascending: true }).limit(5000),
    sb
      .from("visits")
      .select("*")
      .gte("scheduled_date", addDays(today(), -45))
      .order("scheduled_date", { ascending: true })
      .limit(5000),
    sb.from("crew").select("*").order("name", { ascending: true }).limit(200),
    sb.from("invoices").select("*").order("number", { ascending: false }).limit(3000),
    sb.from("business").select("*").eq("id", 1),
    sb.from("visits").select("*").eq("status", "done").is("invoice_id", null).is("paid_at", null).limit(5000),
    sb.from("todos").select("*").order("created_at", { ascending: false }).limit(3000),
    fetchAll("expenses", "spent_on"),
    sb.from("photos").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("estimates").select("*").order("number", { ascending: false }).limit(3000),
    sb.from("inventory_cats").select("*").order("sort", { ascending: true }).limit(500),
    sb.from("inventory_items").select("*").order("sort", { ascending: true }).limit(20000),
    sb.from("personnel").select("*").order("emp_no", { ascending: true }).limit(2000),
    sb.from("personnel_pay").select("*").order("paid_on", { ascending: false }).limit(20000),
    sb.from("personnel_benefits").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("personnel_docs").select("*").order("created_at", { ascending: false }).limit(5000),
    sb.from("invoice_payments").select("*").order("paid_on", { ascending: false }).limit(20000),
    sb.from("client_contacts").select("*").order("created_at", { ascending: true }).limit(20000)
  ]).then(function (rs) {
    ccErr = !!rs[21].error;
    ccontacts = rs[21].error ? [] : rs[21].data || [];
    payErr = !!rs[20].error;
    invPays = rs[20].error ? [] : rs[20].data || [];
    persErr = !!(rs[16].error || rs[17].error || rs[18].error || rs[19].error);
    people = rs[16].error ? [] : rs[16].data || [];
    payRows = rs[17].error ? [] : rs[17].data || [];
    benRows = rs[18].error ? [] : rs[18].data || [];
    docRows = rs[19].error ? [] : rs[19].data || [];
    if (rs[0].error) {
      $("msg").textContent =
        "Could not load leads. If you just signed in, make sure this email is on the staff list.";
      return;
    }
    leads = rs[0].data || [];
    clientsErr = !!(rs[1].error || rs[2].error);
    clients = rs[1].error ? [] : rs[1].data || [];
    sortClients();
    props = rs[2].error ? [] : rs[2].data || [];
    jobsErr = !!(rs[3].error || rs[4].error || rs[5].error || clientsErr);
    services = rs[3].error ? [] : rs[3].data || [];
    jobs = rs[4].error ? [] : rs[4].data || [];
    visits = rs[5].error ? [] : rs[5].data || [];
    histFrom = addDays(today(), -45);
    s3 = !rs[6].error;
    crew = rs[6].error ? [] : rs[6].data || [];
    billErr = !!(rs[7].error || rs[9].error || jobsErr);
    invoices = rs[7].error ? [] : rs[7].data || [];
    biz = rs[8].error ? null : (rs[8].data || [])[0] || null;
    unbilled = rs[9].error ? [] : rs[9].data || [];
    photoErr = !!rs[12].error;
    photos = rs[12].error ? [] : rs[12].data || [];
    expErr = !!rs[11].error;
    expenses = rs[11].error ? [] : rs[11].data || [];
    repData = null;
    todoErr = !!rs[10].error;
    todos = rs[10].error ? [] : rs[10].data || [];
    estErr = !!rs[13].error;
    estimates = rs[13].error ? [] : rs[13].data || [];
    invErr = !!(rs[14].error || rs[15].error);
    invCats = rs[14].error ? [] : rs[14].data || [];
    invItems = rs[15].error ? [] : rs[15].data || [];
    try {
      sb.rpc("team_names").then(
        function (r) {
          if (r && !r.error && r.data) team = r.data;
        },
        function () {}
      );
    } catch (e) {}
    render();
    topUp().then(function (n) {
      if (n) render();
    });
  });
}

/* ======================= crm/src/03-main-screen.js ======================= */
/* The side menu, switching tabs, and the pop-up side panel used for every detail screen and form. */

/* ---- main screen ---- */
var ICONS = {
  leads:
    '<svg viewBox="0 0 24 24"><path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13"/><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2.5 2.5 0 0 1-5 0z"/></svg>',
  clients:
    '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
  jobs: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
  billing: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  schedule:
    '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  expenses:
    '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg>',
  inventory:
    '<svg viewBox="0 0 24 24"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M18.5 3.5v3M17 5h3"/></svg>',
  personnel:
    '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2.3"/><path d="M5.5 17a3.8 3.8 0 0 1 7 0M14.5 9h4M14.5 13h4"/></svg>',
  todo: '<svg viewBox="0 0 24 24"><path d="M4 6.5l1.7 1.7L9 4.8"/><path d="M4 13.5l1.7 1.7L9 11.8"/><path d="M4 20.5l1.7 1.7"/><path d="M13 6h8M13 13h8M13 20h8"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  photos:
    '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>'
};
function render() {
  var nav = $("side");
  nav.textContent = "";
  $("app").classList.toggle("wide", view === "reports" || view === "inventory" || view === "expenses");
  var tdy = today(),
    stops = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date === tdy;
    }).length,
    newL = leads.filter(function (l) {
      return l.status === "new";
    }).length;
  [
    ["leads", "Leads", newL],
    ["clients", "Clients", 0],
    ["jobs", "Jobs", 0],
    ["schedule", "Schedule", stops],
    [
      "todo",
      "To-Do",
      todos.filter(function (t) {
        return !t.done && t.due_date && t.due_date <= tdy;
      }).length
    ],
    ["billing", "Billing", invoices.filter(isOverdue).length],
    ["expenses", "Expenses", 0],
    ["reports", "Reports", 0],
    ["photos", "Photos", 0],
    ["inventory", "Inventory", 0]
  ]
    .concat(
      isOwner()
        ? [
            ["personnel", "Personnel", 0],
            ["team", "Team", 0]
          ]
        : []
    )
    .forEach(function (v) {
      var b = el("button", v[0] === view ? "on" : "");
      b.type = "button";
      b.addEventListener("click", function () {
        view = v[0];
        render();
      });
      b.innerHTML = ICONS[v[0]];
      b.appendChild(el("span", null, v[1]));
      if (v[2]) b.appendChild(el("span", "badge", String(v[2])));
      b.setAttribute("aria-current", v[0] === view ? "page" : "false");
      nav.appendChild(b);
    });
  $("topbtns").textContent = "";
  if (view === "leads") renderLeads();
  else if (view === "clients") renderClients();
  else if (view === "jobs") renderJobs();
  else if (view === "billing") renderBilling();
  else if (view === "todo") renderTodo();
  else if (view === "reports") renderReports();
  else if (view === "expenses") renderExpensesView();
  else if (view === "photos") renderPhotoLib();
  else if (view === "inventory") renderInventory();
  else if (view === "personnel" && isOwner()) renderPersonnel();
  else if (view === "team" && isOwner()) renderTeam();
  else renderSchedule();
}

/* ---- panel helpers ---- */
function panel() {
  var p = $("panel");
  p.textContent = "";
  p.appendChild(btn("×", "close", closeDetail)).setAttribute("aria-label", "Close");
  $("detail").classList.add("on");
  p.scrollTop = 0;
  $("detail").scrollTop = 0;
  return p;
}
/* Forms in the side panel: Enter (or finishing a drop-down or a full MM/DD/YYYY date) jumps to the next field. */
(function () {
  var pn = document.getElementById("panel");
  if (!pn) return;
  var arrow = false;
  function fields() {
    return Array.prototype.filter.call(pn.querySelectorAll("input,select,textarea"), function (f) {
      if (
        f.disabled ||
        f.readOnly ||
        f.tabIndex < 0 ||
        f.type === "hidden" ||
        f.type === "checkbox" ||
        f.type === "radio" ||
        f.type === "file" ||
        f.type === "button" ||
        f.type === "submit"
      )
        return false;
      if (f.closest(".invgrid")) return false;
      return f.offsetParent !== null;
    });
  }
  function next(cur) {
    var l = fields(),
      i = l.indexOf(cur);
    if (i < 0 || i >= l.length - 1) return;
    var n = l[i + 1];
    n.focus();
    if (n.select && n.tagName === "INPUT" && n.type !== "date" && n.type !== "number")
      try {
        n.select();
      } catch (e) {}
  }
  pn.addEventListener("keydown", function (e) {
    arrow = e.key === "ArrowUp" || e.key === "ArrowDown";
    if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (
      !t ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "BUTTON" ||
      (t.tagName === "INPUT" && (t.type === "checkbox" || t.type === "button" || t.type === "submit"))
    )
      return;
    if (t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
    if (fields().indexOf(t) < 0) return;
    e.preventDefault();
    next(t);
  });
  pn.addEventListener("change", function (e) {
    var t = e.target;
    if (t && t.tagName === "SELECT" && !arrow && fields().indexOf(t) > -1) next(t);
  });
  pn.addEventListener("input", function (e) {
    var t = e.target;
    if (
      t &&
      t.tagName === "INPUT" &&
      t.placeholder === "MM/DD/YYYY" &&
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t.value) &&
      fields().indexOf(t) > -1
    )
      next(t);
  });
})();
function closeDetail() {
  $("detail").classList.remove("on");
}
/* Clicking the dim area outside a panel closes it, but not while a form is open (so a stray click or a drag that ends outside never loses what you typed). Use the X or Esc to close a form. */
var dnDown = null;
$("detail").addEventListener("mousedown", function (e) {
  dnDown = e.target;
});
$("detail").addEventListener("click", function (e) {
  if (e.target !== $("detail") || dnDown !== $("detail")) return;
  if ($("panel").querySelector("input:not([type=hidden]),textarea,select")) return;
  closeDetail();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    if (!$("invview").hidden) hideInvoice();
    else closeDetail();
  }
});
$("invclose").addEventListener("click", function () {
  hideInvoice();
});
$("invprint").addEventListener("click", function () {
  window.print();
});

/* ======================= crm/src/04-leads.js ======================= */
/* Leads tab: requests from the website, their status, and turning a lead into a client. */

function renderLeads() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var counts = { all: leads.length };
  STATUSES.forEach(function (s) {
    counts[s[0]] = 0;
  });
  leads.forEach(function (l) {
    counts[l.status] = (counts[l.status] || 0) + 1;
  });
  [["all", "All"]].concat(STATUSES).forEach(function (s) {
    var b = el("button", "tab" + (lfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + (counts[s[0]] || 0) + ")"));
    b.addEventListener("click", function () {
      lfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var list = $("list");
  list.textContent = "";
  var shown = leads.filter(function (l) {
    if (lfilter !== "all" && l.status !== lfilter) return false;
    if (!query) return true;
    return (
      [l.name, l.email, l.phone, l.address, l.service, l.kind, l.notes]
        .join(" ")
        .toLowerCase()
        .indexOf(query) > -1
    );
  });
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        leads.length ? "Nothing matches that." : "No leads yet. New website submissions will show up here."
      )
    );
    return;
  }
  shown.forEach(function (l) {
    var b = el("button", "row " + l.status);
    b.type = "button";
    var left = el("div");
    left.appendChild(el("b", null, l.name || "(no name)"));
    left.appendChild(el("div", "sub", [l.kind, l.service].filter(Boolean).join(" · ")));
    if (l.address) left.appendChild(el("div", "sub", l.address));
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(el("span", "chip " + l.status, label(l.status)));
    if (l.client_id) right.appendChild(el("div", "sub", "Client ✓"));
    right.appendChild(el("div", "sub", ago(l.created_at)));
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openLead(l.id);
    });
    list.appendChild(b);
  });
}

/* ---- lead detail ---- */
function openLead(id) {
  var l = byId(leads, id);
  if (!l) return;
  var p = panel();
  p.appendChild(el("h2", null, l.name || "(no name)"));
  p.appendChild(
    el(
      "div",
      "note",
      l.kind +
        " · " +
        new Date(l.created_at).toLocaleString() +
        (l.lang === "es" ? " · Spanish page" : "") +
        (l.photo_count ? " · " + l.photo_count + " photo(s) were sent by email" : "")
    )
  );
  p.appendChild(contactRow(l.phone, l.email));
  var st = el("div", "status");
  STATUSES.forEach(function (s) {
    st.appendChild(
      btn(s[1], l.status === s[0] ? "on" : "", function () {
        setStatus(l, s[0]);
      })
    );
  });
  p.appendChild(st);
  var cl = l.client_id && byId(clients, l.client_id);
  var cbox = el("div", "contact");
  if (cl) {
    cbox.appendChild(
      btn("View client: " + cl.name, "btn", function () {
        openClient(cl.id);
      })
    );
  } else {
    var cb = btn("Convert to client", "btn", function () {
      convertLead(l, cb);
    });
    cbox.appendChild(cb);
  }
  p.appendChild(cbox);
  var t = document.createElement("table");
  (Array.isArray(l.fields) ? l.fields : []).forEach(function (f) {
    if (!f || !f.value) return;
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, f.label));
    tr.appendChild(el("td", null, f.value));
    t.appendChild(tr);
  });
  p.appendChild(t);
  p.appendChild(el("label", null, "Notes"));
  var ta = document.createElement("textarea");
  ta.value = l.notes || "";
  ta.setAttribute("aria-label", "Notes");
  p.appendChild(ta);
  var a = el("div", "actions");
  var save = btn("Save notes", "btn", function () {
    save.disabled = true;
    sb.from("leads")
      .update({ notes: ta.value })
      .eq("id", l.id)
      .then(function (r) {
        save.disabled = false;
        if (r.error) {
          alert("Could not save notes.");
          return;
        }
        l.notes = ta.value;
        save.textContent = "Saved";
        setTimeout(function () {
          save.textContent = "Save notes";
        }, 1500);
      });
  });
  var del = btn("Delete lead", "btn danger", function () {
    if (!confirm("Delete this lead for good?")) return;
    sb.from("leads")
      .delete()
      .eq("id", l.id)
      .then(function (r) {
        if (r.error) {
          alert("Could not delete.");
          return;
        }
        leads = leads.filter(function (z) {
          return z.id !== l.id;
        });
        closeDetail();
        render();
      });
  });
  a.appendChild(save);
  a.appendChild(del);
  p.appendChild(a);
}
function setStatus(l, s) {
  sb.from("leads")
    .update({ status: s })
    .eq("id", l.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not change status.");
        return;
      }
      l.status = s;
      render();
      openLead(l.id);
    });
}

function convertLead(l, b) {
  if (clientsErr) {
    alert("Run the Stage 1 SQL in Supabase first (see the setup steps), then press Refresh.");
    return;
  }
  var addr = (l.address || "").trim();
  if (!addr) {
    addr = (prompt("This lead has no address. Enter the service address:") || "").trim();
    if (!addr) {
      alert("A service address is required to make a client.");
      return;
    }
  }
  var dup = clients.filter(function (c) {
    return (
      (l.email && c.email && c.email.toLowerCase() === l.email.toLowerCase()) ||
      (d10(l.phone).length >= 7 && (d10(c.phone) === d10(l.phone) || d10(c.phone2) === d10(l.phone)))
    );
  })[0];
  if (dup) {
    if (
      !confirm('"' + dup.name + '" already has this phone or email. Link this lead to that existing client?')
    )
      return;
    b.disabled = true;
    linkLead(l, dup, addr);
    return;
  }
  b.disabled = true;
  var type = /proposal|hoa/i.test(l.kind || "") ? "hoa" : "residential";
  sb.from("clients")
    .insert({
      name: l.name || "(no name)",
      email: l.email || "",
      phone: l.phone || "",
      type: type,
      source: l.kind || "",
      notes: ""
    })
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data) {
        b.disabled = false;
        alert("Could not create the client.");
        return;
      }
      clients.push(r.data);
      clients.sort(function (x, y) {
        return x.name.localeCompare(y.name);
      });
      linkLead(l, r.data, addr);
    });
}
function linkLead(l, c, addr) {
  function done() {
    sb.from("leads")
      .update({ client_id: c.id })
      .eq("id", l.id)
      .then(function (r) {
        if (r.error) {
          alert("Client saved, but linking the lead failed.");
        } else {
          l.client_id = c.id;
        }
        render();
        openClient(c.id);
      });
  }
  var has = clientProps(c.id).some(function (p) {
    return p.address.toLowerCase() === addr.toLowerCase();
  });
  if (!has) {
    sb.from("properties")
      .insert({ client_id: c.id, label: clientProps(c.id).length ? "" : "Main", address: addr })
      .select()
      .single()
      .then(function (r) {
        if (r.data) props.push(r.data);
        done();
      });
  } else done();
}

/* ======================= crm/src/05-clients.js ======================= */
/* Clients tab: the client list, name sorting, the client page, other contacts, properties, the client form, and CSV import. */

/* Names: each client has a formal Name (as on the account), an optional Last name for sorting, and an optional Preferred name / nickname.
   If Last name is blank it is guessed: the last word of the name, ignoring Jr/Sr/II/III/Family and anything in quotes or parentheses
   ("Mr & Mrs Smith" -> Smith, "Alejandro Torres Jr" -> Torres). HOAs and businesses sort by their full name. */
var NAME_SKIP = /^(jr|sr|ii|iii|iv|v|family|household|residence|esq|md|dds)\.?$/i;
function nameTokens(n) {
  return String(n || "")
    .replace(/["\u201c\u201d][^"\u201c\u201d]*["\u201c\u201d]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}
function guessLast(n) {
  var w = nameTokens(n);
  while (w.length > 1 && NAME_SKIP.test(w[w.length - 1])) w.pop();
  return w.length ? w[w.length - 1] : "";
}
function lastOf(c) {
  return (
    String(c.last_name || "").trim() ||
    (String(c.name || "").indexOf(",") > -1 ? String(c.name).split(",")[0].trim() : guessLast(c.name))
  );
}
function lastKey(c) {
  var n = String(c.name || "")
    .trim()
    .toLowerCase();
  if (!n) return "";
  if (c.type === "hoa" || c.type === "commercial") return n + "|";
  return lastOf(c).toLowerCase() + "|" + n;
}
/* "Torres, Alejandro Jr "AL"" : last name first, formal rest of the name, then the nickname in quotes */
function dispName(c) {
  var n = String(c.name || "").trim();
  if (!n) return "";
  var nick = String(c.nickname || "").trim(),
    tail = nick ? ' "' + nick + '"' : "";
  if (c.type === "hoa" || c.type === "commercial") return n + tail;
  if (n.indexOf(",") > -1) return n + tail;
  var last = lastOf(c),
    w = nameTokens(n),
    lw = nameTokens(last),
    i = -1;
  for (var k = w.length - lw.length; k >= 0; k--) {
    var ok = true;
    for (var j = 0; j < lw.length; j++)
      if (w[k + j].toLowerCase() !== lw[j].toLowerCase()) {
        ok = false;
        break;
      }
    if (ok) {
      i = k;
      break;
    }
  }
  if (i < 0) return last + ", " + w.join(" ") + tail;
  var rest = w
    .slice(0, i)
    .concat(w.slice(i + lw.length))
    .join(" ");
  return last + (rest ? ", " + rest : "") + tail;
}
function sortClients() {
  clients.sort(function (a, b) {
    var x = lastKey(a),
      y = lastKey(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
function isMainProp(p) {
  return /\bmain\b/i.test(String(p.label || ""));
}
/* A client's properties, with the one labeled "Main" always first; the rest stay in the order they were added. */
function clientProps(id) {
  var l = props.filter(function (p) {
      return p.client_id === id;
    }),
    m = l.filter(isMainProp),
    o = l.filter(function (p) {
      return !isMainProp(p);
    });
  return m.concat(o);
}
function renderClients() {
  sortClients();
  var tabs = $("tabs");
  tabs.textContent = "";
  var act = clients.filter(function (c) {
    return !c.archived;
  });
  var defs = [
    ["active", "Active", act.length],
    [
      "residential",
      "Residential",
      act.filter(function (c) {
        return c.type === "residential";
      }).length
    ],
    [
      "hoa",
      "HOA",
      act.filter(function (c) {
        return c.type === "hoa";
      }).length
    ],
    [
      "commercial",
      "Commercial",
      act.filter(function (c) {
        return c.type === "commercial";
      }).length
    ],
    ["archived", "Archived", clients.length - act.length]
  ];
  defs.forEach(function (s) {
    var b = el("button", "tab" + (cfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      cfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var tb = $("topbtns");
  tb.appendChild(
    btn("+ New client", "btn", function () {
      openClientForm(null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Import CSV", "btn alt", openImport));
  var list = $("list");
  list.textContent = "";
  if (clientsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Clients aren't set up yet. Run the Stage 1 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var shown = clients.filter(function (c) {
    if (cfilter === "archived") {
      if (!c.archived) return false;
    } else {
      if (c.archived) return false;
      if (cfilter !== "active" && c.type !== cfilter) return false;
    }
    if (!query) return true;
    var addr = clientProps(c.id)
      .map(function (p) {
        return p.address;
      })
      .join(" ");
    return (
      [c.name, c.nickname, c.last_name, c.company, c.email, c.phone, c.phone2, c.notes, addr, ccText(c.id)]
        .join(" ")
        .toLowerCase()
        .indexOf(query) > -1
    );
  });
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        clients.length ? "Nothing matches that." : "No clients yet. Add one, import a CSV, or convert a lead."
      )
    );
    return;
  }
  shown.forEach(function (c) {
    var b = el("button", "row client" + (c.archived ? " archived" : ""));
    b.type = "button";
    var ps = clientProps(c.id),
      left = el("div");
    left.appendChild(el("b", null, dispName(c) + (c.company ? " · " + c.company : "")));
    left.appendChild(el("div", "sub", [c.phone, c.email].filter(Boolean).join(" · ")));
    if (ps[0])
      left.appendChild(
        el("div", "sub", ps[0].address + (ps.length > 1 ? "  (+" + (ps.length - 1) + " more)" : ""))
      );
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(el("span", "chip " + c.type, tlabel(c.type)));
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openClient(c.id);
    });
    list.appendChild(b);
  });
}

/* ---- client detail ---- */
function openClient(id) {
  var c = byId(clients, id);
  if (!c) return;
  var p = panel();
  p.appendChild(el("h2", null, c.name + (c.company ? " · " + c.company : "")));
  p.appendChild(
    el(
      "div",
      "note",
      (c.nickname ? 'Goes by "' + c.nickname + '" · ' : "") +
        tlabel(c.type) +
        " · added " +
        new Date(c.created_at).toLocaleDateString() +
        (c.source ? " · from " + c.source : "") +
        (c.archived ? " · ARCHIVED" : "")
    )
  );
  p.appendChild(contactRow(c.phone || c.phone2, c.email));
  var t = document.createElement("table");
  [
    ["Phone", c.phone],
    ["Phone 2", c.phone2],
    ["Email", c.email],
    ["Notes", c.notes]
  ].forEach(function (r) {
    if (!r[1]) return;
    var tr = document.createElement("tr");
    tr.appendChild(el("td", null, r[0]));
    tr.appendChild(el("td", null, r[1]));
    t.appendChild(tr);
  });
  p.appendChild(t);
  var acts = el("div", "contact");
  acts.appendChild(
    btn("Edit details", "btn alt sm", function () {
      openClientForm(c);
    })
  );
  acts.appendChild(
    btn(c.archived ? "Unarchive" : "Archive", "btn alt sm", function () {
      sb.from("clients")
        .update({ archived: !c.archived })
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not update.");
            return;
          }
          c.archived = !c.archived;
          render();
          openClient(c.id);
        });
    })
  );
  p.appendChild(acts);
  p.appendChild(clientContactsSection(c));
  /* properties */
  var sec = el("div", "sec"),
    h = el("h3", null, "Properties"),
    addp = btn("+ Add property", "btn alt sm", function () {
      propForm(c, null, sec, h);
    });
  h.appendChild(addp);
  sec.appendChild(h);
  p.appendChild(sec);
  var holder = el("div");
  sec.appendChild(holder);
  drawProps(c, holder);
  p.appendChild(clientJobsSection(c));
  p.appendChild(clientBillingSection(c));
  if (!estErr) p.appendChild(clientEstimatesSection(c));
  p.appendChild(clientPhotosSection(c));
  p.appendChild(historySection(c));
  /* leads */
  var ls = leads.filter(function (l) {
    return l.client_id === c.id;
  });
  if (ls.length) {
    var s2 = el("div", "sec");
    s2.appendChild(el("h3", null, "Requests from the website"));
    ls.forEach(function (l) {
      var r = el("div", "pcard");
      r.appendChild(el("b", null, l.kind + " · " + label(l.status)));
      r.appendChild(
        el("div", "note", new Date(l.created_at).toLocaleDateString() + (l.service ? " · " + l.service : ""))
      );
      r.appendChild(
        btn("Open", "btn alt sm", function () {
          openLead(l.id);
        })
      ).style.marginTop = "6px";
      s2.appendChild(r);
    });
    p.appendChild(s2);
  }
  var d = el("div", "actions");
  d.appendChild(el("span"));
  d.appendChild(
    btn("Delete client", "btn danger", function () {
      if (!confirm("Delete this client and all their properties for good? (Archive keeps the history.)"))
        return;
      sb.from("clients")
        .delete()
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not delete. A client with invoices can't be deleted, so Archive them instead.");
            return;
          }
          clients = clients.filter(function (z) {
            return z.id !== c.id;
          });
          props = props.filter(function (z) {
            return z.client_id !== c.id;
          });
          leads.forEach(function (l) {
            if (l.client_id === c.id) l.client_id = null;
          });
          closeDetail();
          render();
        });
    })
  );
  p.appendChild(d);
}
/* ---- other contacts on a client (spouse, board members...) ---- */
function clientCC(id) {
  return ccontacts.filter(function (x) {
    return x.client_id === id;
  });
}
function ccText(id) {
  return clientCC(id)
    .map(function (x) {
      return [x.name, x.role, x.phone, x.email].join(" ");
    })
    .join(" ");
}
function clientContactsSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Other contacts"),
    holder = el("div");
  if (!ccErr)
    h.appendChild(
      btn("+ Add contact", "btn alt sm", function () {
        ccForm(c, null, holder);
      })
    );
  sec.appendChild(h);
  sec.appendChild(holder);
  drawCC(c, holder);
  return sec;
}
function drawCC(c, holder) {
  holder.textContent = "";
  if (ccErr) {
    holder.appendChild(
      el(
        "div",
        "note",
        "To add spouses, board members and other contacts, run the Stage 21 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var cs = clientCC(c.id);
  if (!cs.length) {
    holder.appendChild(
      el(
        "div",
        "note",
        "None yet. Add a spouse, board member, property manager or anyone else you may need to reach."
      )
    );
    return;
  }
  cs.forEach(function (x) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, (x.name || "(no name)") + (x.role ? " · " + x.role : "")));
    var info = [x.phone, x.email].filter(Boolean).join(" · ");
    if (info) card.appendChild(el("div", "note", info));
    if (x.notes) card.appendChild(el("div", "note", x.notes));
    var a = el("div", "acts"),
      dg = digits(x.phone);
    if (dg) {
      (isOwner() ? ["Call", "Text"] : ["Call"]).forEach(function (t) {
        var l = el("a", "btn alt sm", t);
        l.href = (t === "Call" ? "tel:" : "sms:") + dg;
        a.appendChild(l);
      });
    }
    if (x.email) {
      var m = el("a", "btn alt sm", "Email");
      m.href = "mailto:" + x.email;
      a.appendChild(m);
    }
    a.appendChild(
      btn("Edit", "btn alt sm", function () {
        ccForm(c, x, holder);
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Remove " + (x.name || "this contact") + " from this client?")) return;
        sb.from("client_contacts")
          .delete()
          .eq("id", x.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            ccontacts = ccontacts.filter(function (z) {
              return z.id !== x.id;
            });
            drawCC(c, holder);
          });
      })
    );
    card.appendChild(a);
    holder.appendChild(card);
  });
}
function ccForm(c, x, holder) {
  var box = el("div", "pcard"),
    g = el("div", "grid2");
  var nm = fld("Name", "text", x ? x.name : ""),
    rl = fld("Role (Spouse, Board member...)", "text", x ? x.role : "");
  var dl = document.createElement("datalist");
  dl.id = "ccroles";
  CROLES.forEach(function (r) {
    var o = document.createElement("option");
    o.value = r;
    dl.appendChild(o);
  });
  rl.appendChild(dl);
  rl.input.setAttribute("list", "ccroles");
  var ph = fld("Phone", "tel", x ? x.phone : ""),
    em = fld("Email", "email", x ? x.email : "");
  g.appendChild(nm);
  g.appendChild(rl);
  g.appendChild(ph);
  g.appendChild(em);
  box.appendChild(g);
  var nt = fld("Notes (best time to call, what to contact them about...)", "text", x ? x.notes : "");
  box.appendChild(nt);
  var a = el("div", "acts");
  var save = btn("Save contact", "btn sm", function () {
    if (!nm.input.value.trim() && !ph.input.value.trim() && !em.input.value.trim()) {
      alert("Enter a name, phone or email.");
      return;
    }
    var row = {
      name: nm.input.value.trim(),
      role: rl.input.value.trim(),
      phone: ph.input.value.trim(),
      email: em.input.value.trim(),
      notes: nt.input.value.trim()
    };
    save.disabled = true;
    var q = x
      ? sb.from("client_contacts").update(row).eq("id", x.id).select().single()
      : sb
          .from("client_contacts")
          .insert(Object.assign({ client_id: c.id }, row))
          .select()
          .single();
    q.then(function (r) {
      save.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (x) Object.assign(x, r.data);
      else ccontacts.push(r.data);
      drawCC(c, holder);
    });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt sm", function () {
      drawCC(c, holder);
    })
  );
  box.appendChild(a);
  if (x) {
    holder.textContent = "";
    holder.appendChild(box);
  } else {
    var e = holder.querySelector(".note");
    if (e) e.remove();
    holder.insertBefore(box, holder.firstChild);
  }
  nm.input.focus();
}
function drawProps(c, holder) {
  holder.textContent = "";
  var ps = clientProps(c.id);
  if (!ps.length) {
    holder.appendChild(el("div", "note", "No properties yet. Add the service address."));
    return;
  }
  ps.forEach(function (pr) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, (pr.label ? pr.label + ": " : "") + pr.address));
    if (pr.notes) card.appendChild(el("div", "note", pr.notes));
    var a = el("div", "acts"),
      m = el("a", "btn alt sm", "Map");
    m.href = mapsUrl(pr.address);
    m.target = "_blank";
    m.rel = "noopener";
    a.appendChild(m);
    if (ps.length > 1 && !isMainProp(pr))
      a.appendChild(
        btn("Make main", "btn alt sm", function () {
          var old = ps.filter(isMainProp);
          Promise.all(
            old
              .map(function (o) {
                return sb.from("properties").update({ label: "" }).eq("id", o.id);
              })
              .concat([sb.from("properties").update({ label: "Main" }).eq("id", pr.id)])
          ).then(function (rs) {
            if (
              rs.some(function (r) {
                return r.error;
              })
            ) {
              alert("Could not change the main property.");
              return;
            }
            old.forEach(function (o) {
              o.label = "";
            });
            pr.label = "Main";
            drawProps(c, holder);
            render();
          });
        })
      );
    a.appendChild(
      btn("Edit", "btn alt sm", function () {
        propForm(c, pr, holder);
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this property?")) return;
        sb.from("properties")
          .delete()
          .eq("id", pr.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            props = props.filter(function (z) {
              return z.id !== pr.id;
            });
            drawProps(c, holder);
            render();
          });
      })
    );
    card.appendChild(a);
    holder.appendChild(card);
  });
}
function propForm(c, pr, holder) {
  var box = el("div", "pcard");
  var lab = fld("Label (Main, Rental, Office...)", "text", pr ? pr.label : "");
  var adr = fld("Address", "text", pr ? pr.address : "");
  adr.input.placeholder = "123 Example Ln, Kissimmee, FL 34758";
  var nts = fld("Access notes (gate code, dogs, parking...)", "textarea", pr ? pr.notes : "");
  box.appendChild(lab);
  box.appendChild(adr);
  box.appendChild(nts);
  var a = el("div", "acts");
  var save = btn("Save property", "btn sm", function () {
    if (!adr.input.value.trim()) {
      alert("Enter an address.");
      return;
    }
    var row = {
      label: lab.input.value.trim(),
      address: adr.input.value.trim(),
      notes: nts.input.value.trim()
    };
    save.disabled = true;
    var q = pr
      ? sb.from("properties").update(row).eq("id", pr.id).select().single()
      : sb
          .from("properties")
          .insert(Object.assign({ client_id: c.id }, row))
          .select()
          .single();
    q.then(function (r) {
      save.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (pr) {
        Object.assign(pr, r.data);
      } else props.push(r.data);
      drawProps(c, holder);
      render();
    });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt sm", function () {
      drawProps(c, holder);
    })
  );
  box.appendChild(a);
  if (pr) {
    holder.textContent = "";
    holder.appendChild(box);
  } else {
    holder.insertBefore(box, holder.firstChild);
  }
}
function openClientForm(c) {
  var p = panel();
  p.appendChild(el("h2", null, c ? "Edit client" : "New client"));
  var n = fld("Name (as on the account, e.g. Mr & Mrs Smith, or Alejandro Torres Jr)", "text", c && c.name),
    ln = fld("Last name (for sorting)", "text", c && c.last_name),
    nk = fld("Preferred name / nickname (optional)", "text", c && c.nickname),
    co = fld("Company / HOA name (optional)", "text", c && c.company);
  var ph = fld("Phone", "tel", c && c.phone),
    ph2 = fld("Phone 2 (optional)", "tel", c && c.phone2);
  var em = fld("Email", "email", c && c.email),
    ty = fld("Type", "select", c ? c.type : "residential", TYPES);
  var nt = fld("Notes", "textarea", c && c.notes);
  var bp = fld("Invoices for multiple properties", "select", c && c.bill_by_property ? "1" : "0", [
    ["0", "One combined invoice for all properties"],
    ["1", "Separate invoice for each property"]
  ]);
  var g = el("div", "grid2");
  g.appendChild(n);
  g.appendChild(ln);
  g.appendChild(nk);
  g.appendChild(co);
  g.appendChild(ph);
  g.appendChild(ph2);
  g.appendChild(em);
  g.appendChild(ty);
  p.appendChild(g);
  p.appendChild(bp);
  p.appendChild(nt);
  function hint() {
    ln.input.placeholder = guessLast(n.input.value) || "Left blank = guessed from the name";
  }
  n.input.addEventListener("input", hint);
  hint();
  var addr = null;
  if (!c) {
    addr = fld("Service address (required, you can add more later)", "text", "");
    addr.input.placeholder = "123 Example Ln, Kissimmee, FL 34758";
    p.appendChild(addr);
  }
  var a = el("div", "actions");
  var save = btn("Save", "btn", function () {
    if (!n.input.value.trim()) {
      alert("Enter a name.");
      return;
    }
    if (!c && !addr.input.value.trim()) {
      alert("Enter the service address.");
      addr.input.focus();
      return;
    }
    var row = {
      name: n.input.value.trim(),
      company: co.input.value.trim(),
      phone: ph.input.value.trim(),
      phone2: ph2.input.value.trim(),
      email: em.input.value.trim(),
      type: ty.input.value,
      notes: nt.input.value.trim()
    };
    var colsOk = clients.some(function (x) {
        return "last_name" in x;
      }),
      wantNames = ln.input.value.trim() || nk.input.value.trim();
    if (colsOk || wantNames) {
      row.last_name = ln.input.value.trim();
      row.nickname = nk.input.value.trim();
    }
    var bpOk = clients.some(function (x) {
        return "bill_by_property" in x;
      }),
      wantBp = bp.input.value === "1";
    if (bpOk || wantBp) row.bill_by_property = wantBp;
    save.disabled = true;
    if (c) {
      sb.from("clients")
        .update(row)
        .eq("id", c.id)
        .select()
        .single()
        .then(function (r) {
          save.disabled = false;
          if (r.error || !r.data) {
            alert(
              wantBp && !bpOk
                ? "Could not save. Separate invoices per property need the Stage 20 SQL: run it in Supabase (SQL Editor), then press Refresh."
                : wantNames && !colsOk
                  ? "Could not save. Last name and nickname need the Stage 19 SQL: run it in Supabase (SQL Editor), then press Refresh."
                  : "Could not save."
            );
            return;
          }
          Object.assign(c, r.data);
          render();
          openClient(c.id);
        });
    } else {
      row.source = "Added by hand";
      sb.from("clients")
        .insert(row)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            save.disabled = false;
            alert(
              wantNames && !colsOk
                ? "Could not save. Last name and nickname need the Stage 19 SQL: run it in Supabase (SQL Editor), then press Refresh."
                : "Could not save. Did you run the Stage 1 SQL?"
            );
            return;
          }
          clients.push(r.data);
          clients.sort(function (x, y) {
            return x.name.localeCompare(y.name);
          });
          var ad = addr.input.value.trim();
          sb.from("properties")
            .insert({ client_id: r.data.id, label: "Main", address: ad })
            .select()
            .single()
            .then(function (q) {
              if (q.data) props.push(q.data);
              else alert("Client saved, but the address did not save. Add it from the client page.");
              render();
              openClient(r.data.id);
            });
        });
    }
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt", function () {
      if (c) openClient(c.id);
      else closeDetail();
    })
  );
  p.appendChild(a);
}

/* ---- CSV import (Jobber export or any spreadsheet saved as CSV) ---- */
function parseCSV(text) {
  var rows = [],
    row = [],
    f = "",
    q = false,
    i,
    ch;
  text = text.replace(/^﻿/, "");
  for (i = 0; i < text.length; i++) {
    ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(f);
      f = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      f = "";
      if (
        row.some(function (x) {
          return x.trim();
        })
      )
        rows.push(row);
      row = [];
    } else f += ch;
  }
  row.push(f);
  if (
    row.some(function (x) {
      return x.trim();
    })
  )
    rows.push(row);
  return rows;
}
function openImport() {
  if (clientsErr) {
    alert("Run the Stage 1 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Import clients from CSV"));
  p.appendChild(
    el(
      "p",
      "note",
      "In Jobber: Clients, then the ⋯ menu, then Export (CSV). Or save any spreadsheet as CSV. Columns it understands: Name (or First name + Last name), Company, Email, Phone, Street/Address, City, State, Zip. Clients that match an existing phone or email are skipped."
    )
  );
  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,text/csv";
  p.appendChild(file);
  var out = el("div");
  out.style.marginTop = "12px";
  p.appendChild(out);
  file.addEventListener("change", function () {
    var f = file.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var rows = parseCSV(String(rd.result));
      out.textContent = "";
      if (rows.length < 2) {
        out.textContent = "That file looks empty.";
        return;
      }
      var hd = rows[0].map(function (h) {
        return h.trim().toLowerCase();
      });
      function col() {
        var a = arguments,
          i,
          j;
        for (j = 0; j < a.length; j++) for (i = 0; i < hd.length; i++) if (hd[i] === a[j]) return i;
        for (j = 0; j < a.length; j++) for (i = 0; i < hd.length; i++) if (hd[i].indexOf(a[j]) > -1) return i;
        return -1;
      }
      var cName = col("name", "client name", "display name"),
        cF = col("first name"),
        cL = col("last name"),
        cCo = col("company"),
        cEm = col("email", "e-mail"),
        cPh = col("phone", "mobile", "main phone"),
        cSt = col("street 1", "street", "address"),
        cCi = col("city"),
        cS = col("state", "province"),
        cZ = col("zip", "postal");
      function g(r, i) {
        return i > -1 && r[i] ? String(r[i]).trim() : "";
      }
      var map = {},
        order = [];
      rows.slice(1).forEach(function (r) {
        var name = g(r, cName) || [g(r, cF), g(r, cL)].filter(Boolean).join(" ") || g(r, cCo);
        if (!name) return;
        var key = name.toLowerCase() + "|" + d10(g(r, cPh)) + "|" + g(r, cEm).toLowerCase();
        var addr = [g(r, cSt), [g(r, cCi), g(r, cS)].filter(Boolean).join(", "), g(r, cZ)]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (!map[key]) {
          map[key] = { name: name, company: g(r, cCo), email: g(r, cEm), phone: g(r, cPh), addrs: [] };
          order.push(key);
        }
        if (addr && map[key].addrs.indexOf(addr) < 0) map[key].addrs.push(addr);
      });
      var fresh = order
        .map(function (k) {
          return map[k];
        })
        .filter(function (x) {
          return !clients.some(function (c) {
            return (
              (x.email && c.email && c.email.toLowerCase() === x.email.toLowerCase()) ||
              (d10(x.phone).length >= 7 && d10(c.phone) === d10(x.phone))
            );
          });
        });
      var noAddr = fresh.filter(function (x) {
        return !x.addrs.length;
      }).length;
      fresh = fresh.filter(function (x) {
        return x.addrs.length;
      });
      if (!fresh.length) {
        out.textContent = noAddr
          ? "Nothing imported: " +
            noAddr +
            " client(s) have no address, and an address is required. Add an address column to those rows."
          : "Nothing new to import (everything already matches a client).";
        return;
      }
      if (noAddr) out.appendChild(el("p", "note", noAddr + " row(s) skipped because they have no address."));
      out.appendChild(
        el(
          "p",
          null,
          "Ready to import " +
            fresh.length +
            " client(s) with " +
            fresh.reduce(function (n, x) {
              return n + x.addrs.length;
            }, 0) +
            " propert" +
            "ies."
        )
      );
      var go = btn("Import now", "btn", function () {
        go.disabled = true;
        go.textContent = "Importing...";
        sb.from("clients")
          .insert(
            fresh.map(function (x) {
              return {
                name: x.name,
                company: x.company,
                email: x.email,
                phone: x.phone,
                type: "residential",
                source: "CSV import"
              };
            })
          )
          .select()
          .then(function (r) {
            if (r.error || !r.data) {
              go.disabled = false;
              go.textContent = "Import now";
              alert("Import failed. Nothing was added.");
              return;
            }
            var pr = [];
            r.data.forEach(function (c) {
              var m = fresh.filter(function (x) {
                return x.name === c.name && x.phone === c.phone && x.email === c.email;
              })[0];
              if (m)
                m.addrs.forEach(function (a, i) {
                  pr.push({ client_id: c.id, label: i ? "" : "Main", address: a });
                });
            });
            r.data.forEach(function (c) {
              clients.push(c);
            });
            clients.sort(function (x, y) {
              return x.name.localeCompare(y.name);
            });
            var fin = function () {
              render();
              closeDetail();
              alert("Imported " + r.data.length + " client(s).");
            };
            if (pr.length)
              sb.from("properties")
                .insert(pr)
                .select()
                .then(function (q) {
                  if (q.data)
                    q.data.forEach(function (x) {
                      props.push(x);
                    });
                  fin();
                });
            else fin();
          });
      });
      out.appendChild(go);
    };
    rd.readAsText(f);
  });
}

/* ======================= crm/src/06-search.js ======================= */
/* The search box at the top: finds clients, jobs, invoices, estimates, tasks, inventory and screens. */

/* ---- global search (header) ---- */
(function () {
  var gs = $("gs"),
    res = $("gres"),
    lastQ = "";
  function toks(q) {
    return q.toLowerCase().split(/\s+/).filter(Boolean);
  }
  function all(hay, t) {
    hay = hay.toLowerCase();
    var dig = hay.replace(/\D/g, "");
    return t.every(function (x) {
      return hay.indexOf(x) > -1 || (/^\d{3,}$/.test(x) && dig.indexOf(x) > -1);
    });
  }
  function sec(title, items, make, go) {
    if (!items.length) return;
    res.appendChild(el("h4", null, title));
    items.slice(0, 6).forEach(function (it) {
      var m = make(it),
        b = document.createElement("button");
      b.type = "button";
      b.appendChild(el("b", null, m[0]));
      if (m[1]) b.appendChild(el("span", null, m[1]));
      b.addEventListener("click", function () {
        close();
        gs.value = "";
        m[2]();
      });
      res.appendChild(b);
    });
    if (go && items.length > 6) {
      var more = document.createElement("button");
      more.type = "button";
      more.appendChild(el("b", null, "See all " + items.length + " " + title.toLowerCase() + " →"));
      more.firstChild.style.color = "var(--forest)";
      more.addEventListener("click", function () {
        close();
        gs.value = "";
        go();
      });
      res.appendChild(more);
    }
  }
  var TOPICS = [
    [
      "Leads",
      "leads lead quote request inquiry website new",
      function () {
        view = "leads";
        lfilter = "all";
      }
    ],
    [
      "Clients",
      "clients client customer customers contact phone email",
      function () {
        view = "clients";
      }
    ],
    [
      "Jobs",
      "jobs job service services recurring price weekly",
      function () {
        view = "jobs";
      }
    ],
    [
      "Schedule",
      "schedule calendar route today tomorrow visit visits crew day week",
      function () {
        view = "schedule";
      }
    ],
    [
      "Weather delay",
      "weather rain delay storm reschedule",
      function () {
        view = "schedule";
        openWeather(today());
      }
    ],
    [
      "To-Do",
      "todo to-do task tasks reminder",
      function () {
        view = "todo";
      }
    ],
    [
      "Invoices (Billing)",
      "invoices invoice bill billing payment paid unpaid overdue owed zelle",
      function () {
        view = "billing";
        bfilter = "open";
      }
    ],
    [
      "Ready to bill",
      "bill billing unbilled ready to-bill create invoices",
      function () {
        view = "billing";
        bfilter = "tobill";
      }
    ],
    [
      "Estimates (Billing)",
      "estimates estimate quote proposal",
      function () {
        view = "billing";
        bfilter = "estimates";
      }
    ],
    [
      "Reports",
      "reports report revenue profit earnings income money",
      function () {
        view = "reports";
        rtab = "overview";
      }
    ],
    [
      "Tax report",
      "tax taxes report year-end equipment",
      function () {
        view = "reports";
        rtab = "tax";
      }
    ],
    [
      "Expenses",
      "expenses expense receipt spending cost costs vendor scan",
      function () {
        view = "expenses";
      }
    ],
    [
      "Photos",
      "photos photo pictures picture images gallery before after receipt",
      function () {
        view = "photos";
      }
    ],
    [
      "Price calculator",
      "price prices pricing calculator estimate quote rate rates mow mowing lawn sqft square feet",
      function () {
        view = "billing";
        bfilter = "estimates";
        setTimeout(openCalc, 0);
      }
    ],
    [
      "Inventory",
      "inventory stock supplies equipment parts tools chemicals fuel",
      function () {
        view = "inventory";
        invq = "";
      }
    ],
    [
      "Team",
      "team staff users user login access owner office permissions",
      function () {
        if (isOwner()) view = "team";
        else view = "leads";
      }
    ],
    [
      "Billing settings",
      "settings business zelle terms footer",
      function () {
        view = "billing";
        openBizSettings();
      }
    ]
  ];
  function topicHit(tp, t) {
    var w = (tp[0] + " " + tp[1]).toLowerCase().split(/\s+/);
    return t.every(function (x) {
      return w.some(function (y) {
        return y.indexOf(x) === 0;
      });
    });
  }
  function close() {
    res.classList.remove("on");
    res.textContent = "";
  }
  function run() {
    var t = toks(gs.value);
    lastQ = gs.value.trim();
    res.textContent = "";
    if (!t.length) {
      close();
      return;
    }
    var cl = clients.filter(function (c) {
      return all(
        [
          "client",
          c.name,
          c.company,
          c.phone,
          c.phone2,
          c.email,
          ccText(c.id),
          clientProps(c.id)
            .map(function (p) {
              return p.address;
            })
            .join(" ")
        ].join(" "),
        t
      );
    });
    var jb = jobs.filter(function (j) {
      var sv = byId(services, j.service_id);
      return all(
        [
          "job",
          j.title,
          sv ? sv.name : "",
          cname(j.client_id),
          paddr(j.property_id),
          flabel(j.frequency)
        ].join(" "),
        t
      );
    });
    var ld = leads.filter(function (l) {
      return all(["lead", l.name, l.email, l.phone, l.address, l.service, l.kind].join(" "), t);
    });
    var tp = TOPICS.filter(function (x) {
      return topicHit(x, t) && !(x[0] === "Team" && !isOwner());
    });
    if (tp.length) {
      res.appendChild(el("h4", null, "Go to"));
      tp.slice(0, 4).forEach(function (x) {
        var b = document.createElement("button");
        b.type = "button";
        b.appendChild(el("b", null, x[0]));
        b.addEventListener("click", function () {
          close();
          gs.value = "";
          x[2]();
          render();
        });
        res.appendChild(b);
      });
    }
    sec("Clients", cl, function (c) {
      var ps = clientProps(c.id);
      return [
        c.name + (c.company ? " · " + c.company : ""),
        [ps[0] && ps[0].address, c.phone].filter(Boolean).join(" · "),
        function () {
          openClient(c.id);
        }
      ];
    });
    sec("Jobs", jb, function (j) {
      return [
        cname(j.client_id) + " · " + j.title,
        [paddr(j.property_id), flabel(j.frequency), money(j.price), j.status !== "active" ? j.status : ""]
          .filter(Boolean)
          .join(" · "),
        function () {
          openJob(j.id);
        }
      ];
    });
    var iv = billErr
      ? []
      : invoices.filter(function (i) {
          return all(
            [
              "invoice",
              i.status === "open" && isOverdue(i) ? "overdue" : i.status,
              i.status === "open" ? "unpaid" : "",
              String(i.total),
              invNum(i.number),
              String(i.number),
              cname(i.client_id),
              i.reference || ""
            ].join(" "),
            t
          );
        });
    sec(
      "Invoices",
      iv,
      function (i) {
        return [
          invNum(i.number) + " · " + cname(i.client_id),
          [
            money(i.total),
            i.status === "paid" ? "Paid" : i.status === "void" ? "Void" : "Due " + dshort(i.due_date),
            i.reference
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openInvoice(i.id);
          }
        ];
      },
      function () {
        view = "billing";
        bfilter = "open";
        render();
      }
    );
    sec("Leads", ld, function (l) {
      return [
        l.name || "(no name)",
        [l.kind, l.service, l.address].filter(Boolean).join(" · "),
        function () {
          openLead(l.id);
        }
      ];
    });
    var es = estErr
      ? []
      : estimates.filter(function (e) {
          return all(
            [
              "estimate quote",
              e.status,
              estNum(e.number),
              String(e.total),
              cname(e.client_id),
              e.title || "",
              e.scope || ""
            ].join(" "),
            t
          );
        });
    sec(
      "Estimates",
      es,
      function (e) {
        return [
          estNum(e.number) + " · " + cname(e.client_id),
          [
            e.title,
            money(e.total),
            e.status === "accepted"
              ? "Accepted"
              : e.status === "declined"
                ? "Declined"
                : estExpired(e)
                  ? "Expired"
                  : e.status === "sent"
                    ? "Sent"
                    : "Draft"
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openEstimate(e.id);
          }
        ];
      },
      function () {
        view = "billing";
        bfilter = "estimates";
        render();
      }
    );
    var td = todoErr
      ? []
      : todos.filter(function (x) {
          return all(
            [
              "task todo",
              x.done ? "done" : "open",
              x.title,
              x.notes || "",
              cname(x.client_id),
              memberName(x.assigned_to)
            ].join(" "),
            t
          );
        });
    sec(
      "To-Do",
      td,
      function (x) {
        return [
          x.title,
          [
            x.done ? "Done" : "Open",
            x.due_date ? "due " + dshort(x.due_date) : "",
            x.client_id ? cname(x.client_id) : ""
          ]
            .filter(Boolean)
            .join(" · "),
          function () {
            openTodo(x);
          }
        ];
      },
      function () {
        view = "todo";
        tfilter = t.indexOf("done") > -1 ? "done" : "open";
        render();
      }
    );
    var ex = expErr
      ? []
      : expenses.filter(function (x) {
          return all(
            [
              "expense",
              x.category,
              x.vendor,
              x.note || "",
              String(x.amount),
              x.client_id ? cname(x.client_id) : ""
            ].join(" "),
            t
          );
        });
    sec(
      "Expenses",
      ex,
      function (x) {
        return [
          money(x.amount) + " · " + (x.vendor || x.category),
          [x.category, dshort(x.spent_on), x.note].filter(Boolean).join(" · "),
          function () {
            openExpense(x);
          }
        ];
      },
      function () {
        view = "expenses";
        render();
      }
    );
    var ph = photoErr
      ? []
      : photos.filter(function (x) {
          return all(["photo", x.kind, x.caption || "", x.client_id ? cname(x.client_id) : ""].join(" "), t);
        });
    sec(
      "Photos",
      ph,
      function (x) {
        return [
          (x.client_id ? cname(x.client_id) : "No client") + " · " + x.kind,
          [x.caption, dshort(String(x.created_at).slice(0, 10))].filter(Boolean).join(" · "),
          function () {
            view = "photos";
            pf.client = x.client_id || "none";
            pf.kind = "all";
            render();
          }
        ];
      },
      function () {
        view = "photos";
        render();
      }
    );
    var ii = [];
    if (!invErr)
      invVisible().forEach(function (c) {
        invRows(c).forEach(function (r) {
          if (invHas(c, r, t)) ii.push([c, r]);
        });
      });
    sec(
      "Inventory",
      ii,
      function (x) {
        var c = x[0],
          r = x[1],
          cols = invCols(c);
        return [
          invTitle(c, r),
          c.name +
            " · " +
            cols
              .slice(1)
              .map(function (col) {
                var v = invVal(r, col.k);
                return v ? col.n + ": " + v : "";
              })
              .filter(Boolean)
              .join(" · "),
          function () {
            view = "inventory";
            invCat = c.id;
            invq = lastQ;
            render();
          }
        ];
      },
      function () {
        view = "inventory";
        invq = lastQ;
        render();
      }
    );
    if (!res.firstChild)
      res.appendChild(
        el(
          "div",
          "none",
          "No matches. Try a name, address, phone, invoice number, or a topic like invoices, photos or inventory."
        )
      );
    res.classList.add("on");
  }
  gs.addEventListener("input", run);
  gs.addEventListener("focus", function () {
    if (gs.value.trim()) run();
  });
  gs.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      close();
      gs.blur();
    } else if (e.key === "Enter") {
      var f = res.querySelector("button");
      if (f) f.click();
    }
  });
  document.addEventListener("click", function (e) {
    if (!$("gsearch").contains(e.target)) close();
  });
})();

/* ======================= crm/src/07-jobs.js ======================= */
/* Jobs tab: recurring and one-time jobs, how visits are generated, job detail and form, services list, jobs and history on the client page. */

/* ======================= STAGE 2: services, jobs, visits ======================= */
var FREQ = [
  ["weekly", "Weekly"],
  ["biweekly", "Every 2 weeks"],
  ["once", "One-time"]
];

function flabel(f) {
  var x = FREQ.filter(function (a) {
    return a[0] === f;
  })[0];
  return x ? x[1] : f;
}
function needSql() {
  alert("Run the Stage 2 SQL in Supabase first (SQL Editor), then press Refresh.");
}

function loadVisits() {
  histFrom = addDays(today(), -45);
  return sb
    .from("visits")
    .select("*")
    .gte("scheduled_date", addDays(today(), -45))
    .order("scheduled_date", { ascending: true })
    .limit(5000)
    .then(function (r) {
      if (!r.error) visits = r.data || [];
    });
}
function visitDates(job) {
  var t = today(),
    end = addDays(t, 84);
  if (job.frequency === "once") return [job.start_date];
  if (job.end_date && job.end_date < end) end = job.end_date;
  var step = job.frequency === "weekly" ? 7 : 14,
    out = [],
    d = job.start_date,
    floor = addDays(t, -7);
  if (d < floor) {
    var days = Math.round((pd(floor) - pd(d)) / 86400000);
    d = addDays(d, Math.ceil(days / step) * step);
  }
  while (d <= end) {
    out.push(d);
    d = addDays(d, step);
  }
  return out;
}
function topUp() {
  if (jobsErr) return Promise.resolve(0);
  var rows = [];
  jobs.forEach(function (j) {
    if (j.status !== "active") return;
    var lastV = visits
        .filter(function (v) {
          return v.job_id === j.id;
        })
        .sort(function (a, b) {
          return a.orig_date < b.orig_date ? 1 : -1;
        })[0],
      off =
        lastV && /#R$/.test(lastV.weather_batch || "")
          ? Math.round((pd(lastV.scheduled_date) - pd(lastV.orig_date)) / 86400000)
          : 0;
    visitDates(j).forEach(function (d) {
      if (
        visits.some(function (v) {
          return v.job_id === j.id && v.orig_date === d;
        })
      )
        return;
      var row = {
        job_id: j.id,
        client_id: j.client_id,
        property_id: j.property_id,
        orig_date: d,
        scheduled_date: addDays(d, off),
        status: "scheduled",
        price: j.price
      };
      if (s3) row.crew_id = j.crew_id || null;
      rows.push(row);
    });
  });
  if (!rows.length) return Promise.resolve(0);
  return sb
    .from("visits")
    .upsert(rows, { onConflict: "job_id,orig_date", ignoreDuplicates: true })
    .then(function (r) {
      if (r.error) return 0;
      return loadVisits().then(function () {
        return rows.length;
      });
    });
}
function nextVisit(j) {
  var t = today(),
    a = visits
      .filter(function (v) {
        return v.job_id === j.id && v.status === "scheduled" && v.scheduled_date >= t;
      })
      .sort(function (x, y) {
        return x.scheduled_date < y.scheduled_date ? -1 : 1;
      });
  return a[0];
}
function cname(id) {
  var c = byId(clients, id);
  return c ? c.name : "(deleted client)";
}
function paddr(id) {
  var p = byId(props, id);
  return p ? p.address : "";
}

/* ---- Jobs list ---- */
function renderJobs() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var rec = jobs.filter(function (j) {
      return j.status === "active" && j.frequency !== "once";
    }),
    one = jobs.filter(function (j) {
      return j.status === "active" && j.frequency === "once";
    }),
    off = jobs.filter(function (j) {
      return j.status !== "active";
    });
  [
    ["active", "Recurring", rec.length],
    ["once", "One-time", one.length],
    ["inactive", "Paused / ended", off.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (jfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      jfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var tb = $("topbtns");
  tb.appendChild(
    btn("+ New job", "btn", function () {
      openJobForm(null, null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Services", "btn alt", openServices));
  var list = $("list");
  list.textContent = "";
  if (jobsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Jobs aren't set up yet. Run the Stage 2 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var shown = (jfilter === "active" ? rec : jfilter === "once" ? one : off).filter(function (j) {
    if (!query) return true;
    return [cname(j.client_id), j.title, paddr(j.property_id)].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!shown.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        jobs.length ? "Nothing here." : "No jobs yet. Add one here, or from a client's page."
      )
    );
    return;
  }
  shown.forEach(function (j) {
    var b = el("button", "row client");
    b.type = "button";
    var left = el("div");
    left.appendChild(el("b", null, cname(j.client_id) + " · " + j.title));
    left.appendChild(
      el(
        "div",
        "sub",
        [paddr(j.property_id), flabel(j.frequency), money(j.price)].filter(Boolean).join(" · ")
      )
    );
    var right = el("div");
    right.style.textAlign = "right";
    if (j.status !== "active")
      right.appendChild(el("span", "chip lost", j.status === "paused" ? "Paused" : "Ended"));
    else {
      var nv = nextVisit(j);
      right.appendChild(el("span", "chip", nv ? "Next: " + dshort(nv.scheduled_date) : "No visit set"));
    }
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openJob(j.id);
    });
    list.appendChild(b);
  });
}

/* ---- job detail ---- */
function openJob(id) {
  var j = byId(jobs, id);
  if (!j) return;
  var c = byId(clients, j.client_id),
    pr = byId(props, j.property_id),
    p = panel();
  p.appendChild(el("h2", null, j.title));
  p.appendChild(
    el(
      "div",
      "note",
      flabel(j.frequency) +
        " · " +
        money(j.price) +
        " per visit · " +
        (j.status === "active" ? "Active" : j.status === "paused" ? "Paused" : "Ended") +
        " · starts " +
        dshort(j.start_date) +
        (j.end_date ? " · ends " + dshort(j.end_date) : "")
    )
  );
  var who = el("div", "pcard");
  who.style.marginTop = "12px";
  if (c) {
    var cl = el("button", "link", c.name);
    cl.type = "button";
    cl.addEventListener("click", function () {
      openClient(c.id);
    });
    who.appendChild(cl);
  }
  if (pr) {
    var ad = el("div", null, pr.address);
    who.appendChild(ad);
    if (pr.notes) who.appendChild(el("div", "note", pr.notes));
    var m = el("a", "btn alt sm", "Map");
    m.href = mapsUrl(pr.address);
    m.target = "_blank";
    m.rel = "noopener";
    m.style.marginTop = "6px";
    who.appendChild(m);
  }
  p.appendChild(who);
  if (j.instructions) {
    var ins = el("div", "note", "Instructions: " + j.instructions);
    ins.style.cssText = "margin-top:8px;white-space:pre-wrap";
    p.appendChild(ins);
  }
  var acts = el("div", "contact");
  acts.appendChild(
    btn("Edit", "btn alt sm", function () {
      openJobForm(c, j);
    })
  );
  if (j.status === "active" && j.frequency !== "once")
    acts.appendChild(
      btn("Pause", "btn alt sm", function () {
        setJobStatus(j, "paused");
      })
    );
  if (j.status === "paused")
    acts.appendChild(
      btn("Resume", "btn sm", function () {
        setJobStatus(j, "active");
      })
    );
  if (j.status !== "ended")
    acts.appendChild(
      btn("End job", "btn alt sm", function () {
        if (confirm("End this job? Future visits will be removed; history stays.")) setJobStatus(j, "ended");
      })
    );
  else
    acts.appendChild(
      btn("Reactivate", "btn sm", function () {
        setJobStatus(j, "active");
      })
    );
  p.appendChild(acts);
  var sec = el("div", "sec");
  sec.appendChild(el("h3", null, "Visits"));
  p.appendChild(sec);
  var t = today(),
    mine = visits
      .filter(function (v) {
        return v.job_id === j.id;
      })
      .sort(function (a, b) {
        return a.scheduled_date < b.scheduled_date ? -1 : 1;
      });
  var upc = mine
      .filter(function (v) {
        return v.scheduled_date >= t || v.status === "scheduled";
      })
      .slice(0, 8),
    past = mine
      .filter(function (v) {
        return upc.indexOf(v) < 0;
      })
      .reverse()
      .slice(0, 6);
  if (!upc.length && !past.length) sec.appendChild(el("div", "note", "No visits yet."));
  function again() {
    render();
    openJob(j.id);
  }
  upc.forEach(function (v) {
    var cd = visitCard(v, again, false);
    var d = el("div", "note", dshort(v.scheduled_date));
    d.style.fontWeight = "700";
    cd.insertBefore(d, cd.firstChild);
    sec.appendChild(cd);
  });
  if (past.length) {
    var h = el("div", "note", "Recent history");
    h.style.margin = "10px 0 4px";
    sec.appendChild(h);
    past.forEach(function (v) {
      sec.appendChild(visitCard(v, again, false));
    });
  }
  var d = el("div", "actions");
  d.appendChild(el("span"));
  d.appendChild(
    btn("Delete job", "btn danger", function () {
      if (!confirm("Delete this job and all its visits for good? (End job keeps the history.)")) return;
      sb.from("jobs")
        .delete()
        .eq("id", j.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not delete.");
            return;
          }
          jobs = jobs.filter(function (z) {
            return z.id !== j.id;
          });
          visits = visits.filter(function (z) {
            return z.job_id !== j.id;
          });
          closeDetail();
          render();
        });
    })
  );
  p.appendChild(d);
}
function setJobStatus(j, s) {
  sb.from("jobs")
    .update({ status: s })
    .eq("id", j.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the job.");
        return;
      }
      j.status = s;
      var clear =
        s !== "active"
          ? sb
              .from("visits")
              .delete()
              .eq("job_id", j.id)
              .eq("status", "scheduled")
              .gte("scheduled_date", today())
          : Promise.resolve({});
      Promise.resolve(clear)
        .then(function () {
          return loadVisits();
        })
        .then(function () {
          return topUp();
        })
        .then(function () {
          render();
          openJob(j.id);
        });
    });
}

/* ---- job form ---- */
function openJobForm(client, job) {
  if (jobsErr) {
    needSql();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, job ? "Edit job" : "New job"));
  var active = clients.filter(function (c) {
    return !c.archived || (client && c.id === client.id);
  });
  if (!active.length) {
    p.appendChild(el("p", null, "Add a client first."));
    return;
  }
  var cid = job ? job.client_id : client ? client.id : active[0].id;
  var cs = fld(
    "Client",
    "select",
    cid,
    active.map(function (c) {
      return [c.id, dispName(c)];
    })
  );
  if (job || client) cs.input.disabled = true;
  var ps = fld("Property", "select", "", []);
  function fillProps() {
    ps.input.textContent = "";
    clientProps(cs.input.value).forEach(function (x) {
      var o = document.createElement("option");
      o.value = x.id;
      o.textContent = (x.label ? x.label + ": " : "") + x.address;
      ps.input.appendChild(o);
    });
    if (job && job.client_id === cs.input.value) ps.input.value = job.property_id;
  }
  cs.input.addEventListener("change", fillProps);
  fillProps();
  var svcs = services.filter(function (s) {
    return s.active !== false;
  });
  var sv = fld(
    "Service",
    "select",
    (job && job.service_id) || "",
    [["", "Custom / other"]].concat(
      svcs.map(function (s) {
        return [s.id, s.name];
      })
    )
  );
  var ti = fld("Job name", "text", job ? job.title : ""),
    pr = fld("Price per visit ($)", "number", job ? job.price : "");
  pr.input.step = "0.01";
  pr.input.min = "0";
  pr.input.inputMode = "decimal";
  var fq = fld("How often", "select", job ? job.frequency : "weekly", FREQ);
  var sd = fld("First visit / start date", "date", job ? job.start_date : today());
  var ed = fld("Ends on (optional)", "date", (job && job.end_date) || "");
  var ins = fld(
    "Instructions for the crew (gate, dogs, edging, etc.)",
    "textarea",
    job ? job.instructions : ""
  );
  var cw = null;
  if (s3 && crew.length) {
    cw = fld(
      "Assigned to",
      "select",
      (job && job.crew_id) || "",
      [["", "Me / unassigned"]].concat(
        crew
          .filter(function (c) {
            return c.active !== false;
          })
          .map(function (c) {
            return [c.id, c.name];
          })
      )
    );
  }
  var lastSvc = sv.input.value;
  sv.input.addEventListener("change", function () {
    var s = byId(services, sv.input.value),
      old = byId(services, lastSvc);
    if (s) {
      if (!ti.input.value.trim() || (old && ti.input.value === old.name)) ti.input.value = s.name;
      if (
        (!pr.input.value ||
          Number(pr.input.value) === 0 ||
          (old && Number(pr.input.value) === Number(old.default_price))) &&
        s.default_price != null
      )
        pr.input.value = s.default_price;
    }
    lastSvc = sv.input.value;
  });
  fq.input.addEventListener("change", function () {
    ed.hidden = fq.input.value === "once";
  });
  ed.hidden = fq.input.value === "once";
  p.appendChild(cs);
  p.appendChild(ps);
  p.appendChild(sv);
  p.appendChild(ti);
  var g = el("div", "grid2");
  g.appendChild(pr);
  g.appendChild(fq);
  g.appendChild(sd);
  g.appendChild(ed);
  p.appendChild(g);
  if (cw) p.appendChild(cw);
  p.appendChild(ins);
  var a = el("div", "actions");
  var save = btn("Save job", "btn", function () {
    if (!ps.input.value) {
      alert("This client needs a property first. Add one on the client page.");
      return;
    }
    if (!ti.input.value.trim()) {
      alert("Enter a job name.");
      return;
    }
    if (!sd.input.value) {
      alert("Pick a start date.");
      return;
    }
    var price = parseFloat(pr.input.value);
    if (isNaN(price) || price < 0) {
      alert("Enter the price per visit (0 if unknown).");
      return;
    }
    var once = fq.input.value === "once";
    var row = {
      client_id: cs.input.value,
      property_id: ps.input.value,
      service_id: sv.input.value || null,
      title: ti.input.value.trim(),
      price: price,
      frequency: fq.input.value,
      start_date: sd.input.value,
      end_date: !once && ed.input.value ? ed.input.value : null,
      instructions: ins.input.value.trim()
    };
    if (s3 && cw) row.crew_id = cw.input.value || null;
    save.disabled = true;
    if (!job) {
      sb.from("jobs")
        .insert(row)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            save.disabled = false;
            alert("Could not save the job.");
            return;
          }
          jobs.push(r.data);
          topUp().then(function () {
            render();
            openJob(r.data.id);
          });
        });
      return;
    }
    var sched =
      job.frequency !== row.frequency ||
      job.start_date !== row.start_date ||
      (job.end_date || null) !== row.end_date;
    sb.from("jobs")
      .update(row)
      .eq("id", job.id)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          save.disabled = false;
          alert("Could not save the job.");
          return;
        }
        Object.assign(job, r.data);
        var fut;
        if (sched && job.status === "active")
          fut = sb
            .from("visits")
            .delete()
            .eq("job_id", job.id)
            .eq("status", "scheduled")
            .gte("scheduled_date", today());
        else
          fut = sb
            .from("visits")
            .update(
              s3 && cw
                ? { price: job.price, property_id: job.property_id, crew_id: job.crew_id || null }
                : { price: job.price, property_id: job.property_id }
            )
            .eq("job_id", job.id)
            .eq("status", "scheduled")
            .gte("scheduled_date", today());
        Promise.resolve(fut)
          .then(function () {
            return loadVisits();
          })
          .then(function () {
            return topUp();
          })
          .then(function () {
            render();
            openJob(job.id);
          });
      });
  });
  a.appendChild(save);
  a.appendChild(
    btn("Cancel", "btn alt", function () {
      if (job) openJob(job.id);
      else closeDetail();
    })
  );
  p.appendChild(a);
}

/* ---- services catalog ---- */
function openServices() {
  if (jobsErr) {
    needSql();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Services"));
  p.appendChild(
    el(
      "p",
      "note",
      "Your menu of work. The default price fills in when you pick a service on a new job. Changing it later doesn't touch existing jobs."
    )
  );
  var holder = el("div");
  p.appendChild(holder);
  function row(s) {
    var box = el("div", "pcard"),
      g = el("div", "grid2");
    var n = fld("Name", "text", s ? s.name : ""),
      d = fld("Default price ($, optional)", "number", s && s.default_price != null ? s.default_price : "");
    d.input.step = "0.01";
    d.input.min = "0";
    d.input.inputMode = "decimal";
    g.appendChild(n);
    g.appendChild(d);
    box.appendChild(g);
    var a = el("div", "acts");
    a.appendChild(
      btn(s ? "Save" : "Add service", "btn sm", function () {
        var name = n.input.value.trim();
        if (!name) {
          alert("Enter a name.");
          return;
        }
        var price = d.input.value === "" ? null : parseFloat(d.input.value);
        if (price !== null && (isNaN(price) || price < 0)) {
          alert("Enter a valid price.");
          return;
        }
        var q = s
          ? sb.from("services").update({ name: name, default_price: price }).eq("id", s.id).select().single()
          : sb.from("services").insert({ name: name, default_price: price }).select().single();
        q.then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save. Is that name already in the list?");
            return;
          }
          if (s) Object.assign(s, r.data);
          else services.push(r.data);
          services.sort(function (x, y) {
            return x.name.localeCompare(y.name);
          });
          draw();
        });
      })
    );
    if (s)
      a.appendChild(
        btn("Delete", "btn danger sm", function () {
          if (!confirm("Delete this service? Jobs that use it keep their name and price.")) return;
          sb.from("services")
            .delete()
            .eq("id", s.id)
            .then(function (r) {
              if (r.error) {
                alert("Could not delete.");
                return;
              }
              services = services.filter(function (z) {
                return z.id !== s.id;
              });
              draw();
            });
        })
      );
    box.appendChild(a);
    return box;
  }
  function draw() {
    holder.textContent = "";
    services.forEach(function (s) {
      holder.appendChild(row(s));
    });
    var h = el("div", "note", "Add a new service");
    h.style.margin = "14px 0 6px";
    holder.appendChild(h);
    holder.appendChild(row(null));
  }
  draw();
}

/* ---- jobs on the client page ---- */
function clientJobsSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Jobs");
  h.appendChild(
    btn("+ New job", "btn alt sm", function () {
      if (!clientProps(c.id).length) {
        alert("Add a property (service address) first.");
        return;
      }
      openJobForm(c, null);
    })
  );
  sec.appendChild(h);
  var mine = jobs.filter(function (j) {
    return j.client_id === c.id;
  });
  if (jobsErr) sec.appendChild(el("div", "note", "Run the Stage 2 SQL in Supabase to turn on jobs."));
  else if (!mine.length) sec.appendChild(el("div", "note", "No jobs yet."));
  mine.forEach(function (j) {
    var card = el("div", "pcard");
    card.appendChild(el("b", null, j.title));
    var nv = j.status === "active" ? nextVisit(j) : null;
    card.appendChild(
      el(
        "div",
        "note",
        [
          flabel(j.frequency),
          money(j.price),
          j.status !== "active"
            ? j.status === "paused"
              ? "Paused"
              : "Ended"
            : nv
              ? "Next: " + dshort(nv.scheduled_date)
              : ""
        ]
          .filter(Boolean)
          .join(" · ")
      )
    );
    var a = el("div", "acts");
    a.appendChild(
      btn("Open", "btn alt sm", function () {
        openJob(j.id);
      })
    );
    card.appendChild(a);
    sec.appendChild(card);
  });
  return sec;
}

/* ---- job history on the client page (all-time, not just recent) ---- */
function historySection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Job history");
  sec.appendChild(h);
  var body = el("div");
  sec.appendChild(body);
  if (jobsErr) {
    body.appendChild(el("div", "note", "Run the Stage 2 SQL in Supabase to turn on job history."));
    return sec;
  }
  body.appendChild(el("div", "note", "Loading..."));
  sb.from("visits")
    .select("*")
    .eq("client_id", c.id)
    .order("scheduled_date", { ascending: false })
    .limit(1000)
    .then(function (r) {
      body.textContent = "";
      if (r.error) {
        body.appendChild(el("div", "note", "Could not load history."));
        return;
      }
      var all = (r.data || [])
        .filter(function (v) {
          return v.status !== "scheduled";
        })
        .sort(function (a, b) {
          return a.scheduled_date < b.scheduled_date ? 1 : -1;
        });
      if (!all.length) {
        body.appendChild(
          el("div", "note", "No completed work yet. Visits show up here once you mark them Done.")
        );
        return;
      }
      var done = all.filter(function (v) {
          return v.status === "done";
        }),
        total = done.reduce(function (s, v) {
          return s + Number(v.price || 0);
        }, 0);
      var sum = el(
        "div",
        "note",
        done.length +
          " visit" +
          (done.length === 1 ? "" : "s") +
          " completed · " +
          money(total) +
          " total" +
          (all.length > done.length ? " · " + (all.length - done.length) + " skipped" : "") +
          (done[0] ? " · last: " + dshort(done[0].scheduled_date) : "")
      );
      sum.style.cssText = "margin-bottom:8px;font-weight:700";
      body.appendChild(sum);
      var list = el("div");
      body.appendChild(list);
      var shown = 0;
      function more(n) {
        all.slice(shown, shown + n).forEach(function (v) {
          var j = byId(jobs, v.job_id),
            row = el("div", "pcard");
          row.style.cssText =
            "display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:" +
            (j ? "pointer" : "default");
          var l = el("div");
          l.appendChild(el("b", null, dshort(v.scheduled_date) + " · " + (j ? j.title : "(deleted job)")));
          l.appendChild(
            el("div", "note", [paddr(v.property_id), money(v.price)].filter(Boolean).join(" · "))
          );
          var rt = el(
            "span",
            "chip " + (v.status === "done" ? "won" : "lost"),
            v.status === "done" ? "Done" : "Skipped"
          );
          row.appendChild(l);
          row.appendChild(rt);
          if (j)
            row.addEventListener("click", function () {
              openJob(j.id);
            });
          list.appendChild(row);
        });
        shown = Math.min(all.length, shown + n);
        mb.hidden = shown >= all.length;
      }
      var mb = btn("Show more", "btn alt sm", function () {
        more(50);
      });
      body.appendChild(mb);
      more(15);
    });
  return sec;
}

/* ======================= crm/src/08-schedule.js ======================= */
/* Schedule tab: visit cards, day/week/month views, weather delays and smart catch-up. */

/* ---- visit card (used in Schedule and in job detail) ---- */
/* A completed visit with no price can't be billed. These controls fix it on the spot: set a price, or mark it "No charge" (kept in the history, never billed). */
function noPrice(v) {
  return v.status === "done" && !v.invoice_id && !v.paid_at && !(Number(v.price) > 0);
}
function priceFix(v, after) {
  var w = el("div");
  w.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px";
  var inp = document.createElement("input");
  inp.type = "number";
  inp.step = "0.01";
  inp.min = "0";
  inp.inputMode = "decimal";
  inp.placeholder = "Price $";
  inp.style.cssText = "width:96px";
  inp.setAttribute("aria-label", "Price for this visit");
  w.appendChild(inp);
  w.appendChild(
    btn("Set price", "btn sm", function () {
      var n = parseFloat(inp.value);
      if (!(n > 0)) {
        alert("Enter the price for this visit.");
        return;
      }
      sb.from("visits")
        .update({ price: n })
        .eq("id", v.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not save the price.");
            return;
          }
          v.price = n;
          loadUnbilled().then(after);
        });
    })
  );
  w.appendChild(
    btn("Invoice as $0 (no charge)", "btn alt sm", function () {
      if (
        !confirm(
          "Create a $0 invoice for this visit? It is kept as a paid, no-charge record in the client's invoice history."
        )
      )
        return;
      createInvoice(v.client_id, [v], today()).then(
        function (inv) {
          return loadUnbilled().then(function () {
            render();
            openInvoice(inv.id);
          });
        },
        function (e) {
          alert(e);
        }
      );
    })
  );
  return w;
}
function visitCard(v, after, showJob, opts) {
  opts = opts || {};
  var j = byId(jobs, v.job_id),
    card = el("div", "pcard"),
    top = el("div");
  top.style.cssText = "display:flex;justify-content:space-between;gap:8px";
  var l = el("div");
  l.appendChild(
    el("b", null, (opts.num ? opts.num + ". " : "") + cname(v.client_id) + (j ? " · " + j.title : ""))
  );
  l.appendChild(el("div", "note", [paddr(v.property_id), money(v.price)].filter(Boolean).join(" · ")));
  if (opts.detail) {
    var pp = byId(props, v.property_id),
      tips = [pp && pp.notes, j && j.instructions].filter(Boolean).join("  |  ");
    if (tips) {
      var tn = el("div", "note", "⚠ " + tips);
      tn.style.cssText = "color:#7a5b00;white-space:pre-wrap";
      l.appendChild(tn);
    }
  }
  if (s3 && crew.length && v.crew_id && crewName(v.crew_id))
    l.appendChild(el("div", "note", "Crew: " + crewName(v.crew_id)));
  if (v.status !== "scheduled" || showJob === false)
    l.appendChild(el("div", "note", dshort(v.scheduled_date)));
  if (v.status === "scheduled" && v.weather_from) {
    var wn = el("div", "note", "Moved by weather from " + dshort(v.weather_from));
    wn.style.color = "#1f5f9a";
    l.appendChild(wn);
  }
  top.appendChild(l);
  if (v.status !== "scheduled")
    top.appendChild(
      el("span", "chip " + (v.status === "done" ? "won" : "lost"), v.status === "done" ? "Done" : "Skipped")
    );
  if (!billErr && noPrice(v)) {
    var npc = el("span", "chip od", "\u26a0 No price");
    npc.title = "This visit can't be billed until it has a price";
    npc.style.marginLeft = "6px";
    top.appendChild(npc);
  }
  card.appendChild(top);
  var a = el("div", "acts");
  function patch(p, cb) {
    function fin() {
      if (cb) {
        cb();
        return;
      }
      if (!billErr && (p.status !== undefined || p.paid_at !== undefined)) loadUnbilled().then(after);
      else after();
    }
    sb.from("visits")
      .update(p)
      .eq("id", v.id)
      .then(function (r) {
        if (r.error) {
          alert("Could not save that.");
          return;
        }
        Object.assign(v, p);
        if (
          j &&
          j.frequency === "once" &&
          (p.status === "done" || p.status === "skipped") &&
          j.status === "active"
        ) {
          sb.from("jobs")
            .update({ status: "ended" })
            .eq("id", j.id)
            .then(function () {
              j.status = "ended";
              fin();
            });
          return;
        }
        if (j && j.frequency === "once" && p.status === "scheduled" && j.status === "ended") {
          sb.from("jobs")
            .update({ status: "active" })
            .eq("id", j.id)
            .then(function () {
              j.status = "active";
              fin();
            });
          return;
        }
        fin();
      });
  }
  function btns() {
    a.textContent = "";
    if (v.status === "scheduled") {
      a.appendChild(
        btn("Done", "btn sm", function () {
          var pp = { status: "done", completed_at: new Date().toISOString() };
          if (!billErr && !(Number(v.price) > 0)) {
            var ans = prompt(
              "This visit has no price yet, so it can't be billed. Enter the price for this visit, or leave it blank to set it later:",
              ""
            );
            var n = ans == null ? NaN : parseFloat(ans);
            if (n > 0) pp.price = n;
          }
          patch(pp);
        })
      );
      a.appendChild(
        btn("Skip", "btn alt sm", function () {
          patch(
            wxOn() ? { status: "skipped", weather_from: null, weather_batch: null } : { status: "skipped" }
          );
        })
      );
      a.appendChild(
        btn("Move", "btn alt sm", function () {
          a.textContent = "";
          var di = document.createElement("input");
          di.type = "date";
          di.value = v.scheduled_date;
          di.style.width = "auto";
          a.appendChild(di);
          a.appendChild(
            btn("Save date", "btn sm", function () {
              if (!di.value) return;
              var nd = di.value,
                od = v.scheduled_date,
                pp = { scheduled_date: nd };
              if (wxOn()) {
                pp.weather_from = null;
                pp.weather_batch = null;
              }
              if (remOn()) pp.reminded_at = null;
              patch(
                pp,
                nd > od
                  ? function () {
                      catchup([v], "m|" + Date.now(), after);
                    }
                  : null
              );
            })
          );
          a.appendChild(btn("Cancel", "btn alt sm", btns));
        })
      );
    } else {
      if (!v.invoice_id && !v.paid_at)
        a.appendChild(
          btn("Undo", "btn alt sm", function () {
            patch({ status: "scheduled", completed_at: null });
          })
        );
      if (!billErr && noPrice(v)) card.appendChild(priceFix(v, after));
      if (!billErr && v.status === "done") {
        if (v.invoice_id) {
          var oi = el("span", "note", "On an invoice");
          oi.style.alignSelf = "center";
          a.appendChild(oi);
        } else if (v.paid_at) {
          var pn = el("span", "chip won", "Paid" + (v.paid_method ? " · " + v.paid_method : ""));
          pn.style.alignSelf = "center";
          a.appendChild(pn);
          a.appendChild(
            btn("Undo paid", "btn alt sm", function () {
              patch({ paid_at: null, paid_method: "" });
            })
          );
        } else {
          var pl = el("span", "note", "Paid at visit:");
          pl.style.alignSelf = "center";
          a.appendChild(pl);
          ["Cash", "Zelle", "Check"].forEach(function (m) {
            a.appendChild(
              btn(m, "btn alt sm", function () {
                patch({ paid_at: new Date().toISOString(), paid_method: m });
              })
            );
          });
        }
      }
    }
    if (!photoErr && v.status !== "skipped") {
      var pb = btn("Photo", "btn alt sm", function () {
        pickPhotos(true, function (fs) {
          pb.textContent = "Uploading...";
          uploadMany(fs, {
            client_id: v.client_id,
            property_id: v.property_id,
            visit_id: v.id,
            kind: v.status === "done" ? "after" : "before"
          }).then(function (res) {
            pb.textContent = res.ok ? "Photo added ✓" : "Photo";
            var msg = uploadMsg(res);
            if (msg) alert(msg);
            render();
          });
        });
      });
      a.appendChild(pb);
    }
    var pr = byId(props, v.property_id);
    if (pr) {
      var m = el("a", "btn alt sm", "Map");
      m.href = mapsUrl(pr.address);
      m.target = "_blank";
      m.rel = "noopener";
      a.appendChild(m);
    }
    if (showJob !== false && j)
      a.appendChild(
        btn("Job", "btn alt sm", function () {
          openJob(j.id);
        })
      );
    if (opts.up !== undefined || opts.down !== undefined) {
      var u = btn("▲", "btn alt sm", opts.up || null);
      u.disabled = !opts.up;
      u.setAttribute("aria-label", "Move earlier");
      var dn2 = btn("▼", "btn alt sm", opts.down || null);
      dn2.disabled = !opts.down;
      dn2.setAttribute("aria-label", "Move later");
      a.appendChild(u);
      a.appendChild(dn2);
    }
    if (s3 && crew.length && v.status === "scheduled") {
      var sel = document.createElement("select");
      sel.style.cssText = "width:auto;padding:6px 8px;font-size:.88rem";
      sel.setAttribute("aria-label", "Assign to");
      [["", "Me / unassigned"]]
        .concat(
          crew
            .filter(function (c) {
              return c.active !== false;
            })
            .map(function (c) {
              return [c.id, c.name];
            })
        )
        .forEach(function (o) {
          var op = document.createElement("option");
          op.value = o[0];
          op.textContent = o[1];
          sel.appendChild(op);
        });
      sel.value = v.crew_id || "";
      sel.addEventListener("change", function () {
        patch({ crew_id: sel.value || null });
      });
      a.appendChild(sel);
    }
  }
  btns();
  card.appendChild(a);
  return card;
}

/* ---- Schedule: Today/Day, Week, Month, Upcoming, Overdue, Done ---- */
var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function mondayOf(s) {
  var d = pd(s),
    k = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - k);
  return ymd(d);
}
function longDate(s) {
  return pd(s).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
function monthName(s) {
  return pd(s).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function onDay(d) {
  return visits.filter(function (v) {
    return v.scheduled_date === d;
  });
}
function crewName(id) {
  var c = byId(crew, id);
  return c ? c.name : "";
}
function crewOk(v) {
  return crewF === "all" || (crewF === "none" ? !v.crew_id : v.crew_id === crewF);
}
function dayOrder(a, b) {
  var sa = a.status === "scheduled" ? 0 : 1,
    sb2 = b.status === "scheduled" ? 0 : 1;
  if (sa !== sb2) return sa - sb2;
  if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0);
  return cname(a.client_id).localeCompare(cname(b.client_id));
}
function ensureFrom(d) {
  if (d >= histFrom) return Promise.resolve();
  return sb
    .from("visits")
    .select("*")
    .gte("scheduled_date", d)
    .lt("scheduled_date", histFrom)
    .limit(5000)
    .then(function (r) {
      if (!r.error) {
        visits = visits.concat(r.data || []);
        histFrom = d;
      }
    });
}
function crewChips(list) {
  if (!s3 || !crew.length) return;
  var row = el("div", "tabs");
  row.style.marginTop = "8px";
  [
    ["all", "Everyone"],
    ["none", "Me"]
  ]
    .concat(
      crew.map(function (c) {
        return [c.id, c.name];
      })
    )
    .forEach(function (x) {
      var b = el("button", "tab" + (crewF === x[0] ? " on" : ""), x[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        crewF = x[0];
        render();
      });
      row.appendChild(b);
    });
  list.appendChild(row);
}
function calNav(title, prev, next, todayFn, showToday) {
  var n = el("div", "calnav");
  n.appendChild(btn("‹", "btn alt sm", prev));
  var b = el("b", null, title);
  n.appendChild(b);
  n.appendChild(btn("›", "btn alt sm", next));
  if (showToday) n.appendChild(btn("Today", "btn alt sm", todayFn));
  return n;
}

function renderSchedule() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var t = today();
  var up = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date >= t;
    }),
    od = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date < t;
    }),
    dn = visits.filter(function (v) {
      return v.status !== "scheduled";
    });
  [
    ["day", selDate === t ? "Today" : "Day", -1],
    ["week", "Week", -1],
    ["month", "Month", -1],
    ["upcoming", "Upcoming", up.length],
    ["overdue", "Overdue", od.length],
    ["done", "Done", dn.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (smode === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    if (s[2] >= 0) b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      smode = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  if (s3 && isOwner()) $("topbtns").appendChild(btn("Crew", "btn alt", openCrew));
  var list = $("list");
  list.textContent = "";
  if (jobsErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "The schedule isn't set up yet. Run the Stage 2 SQL in Supabase, then press Refresh."
      )
    );
    return;
  }
  if (smode === "day") return renderDay(list, od.length);
  if (smode === "week") return renderWeek(list);
  if (smode === "month") return renderMonth(list);
  var set = smode === "upcoming" ? up : smode === "overdue" ? od : dn;
  set = set.filter(function (v) {
    if (!query) return true;
    var j = byId(jobs, v.job_id);
    return (
      [cname(v.client_id), paddr(v.property_id), j ? j.title : ""].join(" ").toLowerCase().indexOf(query) > -1
    );
  });
  set.sort(function (a, b) {
    return smode === "done"
      ? a.scheduled_date < b.scheduled_date
        ? 1
        : -1
      : a.scheduled_date < b.scheduled_date
        ? -1
        : 1;
  });
  if (smode === "done") set = set.slice(0, 150);
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        smode === "upcoming"
          ? "Nothing scheduled. Add a job to a client and its visits appear here."
          : smode === "overdue"
            ? "Nothing overdue. Nice."
            : "No completed visits yet."
      )
    );
    return;
  }
  var groups = {},
    order = [];
  set.forEach(function (v) {
    if (!groups[v.scheduled_date]) {
      groups[v.scheduled_date] = [];
      order.push(v.scheduled_date);
    }
    groups[v.scheduled_date].push(v);
  });
  order.forEach(function (d) {
    var g = groups[d],
      box = el("div"),
      h = el(
        "h3",
        null,
        dlabel(d) +
          "  ·  " +
          g.length +
          " stop" +
          (g.length > 1 ? "s" : "") +
          "  ·  " +
          money(
            g.reduce(function (s, v) {
              return s + Number(v.price || 0);
            }, 0)
          )
      );
    h.style.cssText =
      "margin:14px 0 6px;font-size:.98rem;color:var(--forest);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap";
    var go = btn("Open day", "btn alt sm", function () {
      selDate = d;
      smode = "day";
      render();
    });
    h.appendChild(go);
    if (smode !== "done") {
      h.appendChild(
        btn("Push to next day", "btn alt sm", function () {
          pushDay(d, g.length);
        })
      );
    }
    box.appendChild(h);
    g.forEach(function (v) {
      box.appendChild(
        visitCard(v, function () {
          render();
        })
      );
    });
    list.appendChild(box);
  });
}

function routeUrl(stops) {
  var addrs = stops
    .map(function (v) {
      return paddr(v.property_id);
    })
    .filter(Boolean)
    .slice(0, 10);
  if (!addrs.length) return "";
  var dest = addrs[addrs.length - 1],
    w = addrs.slice(0, -1);
  return (
    "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" +
    encodeURIComponent(dest) +
    (w.length ? "&waypoints=" + encodeURIComponent(w.join("|")) : "")
  );
}
function moveVisit(v, dir, filtered) {
  var ds = onDay(v.scheduled_date)
    .filter(function (x) {
      return x.status === "scheduled";
    })
    .sort(dayOrder);
  var fi = filtered.indexOf(v),
    nb = filtered[fi + dir];
  if (!nb) return;
  var i = ds.indexOf(v),
    j = ds.indexOf(nb);
  ds[i] = nb;
  ds[j] = v;
  var jobsToDo = [];
  ds.forEach(function (x, k) {
    var n = k * 10;
    if ((x.sort_order || 0) !== n) {
      x.sort_order = n;
      jobsToDo.push(sb.from("visits").update({ sort_order: n }).eq("id", x.id));
    }
  });
  Promise.all(jobsToDo).then(function (rs) {
    if (
      rs.some(function (r) {
        return r.error;
      })
    )
      alert("Could not save the new order.");
    render();
  });
}

function renderDay(list, odCount) {
  var d = selDate,
    t = today();
  list.appendChild(
    calNav(
      longDate(d),
      function () {
        selDate = addDays(d, -1);
        render();
      },
      function () {
        selDate = addDays(d, 1);
        render();
      },
      function () {
        selDate = t;
        render();
      },
      d !== t
    )
  );
  var di = document.createElement("input");
  di.type = "date";
  di.value = d;
  di.style.cssText = "width:auto;margin-left:auto";
  di.setAttribute("aria-label", "Jump to date");
  di.addEventListener("change", function () {
    if (di.value) {
      selDate = di.value;
      render();
    }
  });
  list.lastChild.appendChild(di);
  if (d === t && odCount) {
    var ob = btn(
      odCount + " overdue visit" + (odCount > 1 ? "s" : "") + " need attention. Tap to review.",
      "btn alt",
      function () {
        smode = "overdue";
        render();
      }
    );
    ob.style.cssText = "margin-bottom:10px;border-color:#b3261e;color:#b3261e;width:100%";
    list.appendChild(ob);
  }
  crewChips(list);
  wxBanners(list, d);
  var all = onDay(d).filter(crewOk).sort(dayOrder),
    sched = all.filter(function (v) {
      return v.status === "scheduled";
    });
  if (!all.length) {
    list.appendChild(el("div", "empty", "Nothing scheduled for this day."));
    return;
  }
  var done = all.filter(function (v) {
      return v.status === "done";
    }).length,
    total = all.reduce(function (s, v) {
      return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
    }, 0);
  var sum = el("div", "daysum");
  sum.appendChild(
    el(
      "b",
      null,
      all.length +
        " stop" +
        (all.length > 1 ? "s" : "") +
        " · " +
        money(total) +
        (done ? " · " + done + " done" : "")
    )
  );
  var bt = el("span");
  if (sched.length) {
    var ru = routeUrl(sched);
    if (ru) {
      var a = el("a", "btn sm", "Start route");
      a.href = ru;
      a.target = "_blank";
      a.rel = "noopener";
      bt.appendChild(a);
      bt.appendChild(document.createTextNode(" "));
    }
    if (s3 && isOwner()) {
      bt.appendChild(
        btn("Send route", "btn alt sm", function () {
          openSendRoute(d);
        })
      );
      bt.appendChild(document.createTextNode(" "));
    }
    bt.appendChild(
      btn("Reminders", "btn alt sm", function () {
        remindPanel(sched, "visit", "Reminders · " + dlabel(d));
      })
    );
    bt.appendChild(document.createTextNode(" "));
    bt.appendChild(
      btn("Weather delay", "btn alt sm", function () {
        openWeather(d);
      })
    );
  }
  sum.appendChild(bt);
  list.appendChild(sum);
  if (sched.length > 10)
    list.appendChild(el("div", "note", "The route link covers the first 10 stops in your order."));
  all.forEach(function (v) {
    var idx = sched.indexOf(v),
      opts = { detail: true };
    if (s3 && idx > -1) {
      opts.up =
        idx > 0
          ? function () {
              moveVisit(v, -1, sched);
            }
          : null;
      opts.down =
        idx < sched.length - 1
          ? function () {
              moveVisit(v, 1, sched);
            }
          : null;
      opts.num = idx + 1;
    }
    list.appendChild(
      visitCard(
        v,
        function () {
          render();
        },
        true,
        opts
      )
    );
  });
}

function renderWeek(list) {
  var ws = mondayOf(selDate),
    we = addDays(ws, 6),
    t = today();
  list.appendChild(
    calNav(
      pd(ws).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " – " +
        pd(we).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      function () {
        selDate = addDays(ws, -7);
        render();
      },
      function () {
        selDate = addDays(ws, 7);
        render();
      },
      function () {
        selDate = t;
        render();
      },
      !(t >= ws && t <= we)
    )
  );
  if (ws < histFrom) {
    ensureFrom(ws).then(function () {
      if (smode === "week") render();
    });
  }
  crewChips(list);
  var g = el("div", "weekgrid");
  for (var i = 0; i < 7; i++) {
    (function (d, i) {
      var vs = onDay(d).filter(crewOk).sort(dayOrder),
        col = el("div", "daycol" + (d === t ? " today" : "") + (i >= 5 ? " wkend" : ""));
      var h = el("button", "dayhd");
      h.type = "button";
      h.appendChild(el("b", null, DOW[i] + " " + pd(d).getDate()));
      var tot = vs.reduce(function (s, v) {
        return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
      }, 0);
      h.appendChild(
        el(
          "span",
          null,
          vs.length ? vs.length + " stop" + (vs.length > 1 ? "s" : "") + " · " + money(tot) : "—"
        )
      );
      h.addEventListener("click", function () {
        selDate = d;
        smode = "day";
        render();
      });
      col.appendChild(h);
      vs.slice(0, 8).forEach(function (v) {
        var b = el("button", "vline " + v.status);
        b.type = "button";
        b.textContent =
          cname(v.client_id) +
          (v.crew_id && crewName(v.crew_id) ? " (" + crewName(v.crew_id).split(" ")[0] + ")" : "");
        b.addEventListener("click", function () {
          selDate = d;
          smode = "day";
          render();
        });
        col.appendChild(b);
      });
      if (vs.length > 8) col.appendChild(el("div", "note", "+" + (vs.length - 8) + " more"));
      g.appendChild(col);
    })(addDays(ws, i), i);
  }
  list.appendChild(g);
}

function renderMonth(list) {
  var first = selDate.slice(0, 8) + "01",
    t = today(),
    gs = mondayOf(first);
  list.appendChild(
    calNav(
      monthName(first),
      function () {
        selDate = addDays(first, -1).slice(0, 8) + "01";
        render();
      },
      function () {
        selDate = addDays(first, 32).slice(0, 8) + "01";
        render();
      },
      function () {
        selDate = t;
        render();
      },
      t.slice(0, 7) !== first.slice(0, 7)
    )
  );
  if (gs < histFrom) {
    ensureFrom(gs).then(function () {
      if (smode === "month") render();
    });
  }
  crewChips(list);
  var g = el("div", "monthgrid");
  DOW.forEach(function (n) {
    g.appendChild(el("div", "mh", n));
  });
  for (var i = 0; i < 42; i++) {
    (function (d) {
      if (i >= 35 && d.slice(0, 7) !== first.slice(0, 7)) return;
      var vs = onDay(d).filter(crewOk),
        cell = el(
          "button",
          "mcell" + (d.slice(0, 7) !== first.slice(0, 7) ? " other" : "") + (d === t ? " today" : "")
        );
      cell.type = "button";
      cell.appendChild(el("span", "mn", String(pd(d).getDate())));
      if (vs.length) {
        cell.appendChild(el("span", "mc", vs.length + (vs.length > 1 ? " stops" : " stop")));
        cell.appendChild(
          el(
            "span",
            "mt",
            money(
              vs.reduce(function (s, v) {
                return s + (v.status === "skipped" ? 0 : Number(v.price || 0));
              }, 0)
            )
          )
        );
      }
      cell.addEventListener("click", function () {
        selDate = d;
        smode = "day";
        render();
      });
      g.appendChild(cell);
    })(addDays(gs, i));
  }
  list.appendChild(g);
}
function wxOn() {
  return visits.some(function (v) {
    return "weather_batch" in v;
  });
}
function gk(v) {
  return v.weather_batch ? String(v.weather_batch).split("#")[0] : "L|" + v.weather_from;
}
function ddiff(a, b) {
  return Math.round((pd(b) - pd(a)) / 86400000);
}

/* Weather delay: pick "just this day" or roll the next few days forward too. Every moved stop remembers where it came from so one tap can undo it. */
function openWeather(d) {
  var p = panel();
  p.appendChild(el("h2", null, "Weather delay"));
  p.appendChild(
    el(
      "p",
      "note",
      "Moves scheduled stops to the following day. Done and skipped stops stay put. Rolling forward keeps your route order and stops days from piling up on top of each other. You can undo it afterward."
    )
  );
  var lab = el("label", null, "How many days?"),
    sel = document.createElement("select");
  for (var n = 0; n <= 6; n++) {
    var o = document.createElement("option");
    o.value = n;
    o.textContent =
      n === 0
        ? "Just this day (" + dlabel(d) + ")"
        : "This day and the next " + n + " day" + (n > 1 ? "s" : "") + " (rolls everything forward)";
    sel.appendChild(o);
  }
  lab.appendChild(sel);
  p.appendChild(lab);
  var pv = el("div", "note");
  pv.style.cssText = "margin:10px 0;white-space:pre-line";
  p.appendChild(pv);
  function cnt(day) {
    return onDay(day).filter(function (v) {
      return v.status === "scheduled";
    }).length;
  }
  function prev() {
    var n = +sel.value,
      ls = [],
      tot = 0;
    for (var i = 0; i <= n; i++) {
      var day = addDays(d, i),
        c = cnt(day);
      tot += c;
      ls.push(dshort(day) + ": " + c + " stop" + (c === 1 ? "" : "s") + " → " + dshort(addDays(day, 1)));
    }
    pv.textContent = ls.join("\n");
    go.disabled = !tot;
    go.textContent = tot ? "Delay " + tot + " stop" + (tot > 1 ? "s" : "") : "Nothing to move";
  }
  var go = btn("Delay", "btn", function () {
    go.disabled = true;
    doDelay(d, +sel.value);
  });
  go.style.marginTop = "6px";
  sel.addEventListener("change", prev);
  p.appendChild(go);
  prev();
}
function doDelay(d, n) {
  var key = "w|" + d + "|" + Date.now(),
    chain = Promise.resolve(null);
  for (var i = n; i >= 0; i--) {
    (function (day) {
      chain = chain.then(function (err) {
        if (err) return err;
        return sb
          .from("visits")
          .update(
            Object.assign(
              { scheduled_date: addDays(day, 1), weather_from: day, weather_batch: key },
              remOn() ? { reminded_at: null } : {}
            )
          )
          .eq("scheduled_date", day)
          .eq("status", "scheduled")
          .then(function (r) {
            return r.error || null;
          });
      });
    })(addDays(d, i));
  }
  chain.then(function (err) {
    if (err) {
      closeDetail();
      alert(
        /weather_/.test(err.message || "")
          ? "Weather delay needs a one-time setup. Run the weather SQL in Supabase (SQL Editor), then try again."
          : "Something went wrong while moving the stops. Check the schedule; Undo weather delay will put back anything that moved."
      );
      loadVisits().then(render);
      return;
    }
    loadVisits().then(function () {
      closeDetail();
      render();
      catchup(
        visits.filter(function (v) {
          return v.weather_batch === key && v.status === "scheduled";
        }),
        key,
        function () {
          render();
          remindPanel(
            visits.filter(function (v) {
              return v.weather_batch === key && v.status === "scheduled";
            }),
            "delay",
            "Let clients know"
          );
        }
      );
    });
  });
}
function undoWeather(key) {
  var vs = visits.filter(function (v) {
    return v.weather_from && gk(v) === key && (v.status === "scheduled" || v.status === "skipped");
  });
  if (!vs.length) return;
  if (
    !confirm(
      "Put " +
        vs.length +
        " visit" +
        (vs.length > 1 ? "s" : "") +
        " back on their original days (including any catch-up changes made with this)?"
    )
  )
    return;
  var by = {};
  vs.forEach(function (v) {
    (by[v.weather_from] = by[v.weather_from] || []).push(v.id);
  });
  Promise.all(
    Object.keys(by).map(function (f) {
      return sb
        .from("visits")
        .update({ scheduled_date: f, weather_from: null, weather_batch: null, status: "scheduled" })
        .in("id", by[f]);
    })
  ).then(function (rs) {
    if (
      rs.some(function (r) {
        return r.error;
      })
    )
      alert("Could not undo everything.");
    loadVisits().then(render);
  });
}
function wxBanners(list, d) {
  var g = {};
  visits.forEach(function (v) {
    if (!v.weather_from) return;
    var rst = /#R$/.test(v.weather_batch || "");
    if (v.status === "skipped" && !v.weather_batch) return;
    if (v.status !== "scheduled" && v.status !== "skipped") return;
    if (v.status === "scheduled" && v.scheduled_date === v.weather_from) return;
    var k = gk(v),
      x = (g[k] = g[k] || { moved: 0, adj: 0, first: null, hit: false });
    if (v.status === "skipped" || rst) x.adj++;
    else {
      x.moved++;
      if (!x.first || v.weather_from < x.first) x.first = v.weather_from;
    }
    if (v.weather_from === d || v.scheduled_date === d) x.hit = true;
  });
  Object.keys(g)
    .sort()
    .forEach(function (k) {
      var x = g[k];
      if (!x.hit) return;
      var man = k.charAt(0) === "m",
        t = man
          ? "↔ Catch-up change: " + x.adj + " visit" + (x.adj > 1 ? "s" : "") + " adjusted."
          : "☔ Weather delay" +
            (x.first ? " from " + dshort(x.first) : "") +
            ": " +
            x.moved +
            " stop" +
            (x.moved === 1 ? "" : "s") +
            " moved" +
            (x.adj ? " · " + x.adj + " catch-up change" + (x.adj > 1 ? "s" : "") : "") +
            ".";
      var b = el("div", "wxbar");
      b.appendChild(el("span", null, t));
      b.appendChild(
        btn(man ? "Undo" : "Undo weather delay", "btn alt sm", function () {
          undoWeather(k);
        })
      );
      list.appendChild(b);
    });
}

/* Smart catch-up: after a repeating (weekly / every 2 weeks) visit is pushed later, check whether the next one is now too close. */
function catchup(moved, key, after) {
  var cons = [],
    seen = {};
  moved
    .slice()
    .sort(function (a, b) {
      return a.orig_date < b.orig_date ? -1 : 1;
    })
    .forEach(function (mv) {
      var jb = byId(jobs, mv.job_id);
      if (
        !jb ||
        jb.status !== "active" ||
        (jb.frequency !== "weekly" && jb.frequency !== "biweekly") ||
        seen[jb.id]
      )
        return;
      seen[jb.id] = 1;
      var iv = jb.frequency === "weekly" ? 7 : 14,
        nx = visits
          .filter(function (v) {
            return (
              v.job_id === jb.id && v.status === "scheduled" && v.id !== mv.id && v.orig_date > mv.orig_date
            );
          })
          .sort(function (a, b) {
            return a.orig_date < b.orig_date ? -1 : 1;
          })[0];
      if (!nx) return;
      var gap = ddiff(mv.scheduled_date, nx.scheduled_date);
      if (gap <= Math.floor(iv / 2)) cons.push({ mv: mv.id, nx: nx.id, job: jb, iv: iv, gap: gap });
    });
  if (!cons.length) {
    after();
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Catch-up check"));
  p.appendChild(
    el(
      "p",
      "note",
      "These repeating jobs now have a cut very close to the next one. Choose what to do for each. Leaving it alone keeps both visits."
    )
  );
  var cards = [];
  function act(c, kind, card, row) {
    var mv = byId(visits, c.mv),
      nx = byId(visits, c.nx);
    if (!mv || !nx) return Promise.resolve();
    var f = wxOn() ? { weather_from: nx.scheduled_date, weather_batch: key } : {},
      ps;
    if (kind === "skip") {
      ps = [
        sb
          .from("visits")
          .update(Object.assign({ status: "skipped" }, f))
          .eq("id", nx.id)
      ];
    } else {
      var delta = ddiff(nx.scheduled_date, addDays(mv.scheduled_date, c.iv));
      ps = visits
        .filter(function (v) {
          return v.job_id === c.job.id && v.status === "scheduled" && v.orig_date >= nx.orig_date;
        })
        .map(function (v) {
          return sb
            .from("visits")
            .update(
              Object.assign(
                { scheduled_date: addDays(v.scheduled_date, delta) },
                wxOn() ? { weather_from: v.scheduled_date, weather_batch: key + "#R" } : {}
              )
            )
            .eq("id", v.id);
        });
    }
    return Promise.all(ps).then(function (rs) {
      row.textContent = "";
      row.appendChild(
        el(
          "div",
          "note",
          rs.some(function (r) {
            return r.error;
          })
            ? "Could not save that."
            : kind === "skip"
              ? "✓ Next visit skipped."
              : "✓ Schedule reset: every " +
                (c.iv === 7 ? "week" : "2 weeks") +
                " from " +
                dshort(mv.scheduled_date) +
                "."
        )
      );
      return loadVisits().then(render);
    });
  }
  cons.forEach(function (c) {
    var mv = byId(visits, c.mv),
      nx = byId(visits, c.nx),
      card = el("div", "pcard"),
      row = el("div", "acts");
    card.appendChild(
      el(
        "b",
        null,
        cname(mv.client_id) + " · " + c.job.title + " (" + flabel(c.job.frequency).toLowerCase() + ")"
      )
    );
    card.appendChild(
      el(
        "div",
        "note",
        "This cut is now " +
          dshort(mv.scheduled_date) +
          " and the next is " +
          dshort(nx.scheduled_date) +
          (c.gap > 0
            ? ", only " + c.gap + " day" + (c.gap > 1 ? "s" : "") + " later."
            : ", the same day or earlier.")
      )
    );
    var rs = btn(
      "Reset: next one " + (c.iv === 7 ? "1 week" : "2 weeks") + " after this cut (recommended)",
      "btn sm",
      function () {
        act(c, "reset", card, row);
      }
    );
    row.appendChild(rs);
    row.appendChild(
      btn("Skip the next one", "btn alt sm", function () {
        act(c, "skip", card, row);
      })
    );
    row.appendChild(
      btn("Keep both", "btn alt sm", function () {
        row.textContent = "";
        row.appendChild(el("div", "note", "Kept as scheduled."));
      })
    );
    card.appendChild(row);
    card.style.marginBottom = "10px";
    p.appendChild(card);
    cards.push({ c: c, card: card, row: row });
  });
  var dn = btn("Done", "btn", function () {
    closeDetail();
    after();
  });
  dn.style.marginTop = "8px";
  p.appendChild(dn);
}

/* ======================= crm/src/09-reminders.js ======================= */
/* Reminder messages to clients (email, text for owners, copy). */

/* ---- Text reminders (tap-to-text: opens your own Messages app, nothing is sent until you press Send there) ---- */
function remOn() {
  return visits.some(function (v) {
    return "reminded_at" in v;
  });
}
function firstName(c) {
  return String((c && c.name) || "").split(" ")[0] || "there";
}
function remMsg(mode, c, vs) {
  var nm = bizv("name", "Latta Corp"),
    addrs = [];
  vs.forEach(function (v) {
    var a = paddr(v.property_id);
    if (a && addrs.indexOf(a) < 0) addrs.push(a);
  });
  var dts = vs
      .map(function (v) {
        return v.scheduled_date;
      })
      .sort(),
    when = dlabel(dts[0]);
  if (mode === "delay")
    return (
      "Hi " +
      firstName(c) +
      ", this is " +
      nm +
      ". Because of the weather we've moved your service" +
      (addrs.length === 1 ? " at " + addrs[0] : "") +
      " to " +
      (dts[0] === addDays(today(), 1) ? "tomorrow, " + dshort(dts[0]) : dshort(dts[0])) +
      ". Thank you for understanding!"
    );
  return (
    "Hi " +
    firstName(c) +
    ", this is " +
    nm +
    ". We're scheduled to take care of your property" +
    (addrs.length === 1 ? " at " + addrs[0] : "") +
    " " +
    (dts[0] === today()
      ? "today"
      : dts[0] === addDays(today(), 1)
        ? "tomorrow, " + dshort(dts[0])
        : "on " + dshort(dts[0])) +
    ". If anything needs to change (gate, pets, etc.), just reply here. Thank you!"
  );
}
function remindPanel(vs, mode, title) {
  var p = panel();
  p.appendChild(el("h2", null, title));
  p.appendChild(
    el(
      "p",
      "note",
      mode === "delay"
        ? "Let these clients know their visit moved. Tap Email to open a ready-to-send message in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
        : "Tap Email to open a ready-to-send reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
    )
  );
  var by = {},
    order = [];
  vs.slice()
    .sort(
      mode === "delay"
        ? function (a, b) {
            return a.scheduled_date < b.scheduled_date ? -1 : 1;
          }
        : dayOrder
    )
    .forEach(function (v) {
      if (!by[v.client_id]) {
        by[v.client_id] = [];
        order.push(v.client_id);
      }
      by[v.client_id].push(v);
    });
  if (!order.length) {
    p.appendChild(el("div", "empty", "No stops to text about."));
  }
  var sent = {};
  order.forEach(function (cid) {
    var c = byId(clients, cid) || {},
      list = by[cid],
      card = el("div", "pcard"),
      top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, c.name || "(deleted client)"));
    var ad = [];
    list.forEach(function (v) {
      var a = paddr(v.property_id);
      if (a && ad.indexOf(a) < 0) ad.push(a);
    });
    l.appendChild(
      el("div", "note", ad.join(" · ") + (mode === "delay" ? " · now " + dshort(list[0].scheduled_date) : ""))
    );
    top.appendChild(l);
    var r = el("div");
    r.style.cssText = "display:flex;gap:8px;align-items:center";
    var chip = el("span", "chip won", "✓ Sent");
    chip.hidden = !(
      mode === "visit" &&
      list.every(function (v) {
        return v.reminded_at;
      })
    );
    r.appendChild(chip);
    msgActions(r, c, remMsg(mode, c, list), remSubj(mode), function () {
      chip.hidden = false;
      if (mode === "visit") {
        var on = remOn(),
          now = new Date().toISOString();
        list.forEach(function (v) {
          v.reminded_at = now;
        });
        if (on)
          sb.from("visits")
            .update({ reminded_at: now })
            .in(
              "id",
              list.map(function (v) {
                return v.id;
              })
            )
            .then(function () {});
      }
    });
    top.appendChild(r);
    card.appendChild(top);
    p.appendChild(card);
  });
  var dn = btn(mode === "delay" ? "Skip / Done" : "Done", "btn alt");
  dn.style.marginTop = "10px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}
function invRemind(inv, c) {
  return (
    "Hi " +
    firstName(c) +
    ", a friendly reminder from " +
    bizv("name", "Latta Corp") +
    ": invoice " +
    invNum(inv.number) +
    " (" +
    money(inv.total) +
    ") " +
    (isOverdue(inv) ? "was due " + dshort(inv.due_date) : "is due " + dshort(inv.due_date)) +
    "." +
    (inv.share_token ? " You can view it here: " + docUrl(inv.share_token) + " " : "") +
    (bizv("zelle", "") ? " Pay with Zelle: " + biz.zelle + "." : "") +
    " If you've already paid, thank you!"
  );
}
function stampInv(inv) {
  var on = "reminded_at" in inv,
    now = new Date().toISOString();
  inv.reminded_at = now;
  if (on)
    sb.from("invoices")
      .update({ reminded_at: now })
      .eq("id", inv.id)
      .then(function () {});
}
function remindOverdue(od) {
  var p = panel();
  p.appendChild(el("h2", null, "Remind overdue clients"));
  p.appendChild(
    el(
      "p",
      "note",
      "Tap Email to open a ready-to-send payment reminder in your email app. Owners also get Text, which opens Messages on a phone. Nothing goes out until you press Send."
    )
  );
  od.slice()
    .sort(function (a, b) {
      return a.due_date < b.due_date ? -1 : 1;
    })
    .forEach(function (i) {
      var c = byId(clients, i.client_id) || {},
        card = el("div", "pcard"),
        top = el("div");
      top.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
      var l = el("div");
      l.appendChild(el("b", null, invNum(i.number) + " · " + cname(i.client_id)));
      l.appendChild(
        el(
          "div",
          "note",
          money(i.total) +
            " · due " +
            dshort(i.due_date) +
            (i.reminded_at ? " · last reminded " + dshort(String(i.reminded_at).slice(0, 10)) : "")
        )
      );
      top.appendChild(l);
      var r = el("div");
      r.style.cssText = "display:flex;gap:8px;align-items:center";
      var chip = el("span", "chip won", "✓ Sent");
      chip.hidden = true;
      r.appendChild(chip);
      msgActions(r, c, invRemind(i, c), "Payment reminder: invoice " + invNum(i.number), function () {
        chip.hidden = false;
        stampInv(i);
      });
      top.appendChild(r);
      card.appendChild(top);
      p.appendChild(card);
    });
  var dn = btn("Done", "btn alt");
  dn.style.marginTop = "10px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}

function mailHref(to, subject, body) {
  return (
    "mailto:" +
    encodeURIComponent(to).replace("%40", "@") +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}
function remSubj(mode) {
  return mode === "delay"
    ? "Schedule change from " + bizv("name", "Latta Corp")
    : "Service reminder from " + bizv("name", "Latta Corp");
}
function copyBtn(label, text, small, cb) {
  var b = btn(label, "btn alt" + (small ? " sm" : ""), function () {
    function ok() {
      var o = b.textContent;
      b.textContent = "Copied ✓";
      setTimeout(function () {
        b.textContent = o;
      }, 1400);
      if (cb) cb();
    }
    function fb() {
      var t = document.createElement("textarea");
      t.value = text;
      t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
        ok();
      } catch (e) {
        alert("Could not copy. Select the text and copy it yourself.");
      }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(ok, fb);
    else fb();
  });
  return b;
}
/* Email is the normal way to reach clients. Text (opens Messages on a phone) is for owners only; Copy lets anyone paste the message elsewhere. */
function msgActions(r, c, body, subject, onUse) {
  var any = false;
  if (c.email) {
    var e = el("a", "btn sm", "Email");
    e.href = mailHref(c.email, subject, body);
    e.addEventListener("click", onUse);
    r.appendChild(e);
    any = true;
  }
  if (isOwner() && c.phone) {
    var a = el("a", "btn alt sm", "Text");
    a.href = smsHref(c.phone, body);
    a.addEventListener("click", onUse);
    r.appendChild(a);
    any = true;
  }
  if (any) r.appendChild(copyBtn("Copy", body, true, onUse));
  else r.appendChild(el("span", "note", isOwner() ? "No email or phone on file" : "No email on file"));
}

/* ======================= crm/src/10-team.js ======================= */
/* Team tab (owners only): who can sign in and their role. */

/* ---- Team: owners add office staff and co-owners ---- */
function renderTeam() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  var intro = el(
    "div",
    "note",
    "Everyone here signs in at this same address with their own email and password. Owners and co-owners can do everything. Office staff can use clients, jobs, schedule, billing and invoices, and email clients, but they can't add people, manage crew logins, or text from the CRM."
  );
  intro.style.marginBottom = "12px";
  list.appendChild(intro);
  var holder = el("div");
  list.appendChild(holder);
  holder.appendChild(el("div", "empty", "Loading the team..."));
  var ROLES = [
    ["office", "Office (clients, jobs, schedule, billing)"],
    ["owner", "Owner / co-owner (everything)"]
  ];
  function draw(members) {
    teamSyncAt = 0;
    holder.textContent = "";
    members.forEach(function (m) {
      var card = el("div", "pcard"),
        top = el("div");
      top.style.cssText =
        "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
      var l = el("div");
      l.appendChild(el("b", null, (m.name || m.email) + (m.email === myEmail ? " (you)" : "")));
      l.appendChild(el("div", "note", m.email));
      top.appendChild(l);
      top.appendChild(
        el("span", "chip " + (m.role === "owner" ? "won" : ""), m.role === "owner" ? "Owner" : "Office")
      );
      card.appendChild(top);
      var a = el("div", "acts");
      a.style.marginTop = "8px";
      if (m.email !== myEmail) {
        a.appendChild(
          btn(m.role === "owner" ? "Make office" : "Make owner", "btn alt sm", function () {
            if (
              !confirm(
                m.role === "owner"
                  ? "Change " + (m.name || m.email) + " to office staff?"
                  : "Make " +
                      (m.name || m.email) +
                      " an owner? Owners can see and do everything, including adding and removing people."
              )
            )
              return;
            callApi("/api/team", "role", {
              email: m.email,
              role: m.role === "owner" ? "office" : "owner"
            }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              load2();
            });
          })
        );
        if (m.hasLogin)
          a.appendChild(
            btn("Reset password", "btn alt sm", function () {
              a.textContent = "";
              var np = document.createElement("input");
              np.type = "text";
              np.placeholder = "New password (8+ characters)";
              np.autocomplete = "off";
              np.style.width = "auto";
              a.appendChild(np);
              a.appendChild(
                btn("Set password", "btn sm", function () {
                  callApi("/api/team", "reset", { email: m.email, password: np.value }).then(function (res) {
                    if (!res.ok) {
                      alert(res.error);
                      return;
                    }
                    alert("Password changed. Tell them the new password.");
                    load2();
                  });
                })
              );
              a.appendChild(btn("Cancel", "btn alt sm", load2));
            })
          );
        a.appendChild(
          btn("Remove", "btn danger sm", function () {
            if (!confirm("Remove " + (m.name || m.email) + "? They won't be able to sign in any more."))
              return;
            callApi("/api/team", "remove", { email: m.email }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              load2();
            });
          })
        );
      }
      card.appendChild(a);
      holder.appendChild(card);
    });
    var h = el("h3", null, "Add a team member");
    h.style.margin = "18px 0 6px";
    holder.appendChild(h);
    var box = el("div", "pcard"),
      g = el("div", "grid2"),
      nm = fld("Name", "text", ""),
      em = fld("Their login email", "email", ""),
      rl = fld("Role", "select", "office", ROLES),
      pw = fld("Starting password (8+ characters, you tell them)", "text", "");
    pw.input.autocomplete = "off";
    g.appendChild(nm);
    g.appendChild(em);
    box.appendChild(g);
    box.appendChild(rl);
    box.appendChild(pw);
    var add = btn("Add to team", "btn", function () {
      if (!nm.input.value.trim()) {
        alert("Enter a name.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())) {
        alert("Enter their login email.");
        return;
      }
      if (pw.input.value.length < 8) {
        alert("The password needs at least 8 characters.");
        return;
      }
      add.disabled = true;
      callApi("/api/team", "create", {
        name: nm.input.value.trim(),
        email: em.input.value.trim(),
        role: rl.input.value,
        password: pw.input.value
      }).then(function (res) {
        add.disabled = false;
        if (!res.ok) {
          alert(res.error);
          return;
        }
        alert("Added. Give them the email and password; they sign in at this same address.");
        load2();
      });
    });
    add.style.marginTop = "10px";
    box.appendChild(add);
    holder.appendChild(box);
  }
  function load2() {
    callApi("/api/team", "list", {}).then(function (res) {
      if (!res.ok) {
        holder.textContent = "";
        holder.appendChild(el("div", "empty", res.error));
        return;
      }
      myEmail = res.data.me || myEmail;
      draw(res.data.members || []);
    });
  }
  load2();
}

/* ======================= crm/src/11-personnel.js ======================= */
/* Personnel tab (owners only): employee records, payroll, benefits and documents. */

/* ---- Personnel: owners only (people, payroll, benefits, documents) ---- */
var PSTAT = [
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["team", "Team"]
  ],
  PMETH = [
    ["zelle", "Zelle"],
    ["venmo", "Venmo"],
    ["cashapp", "Cash App"],
    ["cash", "Cash"],
    ["check", "Check"]
  ];
var GENDERS = [
  ["", "Select..."],
  ["Male", "Male"],
  ["Female", "Female"],
  ["Non-binary", "Non-binary"],
  ["Prefer not to say", "Prefer not to say"]
];
var DKINDS = [
  ["W-9", "W-9"],
  ["ID", "ID copy"],
  ["Agreement", "Agreement"],
  ["Insurance", "Insurance"],
  ["Other", "Other"]
];
var pstCache = {};
function empId(p) {
  return "EMP-" + ("000" + p.emp_no).slice(-4);
}
function pstatLabel(s) {
  var x = PSTAT.filter(function (a) {
    return a[0] === s;
  })[0];
  return x ? x[1] : s;
}
function methLabel(m) {
  var x = PMETH.filter(function (a) {
    return a[0] === m;
  })[0];
  return x ? x[1] : m;
}
function fmtSsn(s) {
  var d = String(s || "")
    .replace(/\D/g, "")
    .slice(0, 9);
  if (d.length > 5) return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
  if (d.length > 3) return d.slice(0, 3) + "-" + d.slice(3);
  return d;
}
function sumAmt(rows) {
  var t = 0;
  rows.forEach(function (r) {
    t += Number(r.amount) || 0;
  });
  return Math.round(t * 100) / 100;
}
function paidBy(id, year) {
  return payRows.filter(function (r) {
    return r.person_id === id && (!year || String(r.paid_on).slice(0, 4) === year);
  });
}
function signP(path) {
  if (!path) return Promise.resolve("");
  var c = pstCache[path];
  if (c && c.exp > Date.now() + 60000) return Promise.resolve(c.url);
  return sb.storage
    .from("personnel")
    .createSignedUrl(path, 3600)
    .then(
      function (r) {
        if (r.error || !r.data) return "";
        pstCache[path] = { url: r.data.signedUrl, exp: Date.now() + 3500000 };
        return r.data.signedUrl;
      },
      function () {
        return "";
      }
    );
}
function avatar(p, size) {
  var d = el("div");
  d.style.cssText =
    "flex:none;width:" +
    size +
    "px;height:" +
    size +
    "px;border-radius:50%;background:var(--mint);color:var(--forest);display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden";
  d.textContent = String(p.full_name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  if (p.photo_path)
    signP(p.photo_path).then(function (u) {
      if (u) {
        d.textContent = "";
        var i = document.createElement("img");
        i.alt = "";
        i.src = u;
        i.style.cssText = "width:100%;height:100%;object-fit:cover";
        d.appendChild(i);
      }
    });
  return d;
}
/* Everyone on the Team tab gets a Personnel record automatically (linked by their login email; an existing record with the same name is linked instead of duplicated). */
function syncTeam() {
  if (teamSyncing || persErr || !isOwner() || Date.now() - teamSyncAt < 60000) return;
  teamSyncing = true;
  callApi("/api/team", "list", {}).then(
    function (res) {
      teamSyncAt = Date.now();
      if (!res.ok || !res.data || !res.data.members) {
        teamSyncing = false;
        return;
      }
      var jobs = [];
      res.data.members.forEach(function (m) {
        var em = String(m.email || "")
          .trim()
          .toLowerCase();
        if (!em) return;
        if (
          people.some(function (x) {
            return String(x.login_email || "").toLowerCase() === em;
          })
        )
          return;
        var nm = String(m.name || "").trim(),
          match = nm
            ? people.filter(function (x) {
                return !x.login_email && String(x.full_name).trim().toLowerCase() === nm.toLowerCase();
              })[0]
            : null;
        if (match)
          jobs.push(
            sb
              .from("personnel")
              .update({ login_email: em, status: "team" })
              .eq("id", match.id)
              .select()
              .single()
          );
        else
          jobs.push(
            sb
              .from("personnel")
              .insert({ full_name: nm || em.split("@")[0], email: em, status: "team", login_email: em })
              .select()
              .single()
          );
      });
      if (!jobs.length) {
        teamSyncing = false;
        return;
      }
      Promise.all(jobs).then(
        function (rs) {
          var ch = false;
          rs.forEach(function (r) {
            if (r && !r.error && r.data) {
              pRow(r.data);
              ch = true;
            }
          });
          teamSyncing = false;
          if (ch && view === "personnel") render();
        },
        function () {
          teamSyncing = false;
        }
      );
    },
    function () {
      teamSyncing = false;
    }
  );
}
function renderPersonnel() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  $("topbtns").appendChild(
    btn("+ Add person", "btn", function () {
      openPerson(null);
    })
  );
  syncTeam();
  if (persErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Personnel isn't set up yet. Run the Stage 17 SQL in Supabase (it's in the supabase folder of the website files)."
      )
    );
    return;
  }
  var counts = { all: 0, active: 0, team: 0, inactive: 0 };
  people.forEach(function (p) {
    counts[p.status] = (counts[p.status] || 0) + 1;
    if (p.status !== "inactive") counts.all++;
  });
  [["all", "All"]].concat(PSTAT).forEach(function (s) {
    var b = el("button", "tab" + (pfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + (counts[s[0]] || 0) + ")"));
    b.addEventListener("click", function () {
      pfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  var shown = people.filter(function (p) {
    if (pfilter === "all" ? p.status === "inactive" : p.status !== pfilter) return false;
    if (!query) return true;
    return [p.full_name, empId(p), p.job_title, p.phone, p.email].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!shown.length) {
    list.appendChild(
      el("div", "empty", people.length ? "Nobody matches that." : "No one added yet. Press + Add person.")
    );
    return;
  }
  shown.forEach(function (p) {
    var b = el("button", "row");
    b.type = "button";
    b.style.alignItems = "center";
    var left = el("div");
    left.style.cssText = "display:flex;gap:10px;align-items:center";
    left.appendChild(avatar(p, 40));
    var t = el("div");
    t.appendChild(el("b", null, p.full_name));
    t.appendChild(el("div", "sub", [empId(p), p.job_title].filter(Boolean).join(" · ")));
    left.appendChild(t);
    var right = el("div");
    right.style.textAlign = "right";
    right.appendChild(
      el(
        "span",
        "chip " + (p.status === "inactive" ? "lost" : p.status === "team" ? "won" : ""),
        pstatLabel(p.status)
      )
    );
    var yr = String(new Date().getFullYear());
    right.appendChild(el("div", "sub", "Paid " + yr + ": " + money(sumAmt(paidBy(p.id, yr)))));
    b.appendChild(left);
    b.appendChild(right);
    b.addEventListener("click", function () {
      openPerson(p);
    });
    list.appendChild(b);
  });
}
function pRow(p) {
  for (var i = 0; i < people.length; i++)
    if (people[i].id === p.id) {
      people[i] = p;
      return;
    }
  people.push(p);
  people.sort(function (a, b) {
    return a.emp_no - b.emp_no;
  });
}
function openPerson(p, tab) {
  var pn = panel();
  tab = tab || "bio";
  pn.appendChild(el("h2", null, p ? p.full_name : "Add person"));
  if (p) pn.appendChild(el("div", "note", empId(p) + " · " + pstatLabel(p.status)));
  var bar = el("div", "tabs");
  bar.style.margin = "8px 0 12px";
  pn.appendChild(bar);
  var body = el("div");
  pn.appendChild(body);
  [
    ["bio", "Bio"],
    ["pay", "Payroll"],
    ["ben", "Benefits"],
    ["docs", "Documents"]
  ].forEach(function (t) {
    var b = el("button", "tab" + (tab === t[0] ? " on" : ""), t[1]);
    b.type = "button";
    if (!p && t[0] !== "bio") {
      b.disabled = true;
      b.title = "Save the bio first";
    }
    b.addEventListener("click", function () {
      openPerson(p, t[0]);
    });
    bar.appendChild(b);
  });
  if (tab === "bio") personBio(body, p);
  else if (tab === "pay") personPay(body, p);
  else if (tab === "ben") personBen(body, p);
  else personDocs(body, p);
}
function dv(s) {
  return s ? String(s).slice(0, 10) : "";
}
function personBio(host, p) {
  var src = p || {},
    pend = null;
  /* ID photo */
  var ph = el("div", "pcard");
  ph.style.cssText += ";display:flex;gap:12px;align-items:center;flex-wrap:wrap";
  var pic = el("div");
  ph.appendChild(pic);
  function drawPic() {
    pic.textContent = "";
    if (!pend && !(p && p.photo_path)) {
      var a = avatar(p || { full_name: "?" }, 96);
      a.style.borderRadius = "10px";
      a.style.width = "80px";
      a.style.height = "100px";
      pic.appendChild(a);
      return;
    }
    var im = document.createElement("img");
    im.alt = "ID photo";
    im.style.cssText =
      "display:block;max-width:100%;width:auto;height:auto;max-height:340px;border:1px solid var(--line);border-radius:8px;background:#f1f5f0;cursor:zoom-in";
    pic.style.cssText = "flex:1 1 260px;max-width:100%";
    if (pend) im.src = URL.createObjectURL(pend);
    else
      signP(p.photo_path).then(function (u) {
        if (u) im.src = u;
      });
    im.addEventListener("click", function () {
      if (im.src) window.open(im.src, "_blank");
    });
    pic.appendChild(im);
  }
  drawPic();
  var pa = el("div", "acts");
  pa.style.marginTop = "0";
  pa.appendChild(
    btn(p && p.photo_path ? "Replace ID photo" : "Add ID photo", "btn alt sm", function () {
      pickPhotos(false, function (fs) {
        var f = fs[0];
        if (!p) {
          pend = f;
          drawPic();
          return;
        }
        uploadPersonPhoto(f, p).then(
          function (np) {
            p = np;
            src = np;
            pend = null;
            drawPic();
            render();
          },
          function () {
            alert("Could not save the photo. It must be a JPEG, PNG or WebP picture.");
          }
        );
      });
    })
  );
  ph.appendChild(pa);
  host.appendChild(ph);
  var g = el("div", "grid2");
  var idf = fld("Employee ID", "text", p ? empId(p) : "Assigned when you save");
  idf.input.readOnly = true;
  idf.input.style.background = "#f1f5f0";
  var nm = fld("Full name", "text", src.full_name || ""),
    gen = fld("Gender", "select", src.gender || "", GENDERS),
    bd = fld("Birthdate", "date", dv(src.birthdate));
  var ad = fld("Address", "text", src.address || ""),
    ci = fld("City", "text", src.city || ""),
    st = fld("State", "text", src.state || "FL"),
    zp = fld("Zip", "text", src.zip || "");
  zp.input.inputMode = "numeric";
  var ph1 = fld("Phone", "tel", src.phone || ""),
    em = fld("Email", "email", src.email || "");
  var ss = fld("Social Security number", "password", fmtSsn(src.ssn || ""));
  ss.input.autocomplete = "off";
  ss.input.inputMode = "numeric";
  ss.input.placeholder = "###-##-####";
  /* The number stays hidden (dots) until the eye "Show" inside the box is pressed; it hides again on Hide
     or when the screen is reopened. */
  var EYE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var sh = el("div", "pwwrap");
  ss.input.parentNode.insertBefore(sh, ss.input);
  sh.appendChild(ss.input);
  var shb = btn("", "eyebtn");
  function drawEye() {
    var hidden = ss.input.type === "password";
    shb.innerHTML = (hidden ? EYE : EYE_OFF) + "<span>" + (hidden ? "Show" : "Hide") + "</span>";
    shb.setAttribute("aria-label", hidden ? "Show Social Security number" : "Hide Social Security number");
  }
  shb.addEventListener("click", function (e) {
    e.preventDefault();
    ss.input.type = ss.input.type === "password" ? "text" : "password";
    drawEye();
  });
  drawEye();
  sh.appendChild(shb);
  ss.input.addEventListener("blur", function () {
    ss.input.value = fmtSsn(ss.input.value);
  });
  var en = fld("Emergency contact name", "text", src.emergency_name || ""),
    ep = fld("Emergency contact phone", "tel", src.emergency_phone || "");
  var jt = fld("Job title", "text", src.job_title || ""),
    sts = fld("Status", "select", src.status || "active", PSTAT),
    sd = fld("Start date", "date", dv(src.start_date)),
    ed = fld("End date", "date", dv(src.end_date));
  var nt = fld("Notes", "textarea", src.notes || "");
  [idf, nm, gen, bd, ad, ci, st, zp, ph1, em].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  host.appendChild(ss);
  var g2 = el("div", "grid2");
  [en, ep, jt, sts, sd, ed].forEach(function (x) {
    g2.appendChild(x);
  });
  host.appendChild(g2);
  host.appendChild(nt);
  /* Team access */
  var tbox = el("div", "pcard");
  tbox.style.background = "#eef6ec";
  host.appendChild(tbox);
  var tlEmail, tlRole, tlPass;
  function drawTeam() {
    tbox.textContent = "";
    if (sts.input.value !== "team") {
      tbox.style.display = "none";
      return;
    }
    tbox.style.display = "";
    tbox.appendChild(el("b", null, "Team access"));
    if (p && p.login_email) {
      tbox.appendChild(
        el("div", "note", "Has a login: " + p.login_email + ". Manage roles and passwords on the Team tab.")
      );
      var a = el("div", "acts");
      a.appendChild(
        btn("Remove team access", "btn danger sm", function () {
          if (!confirm("Remove " + p.login_email + " from the team? They won't be able to sign in any more."))
            return;
          callApi("/api/team", "remove", { email: p.login_email }).then(function (res) {
            if (!res.ok) {
              alert(res.error);
              return;
            }
            sb.from("personnel")
              .update({ login_email: "" })
              .eq("id", p.id)
              .select()
              .single()
              .then(function (r) {
                if (r.error || !r.data) {
                  alert("Removed the login, but could not update this record.");
                  return;
                }
                p = r.data;
                pRow(p);
                drawTeam();
              });
          });
        })
      );
      tbox.appendChild(a);
      return;
    }
    tbox.appendChild(
      el(
        "div",
        "note",
        "Saving creates a sign-in for this person. Office can use clients, jobs, schedule and billing; Owner can do everything. Leave the password empty to save without creating a login yet."
      )
    );
    var gg = el("div", "grid2");
    tlEmail = fld("Login email", "email", em.input.value);
    tlRole = fld("Access level", "select", "office", [
      ["office", "Office (clients, jobs, schedule, billing)"],
      ["owner", "Owner / co-owner (everything)"]
    ]);
    tlPass = fld("Starting password (8+ characters, you tell them)", "text", "");
    tlPass.input.autocomplete = "off";
    gg.appendChild(tlEmail);
    gg.appendChild(tlRole);
    tbox.appendChild(gg);
    tbox.appendChild(tlPass);
  }
  sts.input.addEventListener("change", drawTeam);
  drawTeam();
  var acts = el("div", "acts");
  acts.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:16px";
  var save = btn(p ? "Save changes" : "Save person", "btn", function () {
    if (!nm.input.value.trim()) {
      alert("Enter the person's full name.");
      return;
    }
    var sd9 = ss.input.value.replace(/\D/g, "");
    if (
      sd9 &&
      sd9.length !== 9 &&
      !confirm("That Social Security number has " + sd9.length + " digits instead of 9. Save it anyway?")
    )
      return;
    var wantLogin = sts.input.value === "team" && !(p && p.login_email) && tlPass && tlPass.input.value;
    if (wantLogin) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tlEmail.input.value.trim())) {
        alert("Enter an email for their login.");
        return;
      }
      if (tlPass.input.value.length < 8) {
        alert("The password needs at least 8 characters.");
        return;
      }
    }
    var row = {
      full_name: nm.input.value.trim(),
      gender: gen.input.value,
      birthdate: bd.input.value || null,
      address: ad.input.value.trim(),
      city: ci.input.value.trim(),
      state: st.input.value.trim().toUpperCase().slice(0, 2),
      zip: zp.input.value.trim(),
      phone: ph1.input.value.trim(),
      email: em.input.value.trim(),
      ssn: fmtSsn(ss.input.value),
      emergency_name: en.input.value.trim(),
      emergency_phone: ep.input.value.trim(),
      job_title: jt.input.value.trim(),
      status: sts.input.value,
      start_date: sd.input.value || null,
      end_date: ed.input.value || null,
      notes: nt.input.value
    };
    save.disabled = true;
    var q = p
      ? sb.from("personnel").update(row).eq("id", p.id).select().single()
      : sb.from("personnel").insert(row).select().single();
    q.then(function (r) {
      if (r.error || !r.data) {
        save.disabled = false;
        alert("Could not save. If this is new, make sure the Stage 17 SQL was run in Supabase.");
        return;
      }
      var saved = r.data,
        wasNew = !p;
      p = saved;
      pRow(saved);
      var steps = Promise.resolve();
      if (pend)
        steps = steps.then(function () {
          return uploadPersonPhoto(pend, saved).then(
            function (np) {
              p = np;
              pRow(np);
            },
            function () {
              alert("The person was saved, but the photo could not be uploaded. Try Replace ID photo.");
            }
          );
        });
      if (wantLogin)
        steps = steps.then(function () {
          return callApi("/api/team", "create", {
            name: row.full_name,
            email: tlEmail.input.value.trim(),
            role: tlRole.input.value,
            password: tlPass.input.value
          }).then(function (res) {
            if (!res.ok) {
              alert("Saved, but the team login was not created: " + res.error);
              return;
            }
            return sb
              .from("personnel")
              .update({ login_email: tlEmail.input.value.trim().toLowerCase() })
              .eq("id", saved.id)
              .select()
              .single()
              .then(function (r2) {
                if (!r2.error && r2.data) {
                  p = r2.data;
                  pRow(p);
                }
                alert(
                  "Team login created. Give them " +
                    tlEmail.input.value.trim() +
                    " and the password you set; they sign in at this same address."
                );
              });
          });
        });
      steps.then(function () {
        render();
        openPerson(p, wasNew ? "pay" : "bio");
      });
    });
  });
  acts.appendChild(save);
  if (p) {
    var delP = btn("Delete person", "btn danger sm", function () {
      if (paidBy(p.id).length) {
        alert(
          "This person has payments on record, which feed your Tax Report, so they can't be deleted. Set the status to Inactive instead."
        );
        return;
      }
      if (!confirm("Delete " + p.full_name + " and everything saved for them? This can't be undone.")) return;
      var paths = docRows
        .filter(function (d) {
          return d.person_id === p.id;
        })
        .map(function (d) {
          return d.path;
        });
      if (p.photo_path) paths.push(p.photo_path);
      (paths.length ? sb.storage.from("personnel").remove(paths) : Promise.resolve({}))
        .then(function () {
          return sb.from("personnel").delete().eq("id", p.id);
        })
        .then(function (r) {
          if (r.error) {
            alert("Could not delete.");
            return;
          }
          people = people.filter(function (x) {
            return x.id !== p.id;
          });
          docRows = docRows.filter(function (d) {
            return d.person_id !== p.id;
          });
          benRows = benRows.filter(function (d) {
            return d.person_id !== p.id;
          });
          closeDetail();
          render();
        });
    });
    delP.style.marginLeft = "auto";
    acts.appendChild(delP);
  }
  host.appendChild(acts);
}
function uploadPersonPhoto(file, p) {
  return loadImg(file)
    .then(function (img) {
      return toJpeg(img, 700, 0.85);
    })
    .then(function (j) {
      var path = p.id + "/photo-" + Date.now() + ".jpg",
        st = sb.storage.from("personnel");
      return st.upload(path, j.blob, { contentType: "image/jpeg" }).then(function (u) {
        if (u.error) throw new Error("upload");
        return sb
          .from("personnel")
          .update({ photo_path: path })
          .eq("id", p.id)
          .select()
          .single()
          .then(function (r) {
            if (r.error || !r.data) {
              st.remove([path]);
              throw new Error("save");
            }
            if (p.photo_path) {
              st.remove([p.photo_path]);
              delete pstCache[p.photo_path];
            }
            pRow(r.data);
            return r.data;
          });
      });
    });
}
function personPay(host, p) {
  var yr = String(new Date().getFullYear());
  var rate = fld("Hourly rate ($)", "number", p.hourly_rate == null ? "" : p.hourly_rate);
  rate.input.step = "0.25";
  rate.input.min = "0";
  rate.input.inputMode = "decimal";
  var rr = el("div");
  rr.style.cssText = "display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap";
  rate.style.cssText = "margin:0;flex:1;min-width:150px";
  rr.appendChild(rate);
  rr.appendChild(
    btn("Save rate", "btn alt sm", function () {
      var v = rate.input.value === "" ? null : Math.max(0, Number(rate.input.value) || 0);
      sb.from("personnel")
        .update({ hourly_rate: v })
        .eq("id", p.id)
        .select()
        .single()
        .then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save the rate.");
            return;
          }
          p = r.data;
          pRow(p);
          openPerson(p, "pay");
        });
    })
  );
  host.appendChild(rr);
  var sum = el("div", "pcard");
  sum.style.margin = "12px 0";
  sum.appendChild(el("div", null, yr + " paid: " + money(sumAmt(paidBy(p.id, yr)))));
  sum.appendChild(
    el(
      "div",
      "note",
      "All time: " +
        money(sumAmt(paidBy(p.id))) +
        " · These totals feed the Employee pay box on the Tax Report."
    )
  );
  host.appendChild(sum);
  host.appendChild(el("h3", null, "Record a payment"));
  var g = el("div", "grid2"),
    pd = fld("Date paid", "date", today()),
    hr = fld("Hours (optional)", "number", ""),
    am = fld("Amount paid ($)", "number", ""),
    me = fld("Paid by", "select", "zelle", PMETH);
  hr.input.step = "0.25";
  hr.input.min = "0";
  hr.input.inputMode = "decimal";
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  var typed = false;
  am.input.addEventListener("input", function () {
    typed = true;
  });
  hr.input.addEventListener("input", function () {
    if (!typed && p.hourly_rate && hr.input.value)
      am.input.value = (Number(hr.input.value) * Number(p.hourly_rate)).toFixed(2);
  });
  [pd, hr, am, me].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  var no = fld("Note (job, week, etc.)", "text", "");
  host.appendChild(no);
  var add = btn("Record payment", "btn", function () {
    var a = Number(am.input.value);
    if (!(a > 0)) {
      alert("Enter the amount paid.");
      return;
    }
    if (!pd.input.value) {
      alert("Pick the date paid.");
      return;
    }
    add.disabled = true;
    sb.from("personnel_pay")
      .insert({
        person_id: p.id,
        paid_on: pd.input.value,
        amount: a,
        hours: hr.input.value === "" ? null : Number(hr.input.value),
        rate: p.hourly_rate || null,
        method: me.input.value,
        note: no.input.value.trim()
      })
      .select()
      .single()
      .then(function (r) {
        add.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save the payment.");
          return;
        }
        payRows.unshift(r.data);
        render();
        openPerson(p, "pay");
      });
  });
  add.style.marginTop = "6px";
  host.appendChild(add);
  var rows = paidBy(p.id).sort(function (a, b) {
    return String(b.paid_on).localeCompare(String(a.paid_on));
  });
  var h = el("h3", null, "Payments");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No payments recorded yet."));
  rows.forEach(function (r) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:center";
    var l = el("div");
    l.appendChild(el("b", null, money(r.amount) + " · " + mdy(r.paid_on)));
    l.appendChild(
      el(
        "div",
        "note",
        [methLabel(r.method), r.hours ? r.hours + " hrs" : "", r.note].filter(Boolean).join(" · ")
      )
    );
    top.appendChild(l);
    var pa = el("div", "acts");
    pa.style.cssText = "display:flex;gap:6px;margin:0";
    pa.appendChild(
      btn("Edit", "btn alt sm", function () {
        c.textContent = "";
        var eg = el("div", "grid2"),
          epd = fld("Date paid", "date", String(r.paid_on).slice(0, 10)),
          ehr = fld("Hours (optional)", "number", r.hours == null ? "" : r.hours),
          eam = fld("Amount paid ($)", "number", r.amount),
          eme = fld("Paid by", "select", r.method, PMETH);
        ehr.input.step = "0.25";
        ehr.input.inputMode = "decimal";
        eam.input.step = "0.01";
        eam.input.inputMode = "decimal";
        [epd, ehr, eam, eme].forEach(function (x) {
          eg.appendChild(x);
        });
        c.appendChild(eg);
        var eno = fld("Note", "text", r.note || "");
        c.appendChild(eno);
        var ea = el("div");
        ea.style.cssText = "display:flex;gap:8px;margin-top:8px";
        var sv = btn("Save", "btn sm", function () {
          var a = Number(eam.input.value);
          if (!(a > 0)) {
            alert("Enter the amount paid.");
            return;
          }
          if (!epd.input.value) {
            alert("Pick the date paid.");
            return;
          }
          sv.disabled = true;
          var up = {
            paid_on: epd.input.value,
            amount: a,
            hours: ehr.input.value === "" ? null : Number(ehr.input.value),
            method: eme.input.value,
            note: eno.input.value.trim()
          };
          sb.from("personnel_pay")
            .update(up)
            .eq("id", r.id)
            .select()
            .single()
            .then(function (u) {
              sv.disabled = false;
              if (u.error || !u.data) {
                alert("Could not save the changes.");
                return;
              }
              Object.assign(r, u.data);
              repData = null;
              render();
              openPerson(p, "pay");
            });
        });
        ea.appendChild(sv);
        ea.appendChild(
          btn("Cancel", "btn alt sm", function () {
            openPerson(p, "pay");
          })
        );
        c.appendChild(ea);
      })
    );
    pa.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this " + money(r.amount) + " payment?")) return;
        sb.from("personnel_pay")
          .delete()
          .eq("id", r.id)
          .then(function (d) {
            if (d.error) {
              alert("Could not delete.");
              return;
            }
            payRows = payRows.filter(function (x) {
              return x.id !== r.id;
            });
            render();
            openPerson(p, "pay");
          });
      })
    );
    top.appendChild(pa);
    c.appendChild(top);
    host.appendChild(c);
  });
}
function personBen(host, p) {
  host.appendChild(
    el(
      "p",
      "note",
      "Anything you provide besides pay: bonus, paid time off, phone stipend, uniform or tool allowance, etc."
    )
  );
  var g = el("div", "grid2"),
    ti = fld("Benefit", "text", ""),
    va = fld("Value ($, optional)", "number", ""),
    sd = fld("Starts", "date", today()),
    de = fld("Details", "text", "");
  va.input.step = "0.01";
  va.input.inputMode = "decimal";
  [ti, va, sd, de].forEach(function (x) {
    g.appendChild(x);
  });
  host.appendChild(g);
  var add = btn("Add benefit", "btn", function () {
    if (!ti.input.value.trim()) {
      alert("Enter the benefit name.");
      return;
    }
    add.disabled = true;
    sb.from("personnel_benefits")
      .insert({
        person_id: p.id,
        title: ti.input.value.trim(),
        details: de.input.value.trim(),
        value: va.input.value === "" ? null : Number(va.input.value),
        starts_on: sd.input.value || null
      })
      .select()
      .single()
      .then(function (r) {
        add.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save.");
          return;
        }
        benRows.unshift(r.data);
        openPerson(p, "ben");
      });
  });
  host.appendChild(add);
  var rows = benRows.filter(function (b) {
    return b.person_id === p.id;
  });
  var h = el("h3", null, "Benefits");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No benefits recorded."));
  rows.forEach(function (b) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:center";
    var l = el("div");
    l.appendChild(el("b", null, b.title + (b.value != null ? " · " + money(b.value) : "")));
    l.appendChild(
      el(
        "div",
        "note",
        [b.starts_on ? "Since " + mdy(b.starts_on) : "", b.details].filter(Boolean).join(" · ")
      )
    );
    top.appendChild(l);
    var ba = el("div", "acts");
    ba.style.cssText = "display:flex;gap:6px;margin:0";
    ba.appendChild(
      btn("Edit", "btn alt sm", function () {
        c.textContent = "";
        var eg = el("div", "grid2"),
          eti = fld("Benefit", "text", b.title),
          eva = fld("Value ($, optional)", "number", b.value == null ? "" : b.value),
          esd = fld("Starts", "date", b.starts_on ? String(b.starts_on).slice(0, 10) : ""),
          ede = fld("Details", "text", b.details || "");
        eva.input.step = "0.01";
        eva.input.inputMode = "decimal";
        [eti, eva, esd, ede].forEach(function (x) {
          eg.appendChild(x);
        });
        c.appendChild(eg);
        var ea = el("div");
        ea.style.cssText = "display:flex;gap:8px;margin-top:8px";
        var sv = btn("Save", "btn sm", function () {
          if (!eti.input.value.trim()) {
            alert("Enter the benefit name.");
            return;
          }
          sv.disabled = true;
          sb.from("personnel_benefits")
            .update({
              title: eti.input.value.trim(),
              details: ede.input.value.trim(),
              value: eva.input.value === "" ? null : Number(eva.input.value),
              starts_on: esd.input.value || null
            })
            .eq("id", b.id)
            .select()
            .single()
            .then(function (u) {
              sv.disabled = false;
              if (u.error || !u.data) {
                alert("Could not save the changes.");
                return;
              }
              Object.assign(b, u.data);
              openPerson(p, "ben");
            });
        });
        ea.appendChild(sv);
        ea.appendChild(
          btn("Cancel", "btn alt sm", function () {
            openPerson(p, "ben");
          })
        );
        c.appendChild(ea);
      })
    );
    ba.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this benefit?")) return;
        sb.from("personnel_benefits")
          .delete()
          .eq("id", b.id)
          .then(function (d) {
            if (d.error) {
              alert("Could not delete.");
              return;
            }
            benRows = benRows.filter(function (x) {
              return x.id !== b.id;
            });
            openPerson(p, "ben");
          });
      })
    );
    top.appendChild(ba);
    c.appendChild(top);
    host.appendChild(c);
  });
}
function personDocs(host, p) {
  host.appendChild(
    el(
      "p",
      "note",
      "W-9, ID copy, signed agreement, insurance papers. PDFs and pictures up to 10 MB. Only owners can open these."
    )
  );
  var g = el("div", "grid2"),
    ti = fld("Title (optional)", "text", ""),
    ki = fld("Type", "select", "W-9", DKINDS);
  g.appendChild(ti);
  g.appendChild(ki);
  host.appendChild(g);
  var msg = el("div", "note");
  var add = btn("Choose file to upload", "btn", function () {
    var i = document.createElement("input");
    i.type = "file";
    i.accept = "application/pdf,image/*";
    i.style.display = "none";
    document.body.appendChild(i);
    i.addEventListener("change", function () {
      var f = i.files && i.files[0];
      document.body.removeChild(i);
      if (!f) return;
      var isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (isPdf && f.size > 10485760) {
        alert("That PDF is over 10 MB.");
        return;
      }
      msg.textContent = "Uploading...";
      var prep = isPdf
        ? Promise.resolve({ blob: f, ext: "pdf", type: "application/pdf" })
        : loadImg(f)
            .then(function (img) {
              return toJpeg(img, 2000, 0.85);
            })
            .then(function (j) {
              return { blob: j.blob, ext: "jpg", type: "image/jpeg" };
            });
      prep
        .then(function (x) {
          var path = p.id + "/" + uid() + "." + x.ext;
          return sb.storage
            .from("personnel")
            .upload(path, x.blob, { contentType: x.type })
            .then(function (u) {
              if (u.error) throw new Error("upload");
              return sb
                .from("personnel_docs")
                .insert({
                  person_id: p.id,
                  title: ti.input.value.trim() || f.name,
                  kind: ki.input.value,
                  path: path,
                  size_bytes: x.blob.size || 0
                })
                .select()
                .single()
                .then(function (r) {
                  if (r.error || !r.data) {
                    sb.storage.from("personnel").remove([path]);
                    throw new Error("save");
                  }
                  docRows.unshift(r.data);
                  openPerson(p, "docs");
                });
            });
        })
        .then(null, function () {
          msg.textContent = "";
          alert("Could not upload that file. Use a PDF, JPEG, PNG or WebP under 10 MB.");
        });
    });
    i.click();
  });
  host.appendChild(add);
  host.appendChild(msg);
  var rows = docRows.filter(function (d) {
    return d.person_id === p.id;
  });
  var h = el("h3", null, "Documents");
  h.style.margin = "16px 0 6px";
  host.appendChild(h);
  if (!rows.length) host.appendChild(el("div", "empty", "No documents yet."));
  rows.forEach(function (d) {
    var c = el("div", "pcard"),
      top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, d.title || "Document"));
    l.appendChild(el("div", "note", d.kind + " · added " + mdy(String(d.created_at).slice(0, 10))));
    top.appendChild(l);
    var a = el("div", "acts");
    a.style.marginTop = "0";
    a.appendChild(
      btn("Open", "btn alt sm", function () {
        var w = window.open("", "_blank");
        signP(d.path).then(function (u) {
          if (!u) {
            if (w) w.close();
            alert("Could not open it.");
            return;
          }
          if (w) w.location.href = u;
          else location.href = u;
        });
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this document?")) return;
        sb.storage
          .from("personnel")
          .remove([d.path])
          .then(function () {
            return sb.from("personnel_docs").delete().eq("id", d.id);
          })
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            docRows = docRows.filter(function (x) {
              return x.id !== d.id;
            });
            openPerson(p, "docs");
          });
      })
    );
    top.appendChild(a);
    c.appendChild(top);
    host.appendChild(c);
  });
}

/* ======================= crm/src/12-todo.js ======================= */
/* To-Do tab: shared tasks. */

/* ---- To-Do list (shared by the whole team) ---- */
function memberName(e) {
  if (!e) return "";
  var m = team.filter(function (x) {
    return String(x.email).toLowerCase() === String(e).toLowerCase();
  })[0];
  return m && m.name ? m.name : String(e).split("@")[0];
}
function todoDueState(t) {
  return t.done || !t.due_date ? "" : t.due_date < today() ? "od" : t.due_date === today() ? "today" : "";
}
function toggleTodo(t, done) {
  var now = done ? new Date().toISOString() : null,
    by = done ? myEmail : "";
  sb.from("todos")
    .update({ done: done, done_at: now, done_by: by })
    .eq("id", t.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not save that.");
        return;
      }
      t.done = done;
      t.done_at = now;
      t.done_by = by;
      render();
    });
}
function renderTodo() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  if (todoErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "To-Do isn't set up yet. Run the Stage 8 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var me = (myEmail || "").toLowerCase(),
    open = todos.filter(function (t) {
      return !t.done;
    }),
    mine = open.filter(function (t) {
      return String(t.assigned_to).toLowerCase() === me && me;
    }),
    dn = todos.filter(function (t) {
      return t.done;
    });
  [
    ["open", "Open", open.length],
    ["mine", "Mine", mine.length],
    ["done", "Done", dn.length]
  ].forEach(function (s) {
    var b = el("button", "tab" + (tfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      tfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  $("topbtns").appendChild(
    btn("+ New task", "btn", function () {
      openTodo(null);
    })
  );
  var qa = el("div", "qadd"),
    ti = document.createElement("input");
  ti.type = "text";
  ti.placeholder = "Add a task and press Enter...";
  ti.setAttribute("aria-label", "New task");
  var di = document.createElement("input");
  di.type = "date";
  di.setAttribute("aria-label", "Due date (optional)");
  di.title = "Due date (optional)";
  function add() {
    var v = ti.value.trim();
    if (!v) return;
    ab.disabled = true;
    sb.from("todos")
      .insert({
        title: v,
        due_date: di.value || null,
        created_by: myEmail || "",
        assigned_to: tfilter === "mine" ? myEmail || "" : ""
      })
      .select()
      .single()
      .then(function (r) {
        ab.disabled = false;
        if (r.error || !r.data) {
          alert("Could not add the task.");
          return;
        }
        todos.unshift(r.data);
        render();
      });
  }
  var ab = btn("Add", "btn", add);
  ti.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  });
  qa.appendChild(ti);
  qa.appendChild(di);
  qa.appendChild(ab);
  list.appendChild(qa);
  var set =
    tfilter === "done"
      ? dn.slice().sort(function (a, b) {
          return String(b.done_at || "") < String(a.done_at || "") ? -1 : 1;
        })
      : tfilter === "mine"
        ? mine
        : open;
  if (query)
    set = set.filter(function (t) {
      return (
        [t.title, t.notes, cname(t.client_id), memberName(t.assigned_to)]
          .join(" ")
          .toLowerCase()
          .indexOf(query) > -1
      );
    });
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        tfilter === "done"
          ? "Nothing completed yet."
          : tfilter === "mine"
            ? "Nothing assigned to you."
            : "Nothing to do. Add a task above."
      )
    );
    return;
  }
  var groups = [];
  if (tfilter === "done") groups = [["Completed", set]];
  else {
    var t0 = today(),
      by = function (f) {
        return set.filter(f).sort(function (a, b) {
          return (a.due_date || "") < (b.due_date || "") ? -1 : 1;
        });
      };
    groups = [
      [
        "Overdue",
        by(function (t) {
          return t.due_date && t.due_date < t0;
        })
      ],
      [
        "Today",
        by(function (t) {
          return t.due_date === t0;
        })
      ],
      [
        "Upcoming",
        by(function (t) {
          return t.due_date && t.due_date > t0;
        })
      ],
      [
        "No date",
        set.filter(function (t) {
          return !t.due_date;
        })
      ]
    ];
  }
  groups.forEach(function (g) {
    if (!g[1].length) return;
    var h = el("h3", null, g[0] + " (" + g[1].length + ")");
    h.style.cssText =
      "margin:14px 0 6px;font-size:.95rem;color:" + (g[0] === "Overdue" ? "var(--red)" : "var(--muted)");
    list.appendChild(h);
    g[1].forEach(function (t) {
      var row = el("div", "todo" + (t.done ? " done" : "")),
        ck = el("button", "ck", t.done ? "✓" : "");
      ck.type = "button";
      ck.setAttribute("aria-label", t.done ? "Mark not done" : "Mark done");
      ck.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleTodo(t, !t.done);
      });
      var body = el("div", "tb");
      body.appendChild(el("div", "tt", t.title));
      var sub = [];
      if (t.due_date) sub.push(dshort(t.due_date));
      if (t.assigned_to) sub.push(memberName(t.assigned_to));
      if (t.client_id) sub.push(cname(t.client_id));
      if (t.done && t.done_at)
        sub.push(
          "done " + dshort(String(t.done_at).slice(0, 10)) + (t.done_by ? " by " + memberName(t.done_by) : "")
        );
      if (sub.length) {
        var sd = el("div", "note", sub.join(" · "));
        if (todoDueState(t) === "od") sd.style.color = "var(--red)";
        body.appendChild(sd);
      }
      if (t.notes)
        body.appendChild(el("div", "note", t.notes.length > 110 ? t.notes.slice(0, 110) + "…" : t.notes));
      row.appendChild(ck);
      row.appendChild(body);
      row.addEventListener("click", function () {
        openTodo(t);
      });
      list.appendChild(row);
    });
  });
}
function openTodo(t) {
  var p = panel();
  p.appendChild(el("h2", null, t ? "Task" : "New task"));
  var ti = fld("Task", "text", t ? t.title : ""),
    no = fld("Notes (optional)", "textarea", t ? t.notes : ""),
    du = fld("Due date (optional)", "date", t && t.due_date ? t.due_date : "");
  var tm = [["", "Anyone"]].concat(
    team.map(function (m) {
      return [m.email, m.name || m.email];
    })
  );
  if (
    t &&
    t.assigned_to &&
    !tm.some(function (x) {
      return String(x[0]).toLowerCase() === String(t.assigned_to).toLowerCase();
    })
  )
    tm.push([t.assigned_to, memberName(t.assigned_to)]);
  var as = fld("Assigned to", "select", t ? t.assigned_to : "", tm);
  var cl = fld(
    "Client (optional)",
    "select",
    t && t.client_id ? t.client_id : "",
    [["", "None"]].concat(
      clients
        .filter(function (c) {
          return !c.archived || (t && t.client_id === c.id);
        })
        .map(function (c) {
          return [c.id, c.name];
        })
    )
  );
  [ti, no, du, as, cl].forEach(function (f) {
    p.appendChild(f);
  });
  var acts = el("div", "acts");
  acts.style.marginTop = "12px";
  var sv = btn("Save", "btn", function () {
    var title = ti.input.value.trim();
    if (!title) {
      alert("Enter a task.");
      return;
    }
    var row = {
      title: title,
      notes: no.input.value.trim(),
      due_date: du.input.value || null,
      assigned_to: as.input.value,
      client_id: cl.input.value || null
    };
    sv.disabled = true;
    var q = t
      ? sb.from("todos").update(row).eq("id", t.id).select().single()
      : sb
          .from("todos")
          .insert(Object.assign({ created_by: myEmail || "" }, row))
          .select()
          .single();
    q.then(function (r) {
      sv.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save.");
        return;
      }
      if (t) Object.assign(t, r.data);
      else todos.unshift(r.data);
      closeDetail();
      render();
    });
  });
  acts.appendChild(sv);
  if (t) {
    acts.appendChild(
      btn(t.done ? "Mark not done" : "Mark done", "btn alt", function () {
        toggleTodo(t, !t.done);
        closeDetail();
      })
    );
    acts.appendChild(
      btn("Delete", "btn danger", function () {
        if (!confirm("Delete this task?")) return;
        sb.from("todos")
          .delete()
          .eq("id", t.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            todos = todos.filter(function (z) {
              return z.id !== t.id;
            });
            closeDetail();
            render();
          });
      })
    );
  }
  p.appendChild(acts);
}

/* ======================= crm/src/13-reports.js ======================= */
/* Reports tab: income/expense overview, periods, aging, and the pie charts. */

/* ---- Reports & expenses ---- */
var EXP_LIST = [
  "Advertising & Marketing",
  "Chemicals",
  "Dump/Recycling",
  "Entertainment",
  "Equipment",
  "Equipment Repairs & Maintenance",
  "Fuel",
  "Groceries",
  "Insurance",
  "Licensing & Permits",
  "Meal",
  "Memberships",
  "Office Repairs & Maintenance",
  "Office Supplies",
  "Postage & Shipping",
  "Repairs & Maintenance",
  "Safety Supplies",
  "Supplies",
  "Tools",
  "Transportation",
  "Travel",
  "Uniform",
  "Utilities",
  "Vehicle Repairs & Maintenance"
];
var PAYMENTS = ["Debit", "Credit", "Cash", "Check", "Zelle", "Other"];
var CODE_CAT = [
  ["AM", "Advertising & Marketing"],
  ["C", "Chemicals"],
  ["D", "Dump/Recycling"],
  ["E", "Entertainment"],
  ["EQ", "Equipment"],
  ["ER", "Equipment Repairs & Maintenance"],
  ["F", "Fuel"],
  ["G", "Groceries"],
  ["I", "Insurance"],
  ["L", "Licensing & Permits"],
  ["M", "Meal"],
  ["MEM", "Memberships"],
  ["OR", "Office Repairs & Maintenance"],
  ["OS", "Office Supplies"],
  ["PS", "Postage & Shipping"],
  ["R", "Repairs & Maintenance"],
  ["S", "Supplies"],
  ["SS", "Safety Supplies"],
  ["T", "Tools"],
  ["TRAV", "Travel"],
  ["TRAN", "Transportation"],
  ["U", "Uniform"],
  ["UT", "Utilities"],
  ["VR", "Vehicle Repairs & Maintenance"]
];
function catOfCode(c) {
  c = String(c || "")
    .trim()
    .toUpperCase();
  for (var i = 0; i < CODE_CAT.length; i++) if (CODE_CAT[i][0] === c) return CODE_CAT[i][1];
  return "";
}
function codeOfCat(n) {
  for (var i = 0; i < CODE_CAT.length; i++) if (CODE_CAT[i][1] === n) return CODE_CAT[i][0];
  return "";
}
function expCats() {
  var l = EXP_LIST.slice();
  expenses.forEach(function (e) {
    if (e.category && l.indexOf(e.category) < 0) l.push(e.category);
  });
  return l;
}
function monthStart(s) {
  return s.slice(0, 8) + "01";
}
function monthEndOf(s) {
  return addDays(addDays(monthStart(s), 32).slice(0, 8) + "01", -1);
}
function periodRange() {
  var t = today(),
    y = t.slice(0, 4);
  if (rper === "month") return [monthStart(t), monthEndOf(t)];
  if (rper === "last") {
    var lm = addDays(monthStart(t), -1);
    return [monthStart(lm), lm];
  }
  if (rper === "quarter") {
    var m = +t.slice(5, 7),
      q = Math.floor((m - 1) / 3) * 3 + 1,
      qs = y + "-" + pad(q) + "-01";
    return [qs, monthEndOf(addDays(qs, 70))];
  }
  if (rper === "ytd") return [y + "-01-01", t];
  if (rper === "lastyear") return [+y - 1 + "-01-01", +y - 1 + "-12-31"];
  return [rfrom || monthStart(t), rto || t];
}
function periodBar(list) {
  var bar = el("div", "pbar");
  [
    ["month", "This month"],
    ["last", "Last month"],
    ["quarter", "This quarter"],
    ["ytd", "Year to date"],
    ["lastyear", "Last year"],
    ["custom", "Custom"]
  ].forEach(function (p) {
    var b = el("button", "tab" + (rper === p[0] ? " on" : ""), p[1]);
    b.type = "button";
    b.addEventListener("click", function () {
      if (p[0] === "custom" && !rfrom) {
        var r = periodRange();
        rfrom = r[0];
        rto = r[1];
      }
      rper = p[0];
      render();
    });
    bar.appendChild(b);
  });
  list.appendChild(bar);
  if (rper === "custom") {
    var cr = el("div", "pbar");
    [
      ["From", "from"],
      ["To", "to"]
    ].forEach(function (x) {
      var l = el("label", "f");
      l.style.margin = "0";
      l.appendChild(el("span", null, x[0]));
      var di = document.createElement("input");
      di.type = "date";
      di.style.width = "auto";
      di.value = x[1] === "from" ? rfrom : rto;
      di.addEventListener("change", function () {
        if (x[1] === "from") rfrom = di.value || rfrom;
        else rto = di.value || rto;
        render();
      });
      l.appendChild(di);
      cr.appendChild(l);
    });
    list.appendChild(cr);
  }
  var r = periodRange();
  list.appendChild(el("div", "note", dshort(r[0]) + " – " + dshort(r[1])));
}
function inRange(d, a, b) {
  return d >= a && d <= b;
}
function computeReport(from, to) {
  var a = sb
    .from("visits")
    .select("id,client_id,scheduled_date,price")
    .eq("status", "done")
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .limit(20000);
  var b = sb
    .from("visits")
    .select("id,client_id,price,paid_at,paid_method")
    .is("invoice_id", null)
    .gte("paid_at", from + "T00:00:00")
    .lte("paid_at", to + "T23:59:59")
    .limit(20000);
  return Promise.all([a, b]).then(function (rs) {
    if (rs[0].error || rs[1].error) return { error: true };
    var done = rs[0].data || [],
      pays = [];
    var hasRows = {};
    invPays.forEach(function (x) {
      if (x.invoice_id) hasRows[x.invoice_id] = 1;
    });
    invoices.forEach(function (i) {
      var d = i.paid_at ? String(i.paid_at).slice(0, 10) : "";
      if (i.status === "paid" && d && inRange(d, from, to) && Number(i.total) > 0 && !hasRows[i.id])
        pays.push({
          date: d,
          type: "Invoice",
          client_id: i.client_id,
          ref: invNum(i.number),
          method: i.paid_method || "",
          amount: Number(i.total)
        });
      if (
        i.status !== "void" &&
        !i.period_start &&
        i.issue_date &&
        inRange(i.issue_date, from, to) &&
        Number(i.total) > 0
      )
        done.push({
          client_id: i.client_id,
          scheduled_date: i.issue_date,
          price: Number(i.total),
          manual: true
        });
    });
    /* payments entered on the Customer payment screen (partial, full, or on account) count the day they were received */
    invPays.forEach(function (x) {
      var d = String(x.paid_on || "").slice(0, 10),
        iv = x.invoice_id ? byId(invoices, x.invoice_id) : null;
      if (d && inRange(d, from, to) && Number(x.amount) > 0)
        pays.push({
          date: d,
          type: iv ? "Invoice payment" : "On account",
          client_id: x.client_id || (iv && iv.client_id),
          ref: iv ? invNum(iv.number) : "",
          method: x.method || "",
          amount: Number(x.amount)
        });
    });
    (rs[1].data || []).forEach(function (v) {
      if (Number(v.price) > 0 && v.paid_at)
        pays.push({
          date: String(v.paid_at).slice(0, 10),
          type: "Paid at visit",
          client_id: v.client_id,
          ref: "",
          method: v.paid_method || "",
          amount: Number(v.price)
        });
    });
    pays.sort(function (x, y) {
      return x.date < y.date ? -1 : 1;
    });
    var exs = expenses
      .filter(function (e) {
        return inRange(e.spent_on, from, to);
      })
      .sort(function (x, y) {
        return x.spent_on < y.spent_on ? 1 : -1;
      });
    var earned = r2(
        done.reduce(function (s, v) {
          return s + Number(v.price || 0);
        }, 0)
      ),
      collected = r2(
        pays.reduce(function (s, p) {
          return s + p.amount;
        }, 0)
      ),
      spent = r2(
        exs.reduce(function (s, e) {
          return s + Number(e.amount);
        }, 0)
      );
    var months = [],
      m = monthStart(from);
    while (m <= to && months.length < 36) {
      months.push({ k: m.slice(0, 7), label: monthName(m), earned: 0, collected: 0, spent: 0 });
      m = addDays(monthEndOf(m), 1);
    }
    function mo(k) {
      return months.filter(function (x) {
        return x.k === k;
      })[0];
    }
    done.forEach(function (v) {
      var x = mo(v.scheduled_date.slice(0, 7));
      if (x) x.earned += Number(v.price || 0);
    });
    pays.forEach(function (p) {
      var x = mo(p.date.slice(0, 7));
      if (x) x.collected += p.amount;
    });
    exs.forEach(function (e) {
      var x = mo(e.spent_on.slice(0, 7));
      if (x) x.spent += Number(e.amount);
    });
    var cat = {};
    exs.forEach(function (e) {
      cat[e.category || "Other"] = (cat[e.category || "Other"] || 0) + Number(e.amount);
    });
    var cats = Object.keys(cat)
      .map(function (k) {
        return { k: k, v: r2(cat[k]) };
      })
      .sort(function (x, y) {
        return y.v - x.v;
      });
    var cl = {};
    done.forEach(function (v) {
      cl[v.client_id] = (cl[v.client_id] || 0) + Number(v.price || 0);
    });
    var top = Object.keys(cl)
      .map(function (k) {
        return { k: k, v: r2(cl[k]) };
      })
      .filter(function (x) {
        return x.v > 0;
      })
      .sort(function (x, y) {
        return y.v - x.v;
      })
      .slice(0, 8);
    var meth = {};
    pays.forEach(function (p) {
      var k = p.method || "Other";
      meth[k] = (meth[k] || 0) + p.amount;
    });
    return {
      from: from,
      to: to,
      earned: earned,
      collected: collected,
      spent: spent,
      net: r2(collected - spent),
      months: months,
      cats: cats,
      top: top,
      meth: meth,
      pays: pays,
      exs: exs,
      visitsDone: done.filter(function (v) {
        return !v.manual;
      }).length
    };
  });
}
function sm(n) {
  n = r2(n);
  return n < 0 ? "-" + money(-n) : money(n);
}
function bars(list, rows, fmt, labelFn) {
  var max =
    rows.reduce(function (m, x) {
      return Math.max(m, x.v);
    }, 0) || 1;
  rows.forEach(function (x) {
    var r = el("div", "hrow"),
      lb = labelFn ? labelFn(x) : x.k;
    r.title = lb + ": " + fmt(x.v);
    r.appendChild(el("span", "hl", lb));
    var tr = el("span", "ht"),
      f = el("span", "hf");
    f.style.width = Math.max(1, Math.round((x.v / max) * 100)) + "%";
    tr.appendChild(f);
    r.appendChild(tr);
    r.appendChild(el("span", "hv", fmt(x.v)));
    list.appendChild(r);
  });
}
function agingBuckets() {
  var t = today(),
    b = [
      ["Not yet due", 0],
      ["1–30 days late", 0],
      ["31–60 days late", 0],
      ["Over 60 days late", 0]
    ];
  invoices.forEach(function (i) {
    if (i.status !== "open") return;
    var late = i.due_date && i.due_date < t ? ddiff(i.due_date, t) : 0,
      k = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3;
    b[k][1] += Number(i.total || 0);
  });
  return b;
}
function downloadCsv(name, rows) {
  var csv = rows
    .map(function (r) {
      return r
        .map(function (c) {
          c = String(c == null ? "" : c);
          return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
        })
        .join(",");
    })
    .join("\r\n");
  var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 500);
}
var repKey = "",
  repData = null,
  repAt = 0;
function renderReports() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  [
    ["overview", "Overview"],
    ["tax", "Tax Report"]
  ].forEach(function (s) {
    var b = el("button", "tab" + (rtab === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.addEventListener("click", function () {
      rtab = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  if (rtab === "tax") return renderTaxReport(list);
  if (billErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var r = periodRange(),
    key =
      r[0] +
      "|" +
      r[1] +
      "|" +
      invoices.length +
      "|" +
      expenses.length +
      "|" +
      invoices.filter(function (i) {
        return i.status === "paid";
      }).length;
  var grid = el("div", "repgrid"),
    left = el("div", "repleft"),
    right = el("div", "repright");
  grid.appendChild(left);
  grid.appendChild(right);
  list.appendChild(grid);
  periodBar(left);
  var out = el("div");
  left.appendChild(out);
  function draw(d, d3) {
    out.textContent = "";
    right.textContent = "";
    if (d.error || d3.error) {
      out.appendChild(
        el("div", "empty", "Could not load the report. Check your connection and press Refresh.")
      );
      return;
    }
    drawCharts(right, d, d3);
    $("topbtns").textContent = "";
    $("topbtns").appendChild(
      btn("Income CSV", "btn alt", function () {
        downloadCsv(
          "income_" + d.from + "_to_" + d.to + ".csv",
          [["Date", "Type", "Client", "Invoice", "Method", "Amount"]].concat(
            d.pays.map(function (p) {
              return [p.date, p.type, cname(p.client_id), p.ref, p.method, p.amount.toFixed(2)];
            })
          )
        );
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Expenses CSV", "btn alt", function () {
        downloadCsv(
          "expenses_" + d.from + "_to_" + d.to + ".csv",
          [["Date", "Category", "Vendor", "Note", "Client", "Amount"]].concat(
            d.exs.map(function (e) {
              return [
                e.spent_on,
                e.category,
                e.vendor,
                e.note,
                e.client_id ? cname(e.client_id) : "",
                Number(e.amount).toFixed(2)
              ];
            })
          )
        );
      })
    );
    var st = el("div", "stats");
    [
      ["Collected", money(d.collected), ""],
      ["Earned", money(d.earned), ""],
      ["Expenses", money(d.spent), ""],
      ["Net (collected − expenses)", sm(d.net), d.net < 0 ? "bad" : ""]
    ].forEach(function (x) {
      var c = el("div", "stat " + x[2]);
      c.appendChild(el("span", null, x[0]));
      c.appendChild(el("b", null, x[1]));
      st.appendChild(c);
    });
    out.appendChild(st);
    var nt = el(
      "div",
      "note",
      "Collected = money actually received (paid invoices plus payments at the visit). Earned = work completed in the period, whether or not it's paid yet." +
        (expErr ? " Expenses aren't set up yet, so they show as $0. Run the Stage 9 SQL." : "")
    );
    nt.style.marginBottom = "10px";
    out.appendChild(nt);
    var h1 = el("h3", null, "By month");
    h1.style.margin = "14px 0 6px";
    out.appendChild(h1);
    var tb = document.createElement("table");
    tb.className = "rtable";
    var hd = document.createElement("tr");
    ["Month", "Earned", "Collected", "Expenses", "Net"].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i) th.className = "r";
      hd.appendChild(th);
    });
    tb.appendChild(hd);
    d.months.forEach(function (m) {
      var tr = document.createElement("tr"),
        net = r2(m.collected - m.spent);
      [m.label, money(r2(m.earned)), money(r2(m.collected)), money(r2(m.spent)), sm(net)].forEach(
        function (x, i) {
          var td = document.createElement("td");
          td.textContent = x;
          if (i) td.className = "r";
          if (i === 4 && net < 0) td.style.color = "var(--red)";
          tr.appendChild(td);
        }
      );
      tb.appendChild(tr);
    });
    var wrap = el("div", "tscroll");
    wrap.appendChild(tb);
    out.appendChild(wrap);
    var h2 = el("h3", null, "Expenses by category");
    h2.style.margin = "18px 0 6px";
    out.appendChild(h2);
    if (d.cats.length) bars(out, d.cats, money);
    else out.appendChild(el("div", "note", "No expenses in this period."));
    var h3 = el("h3", null, "Top clients (work completed)");
    h3.style.margin = "18px 0 6px";
    out.appendChild(h3);
    if (d.top.length)
      bars(out, d.top, money, function (x) {
        return cname(x.k);
      });
    else out.appendChild(el("div", "note", "No completed work in this period."));
    var ms = Object.keys(d.meth);
    if (ms.length) {
      var h4 = el("h3", null, "How you were paid");
      h4.style.margin = "18px 0 6px";
      out.appendChild(h4);
      out.appendChild(
        el(
          "div",
          "note",
          ms
            .map(function (k) {
              return k + " " + money(r2(d.meth[k]));
            })
            .join(" · ")
        )
      );
    }
    var h5 = el("h3", null, "Unpaid invoices (as of today)");
    h5.style.margin = "18px 0 6px";
    out.appendChild(h5);
    var ag = agingBuckets(),
      tot = r2(
        ag.reduce(function (s, x) {
          return s + x[1];
        }, 0)
      );
    if (!tot) out.appendChild(el("div", "note", "Nothing owed right now."));
    else {
      var t2 = document.createElement("table");
      t2.className = "rtable";
      ag.forEach(function (x) {
        var tr = document.createElement("tr");
        var a = document.createElement("td");
        a.textContent = x[0];
        var b2 = document.createElement("td");
        b2.className = "r";
        b2.textContent = money(r2(x[1]));
        if (x[0] !== "Not yet due" && x[1] > 0) b2.style.color = "var(--red)";
        tr.appendChild(a);
        tr.appendChild(b2);
        t2.appendChild(tr);
      });
      var tr2 = document.createElement("tr");
      var a2 = document.createElement("td");
      a2.innerHTML = "<b>Total owed</b>";
      var b3 = document.createElement("td");
      b3.className = "r";
      b3.innerHTML = "<b>" + esc(money(tot)) + "</b>";
      tr2.appendChild(a2);
      tr2.appendChild(b3);
      t2.appendChild(tr2);
      var w2 = el("div", "tscroll");
      w2.appendChild(t2);
      out.appendChild(w2);
    }
  }
  if (repData && repKey === key && Date.now() - repAt < 20000) {
    draw(repData.d, repData.d3);
    return;
  }
  out.appendChild(el("div", "empty", "Loading the report..."));
  var m1 = monthStart(today()),
    f3 = monthStart(addDays(monthStart(addDays(m1, -1)), -1));
  Promise.all([computeReport(r[0], r[1]), computeReport(f3, today())]).then(function (rs) {
    repKey = key;
    repData = { d: rs[0], d3: rs[1] };
    repAt = Date.now();
    if (view === "reports" && rtab === "overview" && out.isConnected) draw(rs[0], rs[1]);
  });
}

/* ---- Pie (donut) charts on the Reports screen ---- */
var PIECOL = {
  slot1: "#2a78d6",
  slot2: "#eb6834",
  slot3: "#1baf7a",
  slot4: "#eda100",
  slot5: "#e87ba4",
  slot6: "#008300"
};
function svgEl(n, a) {
  var e = document.createElementNS("http://www.w3.org/2000/svg", n);
  for (var k in a) e.setAttribute(k, a[k]);
  return e;
}
function arcPath(cx, cy, r0, r1, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 0.0001) a1 = a0 + Math.PI * 2 - 0.0001;
  var big = a1 - a0 > Math.PI ? 1 : 0;
  function X(r, a) {
    return (cx + r * Math.sin(a)).toFixed(2);
  }
  function Y(r, a) {
    return (cy - r * Math.cos(a)).toFixed(2);
  }
  return (
    "M" +
    X(r1, a0) +
    " " +
    Y(r1, a0) +
    " A" +
    r1 +
    " " +
    r1 +
    " 0 " +
    big +
    " 1 " +
    X(r1, a1) +
    " " +
    Y(r1, a1) +
    " L" +
    X(r0, a1) +
    " " +
    Y(r0, a1) +
    " A" +
    r0 +
    " " +
    r0 +
    " 0 " +
    big +
    " 0 " +
    X(r0, a0) +
    " " +
    Y(r0, a0) +
    " Z"
  );
}
/* slices: [{label,v,color}] in a fixed order; the legend lists every slice with its amount and share, so no value depends on color alone. */
function pieChart(title, sub, slices, center, note) {
  var box = el("div", "pcard chart");
  box.appendChild(el("h3", null, title));
  box.appendChild(el("div", "note", sub));
  slices = slices.filter(function (s) {
    return s.v > 0.004;
  });
  var total = r2(
    slices.reduce(function (s, x) {
      return s + x.v;
    }, 0)
  );
  if (!total) {
    box.appendChild(el("div", "note", "Nothing to show yet for this period."));
    return box;
  }
  var wrap = el("div", "donut"),
    svg = svgEl("svg", {
      viewBox: "0 0 120 120",
      role: "img",
      "aria-label":
        title +
        ": " +
        slices
          .map(function (s) {
            return s.label + " " + money(r2(s.v));
          })
          .join(", ")
    });
  var a = 0;
  slices.forEach(function (s) {
    var ang = (s.v / total) * Math.PI * 2,
      pct = Math.round((s.v / total) * 100),
      p = svgEl("path", {
        d: arcPath(60, 60, 34, 56, a, a + ang),
        fill: s.color,
        "class": "sl",
        tabindex: "0"
      });
    var t = svgEl("title", {});
    t.textContent = s.label + ": " + money(r2(s.v)) + " (" + pct + "%)";
    p.appendChild(t);
    svg.appendChild(p);
    a += ang;
  });
  if (center) {
    var t1 = svgEl("text", { x: 60, y: center.small ? 58 : 64, "text-anchor": "middle", "class": "cbig" });
    t1.textContent = center.big;
    svg.appendChild(t1);
    if (center.small) {
      var t2 = svgEl("text", { x: 60, y: 72, "text-anchor": "middle", "class": "csm" });
      t2.textContent = center.small;
      svg.appendChild(t2);
    }
  }
  wrap.appendChild(svg);
  var lg = el("div", "lg2");
  slices.forEach(function (s) {
    var r = el("div", "lr"),
      sw = el("span", "sw");
    sw.style.background = s.color;
    r.appendChild(sw);
    r.appendChild(el("span", null, s.label));
    r.appendChild(el("span", "lv", money(r2(s.v))));
    r.appendChild(el("span", "lp", Math.round((s.v / total) * 100) + "%"));
    lg.appendChild(r);
  });
  wrap.appendChild(lg);
  box.appendChild(wrap);
  if (note) box.appendChild(el("div", "note", note));
  return box;
}
function pLabel() {
  return (
    {
      month: "This month",
      last: "Last month",
      quarter: "This quarter",
      ytd: "Year to date",
      lastyear: "Last year",
      custom: "Custom range"
    }[rper] || ""
  );
}
function drawCharts(host, d, d3) {
  host.textContent = "";
  /* 1: last 3 months of money received, by how it was paid */
  var order = ["Zelle", "Cash", "Check", "Other"],
    cols = [PIECOL.slot1, PIECOL.slot2, PIECOL.slot3, PIECOL.slot4],
    m = {};
  Object.keys(d3.meth).forEach(function (k) {
    var kk = order.indexOf(k) > -1 ? k : "Other";
    m[kk] = (m[kk] || 0) + d3.meth[k];
  });
  host.appendChild(
    pieChart(
      "Revenue by payment type",
      "Last 3 months · " + dshort(d3.from) + " – " + dshort(d3.to) + " · money received",
      order.map(function (k, i) {
        return { label: k, v: m[k] || 0, color: cols[i] };
      }),
      { big: money(d3.collected), small: "received" }
    )
  );
  /* 2: where each dollar of money received went: costs, then what's left as profit */
  var c = function (k) {
    return d.cats
      .filter(function (x) {
        return x.k === k;
      })
      .reduce(function (s, x) {
        return s + x.v;
      }, 0);
  };
  var labor = c("Crew pay"),
    fuel = c("Fuel") + c("Vehicle"),
    equip = c("Equipment & repairs"),
    mat = c("Materials & supplies"),
    over = c("Insurance & licenses") + c("Marketing") + c("Software & phone") + c("Other");
  var profit = Math.max(0, r2(d.collected - d.spent)),
    loss = d.spent > d.collected;
  host.appendChild(
    pieChart(
      "Where the money goes",
      pLabel() +
        " · " +
        dshort(d.from) +
        " – " +
        dshort(d.to) +
        " · received money split into costs and profit",
      [
        { label: "Labor (crew pay)", v: labor, color: PIECOL.slot1 },
        { label: "Fuel & vehicle", v: fuel, color: PIECOL.slot2 },
        { label: "Equipment & repairs", v: equip, color: PIECOL.slot3 },
        { label: "Materials & supplies", v: mat, color: PIECOL.slot4 },
        { label: "Overhead (insurance, marketing, software, other)", v: over, color: PIECOL.slot5 },
        { label: "Profit", v: profit, color: PIECOL.slot6 }
      ],
      {
        big: sm(d.net),
        small: d.collected > 0 && !loss ? Math.round((d.net / d.collected) * 100) + "% profit" : "net"
      },
      loss ? "Spending is higher than the money received in this period, so there is no profit slice." : ""
    )
  );
  /* 3: overall earnings: money made minus money spent */
  host.appendChild(
    pieChart(
      "Overall earnings",
      pLabel() + " · " + dshort(d.from) + " – " + dshort(d.to) + " · money made minus money spent",
      [
        { label: "Kept (net earnings)", v: Math.max(0, r2(d.collected - d.spent)), color: PIECOL.slot6 },
        {
          label: "Spent",
          v: Math.min(d.spent, d.collected) || (d.collected ? 0 : d.spent),
          color: PIECOL.slot2
        }
      ],
      { big: sm(d.net), small: "net earnings" },
      "Made " + money(d.collected) + " − spent " + money(d.spent) + " = " + sm(d.net) + "."
    )
  );
}

/* ======================= crm/src/14-expenses.js ======================= */
/* Expenses tab: the tax ledger, duplicate check, column filters, receipt scanning and pasting rows from a spreadsheet. */

/* ======= Expenses tab: the tax ledger (Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total) ======= */
/* The "amount" column in the database holds the TOTAL paid (amount + tax), so Reports keep working. The Amount shown here is total minus tax. */
var LCOLS = [
  "Code",
  "Date",
  "Vendor",
  "Description",
  "Category",
  "Payment",
  "Receipt #",
  "Amount",
  "Tax",
  "Total"
];
var LCSV = LCOLS.concat(["Tax description"]);
function m2(n) {
  return (
    "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
function mdy(s) {
  var m = String(s || "")
    .slice(0, 10)
    .split("-");
  return m.length === 3 ? +m[1] + "/" + +m[2] + "/" + m[0] : "";
}
function expTax(e) {
  return r2(Number(e.tax) || 0);
}
function expTotal(e) {
  return r2(Number(e.amount) || 0);
}
function expNet(e) {
  return r2(expTotal(e) - expTax(e));
}
function expYears(extra) {
  var ys = {};
  ys[String(new Date().getFullYear())] = 1;
  if (extra) ys[extra] = 1;
  expenses.forEach(function (e) {
    if (e.spent_on) ys[String(e.spent_on).slice(0, 4)] = 1;
  });
  return Object.keys(ys).sort().reverse();
}
function expInYear(y) {
  return expenses.filter(function (e) {
    return String(e.spent_on).slice(0, 4) === y;
  });
}
function lastBy(fn) {
  for (var i = 0; i < expenses.length; i++) {
    if (fn(expenses[i])) return expenses[i];
  }
  return null;
}
/* duplicate check: same receipt # from the same vendor, or same vendor + date + total */
function findDup(r, ignoreId) {
  var v = String(r.vendor || "")
      .trim()
      .toLowerCase(),
    rn = String(r.receipt_no || "")
      .trim()
      .toLowerCase(),
    tot = Number(r.amount);
  for (var i = 0; i < expenses.length; i++) {
    var x = expenses[i];
    if (ignoreId && x.id === ignoreId) continue;
    var xv = String(x.vendor || "")
      .trim()
      .toLowerCase();
    if (xv !== v) continue;
    if (
      rn &&
      String(x.receipt_no || "")
        .trim()
        .toLowerCase() === rn
    )
      return x;
    if (x.spent_on === r.spent_on && Math.abs(expTotal(x) - tot) < 0.005) return x;
  }
  return null;
}
function dupText(x) {
  return (
    (x.vendor || "(no vendor)") +
    " on " +
    mdy(x.spent_on) +
    " for " +
    m2(expTotal(x)) +
    (x.receipt_no ? " (receipt # " + x.receipt_no + ")" : "")
  );
}
function expCells(e) {
  return [
    e.code || "",
    mdy(e.spent_on),
    e.vendor || "",
    e.note || "",
    e.category || "",
    e.payment || "",
    e.receipt_no || "",
    m2(expNet(e)),
    m2(expTax(e)),
    m2(expTotal(e))
  ];
}
function expCsv(rows) {
  return [LCSV].concat(
    rows
      .slice()
      .sort(function (a, b) {
        return a.spent_on < b.spent_on ? -1 : a.spent_on > b.spent_on ? 1 : 0;
      })
      .map(function (e) {
        return [
          e.code || "",
          mdy(e.spent_on),
          e.vendor || "",
          e.note || "",
          e.category || "",
          e.payment || "",
          e.receipt_no || "",
          expNet(e).toFixed(2),
          expTax(e).toFixed(2),
          expTotal(e).toFixed(2),
          e.tax_note || ""
        ];
      })
  );
}
/* the small "Expenses" box: every category with its total for the year */
function expenseBox(year) {
  var rows = expInYear(year),
    by = {},
    box = el("div", "taxbox"),
    t = document.createElement("table");
  rows.forEach(function (e) {
    var c = e.category || "Other";
    by[c] = r2((by[c] || 0) + expTotal(e));
  });
  var hr = document.createElement("tr");
  ["Category", "Totals for each"].forEach(function (x, i) {
    var th = document.createElement("th");
    th.textContent = x;
    if (i) th.className = "r";
    hr.appendChild(th);
  });
  t.appendChild(hr);
  var total = 0;
  expCats().forEach(function (c) {
    var tr = document.createElement("tr"),
      a = document.createElement("td"),
      b = document.createElement("td");
    a.textContent = c;
    b.className = "r";
    b.textContent = m2(by[c] || 0);
    total += by[c] || 0;
    tr.appendChild(a);
    tr.appendChild(b);
    t.appendChild(tr);
  });
  var ft = document.createElement("tr");
  ft.className = "tot";
  var a2 = document.createElement("td");
  a2.textContent = "Overall Total";
  var b2 = document.createElement("td");
  b2.className = "r";
  b2.textContent = m2(r2(total));
  ft.appendChild(a2);
  ft.appendChild(b2);
  t.appendChild(ft);
  box.appendChild(t);
  return box;
}
/* column drop-downs on the expense table: sort and filter by any column */
function exKey(e, i) {
  switch (i) {
    case 0:
      return String(e.code || "").toLowerCase();
    case 1:
      return e.spent_on || "";
    case 2:
      return String(e.vendor || "").toLowerCase();
    case 3:
      return String(e.note || "").toLowerCase();
    case 4:
      return String(e.category || "").toLowerCase();
    case 5:
      return String(e.payment || "").toLowerCase();
    case 6:
      return String(e.receipt_no || "").toLowerCase();
    case 7:
      return expNet(e);
    case 8:
      return expTax(e);
    default:
      return expTotal(e);
  }
}
function exVal(e, i) {
  return i === 1
    ? String(e.spent_on || "").slice(5, 7)
    : String(
        i === 0
          ? e.code
          : i === 2
            ? e.vendor
            : i === 3
              ? e.note
              : i === 4
                ? e.category
                : i === 5
                  ? e.payment
                  : i === 6
                    ? e.receipt_no
                    : ""
      ) || "";
}
function exColOk(e) {
  for (var k in exF) {
    if (exF[k] != null && exF[k] !== "" && exVal(e, +k) !== exF[k]) return false;
  }
  return true;
}
var EXMONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var exOpen = null;
function exClose() {
  if (exOpen) {
    exOpen.remove();
    exOpen = null;
  }
}
document.addEventListener("click", function (e) {
  if (exOpen && !exOpen.contains(e.target)) exClose();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") exClose();
});
function exMenu(anchor, i, yr, redraw) {
  exClose();
  var m = el("div"),
    r = anchor.getBoundingClientRect(),
    num = i >= 7,
    date = i === 1;
  m.setAttribute("role", "menu");
  m.style.cssText =
    "position:fixed;z-index:60;background:#fff;color:#1c2a20;border:2px solid var(--forest);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.2);padding:8px;min-width:210px;max-width:300px;display:grid;gap:6px;left:" +
    Math.max(8, Math.min(r.left, window.innerWidth - 310)) +
    "px;top:" +
    (r.bottom + 4) +
    "px";
  function item(label, fn, on) {
    var b = btn(label, "btn alt sm", function () {
      fn();
      exClose();
      redraw();
    });
    b.style.cssText = "text-align:left;" + (on ? "background:var(--mint);font-weight:800" : "");
    m.appendChild(b);
  }
  item(
    date ? "Oldest first" : num ? "Low to high" : "A to Z",
    function () {
      exCol = i;
      exDir = 1;
    },
    exCol === i && exDir === 1
  );
  item(
    date ? "Newest first" : num ? "High to low" : "Z to A",
    function () {
      exCol = i;
      exDir = -1;
    },
    exCol === i && exDir === -1
  );
  if (!num) {
    var opts = [];
    if (date) {
      EXMONTHS.forEach(function (n, k) {
        opts.push([("0" + (k + 1)).slice(-2), n]);
      });
    } else {
      var seen = {};
      yr.forEach(function (e) {
        var v = exVal(e, i);
        if (v && !seen[v]) {
          seen[v] = 1;
          opts.push([v, v]);
        }
      });
      opts.sort(function (a, b) {
        return a[1].toLowerCase() < b[1].toLowerCase() ? -1 : 1;
      });
    }
    var sel = fld(
      date ? "Show only month" : "Show only",
      "select",
      exF[i] || "",
      [["", date ? "All months" : "All"]].concat(opts)
    );
    sel.style.cssText = "margin:4px 0 0";
    sel.input.addEventListener("change", function () {
      exF[i] = sel.input.value;
      exShown = 300;
      exClose();
      redraw();
    });
    m.appendChild(sel);
  }
  var any = Object.keys(exF).some(function (k) {
    return exF[k];
  });
  if (any || exCol !== 1 || exDir !== -1)
    item(
      "Clear all sorting and filters",
      function () {
        exF = {};
        exCol = 1;
        exDir = -1;
        exShown = 300;
      },
      false
    );
  document.body.appendChild(m);
  exOpen = m;
  m.querySelector("button,select").focus();
}
function renderExpensesView() {
  exClose();
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  if (expErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Expenses aren't set up yet. Run the Stage 9 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var tb = $("topbtns");
  tb.appendChild(
    btn("+ Add expense", "btn", function () {
      openExpense(null);
    })
  );
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Scan receipt", "btn alt", openScan));
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Paste from Excel", "btn alt", openExpPaste));
  if (expenses.length && !("tax" in expenses[0])) {
    var wn = el(
      "div",
      "note",
      "Run the Stage 13 SQL in Supabase to turn on Code, Payment, Receipt # and Tax, then press Refresh."
    );
    wn.style.cssText = "color:#7a5b00;margin-bottom:8px";
    list.appendChild(wn);
  }
  var bar = el("div", "invbar");
  var ys = fld(
    "Year",
    "select",
    exYear,
    expYears(exYear).map(function (y) {
      return [y, y];
    })
  );
  ys.style.cssText = "margin:0;min-width:110px";
  ys.input.addEventListener("change", function () {
    exYear = ys.input.value;
    exShown = 300;
    render();
  });
  var cf = fld(
    "Category",
    "select",
    exCat,
    [["all", "All categories"]].concat(
      expCats().map(function (c) {
        return [c, c];
      })
    )
  );
  cf.style.cssText = "margin:0;min-width:200px";
  cf.input.addEventListener("change", function () {
    exCat = cf.input.value;
    exShown = 300;
    render();
  });
  var si = document.createElement("input");
  si.type = "search";
  si.placeholder = "Search vendor, description, receipt #...";
  si.value = exq;
  si.setAttribute("aria-label", "Search expenses");
  si.style.cssText = "flex:1;min-width:200px";
  bar.appendChild(ys);
  bar.appendChild(cf);
  bar.appendChild(si);
  list.appendChild(bar);
  var det = document.createElement("details");
  det.open = true;
  det.className = "exbox";
  var sum = document.createElement("summary");
  sum.textContent = "Expenses by category · " + exYear;
  det.appendChild(sum);
  det.appendChild(expenseBox(exYear));
  var lay = el("div", "exlayout"),
    body = el("div", "exmain");
  det.classList.add("exside");
  lay.appendChild(body);
  lay.appendChild(det);
  list.appendChild(lay);
  function draw() {
    body.textContent = "";
    var t = invToks(exq);
    var yr = expInYear(exYear);
    var rows = yr.filter(function (e) {
      return (
        (exCat === "all" || e.category === exCat) &&
        exColOk(e) &&
        (!t.length ||
          t.every(function (x) {
            return (expCells(e).join(" ") + " " + (e.tax_note || "")).toLowerCase().indexOf(x) > -1;
          }))
      );
    });
    rows.sort(function (a, b) {
      var ka = exKey(a, exCol),
        kb = exKey(b, exCol),
        c = ka < kb ? -1 : ka > kb ? 1 : 0;
      if (c) return c * exDir;
      return a.spent_on === b.spent_on ? 0 : a.spent_on < b.spent_on ? 1 : -1;
    });
    var sn = 0,
      st = 0,
      sT = 0;
    rows.forEach(function (e) {
      sn += expNet(e);
      st += expTax(e);
      sT += expTotal(e);
    });
    var hd = el(
      "div",
      "note",
      rows.length +
        " expense" +
        (rows.length === 1 ? "" : "s") +
        " · Amount " +
        m2(r2(sn)) +
        " · Tax " +
        m2(r2(st)) +
        " · Total " +
        m2(r2(sT))
    );
    hd.style.cssText = "font-weight:700;margin:12px 0 6px";
    body.appendChild(hd);
    if (!rows.length) {
      body.appendChild(
        el(
          "div",
          "empty",
          expenses.length
            ? "Nothing matches. Try another year or category."
            : "No expenses yet. Tap + Add expense, Scan receipt, or Paste from Excel."
        )
      );
      return;
    }
    var wrap = el("div", "invwrap"),
      t2 = document.createElement("table");
    t2.className = "exgrid";
    var cg = document.createElement("colgroup");
    [5.5, 9.5, 9, 18, 13.5, 9, 10.5, 8.5, 7.5, 9].forEach(function (w) {
      var c = document.createElement("col");
      c.style.width = w + "%";
      cg.appendChild(c);
    });
    t2.appendChild(cg);
    var hr = document.createElement("tr");
    LCOLS.forEach(function (c, i) {
      var th = document.createElement("th");
      if (i >= 7) th.className = "num";
      var on = exCol === i,
        fl = exF[i] != null && exF[i] !== "";
      var b = btn(c + (on ? (exDir < 0 ? " ▼" : " ▲") : "") + (fl ? " ●" : "") + " ▾", "hcol", function (ev) {
        ev.stopPropagation();
        exMenu(b, i, yr, draw);
      });
      b.setAttribute("aria-haspopup", "menu");
      b.title = "Sort or filter by " + c;
      th.appendChild(b);
      hr.appendChild(th);
    });
    var th_ = document.createElement("thead");
    th_.appendChild(hr);
    t2.appendChild(th_);
    var tbd = document.createElement("tbody");
    rows.slice(0, exShown).forEach(function (e) {
      var tr = document.createElement("tr");
      tr.tabIndex = 0;
      expCells(e).forEach(function (v, i) {
        var td = document.createElement("td");
        td.textContent = v;
        if (i >= 7) td.className = "num";
        tr.appendChild(td);
      });
      tr.addEventListener("click", function () {
        openExpense(e);
      });
      tr.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") openExpense(e);
      });
      tbd.appendChild(tr);
    });
    t2.appendChild(tbd);
    var tf = document.createElement("tfoot"),
      fr = document.createElement("tr");
    LCOLS.forEach(function (c, i) {
      var td = document.createElement("td");
      if (i === 0) td.textContent = "Total";
      if (i === 7) {
        td.textContent = m2(r2(sn));
        td.className = "num";
      }
      if (i === 8) {
        td.textContent = m2(r2(st));
        td.className = "num";
      }
      if (i === 9) {
        td.textContent = m2(r2(sT));
        td.className = "num";
      }
      fr.appendChild(td);
    });
    tf.appendChild(fr);
    t2.appendChild(tf);
    wrap.appendChild(t2);
    body.appendChild(wrap);
    if (rows.length > exShown)
      body.appendChild(
        btn("Show more (" + (rows.length - exShown) + " left)", "btn alt sm", function () {
          exShown += 300;
          draw();
        })
      );
    var acts = el("div", "invacts");
    acts.appendChild(
      btn("Download " + exYear + " as CSV (opens in Excel)", "btn alt sm", function () {
        downloadCsv("expenses_" + exYear + ".csv", expCsv(rows));
      })
    );
    body.appendChild(acts);
  }
  si.addEventListener("input", function () {
    exq = si.value;
    exShown = 300;
    draw();
  });
  draw();
}

function openExpense(e, pre, scanFile) {
  pre = pre || {};
  var src = e || pre,
    splitIds = pre.splitIds || {};
  var p = panel();
  p.appendChild(el("h2", null, e ? "Expense" : "Add expense"));
  if (scanFile && !e) {
    var sn_ = el(
      "div",
      "pcard",
      "✓ Read from your receipt photo" +
        (pre.known ? " and filled in from your last purchase at " + pre.vendor : "") +
        ". Please check every field before saving."
    );
    sn_.style.cssText = "background:var(--mint);font-weight:600";
    p.appendChild(sn_);
  }
  var codes = {},
    vendors = {};
  expenses.forEach(function (x) {
    if (x.code) codes[x.code] = 1;
    if (x.vendor) vendors[x.vendor] = 1;
  });
  function dl(id, obj) {
    var d = document.createElement("datalist");
    d.id = id;
    Object.keys(obj)
      .sort()
      .forEach(function (k) {
        var o = document.createElement("option");
        o.value = k;
        d.appendChild(o);
      });
    p.appendChild(d);
  }
  dl("exVendors", vendors);
  (function () {
    var d = document.createElement("datalist");
    d.id = "exCodes";
    CODE_CAT.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c[0];
      o.label = c[0] + " - " + c[1];
      o.textContent = c[1];
      d.appendChild(o);
    });
    Object.keys(codes)
      .sort()
      .forEach(function (k) {
        if (!catOfCode(k)) {
          var o = document.createElement("option");
          o.value = k;
          d.appendChild(o);
        }
      });
    p.appendChild(d);
  })();
  var code = fld("Code (pick or type, up to 4 letters)", "text", src.code || ""),
    dt = fld("Date", "text", mdy(e ? e.spent_on : pre.date || today()));
  dt.input.placeholder = "MM/DD/YYYY";
  dt.input.inputMode = "numeric";
  dt.input.autocomplete = "off";
  var dpk = document.createElement("input");
  dpk.type = "date";
  dpk.tabIndex = -1;
  dpk.setAttribute("aria-hidden", "true");
  dpk.style.cssText = "position:absolute;opacity:0;pointer-events:none;width:1px;height:1px";
  dpk.value = e ? e.spent_on : pre.date || today();
  var dbtn = btn("📅", "btn alt sm", function () {
    dpk.value = dtVal() || today();
    try {
      dpk.showPicker();
    } catch (x) {
      dpk.focus();
      dpk.click();
    }
  });
  dbtn.style.cssText = "margin:0;flex:none;padding:0 12px;min-height:42px";
  dbtn.setAttribute("aria-label", "Open calendar");
  dbtn.type = "button";
  var drow = el("div");
  drow.style.cssText = "display:flex;gap:8px;align-items:stretch;position:relative";
  dt.input.style.cssText = "flex:1;min-width:0";
  dt.appendChild(drow);
  drow.appendChild(dt.input);
  drow.appendChild(dbtn);
  drow.appendChild(dpk);
  function dtVal() {
    return parseDateLoose(dt.input.value) || "";
  }
  /* typing only digits (like 10232026) adds the slashes for you; if you type your own slashes they are left alone */
  dt.input.addEventListener("input", function () {
    var v = dt.input.value;
    if (!/^(\d+|\d{2}\/\d{1,2}|\d{2}\/\d{2}\/?\d*)$/.test(v)) return;
    var d = v.replace(/\D/g, ""),
      o = d.slice(0, 2);
    if (d.length > 2) o += "/" + d.slice(2, 4);
    if (d.length > 4) o += "/" + d.slice(4, 8);
    if (o !== v) dt.input.value = o;
  });
  dpk.addEventListener("change", function () {
    if (dpk.value) {
      dt.input.value = mdy(dpk.value);
      dt.input.dispatchEvent(new Event("input"));
    }
  });
  code.input.setAttribute("list", "exCodes");
  code.input.maxLength = 4;
  var g1 = el("div", "grid2");
  g1.appendChild(code);
  g1.appendChild(dt);
  p.appendChild(g1);
  var ve = fld("Vendor", "text", src.vendor || "");
  ve.input.setAttribute("list", "exVendors");
  p.appendChild(ve);
  var no = fld("Description", "text", e ? e.note : pre.description || "");
  p.appendChild(no);
  var cats = expCats();
  if (src.category && cats.indexOf(src.category) < 0) cats.push(src.category);
  var cat = fld(
    "Category",
    "select",
    src.category || "",
    [["", "Choose a category..."]].concat(
      cats.map(function (c) {
        return [c, c];
      })
    )
  );
  var pays = PAYMENTS.slice();
  if (src.payment && pays.indexOf(src.payment) < 0) pays.push(src.payment);
  var pay = fld(
    "Payment",
    "select",
    src.payment || "Debit",
    pays.map(function (c) {
      return [c, c];
    })
  );
  var g2 = el("div", "grid2");
  g2.appendChild(cat);
  g2.appendChild(pay);
  p.appendChild(g2);
  var rn = fld("Receipt #", "text", src.receipt_no || "");
  p.appendChild(rn);
  var DEF_TAXP = 7.5,
    haveTax = !!(e || pre.amount != null || pre.tax);
  var am = fld("Amount ($, before tax)", "number", e ? expNet(e) : pre.amount != null ? pre.amount : ""),
    tx = fld("or tax amount ($)", "number", e ? expTax(e) || "" : pre.tax || ""),
    tp = fld("Tax rate (%)", "number", "");
  am.input.step = "0.01";
  am.input.inputMode = "decimal";
  tx.input.step = "0.01";
  tx.input.inputMode = "decimal";
  tx.input.min = "0";
  tp.input.step = "0.01";
  tp.input.min = "0";
  tp.input.inputMode = "decimal";
  tp.input.placeholder = "7.5";
  tp.input.setAttribute("list", "exTaxP");
  var tpl = document.createElement("datalist");
  tpl.id = "exTaxP";
  [0, 6, 6.5, 7, 7.5].forEach(function (v) {
    var o = document.createElement("option");
    o.value = v;
    o.label = v + "%";
    tpl.appendChild(o);
  });
  p.appendChild(tpl);
  /* tx.input holds the tax in dollars (not shown). It is kept exactly as scanned or saved until you change the amount or the rate. */
  var fixedTax = haveTax && (parseFloat(tx.input.value) || 0) > 0;
  (function () {
    var a = parseFloat(am.input.value) || 0,
      t = parseFloat(tx.input.value) || 0;
    tp.input.value = haveTax
      ? a > 0 && t > 0
        ? String(Math.round((t / a) * 10000) / 100)
        : "0"
      : String(DEF_TAXP);
  })();
  function calcTax() {
    var a = parseFloat(am.input.value) || 0,
      pc = parseFloat(tp.input.value) || 0;
    tx.input.value = pc > 0 ? String(r2((a * pc) / 100)) : "";
  }
  if (!haveTax) calcTax();
  p.appendChild(am);
  var g3 = el("div", "grid2");
  g3.appendChild(tp);
  g3.appendChild(tx);
  p.appendChild(g3);
  p.appendChild(
    el(
      "div",
      "note",
      "Type the tax rate, or the tax amount if you know it. Tax is added to the amount to make the total. For a receipt with different tax rates, add each part as its own item (Save and add another item)."
    )
  );
  var tot = el("div", "invtotal");
  function upd() {
    var a = parseFloat(am.input.value) || 0,
      t = parseFloat(tx.input.value) || 0;
    tot.textContent = "Amount " + m2(a) + " + Tax " + m2(t) + " = Total " + m2(r2(a + t));
  }
  upd();
  am.input.addEventListener("input", function () {
    fixedTax = false;
    calcTax();
    upd();
  });
  tp.input.addEventListener("input", function () {
    fixedTax = false;
    calcTax();
    upd();
  });
  tx.input.addEventListener("input", function () {
    fixedTax = true;
    var a = parseFloat(am.input.value) || 0,
      t = parseFloat(tx.input.value) || 0;
    tp.input.value = a > 0 && t > 0 ? String(Math.round((t / a) * 10000) / 100) : "";
    upd();
    chk();
  });
  p.appendChild(tot);
  var tn = fld("Tax description (notes for your accountant)", "textarea", e ? e.tax_note || "" : "");
  tn.input.placeholder = "Why this was bought, what it was used for, how it should be treated for taxes...";
  p.appendChild(tn);
  var dw = el("div", "pcard");
  dw.style.cssText = "background:#fff3c4;border-color:#e0c25a;color:#7a5b00;font-weight:600";
  dw.hidden = true;
  p.appendChild(dw);
  function cur() {
    var a = parseFloat(am.input.value) || 0,
      t = parseFloat(tx.input.value) || 0;
    return { spent_on: dtVal(), amount: r2(a + t), vendor: ve.input.value, receipt_no: rn.input.value };
  }
  function chk() {
    var d = findDup(cur(), e && e.id);
    if (d && splitIds[d.id]) d = null;
    dw.hidden = !d;
    if (d) dw.textContent = "⚠ Possible duplicate: " + dupText(d) + " is already saved.";
  }
  [dt, ve, rn, am, tp].forEach(function (f) {
    f.input.addEventListener("input", chk);
    f.input.addEventListener("change", chk);
  });
  setTimeout(chk, 0);
  var cl = fld(
    "For a client's job (optional)",
    "select",
    e && e.client_id ? e.client_id : "",
    [["", "None"]].concat(
      clients
        .filter(function (c) {
          return !c.archived || (e && e.client_id === c.id);
        })
        .map(function (c) {
          return [c.id, c.name];
        })
    )
  );
  p.appendChild(cl);
  /* remember the code and details you used last time for the same category or vendor */
  var touched = { code: !!(e || pre.code), cat: !!(e || pre.category) };
  code.input.addEventListener("input", function () {
    touched.code = true;
  });
  cat.input.addEventListener("change", function () {
    touched.cat = true;
    var c2 = codeOfCat(cat.input.value);
    if (c2) {
      code.input.value = c2;
      touched.code = false;
    } else if (!code.input.value || !touched.code) {
      var l = lastBy(function (x) {
        return x.category === cat.input.value && x.code;
      });
      if (l) {
        code.input.value = l.code;
        touched.code = false;
      }
    }
  });
  function codeSync() {
    var cc = catOfCode(code.input.value);
    if (cc) {
      if (cat.input.value !== cc) {
        var has = false;
        for (var i = 0; i < cat.input.options.length; i++) if (cat.input.options[i].value === cc) has = true;
        if (!has) {
          var o = document.createElement("option");
          o.value = cc;
          o.textContent = cc;
          cat.input.appendChild(o);
        }
        cat.input.value = cc;
        touched.cat = true;
      }
    }
  }
  code.input.addEventListener("input", function () {
    var u = code.input.value.toUpperCase();
    if (u !== code.input.value) code.input.value = u;
    codeSync();
  });
  code.input.addEventListener("change", codeSync);
  ve.input.addEventListener("change", function () {
    if (e) return;
    var v = ve.input.value.trim().toLowerCase();
    if (!v) return;
    var l = lastBy(function (x) {
      return x.vendor && x.vendor.toLowerCase() === v;
    });
    if (!l) return;
    if (!touched.cat && l.category) {
      cat.input.value = l.category;
      var c3 = codeOfCat(l.category);
      if (c3 && !touched.code) code.input.value = c3;
    }
    if (!code.input.value && l.code) code.input.value = l.code;
    if (!no.input.value && l.note) no.input.value = l.note;
    if (l.payment) pay.input.value = l.payment;
  });
  var pend = [],
    keep = null;
  if (!photoErr) {
    var rc = el("div", "sec"),
      rh = el("h3", null, scanFile && !e ? "Receipt photo" : "Receipt photos (optional)");
    rc.appendChild(rh);
    if (scanFile && !e) {
      var lb = el("label");
      lb.style.cssText = "display:flex;gap:8px;align-items:center;font-weight:600";
      keep = document.createElement("input");
      keep.type = "checkbox";
      keep.style.width = "auto";
      lb.appendChild(keep);
      lb.appendChild(document.createTextNode(" Keep a copy of the receipt photo (uses storage)"));
      rc.appendChild(lb);
      rc.appendChild(
        el(
          "div",
          "note",
          "Leave this off to save space. The photo was only read on your device. Nothing has been uploaded, and it's discarded when you close this."
        )
      );
    } else {
      var rg = el("div");
      rc.appendChild(rg);
      var have = e
        ? photos.filter(function (x) {
            return x.expense_id === e.id;
          })
        : [];
      if (have.length)
        photoGrid(rg, have, {
          onTile: function (ph, i) {
            openLightbox(have, i);
          }
        });
      var pn = el("div", "note");
      function pnTxt() {
        pn.textContent = pend.length
          ? pend.length + " photo" + (pend.length > 1 ? "s" : "") + " ready. They upload when you press Save."
          : have.length
            ? ""
            : "No receipt photo kept. Photos use storage, so only keep the ones you need.";
      }
      pnTxt();
      var rb = el("div", "pbar2");
      rb.appendChild(
        btn("Take photo", "btn alt sm", function () {
          pickPhotos(true, function (fs) {
            pend = pend.concat(fs);
            pnTxt();
          });
        })
      );
      rb.appendChild(
        btn("Choose photo", "btn alt sm", function () {
          pickPhotos(false, function (fs) {
            pend = pend.concat(fs);
            pnTxt();
          });
        })
      );
      rc.appendChild(rb);
      rc.appendChild(pn);
    }
    p.appendChild(rc);
  }
  var acts = el("div", "acts");
  acts.style.marginTop = "12px";
  var again = false;
  function doSave() {
    var a = parseFloat(am.input.value),
      t = parseFloat(tx.input.value);
    if (isNaN(t)) t = 0;
    if (isNaN(a) || a < 0 || t < 0) {
      alert("Enter the amount (and tax if any).");
      return;
    }
    if (!dtVal()) {
      alert("Enter the date like 10/21/2026, or tap the calendar.");
      return;
    }
    if (!cat.input.value) {
      alert("Pick a category.");
      return;
    }
    var row = {
      spent_on: dtVal(),
      amount: r2(a + t),
      tax: r2(t),
      category: cat.input.value,
      vendor: ve.input.value.trim(),
      note: no.input.value.trim(),
      code: code.input.value.trim(),
      payment: pay.input.value,
      receipt_no: rn.input.value.trim(),
      client_id: cl.input.value || null
    };
    var tnv = tn.input.value.trim();
    if (tnv || (expenses.length && "tax_note" in expenses[0])) row.tax_note = tnv;
    var dup = findDup(row, e && e.id);
    if (dup && splitIds[dup.id]) dup = null;
    if (dup && !confirm("This looks like a duplicate of " + dupText(dup) + ".\n\nSave it anyway?")) return;
    sv.disabled = true;
    var q = e
      ? sb.from("expenses").update(row).eq("id", e.id).select().single()
      : sb
          .from("expenses")
          .insert(Object.assign({ created_by: myEmail || "" }, row))
          .select()
          .single();
    q.then(function (r) {
      sv.disabled = false;
      if (r.error || !r.data) {
        alert("Could not save. Did you run the Stage 9, Stage 13 and Stage 16 SQL in Supabase?");
        return;
      }
      if (e) Object.assign(e, r.data);
      else expenses.unshift(r.data);
      repData = null;
      var files = pend.slice();
      if (keep && keep.checked && scanFile) files.push(scanFile);
      function done() {
        if (again) {
          var ids = Object.assign({}, splitIds);
          ids[r.data.id] = 1;
          closeDetail();
          render();
          openExpense(null, {
            date: r.data.spent_on,
            vendor: r.data.vendor,
            receipt_no: r.data.receipt_no,
            payment: r.data.payment,
            code: r.data.code,
            splitIds: ids
          });
          setTimeout(function () {
            $("panel").scrollTop = 0;
            $("detail").scrollTop = 0;
            var f = $("panel").querySelector("input[type=number]");
            if (f) f.focus({ preventScroll: true });
          }, 0);
        } else {
          closeDetail();
          render();
        }
      }
      if (!files.length) {
        done();
        return;
      }
      sv.disabled = true;
      sv.textContent = "Uploading photo...";
      uploadMany(files, { expense_id: r.data.id, client_id: r.data.client_id, kind: "receipt" }).then(
        function (res) {
          var msg = uploadMsg(res);
          if (msg) alert(msg);
          done();
        }
      );
    });
  }
  var sv = btn("Save", "btn", function () {
    again = false;
    doSave();
  });
  acts.appendChild(sv);
  if (!e)
    acts.appendChild(
      btn("Save and add another item", "btn alt", function () {
        again = true;
        doSave();
      })
    );
  if (e)
    acts.appendChild(
      btn("Delete", "btn danger", function () {
        if (!confirm("Delete this expense?")) return;
        sb.from("expenses")
          .delete()
          .eq("id", e.id)
          .then(function (r) {
            if (r.error) {
              alert("Could not delete.");
              return;
            }
            expenses = expenses.filter(function (z) {
              return z.id !== e.id;
            });
            repData = null;
            closeDetail();
            render();
          });
      })
    );
  p.appendChild(acts);
}

/* ---- scan a receipt: read on this device, fill the form, throw the photo away ---- */
/*PARSE_START*/
function parseReceipt(text, known) {
  var raw = String(text || ""),
    low = raw.toLowerCase(),
    lines = raw
      .split(/\r?\n/)
      .map(function (l) {
        return l.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean),
    out = {};
  function nums(str) {
    var m = String(str).match(/\d[\d,]*[.,]\d{2}(?!\d)/g) || [];
    return m
      .map(function (s) {
        var i = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
        return parseFloat(s.slice(0, i).replace(/[.,]/g, "") + "." + s.slice(i + 1));
      })
      .filter(function (n) {
        return !isNaN(n);
      });
  }
  function iso(y, mo, d) {
    y = +y;
    mo = +mo;
    d = +d;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
  }
  var m,
    date = null;
  if ((m = low.match(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/))) date = iso(m[1], m[2], m[3]);
  if (!date && (m = low.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/))) {
    var a = +m[1],
      b = +m[2];
    if (a > 12 && b <= 12) {
      var t_ = a;
      a = b;
      b = t_;
    }
    date = iso(m[3], a, b);
  }
  if (
    !date &&
    (m = raw.match(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i
    ))
  ) {
    date = iso(
      m[3],
      ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
        m[1].toLowerCase()
      ) + 1,
      m[2]
    );
  }
  if (date) out.date = date;
  var total = null,
    sub = null,
    tax = 0,
    taxFound = false,
    totalTax = null,
    all = nums(raw);
  lines.forEach(function (l) {
    var ll = l.toLowerCase(),
      n = nums(l);
    if (!n.length) return;
    if (/sub\s*-?\s*total/.test(ll)) {
      sub = n[n.length - 1];
      return;
    }
    if (/total\s*tax|tax\s*total/.test(ll)) {
      totalTax = n[n.length - 1];
      taxFound = true;
      return;
    }
    if (/\btax\b/.test(ll) && !/taxable|tax\s*id|exempt/.test(ll)) {
      tax += n[n.length - 1];
      taxFound = true;
      return;
    }
    if (
      /(grand\s*)?total|amount\s*due|balance\s*due|amount\s*paid|total\s*due|sale\s*amount|visa|mastercard|debit/.test(
        ll
      ) &&
      !/savings|change|points|items/.test(ll)
    ) {
      var mx = Math.max.apply(null, n);
      if (total == null || mx > total) total = mx;
    }
  });
  if (totalTax != null) tax = totalTax;
  if (total == null && all.length) total = Math.max.apply(null, all);
  if (total != null) {
    tax = taxFound ? Math.round(tax * 100) / 100 : 0;
    if (tax >= total) tax = 0;
    var amt = Math.round((total - tax) * 100) / 100;
    if (sub != null && tax && Math.abs(sub + tax - total) < 0.02) amt = sub;
    out.amount = amt;
    out.tax = tax;
  }
  var vend = "",
    kn = [];
  (known || []).forEach(function (x) {
    if (x.vendor && x.vendor.length >= 3 && kn.indexOf(x.vendor) < 0) kn.push(x.vendor);
  });
  kn.sort(function (a, b) {
    return b.length - a.length;
  });
  for (var i = 0; i < kn.length; i++) {
    if (low.indexOf(kn[i].toLowerCase()) > -1) {
      vend = kn[i];
      out.known = true;
      break;
    }
  }
  if (!vend) {
    for (var j = 0; j < Math.min(lines.length, 8); j++) {
      var l = lines[j],
        letters = (l.match(/[a-z]/gi) || []).length;
      if (
        letters >= 3 &&
        letters / l.length > 0.6 &&
        l.length <= 40 &&
        !/receipt|invoice|welcome|thank|www|\.com|tel|phone|customer|cashier|store\s*#|date|time/i.test(l)
      ) {
        vend = l;
        break;
      }
    }
    if (vend && vend === vend.toUpperCase())
      vend = vend.toLowerCase().replace(/\b[a-z]/g, function (c) {
        return c.toUpperCase();
      });
  }
  if (vend) out.vendor = vend;
  for (var k = 0; k < lines.length; k++) {
    var mm = lines[k].match(
      /(?:receipt|rcpt|invoice|inv|trans(?:action)?|ref|order|ticket)\s*(?:no\.?|number|num|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i
    );
    if (mm && /\d/.test(mm[1])) {
      out.receipt_no = mm[1];
      break;
    }
  }
  out.payment =
    /\bcash\b/.test(low) && !/cash\s*back/.test(low)
      ? "Cash"
      : /\bcheck\b|\bcheque\b/.test(low)
        ? "Check"
        : /\bcredit\b/.test(low)
          ? "Credit"
          : "Debit";
  var head = (vend + " " + low.slice(0, 400)).toLowerCase(),
    G = [
      [
        /shell|chevron|racetrac|wawa|sunoco|exxon|bp\b|speedway|7-eleven|murphy|unleaded|gasoline|diesel|fuel|pump/,
        "Fuel"
      ],
      [/autozone|o'?reilly|advance auto|napa|pep boys|tire|oil change/, "Vehicle Repairs & Maintenance"],
      [
        /mcdonald|subway|wendy|burger|pizza|cafe|grill|dunkin|starbucks|chick-?fil|taco|restaurant|kitchen|diner|bbq|waffle|sonic|domino/,
        "Meal"
      ],
      [/publix|aldi|winn|walmart|sam'?s|costco|target|grocer|market/, "Groceries"],
      [/dump|landfill|solid waste|recycl/, "Dump/Recycling"],
      [/usps|postal|fedex|ups store|stamps|postage/, "Postage & Shipping"],
      [/home depot|lowe'?s|ace hardware|harbor freight|tractor supply|hardware/, "Supplies"],
      [/staples|office depot|officemax/, "Office Supplies"],
      [/insurance|geico|progressive|state farm/, "Insurance"]
    ];
  for (var g = 0; g < G.length; g++) {
    if (G[g][0].test(head)) {
      out.category = G[g][1];
      break;
    }
  }
  var prev = null;
  if (out.known && vend) {
    for (var q = 0; q < (known || []).length; q++) {
      if (known[q].vendor === vend) {
        prev = known[q];
        break;
      }
    }
  }
  if (prev) {
    if (prev.category) out.category = prev.category;
    if (prev.code) out.code = prev.code;
    if (prev.note) out.description = prev.note;
    if (prev.payment) out.payment = prev.payment;
  }
  return out;
}
/*PARSE_END*/
function loadTess() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise(function (res, rej) {
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.onload = function () {
      window.Tesseract ? res(window.Tesseract) : rej(new Error("ocr"));
    };
    s.onerror = function () {
      rej(new Error("ocr"));
    };
    document.head.appendChild(s);
  });
}
function openScan() {
  var p = panel();
  p.appendChild(el("h2", null, "Scan a receipt"));
  p.appendChild(
    el(
      "p",
      "note",
      "Take a photo of the receipt or choose one. Foreman reads it right on this device and fills in the date, vendor, amount and tax for you to check. The photo is not uploaded or stored, so it uses no space (you can choose to keep a copy on the next screen). The first scan downloads a small reading tool, so it needs internet and takes a little longer."
    )
  );
  var st = el("div", "note");
  st.style.cssText = "font-weight:700;margin:10px 0;min-height:1.4em";
  function go(files) {
    var f = files[0];
    if (!f) return;
    st.textContent = "Preparing the photo...";
    loadImg(f)
      .then(function (img) {
        return toJpeg(img, 1600, 0.9);
      })
      .then(function (r) {
        st.textContent = "Loading the reading tool...";
        return loadTess().then(function (T) {
          return T.recognize(r.blob, "eng", {
            logger: function (m) {
              if (m && m.status === "recognizing text")
                st.textContent = "Reading the receipt... " + Math.round((m.progress || 0) * 100) + "%";
            }
          });
        });
      })
      .then(function (res) {
        var text = (res && res.data && res.data.text) || "";
        var pre = parseReceipt(text, expenses);
        openExpense(null, pre, f);
      })
      .catch(function () {
        st.textContent = "";
        alert(
          "Couldn't read that receipt automatically (it may need internet, or the photo may be too blurry). The form will open so you can type it in. Your photo was not uploaded."
        );
        openExpense(null, {}, f);
      });
  }
  var row = el("div", "pbar2");
  row.appendChild(
    btn("Take photo", "btn", function () {
      pickPhotos(true, go);
    })
  );
  row.appendChild(
    btn("Choose photo", "btn alt", function () {
      pickPhotos(false, go);
    })
  );
  p.appendChild(row);
  p.appendChild(st);
}

/* ---- paste rows from Excel / Google Sheets ---- */
function parseDateLoose(s) {
  s = String(s || "").trim();
  var m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))
    return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    var y = +m[3];
    if (y < 100) y += 2000;
    var mo = +m[1],
      d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
  }
  return null;
}
function numLoose(s) {
  var t = String(s == null ? "" : s).replace(/[$,\s]/g, "");
  if (/^\(.*\)$/.test(t)) t = "-" + t.slice(1, -1);
  return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : null;
}
function openExpPaste() {
  var p = panel();
  p.appendChild(el("h2", null, "Paste from Excel"));
  p.appendChild(
    el(
      "p",
      "note",
      "In your spreadsheet, select the rows, copy, and paste them below. Columns must be in this order: Code, Date, Vendor, Description, Category, Payment, Receipt #, Amount, Tax, Total. A header row is skipped. If Total is filled in, it is used; otherwise Total = Amount + Tax."
    )
  );
  var ta = document.createElement("textarea");
  ta.style.cssText = "width:100%;min-height:180px;font:13px/1.3 monospace";
  ta.placeholder = "Paste here";
  p.appendChild(ta);
  var out = el("div", "note");
  out.style.cssText = "margin:8px 0;font-weight:700";
  p.appendChild(out);
  var ready = [],
    dupes = [];
  var sl = el("label");
  sl.style.cssText = "display:flex;gap:8px;align-items:center;font-weight:600;margin:6px 0";
  var skip = document.createElement("input");
  skip.type = "checkbox";
  skip.checked = true;
  skip.style.width = "auto";
  sl.appendChild(skip);
  sl.appendChild(document.createTextNode(" Skip possible duplicates (recommended)"));
  sl.hidden = true;
  p.appendChild(sl);
  var go = btn("Import", "btn", function () {
    var use = skip.checked
      ? ready.filter(function (r) {
          return dupes.indexOf(r) < 0;
        })
      : ready;
    if (!use.length) {
      alert("Nothing to import. Every row looks like a duplicate.");
      return;
    }
    go.disabled = true;
    go.textContent = "Importing...";
    var chunks = [];
    for (var i = 0; i < use.length; i += 200) chunks.push(use.slice(i, i + 200));
    chunks
      .reduce(function (pr, ch) {
        return pr.then(function () {
          return sb
            .from("expenses")
            .insert(ch)
            .select()
            .then(function (r) {
              if (r.error) return Promise.reject(r.error);
              (r.data || []).forEach(function (x) {
                expenses.push(x);
              });
            });
        });
      }, Promise.resolve())
      .then(
        function () {
          repData = null;
          closeDetail();
          render();
          alert(
            "Imported " +
              use.length +
              " expenses." +
              (use.length < ready.length
                ? " Skipped " + (ready.length - use.length) + " possible duplicates."
                : "")
          );
        },
        function () {
          go.disabled = false;
          go.textContent = "Import";
          alert(
            "Something went wrong part way. Check the list before trying again, so nothing is added twice. Did you run the Stage 13 SQL?"
          );
          render();
        }
      );
  });
  go.disabled = true;
  ta.addEventListener("input", function () {
    ready = [];
    var skipped = 0,
      lines = ta.value
        .replace(/\r/g, "")
        .split("\n")
        .filter(function (l) {
          return l.trim();
        });
    lines.forEach(function (l) {
      var c = l.split("\t").map(function (x) {
        return x.trim();
      });
      if (c.length < 8) {
        skipped++;
        return;
      }
      var d = parseDateLoose(c[1]);
      if (!d) {
        if (!/date/i.test(c[1]) || !/code/i.test(c[0])) skipped++;
        return;
      }
      var amt = numLoose(c[7]),
        tx = numLoose(c[8]) || 0,
        tot = numLoose(c[9]);
      if (tot == null && amt == null) {
        skipped++;
        return;
      }
      if (tot == null) tot = Math.round(((amt || 0) + tx) * 100) / 100;
      if (tot < 0 || tx < 0) {
        skipped++;
        return;
      }
      ready.push({
        spent_on: d,
        amount: tot,
        tax: tx,
        code: c[0],
        vendor: c[2],
        note: c[3],
        category: c[4] || "Other",
        payment: c[5],
        receipt_no: c[6],
        created_by: myEmail || ""
      });
    });
    dupes = [];
    var seen = {};
    ready.forEach(function (r) {
      var k = [r.spent_on, String(r.vendor).toLowerCase(), r.amount.toFixed(2)].join("|"),
        k2 = r.receipt_no
          ? [String(r.vendor).toLowerCase(), String(r.receipt_no).toLowerCase()].join("|")
          : "";
      if (findDup(r) || seen[k] || (k2 && seen[k2])) dupes.push(r);
      seen[k] = 1;
      if (k2) seen[k2] = 1;
    });
    sl.hidden = !dupes.length;
    var sum = ready.reduce(function (s, x) {
      return s + x.amount;
    }, 0);
    out.textContent = ready.length
      ? "Ready to import " +
        ready.length +
        " expense" +
        (ready.length === 1 ? "" : "s") +
        " totaling " +
        m2(Math.round(sum * 100) / 100) +
        (skipped ? " (" + skipped + " row" + (skipped > 1 ? "s" : "") + " skipped)" : "") +
        (dupes.length
          ? ". " + dupes.length + " look like duplicates of saved expenses or repeats in this paste"
          : "")
      : ta.value.trim()
        ? "No usable rows found. Check the column order."
        : "";
    go.disabled = !ready.length;
  });
  go.style.marginTop = "8px";
  p.appendChild(go);
}

/* ======================= crm/src/15-tax-report.js ======================= */
/* Reports > Tax Report: equipment, inventory and employee pay on one printable page. */

/* ---- Reports > Tax Report ---- */
/* One-page print: lay the report out landscape and shrink it (zoom) until the whole page fits on one sheet. */
function printReport() {
  document.body.classList.add("printreport");
  var ps = document.createElement("style");
  ps.textContent = "@page{size:landscape;margin:8mm}";
  document.head.appendChild(ps);
  setTimeout(function () {
    var tp = document.querySelector(".taxpage");
    if (tp) {
      var W = 990,
        H = 725,
        lo = 0.3,
        hi = 1,
        z = 1;
      for (var i = 0; i < 12; i++) {
        z = (lo + hi) / 2;
        tp.style.zoom = "";
        tp.style.width = Math.round(W / z) + "px";
        if (tp.offsetHeight * z <= H) lo = z;
        else hi = z;
      }
      z = lo;
      tp.style.width = Math.round(W / z) + "px";
      tp.style.zoom = String(z);
    }
    window.print();
    setTimeout(function () {
      document.body.classList.remove("printreport");
      ps.remove();
      if (tp) {
        tp.style.zoom = "";
        tp.style.width = "";
      }
    }, 800);
  }, 80);
}
var TAX_ROWS = [
  ["New Blowers", "N.B"],
  ["New Chainsaws", "N.C"],
  ["New Edgers", "N.E"],
  ["New Hand Tools", "N.HT"],
  ["New Mowers", "N.M"],
  ["New Trimmers", "N.T"]
];
var TAX_OLD = [["Blowers"], ["Chainsaws"], ["Edgers"], ["Hand Tools"], ["Mowers"], ["Trimmers"]];
var TAX_COLS = ["Category", "Code", "SN", "Purchase date", "Totals"];
function taxSheet(kind) {
  return invCats.filter(function (c) {
    return c.kind === kind;
  })[0];
}
function ensureTaxSheets() {
  if (taxMaking || invErr) return Promise.resolve(false);
  var need = [
    ["tax_new", "New Equipment Inventory", "New Equipment Purchases", TAX_ROWS],
    ["tax_old", "Old/Existing Equipment Inventory", "", TAX_OLD]
  ].filter(function (x) {
    return !taxSheet(x[0]);
  });
  if (!need.length) return Promise.resolve(false);
  taxMaking = true;
  return need
    .reduce(function (pr, x) {
      return pr.then(function () {
        var adopt =
          x[2] &&
          invCats.filter(function (c) {
            return !c.kind && c.name === x[2];
          })[0];
        if (adopt)
          return sb
            .from("inventory_cats")
            .update({ kind: x[0], name: x[1] })
            .eq("id", adopt.id)
            .then(function (r) {
              if (r.error) return Promise.reject("Run the Stage 13 SQL in Supabase first.");
              adopt.kind = x[0];
              adopt.name = x[1];
            });
        return makeSheet(x[1], ["", TAX_COLS, x[3]], x[0]).then(
          function () {},
          function (m) {
            return Promise.reject(m);
          }
        );
      });
    }, Promise.resolve())
    .then(
      function () {
        taxMaking = false;
        return true;
      },
      function (m) {
        taxMaking = false;
        taxErr = String(m || "Could not set up the equipment lists.");
        return true;
      }
    );
}
var taxErr = "";
function invDateYear(s) {
  var d = parseDateLoose(s);
  if (d) return +d.slice(0, 4);
  var m = String(s || "").match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return m ? +m[1] : null;
}
/* Older equipment: purchase date in a different calendar year than now (or the tax year, on the Tax Report) = light red row. */
var OLD_RED = "#fbe0dd";
function invRefYear() {
  return view === "reports" && rtab === "tax" ? +taxYear : new Date().getFullYear();
}
function invMarkedOld(r) {
  var d = r && r.data;
  if (!d) return false;
  for (var k in d) {
    if (/^\s*old( equipment)?\s*$/i.test(String(d[k] == null ? "" : d[k]))) return true;
  }
  return false;
}
function invIsOld(c, r) {
  if (invMarkedOld(r)) return true;
  var dc = invAllCol(c, "purchase date", r);
  if (!dc) return false;
  var y = invDateYear(invVal(r, dc.k));
  return y != null && y !== invRefYear();
}
function invLegend(yr) {
  var l = el("span", "note");
  l.innerHTML =
    '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:' +
    OLD_RED +
    ';border:1px solid #e3b5b0;vertical-align:-2px"></span> Light red = purchased before ' +
    yr +
    " (older equipment)";
  return l;
}
function invTintRow(tr, old) {
  Array.prototype.forEach.call(tr.children, function (td) {
    if (td.classList.contains("rn") || td.dataset.cat) return;
    td.style.background = old ? OLD_RED : td.dataset.grey ? "#f1f3f0" : "";
  });
}
/* Every inventory category in one small box: how many items, what was bought in the tax year, what is older (older = light red so the accountant can tell). */
function inventorySummaryBox(year) {
  var y = +year,
    box = el("div", "taxbox"),
    t = document.createElement("table"),
    hr = document.createElement("tr");
  ["Category", "Items", "Bought " + year, "Older"].forEach(function (x, i) {
    var th = document.createElement("th");
    th.textContent = x;
    if (i) th.className = "r";
    hr.appendChild(th);
  });
  t.appendChild(hr);
  var tn = 0,
    tNew = 0,
    tOld = 0,
    tUn = 0,
    later = 0;
  invVisible().forEach(function (c) {
    var n = 0,
      nw = 0,
      od = 0,
      un = 0;
    invRows(c).forEach(function (r) {
      var dc = invAllCol(c, "purchase date", r),
        pc = invAllCol(c, "price", r),
        yr = dc ? invDateYear(invVal(r, dc.k)) : null,
        pr = pc ? invNumber(invVal(r, pc.k)) || 0 : 0,
        mk = invMarkedOld(r);
      if (mk) {
        n++;
        od += pr;
        return;
      }
      if (yr != null && yr > y) {
        later++;
        return;
      }
      n++;
      if (yr == null) un += pr;
      else if (yr === y) nw += pr;
      else od += pr;
    });
    if (!n) return;
    tn += n;
    tNew += nw;
    tOld += od;
    tUn += un;
    var tr = document.createElement("tr");
    [
      [c.name, ""],
      [String(n), "r"],
      [m2(nw || 0), "r"],
      [m2(od || 0), "r old"]
    ].forEach(function (x, i) {
      var td = document.createElement("td");
      td.textContent = x[0];
      if (x[1]) td.className = x[1];
      if (i === 0) invPaint(td, c);
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  if (!tn) {
    var e = document.createElement("tr"),
      ed = document.createElement("td");
    ed.colSpan = 4;
    ed.textContent = "No inventory items yet.";
    e.appendChild(ed);
    t.appendChild(e);
  }
  var ft = document.createElement("tr");
  ft.className = "tot";
  [
    ["Total", ""],
    [String(tn), "r"],
    [m2(r2(tNew)), "r"],
    [m2(r2(tOld)), "r old"]
  ].forEach(function (x) {
    var td = document.createElement("td");
    td.textContent = x[0];
    if (x[1]) td.className = x[1];
    ft.appendChild(td);
  });
  t.appendChild(ft);
  box.appendChild(t);
  var nt = [];
  nt.push("Light red = bought before " + year + " (older equipment).");
  if (tUn) nt.push("Items with no purchase date: " + m2(r2(tUn)) + " (not in the columns above).");
  if (later) nt.push(later + " item" + (later > 1 ? "s" : "") + " bought after " + year + " not shown.");
  box.appendChild(el("div", "taxnote", nt.join(" ")));
  return box;
}
/* Employee pay: totals of the payments recorded on the Personnel tab, by date paid. */
function employeeBox(year) {
  var box = el("div", "taxbox"),
    t = document.createElement("table"),
    hr = document.createElement("tr");
  ["Employee", "Payments", "Total paid"].forEach(function (x, i) {
    var th = document.createElement("th");
    th.textContent = x;
    if (i) th.className = "r";
    hr.appendChild(th);
  });
  t.appendChild(hr);
  var tot = 0,
    n = 0;
  people.forEach(function (p) {
    var rs = paidBy(p.id, year);
    if (!rs.length) return;
    var a = sumAmt(rs);
    tot += a;
    n++;
    var tr = document.createElement("tr");
    [
      [p.full_name, ""],
      [String(rs.length), "r"],
      [m2(a), "r"]
    ].forEach(function (x) {
      var td = document.createElement("td");
      td.textContent = x[0];
      if (x[1]) td.className = x[1];
      tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  if (!n) {
    var e = document.createElement("tr"),
      ed = document.createElement("td");
    ed.colSpan = 3;
    ed.textContent = persErr
      ? "Run the Stage 17 SQL (Personnel)."
      : isOwner()
        ? "No payments recorded for " + year + "."
        : "Owners only.";
    e.appendChild(ed);
    t.appendChild(e);
  }
  var ft = document.createElement("tr");
  ft.className = "tot";
  [
    ["Total employee pay", ""],
    ["", ""],
    [m2(Math.round(tot * 100) / 100), "r"]
  ].forEach(function (x) {
    var td = document.createElement("td");
    td.textContent = x[0];
    if (x[1]) td.className = x[1];
    ft.appendChild(td);
  });
  t.appendChild(ft);
  box.appendChild(t);
  box.appendChild(
    el("div", "taxnote", "From Personnel > Payroll, counted by the date paid in " + year + ".")
  );
  return box;
}
function renderTaxReport(list) {
  var tb = $("topbtns");
  tb.appendChild(btn("Print / Save PDF (one page)", "btn", printReport));
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(
    btn("Expenses CSV", "btn alt", function () {
      downloadCsv("expenses_" + taxYear + ".csv", expCsv(expInYear(taxYear)));
    })
  );
  var bar = el("div", "invbar tax-noprint"),
    ys = fld(
      "Tax year",
      "select",
      taxYear,
      expYears(taxYear).map(function (y) {
        return [y, y];
      })
    );
  ys.style.cssText = "margin:0;min-width:130px";
  ys.input.addEventListener("change", function () {
    taxYear = ys.input.value;
    render();
  });
  bar.appendChild(ys);
  bar.appendChild(
    el(
      "span",
      "note",
      "Everything is on one page. Expense totals include tax. Equipment lists are editable: click a cell to type."
    )
  );
  list.appendChild(bar);
  var pg = el("div", "taxpage");
  list.appendChild(pg);
  pg.appendChild(el("h2", "taxh", "Tax Report · " + taxYear + " · LattaCorp of Central Florida"));
  var grid = el("div", "taxgrid");
  pg.appendChild(grid);
  var c1 = el("div"),
    c2 = el("div"),
    c3 = el("div");
  grid.appendChild(c1);
  grid.appendChild(c2);
  grid.appendChild(c3);
  var s1 = el("div", "taxsec");
  s1.appendChild(el("h3", null, "Expenses"));
  if (expErr) s1.appendChild(el("div", "note", "Expenses aren't set up yet (Stage 9 SQL)."));
  else s1.appendChild(expenseBox(taxYear));
  c1.appendChild(s1);
  var s3 = el("div", "taxsec");
  s3.appendChild(el("h3", null, "Employee pay"));
  s3.appendChild(employeeBox(taxYear));
  c3.appendChild(s3);
  var s4 = el("div", "taxsec");
  s4.appendChild(el("h3", null, "Inventory"));
  if (invErr) s4.appendChild(el("div", "note", "Run the Stage 12 SQL (Inventory) in Supabase."));
  else s4.appendChild(inventorySummaryBox(taxYear));
  c3.appendChild(s4);
  var host = c2;
  if (invErr) {
    host.appendChild(
      el(
        "div",
        "note",
        "Run the Stage 12 SQL (Inventory) and Stage 13 SQL in Supabase to turn on the equipment lists."
      )
    );
    return;
  }
  function drawSheets() {
    host.textContent = "";
    [
      ["tax_new", "New Equipment Inventory", "(included in Equipment expenses)"],
      ["tax_old", "Old/Existing Equipment Inventory", ""]
    ].forEach(function (x) {
      var c = taxSheet(x[0]),
        sec = el("div", "taxsec"),
        hh = el("h3", null, x[1]);
      if (x[2]) {
        var sm_ = el("span", "note", " " + x[2]);
        hh.appendChild(sm_);
      }
      sec.appendChild(hh);
      if (!c) {
        sec.appendChild(el("div", "note", taxErr || "Setting this list up..."));
        host.appendChild(sec);
        return;
      }
      sec.appendChild(invGrid(c, invRows(c), false));
      var st = btn("Sheet settings", "btn alt sm tax-noprint", function () {
        openInvCat(c);
      });
      st.style.marginTop = "6px";
      sec.appendChild(st);
      host.appendChild(sec);
    });
  }
  if (!taxSheet("tax_new") || !taxSheet("tax_old")) {
    host.appendChild(el("div", "note", "Setting up your equipment lists..."));
    ensureTaxSheets().then(function (ch) {
      if (ch && view === "reports" && rtab === "tax") render();
    });
  } else drawSheets();
}

/* ======================= crm/src/16-photos.js ======================= */
/* Photos: uploading, viewing, the photo tab and photos on a client page. */

/* ---- Photos: stored in a private Supabase bucket, shrunk on the phone/computer before upload ---- */
var KINDS = [
  ["before", "Before"],
  ["after", "After"],
  ["property", "Property"],
  ["issue", "Issue / damage"],
  ["receipt", "Receipt"],
  ["other", "Other"]
];
function kindLabel(k) {
  var x = KINDS.filter(function (a) {
    return a[0] === k;
  })[0];
  return x ? x[1] : "Other";
}
function uid() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function viaImg(file) {
  return new Promise(function (res, rej) {
    var u = URL.createObjectURL(file),
      i = new Image();
    i.onload = function () {
      URL.revokeObjectURL(u);
      res(i);
    };
    i.onerror = function () {
      URL.revokeObjectURL(u);
      rej(new Error("read"));
    };
    i.src = u;
  });
}
function loadImg(file) {
  if (window.createImageBitmap)
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
      return viaImg(file);
    });
  return viaImg(file);
}
function toJpeg(img, max, q) {
  var w = img.width || img.naturalWidth,
    h = img.height || img.naturalHeight,
    s = Math.min(1, max / Math.max(w, h)),
    cw = Math.max(1, Math.round(w * s)),
    ch = Math.max(1, Math.round(h * s)),
    c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  var x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, cw, ch);
  x.drawImage(img, 0, 0, cw, ch);
  return new Promise(function (res, rej) {
    c.toBlob(
      function (b) {
        b ? res({ blob: b, w: cw, h: ch }) : rej(new Error("encode"));
      },
      "image/jpeg",
      q
    );
  });
}
function pickPhotos(capture, cb) {
  var i = document.createElement("input");
  i.type = "file";
  i.accept = "image/*";
  if (capture) i.setAttribute("capture", "environment");
  else i.multiple = true;
  i.style.display = "none";
  document.body.appendChild(i);
  i.addEventListener("change", function () {
    var fs = Array.prototype.slice.call(i.files || []);
    document.body.removeChild(i);
    if (fs.length) cb(fs);
  });
  i.click();
}
function uploadPhoto(file, meta) {
  return loadImg(file)
    .then(function (img) {
      return Promise.all([toJpeg(img, 1600, 0.82), toJpeg(img, 360, 0.7)]);
    })
    .then(function (rs) {
      var full = rs[0],
        th = rs[1],
        id = uid(),
        folder = meta.client_id || "general",
        path = folder + "/" + id + ".jpg",
        tpath = folder + "/" + id + "_t.jpg",
        st = sb.storage.from("photos");
      return st.upload(path, full.blob, { contentType: "image/jpeg" }).then(function (u) {
        if (u.error) throw new Error("upload");
        return st.upload(tpath, th.blob, { contentType: "image/jpeg" }).then(function (u2) {
          if (u2.error) {
            st.remove([path]);
            throw new Error("upload");
          }
          var row = {
            client_id: meta.client_id || null,
            property_id: meta.property_id || null,
            visit_id: meta.visit_id || null,
            expense_id: meta.expense_id || null,
            kind: meta.kind || "other",
            caption: meta.caption || "",
            path: path,
            thumb_path: tpath,
            size_bytes: full.blob.size + th.blob.size,
            width: full.w,
            height: full.h,
            created_by: myEmail || ""
          };
          return sb
            .from("photos")
            .insert(row)
            .select()
            .single()
            .then(function (r) {
              if (r.error || !r.data) {
                st.remove([path, tpath]);
                throw new Error("save");
              }
              photos.unshift(r.data);
              return r.data;
            });
        });
      });
    });
}
function uploadMany(files, meta, onProg) {
  var ok = 0,
    bad = [];
  return files
    .reduce(function (p, f, i) {
      return p.then(function () {
        if (onProg) onProg(i + 1, files.length);
        return uploadPhoto(f, meta).then(
          function () {
            ok++;
          },
          function () {
            bad.push(f.name || "photo");
          }
        );
      });
    }, Promise.resolve())
    .then(function () {
      return { ok: ok, bad: bad };
    });
}
function uploadMsg(res) {
  return res.bad.length
    ? "Added " +
        res.ok +
        ". Could not add: " +
        res.bad.join(", ") +
        ". (Photos must be JPEG, PNG or WebP images; if you picked an iPhone HEIC on a computer, choose the same photo from the phone instead.)"
    : "";
}
var pcache = {};
function signPaths(paths) {
  var need = paths.filter(function (p) {
    var c = pcache[p];
    return p && (!c || c.exp < Date.now() + 60000);
  });
  if (!need.length) return Promise.resolve();
  var ch = [];
  for (var i = 0; i < need.length; i += 100) ch.push(need.slice(i, i + 100));
  return Promise.all(
    ch.map(function (c) {
      return sb.storage
        .from("photos")
        .createSignedUrls(c, 3600)
        .then(
          function (r) {
            if (r.error || !r.data) return;
            r.data.forEach(function (d) {
              if (d.signedUrl && d.path) pcache[d.path] = { url: d.signedUrl, exp: Date.now() + 3500000 };
            });
          },
          function () {}
        );
    })
  );
}
function photoLabel(ph) {
  var c = ph.client_id ? byId(clients, ph.client_id) : null;
  return (
    (c ? c.name : "No client") +
    " · " +
    kindLabel(ph.kind) +
    " · " +
    dshort(String(ph.created_at).slice(0, 10))
  );
}
function photoGrid(host, rows, opts) {
  opts = opts || {};
  host.textContent = "";
  if (!rows.length) return;
  var grid = el("div", "pgrid"),
    imgs = [];
  rows.forEach(function (ph, i) {
    var t = el("button", "ptile" + (opts.sel && opts.sel[ph.id] ? " picked" : ""));
    t.type = "button";
    t.title = photoLabel(ph) + (ph.caption ? " · " + ph.caption : "");
    var im = document.createElement("img");
    im.alt = ph.caption || photoLabel(ph);
    im.loading = "lazy";
    t.appendChild(im);
    imgs.push([im, ph.thumb_path || ph.path]);
    if (opts.sel) {
      var ck = el("span", "pck", opts.sel[ph.id] ? "✓" : "");
      t.appendChild(ck);
    }
    if (!opts.sel && ph.caption) t.appendChild(el("span", "pcap", ph.caption));
    t.addEventListener("click", function () {
      if (opts.onTile) opts.onTile(ph, i);
      else openLightbox(rows, i);
    });
    grid.appendChild(t);
  });
  host.appendChild(grid);
  signPaths(
    imgs.map(function (x) {
      return x[1];
    })
  ).then(function () {
    imgs.forEach(function (x) {
      var c = pcache[x[1]];
      if (c) x[0].src = c.url;
    });
  });
}
function removePhotos(rows) {
  var paths = [];
  rows.forEach(function (p) {
    paths.push(p.path);
    if (p.thumb_path) paths.push(p.thumb_path);
  });
  return sb.storage
    .from("photos")
    .remove(paths)
    .then(function (r) {
      if (r.error) return false;
      return sb
        .from("photos")
        .delete()
        .in(
          "id",
          rows.map(function (p) {
            return p.id;
          })
        )
        .then(function (d) {
          if (d.error) return false;
          var ids = {};
          rows.forEach(function (p) {
            ids[p.id] = 1;
            delete pcache[p.path];
            delete pcache[p.thumb_path];
          });
          photos = photos.filter(function (p) {
            return !ids[p.id];
          });
          return true;
        });
    });
}
function deletePhotos(rows, done) {
  if (!rows.length) return;
  if (
    !confirm(
      "Delete " +
        rows.length +
        " photo" +
        (rows.length > 1 ? "s" : "") +
        "? This frees up the space and can't be undone."
    )
  )
    return;
  removePhotos(rows).then(function (ok) {
    if (!ok) {
      alert("Could not delete. Check your connection and try again.");
      return;
    }
    if (done) done();
    render();
  });
}

/* full-size viewer */
var lbx = null;
function openLightbox(rows, idx) {
  if (!lbx) {
    lbx = document.createElement("div");
    lbx.id = "lbx";
    lbx.hidden = true;
    document.body.appendChild(lbx);
  }
  var cur = idx;
  lbx.hidden = false;
  document.body.classList.add("lbopen");
  function close() {
    lbx.hidden = true;
    lbx.textContent = "";
    document.body.classList.remove("lbopen");
    document.removeEventListener("keydown", key);
  }
  function key(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  }
  function go(d) {
    var n = cur + d;
    if (n < 0 || n >= rows.length) return;
    cur = n;
    draw();
  }
  function draw() {
    var ph = rows[cur];
    lbx.textContent = "";
    var bar = el("div", "lbbar");
    bar.appendChild(btn("‹ Close", "hb", close));
    bar.appendChild(el("span", "lbct", cur + 1 + " of " + rows.length));
    lbx.appendChild(bar);
    var stage = el("div", "lbstage"),
      im = document.createElement("img");
    im.alt = photoLabel(ph);
    stage.appendChild(im);
    var pv = btn("‹", "lbnav l", function () {
      go(-1);
    });
    pv.disabled = cur === 0;
    pv.setAttribute("aria-label", "Previous photo");
    var nx = btn("›", "lbnav r", function () {
      go(1);
    });
    nx.disabled = cur === rows.length - 1;
    nx.setAttribute("aria-label", "Next photo");
    stage.appendChild(pv);
    stage.appendChild(nx);
    lbx.appendChild(stage);
    signPaths([ph.path]).then(function () {
      var c = pcache[ph.path];
      if (c && rows[cur] === ph) im.src = c.url;
    });
    var info = el("div", "lbinfo"),
      pr = ph.property_id ? byId(props, ph.property_id) : null;
    info.appendChild(el("div", "lbt", photoLabel(ph) + (pr ? " · " + pr.address : "")));
    var cap = document.createElement("input");
    cap.type = "text";
    cap.placeholder = "Add a caption...";
    cap.value = ph.caption || "";
    cap.setAttribute("aria-label", "Caption");
    var kd = document.createElement("select");
    kd.setAttribute("aria-label", "Photo type");
    KINDS.forEach(function (k) {
      var o = document.createElement("option");
      o.value = k[0];
      o.textContent = k[1];
      kd.appendChild(o);
    });
    kd.value = ph.kind;
    var sv = btn("Save", "btn sm", function () {
      sb.from("photos")
        .update({ caption: cap.value.trim(), kind: kd.value })
        .eq("id", ph.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not save.");
            return;
          }
          ph.caption = cap.value.trim();
          ph.kind = kd.value;
          sv.textContent = "Saved ✓";
          setTimeout(function () {
            sv.textContent = "Save";
          }, 1200);
        });
    });
    var row = el("div", "lbrow");
    row.appendChild(cap);
    row.appendChild(kd);
    row.appendChild(sv);
    info.appendChild(row);
    var acts = el("div", "lbrow");
    var full = el("a", "btn alt sm", "Open full size");
    full.target = "_blank";
    full.rel = "noopener";
    signPaths([ph.path]).then(function () {
      var c = pcache[ph.path];
      if (c) full.href = c.url;
    });
    acts.appendChild(full);
    if (ph.client_id)
      acts.appendChild(
        btn("Open client", "btn alt sm", function () {
          close();
          openClient(ph.client_id);
        })
      );
    acts.appendChild(
      btn("Delete", "btn danger sm", function () {
        if (!confirm("Delete this photo? This frees up the space and can't be undone.")) return;
        removePhotos([ph]).then(function (ok) {
          if (!ok) {
            alert("Could not delete. Check your connection and try again.");
            return;
          }
          rows.splice(cur, 1);
          if (!rows.length) {
            close();
            render();
            return;
          }
          if (cur >= rows.length) cur = rows.length - 1;
          draw();
          render();
        });
      })
    );
    info.appendChild(acts);
    lbx.appendChild(info);
  }
  document.addEventListener("keydown", key, true);
  draw();
}

/* photos on a client profile */
function addPhotoControls(host, meta, onDone, withKind) {
  var bar = el("div", "pbar2"),
    kd = document.createElement("select");
  kd.setAttribute("aria-label", "Photo type");
  KINDS.forEach(function (k) {
    var o = document.createElement("option");
    o.value = k[0];
    o.textContent = k[1];
    kd.appendChild(o);
  });
  kd.value = meta.kind || "other";
  kd.style.width = "auto";
  var st = el("span", "note");
  function run(files) {
    var m = Object.assign({}, meta, { kind: withKind === false ? meta.kind : kd.value });
    st.textContent = "Uploading...";
    uploadMany(files, m, function (i, n) {
      st.textContent = "Uploading " + i + " of " + n + "...";
    }).then(function (res) {
      st.textContent = res.ok ? "Added " + res.ok + " photo" + (res.ok > 1 ? "s" : "") + "." : "";
      var msg = uploadMsg(res);
      if (msg) alert(msg);
      onDone();
    });
  }
  bar.appendChild(
    btn("Take photo", "btn alt sm", function () {
      pickPhotos(true, run);
    })
  );
  bar.appendChild(
    btn("Add photos", "btn alt sm", function () {
      pickPhotos(false, run);
    })
  );
  if (withKind !== false) bar.appendChild(kd);
  bar.appendChild(st);
  host.appendChild(bar);
}
function clientPhotosSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Photos");
  sec.appendChild(h);
  if (photoErr) {
    sec.appendChild(el("div", "note", "Run the Stage 10 SQL in Supabase to turn on photos."));
    return sec;
  }
  var holder = el("div"),
    more = false;
  function mine() {
    return photos
      .filter(function (p) {
        return p.client_id === c.id;
      })
      .sort(function (a, b) {
        return String(b.created_at) < String(a.created_at) ? -1 : 1;
      });
  }
  function draw() {
    var all = mine();
    h.textContent = "Photos" + (all.length ? " (" + all.length + ")" : "");
    var rows = more ? all : all.slice(0, 12);
    holder.textContent = "";
    var g = el("div");
    holder.appendChild(g);
    photoGrid(g, rows, {
      onTile: function (ph, i) {
        openLightbox(rows, i);
      }
    });
    if (!all.length)
      holder.appendChild(
        el("div", "note", "No photos yet. Take one or add some from your phone or computer.")
      );
    if (all.length > 12 && !more)
      holder.appendChild(
        btn("Show all " + all.length, "btn alt sm", function () {
          more = true;
          draw();
        })
      );
  }
  var ps = props.filter(function (p) {
    return p.client_id === c.id;
  });
  addPhotoControls(
    sec,
    { client_id: c.id, property_id: ps.length === 1 ? ps[0].id : null, kind: "other" },
    function () {
      draw();
      render();
    }
  );
  sec.appendChild(holder);
  draw();
  return sec;
}

/* the Photos tab: every photo, in bulk */
function renderPhotoLib() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  if (photoErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Photos aren't set up yet. Run the Stage 10 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  $("topbtns").appendChild(btn("+ Add photos", "btn", openAddPhotos));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(
    btn(psel ? "Cancel selecting" : "Select", "btn alt", function () {
      psel = psel ? null : {};
      render();
    })
  );
  var used = photos.reduce(function (s, p) {
      return s + (p.size_bytes || 0);
    }, 0),
    cap = 1024 * 1024 * 1024,
    pct = Math.min(100, (used / cap) * 100),
    avg = Math.max(250000, photos.length ? used / photos.length : 350000);
  var mt = el("div", "meterbox");
  mt.appendChild(
    el(
      "div",
      "note",
      photos.length +
        " photo" +
        (photos.length === 1 ? "" : "s") +
        " · using " +
        (used >= 1048576 * 100
          ? (used / 1073741824).toFixed(2) + " GB"
          : (used / 1048576).toFixed(1) + " MB") +
        " of 1 GB on the free plan (room for about " +
        Math.max(0, Math.floor((cap - used) / avg)).toLocaleString() +
        " more)"
    )
  );
  var tr = el("div", "meter"),
    f = el("span");
  f.style.width = Math.max(1, pct) + "%";
  if (pct > 85) f.style.background = "var(--red)";
  tr.appendChild(f);
  mt.appendChild(tr);
  list.appendChild(mt);
  var cs = {};
  photos.forEach(function (p) {
    if (p.client_id) cs[p.client_id] = 1;
  });
  var fb = el("div", "pbar");
  var fc = fld(
    "Client",
    "select",
    pf.client,
    [
      ["all", "All clients"],
      ["none", "No client"]
    ].concat(
      Object.keys(cs)
        .map(function (k) {
          return [k, cname(k)];
        })
        .sort(function (a, b) {
          return a[1].localeCompare(b[1]);
        })
    )
  );
  var fk = fld("Type", "select", pf.kind, [["all", "All types"]].concat(KINDS));
  var fw = fld("When", "select", pf.when, [
    ["all", "All time"],
    ["month", "This month"],
    ["3m", "Last 3 months"],
    ["year", "This year"]
  ]);
  [
    [fc, "client"],
    [fk, "kind"],
    [fw, "when"]
  ].forEach(function (x) {
    x[0].style.cssText = "margin:0;min-width:150px";
    x[0].input.addEventListener("change", function () {
      pf[x[1]] = x[0].input.value;
      pshown = 60;
      render();
    });
    fb.appendChild(x[0]);
  });
  list.appendChild(fb);
  var t = today(),
    from =
      pf.when === "month"
        ? t.slice(0, 8) + "01"
        : pf.when === "3m"
          ? addDays(t, -92)
          : pf.when === "year"
            ? t.slice(0, 4) + "-01-01"
            : "";
  var set = photos
    .filter(function (p) {
      return (
        (pf.client === "all" || (pf.client === "none" ? !p.client_id : p.client_id === pf.client)) &&
        (pf.kind === "all" || p.kind === pf.kind) &&
        (!from || String(p.created_at).slice(0, 10) >= from) &&
        (!query ||
          [p.caption, p.client_id ? cname(p.client_id) : "", kindLabel(p.kind)]
            .join(" ")
            .toLowerCase()
            .indexOf(query) > -1)
      );
    })
    .sort(function (a, b) {
      return String(b.created_at) < String(a.created_at) ? -1 : 1;
    });
  if (psel) {
    var n = Object.keys(psel).length,
      bar = el("div", "selbar");
    bar.appendChild(el("b", null, n + " selected"));
    bar.appendChild(
      btn("Select all shown (" + set.length + ")", "btn alt sm", function () {
        set.forEach(function (p) {
          psel[p.id] = 1;
        });
        render();
      })
    );
    bar.appendChild(
      btn("Clear", "btn alt sm", function () {
        psel = {};
        render();
      })
    );
    var dl = btn("Delete selected", "btn danger sm", function () {
      var rows = photos.filter(function (p) {
        return psel[p.id];
      });
      deletePhotos(rows, function () {
        psel = {};
      });
    });
    dl.disabled = !n;
    bar.appendChild(dl);
    list.appendChild(bar);
  }
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        photos.length
          ? "No photos match those filters."
          : "No photos yet. Add some here, from a client's page, or from a visit."
      )
    );
    return;
  }
  var shown = set.slice(0, pshown),
    g = el("div");
  list.appendChild(g);
  photoGrid(g, shown, {
    sel: psel,
    onTile: psel
      ? function (ph) {
          if (psel[ph.id]) delete psel[ph.id];
          else psel[ph.id] = 1;
          render();
        }
      : null
  });
  if (set.length > pshown)
    list.appendChild(
      btn("Show more (" + (set.length - pshown) + " left)", "btn alt", function () {
        pshown += 60;
        render();
      })
    );
}
function openAddPhotos() {
  var p = panel();
  p.appendChild(el("h2", null, "Add photos"));
  var cl = fld(
    "Client (optional)",
    "select",
    "",
    [["", "No client"]].concat(
      clients
        .filter(function (c) {
          return !c.archived;
        })
        .map(function (c) {
          return [c.id, c.name];
        })
    )
  );
  p.appendChild(cl);
  var holder = el("div");
  p.appendChild(holder);
  function build() {
    holder.textContent = "";
    var ps = props.filter(function (x) {
      return x.client_id === cl.input.value;
    });
    addPhotoControls(
      holder,
      { client_id: cl.input.value || null, property_id: ps.length === 1 ? ps[0].id : null, kind: "other" },
      function () {
        render();
      }
    );
  }
  cl.input.addEventListener("change", build);
  build();
  var dn = btn("Done", "btn alt");
  dn.style.marginTop = "12px";
  dn.addEventListener("click", function () {
    closeDetail();
    render();
  });
  p.appendChild(dn);
}

/* ======================= crm/src/17-crew.js ======================= */
/* Crew: texting routes to crew members and the crew member's own limited screen. */

/* ---- crew: temps get a texted route, full-timers get their own limited login ---- */
function callApi(path, action, payload) {
  return sb.auth.getSession().then(function (r) {
    var t = r.data && r.data.session && r.data.session.access_token;
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + t },
      body: JSON.stringify(Object.assign({ action: action }, payload))
    }).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            return { ok: res.ok, error: j.error || "Error " + res.status, data: j };
          });
      },
      function () {
        return { ok: false, error: "Could not reach the server." };
      }
    );
  });
}
function callCrewApi(action, payload) {
  return callApi("/api/crew-login", action, payload);
}
function refreshCrew() {
  return sb
    .from("crew")
    .select("*")
    .order("name", { ascending: true })
    .limit(200)
    .then(function (r) {
      if (!r.error) crew = r.data || [];
    });
}
function openCrew() {
  var p = panel();
  p.appendChild(el("h2", null, "Crew"));
  var intro = el(
    "p",
    "note",
    "Temp (text only): no login. You text them the day's route. Full-time (login): they sign in at this same address and see only their own stops: address, notes and a Done button. They never see prices, client names, phone numbers, income or anything else. Leave this empty if you work alone."
  );
  p.appendChild(intro);
  var holder = el("div");
  p.appendChild(holder);
  function row(m) {
    var box = el("div", "pcard"),
      g = el("div", "grid2");
    var n = fld("Name", "text", m ? m.name : ""),
      ph = fld("Phone (for texting routes)", "tel", m ? m.phone : "");
    g.appendChild(n);
    g.appendChild(ph);
    box.appendChild(g);
    var hasLogin = m && m.kind === "login" && m.user_id,
      extra = el("div");
    box.appendChild(extra);
    var ty = null,
      em = null,
      pw = null;
    if (hasLogin) {
      var lg = el("div", "note", "Has a login: " + (m.email || ""));
      lg.style.margin = "8px 0 0";
      extra.appendChild(lg);
    } else {
      ty = fld("Type", "select", "temp", [
        ["temp", "Temp (text only)"],
        ["login", "Full-time (own login)"]
      ]);
      extra.appendChild(ty);
      var lw = el("div");
      lw.hidden = true;
      em = fld("Login email", "email", "");
      pw = fld("Starting password (8+ characters, you tell them)", "text", "");
      pw.input.autocomplete = "off";
      lw.appendChild(em);
      lw.appendChild(pw);
      extra.appendChild(lw);
      ty.input.addEventListener("change", function () {
        lw.hidden = ty.input.value !== "login";
      });
    }
    var a = el("div", "acts");
    a.appendChild(
      btn(m ? "Save" : "Add crew member", "btn sm", function () {
        var name = n.input.value.trim();
        if (!name) {
          alert("Enter a name.");
          return;
        }
        var wantLogin = !!ty && ty.input.value === "login";
        if (wantLogin) {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.input.value.trim())) {
            alert("Enter the login email.");
            return;
          }
          if (pw.input.value.length < 8) {
            alert("The password needs at least 8 characters.");
            return;
          }
        }
        var q = m
          ? sb
              .from("crew")
              .update({ name: name, phone: ph.input.value.trim() })
              .eq("id", m.id)
              .select()
              .single()
          : sb.from("crew").insert({ name: name, phone: ph.input.value.trim() }).select().single();
        q.then(function (r) {
          if (r.error || !r.data) {
            alert("Could not save.");
            return;
          }
          if (!wantLogin) {
            return refreshCrew().then(function () {
              draw();
              render();
            });
          }
          callCrewApi("create", {
            crew_id: r.data.id,
            email: em.input.value.trim(),
            password: pw.input.value
          }).then(function (res) {
            refreshCrew().then(function () {
              draw();
              render();
              if (!res.ok) alert("Saved as a temp, but the login was not created: " + res.error);
              else
                alert(
                  "Login created. Give " +
                    name +
                    " the email and password; they sign in at this same address."
                );
            });
          });
        });
      })
    );
    if (hasLogin) {
      var rp = btn("Reset password", "btn alt sm", function () {
        a.textContent = "";
        var np = document.createElement("input");
        np.type = "text";
        np.placeholder = "New password (8+ characters)";
        np.autocomplete = "off";
        np.style.width = "auto";
        a.appendChild(np);
        a.appendChild(
          btn("Set password", "btn sm", function () {
            callCrewApi("reset", { crew_id: m.id, password: np.value }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              alert("Password changed.");
              draw();
            });
          })
        );
        a.appendChild(btn("Cancel", "btn alt sm", draw));
      });
      a.appendChild(rp);
      a.appendChild(
        btn("Remove login", "btn alt sm", function () {
          if (!confirm("Remove " + m.name + "'s login? They keep their name here as a temp.")) return;
          callCrewApi("remove", { crew_id: m.id }).then(function (res) {
            if (!res.ok) {
              alert(res.error);
              return;
            }
            refreshCrew().then(function () {
              draw();
              render();
            });
          });
        })
      );
    }
    if (m)
      a.appendChild(
        btn("Delete", "btn danger sm", function () {
          if (
            !confirm(
              "Delete " + m.name + "? Their login (if any) is removed and their visits become unassigned."
            )
          )
            return;
          var go = function () {
            sb.from("crew")
              .delete()
              .eq("id", m.id)
              .then(function (r) {
                if (r.error) {
                  alert("Could not delete.");
                  return;
                }
                crew = crew.filter(function (z) {
                  return z.id !== m.id;
                });
                visits.forEach(function (v) {
                  if (v.crew_id === m.id) v.crew_id = null;
                });
                jobs.forEach(function (j) {
                  if (j.crew_id === m.id) j.crew_id = null;
                });
                if (crewF === m.id) crewF = "all";
                draw();
                render();
              });
          };
          if (m.user_id)
            callCrewApi("remove", { crew_id: m.id }).then(function (res) {
              if (!res.ok) {
                alert(res.error);
                return;
              }
              go();
            });
          else go();
        })
      );
    box.appendChild(a);
    return box;
  }
  function draw() {
    holder.textContent = "";
    crew.forEach(function (m) {
      holder.appendChild(row(m));
    });
    var h = el("div", "note", crew.length ? "Add another" : "Add your first crew member");
    h.style.margin = "14px 0 6px";
    holder.appendChild(h);
    holder.appendChild(row(null));
  }
  draw();
}

/* ---- send a route to a crew member (text message) ---- */
function smsHref(phone, body) {
  var ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
  return "sms:" + digits(phone) + (ios ? "&" : "?") + "body=" + encodeURIComponent(body);
}
function routeMessage(d, sel) {
  var lines = ["Latta Corp route for " + dshort(d) + ":", ""];
  sel.forEach(function (v, i) {
    var j = byId(jobs, v.job_id),
      pp = byId(props, v.property_id),
      notes = [pp && pp.notes, j && j.instructions].filter(Boolean).join(" / ");
    lines.push(i + 1 + ". " + paddr(v.property_id) + (j ? " - " + j.title : ""));
    if (notes) lines.push("   Note: " + notes);
  });
  var u = routeUrl(sel);
  if (u) lines.push("", "Map route: " + u);
  return lines.join("\n");
}
function openSendRoute(d) {
  var p = panel();
  p.appendChild(el("h2", null, "Send route · " + dlabel(d)));
  var members = crew.filter(function (c) {
    return c.active !== false;
  });
  if (!members.length) {
    p.appendChild(el("p", null, "Add a crew member first."));
    p.appendChild(btn("Open Crew", "btn", openCrew));
    return;
  }
  var stops = onDay(d)
    .filter(function (v) {
      return v.status === "scheduled";
    })
    .sort(dayOrder);
  if (!stops.length) {
    p.appendChild(el("p", null, "No scheduled stops on this day."));
    return;
  }
  var who = fld(
    "Send to",
    "select",
    members[0].id,
    members.map(function (m) {
      return [
        m.id,
        m.name + (m.kind === "login" ? " (has login)" : "") + (m.phone ? "" : " (no phone saved)")
      ];
    })
  );
  p.appendChild(who);
  p.appendChild(el("div", "note", "Pick the stops for this person, in your route order:"));
  var checks = el("div");
  p.appendChild(checks);
  var boxes = [];
  function defaults() {
    var mine = stops.filter(function (v) {
      return v.crew_id === who.input.value;
    });
    return mine.length
      ? mine
      : stops.filter(function (v) {
          return !v.crew_id;
        });
  }
  function build() {
    checks.textContent = "";
    boxes = [];
    var def = defaults();
    stops.forEach(function (v, i) {
      var j = byId(jobs, v.job_id),
        lab = el("label", "pcard");
      lab.style.cssText = "display:flex;gap:10px;align-items:flex-start;cursor:pointer";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.cssText = "width:22px;height:22px;flex:none;margin-top:2px";
      cb.checked = def.indexOf(v) > -1;
      cb.addEventListener("change", msg);
      var t = el("div");
      t.appendChild(el("b", null, i + 1 + ". " + paddr(v.property_id)));
      t.appendChild(
        el(
          "div",
          "note",
          (j ? j.title : "") +
            (v.crew_id && crewName(v.crew_id) ? " · now assigned to " + crewName(v.crew_id) : "")
        )
      );
      lab.appendChild(cb);
      lab.appendChild(t);
      checks.appendChild(lab);
      boxes.push([cb, v]);
    });
    msg();
  }
  var ta = document.createElement("textarea");
  ta.style.minHeight = "170px";
  ta.setAttribute("aria-label", "Message");
  var dirty = false;
  ta.addEventListener("input", function () {
    dirty = true;
  });
  function picked() {
    return boxes
      .filter(function (b) {
        return b[0].checked;
      })
      .map(function (b) {
        return b[1];
      });
  }
  function msg() {
    if (!dirty) ta.value = routeMessage(d, picked());
  }
  who.input.addEventListener("change", function () {
    dirty = false;
    build();
  });
  var asg = el("label");
  asg.style.cssText = "display:flex;gap:10px;align-items:center;margin:10px 0;font-weight:600";
  var ac = document.createElement("input");
  ac.type = "checkbox";
  ac.checked = true;
  ac.style.cssText = "width:20px;height:20px";
  asg.appendChild(ac);
  asg.appendChild(document.createTextNode("Also assign these stops to them"));
  p.appendChild(asg);
  p.appendChild(el("div", "note", "The message has addresses and notes only: no prices or client names."));
  p.appendChild(ta);
  var acts = el("div", "actions");
  function assign() {
    var sel = picked(),
      m = byId(crew, who.input.value);
    if (!sel.length) {
      alert("Pick at least one stop.");
      return Promise.resolve(false);
    }
    if (!ac.checked || !s3) return Promise.resolve(true);
    return Promise.all(
      sel.map(function (v, i) {
        return sb
          .from("visits")
          .update({ crew_id: m.id, sort_order: i * 10 })
          .eq("id", v.id)
          .then(function (r) {
            if (!r.error) {
              v.crew_id = m.id;
              v.sort_order = i * 10;
            }
            return r;
          });
      })
    ).then(function (rs) {
      render();
      return !rs.some(function (r) {
        return r.error;
      });
    });
  }
  var send = btn("Open text message", "btn", function () {
    var m = byId(crew, who.input.value);
    if (!m.phone && !confirm("No phone number saved for " + m.name + ". Open a blank text anyway?")) return;
    assign().then(function (ok) {
      if (!ok) return;
      window.location.href = smsHref(m.phone, ta.value);
    });
  });
  var cp = btn("Copy message", "btn alt", function () {
    function done() {
      cp.textContent = "Copied";
      setTimeout(function () {
        cp.textContent = "Copy message";
      }, 1500);
    }
    assign().then(function (ok) {
      if (!ok) return;
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(ta.value).then(done, function () {
          ta.select();
          document.execCommand("copy");
          done();
        });
      else {
        ta.select();
        document.execCommand("copy");
        done();
      }
    });
  });
  acts.appendChild(send);
  acts.appendChild(cp);
  p.appendChild(acts);
  build();
}

/* ---- the crew member's own limited screen ---- */
function startCrewApp(me) {
  crewMe = me;
  $("loginwrap").hidden = true;
  $("layout").hidden = true;
  $("gsearch").hidden = true;
  $("crewapp").hidden = false;
  $("signout").hidden = false;
  $("refresh").hidden = false;
  renderCrewApp();
}
function renderCrewApp() {
  var box = $("crewapp"),
    d = cwDate,
    t = today();
  box.textContent = "";
  box.appendChild(el("h2", null, "Hi, " + String(crewMe.name || "").split(" ")[0]));
  box.appendChild(
    calNav(
      longDate(d),
      function () {
        cwDate = addDays(d, -1);
        renderCrewApp();
      },
      function () {
        cwDate = addDays(d, 1);
        renderCrewApp();
      },
      function () {
        cwDate = t;
        renderCrewApp();
      },
      d !== t
    )
  );
  var body = el("div");
  body.appendChild(el("div", "note", "Loading..."));
  box.appendChild(body);
  sb.rpc("crew_route", { p_from: d, p_to: d }).then(function (r) {
    if (cwDate !== d) return;
    body.textContent = "";
    if (r.error) {
      body.appendChild(el("div", "note", "Could not load your route. Pull to refresh or sign in again."));
      return;
    }
    var rows = r.data || [];
    if (!rows.length) {
      body.appendChild(el("div", "empty", "No stops for this day."));
      return;
    }
    var todo = rows.filter(function (x) {
        return x.status === "scheduled";
      }),
      done = rows.length - todo.length;
    var sum = el("div", "daysum");
    sum.appendChild(
      el(
        "b",
        null,
        rows.length + " stop" + (rows.length > 1 ? "s" : "") + (done ? " · " + done + " done" : "")
      )
    );
    var addrs = todo
      .map(function (x) {
        return x.address;
      })
      .filter(Boolean)
      .slice(0, 10);
    if (addrs.length) {
      var a = el("a", "btn sm", "Start route");
      a.href =
        "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" +
        encodeURIComponent(addrs[addrs.length - 1]) +
        (addrs.length > 1 ? "&waypoints=" + encodeURIComponent(addrs.slice(0, -1).join("|")) : "");
      a.target = "_blank";
      a.rel = "noopener";
      sum.appendChild(a);
    }
    body.appendChild(sum);
    rows.forEach(function (x, i) {
      var card = el("div", "pcard cwstop" + (x.status === "done" ? " isdone" : ""));
      card.appendChild(el("div", "cwtitle", i + 1 + ". " + x.job_title));
      card.appendChild(el("div", "cwaddr", x.address));
      var tips = [x.property_notes, x.instructions].filter(Boolean).join("\n");
      if (tips) {
        var n = el("div", "note", "⚠ " + tips);
        n.style.cssText = "color:#7a5b00;white-space:pre-wrap;margin-top:4px";
        card.appendChild(n);
      }
      var acts = el("div", "acts"),
        m = el("a", "btn alt", "Map");
      m.href = mapsUrl(x.address);
      m.target = "_blank";
      m.rel = "noopener";
      acts.appendChild(m);
      var isDone = x.status === "done";
      acts.appendChild(
        btn(isDone ? "Undo" : "Done", isDone ? "btn alt" : "btn", function () {
          sb.rpc("crew_set_done", { p_visit: x.visit_id, p_done: !isDone }).then(function (r2) {
            if (r2.error) alert("Could not save that. Try again.");
            renderCrewApp();
          });
        })
      );
      card.appendChild(acts);
      body.appendChild(card);
    });
  });
}

/* ======================= crm/src/18-billing-invoices.js ======================= */
/* Billing: building invoices from completed visits, and manual invoices. */

/* ======================= BILLING ======================= */

function invNum(n) {
  var s = String(n || 0);
  while (s.length < 4) s = "0" + s;
  return "LC-" + s;
}
function lastMonthEnd() {
  return addDays(today().slice(0, 8) + "01", -1);
}
function bizv(k, d) {
  return biz && biz[k] != null && biz[k] !== "" ? biz[k] : d;
}
function jobTitle(id) {
  var j = byId(jobs, id);
  return j ? j.title : "Lawn service";
}
function loadUnbilled() {
  return sb
    .from("visits")
    .select("*")
    .eq("status", "done")
    .is("invoice_id", null)
    .is("paid_at", null)
    .limit(5000)
    .then(function (r) {
      if (r.error) {
        billErr = true;
        unbilled = [];
      } else unbilled = r.data || [];
    });
}
function reloadInvoices() {
  return sb
    .from("invoices")
    .select("*")
    .order("number", { ascending: false })
    .limit(3000)
    .then(function (r) {
      if (!r.error) invoices = r.data || [];
    });
}
function isOverdue(i) {
  return i.status === "open" && i.due_date && i.due_date < today();
}
function openTotal(arr) {
  return r2(
    arr
      .filter(function (i) {
        return i.status === "open";
      })
      .reduce(function (s, i) {
        return s + balOf(i);
      }, 0)
  );
}
function eligible() {
  return unbilled.filter(function (v) {
    return v.scheduled_date <= billThrough && Number(v.price) > 0;
  });
}
function byProp(cid) {
  var c = byId(clients, cid);
  return !!(c && c.bill_by_property);
}
/* Group visits into invoices: one per client, or one per client+property when that client is set to "separate invoice for each property". */
function groupVisits(vs) {
  var g = {},
    order = [];
  vs.forEach(function (v) {
    var k = v.client_id + (byProp(v.client_id) ? "|" + (v.property_id || "") : "");
    if (!g[k]) {
      g[k] = { key: k, cid: v.client_id, pid: byProp(v.client_id) ? v.property_id || null : null, vs: [] };
      order.push(k);
    }
    g[k].vs.push(v);
  });
  order.sort(function (a, b) {
    return cname(g[a].cid).localeCompare(cname(g[b].cid)) || paddr(g[a].pid).localeCompare(paddr(g[b].pid));
  });
  order.forEach(function (k) {
    g[k].vs.sort(function (a, b) {
      return a.scheduled_date < b.scheduled_date ? -1 : 1;
    });
  });
  return { g: g, order: order };
}
function billGroups() {
  return groupVisits(eligible());
}
function groupTitle(x) {
  return cname(x.cid) + (x.pid ? " \u00b7 " + paddr(x.pid) : "");
}

function createInvoice(cid, vs, through, pid) {
  vs = vs.slice().sort(function (a, b) {
    return a.scheduled_date < b.scheduled_date ? -1 : 1;
  });
  var issue = today(),
    terms = Number(bizv("terms_days", 10)),
    total = r2(
      vs.reduce(function (s, v) {
        return s + Number(v.price || 0);
      }, 0)
    );
  var row = {
    client_id: cid,
    issue_date: issue,
    due_date: addDays(issue, isNaN(terms) ? 10 : terms),
    period_start: vs[0].scheduled_date,
    period_end: through,
    total: total
  };
  if (!pid) {
    var vp = vs
      .map(function (v) {
        return v.property_id || "";
      })
      .filter(function (x, i, a) {
        return a.indexOf(x) === i;
      });
    if (vp.length === 1 && vp[0]) pid = vp[0];
  }
  if (pid) row.property_id = pid;
  if (total === 0) {
    row.status = "paid";
    row.paid_at = issue + "T12:00:00";
    row.paid_method = "No charge";
  }
  return sb
    .from("invoices")
    .insert(row)
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data)
        return Promise.reject(
          pid
            ? "Could not create the invoice. Did you run the Stage 20 SQL?"
            : "Could not create the invoice. Did you run the Stage 5 SQL?"
        );
      var inv = r.data;
      var lines = vs.map(function (v) {
        return {
          invoice_id: inv.id,
          visit_id: v.id,
          service_date: v.scheduled_date,
          address: paddr(v.property_id),
          description: jobTitle(v.job_id),
          amount: v.price
        };
      });
      function undo(msg) {
        return sb
          .from("invoices")
          .delete()
          .eq("id", inv.id)
          .then(function () {
            return Promise.reject(msg);
          });
      }
      return sb
        .from("invoice_items")
        .insert(lines)
        .then(function (r2_) {
          if (r2_.error) return undo("Could not add the invoice lines.");
          return sb
            .from("visits")
            .update({ invoice_id: inv.id })
            .in(
              "id",
              vs.map(function (v) {
                return v.id;
              })
            )
            .is("invoice_id", null)
            .then(function (r3) {
              if (r3.error) return undo("Could not link the visits to the invoice.");
              invoices.unshift(inv);
              return inv;
            });
        });
    });
}

/* Property picker: follows the chosen client's properties. Empty = the whole account (no specific property). */
function propPicker(cs) {
  var w = fld("Property (optional: bill this to one property of the account)", "select", "", [
    ["", "Whole account / no specific property"]
  ]);
  function fill() {
    var cur = w.input.value;
    w.input.textContent = "";
    var o = document.createElement("option");
    o.value = "";
    o.textContent = "Whole account / no specific property";
    w.input.appendChild(o);
    clientProps(cs.input.value).forEach(function (p) {
      var op = document.createElement("option");
      op.value = p.id;
      op.textContent = (p.label ? p.label + " \u00b7 " : "") + p.address;
      w.input.appendChild(op);
    });
    w.input.value = cur;
    if (w.input.value !== cur) w.input.value = "";
  }
  cs.input.addEventListener("change", fill);
  fill();
  return w;
}
/* Manual invoice: pick a client, add the lines, and it is created ready to send (no completed visits needed). */
function openInvoiceForm(cid) {
  if (billErr) {
    alert("Billing isn't set up yet. Run the Stage 5 SQL in Supabase first.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "New invoice"));
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Client",
    "select",
    cid || "",
    [["", "Choose a client..."]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var terms = Number(bizv("terms_days", 10));
  terms = isNaN(terms) ? 10 : terms;
  var g = el("div", "grid2"),
    isd = fld("Invoice date", "date", today()),
    dd = fld("Due date", "date", addDays(today(), terms)),
    dueTouched = false;
  dd.input.addEventListener("change", function () {
    dueTouched = true;
  });
  isd.input.addEventListener("change", function () {
    if (!dueTouched && isd.input.value) dd.input.value = addDays(isd.input.value, terms);
  });
  g.appendChild(isd);
  g.appendChild(dd);
  p.appendChild(g);
  var pps = propPicker(cs);
  p.appendChild(pps);
  var ref = fld("Reference / PO number (optional, shows on the invoice)", "text", "");
  p.appendChild(ref);
  p.appendChild(el("h3", null, "Lines"));
  var box = el("div"),
    rows = [];
  function addRow() {
    var r = el("div", "grid2"),
      d = fld("Description", "text", ""),
      a = fld("Amount ($, negative = discount, 0 = no charge)", "number", "");
    a.input.step = "0.01";
    a.input.inputMode = "decimal";
    r.appendChild(d);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ d: d, a: a });
  }
  p.appendChild(box);
  addRow();
  p.appendChild(btn("+ Add another line", "btn alt sm", addRow));
  var nt = fld("Notes (optional)", "textarea", "");
  nt.style.marginTop = "10px";
  p.appendChild(nt);
  var go = btn("Create invoice", "btn", function () {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    if (!isd.input.value || !dd.input.value) {
      alert("Pick the invoice date and due date.");
      return;
    }
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i].d.input.value.trim(),
        raw = rows[i].a.input.value.trim(),
        a = raw === "" ? 0 : parseFloat(raw);
      if (!d && raw === "") continue;
      if (!d || isNaN(a)) {
        alert("Each line needs a description. (Leave the amount empty or 0 for a no-charge line.)");
        return;
      }
      items.push({ description: d, amount: a });
    }
    if (!items.length) {
      alert("Add at least one line.");
      return;
    }
    var total = r2(
      items.reduce(function (s2, x) {
        return s2 + x.amount;
      }, 0)
    );
    if (total < 0) {
      alert("The total can't be negative.");
      return;
    }
    var zero = total === 0;
    go.disabled = true;
    var pid = pps.input.value || null,
      irow = {
        client_id: cs.input.value,
        issue_date: isd.input.value,
        due_date: dd.input.value,
        total: total,
        reference: ref.input.value.trim(),
        notes: nt.input.value.trim(),
        status: zero ? "paid" : "open",
        paid_at: zero ? isd.input.value + "T12:00:00" : null,
        paid_method: zero ? "No charge" : ""
      };
    if (pid) irow.property_id = pid;
    sb.from("invoices")
      .insert(irow)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert(
            pid
              ? "Could not create the invoice. Did you run the Stage 20 SQL?"
              : "Could not create the invoice. Did you run the Stage 5 SQL?"
          );
          return;
        }
        var inv = r.data;
        items.forEach(function (x) {
          x.invoice_id = inv.id;
          x.service_date = isd.input.value;
          if (pid) x.address = paddr(pid);
        });
        sb.from("invoice_items")
          .insert(items)
          .then(function (r2_) {
            if (r2_.error) {
              sb.from("invoices")
                .delete()
                .eq("id", inv.id)
                .then(function () {
                  go.disabled = false;
                  alert("Could not save the lines.");
                });
              return;
            }
            invoices.unshift(inv);
            repData = null;
            bfilter = zero ? "paid" : "open";
            render();
            openInvoice(inv.id);
          });
      });
  });
  go.style.marginTop = "14px";
  p.appendChild(go);
}

/* ======================= crm/src/19-billing-payments.js ======================= */
/* Billing: customer payments, backfilling invoices, and importing old payments from a CSV. */

/* ---- Customer payments: apply a payment to one or more open invoices (partial or full), with entry and invoice history ---- */
var PAYMETH = [
  ["Zelle", "Zelle"],
  ["Cash", "Cash"],
  ["Check", "Check"],
  ["Other", "Other"]
];
function invPaidSum(inv) {
  var t = 0;
  invPays.forEach(function (x) {
    if (x.invoice_id === inv.id) t += Number(x.amount) || 0;
  });
  return r2(t);
}
function balOf(inv) {
  if (inv.status !== "open") return 0;
  return Math.max(0, r2(Number(inv.total || 0) - invPaidSum(inv)));
}
function creditOf(cid) {
  var t = 0;
  invPays.forEach(function (x) {
    if (!x.invoice_id && x.client_id === cid) t += Number(x.amount) || 0;
  });
  return r2(t);
}
function clientBal(cid) {
  var t = 0;
  invoices.forEach(function (i) {
    if (i.client_id === cid) t += balOf(i);
  });
  return r2(t);
}
function openInvsFor(cid) {
  return invoices
    .filter(function (i) {
      return i.client_id === cid && i.status === "open";
    })
    .sort(function (a, b) {
      return String(a.issue_date) < String(b.issue_date)
        ? -1
        : String(a.issue_date) > String(b.issue_date)
          ? 1
          : a.number - b.number;
    });
}
function delPayment(pr, done) {
  var inv = byId(invoices, pr.invoice_id);
  if (
    !confirm(
      "Delete this " +
        money(pr.amount) +
        " payment" +
        (inv ? " on invoice " + invNum(inv.number) : "") +
        "? The invoice balance goes back up."
    )
  )
    return;
  sb.from("invoice_payments")
    .delete()
    .eq("id", pr.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not delete the payment.");
        return;
      }
      invPays = invPays.filter(function (x) {
        return x.id !== pr.id;
      });
      repData = null;
      if (inv && inv.status === "paid" && invPaidSum(inv) < Number(inv.total) - 0.005) {
        sb.from("invoices")
          .update({ status: "open", paid_at: null, paid_method: "" })
          .eq("id", inv.id)
          .then(function (r2_) {
            if (!r2_.error) {
              inv.status = "open";
              inv.paid_at = null;
              inv.paid_method = "";
            }
            render();
            if (done) done();
          });
      } else {
        render();
        if (done) done();
      }
    });
}
/* Re-check an invoice after its payments changed: fully paid -> Paid (dated by the given payment), otherwise back to Open. */
function syncInvPaid(inv, date, method) {
  if (!inv || inv.status === "void") return Promise.resolve();
  var paid = invPaidSum(inv) >= Number(inv.total) - 0.005 && Number(inv.total) > 0;
  if (paid && inv.status !== "paid") {
    var when = (date || today()) + "T12:00:00";
    return sb
      .from("invoices")
      .update({ status: "paid", paid_at: when, paid_method: method || "" })
      .eq("id", inv.id)
      .then(function (r) {
        if (!r.error) {
          inv.status = "paid";
          inv.paid_at = when;
          inv.paid_method = method || "";
        }
      });
  }
  if (!paid && inv.status === "paid") {
    return sb
      .from("invoices")
      .update({ status: "open", paid_at: null, paid_method: "" })
      .eq("id", inv.id)
      .then(function (r) {
        if (!r.error) {
          inv.status = "open";
          inv.paid_at = null;
          inv.paid_method = "";
        }
      });
  }
  return Promise.resolve();
}
function openPaymentEdit(pr) {
  var oldInv = pr.invoice_id ? byId(invoices, pr.invoice_id) : null,
    cid = pr.client_id || (oldInv && oldInv.client_id) || null;
  var p = panel();
  p.appendChild(el("h2", null, "Edit payment"));
  p.appendChild(el("div", "note", cname(cid)));
  var invs = invoices
    .filter(function (i) {
      return i.client_id === cid && (i.status === "open" || i.id === pr.invoice_id);
    })
    .sort(function (a, b) {
      return b.number - a.number;
    });
  var g = el("div", "grid2"),
    dt = fld("Date", "date", String(pr.paid_on).slice(0, 10)),
    am = fld("Amount ($)", "number", String(pr.amount)),
    me = fld(
      "Pmt. Method",
      "select",
      pr.method,
      PAYMETH.concat(
        PAYMETH.some(function (m) {
          return m[0] === pr.method;
        })
          ? []
          : [[pr.method, pr.method]]
      )
    ),
    rf = fld("Reference", "text", pr.reference || "");
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  [dt, am, me, rf].forEach(function (x) {
    g.appendChild(x);
  });
  p.appendChild(g);
  var iv = fld(
    "Applied to invoice",
    "select",
    pr.invoice_id || "",
    [["", "None (payment on account)"]].concat(
      invs.map(function (i) {
        return [
          i.id,
          invNum(i.number) +
            " \u00b7 " +
            money(i.total) +
            " \u00b7 " +
            (i.status === "paid" ? "paid" : "balance " + money(balOf(i)))
        ];
      })
    )
  );
  p.appendChild(iv);
  var nt = fld("Note", "text", pr.note || "");
  p.appendChild(nt);
  var acts = el("div", "acts");
  acts.style.cssText = "display:flex;gap:8px;margin-top:14px";
  var save = btn("Save changes", "btn", function () {
    var a = Number(am.input.value);
    if (!(a > 0)) {
      alert("Enter the amount.");
      return;
    }
    if (!dt.input.value) {
      alert("Pick the date.");
      return;
    }
    var ni = iv.input.value ? byId(invoices, iv.input.value) : null;
    if (ni) {
      var others = 0;
      invPays.forEach(function (x) {
        if (x.invoice_id === ni.id && x.id !== pr.id) others += Number(x.amount) || 0;
      });
      if (r2(others + a) > Number(ni.total) + 0.005) {
        alert(
          "That's more than invoice " +
            invNum(ni.number) +
            " is for (" +
            money(ni.total) +
            "; " +
            money(r2(others)) +
            " already applied by other payments)."
        );
        return;
      }
    }
    save.disabled = true;
    var row = {
      paid_on: dt.input.value,
      amount: r2(a),
      method: me.input.value,
      reference: rf.input.value.trim(),
      note: nt.input.value.trim(),
      invoice_id: ni ? ni.id : null
    };
    sb.from("invoice_payments")
      .update(row)
      .eq("id", pr.id)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          save.disabled = false;
          alert("Could not save the changes.");
          return;
        }
        for (var i = 0; i < invPays.length; i++) if (invPays[i].id === pr.id) invPays[i] = r.data;
        repData = null;
        var tasks = [];
        if (oldInv && (!ni || ni.id !== oldInv.id))
          tasks.push(syncInvPaid(oldInv, r.data.paid_on, r.data.method));
        if (ni) tasks.push(syncInvPaid(ni, r.data.paid_on, r.data.method));
        Promise.all(tasks).then(function () {
          render();
          openPayment(cid);
        });
      });
  });
  acts.appendChild(save);
  acts.appendChild(
    btn("Cancel", "btn alt", function () {
      openPayment(cid);
    })
  );
  p.appendChild(acts);
}
function openPayment(cid, pre) {
  pre = pre || {};
  if (billErr) {
    alert("Billing isn't set up yet. Run the Stage 5 SQL in Supabase first.");
    return;
  }
  if (payErr) {
    alert("Customer payments need the Stage 18 SQL. Run it in Supabase (SQL Editor), then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Customer payment"));
  if (pre.saved) {
    var ok = el("div", "pcard", "✓ Payment saved.");
    ok.style.cssText = "background:var(--mint);font-weight:700";
    p.appendChild(ok);
  }
  var cl = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Customer Name",
    "select",
    cid || "",
    [["", "Choose a customer..."]].concat(
      cl.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var balBox = el("div");
  balBox.style.cssText = "display:flex;justify-content:space-between;margin:0 0 10px;font-weight:600";
  p.appendChild(balBox);
  var g = el("div", "grid2"),
    dt = fld("Date", "date", today()),
    am = fld("Amount ($)", "number", ""),
    me = fld("Pmt. Method", "select", "Zelle", PAYMETH),
    rf = fld("Reference", "text", "");
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  [dt, am, me, rf].forEach(function (x) {
    g.appendChild(x);
  });
  p.appendChild(g);
  var nt = fld("Note", "text", "");
  p.appendChild(nt);
  var host = el("div");
  p.appendChild(host);
  var sel = {},
    app = {},
    amtTouched = false,
    rows = [];
  function sumSel() {
    var t = 0;
    rows.forEach(function (i) {
      if (sel[i.id]) t += balOf(i);
    });
    return r2(t);
  }
  function distribute() {
    var left = Number(am.input.value) || 0;
    rows.forEach(function (i) {
      if (sel[i.id]) {
        var a = Math.min(balOf(i), Math.max(0, left));
        app[i.id] = r2(a);
        left = r2(left - a);
      } else app[i.id] = 0;
    });
  }
  function totals() {
    var b = 0,
      a = 0;
    rows.forEach(function (i) {
      if (sel[i.id]) {
        b += balOf(i);
        a += Number(app[i.id]) || 0;
      }
    });
    return { b: r2(b), a: r2(a) };
  }
  am.input.addEventListener("input", function () {
    amtTouched = true;
    distribute();
    draw();
  });
  function draw() {
    host.textContent = "";
    var cid2 = cs.input.value;
    balBox.textContent = "";
    balBox.appendChild(el("span", null, "Customer Balance"));
    balBox.appendChild(el("b", null, cid2 ? money(clientBal(cid2)) : "$0"));
    var cr = cid2 ? creditOf(cid2) : 0;
    if (cr > 0) {
      var crb = el("span", null, "Payments on account: " + money(cr));
      crb.style.cssText = "width:100%;font-weight:400;font-size:.88rem;color:var(--muted,#555)";
      balBox.style.flexWrap = "wrap";
      balBox.appendChild(crb);
    }
    if (!cid2) return;
    rows = openInvsFor(cid2);
    var wrap = el("div", "invwrap"),
      t = document.createElement("table");
    t.className = "ptable";
    var hr = document.createElement("tr");
    ["✓", "Date", "Number", "Amount", "Balance", "Applied"].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i > 2) th.className = "r";
      hr.appendChild(th);
    });
    t.appendChild(hr);
    if (!rows.length) {
      var e = document.createElement("tr"),
        ed = document.createElement("td");
      ed.colSpan = 6;
      ed.textContent = "No open invoices for this customer.";
      e.appendChild(ed);
      t.appendChild(e);
    }
    rows.forEach(function (i) {
      var tr = document.createElement("tr"),
        c0 = document.createElement("td"),
        ck = document.createElement("input");
      ck.type = "checkbox";
      ck.checked = !!sel[i.id];
      ck.style.width = "auto";
      ck.setAttribute("aria-label", "Apply to " + invNum(i.number));
      ck.addEventListener("change", function () {
        sel[i.id] = ck.checked;
        if (!amtTouched || !(Number(am.input.value) > 0)) {
          am.input.value = sumSel() > 0 ? String(sumSel()) : "";
        }
        distribute();
        draw();
      });
      c0.appendChild(ck);
      tr.appendChild(c0);
      [mdy(i.issue_date), invNum(i.number), money(i.total), money(balOf(i))].forEach(function (x, k) {
        var td = document.createElement("td");
        td.textContent = x;
        if (k > 1) td.className = "r";
        tr.appendChild(td);
      });
      var ap = document.createElement("td");
      ap.className = "r";
      var inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.01";
      inp.min = "0";
      inp.inputMode = "decimal";
      inp.value = app[i.id] ? String(app[i.id]) : "";
      inp.placeholder = "0";
      inp.disabled = !sel[i.id];
      inp.style.cssText = "width:90px;text-align:right";
      inp.addEventListener("change", function () {
        app[i.id] = Math.max(0, r2(Number(inp.value) || 0));
        if (!amtTouched) {
          var s2 = 0;
          rows.forEach(function (x) {
            if (sel[x.id]) s2 += Number(app[x.id]) || 0;
          });
          am.input.value = s2 > 0 ? String(r2(s2)) : "";
        }
        draw();
      });
      ap.appendChild(inp);
      tr.appendChild(ap);
      t.appendChild(tr);
    });
    wrap.appendChild(t);
    host.appendChild(wrap);
    var tt = totals(),
      sm = el("div");
    sm.style.cssText = "margin:10px 0;text-align:right";
    sm.appendChild(el("div", null, "Amounts for Selected Invoices"));
    sm.appendChild(el("div", "note", "Balance " + money(tt.b)));
    sm.appendChild(el("div", "note", "Applied " + money(tt.a)));
    host.appendChild(sm);
    var save = btn("Save payment", "btn", function () {
      var tt2 = totals(),
        amt = Number(am.input.value) || 0;
      if (!dt.input.value) {
        alert("Pick the date.");
        return;
      }
      var picks = rows.filter(function (i) {
        return sel[i.id] && (Number(app[i.id]) || 0) > 0;
      });
      if (!picks.length && !(amt > 0)) {
        alert("Enter the amount, and tick an invoice if it's for one. (An invoice is optional.)");
        return;
      }
      for (var k = 0; k < picks.length; k++)
        if (app[picks[k].id] > balOf(picks[k]) + 0.005) {
          alert("The amount applied to " + invNum(picks[k].number) + " is more than its balance.");
          return;
        }
      var extra = amt > 0 ? r2(amt - tt2.a) : 0;
      if (extra < -0.005) {
        alert(
          "More is applied to invoices (" + money(tt2.a) + ") than the amount received (" + money(amt) + ")."
        );
        return;
      }
      if (
        extra > 0.005 &&
        !confirm(
          picks.length
            ? money(extra) +
                " of the " +
                money(amt) +
                " isn't applied to an invoice. Save it as a payment on account?"
            : "No invoice is ticked. Save " +
                money(amt) +
                " as a payment on account (not applied to an invoice)?"
        )
      )
        return;
      save.disabled = true;
      var recs = picks.map(function (i) {
        return {
          invoice_id: i.id,
          client_id: i.client_id,
          paid_on: dt.input.value,
          amount: r2(app[i.id]),
          method: me.input.value,
          reference: rf.input.value.trim(),
          note: nt.input.value.trim()
        };
      });
      if (extra > 0.005)
        recs.push({
          invoice_id: null,
          client_id: cid2,
          paid_on: dt.input.value,
          amount: extra,
          method: me.input.value,
          reference: rf.input.value.trim(),
          note: nt.input.value.trim()
        });
      sb.from("invoice_payments")
        .insert(recs)
        .select()
        .then(function (r) {
          if (r.error || !r.data) {
            save.disabled = false;
            alert(
              "Could not save the payment. If it was not for an invoice, run the Stage 18b SQL in Supabase first."
            );
            return;
          }
          r.data.forEach(function (x) {
            invPays.unshift(x);
          });
          repData = null;
          var ups = [];
          picks.forEach(function (i) {
            if (invPaidSum(i) >= Number(i.total) - 0.005) {
              var when = dt.input.value + "T12:00:00";
              ups.push(
                sb
                  .from("invoices")
                  .update({ status: "paid", paid_at: when, paid_method: me.input.value })
                  .eq("id", i.id)
                  .then(function (r2_) {
                    if (!r2_.error) {
                      i.status = "paid";
                      i.paid_at = when;
                      i.paid_method = me.input.value;
                    }
                  })
              );
            }
          });
          Promise.all(ups).then(function () {
            render();
            openPayment(cid2, { saved: true });
          });
        });
    });
    save.style.marginTop = "6px";
    host.appendChild(save);
    /* payment entries (spreadsheet) */
    var h1 = el("h3", null, "Payment entries");
    h1.style.margin = "18px 0 6px";
    host.appendChild(h1);
    var ent = invPays
      .filter(function (x) {
        return x.client_id === cid2 || (byId(invoices, x.invoice_id) || {}).client_id === cid2;
      })
      .sort(function (a, b) {
        return String(b.paid_on).localeCompare(String(a.paid_on));
      });
    if (!ent.length) host.appendChild(el("div", "empty", "No payments recorded for this customer."));
    else {
      var w2 = el("div", "invwrap"),
        t2 = document.createElement("table");
      t2.className = "ptable";
      var h2 = document.createElement("tr");
      ["Date", "Invoice", "Method", "Reference", "Amount", ""].forEach(function (x, i) {
        var th = document.createElement("th");
        th.textContent = x;
        if (i === 4) th.className = "r";
        h2.appendChild(th);
      });
      t2.appendChild(h2);
      ent.forEach(function (x) {
        var iv = byId(invoices, x.invoice_id),
          tr = document.createElement("tr");
        [
          mdy(x.paid_on),
          iv ? invNum(iv.number) : "On account",
          x.method,
          x.reference,
          money(x.amount)
        ].forEach(function (v, k) {
          var td = document.createElement("td");
          td.textContent = v;
          if (k === 4) td.className = "r";
          tr.appendChild(td);
        });
        var dx = document.createElement("td"),
          eb = btn("Edit", "btn alt sm", function () {
            openPaymentEdit(x);
          }),
          db = btn("Delete", "btn danger sm", function () {
            delPayment(x, function () {
              openPayment(cid2);
            });
          });
        dx.style.whiteSpace = "nowrap";
        dx.appendChild(eb);
        dx.appendChild(document.createTextNode(" "));
        dx.appendChild(db);
        tr.appendChild(dx);
        t2.appendChild(tr);
      });
      w2.appendChild(t2);
      host.appendChild(w2);
    }
    /* invoice history */
    var h3 = el("h3", null, "Invoice history");
    h3.style.margin = "18px 0 6px";
    host.appendChild(h3);
    var hist = invoices
      .filter(function (i) {
        return i.client_id === cid2;
      })
      .sort(function (a, b) {
        return b.number - a.number;
      });
    if (!hist.length) host.appendChild(el("div", "empty", "No invoices for this customer yet."));
    else {
      var w3 = el("div", "invwrap"),
        t3 = document.createElement("table");
      t3.className = "ptable";
      var h4 = document.createElement("tr");
      ["Number", "Date", "Due", "Amount", "Balance", "Status"].forEach(function (x, i) {
        var th = document.createElement("th");
        th.textContent = x;
        if (i === 3 || i === 4) th.className = "r";
        h4.appendChild(th);
      });
      t3.appendChild(h4);
      hist.forEach(function (i) {
        var tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.title = "Open invoice";
        var stt =
          i.status === "paid"
            ? "Paid" +
              (i.paid_at ? " " + dshort(String(i.paid_at).slice(0, 10)) : "") +
              (i.paid_method ? " (" + i.paid_method + ")" : "")
            : i.status === "void"
              ? "Void"
              : isOverdue(i)
                ? "Overdue"
                : invPaidSum(i) > 0
                  ? "Partly paid"
                  : "Open";
        [invNum(i.number), mdy(i.issue_date), mdy(i.due_date), money(i.total), money(balOf(i)), stt].forEach(
          function (v, k) {
            var td = document.createElement("td");
            td.textContent = v;
            if (k === 3 || k === 4) td.className = "r";
            tr.appendChild(td);
          }
        );
        tr.addEventListener("click", function () {
          openInvoice(i.id);
        });
        t3.appendChild(tr);
      });
      w3.appendChild(t3);
      host.appendChild(w3);
    }
  }
  cs.input.addEventListener("change", function () {
    sel = {};
    app = {};
    amtTouched = false;
    am.input.value = "";
    draw();
  });
  if (pre.inv) {
    var iv0 = byId(invoices, pre.inv);
    if (iv0 && iv0.status === "open") {
      sel[iv0.id] = true;
      am.input.value = String(balOf(iv0));
      distribute();
    }
  }
  draw();
}
/* Backfill: invoices for money already recorded without one (payments on account, and visits paid at the visit), dated on the day each payment was received. */
function backfillCards(host) {
  sb.from("visits")
    .select("*")
    .eq("status", "done")
    .is("invoice_id", null)
    .gte("paid_at", "1900-01-01T00:00:00")
    .limit(5000)
    .then(function (r) {
      var vs = (r.error ? [] : r.data || []).filter(function (v) {
        return v.paid_method !== "No charge" && Number(v.price) > 0;
      });
      var oa = invPays.filter(function (x) {
          return !x.invoice_id && x.client_id;
        }),
        n = vs.length + oa.length;
      if (!n) return;
      var tot = r2(
        vs.reduce(function (a, v) {
          return a + Number(v.price);
        }, 0) +
          oa.reduce(function (a, x) {
            return a + Number(x.amount);
          }, 0)
      );
      var c = el("div", "pcard");
      c.style.cssText = "background:#eef6ec;margin-bottom:12px";
      c.appendChild(
        el("b", null, n + " payment" + (n > 1 ? "s have" : " has") + " no invoice (" + money(tot) + ")")
      );
      c.appendChild(
        el(
          "div",
          "note",
          oa.length +
            " payment" +
            (oa.length === 1 ? "" : "s") +
            " on account and " +
            vs.length +
            " visit" +
            (vs.length === 1 ? "" : "s") +
            " paid at the visit. Press the button to create one paid Lawn maintenance invoice for each payment, dated the day that payment was received, with the payment attached. Nothing is sent to clients."
        )
      );
      var mk = btn(
        "Create " + n + " invoice" + (n > 1 ? "s" : "") + " from these payments",
        "btn sm",
        function () {
          if (
            !confirm(
              "Create " +
                n +
                " paid invoice" +
                (n > 1 ? "s" : "") +
                " (" +
                money(tot) +
                ") dated on each payment's date? This can't be undone in one step."
            )
          )
            return;
          mk.disabled = true;
          var terms = Number(bizv("terms_days", 10));
          terms = isNaN(terms) ? 10 : terms;
          var made = 0,
            fails = [];
          function mkInv(cid, date, amount, method, ref, note, periodStart, pid) {
            var row_ = {
              client_id: cid,
              issue_date: date,
              due_date: addDays(date, terms),
              period_start: periodStart || null,
              period_end: periodStart || null,
              total: amount,
              reference: ref || "",
              notes: note,
              status: "paid",
              paid_at: date + "T12:00:00",
              paid_method: method || ""
            };
            if (pid) row_.property_id = pid;
            return sb
              .from("invoices")
              .insert(row_)
              .select()
              .single()
              .then(function (r1) {
                if (r1.error || !r1.data) return Promise.reject("invoice");
                return r1.data;
              });
          }
          var jobs = [];
          function J(d, f) {
            f.d = d;
            jobs.push(f);
          }
          oa.forEach(function (x) {
            J(String(x.paid_on).slice(0, 10), function () {
              var d = String(x.paid_on).slice(0, 10);
              return mkInv(
                x.client_id,
                d,
                Number(x.amount),
                x.method,
                x.reference,
                "Created from a recorded payment (no earlier invoice on file)."
              ).then(function (inv) {
                return sb
                  .from("invoice_items")
                  .insert({
                    invoice_id: inv.id,
                    service_date: d,
                    description: "Lawn maintenance" + (x.note ? " - " + x.note : ""),
                    amount: Number(x.amount)
                  })
                  .then(function (r2_) {
                    if (r2_.error) {
                      sb.from("invoices").delete().eq("id", inv.id);
                      return Promise.reject("line");
                    }
                    return sb
                      .from("invoice_payments")
                      .update({ invoice_id: inv.id })
                      .eq("id", x.id)
                      .then(function (r3) {
                        if (r3.error) {
                          sb.from("invoices").delete().eq("id", inv.id);
                          return Promise.reject("link");
                        }
                        x.invoice_id = inv.id;
                        invoices.unshift(inv);
                        made++;
                      });
                  });
              });
            });
          });
          vs.forEach(function (v) {
            J(String(v.paid_at).slice(0, 10), function () {
              var d = String(v.paid_at).slice(0, 10);
              return mkInv(
                v.client_id,
                d,
                Number(v.price),
                v.paid_method,
                "",
                "Created from a visit paid at the time of service.",
                v.scheduled_date,
                v.property_id || null
              ).then(function (inv) {
                return sb
                  .from("invoice_items")
                  .insert({
                    invoice_id: inv.id,
                    visit_id: v.id,
                    service_date: v.scheduled_date,
                    address: paddr(v.property_id),
                    description: jobTitle(v.job_id),
                    amount: Number(v.price)
                  })
                  .then(function (r2_) {
                    if (r2_.error) {
                      sb.from("invoices").delete().eq("id", inv.id);
                      return Promise.reject("line");
                    }
                    return sb
                      .from("visits")
                      .update({ invoice_id: inv.id })
                      .eq("id", v.id)
                      .then(function (r3) {
                        if (r3.error) {
                          sb.from("invoices").delete().eq("id", inv.id);
                          return Promise.reject("link");
                        }
                        var tail = payErr
                          ? Promise.resolve()
                          : sb
                              .from("invoice_payments")
                              .insert({
                                invoice_id: inv.id,
                                client_id: v.client_id,
                                paid_on: d,
                                amount: Number(v.price),
                                method: v.paid_method || "Other",
                                reference: "",
                                note: "Paid at the visit"
                              })
                              .select()
                              .single()
                              .then(function (r4) {
                                if (!r4.error && r4.data) invPays.unshift(r4.data);
                              });
                        return tail.then(function () {
                          invoices.unshift(inv);
                          made++;
                        });
                      });
                  });
              });
            });
          });
          jobs.sort(function (a, b) {
            return a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
          });
          jobs
            .reduce(function (pr, j) {
              return pr.then(function () {
                return j().then(null, function (e) {
                  fails.push(String(e));
                });
              });
            }, Promise.resolve())
            .then(function () {
              return loadUnbilled();
            })
            .then(function () {
              repData = null;
              render();
              alert(
                "Created " +
                  made +
                  " invoice" +
                  (made === 1 ? "" : "s") +
                  "." +
                  (fails.length
                    ? "\n\n" + fails.length + " could not be created and were left as they were."
                    : "")
              );
            });
        }
      );
      mk.style.marginTop = "8px";
      c.appendChild(mk);
      host.appendChild(c);
    });
}
function renderPayments(list) {
  $("topbtns").appendChild(
    btn("Customer payment", "btn", function () {
      openPayment(null);
    })
  );
  var bfh = el("div");
  list.appendChild(bfh);
  if (!payErr || true) backfillCards(bfh);
  if (payErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Customer payments aren't set up yet. Run the Stage 18 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var set = invPays
    .filter(function (x) {
      if (!query) return true;
      var iv = byId(invoices, x.invoice_id);
      return (
        [cname(x.client_id), iv ? invNum(iv.number) : "", x.method, x.reference]
          .join(" ")
          .toLowerCase()
          .indexOf(query) > -1
      );
    })
    .sort(function (a, b) {
      return String(b.paid_on).localeCompare(String(a.paid_on));
    });
  if (!set.length) {
    list.appendChild(el("div", "empty", "No customer payments yet. Press Customer payment to record one."));
    return;
  }
  var tot = r2(
    set.reduce(function (s, x) {
      return s + Number(x.amount);
    }, 0)
  );
  list.appendChild(
    el("div", "note", "Showing " + set.length + " payment" + (set.length > 1 ? "s" : "") + " · " + money(tot))
  );
  set.forEach(function (x) {
    var iv = byId(invoices, x.invoice_id),
      c = el("div", "pcard"),
      top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, cname(x.client_id || (iv && iv.client_id)) + " · " + money(x.amount)));
    l.appendChild(
      el(
        "div",
        "note",
        [
          mdy(x.paid_on),
          iv ? "Invoice " + invNum(iv.number) : "On account",
          x.method,
          x.reference ? "Ref " + x.reference : "",
          x.note
        ]
          .filter(Boolean)
          .join(" · ")
      )
    );
    top.appendChild(l);
    var a = el("div", "acts");
    a.style.marginTop = "0";
    a.appendChild(
      btn("Edit", "btn alt sm", function () {
        openPaymentEdit(x);
      })
    );
    a.appendChild(
      btn("Customer", "btn alt sm", function () {
        openPayment(x.client_id || (iv && iv.client_id));
      })
    );
    a.appendChild(
      btn("Delete", "btn danger sm", function () {
        delPayment(x);
      })
    );
    top.appendChild(a);
    c.appendChild(top);
    list.appendChild(c);
  });
}

/* Import payments from the old software's "Customer Payments" CSV: one paid invoice + one payment per row (nothing is emailed). */
function normNm(x) {
  return String(x || "")
    .toLowerCase()
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
function isoMDY(x) {
  var m = String(x || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2) : "";
}
function guessClient(name) {
  var n = normNm(name);
  if (!n) return "";
  var ex = clients.filter(function (c) {
    return [c.name, c.company, c.nickname, dispName(c)].some(function (v) {
      return normNm(v) === n;
    });
  });
  if (ex.length === 1) return ex[0].id;
  if (ex.length > 1) return "";
  var part = clients.filter(function (c) {
    return (
      n.length >= 6 &&
      [c.name, c.company].some(function (v) {
        var k = normNm(v);
        return k && (k.indexOf(n) > -1 || n.indexOf(k) > -1);
      })
    );
  });
  return part.length === 1 ? part[0].id : "";
}
function openPayImport() {
  if (billErr || payErr) {
    alert("Run the Stage 5 and Stage 18 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Import payments from CSV"));
  p.appendChild(
    el(
      "p",
      "note",
      'Use the old software\'s Customer Payments export (columns: Date, Comment, Amount, Name, Customer_Number...). Each payment becomes a paid "Lawn maintenance" invoice dated the same day, with the payment applied, so nothing shows as owed. Payments already in the CRM (same client, date and amount) are skipped, so running it twice is safe.'
    )
  );
  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,text/csv";
  p.appendChild(file);
  var out = el("div");
  out.style.marginTop = "12px";
  p.appendChild(out);
  file.addEventListener("change", function () {
    var f = file.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var rows = parseCSV(String(rd.result));
      out.textContent = "";
      var hd = (rows[0] || []).map(function (h) {
        return String(h).trim().toLowerCase();
      });
      function ci(n) {
        return hd.indexOf(n);
      }
      var cD = ci("date"),
        cC = ci("comment"),
        cA = ci("amount"),
        cN = ci("name"),
        cK = ci("customer_number");
      if (cD < 0 || cA < 0 || cN < 0) {
        out.textContent =
          "I can't find the Date, Amount and Name columns. Is this the Customer Payments export?";
        return;
      }
      function g(r, i) {
        return i > -1 && r[i] != null ? String(r[i]).trim() : "";
      }
      var recs = [];
      rows.slice(1).forEach(function (r) {
        var d = isoMDY(g(r, cD)),
          a = parseFloat(g(r, cA)),
          nm = g(r, cN);
        if (!d || isNaN(a) || !nm) return;
        var cm = g(r, cC),
          im = cm.match(/inv\s*#?\s*(\d+)/i);
        recs.push({
          d: d,
          a: Math.round(a * 100) / 100,
          nm: nm,
          key: g(r, cK) || nm,
          cm: cm,
          old: im ? im[1] : "",
          std: /payment|account credit/i.test(cm)
        });
      });
      if (!recs.length) {
        out.textContent = "No payment rows found in that file.";
        return;
      }
      recs.sort(function (x, y) {
        return x.d < y.d ? -1 : x.d > y.d ? 1 : 0;
      });
      var odd = {};
      recs.forEach(function (r) {
        if (!r.std) odd[r.cm || "(no comment)"] = (odd[r.cm || "(no comment)"] || 0) + 1;
      });
      var oddBox = {};
      var cust = {},
        order = [];
      recs.forEach(function (r) {
        if (!cust[r.key]) {
          cust[r.key] = { key: r.key, nm: r.nm, n: 0, tot: 0, sel: null };
          order.push(r.key);
        }
        cust[r.key].n++;
        cust[r.key].tot = r.a + cust[r.key].tot;
      });
      p.appendChild(el("h3", null, "Match each old customer to a CRM client"));
      var opts = [
        ["", "Choose a client..."],
        ["skip", "Skip this customer"]
      ].concat(
        clients.map(function (c) {
          return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
        })
      );
      var tbox = el("div");
      order.forEach(function (k) {
        var c = cust[k],
          row = el("div", "pcard"),
          sel = fld(
            c.nm + " (#" + k + ") · " + c.n + " payment" + (c.n > 1 ? "s" : "") + " · " + money(r2(c.tot)),
            "select",
            guessClient(c.nm),
            opts
          );
        row.appendChild(sel);
        c.sel = sel;
        tbox.appendChild(row);
        sel.input.addEventListener("change", sum);
      });
      p.appendChild(tbox);
      Object.keys(odd).forEach(function (k) {
        var lab = document.createElement("label");
        lab.style.cssText = "display:flex;gap:8px;align-items:center;margin:8px 0";
        var ck = document.createElement("input");
        ck.type = "checkbox";
        ck.style.cssText = "width:auto;margin:0";
        ck.checked = false;
        lab.appendChild(ck);
        lab.appendChild(
          document.createTextNode(
            "Also import " +
              odd[k] +
              " row" +
              (odd[k] > 1 ? "s" : "") +
              ' labeled "' +
              k +
              '" (off by default: these are carried credits, not payments)'
          )
        );
        oddBox[k] = ck;
        ck.addEventListener("change", sum);
        p.appendChild(lab);
      });
      var info = el("div", "note");
      info.style.margin = "10px 0";
      p.appendChild(info);
      var go = btn("Import payments", "btn", run);
      p.appendChild(go);
      var plan = [];
      function sum() {
        var have = {};
        invPays.forEach(function (x) {
          var k =
            (x.client_id || (byId(invoices, x.invoice_id) || {}).client_id) +
            "|" +
            String(x.paid_on).slice(0, 10) +
            "|" +
            r2(Number(x.amount));
          have[k] = (have[k] || 0) + 1;
        });
        plan = [];
        var dup = 0,
          skipped = 0,
          unmapped = 0,
          tot = 0;
        recs.forEach(function (r) {
          var c = cust[r.key],
            v = c.sel.input.value;
          if (!r.std && !(oddBox[r.cm || "(no comment)"] && oddBox[r.cm || "(no comment)"].checked)) {
            skipped++;
            return;
          }
          if (v === "skip") {
            skipped++;
            return;
          }
          if (!v) {
            unmapped++;
            return;
          }
          var k = v + "|" + r.d + "|" + r.a;
          if (have[k] > 0) {
            have[k]--;
            dup++;
            return;
          }
          plan.push({ r: r, cid: v });
          tot += r.a;
        });
        info.textContent =
          "Will create " +
          plan.length +
          " paid invoice" +
          (plan.length === 1 ? "" : "s") +
          " and payment" +
          (plan.length === 1 ? "" : "s") +
          " totaling " +
          money(r2(tot)) +
          ". Already in the CRM: " +
          dup +
          ". Skipped: " +
          skipped +
          "." +
          (unmapped ? " Still to match: " + unmapped + " row(s)." : "");
        go.disabled = !plan.length || unmapped > 0;
      }
      sum();
      function run() {
        if (!confirm("Create " + plan.length + " paid invoices with payments?")) return;
        go.disabled = true;
        var made = 0,
          fails = [],
          terms = Number(bizv("terms_days", 10));
        terms = isNaN(terms) ? 10 : terms;
        function one(i) {
          if (i >= plan.length) return Promise.resolve();
          go.textContent = "Importing " + (i + 1) + " of " + plan.length + "...";
          var x = plan[i],
            r = x.r,
            ps = clientProps(x.cid),
            adr = ps.length === 1 ? ps[0].address : "";
          return sb
            .from("invoices")
            .insert({
              client_id: x.cid,
              issue_date: r.d,
              due_date: addDays(r.d, terms),
              total: r.a,
              reference: r.old,
              notes: "Imported from the old software's payment history." + (r.cm ? " (" + r.cm + ")" : ""),
              status: "paid",
              paid_at: r.d + "T12:00:00",
              paid_method: "Other",
              property_id: ps.length === 1 ? ps[0].id : null
            })
            .select()
            .single()
            .then(function (q) {
              if (q.error || !q.data) {
                fails.push(r.d + " " + money(r.a) + " " + r.nm);
                return;
              }
              var inv = q.data;
              function undo() {
                return sb
                  .from("invoices")
                  .delete()
                  .eq("id", inv.id)
                  .then(function () {
                    fails.push(r.d + " " + money(r.a) + " " + r.nm);
                  });
              }
              return sb
                .from("invoice_items")
                .insert({
                  invoice_id: inv.id,
                  service_date: r.d,
                  address: adr,
                  description: "Lawn maintenance",
                  amount: r.a
                })
                .then(function (q2) {
                  if (q2.error) return undo();
                  return sb
                    .from("invoice_payments")
                    .insert({
                      invoice_id: inv.id,
                      client_id: x.cid,
                      paid_on: r.d,
                      amount: r.a,
                      method: "Other",
                      reference: r.old,
                      note: "Imported" + (r.cm ? ": " + r.cm : "")
                    })
                    .then(function (q3) {
                      if (q3.error) return undo();
                      made++;
                    });
                });
            })
            .then(function () {
              return one(i + 1);
            });
        }
        one(0)
          .then(function () {
            return Promise.all([
              reloadInvoices(),
              sb
                .from("invoice_payments")
                .select("*")
                .order("paid_on", { ascending: false })
                .limit(10000)
                .then(function (q) {
                  if (!q.error) invPays = q.data || [];
                })
            ]);
          })
          .then(function () {
            repData = null;
            closeDetail();
            bfilter = "paid";
            render();
            alert(
              "Imported " +
                made +
                " payment" +
                (made === 1 ? "" : "s") +
                " with paid invoices." +
                (fails.length
                  ? "\n\nCould not import:\n" +
                    fails.slice(0, 15).join("\n") +
                    (fails.length > 15 ? "\n...and " + (fails.length - 15) + " more" : "")
                  : "")
            );
          });
      }
    };
    rd.readAsText(f);
  });
}

/* ======================= crm/src/20-billing-history-import.js ======================= */
/* Billing: importing a client's old account statement, and recording past invoices. */

/* ---- Import account history: an old statement (charges and payments) for one client or many, from a CSV file or rows pasted from a spreadsheet.
   Charges become invoices; payments are applied to the oldest unpaid invoice first, the way the old software did it; anything left over stays as credit on account.
   Rows already in the CRM (same client, date and amount) are skipped, so running the same file twice is safe. Nothing is emailed. ---- */
var HIST_COLS = {
  date: ["date", "trans date", "transaction date", "invoice date"],
  customer: ["customer", "customer name", "name", "client", "client name"],
  address: ["address", "service address", "property"],
  type: ["type", "trans type", "transaction type"],
  desc: ["description", "desc", "item", "service", "comment", "memo", "details"],
  amount: ["amount", "amt", "total"],
  charge: ["charges", "charge", "debit", "debits"],
  pay: ["payments", "payment", "credits", "credit"],
  method: ["method", "pmt. method", "pmt method", "payment method", "paid by"],
  ref: ["reference", "ref", "inv#", "inv #", "invoice #", "invoice number", "check #", "check number"],
  bal: ["balance", "running balance"]
};
function histDate(x) {
  x = String(x || "").trim();
  var m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = x.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/);
  if (!m) return "";
  var mo = +m[1],
    d = +m[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
}
function histNum(x) {
  var s = String(x == null ? "" : x).trim();
  if (!s) return null;
  var neg = /^\(.*\)$/.test(s) || /^-|-$/.test(s.replace(/[\s$]/g, ""));
  s = s.replace(/[^0-9.]/g, "");
  if (!s || isNaN(parseFloat(s))) return null;
  return r2(neg ? -parseFloat(s) : parseFloat(s));
}
function histMeth(x) {
  x = String(x || "").toLowerCase();
  return /zelle/.test(x)
    ? "Zelle"
    : /cash/.test(x)
      ? "Cash"
      : /\bche(ck|que)\b|\bchk\b/.test(x)
        ? "Check"
        : /other|card|venmo|paypal|ach|transfer/.test(x)
          ? "Other"
          : "";
}
function histRows(text) {
  var t = String(text || "")
    .replace(/^﻿/, "")
    .replace(/\r/g, "");
  var ls = t.split("\n").filter(function (l) {
    return l.trim();
  });
  if (!ls.length) return [];
  if (
    ls.some(function (l) {
      return l.indexOf("\t") > -1;
    })
  )
    return ls.map(function (l) {
      return l.split("\t");
    });
  return parseCSV(t);
}
/* Read the rows into charges and payments. A file with no header row is read as: Date, Description, Charges, Payments, Balance. */
function histParse(rows) {
  if (!rows.length) return { err: "There's nothing to read. Choose a file or paste the rows." };
  var hd = rows[0].map(function (h) {
      return String(h).trim().toLowerCase().replace(/\s+/g, " ");
    }),
    col = {};
  Object.keys(HIST_COLS).forEach(function (k) {
    col[k] = -1;
    HIST_COLS[k].some(function (n) {
      var i = hd.indexOf(n);
      if (
        i > -1 &&
        !Object.keys(col).some(function (o) {
          return col[o] === i;
        })
      ) {
        col[k] = i;
        return true;
      }
      return false;
    });
  });
  var body = rows.slice(1),
    noHead = false;
  if (col.date < 0) {
    if (!histDate(rows[0][0]))
      return {
        err: "I can't find a Date column. Put a header row on top (Date, Description, Charges, Payments...), or paste the rows in the order Date, Description, Charges, Payments, Balance."
      };
    col = {
      date: 0,
      desc: 1,
      charge: 2,
      pay: 3,
      bal: 4,
      customer: -1,
      address: -1,
      type: -1,
      amount: -1,
      method: -1,
      ref: -1
    };
    body = rows;
    noHead = true;
  }
  if (col.amount < 0 && col.charge < 0 && col.pay < 0)
    return {
      err: "I can't find the money columns. The file needs an Amount column (with a Type column saying Invoice or Payment), or separate Charges and Payments columns."
    };
  function g(r, k) {
    return col[k] > -1 && r[col[k]] != null ? String(r[col[k]]).trim() : "";
  }
  var recs = [],
    bad = [],
    zero = 0;
  body.forEach(function (r, ix) {
    if (!r.join("").trim()) return;
    var d = histDate(g(r, "date")),
      desc = g(r, "desc"),
      ty = g(r, "type").toLowerCase();
    if (!d) {
      if (!/balance forward|beginning balance|total/i.test(r.join(" ")))
        bad.push(r.join(" ").replace(/\s+/g, " ").trim().slice(0, 70));
      return;
    }
    var ch = histNum(g(r, "charge")),
      py = histNum(g(r, "pay")),
      am = histNum(g(r, "amount")),
      kind = "",
      amt = 0;
    if (ch) {
      kind = ch > 0 ? "charge" : "pay";
      amt = Math.abs(ch);
    } else if (py) {
      kind = py > 0 ? "pay" : "charge";
      amt = Math.abs(py);
    } else if (am) {
      amt = Math.abs(am);
      if (/pay|credit|receipt|deposit/.test(ty)) kind = "pay";
      else if (/inv|charge|bill|sale|debit|service/.test(ty)) kind = am < 0 ? "pay" : "charge";
      else if (am < 0) kind = "pay";
      else if (/payment|paid|zelle|cash|check|account credit/i.test(desc)) kind = "pay";
      else kind = "charge";
    } else {
      zero++;
      return;
    }
    var ref = g(r, "ref");
    if (!ref) {
      var im = desc.match(/inv(?:oice)?\s*#?\s*(\d+)/i);
      if (im) ref = im[1];
    }
    recs.push({
      ix: ix,
      d: d,
      kind: kind,
      amt: r2(amt),
      desc: desc,
      ref: ref.replace(/^inv\s*#?\s*/i, ""),
      meth: histMeth(g(r, "method")) || (kind === "pay" ? histMeth(desc) : ""),
      cust: g(r, "customer"),
      addr: g(r, "address"),
      bal: histNum(g(r, "bal"))
    });
  });
  if (!recs.length)
    return {
      err:
        "No charges or payments found. Check that each row has a date and an amount." +
        (bad.length ? " Rows I couldn't read: " + bad.slice(0, 3).join(" | ") : "")
    };
  return {
    recs: recs,
    bad: bad,
    zero: zero,
    hasCust: col.customer > -1,
    hasBal: col.bal > -1,
    noHead: noHead
  };
}
/* Which of the client's properties an address belongs to: same house number and the street's first word. */
function histProp(cid, addr) {
  var ps = clientProps(cid);
  if (!addr) return null;
  var w = String(addr)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
    num = w[0] && /^\d+$/.test(w[0]) ? w[0] : "",
    st = w[1] || "";
  if (!num) return null;
  var hit = ps.filter(function (p) {
    var a =
      " " +
      String(p.address || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ") +
      " ";
    return a.indexOf(" " + num + " ") > -1 && (!st || a.indexOf(" " + st) > -1);
  });
  return hit.length === 1 ? hit[0].id : null;
}
/* Plan one client's import: new invoices, payments, and which invoice each payment pays. Nothing is saved here. */
function histPlan(cid, recs, opt) {
  var haveInv = {},
    havePay = {},
    dupC = 0,
    dupP = 0;
  invoices.forEach(function (i) {
    if (i.client_id === cid && i.status !== "void") {
      var k = String(i.issue_date).slice(0, 10) + "|" + r2(i.total);
      haveInv[k] = (haveInv[k] || 0) + 1;
    }
  });
  invPays.forEach(function (x) {
    var iv = x.invoice_id ? byId(invoices, x.invoice_id) : null;
    if (x.client_id !== cid && !(iv && iv.client_id === cid)) return;
    var k = String(x.paid_on).slice(0, 10);
    havePay[k] = r2((havePay[k] || 0) + Number(x.amount));
  });
  var single = clientProps(cid).length === 1 ? clientProps(cid)[0].id : null;
  var sorted = recs.slice().sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ix - b.ix;
  });
  var invs = [],
    byKey = {};
  sorted.forEach(function (r) {
    if (r.kind !== "charge") return;
    var pid = histProp(cid, r.addr) || opt.pid || single || null,
      key = r.d + "|" + (pid || ""),
      inv = opt.group ? byKey[key] : null;
    if (!inv) {
      inv = { d: r.d, pid: pid, lines: [], total: 0, ref: "", refs: [] };
      invs.push(inv);
      if (opt.group) byKey[key] = inv;
    }
    inv.lines.push({ desc: r.desc || "Lawn maintenance", amt: r.amt, addr: pid ? paddr(pid) : r.addr || "" });
    inv.total = r2(inv.total + r.amt);
    if (r.ref && inv.refs.indexOf(r.ref) < 0) inv.refs.push(r.ref);
  });
  invs.forEach(function (v) {
    v.ref = v.refs.join(", ");
    var k = v.d + "|" + v.total;
    if (haveInv[k] > 0) {
      haveInv[k]--;
      v.dup = true;
      dupC++;
    }
  });
  var pays = sorted
    .filter(function (r) {
      return r.kind === "pay";
    })
    .map(function (r) {
      var p = { d: r.d, amt: r.amt, meth: r.meth || opt.meth, ref: r.ref, desc: r.desc, apps: [] };
      if ((havePay[r.d] || 0) >= r.amt - 0.005) {
        havePay[r.d] = r2(havePay[r.d] - r.amt);
        p.dup = true;
        dupP++;
      }
      return p;
    });
  var pool = openInvsFor(cid)
    .filter(function (i) {
      return balOf(i) > 0.005;
    })
    .map(function (i) {
      return { exist: i, d: String(i.issue_date).slice(0, 10), bal: balOf(i) };
    });
  invs.forEach(function (v) {
    if (!v.dup) {
      v.bal = v.total;
      v.paidBy = null;
      pool.push(v);
    }
  });
  pool.sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.exist ? 0 : 1) - (b.exist ? 0 : 1);
  });
  pays.forEach(function (p) {
    if (p.dup) return;
    var left = p.amt;
    pool.forEach(function (v) {
      if (left <= 0.005 || v.bal <= 0.005) return;
      var a = r2(Math.min(v.bal, left));
      p.apps.push({ to: v, a: a });
      v.bal = r2(v.bal - a);
      left = r2(left - a);
      if (v.bal <= 0.005) v.paidBy = p;
    });
    if (left > 0.005) p.apps.push({ to: null, a: left });
  });
  var newI = invs.filter(function (v) {
      return !v.dup;
    }),
    newP = pays.filter(function (p) {
      return !p.dup;
    });
  return {
    cid: cid,
    invs: invs,
    pays: pays,
    newI: newI,
    newP: newP,
    dupC: dupC,
    dupP: dupP,
    paidNew: newI.filter(function (v) {
      return v.bal <= 0.005;
    }).length,
    openNew: newI.filter(function (v) {
      return v.bal > 0.005;
    }),
    existPaid: pool.filter(function (v) {
      return v.exist && v.bal <= 0.005;
    }),
    credit: r2(
      newP.reduce(function (s, p) {
        return (
          s +
          p.apps
            .filter(function (a) {
              return !a.to;
            })
            .reduce(function (t, a) {
              return t + a.a;
            }, 0)
        );
      }, 0)
    ),
    tC: r2(
      newI.reduce(function (s, v) {
        return s + v.total;
      }, 0)
    ),
    tP: r2(
      newP.reduce(function (s, p) {
        return s + p.amt;
      }, 0)
    )
  };
}
/* Save one client's plan: invoices first (all or none), then every payment in one step. */
function histSave(plan, terms) {
  var made = [],
    cid = plan.cid;
  function undo() {
    return Promise.all(
      made.map(function (v) {
        return sb.from("invoices").delete().eq("id", v.id);
      })
    );
  }
  return plan.newI
    .reduce(function (pr, v) {
      return pr.then(function () {
        var paid = v.bal <= 0.005,
          row = {
            client_id: cid,
            issue_date: v.d,
            due_date: addDays(v.d, terms),
            total: v.total,
            reference: v.ref,
            notes: "Imported account history" + (v.ref ? " (old #" + v.ref + ")" : "") + ".",
            status: paid ? "paid" : "open",
            paid_at: paid ? (v.paidBy ? v.paidBy.d : v.d) + "T12:00:00" : null,
            paid_method: paid ? (v.total > 0 && v.paidBy ? v.paidBy.meth : "No charge") : ""
          };
        if (v.pid) row.property_id = v.pid;
        return sb
          .from("invoices")
          .insert(row)
          .select()
          .single()
          .then(function (r) {
            if (r.error || !r.data) return Promise.reject("an invoice dated " + mdy(v.d));
            v.id = r.data.id;
            v.row = r.data;
            made.push(v);
            return sb
              .from("invoice_items")
              .insert(
                v.lines.map(function (l) {
                  return {
                    invoice_id: v.id,
                    service_date: v.d,
                    address: l.addr,
                    description: l.desc,
                    amount: l.amt
                  };
                })
              )
              .then(function (r2_) {
                if (r2_.error) return Promise.reject("the lines of an invoice dated " + mdy(v.d));
              });
          });
      });
    }, Promise.resolve())
    .then(function () {
      var recs = [];
      plan.newP.forEach(function (p) {
        p.apps.forEach(function (a) {
          recs.push({
            invoice_id: a.to ? (a.to.exist ? a.to.exist.id : a.to.id) : null,
            client_id: cid,
            paid_on: p.d,
            amount: a.a,
            method: p.meth,
            reference: p.ref || "",
            note:
              "Imported account history" +
              (p.desc ? ": " + p.desc : "") +
              (a.to ? "" : " (credit on account)")
          });
        });
      });
      if (!recs.length) return [];
      return sb
        .from("invoice_payments")
        .insert(recs)
        .select()
        .then(function (r) {
          if (r.error || !r.data)
            return Promise.reject(
              plan.credit > 0 ? "the payments (credit on account needs the Stage 18b SQL)" : "the payments"
            );
          return r.data;
        });
    })
    .then(
      function (rows) {
        rows.forEach(function (x) {
          invPays.unshift(x);
        });
        made.forEach(function (v) {
          invoices.unshift(v.row);
        });
        return Promise.all(
          plan.existPaid.map(function (v) {
            var last = plan.newP
              .filter(function (p) {
                return p.apps.some(function (a) {
                  return a.to === v;
                });
              })
              .pop();
            return syncInvPaid(v.exist, last ? last.d : today(), last ? last.meth : "");
          })
        ).then(function () {
          return { ok: true, inv: made.length, pay: plan.newP.length };
        });
      },
      function (why) {
        return undo().then(function () {
          return { ok: false, why: String(why) };
        });
      }
    );
}
function openHistImport(cid) {
  if (billErr || payErr) {
    alert("Run the Stage 5 and Stage 18 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Import account history"));
  p.appendChild(
    el(
      "p",
      "note",
      "Bring in a statement from the old software: every charge and payment. Charges become invoices, and each payment pays the oldest unpaid invoice first, the way your old statement did. Anything paid ahead stays as credit on the account. You'll see a preview first, nothing is emailed, and rows already in the CRM are skipped, so running the same file twice is safe."
    )
  );
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Whose history is this?",
    "select",
    cid || "",
    [["", "A file with a Customer column (several clients)"]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var pp = fld("Property for rows with no address", "select", "", [
    ["", "Whole account / no specific property"]
  ]);
  p.appendChild(pp);
  function fillProps() {
    var ps = cs.input.value ? clientProps(cs.input.value) : [];
    pp.input.textContent = "";
    [["", "Whole account / no specific property"]]
      .concat(
        ps.map(function (x) {
          return [x.id, (x.label ? x.label + " · " : "") + x.address];
        })
      )
      .forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0];
        op.textContent = o[1];
        pp.input.appendChild(op);
      });
    var mn = ps.filter(isMainProp);
    pp.input.value = ps.length === 1 ? ps[0].id : mn.length ? mn[0].id : "";
    pp.hidden = ps.length < 2;
  }
  cs.input.addEventListener("change", function () {
    fillProps();
    if (parsed) preview();
  });
  fillProps();
  p.appendChild(el("h3", null, "1. The statement"));
  var file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,.tsv,.txt,text/csv";
  p.appendChild(file);
  var tx = fld("Or paste the rows (copy them from a spreadsheet or the old software)", "textarea", "");
  tx.input.style.minHeight = "120px";
  tx.input.placeholder =
    "Date\tDescription\tCharges\tPayments\tBalance\n07/19/2025\tLawn Maintenance\t30.00\t\t30.00\n08/02/2025\tPayment - Zelle\t\t30.00\t0.00";
  p.appendChild(tx);
  var tpl = btn("Download blank template (CSV)", "btn alt sm", function () {
    downloadCsv("account-history-template.csv", [
      ["Customer", "Address", "Date", "Type", "Description", "Amount", "Method", "Reference"],
      ["Smith, Anna", "3122 Bass Boat Way", "07/19/2025", "Invoice", "Lawn Maintenance", "30.00", "", ""],
      ["Smith, Anna", "3122 Bass Boat Way", "08/02/2025", "Payment", "", "30.00", "Zelle", "956"]
    ]);
  });
  p.appendChild(tpl);
  p.appendChild(el("h3", null, "2. Options"));
  var gl = document.createElement("label");
  gl.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0";
  var gk = document.createElement("input");
  gk.type = "checkbox";
  gk.checked = true;
  gk.style.cssText = "width:auto;margin:0";
  gl.appendChild(gk);
  gl.appendChild(document.createTextNode("Combine a client's charges on the same day into one invoice"));
  p.appendChild(gl);
  var me = fld("Payment method when the statement doesn't say", "select", "Other", PAYMETH);
  p.appendChild(me);
  var pv = btn("Preview", "btn", function () {
    var t = tx.input.value;
    if (t.trim()) {
      read(t);
      return;
    }
    var f = file.files[0];
    if (!f) {
      alert("Choose a file or paste the rows first.");
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      read(String(rd.result));
    };
    rd.readAsText(f);
  });
  pv.style.marginTop = "10px";
  p.appendChild(pv);
  file.addEventListener("change", function () {
    if (file.files[0]) tx.input.value = "";
    pv.click();
  });
  var out = el("div");
  out.style.marginTop = "14px";
  p.appendChild(out);
  var parsed = null,
    map = {},
    plans = [];
  gk.addEventListener("change", function () {
    if (parsed) preview();
  });
  me.input.addEventListener("change", function () {
    if (parsed) preview();
  });
  pp.input.addEventListener("change", function () {
    if (parsed) preview();
  });
  function read(text) {
    parsed = histParse(histRows(text));
    map = {};
    if (parsed.recs && !cs.input.value) {
      var seen = {};
      parsed.recs.forEach(function (r) {
        var k = r.cust || "";
        if (!(k in seen)) {
          seen[k] = 1;
          map[k] = guessClient(k);
        }
      });
    }
    preview();
  }
  function preview() {
    out.textContent = "";
    plans = [];
    if (parsed.err) {
      out.appendChild(el("div", "empty", parsed.err));
      return;
    }
    var recs = parsed.recs,
      groups = {},
      order = [];
    if (cs.input.value) {
      var names = {};
      recs.forEach(function (r) {
        if (r.cust) names[normNm(r.cust)] = 1;
      });
      if (Object.keys(names).length > 1) {
        out.appendChild(
          el(
            "div",
            "empty",
            "This file has " +
              Object.keys(names).length +
              ' different customers. Choose "A file with a Customer column" at the top instead.'
          )
        );
        return;
      }
      groups[cs.input.value] = recs;
      order.push(cs.input.value);
    } else {
      if (!parsed.hasCust) {
        out.appendChild(
          el("div", "empty", "This file has no Customer column, so choose whose history it is at the top.")
        );
        return;
      }
      var h = el("h3", null, "Match each customer to a CRM client");
      out.appendChild(h);
      var opts = [
        ["", "Choose a client..."],
        ["skip", "Skip this customer"]
      ].concat(
        clients.map(function (c) {
          return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
        })
      );
      Object.keys(map).forEach(function (k) {
        var n = recs.filter(function (r) {
            return r.cust === k;
          }).length,
          s = fld(
            (k || "(no customer name)") + " · " + n + " row" + (n > 1 ? "s" : ""),
            "select",
            map[k],
            opts
          );
        s.input.addEventListener("change", function () {
          map[k] = s.input.value;
          preview();
        });
        out.appendChild(s);
      });
      recs.forEach(function (r) {
        var c = map[r.cust || ""];
        if (!c || c === "skip") return;
        if (!groups[c]) {
          groups[c] = [];
          order.push(c);
        }
        groups[c].push(r);
      });
    }
    var unmatched = Object.keys(map).filter(function (k) {
      return !map[k];
    }).length;
    var opt = { group: gk.checked, meth: me.input.value, pid: cs.input.value ? pp.input.value : "" };
    order.forEach(function (c) {
      plans.push(histPlan(c, groups[c], opt));
    });
    if (parsed.bad.length) {
      var bd = el(
        "div",
        "note",
        "Skipped " +
          parsed.bad.length +
          " row" +
          (parsed.bad.length > 1 ? "s" : "") +
          " with no date I could read: " +
          parsed.bad.slice(0, 3).join(" | ") +
          (parsed.bad.length > 3 ? " ..." : "")
      );
      bd.style.color = "#9a3412";
      out.appendChild(bd);
    }
    plans.forEach(function (pl) {
      var c = byId(clients, pl.cid),
        card = el("div", "pcard");
      card.style.marginTop = "10px";
      card.appendChild(el("b", null, c ? dispName(c) : "Client"));
      var rs = groups[pl.cid],
        run = 0,
        w = el("div", "invwrap"),
        t = document.createElement("table");
      t.className = "ptable";
      var hr = document.createElement("tr");
      ["Date", "Description", "Charges", "Payments", "Balance"].forEach(function (x, i) {
        var th = document.createElement("th");
        th.textContent = x;
        if (i > 1) th.className = "r";
        hr.appendChild(th);
      });
      t.appendChild(hr);
      rs.slice()
        .sort(function (a, b) {
          return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ix - b.ix;
        })
        .forEach(function (r) {
          run = r2(run + (r.kind === "charge" ? r.amt : -r.amt));
          var tr = document.createElement("tr");
          [
            mdy(r.d),
            (r.desc || (r.kind === "pay" ? "Payment" : "Charge")) + (r.ref ? " (#" + r.ref + ")" : ""),
            r.kind === "charge" ? money(r.amt) : "",
            r.kind === "pay" ? money(r.amt) : "",
            money(run)
          ].forEach(function (v, k) {
            var td = document.createElement("td");
            td.textContent = v;
            if (k > 1) td.className = "r";
            tr.appendChild(td);
          });
          t.appendChild(tr);
        });
      w.appendChild(t);
      card.appendChild(w);
      var fileEnd = null;
      rs.forEach(function (r) {
        if (r.bal != null) fileEnd = r.bal;
      });
      if (parsed.hasBal && fileEnd != null) {
        var ok = Math.abs(Math.abs(fileEnd) - Math.abs(run)) < 0.01,
          bx = el(
            "div",
            "note",
            ok
              ? "✓ Ends at " + money(run) + ", the same as the statement's last balance."
              : "⚠ This adds up to " +
                  money(run) +
                  ", but the statement's last balance is " +
                  money(fileEnd) +
                  ". Check for a missing or misread row before importing."
          );
        bx.style.cssText = "margin-top:6px;font-weight:600;color:" + (ok ? "#166534" : "#9a3412");
        card.appendChild(bx);
      }
      var lines = [];
      if (pl.newI.length || pl.newP.length)
        lines.push(
          "Creates " +
            pl.newI.length +
            " invoice" +
            (pl.newI.length === 1 ? "" : "s") +
            " (" +
            money(pl.tC) +
            ") and " +
            pl.newP.length +
            " payment" +
            (pl.newP.length === 1 ? "" : "s") +
            " (" +
            money(pl.tP) +
            ")."
        );
      if (pl.newI.length)
        lines.push(
          (pl.paidNew ? pl.paidNew + " will be paid in full" : "None will be paid in full") +
            (pl.openNew.length
              ? "; " +
                pl.openNew.length +
                " will still have " +
                money(
                  r2(
                    pl.openNew.reduce(function (s, v) {
                      return s + v.bal;
                    }, 0)
                  )
                ) +
                " owing"
              : "") +
            "."
        );
      if (pl.existPaid.length)
        lines.push(
          "Also pays " +
            pl.existPaid.length +
            " invoice" +
            (pl.existPaid.length > 1 ? "s" : "") +
            " already in the CRM: " +
            pl.existPaid
              .map(function (v) {
                return invNum(v.exist.number);
              })
              .join(", ") +
            "."
        );
      if (pl.credit > 0)
        lines.push(money(pl.credit) + " is more than what's owed, so it stays as credit on account.");
      if (pl.dupC || pl.dupP)
        lines.push(
          "Already in the CRM, skipped: " +
            (pl.dupC ? pl.dupC + " charge" + (pl.dupC > 1 ? "s" : "") : "") +
            (pl.dupC && pl.dupP ? " and " : "") +
            (pl.dupP ? pl.dupP + " payment" + (pl.dupP > 1 ? "s" : "") : "") +
            "."
        );
      lines.forEach(function (l) {
        var d = el("div", "note", l);
        d.style.marginTop = "4px";
        card.appendChild(d);
      });
      out.appendChild(card);
    });
    var nI = plans.reduce(function (s, x) {
        return s + x.newI.length;
      }, 0),
      nP = plans.reduce(function (s, x) {
        return s + x.newP.length;
      }, 0);
    if (unmatched) {
      var u = el(
        "div",
        "note",
        "Match or skip " + unmatched + " customer" + (unmatched > 1 ? "s" : "") + " above to continue."
      );
      u.style.cssText = "margin-top:10px;font-weight:600";
      out.appendChild(u);
    }
    if (!plans.length) return;
    if (!nI && !nP) {
      out.appendChild(
        el("div", "empty", "Everything in this file is already in the CRM. Nothing to import.")
      );
      return;
    }
    var go = btn(
      "Import " + nI + " invoice" + (nI === 1 ? "" : "s") + " and " + nP + " payment" + (nP === 1 ? "" : "s"),
      "btn",
      function () {
        if (
          !confirm(
            "Import this history" +
              (plans.length > 1 ? " for " + plans.length + " clients" : "") +
              "? Nothing is emailed."
          )
        )
          return;
        go.disabled = true;
        var terms = Number(bizv("terms_days", 10));
        terms = isNaN(terms) ? 10 : terms;
        var res = [];
        plans
          .reduce(function (pr, pl, i) {
            return pr.then(function () {
              go.textContent = "Importing " + (i + 1) + " of " + plans.length + "...";
              return histSave(pl, terms).then(function (r) {
                r.cid = pl.cid;
                res.push(r);
              });
            });
          }, Promise.resolve())
          .then(function () {
            return Promise.all([
              reloadInvoices(),
              sb
                .from("invoice_payments")
                .select("*")
                .order("paid_on", { ascending: false })
                .limit(10000)
                .then(function (q) {
                  if (!q.error) invPays = q.data || [];
                })
            ]);
          })
          .then(function () {
            repData = null;
            render();
            out.textContent = "";
            var good = res.filter(function (r) {
                return r.ok;
              }),
              bad = res.filter(function (r) {
                return !r.ok;
              });
            var ok = el(
              "div",
              "pcard",
              "✓ Imported " +
                good.reduce(function (s, r) {
                  return s + r.inv;
                }, 0) +
                " invoices and " +
                good.reduce(function (s, r) {
                  return s + r.pay;
                }, 0) +
                " payments" +
                (good.length > 1 ? " for " + good.length + " clients" : "") +
                "."
            );
            ok.style.cssText = "background:var(--mint);font-weight:700";
            out.appendChild(ok);
            bad.forEach(function (r) {
              var d = el(
                "div",
                "note",
                "Nothing was imported for " +
                  cname(r.cid) +
                  ": I couldn't save " +
                  r.why +
                  ". Its other rows were undone, so you can fix it and run the file again."
              );
              d.style.cssText = "color:#9a3412;margin-top:6px";
              out.appendChild(d);
            });
            if (res.length === 1 && good.length) {
              var oc = btn("Open " + cname(res[0].cid), "btn alt", function () {
                openClient(res[0].cid);
              });
              oc.style.marginTop = "10px";
              out.appendChild(oc);
            }
          });
      }
    );
    go.disabled = unmatched > 0;
    go.style.marginTop = "12px";
    out.appendChild(go);
  }
}
/* Past invoice: record an old invoice that was already sent and paid (one step: invoice + payment, nothing is sent or left owed). */
function openPastInvoice(cid, pre) {
  pre = pre || {};
  if (billErr) {
    alert("Billing isn't set up yet. Run the Stage 5 SQL in Supabase first.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Past invoice (already sent and paid)"));
  p.appendChild(
    el(
      "div",
      "note",
      "For old invoices you already sent and collected on. It is saved as Paid with its payment, nothing is emailed, and it never shows as owed."
    )
  );
  if (pre.saved) {
    var ok = el("div", "pcard", "\u2713 Saved " + pre.saved + ". Enter the next one below.");
    ok.style.cssText = "background:var(--mint);font-weight:700;margin-top:8px";
    p.appendChild(ok);
  }
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Client",
    "select",
    cid || "",
    [["", "Choose a client..."]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " \u00b7 " + c.company : "")];
      })
    )
  );
  p.appendChild(cs);
  var g = el("div", "grid2"),
    isd = fld("Original invoice date", "date", pre.date || ""),
    on = fld("Original invoice number", "text", "");
  on.input.placeholder = "Their old number, if any";
  g.appendChild(isd);
  g.appendChild(on);
  p.appendChild(g);
  var g2 = el("div", "grid2"),
    am = fld("Amount ($)", "number", ""),
    ds = fld("Description", "text", pre.desc || "Lawn maintenance");
  am.input.step = "0.01";
  am.input.min = "0";
  am.input.inputMode = "decimal";
  g2.appendChild(am);
  g2.appendChild(ds);
  p.appendChild(g2);
  var g3 = el("div", "grid2"),
    pd = fld("Date paid", "date", pre.paidOn || ""),
    me = fld("Paid by", "select", pre.method || "Zelle", PAYMETH);
  g3.appendChild(pd);
  g3.appendChild(me);
  p.appendChild(g3);
  var pps = propPicker(cs);
  p.appendChild(pps);
  var nt = fld("Note (optional)", "text", "");
  p.appendChild(nt);
  var ids = el(
    "div",
    "note",
    "If the invoice and payment were the same day, enter the same date in both. Leave the number empty if there wasn't one."
  );
  p.appendChild(ids);
  var acts = el("div", "acts");
  acts.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:14px";
  function save(another) {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    if (!isd.input.value) {
      alert("Enter the original invoice date.");
      return;
    }
    var a = parseFloat(am.input.value);
    if (isNaN(a) || a < 0) {
      alert("Enter the amount (0 if it was no charge).");
      return;
    }
    if (!ds.input.value.trim()) {
      alert("Enter a description.");
      return;
    }
    if (!pd.input.value) {
      alert("Enter the date it was paid.");
      return;
    }
    var terms = Number(bizv("terms_days", 10));
    terms = isNaN(terms) ? 10 : terms;
    a = r2(a);
    acts.querySelectorAll("button").forEach(function (b) {
      b.disabled = true;
    });
    var row = {
      client_id: cs.input.value,
      issue_date: isd.input.value,
      due_date: addDays(isd.input.value, terms),
      total: a,
      reference: on.input.value.trim(),
      notes: ("Past invoice entered for records. " + nt.input.value.trim()).trim(),
      status: "paid",
      paid_at: pd.input.value + "T12:00:00",
      paid_method: a === 0 ? "No charge" : me.input.value
    };
    var ppid = pps.input.value || null;
    if (ppid) row.property_id = ppid;
    function fail(msg, invId) {
      (invId ? sb.from("invoices").delete().eq("id", invId) : Promise.resolve()).then(function () {
        acts.querySelectorAll("button").forEach(function (b) {
          b.disabled = false;
        });
        alert(msg);
      });
    }
    sb.from("invoices")
      .insert(row)
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          fail("Could not save the invoice. Did you run the Stage 5 SQL?");
          return;
        }
        var inv = r.data;
        sb.from("invoice_items")
          .insert({
            invoice_id: inv.id,
            service_date: isd.input.value,
            description: ds.input.value.trim(),
            amount: a,
            address: ppid ? paddr(ppid) : ""
          })
          .then(function (r2_) {
            if (r2_.error) {
              fail("Could not save the invoice line.", inv.id);
              return;
            }
            function done() {
              invoices.unshift(inv);
              repData = null;
              render();
              var label = invNum(inv.number) + (inv.reference ? " (old #" + inv.reference + ")" : "");
              if (another)
                openPastInvoice(cs.input.value, {
                  saved: label,
                  method: me.input.value,
                  desc: ds.input.value.trim()
                });
              else openInvoice(inv.id);
            }
            if (a > 0 && !payErr) {
              sb.from("invoice_payments")
                .insert({
                  invoice_id: inv.id,
                  client_id: inv.client_id,
                  paid_on: pd.input.value,
                  amount: a,
                  method: me.input.value,
                  reference: on.input.value.trim(),
                  note: "Past invoice"
                })
                .select()
                .single()
                .then(function (r3) {
                  if (r3.error || !r3.data) {
                    fail("Could not save the payment.", inv.id);
                    return;
                  }
                  invPays.unshift(r3.data);
                  done();
                });
            } else done();
          });
      });
  }
  acts.appendChild(
    btn("Save and add another", "btn", function () {
      save(true);
    })
  );
  acts.appendChild(
    btn("Save", "btn alt", function () {
      save(false);
    })
  );
  p.appendChild(acts);
}

/* ======================= crm/src/21-billing-screen.js ======================= */
/* Billing tab: invoice list, invoice detail, printable invoice, estimates and billing settings. */

/* ---- Billing screen ---- */
function renderBilling() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var op = invoices.filter(function (i) {
      return i.status === "open";
    }),
    pd_ = invoices.filter(function (i) {
      return i.status === "paid";
    }),
    od = op.filter(isOverdue);
  var bg = billGroups();
  [
    ["tobill", "To bill", bg.order.length],
    ["open", "Open", op.length],
    ["paid", "Paid", pd_.length],
    ["payments", "Payments", invPays.length],
    [
      "estimates",
      "Estimates",
      estimates.filter(function (e) {
        return (e.status === "draft" || e.status === "sent") && !estExpired(e);
      }).length
    ]
  ].forEach(function (s) {
    var b = el("button", "tab" + (bfilter === s[0] ? " on" : ""), s[1]);
    b.type = "button";
    b.appendChild(el("span", null, "(" + s[2] + ")"));
    b.addEventListener("click", function () {
      bfilter = s[0];
      render();
    });
    tabs.appendChild(b);
  });
  if (bfilter !== "estimates" && bfilter !== "payments") {
    $("topbtns").appendChild(
      btn("New invoice", "btn", function () {
        openInvoiceForm(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Past invoice", "btn alt", function () {
        openPastInvoice(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Customer payment", "btn alt", function () {
        openPayment(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(btn("Import payments", "btn alt", openPayImport));
    $("topbtns").appendChild(document.createTextNode(" "));
    $("topbtns").appendChild(
      btn("Import history", "btn alt", function () {
        openHistImport(null);
      })
    );
    $("topbtns").appendChild(document.createTextNode(" "));
  }
  $("topbtns").appendChild(btn("Price calculator", "btn alt", openCalc));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Billing settings", "btn alt", openBizSettings));
  var list = $("list");
  list.textContent = "";
  if (bfilter === "estimates") return renderEstimates(list);
  if (bfilter !== "payments" && !billErr) {
    var bfx = el("div");
    list.appendChild(bfx);
    backfillCards(bfx);
  }
  if (bfilter === "payments") return renderPayments(list);
  if (billErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Billing isn't set up yet. Run the Stage 5 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var mon = today().slice(0, 7),
    paidMonth = r2(
      pd_
        .filter(function (i) {
          return i.paid_at && String(i.paid_at).slice(0, 7) === mon;
        })
        .reduce(function (s, i) {
          return s + Number(i.total || 0);
        }, 0)
    );
  var stats = el("div", "stats");
  [
    ["Outstanding", money(openTotal(invoices)), ""],
    ["Overdue", money(openTotal(od)), od.length ? "bad" : ""],
    [
      "Ready to bill",
      money(
        r2(
          eligible().reduce(function (s, v) {
            return s + Number(v.price || 0);
          }, 0)
        )
      ),
      ""
    ],
    ["Paid this month", money(paidMonth), ""]
  ].forEach(function (x) {
    var c = el("div", "stat " + x[2]);
    c.appendChild(el("span", null, x[0]));
    c.appendChild(el("b", null, x[1]));
    stats.appendChild(c);
  });
  list.appendChild(stats);
  if (bfilter === "tobill") return renderToBill(list, bg);
  var set = (
    bfilter === "open"
      ? op.slice().sort(function (a, b) {
          return a.due_date < b.due_date ? -1 : 1;
        })
      : pd_
  ).filter(function (i) {
    if (!query) return true;
    return (
      [invNum(i.number), i.number, cname(i.client_id), i.reference].join(" ").toLowerCase().indexOf(query) >
      -1
    );
  });
  if (bfilter === "open" && od.length) {
    var ro = btn("Remind overdue clients (" + od.length + ")", "btn alt", function () {
      remindOverdue(od);
    });
    ro.style.margin = "8px 0";
    list.appendChild(ro);
  }
  if (!set.length) {
    list.appendChild(el("div", "empty", bfilter === "open" ? "No open invoices." : "No paid invoices yet."));
    return;
  }
  set.forEach(function (i) {
    list.appendChild(invoiceRow(i));
  });
}
function invoiceRow(i) {
  var b = el("button", "row client" + (isOverdue(i) ? " overdue" : ""));
  b.type = "button";
  var l = el("div");
  l.appendChild(el("b", null, invNum(i.number) + " · " + cname(i.client_id)));
  l.appendChild(
    el(
      "div",
      "sub",
      [
        i.property_id ? paddr(i.property_id) : "",
        i.period_end ? monthName(i.period_end) : "",
        i.status === "paid"
          ? "Paid " +
            (i.paid_at ? dshort(String(i.paid_at).slice(0, 10)) : "") +
            (i.paid_method ? " (" + i.paid_method + ")" : "")
          : "Due " + dshort(i.due_date),
        i.reference ? "Ref " + i.reference : "",
        i.status === "open" && invPaidSum(i) > 0 ? "Balance " + money(balOf(i)) : "",
        i.status === "open" && i.reminded_at ? "Reminded " + dshort(String(i.reminded_at).slice(0, 10)) : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  var r = el("div");
  r.style.textAlign = "right";
  r.appendChild(el("b", null, money(i.total)));
  var chip =
    i.status === "void"
      ? el("span", "chip lost", "Void")
      : i.status === "paid"
        ? el("span", "chip won", "Paid")
        : isOverdue(i)
          ? el("span", "chip od", "Overdue")
          : el("span", "chip", i.sent_at ? "Sent" : "Not sent");
  r.appendChild(el("div"));
  r.appendChild(chip);
  b.appendChild(l);
  b.appendChild(r);
  b.addEventListener("click", function () {
    openInvoice(i.id);
  });
  return b;
}
function renderToBill(list, bg) {
  var bar = el("div", "billbar");
  var lab = el("label", "f");
  lab.style.margin = "0";
  lab.appendChild(el("span", null, "Bill completed visits through"));
  var di = document.createElement("input");
  di.type = "date";
  di.value = billThrough;
  di.style.width = "auto";
  di.addEventListener("change", function () {
    if (di.value) {
      billThrough = di.value;
      render();
    }
  });
  lab.appendChild(di);
  bar.appendChild(lab);
  var q = el("span");
  q.appendChild(
    btn("End of last month", "btn alt sm", function () {
      billThrough = lastMonthEnd();
      render();
    })
  );
  q.appendChild(document.createTextNode(" "));
  q.appendChild(
    btn("Today", "btn alt sm", function () {
      billThrough = today();
      render();
    })
  );
  bar.appendChild(q);
  list.appendChild(bar);
  var zero = unbilled.filter(function (v) {
    return v.scheduled_date <= billThrough && !(Number(v.price) > 0);
  });
  if (zero.length) {
    var zn = el(
      "div",
      "note",
      "\u26a0 " +
        zero.length +
        " completed visit" +
        (zero.length > 1 ? "s have" : " has") +
        " no price set, so " +
        (zero.length > 1 ? "they are" : "it is") +
        " left out. Set a price below and it moves into the list to bill, or press Invoice as $0 to record it as a no-charge invoice."
    );
    zn.style.cssText = "color:#7a5b00;margin:6px 0";
    list.appendChild(zn);
    zero
      .slice()
      .sort(function (x, y) {
        return x.scheduled_date < y.scheduled_date ? -1 : 1;
      })
      .forEach(function (v) {
        var c = el("div", "pcard"),
          top = el("div");
        top.style.cssText =
          "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
        var l = el("div");
        l.appendChild(el("b", null, cname(v.client_id) + " \u00b7 " + jobTitle(v.job_id)));
        l.appendChild(
          el("div", "note", [dshort(v.scheduled_date), paddr(v.property_id)].filter(Boolean).join(" \u00b7 "))
        );
        top.appendChild(l);
        top.appendChild(
          btn("Open job", "btn alt sm", function () {
            openJob(v.job_id);
          })
        );
        c.appendChild(top);
        c.appendChild(priceFix(v, render));
        list.appendChild(c);
      });
  }
  /* visits earlier marked "No charge" (no invoice yet): make $0 invoices for them, one per client */
  var ncHost = el("div");
  list.appendChild(ncHost);
  sb.from("visits")
    .select("*")
    .eq("status", "done")
    .eq("paid_method", "No charge")
    .is("invoice_id", null)
    .limit(2000)
    .then(function (r) {
      var vs = (r.data || []).filter(function (v) {
        return !r.error && !(Number(v.price) > 0);
      });
      if (!vs.length) return;
      var gv = groupVisits(vs),
        g = gv.g,
        order = gv.order;
      var c = el("div", "pcard");
      c.style.background = "#eef6ec";
      c.appendChild(
        el("b", null, vs.length + " no-charge visit" + (vs.length > 1 ? "s have" : " has") + " no invoice")
      );
      c.appendChild(
        el(
          "div",
          "note",
          "Create a $0 invoice for each client so it shows in their invoice history: " +
            order
              .map(function (k) {
                return groupTitle(g[k]);
              })
              .join(", ") +
            "."
        )
      );
      var mk = btn("Create $0 invoices (" + order.length + ")", "btn sm", function () {
        mk.disabled = true;
        var made = 0,
          fails = [];
        order
          .reduce(function (pr, k) {
            return pr.then(function () {
              return createInvoice(g[k].cid, g[k].vs, today(), g[k].pid).then(
                function () {
                  made++;
                },
                function (e) {
                  fails.push(groupTitle(g[k]) + ": " + e);
                }
              );
            });
          }, Promise.resolve())
          .then(function () {
            return loadUnbilled();
          })
          .then(function () {
            alert(
              "Created " +
                made +
                " $0 invoice" +
                (made === 1 ? "" : "s") +
                "." +
                (fails.length ? "\n\nProblems:\n" + fails.join("\n") : "")
            );
            bfilter = "paid";
            render();
          });
      });
      mk.style.marginTop = "8px";
      c.appendChild(mk);
      ncHost.appendChild(c);
    });
  if (!bg.order.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Nothing to bill through " +
          dshort(billThrough) +
          ". Completed visits that haven't been paid or invoiced show up here."
      )
    );
    return;
  }
  var all = btn("Create all invoices (" + bg.order.length + ")", "btn", function () {
    if (
      !confirm(
        "Create " +
          bg.order.length +
          " invoice" +
          (bg.order.length > 1 ? "s" : "") +
          " for completed visits through " +
          dshort(billThrough) +
          "?"
      )
    )
      return;
    all.disabled = true;
    var made = 0,
      fails = [],
      through = billThrough;
    bg.order
      .reduce(function (p, k) {
        return p.then(function () {
          return createInvoice(bg.g[k].cid, bg.g[k].vs, through, bg.g[k].pid).then(
            function () {
              made++;
            },
            function (e) {
              fails.push(groupTitle(bg.g[k]) + ": " + e);
            }
          );
        });
      }, Promise.resolve())
      .then(function () {
        return loadUnbilled();
      })
      .then(function () {
        render();
        alert(
          "Created " +
            made +
            " invoice" +
            (made === 1 ? "" : "s") +
            "." +
            (fails.length ? "\n\nProblems:\n" + fails.join("\n") : "")
        );
        bfilter = "open";
        render();
      });
  });
  all.style.margin = "8px 0 4px";
  list.appendChild(all);
  bg.order.forEach(function (k) {
    var x = bg.g[k],
      cid = x.cid,
      vs = x.vs,
      tot = r2(
        vs.reduce(function (s, v) {
          return s + Number(v.price || 0);
        }, 0)
      ),
      card = el("div", "pcard");
    var top = el("div");
    top.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap";
    var l = el("div");
    l.appendChild(el("b", null, groupTitle(x)));
    l.appendChild(el("div", "note", vs.length + " visit" + (vs.length > 1 ? "s" : "") + " · " + money(tot)));
    top.appendChild(l);
    var one = btn("Create invoice", "btn sm", function () {
      one.disabled = true;
      createInvoice(cid, vs, billThrough, x.pid).then(
        function (inv) {
          return loadUnbilled().then(function () {
            render();
            openInvoice(inv.id);
          });
        },
        function (e) {
          one.disabled = false;
          alert(e);
        }
      );
    });
    top.appendChild(one);
    card.appendChild(top);
    var det = document.createElement("details");
    det.appendChild(el("summary", null, "See the visits"));
    vs.forEach(function (v) {
      det.appendChild(
        el(
          "div",
          "note",
          dshort(v.scheduled_date) +
            " · " +
            jobTitle(v.job_id) +
            " · " +
            paddr(v.property_id) +
            " · " +
            money(v.price)
        )
      );
    });
    card.appendChild(det);
    list.appendChild(card);
  });
}

/* ---- Invoice detail ---- */
function openInvoice(id) {
  var inv = byId(invoices, id);
  if (!inv) return;
  var c = byId(clients, inv.client_id),
    p = panel();
  p.appendChild(el("h2", null, invNum(inv.number) + " · " + cname(inv.client_id)));
  var ips = clientProps(inv.client_id);
  if (ips.length > 1) {
    var ipf = fld(
      "Property",
      "select",
      inv.property_id || "",
      [["", "Not tied to a property (whole account)"]].concat(
        ips.map(function (q) {
          return [q.id, (q.label ? q.label + " \u00b7 " : "") + q.address];
        })
      )
    );
    ipf.style.cssText = "margin:6px 0;max-width:420px";
    ipf.input.addEventListener("change", function () {
      var v = ipf.input.value || null;
      ipf.input.disabled = true;
      sb.from("invoices")
        .update({ property_id: v })
        .eq("id", inv.id)
        .then(function (r) {
          ipf.input.disabled = false;
          if (r.error) {
            alert("Could not change the property.");
            ipf.input.value = inv.property_id || "";
            return;
          }
          inv.property_id = v;
          render();
        });
    });
    p.appendChild(ipf);
  } else if (inv.property_id) p.appendChild(el("div", "note", "Property: " + paddr(inv.property_id)));
  var st =
    inv.status === "paid" ? "Paid" : inv.status === "void" ? "Void" : isOverdue(inv) ? "Overdue" : "Open";
  p.appendChild(
    el(
      "div",
      "note",
      st +
        " · issued " +
        dshort(inv.issue_date) +
        " · due " +
        dshort(inv.due_date) +
        (inv.sent_at ? " · sent " + dshort(String(inv.sent_at).slice(0, 10)) : " · not sent yet")
    )
  );
  var body = el("div");
  body.appendChild(el("div", "note", "Loading..."));
  p.appendChild(body);
  sb.from("invoice_items")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("service_date", { ascending: true })
    .limit(1000)
    .then(function (r) {
      var items = r.error ? [] : r.data || [];
      body.textContent = "";
      var locked = inv.status !== "open";
      var t = document.createElement("table");
      t.className = "itable";
      items.forEach(function (it) {
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, it.service_date ? dshort(it.service_date) : ""));
        var d = el("td", null, it.description + (it.address ? " · " + it.address : ""));
        tr.appendChild(d);
        var a = el("td", "amt", money(it.amount));
        tr.appendChild(a);
        if (!locked) {
          var x = el("td");
          var rm = btn("×", "link", function () {
            removeLine(inv, it, function () {
              openInvoice(inv.id);
            });
          });
          rm.setAttribute("aria-label", "Remove line");
          rm.style.cssText = "font-size:1.2rem;text-decoration:none;color:var(--red)";
          x.appendChild(rm);
          tr.appendChild(x);
        }
        t.appendChild(tr);
      });
      body.appendChild(t);
      var tot = el("div", "invtotal", "Total " + money(inv.total));
      body.appendChild(tot);
      if (!locked) {
        var add = el("div", "pcard"),
          g = el("div", "grid2");
        var dsc = fld("Add a line (extra work, discount, late fee)", "text", ""),
          amt = fld("Amount ($, negative = discount)", "number", "");
        amt.input.step = "0.01";
        amt.input.inputMode = "decimal";
        g.appendChild(dsc);
        g.appendChild(amt);
        add.appendChild(g);
        var ab = btn("Add line", "btn alt sm", function () {
          var a2 = parseFloat(amt.input.value);
          if (!dsc.input.value.trim() || isNaN(a2)) {
            alert("Enter a description and an amount.");
            return;
          }
          sb.from("invoice_items")
            .insert({
              invoice_id: inv.id,
              service_date: today(),
              description: dsc.input.value.trim(),
              amount: a2
            })
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not add the line.");
                return;
              }
              setTotal(inv, r2(Number(inv.total) + a2), function () {
                openInvoice(inv.id);
              });
            });
        });
        ab.style.marginTop = "8px";
        add.appendChild(ab);
        body.appendChild(add);
      }
      var ref = fld("Reference / PO number (shows on the invoice)", "text", inv.reference || "");
      body.appendChild(ref);
      var rb = btn("Save reference", "btn alt sm", function () {
        sb.from("invoices")
          .update({ reference: ref.input.value.trim() })
          .eq("id", inv.id)
          .then(function (r2_) {
            if (r2_.error) {
              alert("Could not save.");
              return;
            }
            inv.reference = ref.input.value.trim();
            rb.textContent = "Saved";
            setTimeout(function () {
              rb.textContent = "Save reference";
            }, 1200);
          });
      });
      rb.style.marginTop = "6px";
      body.appendChild(rb);
      var acts = el("div", "contact");
      acts.style.marginTop = "14px";
      acts.appendChild(
        btn("View / Print / PDF", "btn", function () {
          showInvoice(inv, items);
        })
      );
      var msg = invMessage(inv, c);
      if (c && c.email) {
        var a2 = el("a", "btn", "Email invoice");
        a2.href = mailHref(
          c.email,
          "Invoice " + invNum(inv.number) + " from " + bizv("name", "Latta Corp"),
          msg + (inv.share_token ? "" : "\n\n(The invoice PDF is attached.)")
        );
        a2.addEventListener("click", function () {
          markSent(inv);
        });
        acts.appendChild(a2);
      }
      acts.appendChild(
        copyBtn("Copy message", msg, false, function () {
          markSent(inv);
        })
      );
      if (inv.share_token) {
        acts.appendChild(
          copyBtn("Copy link", docUrl(inv.share_token), false, function () {
            markSent(inv);
          })
        );
        var pv = el("a", "btn alt", "Preview link");
        pv.href = docUrl(inv.share_token, true);
        pv.target = "_blank";
        pv.rel = "noopener";
        acts.appendChild(pv);
      }
      if (isOwner() && c && c.phone) {
        var a1 = el("a", "btn alt", "Text");
        a1.href = smsHref(c.phone, msg);
        a1.addEventListener("click", function () {
          markSent(inv);
        });
        acts.appendChild(a1);
      }
      if (inv.status === "open" && c && (isOverdue(inv) || inv.sent_at)) {
        var rem = invRemind(inv, c);
        if (c.email) {
          var a4 = el("a", "btn alt", "Email a reminder");
          a4.href = mailHref(c.email, "Payment reminder: invoice " + invNum(inv.number), rem);
          a4.addEventListener("click", function () {
            stampInv(inv);
          });
          acts.appendChild(a4);
        }
        if (isOwner() && c.phone) {
          var a3 = el("a", "btn alt", "Text a reminder");
          a3.href = smsHref(c.phone, rem);
          a3.addEventListener("click", function () {
            stampInv(inv);
          });
          acts.appendChild(a3);
        }
      }
      body.appendChild(acts);
      if (inv.share_token && inv.viewed_at)
        body.appendChild(el("div", "note", "✓ Client opened the invoice link " + ago(inv.viewed_at) + "."));
      else if (inv.share_token && inv.sent_at)
        body.appendChild(el("div", "note", "The client hasn't opened the link yet."));
      if (!inv.share_token)
        body.appendChild(
          el(
            "div",
            "note",
            "Run the Stage 11 SQL in Supabase to give each invoice a private link clients can open."
          )
        );
      if (inv.status === "open" && inv.reminded_at)
        body.appendChild(
          el("div", "note", "Last reminder texted " + dshort(String(inv.reminded_at).slice(0, 10)) + ".")
        );
      if (c && !c.email)
        body.appendChild(
          el(
            "div",
            "note",
            "Tip: add an email on the client page to get an Email button here. To email the PDF: tap View / Print / PDF, choose Save as PDF, then attach it."
          )
        );
      var pay = el("div", "sec");
      if (inv.status === "open") {
        pay.appendChild(el("h3", null, "Record payment"));
        var pg = el("div", "grid2");
        var pm = fld("Method", "select", "Zelle", [
            ["Zelle", "Zelle"],
            ["Cash", "Cash"],
            ["Check", "Check"],
            ["Other", "Other"]
          ]),
          pdt = fld("Date received", "date", today());
        pg.appendChild(pm);
        pg.appendChild(pdt);
        pay.appendChild(pg);
        var pb = btn("Mark paid", "btn", function () {
          var when = (pdt.input.value || today()) + "T12:00:00";
          sb.from("invoices")
            .update({ status: "paid", paid_at: when, paid_method: pm.input.value })
            .eq("id", inv.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not save.");
                return;
              }
              inv.status = "paid";
              inv.paid_at = when;
              inv.paid_method = pm.input.value;
              render();
              openInvoice(inv.id);
            });
        });
        pb.style.marginTop = "8px";
        pay.appendChild(pb);
      } else if (inv.status === "paid") {
        pay.appendChild(
          el(
            "div",
            "note",
            "Paid " +
              (inv.paid_at ? dshort(String(inv.paid_at).slice(0, 10)) : "") +
              (inv.paid_method ? " by " + inv.paid_method : "")
          )
        );
        pay.appendChild(
          btn("Mark unpaid", "btn alt sm", function () {
            sb.from("invoices")
              .update({ status: "open", paid_at: null, paid_method: "" })
              .eq("id", inv.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not save.");
                  return;
                }
                inv.status = "open";
                inv.paid_at = null;
                inv.paid_method = "";
                render();
                openInvoice(inv.id);
              });
          })
        );
      }
      var dz = el("div", "actions");
      dz.appendChild(el("span"));
      if (inv.status !== "void")
        dz.appendChild(
          btn("Void invoice", "btn danger", function () {
            if (!confirm("Void this invoice? Its visits go back to 'To bill' so you can bill them again."))
              return;
            releaseVisits(inv, function () {
              sb.from("invoices")
                .update({ status: "void" })
                .eq("id", inv.id)
                .then(function () {
                  inv.status = "void";
                  render();
                  openInvoice(inv.id);
                });
            });
          })
        );
      else
        dz.appendChild(
          btn("Delete", "btn danger", function () {
            if (!confirm("Delete this voided invoice for good?")) return;
            sb.from("invoices")
              .delete()
              .eq("id", inv.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not delete.");
                  return;
                }
                invoices = invoices.filter(function (z) {
                  return z.id !== inv.id;
                });
                closeDetail();
                render();
              });
          })
        );
      body.appendChild(pay);
      body.appendChild(dz);
    });
}
function setTotal(inv, total, cb) {
  sb.from("invoices")
    .update({ total: total })
    .eq("id", inv.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the total.");
        return;
      }
      inv.total = total;
      render();
      cb();
    });
}
function removeLine(inv, it, cb) {
  sb.from("invoice_items")
    .delete()
    .eq("id", it.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not remove the line.");
        return;
      }
      var after = function () {
        setTotal(inv, r2(Number(inv.total) - Number(it.amount)), function () {
          loadUnbilled().then(cb);
        });
      };
      if (it.visit_id) sb.from("visits").update({ invoice_id: null }).eq("id", it.visit_id).then(after);
      else after();
    });
}
function releaseVisits(inv, cb) {
  sb.from("visits")
    .update({ invoice_id: null })
    .eq("invoice_id", inv.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not release the visits.");
        return;
      }
      loadUnbilled().then(cb);
    });
}
function markSent(inv) {
  if (inv.sent_at) return;
  var now = new Date().toISOString();
  sb.from("invoices")
    .update({ sent_at: now })
    .eq("id", inv.id)
    .then(function (r) {
      if (!r.error) {
        inv.sent_at = now;
        render();
      }
    });
}
function invMessage(inv, c) {
  var first = String((c && c.name) || "").split(" ")[0] || "there";
  return (
    "Hi " +
    first +
    ", this is " +
    bizv("name", "Latta Corp") +
    ". Your invoice " +
    invNum(inv.number) +
    (inv.period_end ? " for " + monthName(inv.period_end) : "") +
    " is " +
    money(inv.total) +
    ", due " +
    dshort(inv.due_date) +
    "." +
    (inv.share_token ? " View or print it here: " + docUrl(inv.share_token) + " " : "") +
    (bizv("zelle", "") ? " Pay with Zelle: " + biz.zelle + "." : "") +
    " Thank you!"
  );
}

/* ---- printable invoice (works as a PDF too) ---- */
function showInvoice(inv, items) {
  var c = byId(clients, inv.client_id) || {},
    paper = $("invpaper"),
    addrs = [];
  items.forEach(function (it) {
    if (it.address && addrs.indexOf(it.address) < 0) addrs.push(it.address);
  });
  var rows = items
    .map(function (it) {
      return (
        "<tr><td>" +
        esc(it.service_date ? dshort(it.service_date) : "") +
        "</td><td>" +
        esc(it.description) +
        (it.address ? '<div class="sm">' + esc(it.address) + "</div>" : "") +
        '</td><td class="r">' +
        esc(money(it.amount)) +
        "</td></tr>"
      );
    })
    .join("");
  var paidBox =
    inv.status === "paid"
      ? '<div class="paidstamp">PAID ' +
        esc(inv.paid_at ? dshort(String(inv.paid_at).slice(0, 10)) : "") +
        (inv.paid_method ? " · " + esc(inv.paid_method) : "") +
        "</div>"
      : inv.status === "void"
        ? '<div class="paidstamp void">VOID</div>'
        : "";
  var due = inv.status === "paid" ? "Paid" : inv.status === "void" ? "Void" : money(inv.total);
  paper.innerHTML =
    '<div class="ihead"><div class="ibrand"><div class="lg"><img src="../images/logo-tree-header.png" alt=""></div><div><div class="bn">' +
    esc(bizv("name", "LattaCorp of Central Florida")) +
    '</div><div class="sm">' +
    [bizv("address", ""), bizv("phone", ""), bizv("email", "")].filter(Boolean).map(esc).join("<br>") +
    "</div></div></div>" +
    '<div class="it">INVOICE</div></div><div class="body">' +
    '<div class="facts"><div class="fact"><div class="k">Invoice</div><div class="v">' +
    esc(invNum(inv.number)) +
    '</div></div><div class="fact"><div class="k">Issued</div><div class="v">' +
    esc(dshort(inv.issue_date)) +
    '</div></div><div class="fact"><div class="k">Due</div><div class="v">' +
    esc(dshort(inv.due_date)) +
    '</div></div><div class="fact due"><div class="k">' +
    (inv.status === "open" ? "Amount due" : "Total") +
    '</div><div class="v">' +
    esc(inv.status === "open" ? money(inv.total) : inv.status === "paid" ? money(inv.total) : due) +
    "</div></div></div>" +
    '<div class="bill"><div class="k">Bill to</div><b>' +
    esc(c.name || "") +
    "</b>" +
    (c.company ? "<div>" + esc(c.company) + "</div>" : "") +
    (inv.reference ? '<div class="sm">Ref: ' + esc(inv.reference) + "</div>" : "") +
    (addrs.length
      ? '<div class="sm">Service address' +
        (addrs.length > 1 ? "es" : "") +
        ": " +
        addrs.map(esc).join("; ") +
        "</div>"
      : "") +
    "</div>" +
    '<table class="itab"><thead><tr><th>Date</th><th>Service</th><th class="r">Amount</th></tr></thead><tbody>' +
    rows +
    '</tbody><tfoot><tr><td></td><td class="r"><b>Total</b></td><td class="r"><b>' +
    esc(money(inv.total)) +
    "</b></td></tr></tfoot></table>" +
    paidBox +
    '<div class="pay"><b>How to pay</b><div>' +
    (bizv("zelle", "") ? "Zelle: " + esc(biz.zelle) + "<br>" : "") +
    esc(bizv("payment_note", "")) +
    "</div></div>" +
    '<div class="foot">' +
    esc(bizv("footer", "Thank you!")) +
    "</div></div>";
  var v = $("invview");
  v.hidden = false;
  document.body.classList.add("printing");
  v.scrollTop = 0;
}
function hideInvoice() {
  $("invview").hidden = true;
  document.body.classList.remove("printing");
}

/* ---- Estimates (clients open a private link and can accept) ---- */
function estNum(n) {
  var s = String(n || 0);
  while (s.length < 4) s = "0" + s;
  return "EST-" + s;
}
function docUrl(tok, peek) {
  return location.origin + "/d/?t=" + tok + (peek ? "&p=1" : "");
}
function estExpired(e) {
  return (e.status === "draft" || e.status === "sent") && !!e.valid_until && e.valid_until < today();
}
function estOpen(e) {
  return e.status === "draft" || e.status === "sent";
}
function estChip(e) {
  if (e.status === "accepted") return el("span", "chip won", "Accepted");
  if (e.status === "declined") return el("span", "chip lost", "Declined");
  if (estExpired(e)) return el("span", "chip od", "Expired");
  return el("span", "chip", e.status === "sent" ? (e.viewed_at ? "Viewed" : "Sent") : "Draft");
}
function estMessage(e, c) {
  return (
    "Hi " +
    firstName(c) +
    ", this is " +
    bizv("name", "Latta Corp") +
    ". Here is your estimate" +
    (e.title ? " for " + e.title : "") +
    " (" +
    money(e.total) +
    "): " +
    docUrl(e.share_token) +
    " You can look it over and accept it right on that page. Thank you!"
  );
}
function markEstSent(e) {
  if (e.status !== "draft") return;
  var now = new Date().toISOString();
  sb.from("estimates")
    .update({ status: "sent", sent_at: now })
    .eq("id", e.id)
    .then(function (r) {
      if (!r.error) {
        e.status = "sent";
        e.sent_at = now;
        render();
      }
    });
}
function estRow(e) {
  var b = el("button", "row client");
  b.type = "button";
  var l = el("div");
  l.appendChild(el("b", null, estNum(e.number) + " · " + cname(e.client_id)));
  l.appendChild(
    el(
      "div",
      "sub",
      [
        e.title,
        e.status === "accepted"
          ? "Accepted " + (e.responded_at ? dshort(String(e.responded_at).slice(0, 10)) : "")
          : e.valid_until
            ? "Valid until " + dshort(e.valid_until)
            : ""
      ]
        .filter(Boolean)
        .join(" · ")
    )
  );
  var r = el("div");
  r.style.textAlign = "right";
  r.appendChild(el("b", null, money(e.total)));
  r.appendChild(el("div"));
  r.appendChild(estChip(e));
  b.appendChild(l);
  b.appendChild(r);
  b.addEventListener("click", function () {
    openEstimate(e.id);
  });
  return b;
}
function renderEstimates(list) {
  $("topbtns").appendChild(
    btn("New estimate", "btn", function () {
      openEstimateForm(null);
    })
  );
  if (estErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Estimates aren't set up yet. Run the Stage 11 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var set = estimates.filter(function (e) {
    if (!query) return true;
    return [estNum(e.number), cname(e.client_id), e.title].join(" ").toLowerCase().indexOf(query) > -1;
  });
  if (!set.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        estimates.length
          ? "Nothing matches that."
          : "No estimates yet. Tap New estimate, write it up, and send the client a link they can accept."
      )
    );
    return;
  }
  var waiting = set.filter(function (e) {
      return estOpen(e) && !estExpired(e);
    }),
    rest = set.filter(function (e) {
      return waiting.indexOf(e) < 0;
    });
  [
    ["Waiting for a response", waiting],
    ["Accepted, declined or expired", rest]
  ].forEach(function (g) {
    if (!g[1].length) return;
    var h = el("div", "note", g[0]);
    h.style.cssText = "font-weight:700;margin:12px 0 4px";
    list.appendChild(h);
    g[1].forEach(function (e) {
      list.appendChild(estRow(e));
    });
  });
}
function clientEstimatesSection(c) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Estimates");
  h.appendChild(
    btn("+ New estimate", "btn alt sm", function () {
      openEstimateForm(c.id);
    })
  );
  sec.appendChild(h);
  var mine = estimates.filter(function (e) {
    return e.client_id === c.id;
  });
  if (!mine.length) sec.appendChild(el("div", "note", "None yet."));
  mine.slice(0, 5).forEach(function (e) {
    var r = el("div", "pcard");
    r.style.cssText = "display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer";
    var l = el("div");
    l.appendChild(el("b", null, estNum(e.number) + " · " + money(e.total)));
    l.appendChild(el("div", "note", e.title || "Estimate"));
    r.appendChild(l);
    r.appendChild(estChip(e));
    r.addEventListener("click", function () {
      openEstimate(e.id);
    });
    sec.appendChild(r);
  });
  if (mine.length > 5)
    sec.appendChild(el("div", "note", "+ " + (mine.length - 5) + " older estimates in Billing > Estimates."));
  return sec;
}

/* ---- billing settings ---- */
function openBizSettings() {
  var p = panel();
  p.appendChild(el("h2", null, "Billing settings"));
  p.appendChild(el("p", "note", "This is what appears on every invoice and in the text or email message."));
  var f = {
    name: fld("Business name", "text", bizv("name", "")),
    phone: fld("Phone", "tel", bizv("phone", "")),
    email: fld("Email", "email", bizv("email", "")),
    address: fld("Mailing address (optional)", "text", bizv("address", "")),
    zelle: fld(
      "Zelle info (for example: the phone number or email you receive Zelle on)",
      "text",
      bizv("zelle", "")
    ),
    payment_note: fld("Other payment note", "text", bizv("payment_note", "")),
    terms_days: fld(
      "Payment due within (days after the invoice date; 0 = due on receipt)",
      "number",
      bizv("terms_days", 10)
    ),
    footer: fld("Thank-you line at the bottom", "text", bizv("footer", ""))
  };
  Object.keys(f).forEach(function (k) {
    p.appendChild(f[k]);
  });
  var s = btn("Save", "btn", function () {
    var row = { id: 1 };
    Object.keys(f).forEach(function (k) {
      row[k] = k === "terms_days" ? parseInt(f[k].input.value, 10) || 0 : f[k].input.value.trim();
    });
    s.disabled = true;
    sb.from("business")
      .upsert(row)
      .select()
      .single()
      .then(function (r) {
        s.disabled = false;
        if (r.error || !r.data) {
          alert("Could not save. Did you run the Stage 5 SQL?");
          return;
        }
        biz = r.data;
        closeDetail();
        render();
      });
  });
  s.style.marginTop = "14px";
  p.appendChild(s);
}

/* ======================= crm/src/22-billing-client-page.js ======================= */
/* Billing on the client page: account history, client statements, invoice and payment history. */

/* ---- billing on the client page ---- */
/* ---- Account history and client statement ---- */
function fdate(s) {
  return s ? pd(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}
function acctLedger(cid, pid) {
  var rows = [];
  invoices.forEach(function (i) {
    if (i.client_id !== cid) return;
    var zeroPaid = i.status === "paid" && Number(i.total) === 0;
    rows.push({
      pid: i.property_id || null,
      d: String(i.issue_date).slice(0, 10),
      ord: 0,
      n: i.number,
      desc:
        "Invoice " +
        invNum(i.number) +
        (i.reference ? " (Ref " + i.reference + ")" : "") +
        (i.status === "void" ? " - void" : zeroPaid ? " - no charge" : ""),
      charge: i.status === "void" ? 0 : Number(i.total) || 0,
      pay: 0
    });
    if (
      i.status === "paid" &&
      Number(i.total) > 0 &&
      !invPays.some(function (x) {
        return x.invoice_id === i.id;
      })
    )
      rows.push({
        pid: i.property_id || null,
        d: String(i.paid_at || i.issue_date).slice(0, 10),
        ord: 1,
        n: i.number,
        desc:
          "Payment" + (i.paid_method ? " - " + i.paid_method : "") + " (invoice " + invNum(i.number) + ")",
        charge: 0,
        pay: Number(i.total) || 0
      });
  });
  invPays.forEach(function (x) {
    var iv = x.invoice_id ? byId(invoices, x.invoice_id) : null;
    if (x.client_id !== cid && !(iv && iv.client_id === cid)) return;
    rows.push({
      pid: iv ? iv.property_id || null : null,
      d: String(x.paid_on).slice(0, 10),
      ord: 1,
      n: iv ? iv.number : 0,
      desc:
        "Payment" +
        (x.method ? " - " + x.method : "") +
        (x.reference ? " #" + x.reference : "") +
        (iv ? " (invoice " + invNum(iv.number) + ")" : " (on account)"),
      charge: 0,
      pay: Number(x.amount) || 0,
      pr: x
    });
  });
  if (pid === "none")
    rows = rows.filter(function (r) {
      return !r.pid;
    });
  else if (pid)
    rows = rows.filter(function (r) {
      return r.pid === pid;
    });
  rows.sort(function (a, b) {
    return a.d < b.d ? -1 : a.d > b.d ? 1 : a.ord - b.ord || a.n - b.n;
  });
  return rows;
}
function acctPeriod(rows, from, to) {
  var open = 0,
    list = [],
    ch = 0,
    py = 0;
  rows.forEach(function (r) {
    if (from && r.d < from) open += r.charge - r.pay;
    else if (!to || r.d <= to) list.push(r);
  });
  open = r2(open);
  var bal = open;
  list = list.map(function (r) {
    bal = r2(bal + r.charge - r.pay);
    ch += r.charge;
    py += r.pay;
    return Object.assign({}, r, { bal: bal });
  });
  return { open: open, rows: list, charges: r2(ch), payments: r2(py), close: bal };
}
function acctRange(kind, cf, ct) {
  var t = today(),
    y = t.slice(0, 4);
  if (kind === "year") return [y + "-01-01", t];
  if (kind === "last") return [y - 1 + "-01-01", y - 1 + "-12-31"];
  if (kind === "12") return [addDays(t, -365), t];
  if (kind === "custom") return [cf || "", ct || t];
  return ["", t];
}
function accountHistorySection(c, fixedPid) {
  var box = el("div");
  var h = el("h4", null, "Account history");
  h.style.margin = "14px 0 6px";
  box.appendChild(h);
  if (!acctLedger(c.id).length) {
    box.appendChild(el("div", "note", "No invoices or payments yet."));
    return box;
  }
  var bar = el("div");
  bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px";
  var ks = fld("Timeframe", "select", "all", [
    ["all", "All time"],
    ["year", "This year"],
    ["last", "Last year"],
    ["12", "Last 12 months"],
    ["custom", "Custom dates"]
  ]);
  ks.style.margin = "0";
  var cf = fld("From", "date", ""),
    ct = fld("To", "date", today());
  cf.style.margin = "0";
  ct.style.margin = "0";
  cf.style.display = ct.style.display = "none";
  var cps = clientProps(c.id),
    pf = fld(
      "Property",
      "select",
      fixedPid || "",
      [["", "All properties"]].concat(
        cps.map(function (p) {
          return [p.id, (p.label ? p.label + " \u00b7 " : "") + p.address];
        })
      )
    );
  pf.style.margin = "0";
  if (cps.length > 1 && !fixedPid) bar.appendChild(pf);
  bar.appendChild(ks);
  bar.appendChild(cf);
  bar.appendChild(ct);
  box.appendChild(bar);
  var host = el("div");
  box.appendChild(host);
  function rng() {
    return acctRange(ks.input.value, cf.input.value, ct.input.value);
  }
  function draw() {
    host.textContent = "";
    cf.style.display = ct.style.display = ks.input.value === "custom" ? "" : "none";
    var all = acctLedger(c.id, pf.input.value || null),
      r = rng(),
      L = acctPeriod(all, r[0], r[1]);
    var smn = el(
      "div",
      "note",
      (r[0] ? "Balance before " + mdy(r[0]) + ": " + sm(L.open) + " · " : "") +
        "Charges " +
        money(L.charges) +
        " · Payments " +
        money(L.payments) +
        " · "
    );
    smn.appendChild(el("b", null, "Balance " + sm(L.close)));
    smn.style.marginBottom = "6px";
    host.appendChild(smn);
    var w = el("div", "invwrap"),
      t = document.createElement("table");
    t.className = "ptable";
    var hr = document.createElement("tr");
    ["Date", "Description", "Charges", "Payments", "Balance"].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i > 1) th.className = "r";
      hr.appendChild(th);
    });
    t.appendChild(hr);
    function add(cells, cls) {
      var tr = document.createElement("tr");
      if (cls) tr.style.fontStyle = "italic";
      cells.forEach(function (v, k) {
        var td = document.createElement("td");
        td.textContent = v;
        if (k > 1) td.className = "r";
        tr.appendChild(td);
      });
      t.appendChild(tr);
      return tr;
    }
    if (r[0]) add(["", "Balance forward", "", "", sm(L.open)], 1);
    if (!L.rows.length) add(["", "Nothing in this timeframe", "", "", ""], 0);
    L.rows.forEach(function (x) {
      var tr = add([mdy(x.d), x.desc, x.charge ? money(x.charge) : "", x.pay ? money(x.pay) : "", sm(x.bal)]);
      if (x.pr) {
        tr.style.cursor = "pointer";
        tr.title = "Edit this payment";
        tr.addEventListener("click", function () {
          openPaymentEdit(x.pr);
        });
      }
    });
    w.appendChild(t);
    host.appendChild(w);
    var b = btn(
      pf.input.value ? "Statement for this property (print / PDF)" : "Client statement (print / PDF)",
      "btn sm",
      function () {
        showStatement(c, rng()[0], rng()[1], pf.input.value || null);
      }
    );
    b.style.margin = "8px 8px 0 0";
    host.appendChild(b);
    if (cps.length > 1 && !pf.input.value) {
      var b2 = btn("Statement separated by property (print / PDF)", "btn alt sm", function () {
        showStatementSplit(c, rng()[0], rng()[1]);
      });
      b2.style.marginTop = "8px";
      host.appendChild(b2);
    }
  }
  [ks.input, cf.input, ct.input, pf.input].forEach(function (x) {
    x.addEventListener("change", draw);
  });
  draw();
  return box;
}
function showStatement(c, from, to, pid) {
  var all = acctLedger(c.id, pid),
    L = acctPeriod(all, from, to),
    paper = $("invpaper"),
    addrs = (
      pid === "none"
        ? []
        : pid
          ? clientProps(c.id).filter(function (p) {
              return p.id === pid;
            })
          : clientProps(c.id)
    )
      .map(function (p) {
        return p.address;
      })
      .filter(Boolean);
  var first = all.length ? all[0].d : today(),
    per = from ? fdate(from) + " – " + fdate(to) : "All activity through " + fdate(to);
  var rows = "";
  if (from)
    rows +=
      '<tr><td></td><td><i>Balance forward</i></td><td class="r"></td><td class="r"></td><td class="r">' +
      esc(sm(L.open)) +
      "</td></tr>";
  if (!L.rows.length)
    rows +=
      '<tr><td></td><td><i>No activity in this timeframe</i></td><td class="r"></td><td class="r"></td><td class="r">' +
      esc(sm(L.close)) +
      "</td></tr>";
  L.rows.forEach(function (x) {
    rows +=
      "<tr><td>" +
      esc(mdy(x.d)) +
      "</td><td>" +
      esc(x.desc) +
      '</td><td class="r">' +
      esc(x.charge ? money(x.charge) : "") +
      '</td><td class="r">' +
      esc(x.pay ? money(x.pay) : "") +
      '</td><td class="r">' +
      esc(sm(x.bal)) +
      "</td></tr>";
  });
  paper.innerHTML =
    '<div class="ihead"><div class="ibrand"><div class="lg"><img src="../images/logo-tree-header.png" alt=""></div><div><div class="bn">' +
    esc(bizv("name", "LattaCorp of Central Florida")) +
    '</div><div class="sm">' +
    [bizv("address", ""), bizv("phone", ""), bizv("email", "")].filter(Boolean).map(esc).join("<br>") +
    "</div></div></div>" +
    '<div class="it">STATEMENT</div></div><div class="body">' +
    '<div class="facts"><div class="fact"><div class="k">Statement date</div><div class="v">' +
    esc(fdate(today())) +
    '</div></div><div class="fact" style="grid-column:span 2"><div class="k">Period covered</div><div class="v">' +
    esc(per) +
    '</div></div><div class="fact due"><div class="k">' +
    (L.close > 0 ? "Balance due" : L.close < 0 ? "Credit on account" : "Balance") +
    '</div><div class="v">' +
    esc(sm(L.close)) +
    "</div></div></div>" +
    '<div class="bill"><div class="k">Account statement for</div><b>' +
    esc(c.name || "") +
    "</b>" +
    (c.company ? "<div>" + esc(c.company) + "</div>" : "") +
    (addrs.length
      ? '<div class="sm">Service address' +
        (addrs.length > 1 ? "es" : "") +
        ": " +
        addrs.map(esc).join("; ") +
        "</div>"
      : "") +
    "</div>" +
    '<table class="itab"><thead><tr><th>Date</th><th>Description</th><th class="r">Charges</th><th class="r">Payments</th><th class="r">Balance</th></tr></thead><tbody>' +
    rows +
    '</tbody><tfoot><tr><td></td><td class="r"><b>Period totals</b></td><td class="r"><b>' +
    esc(money(L.charges)) +
    '</b></td><td class="r"><b>' +
    esc(money(L.payments)) +
    '</b></td><td class="r"><b>' +
    esc(sm(L.close)) +
    "</b></td></tr></tfoot></table>" +
    '<div class="sm" style="margin-top:10px">This is a statement of account, not an invoice. It lists the invoices and payments we have on record for the period shown. A balance above $0 is the amount owed. Please contact us if anything looks different from your records.</div>' +
    (L.close > 0
      ? '<div class="pay"><b>How to pay</b><div>' +
        (bizv("zelle", "") ? "Zelle: " + esc(biz.zelle) + "<br>" : "") +
        esc(bizv("payment_note", "")) +
        "</div></div>"
      : "") +
    '<div class="foot">' +
    esc(bizv("footer", "Thank you!")) +
    "</div></div>";
  var v = $("invview");
  v.hidden = false;
  document.body.classList.add("printing");
  v.scrollTop = 0;
}
/* One statement with a summary per property, then each property's activity in its own table. */
function showStatementSplit(c, from, to) {
  showStatement(c, from, to, null);
  var paper = $("invpaper"),
    tab = paper.querySelector("table.itab");
  if (!tab) return;
  var ks = clientProps(c.id).map(function (p) {
    return p.id;
  });
  if (acctLedger(c.id, "none").length) ks.push("none");
  function lab(k) {
    if (k === "none") return "Not tied to a property";
    var p = byId(props, k);
    return p ? (p.label ? p.label + " \u00b7 " : "") + p.address : "";
  }
  var sumRows = "",
    secs = "",
    T = [0, 0, 0];
  ks.forEach(function (k) {
    var L = acctPeriod(acctLedger(c.id, k), from, to);
    T[0] += L.charges;
    T[1] += L.payments;
    T[2] += L.close;
    sumRows +=
      "<tr><td>" +
      esc(lab(k)) +
      '</td><td class="r">' +
      esc(money(L.charges)) +
      '</td><td class="r">' +
      esc(money(L.payments)) +
      '</td><td class="r">' +
      esc(sm(L.close)) +
      "</td></tr>";
    var rows = "";
    if (from)
      rows +=
        '<tr><td></td><td><i>Balance forward</i></td><td class="r"></td><td class="r"></td><td class="r">' +
        esc(sm(L.open)) +
        "</td></tr>";
    if (!L.rows.length)
      rows +=
        '<tr><td></td><td><i>No activity in this timeframe</i></td><td class="r"></td><td class="r"></td><td class="r">' +
        esc(sm(L.close)) +
        "</td></tr>";
    L.rows.forEach(function (x) {
      rows +=
        "<tr><td>" +
        esc(mdy(x.d)) +
        "</td><td>" +
        esc(x.desc) +
        '</td><td class="r">' +
        esc(x.charge ? money(x.charge) : "") +
        '</td><td class="r">' +
        esc(x.pay ? money(x.pay) : "") +
        '</td><td class="r">' +
        esc(sm(x.bal)) +
        "</td></tr>";
    });
    secs +=
      '<div style="margin-top:16px;font-weight:800">' +
      esc(lab(k)) +
      '</div><table class="itab"><thead><tr><th>Date</th><th>Description</th><th class="r">Charges</th><th class="r">Payments</th><th class="r">Balance</th></tr></thead><tbody>' +
      rows +
      '</tbody><tfoot><tr><td></td><td class="r"><b>Property totals</b></td><td class="r"><b>' +
      esc(money(L.charges)) +
      '</b></td><td class="r"><b>' +
      esc(money(L.payments)) +
      '</b></td><td class="r"><b>' +
      esc(sm(L.close)) +
      "</b></td></tr></tfoot></table>";
  });
  var box = document.createElement("div");
  box.innerHTML =
    '<div style="font-weight:800;margin-bottom:4px">Summary by property</div><table class="itab"><thead><tr><th>Property</th><th class="r">Charges</th><th class="r">Payments</th><th class="r">Balance</th></tr></thead><tbody>' +
    sumRows +
    '</tbody><tfoot><tr><td class="r"><b>Account total</b></td><td class="r"><b>' +
    esc(money(r2(T[0]))) +
    '</b></td><td class="r"><b>' +
    esc(money(r2(T[1]))) +
    '</b></td><td class="r"><b>' +
    esc(sm(r2(T[2]))) +
    "</b></td></tr></tfoot></table>" +
    secs;
  tab.replaceWith(box);
}
/* Assign untagged invoices to a client property when every line's address is that property's address. */
function matchInvProps(c, list) {
  function nrm(a) {
    return String(a || "")
      .toLowerCase()
      .split(",")[0]
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  var ps = clientProps(c.id),
    ids = list.map(function (i) {
      return i.id;
    });
  return sb
    .from("invoice_items")
    .select("invoice_id,address")
    .in("invoice_id", ids)
    .limit(5000)
    .then(function (r) {
      if (r.error) return Promise.reject(r.error);
      var by = {};
      (r.data || []).forEach(function (x) {
        (by[x.invoice_id] = by[x.invoice_id] || []).push(x);
      });
      var ups = [];
      list.forEach(function (i) {
        var hits = [],
          miss = false;
        (by[i.id] || []).forEach(function (x) {
          var a = nrm(x.address);
          if (!a) return;
          var m = ps.filter(function (p) {
            return nrm(p.address) === a;
          });
          if (m.length !== 1) {
            miss = true;
            return;
          }
          if (hits.indexOf(m[0].id) < 0) hits.push(m[0].id);
        });
        if (!miss && hits.length === 1) ups.push({ inv: i, pid: hits[0] });
      });
      return ups
        .reduce(function (pr, u) {
          return pr.then(function () {
            return sb
              .from("invoices")
              .update({ property_id: u.pid })
              .eq("id", u.inv.id)
              .then(function (q) {
                if (!q.error) u.inv.property_id = u.pid;
              });
          });
        }, Promise.resolve())
        .then(function () {
          var done = list.filter(function (i) {
            return i.property_id;
          }).length;
          return { done: done, left: list.length - done };
        });
    });
}
function clientBillingSection(c, only) {
  var sec = el("div", "sec"),
    h = el("h3", null, "Billing");
  sec.appendChild(h);
  if (billErr) {
    sec.appendChild(el("div", "note", "Run the Stage 5 SQL in Supabase to turn on billing."));
    return sec;
  }
  var mine = invoices.filter(function (i) {
      return i.client_id === c.id;
    }),
    bal = openTotal(mine),
    od = mine.filter(isOverdue).length,
    ub = unbilled.filter(function (v) {
      return v.client_id === c.id && Number(v.price) > 0;
    });
  var ubt = r2(
    ub.reduce(function (s, v) {
      return s + Number(v.price || 0);
    }, 0)
  );
  var sm = el(
    "div",
    "note",
    [
      bal ? "Balance due " + money(bal) + (od ? " (" + od + " overdue)" : "") : "Nothing owed",
      ubt ? money(ubt) + " not yet billed" : ""
    ]
      .filter(Boolean)
      .join(" · ")
  );
  sm.style.fontWeight = "700";
  sec.appendChild(sm);
  if (ub.length) {
    var ug = groupVisits(ub);
    ug.order.forEach(function (k) {
      var x = ug.g[k];
      var cb = btn(
        "Create invoice for completed visits (" + x.vs.length + ")" + (x.pid ? " · " + paddr(x.pid) : ""),
        "btn alt sm",
        function () {
          cb.disabled = true;
          createInvoice(c.id, x.vs, today(), x.pid).then(
            function (inv) {
              return loadUnbilled().then(function () {
                render();
                openInvoice(inv.id);
              });
            },
            function (e) {
              cb.disabled = false;
              alert(e);
            }
          );
        }
      );
      cb.style.margin = "6px 6px 6px 0";
      sec.appendChild(cb);
    });
  }
  var ab = el("div", "acts");
  ab.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:6px 0";
  ab.appendChild(
    btn("New invoice", "btn alt sm", function () {
      openInvoiceForm(c.id);
    })
  );
  ab.appendChild(
    btn("Record payment", "btn alt sm", function () {
      openPayment(c.id);
    })
  );
  ab.appendChild(
    btn("Past invoice", "btn alt sm", function () {
      openPastInvoice(c.id);
    })
  );
  ab.appendChild(
    btn("Import history", "btn alt sm", function () {
      openHistImport(c.id);
    })
  );
  sec.appendChild(ab);
  var hist = mine.slice().sort(function (a, b) {
    return b.number - a.number;
  });
  /* payments, each tied to a property through its invoice */
  var pays = [];
  if (!payErr) {
    var legacy = hist
      .filter(function (i) {
        return (
          i.status === "paid" &&
          !invPays.some(function (x) {
            return x.invoice_id === i.id;
          })
        );
      })
      .map(function (i) {
        return {
          date: String(i.paid_at || i.issue_date).slice(0, 10),
          inv: invNum(i.number),
          method: i.paid_method || "",
          amount: Number(i.total),
          pr: null,
          pid: i.property_id || ""
        };
      });
    var ent = invPays
      .filter(function (x) {
        return x.client_id === c.id || (byId(invoices, x.invoice_id) || {}).client_id === c.id;
      })
      .map(function (x) {
        var iv = byId(invoices, x.invoice_id);
        return {
          date: String(x.paid_on).slice(0, 10),
          inv: iv ? invNum(iv.number) : "On account",
          method: x.method,
          amount: Number(x.amount),
          pr: x,
          pid: iv ? iv.property_id || "" : "",
          onacct: !iv
        };
      });
    pays = ent.concat(legacy).sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  }
  /* split by property when the client has more than one, or any invoice is tied to one */
  var cps = clientProps(c.id),
    split =
      cps.length > 1 ||
      mine.some(function (i) {
        return i.property_id;
      });
  var keys = cps.map(function (p) {
    return p.id;
  });
  mine.forEach(function (i) {
    var k = i.property_id || "";
    if (k && keys.indexOf(k) < 0) keys.push(k);
  });
  keys.push("");
  only = only && keys.indexOf(only) > -1 ? only : "";
  if (split && cps.length > 1) {
    var vf = fld(
      "Show history for",
      "select",
      only,
      [["", "All properties"]].concat(
        cps.map(function (p) {
          return [p.id, (p.label ? p.label + " \u00b7 " : "") + p.address];
        })
      )
    );
    vf.style.cssText = "margin:10px 0 0;max-width:420px";
    vf.input.addEventListener("change", function () {
      sec.replaceWith(clientBillingSection(c, vf.input.value));
    });
    sec.appendChild(vf);
  }
  if (only) keys = [only];
  function plabel(k) {
    if (!k) return "Not tied to a property";
    var p = byId(props, k);
    return p ? (p.label ? p.label + " · " : "") + p.address : "Removed property";
  }
  function invsOf(k) {
    return hist.filter(function (i) {
      return (i.property_id || "") === k;
    });
  }
  function paysOf(k, onacct) {
    return pays.filter(function (x) {
      return x.pid === k && (onacct === undefined || !!x.onacct === onacct);
    });
  }
  if (split) {
    var hs = el("h4", null, "Summary by property");
    hs.style.margin = "12px 0 6px";
    sec.appendChild(hs);
    var ws = el("div", "invwrap"),
      ts = document.createElement("table");
    ts.className = "ptable";
    var sh = document.createElement("tr");
    ["Property", "Invoiced", "Paid", "Balance due", "Not yet billed", ""].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i) th.className = "r";
      sh.appendChild(th);
    });
    ts.appendChild(sh);
    var T = [0, 0, 0, 0];
    keys.forEach(function (k) {
      var iv = invsOf(k),
        py = paysOf(k),
        uv = k
          ? ub.filter(function (v) {
              return v.property_id === k;
            })
          : ub.filter(function (v) {
              return !v.property_id || keys.indexOf(v.property_id) < 0;
            });
      var n = [
        r2(
          iv
            .filter(function (i) {
              return i.status !== "void";
            })
            .reduce(function (s, i) {
              return s + Number(i.total || 0);
            }, 0)
        ),
        r2(
          py.reduce(function (s, x) {
            return s + x.amount;
          }, 0)
        ),
        openTotal(iv),
        r2(
          uv.reduce(function (s, v) {
            return s + Number(v.price || 0);
          }, 0)
        )
      ];
      if (!k && !iv.length && !py.length && !uv.length) return;
      n.forEach(function (v, i) {
        T[i] = r2(T[i] + v);
      });
      var ovd = iv.filter(isOverdue).length,
        tr = document.createElement("tr");
      [
        plabel(k),
        money(n[0]),
        money(n[1]),
        money(n[2]) + (ovd ? " (" + ovd + " overdue)" : ""),
        n[3] ? money(n[3]) : ""
      ].forEach(function (v, i) {
        var td = document.createElement("td");
        td.textContent = v;
        if (i) td.className = "r";
        tr.appendChild(td);
      });
      var sx = document.createElement("td");
      sx.className = "r";
      if (iv.length || py.length)
        sx.appendChild(
          btn("Statement", "btn alt sm", function () {
            showStatement(c, "", today(), k || "none");
          })
        );
      tr.appendChild(sx);
      ts.appendChild(tr);
    });
    if (!only) {
      var stt = document.createElement("tr");
      stt.className = "tot";
      ["Account total", money(T[0]), money(T[1]), money(T[2]), T[3] ? money(T[3]) : "", ""].forEach(
        function (v, i) {
          var td = document.createElement("td");
          td.textContent = v;
          td.style.fontWeight = "800";
          if (i) td.className = "r";
          stt.appendChild(td);
        }
      );
      ts.appendChild(stt);
    }
    ws.appendChild(ts);
    sec.appendChild(ws);
    if (
      !only &&
      pays.some(function (x) {
        return x.onacct;
      })
    )
      sec.appendChild(
        el(
          "div",
          "note",
          'Payments recorded on account (not applied to an invoice) are listed under "Not tied to a property".'
        )
      );
  }
  sec.appendChild(accountHistorySection(c, only));
  /* invoice history */
  function invTable(list) {
    var w = el("div", "invwrap"),
      t = document.createElement("table");
    t.className = "ptable";
    var hr = document.createElement("tr");
    ["Number", "Date", "Amount", "Balance", "Status"].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i === 2 || i === 3) th.className = "r";
      hr.appendChild(th);
    });
    t.appendChild(hr);
    var ta = 0,
      tb = 0;
    list.forEach(function (i) {
      var tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.title = "Open invoice";
      if (i.status !== "void") ta += Number(i.total || 0);
      tb += balOf(i);
      var stt =
        i.status === "paid"
          ? "Paid" +
            (i.paid_at ? " " + mdy(String(i.paid_at).slice(0, 10)) : "") +
            (i.paid_method ? " (" + i.paid_method + ")" : "")
          : i.status === "void"
            ? "Void"
            : isOverdue(i)
              ? "Overdue"
              : !payErr && invPaidSum(i) > 0
                ? "Partly paid"
                : "Open";
      [invNum(i.number), mdy(i.issue_date), money(i.total), money(balOf(i)), stt].forEach(function (v, k) {
        var td = document.createElement("td");
        td.textContent = v;
        if (k === 2 || k === 3) td.className = "r";
        tr.appendChild(td);
      });
      tr.addEventListener("click", function () {
        openInvoice(i.id);
      });
      t.appendChild(tr);
    });
    if (split) {
      var ft = document.createElement("tr");
      ft.className = "tot";
      ["Total", "", money(r2(ta)), money(r2(tb)), ""].forEach(function (v, k) {
        var td = document.createElement("td");
        td.textContent = v;
        td.style.fontWeight = "800";
        if (k === 2 || k === 3) td.className = "r";
        ft.appendChild(td);
      });
      t.appendChild(ft);
    }
    w.appendChild(t);
    return w;
  }
  function sub(txt) {
    var s = el("div", "note", txt);
    s.style.cssText = "font-weight:700;margin:10px 0 4px";
    return s;
  }
  var h1 = el("h4", null, "Invoice history");
  h1.style.margin = "12px 0 6px";
  sec.appendChild(h1);
  if (!hist.length) sec.appendChild(el("div", "note", "No invoices yet."));
  else if (!split) sec.appendChild(invTable(hist));
  else
    keys.forEach(function (k) {
      var l = invsOf(k);
      if (!l.length) {
        if (k)
          sec
            .appendChild(sub(plabel(k)))
            .insertAdjacentHTML("beforeend", ' <span style="font-weight:400">— no invoices</span>');
        return;
      }
      sec.appendChild(sub(plabel(k)));
      if (!k && cps.length > 1) {
        sec.appendChild(
          el(
            "div",
            "note",
            "These invoices aren't assigned to a property. Open one to pick its property, or match them all by the address on their lines."
          )
        );
        var mb = btn("Match these to properties by address", "btn alt sm", function () {
          mb.disabled = true;
          mb.textContent = "Matching...";
          matchInvProps(c, l).then(
            function (n) {
              alert(
                n.done +
                  " invoice" +
                  (n.done === 1 ? "" : "s") +
                  " assigned to a property." +
                  (n.left
                    ? "\n\n" +
                      n.left +
                      " couldn't be matched (no address on the lines, an address that isn't one of this client's properties, or lines for more than one property). Open those to pick the property."
                    : "")
              );
              sec.replaceWith(clientBillingSection(c, only));
            },
            function () {
              mb.disabled = false;
              mb.textContent = "Match these to properties by address";
              alert("Could not load the invoice lines.");
            }
          );
        });
        mb.style.margin = "4px 0 6px";
        sec.appendChild(mb);
        var ab = el("div");
        ab.style.cssText = "display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin:4px 0 8px";
        var af = fld(
          "Or assign all " + l.length + " to",
          "select",
          "",
          [["", "Choose a property..."]].concat(
            cps.map(function (p) {
              return [p.id, (p.label ? p.label + " \u00b7 " : "") + p.address];
            })
          )
        );
        af.style.cssText = "margin:0;min-width:260px;flex:1;max-width:420px";
        ab.appendChild(af);
        var ag = btn("Assign", "btn sm", function () {
          var pid = af.input.value;
          if (!pid) {
            alert("Choose a property first.");
            return;
          }
          if (
            !confirm(
              "Assign all " +
                l.length +
                " invoice" +
                (l.length === 1 ? "" : "s") +
                " (and their payments) to " +
                paddr(pid) +
                "?"
            )
          )
            return;
          ag.disabled = true;
          ag.textContent = "Assigning...";
          var ids = l.map(function (i) {
            return i.id;
          });
          sb.from("invoices")
            .update({ property_id: pid })
            .in("id", ids)
            .then(function (r) {
              if (r.error) {
                ag.disabled = false;
                ag.textContent = "Assign";
                alert("Could not assign them. Did you run the Stage 20 SQL?");
                return;
              }
              l.forEach(function (i) {
                i.property_id = pid;
              });
              return sb
                .from("invoice_items")
                .update({ address: paddr(pid) })
                .in("invoice_id", ids)
                .eq("address", "")
                .then(function () {
                  repData = null;
                  sec.replaceWith(clientBillingSection(c, only));
                });
            });
        });
        ab.appendChild(ag);
        sec.appendChild(ab);
      }
      sec.appendChild(invTable(l));
    });
  /* payment history */
  var h2 = el("h4", null, "Payment history");
  h2.style.margin = "14px 0 6px";
  sec.appendChild(h2);
  if (payErr) {
    sec.appendChild(el("div", "note", "Run the Stage 18 SQL in Supabase to turn on payment history."));
    return sec;
  }
  function payTable(list, label) {
    var w2 = el("div", "invwrap"),
      t2 = document.createElement("table");
    t2.className = "ptable";
    var h3 = document.createElement("tr");
    ["Date", "Invoice", "Method", "Amount", ""].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i === 3) th.className = "r";
      h3.appendChild(th);
    });
    t2.appendChild(h3);
    var tot = 0;
    list.forEach(function (x) {
      tot += x.amount;
      var tr = document.createElement("tr");
      [mdy(x.date), x.inv, x.method, money(x.amount)].forEach(function (v, k) {
        var td = document.createElement("td");
        td.textContent = v;
        if (k === 3) td.className = "r";
        tr.appendChild(td);
      });
      var ex = document.createElement("td");
      if (x.pr) {
        var eb = btn("Edit", "btn alt sm", function () {
          openPaymentEdit(x.pr);
        });
        ex.appendChild(eb);
      }
      tr.appendChild(ex);
      t2.appendChild(tr);
    });
    var ft = document.createElement("tr");
    ft.className = "tot";
    [label, "", "", money(r2(tot)), ""].forEach(function (v, k) {
      var td = document.createElement("td");
      td.textContent = v;
      td.style.fontWeight = "800";
      if (k === 3) td.className = "r";
      ft.appendChild(td);
    });
    t2.appendChild(ft);
    w2.appendChild(t2);
    return w2;
  }
  if (!pays.length) sec.appendChild(el("div", "note", "No payments yet."));
  else if (!split) sec.appendChild(payTable(pays, "Total paid"));
  else {
    keys.forEach(function (k) {
      var l = paysOf(k);
      if (!l.length) {
        if (k)
          sec
            .appendChild(sub(plabel(k)))
            .insertAdjacentHTML("beforeend", ' <span style="font-weight:400">— no payments</span>');
        return;
      }
      sec.appendChild(sub(plabel(k)));
      sec.appendChild(payTable(l, "Paid"));
    });
    if (!only) {
      var gt = el(
        "div",
        "note",
        "Total paid, all properties: " +
          money(
            r2(
              pays.reduce(function (s, x) {
                return s + x.amount;
              }, 0)
            )
          )
      );
      gt.style.cssText = "font-weight:800;margin-top:8px";
      sec.appendChild(gt);
    }
  }
  return sec;
}

/* ======================= crm/src/23-price-calculator.js ======================= */
/* Lawn price calculator and the estimate form. */

/* ---- Lawn price calculator (rough per-visit price for lawn maintenance) ---- */
var PRICE_DEF = {
  base: 20,
  per1000: 4,
  bi: 1.2,
  minw: 35,
  minb: 40,
  step: 5,
  grass: 52,
  adderp: 8,
  maxg: 45000,
  show: 1,
  taperAt: 10000,
  taper: 75
};
var DEF_OPTS = [
  { id: "fence", en: "Is the yard fenced?", es: "¿El patio tiene cerca?", pct: 25, on: 1 },
  {
    id: "plants",
    en: "Lots of plants, trees or obstacles in the lawn?",
    es: "¿Muchas plantas, árboles u obstáculos en el césped?",
    pct: 12.5,
    on: 1
  },
  {
    id: "slope",
    en: "Steep slope or uneven ground?",
    es: "¿Pendiente pronunciada o terreno desigual?",
    pct: 12.5,
    on: 1
  },
  {
    id: "walks",
    en: "Long driveway or lots of sidewalks to edge and blow?",
    es: "¿Entrada larga o muchas aceras para bordear y soplar?",
    pct: 12.5,
    on: 1
  },
  {
    id: "water",
    en: "Pond or lake bank to trim around?",
    es: "¿Orilla de estanque o lago para recortar?",
    pct: 12.5,
    on: 1
  }
];
function pricing() {
  var o = Object.assign({}, PRICE_DEF),
    p = biz && biz.pricing && typeof biz.pricing === "object" ? biz.pricing : {};
  Object.keys(PRICE_DEF).forEach(function (k) {
    var v = parseFloat(p[k]);
    if (!isNaN(v) && v >= 0) o[k] = v;
  });
  o.options = Array.isArray(p.options)
    ? p.options
        .map(function (x, i) {
          return {
            id: String(x.id || "o" + i),
            en: String(x.en || ""),
            es: String(x.es || x.en || ""),
            pct: isNaN(parseFloat(x.pct)) ? ((parseFloat(x.amt) || 0) / 40) * 100 : parseFloat(x.pct),
            on: x.on === 0 || x.on === false ? 0 : 1
          };
        })
        .filter(function (x) {
          return x.en;
        })
    : DEF_OPTS.slice();
  return o;
}
function ceilStep(x, st) {
  return st > 0 ? Math.ceil(x / st - 1e-9) * st : Math.ceil(x - 1e-9);
}
/* Base price for a lawn, then options add a percentage of it (rounded UP to the next $5); the website adds a % cushion on top (also rounded up). */
function priceFor(g, freq, P) {
  P = P || pricing();
  var T = P.taperAt,
    eff = Math.min(g, T) + (P.taper / 100) * Math.max(g - T, 0),
    w = P.base + (P.per1000 * eff) / 1000,
    raw = freq === "biweekly" ? w * P.bi : w,
    st = P.step > 0 ? Math.round(raw / P.step) * P.step : Math.round(raw),
    mn = freq === "biweekly" ? P.minb : P.minw;
  return { price: Math.max(st, mn), atMin: st <= mn };
}
function quoteFor(g, freq, pct, P) {
  P = P || pricing();
  var b = priceFor(g, freq, P),
    raw = b.price * (1 + pct / 100);
  return {
    base: b.price,
    atMin: b.atMin,
    quote: pct > 0 ? ceilStep(raw, P.step) : b.price,
    web: ceilStep(raw * (1 + P.adderp / 100), P.step)
  };
}
function calcWidget(use) {
  var box = el("div", "calcbox"),
    P = pricing();
  var basis = fld("Square feet of", "select", "grass", [
      ["grass", "Grass only (mowed area)"],
      ["lot", "Whole property (grass is about " + Math.round(P.grass) + "%)"]
    ]),
    sq = fld("Square feet", "number", "");
  sq.input.inputMode = "numeric";
  sq.input.min = "0";
  box.appendChild(basis);
  box.appendChild(sq);
  var opts = el("div"),
    checks = [];
  P.options
    .filter(function (o) {
      return o.on;
    })
    .forEach(function (o) {
      var l = document.createElement("label");
      l.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0;font-weight:400";
      var c = document.createElement("input");
      c.type = "checkbox";
      c.style.cssText = "width:auto;margin:0";
      c.addEventListener("change", draw);
      l.appendChild(c);
      l.appendChild(document.createTextNode(o.en + " (+" + o.pct + "%)"));
      opts.appendChild(l);
      checks.push([c, o]);
    });
  if (checks.length) {
    var oh = el("div", "note", "Options (each adds a percentage of the base price)");
    oh.style.marginTop = "10px";
    box.appendChild(oh);
    box.appendChild(opts);
  }
  var out = el("div", "calcout");
  box.appendChild(out);
  function draw() {
    out.textContent = "";
    P = pricing();
    var n = parseFloat(sq.input.value);
    if (!(n > 0)) {
      out.appendChild(el("div", "note", "Enter the square footage to see a rough price."));
      return;
    }
    var g = basis.input.value === "lot" ? (n * P.grass) / 100 : n,
      gr = Math.round(g),
      sel = checks
        .filter(function (x) {
          return x[0].checked;
        })
        .map(function (x) {
          return x[1];
        }),
      pct = sel.reduce(function (t, o) {
        return t + o.pct;
      }, 0);
    if (basis.input.value === "lot")
      out.appendChild(el("div", "note", "About " + gr.toLocaleString("en-US") + " sq ft of grass."));
    var row = el("div", "calcrow");
    [
      ["weekly", "Weekly"],
      ["biweekly", "Bi-weekly"]
    ].forEach(function (f) {
      var r = quoteFor(g, f[0], pct, P),
        q = r.quote,
        c = el("div", "calccard"),
        b = el("div", "calcbig", "$" + q);
      c.appendChild(el("div", "note", f[1] + " · quote price per visit"));
      c.appendChild(b);
      c.appendChild(el("div", "note", "Website shows $" + r.web + (r.atMin ? " · minimum applies" : "")));
      if (use)
        c.appendChild(
          btn("Use this price", "btn alt sm", function () {
            use(
              "Lawn maintenance, " +
                f[1].toLowerCase() +
                " (about " +
                gr.toLocaleString("en-US") +
                " sq ft of grass" +
                (sel.length
                  ? "; " +
                    sel
                      .map(function (o) {
                        return o.en.replace(/\?$/, "");
                      })
                      .join("; ")
                  : "") +
                ")",
              q
            );
          })
        );
      row.appendChild(c);
    });
    out.appendChild(row);
    out.appendChild(
      el(
        "div",
        "note",
        "A rough guide, rounded to the nearest $" +
          P.step +
          ". Adjust for hills, gates, heavy overgrowth or distance."
      )
    );
  }
  sq.input.addEventListener("input", draw);
  basis.input.addEventListener("change", draw);
  draw();
  if (isOwner()) {
    var d = document.createElement("details");
    d.style.marginTop = "14px";
    d.appendChild(el("summary", null, "Edit rates and options (owner)"));
    var F = {
      base: fld("Starting price per visit ($)", "number", P.base),
      per1000: fld("Added per 1,000 sq ft of grass ($)", "number", P.per1000),
      bi: fld("Bi-weekly costs this many times the weekly price (1.2 = 20% more)", "number", P.bi),
      minw: fld("Weekly minimum ($)", "number", P.minw),
      minb: fld("Bi-weekly minimum ($)", "number", P.minb),
      step: fld("Round to the nearest ($)", "number", P.step),
      grass: fld("Grass is about this % of a whole property", "number", P.grass),
      adderp: fld(
        "Website estimate is this many % higher than the quote price (rounded up)",
        "number",
        P.adderp
      ),
      taperAt: fld("Bigger lawns: the rate drops after this many sq ft of grass", "number", P.taperAt),
      taper: fld(
        "...each extra 1,000 sq ft after that costs this % of the normal rate (100 = no drop)",
        "number",
        P.taper
      ),
      maxg: fld("Website asks for a custom quote above this many sq ft of grass", "number", P.maxg),
      show: fld("Show the calculator on the website", "select", P.show ? "1" : "0", [
        ["1", "Yes"],
        ["0", "No"]
      ])
    };
    Object.keys(F).forEach(function (k) {
      F[k].input.step = "any";
      d.appendChild(F[k]);
    });
    var oh2 = el("h3", null, "Options");
    oh2.style.marginTop = "14px";
    d.appendChild(oh2);
    d.appendChild(
      el(
        "p",
        "note",
        "Each checked option adds a percentage of the base price per visit, rounded up to the next $5, so it scales with bigger lawns. Spanish is what Spanish-speaking visitors see."
      )
    );
    var orow = el("div");
    d.appendChild(orow);
    var rows = [];
    function addOpt(o) {
      var r = el("div", "calcopt");
      r.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:8px;margin:8px 0";
      var en = fld("Question (English)", "text", o.en),
        es = fld("Question (Spanish)", "text", o.es),
        am = fld("Adds (% of the base price)", "number", o.pct),
        on = document.createElement("label");
      on.style.cssText = "display:flex;gap:8px;align-items:center;margin:6px 0";
      var ck = document.createElement("input");
      ck.type = "checkbox";
      ck.checked = !!o.on;
      ck.style.cssText = "width:auto;margin:0";
      on.appendChild(ck);
      on.appendChild(document.createTextNode("Show this option"));
      var rm = btn("Remove", "btn danger sm", function () {
        r.remove();
        rows = rows.filter(function (x) {
          return x.r !== r;
        });
      });
      r.appendChild(en);
      r.appendChild(es);
      r.appendChild(am);
      r.appendChild(on);
      r.appendChild(rm);
      orow.appendChild(r);
      rows.push({ r: r, id: o.id, en: en, es: es, am: am, ck: ck });
    }
    P.options.forEach(addOpt);
    d.appendChild(
      btn("+ Add option", "btn alt sm", function () {
        addOpt({ id: "o" + Date.now().toString(36), en: "", es: "", pct: 12.5, on: 1 });
      })
    );
    var sv = btn("Save rates and options", "btn", function () {
      var o = {};
      for (var k in F) {
        var v = parseFloat(F[k].input.value);
        if (isNaN(v) || v < 0) {
          alert("Every rate needs a number, zero or more.");
          return;
        }
        o[k] = v;
      }
      o.options = rows
        .map(function (x) {
          return {
            id: x.id,
            en: x.en.input.value.trim(),
            es: x.es.input.value.trim(),
            pct: parseFloat(x.am.input.value) || 0,
            on: x.ck.checked ? 1 : 0
          };
        })
        .filter(function (x) {
          return x.en;
        });
      var q =
        biz && biz.id
          ? sb.from("business").update({ pricing: o }).eq("id", biz.id)
          : sb.from("business").upsert({ id: 1, pricing: o });
      q.select().then(function (r) {
        var row = r.data && (Array.isArray(r.data) ? r.data[0] : r.data);
        if (r.error || !row) {
          alert("Could not save. Run the Stage 15 SQL in Supabase first.");
          return;
        }
        biz = row;
        closeDetail();
        render();
        alert("Saved. The website uses these within a minute or two.");
      });
    });
    sv.style.marginTop = "12px";
    d.appendChild(sv);
    box.appendChild(d);
  }
  return box;
}
function openCalc() {
  var p = panel();
  p.appendChild(el("h2", null, "Lawn price calculator"));
  p.appendChild(
    el(
      "p",
      "note",
      "Your quote price per visit for lawn maintenance, from the size of the lawn and any options. The website shows a slightly higher estimate (a % cushion), so a custom quote can come in a little lower. You can also use this inside a new estimate."
    )
  );
  p.appendChild(calcWidget(null));
}
function openEstimateForm(cid) {
  if (estErr) {
    alert("Run the Stage 11 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "New estimate"));
  var list = clients.filter(function (c) {
    return !c.archived || c.id === cid;
  });
  var cs = fld(
    "Client",
    "select",
    cid || "",
    [["", "Choose a client..."]].concat(
      list.map(function (c) {
        return [c.id, dispName(c) + (c.company ? " · " + c.company : "")];
      })
    )
  );
  var ttl = fld("Title (for example: Spring cleanup and mulch)", "text", ""),
    scp = fld("Details the client will see (optional)", "textarea", ""),
    vd = fld("Valid for (days)", "number", "30");
  p.appendChild(cs);
  p.appendChild(ttl);
  p.appendChild(scp);
  p.appendChild(vd);
  p.appendChild(el("h3", null, "Lines"));
  var box = el("div"),
    rows = [];
  function addRow() {
    var r = el("div", "grid2"),
      d = fld("Description", "text", ""),
      a = fld("Amount ($)", "number", "");
    a.input.step = "0.01";
    a.input.inputMode = "decimal";
    r.appendChild(d);
    r.appendChild(a);
    box.appendChild(r);
    rows.push({ d: d, a: a });
  }
  var cd = document.createElement("details");
  cd.style.margin = "0 0 10px";
  cd.appendChild(el("summary", null, "Price calculator (lawn maintenance)"));
  cd.appendChild(
    calcWidget(function (desc, amt) {
      var t = rows.filter(function (x) {
        return !x.d.input.value.trim() && x.a.input.value === "";
      })[0];
      if (!t) {
        addRow();
        t = rows[rows.length - 1];
      }
      t.d.input.value = desc;
      t.a.input.value = String(amt);
      cd.open = false;
    })
  );
  p.appendChild(cd);
  p.appendChild(box);
  addRow();
  var more = btn("+ Add another line", "btn alt sm", addRow);
  p.appendChild(more);
  var go = btn("Save estimate", "btn", function () {
    if (!cs.input.value) {
      alert("Choose a client.");
      return;
    }
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i].d.input.value.trim(),
        a = parseFloat(rows[i].a.input.value);
      if (!d && isNaN(a)) continue;
      if (!d || isNaN(a)) {
        alert("Each line needs a description and an amount.");
        return;
      }
      items.push({ description: d, amount: a });
    }
    if (!items.length) {
      alert("Add at least one line.");
      return;
    }
    var days = parseInt(vd.input.value, 10),
      total = r2(
        items.reduce(function (s2, x) {
          return s2 + x.amount;
        }, 0)
      );
    go.disabled = true;
    sb.from("estimates")
      .insert({
        client_id: cs.input.value,
        title: ttl.input.value.trim(),
        scope: scp.input.value.trim(),
        valid_until: days > 0 ? addDays(today(), days) : null,
        total: total
      })
      .select()
      .single()
      .then(function (r) {
        if (r.error || !r.data) {
          go.disabled = false;
          alert("Could not save. Did you run the Stage 11 SQL?");
          return;
        }
        var e = r.data;
        items.forEach(function (x) {
          x.estimate_id = e.id;
        });
        sb.from("estimate_items")
          .insert(items)
          .then(function (r2_) {
            if (r2_.error) {
              sb.from("estimates")
                .delete()
                .eq("id", e.id)
                .then(function () {
                  go.disabled = false;
                  alert("Could not save the lines.");
                });
              return;
            }
            estimates.unshift(e);
            render();
            openEstimate(e.id);
          });
      });
  });
  go.style.marginTop = "14px";
  p.appendChild(go);
}
function openEstimate(id) {
  var e = byId(estimates, id);
  if (!e) return;
  var c = byId(clients, e.client_id),
    p = panel();
  p.appendChild(el("h2", null, estNum(e.number) + " · " + cname(e.client_id)));
  var st =
    e.status === "accepted"
      ? "Accepted"
      : e.status === "declined"
        ? "Declined"
        : estExpired(e)
          ? "Expired"
          : e.status === "sent"
            ? "Sent"
            : "Draft";
  p.appendChild(
    el(
      "div",
      "note",
      st +
        " · issued " +
        dshort(e.issue_date) +
        (e.valid_until ? " · valid until " + dshort(e.valid_until) : "") +
        (e.sent_at ? " · sent " + dshort(String(e.sent_at).slice(0, 10)) : " · not sent yet")
    )
  );
  var body = el("div");
  body.appendChild(el("div", "note", "Loading..."));
  p.appendChild(body);
  sb.from("estimate_items")
    .select("*")
    .eq("estimate_id", e.id)
    .order("created_at", { ascending: true })
    .limit(500)
    .then(function (r) {
      var items = r.error ? [] : r.data || [];
      body.textContent = "";
      var edit = estOpen(e);
      if (e.status === "accepted" || e.status === "declined") {
        var ans = el(
          "div",
          "pcard",
          (e.status === "accepted" ? "✓ Accepted" : "Declined") +
            (e.response_name
              ? /^Recorded/.test(e.response_name)
                ? " (" + e.response_name.toLowerCase() + ")"
                : " by " + e.response_name
              : "") +
            (e.responded_at ? " on " + dshort(String(e.responded_at).slice(0, 10)) : "") +
            (e.response_note ? '. Note: "' + e.response_note + '"' : "")
        );
        ans.style.fontWeight = "700";
        body.appendChild(ans);
      }
      var ttl = fld("Title", "text", e.title || ""),
        scp = fld("Details the client will see", "textarea", e.scope || ""),
        vu = fld("Valid until", "date", e.valid_until || "");
      if (edit) {
        body.appendChild(ttl);
        body.appendChild(scp);
        body.appendChild(vu);
        var sv = btn("Save details", "btn alt sm", function () {
          var row = {
            title: ttl.input.value.trim(),
            scope: scp.input.value.trim(),
            valid_until: vu.input.value || null
          };
          sb.from("estimates")
            .update(row)
            .eq("id", e.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not save.");
                return;
              }
              e.title = row.title;
              e.scope = row.scope;
              e.valid_until = row.valid_until;
              sv.textContent = "Saved";
              render();
              setTimeout(function () {
                sv.textContent = "Save details";
              }, 1200);
            });
        });
        sv.style.marginBottom = "10px";
        body.appendChild(sv);
      } else {
        if (e.title) body.appendChild(el("b", null, e.title));
        if (e.scope) {
          var sc = el("div", "note", e.scope);
          sc.style.whiteSpace = "pre-wrap";
          body.appendChild(sc);
        }
      }
      var t = document.createElement("table");
      t.className = "itable";
      items.forEach(function (it) {
        var tr = document.createElement("tr");
        tr.appendChild(el("td", null, it.description));
        tr.appendChild(el("td", "amt", money(it.amount)));
        if (edit && items.length > 1) {
          var x = el("td");
          var rm = btn("×", "link", function () {
            sb.from("estimate_items")
              .delete()
              .eq("id", it.id)
              .then(function (r2_) {
                if (r2_.error) {
                  alert("Could not remove the line.");
                  return;
                }
                setEstTotal(e, r2(Number(e.total) - Number(it.amount)), function () {
                  openEstimate(e.id);
                });
              });
          });
          rm.setAttribute("aria-label", "Remove line");
          rm.style.cssText = "font-size:1.2rem;text-decoration:none;color:var(--red)";
          x.appendChild(rm);
          tr.appendChild(x);
        }
        t.appendChild(tr);
      });
      body.appendChild(t);
      body.appendChild(el("div", "invtotal", "Total " + money(e.total)));
      if (edit) {
        var add = el("div", "pcard"),
          g = el("div", "grid2"),
          dsc = fld("Add a line", "text", ""),
          amt = fld("Amount ($)", "number", "");
        amt.input.step = "0.01";
        amt.input.inputMode = "decimal";
        g.appendChild(dsc);
        g.appendChild(amt);
        add.appendChild(g);
        var ab = btn("Add line", "btn alt sm", function () {
          var a2 = parseFloat(amt.input.value);
          if (!dsc.input.value.trim() || isNaN(a2)) {
            alert("Enter a description and an amount.");
            return;
          }
          sb.from("estimate_items")
            .insert({ estimate_id: e.id, description: dsc.input.value.trim(), amount: a2 })
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not add the line.");
                return;
              }
              setEstTotal(e, r2(Number(e.total) + a2), function () {
                openEstimate(e.id);
              });
            });
        });
        ab.style.marginTop = "8px";
        add.appendChild(ab);
        body.appendChild(add);
      }
      var acts = el("div", "contact");
      acts.style.marginTop = "14px";
      var msg = estMessage(e, c);
      if (c && c.email) {
        var a2 = el("a", "btn", "Email estimate");
        a2.href = mailHref(
          c.email,
          "Estimate " + estNum(e.number) + " from " + bizv("name", "Latta Corp"),
          msg
        );
        a2.addEventListener("click", function () {
          markEstSent(e);
        });
        acts.appendChild(a2);
      }
      acts.appendChild(
        copyBtn("Copy message", msg, false, function () {
          markEstSent(e);
        })
      );
      acts.appendChild(
        copyBtn("Copy link", docUrl(e.share_token), false, function () {
          markEstSent(e);
        })
      );
      if (isOwner() && c && c.phone) {
        var a1 = el("a", "btn alt", "Text");
        a1.href = smsHref(c.phone, msg);
        a1.addEventListener("click", function () {
          markEstSent(e);
        });
        acts.appendChild(a1);
      }
      var pv = el("a", "btn alt", "Preview / Print");
      pv.href = docUrl(e.share_token, true);
      pv.target = "_blank";
      pv.rel = "noopener";
      acts.appendChild(pv);
      body.appendChild(acts);
      if (e.viewed_at)
        body.appendChild(el("div", "note", "✓ Client opened the link " + ago(e.viewed_at) + "."));
      else if (e.sent_at) body.appendChild(el("div", "note", "The client hasn't opened the link yet."));
      var dz = el("div", "actions");
      dz.style.marginTop = "14px";
      function setStatus(s2, extra) {
        var row = { status: s2 };
        Object.keys(extra || {}).forEach(function (k) {
          row[k] = extra[k];
        });
        sb.from("estimates")
          .update(row)
          .eq("id", e.id)
          .then(function (r2_) {
            if (r2_.error) {
              alert("Could not save.");
              return;
            }
            Object.keys(row).forEach(function (k) {
              e[k] = row[k];
            });
            render();
            openEstimate(e.id);
          });
      }
      if (edit) {
        var sp = el("span");
        sp.appendChild(
          btn("Client said yes", "btn alt sm", function () {
            setStatus("accepted", {
              responded_at: new Date().toISOString(),
              response_name: "Recorded by our team"
            });
          })
        );
        sp.appendChild(document.createTextNode(" "));
        sp.appendChild(
          btn("Client said no", "btn alt sm", function () {
            setStatus("declined", {
              responded_at: new Date().toISOString(),
              response_name: "Recorded by our team"
            });
          })
        );
        dz.appendChild(sp);
      } else
        dz.appendChild(
          btn("Reopen", "btn alt sm", function () {
            setStatus("sent", { responded_at: null, response_name: "", response_note: "" });
          })
        );
      dz.appendChild(
        btn("Delete", "btn danger", function () {
          if (!confirm("Delete this estimate for good? Its link stops working.")) return;
          sb.from("estimates")
            .delete()
            .eq("id", e.id)
            .then(function (r2_) {
              if (r2_.error) {
                alert("Could not delete.");
                return;
              }
              estimates = estimates.filter(function (z) {
                return z.id !== e.id;
              });
              closeDetail();
              render();
            });
        })
      );
      body.appendChild(dz);
      if (e.status === "accepted")
        body.appendChild(
          el("div", "note", "Next: add the work under Jobs for this client so it lands on the schedule.")
        );
    });
}
function setEstTotal(e, total, cb) {
  sb.from("estimates")
    .update({ total: total })
    .eq("id", e.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not update the total.");
        return;
      }
      e.total = total;
      render();
      cb();
    });
}

/* ======================= crm/src/24-inventory.js ======================= */
/* Inventory tab: Excel-style sheets, categories, colors and columns. */

/* ---- Inventory: Excel-style sheets with your own categories and columns ---- */
var INV_PRESETS = [
  ["Blank sheet", ["Item", "Qty", "Notes"]],
  ["Equipment", ["Item", "Qty", "Serial number", "Condition", "Location", "Notes"]],
  ["Supplies", ["Item", "Qty", "Unit", "Min", "Cost", "Location"]],
  [
    "Equipment & vehicles (brand, model, serial, VIN)",
    ["Brand", "Model", "Model #", "Serial #", "Price", "Purchase Date", "Vin #", "Plate", "Year"]
  ]
];
function invKey() {
  return "c" + Math.random().toString(36).slice(2, 8);
}
function invColType(n) {
  return /^(qty|quantity|min|cost|price|paid|count|totals?( for each)?|amount|hours)$/i.test(n)
    ? "number"
    : "text";
}
function invCols(c) {
  return Array.isArray(c.columns) ? c.columns : [];
}
function invRows(c) {
  return invItems
    .filter(function (r) {
      return r.cat_id === c.id;
    })
    .sort(function (a, b) {
      return (a.sort || 0) - (b.sort || 0) || (String(a.created_at) < String(b.created_at) ? -1 : 1);
    });
}
function invVal(r, k) {
  var v = r.data && r.data[k];
  return v == null ? "" : String(v);
}
function invNumber(x) {
  var t = String(x == null ? "" : x).replace(/[$,\s]/g, "");
  return /^-?\d*\.?\d+$/.test(t) ? parseFloat(t) : null;
}
function invHay(c, r) {
  return (
    c.name +
    " inventory " +
    invCols(c)
      .map(function (x) {
        return invVal(r, x.k);
      })
      .join(" ")
  ).toLowerCase();
}
function invToks(q) {
  return String(q || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}
function invHas(c, r, t) {
  var h = invHay(c, r);
  return t.every(function (x) {
    return h.indexOf(x) > -1;
  });
}
function invTitle(c, r) {
  var cols = invCols(c);
  for (var i = 0; i < cols.length; i++) {
    var v = invVal(r, cols[i].k);
    if (v) return v;
  }
  return "(empty row)";
}
function invVisible() {
  return invCats.filter(function (c) {
    return !c.kind;
  });
}
/* Colour code per category: 24 distinct colours (12 light with dark text, 12 dark with white text; every pair is at least 6.5:1 contrast). */
var INV_COLORS = [
  ["Yellow", "#fde68a", "#1f2a1f"],
  ["Orange", "#fdba74", "#1f2a1f"],
  ["Pink", "#f9a8d4", "#1f2a1f"],
  ["Lavender", "#d8b4fe", "#1f2a1f"],
  ["Sky", "#93c5fd", "#1f2a1f"],
  ["Mint", "#86efac", "#1f2a1f"],
  ["Aqua", "#67e8f9", "#1f2a1f"],
  ["Lime", "#d9f99d", "#1f2a1f"],
  ["Rose", "#fecaca", "#1f2a1f"],
  ["Sand", "#e7d3a7", "#1f2a1f"],
  ["Periwinkle", "#c7d2fe", "#1f2a1f"],
  ["Seafoam", "#99f6e4", "#1f2a1f"],
  ["Navy", "#1e3a8a", "#ffffff"],
  ["Forest", "#166534", "#ffffff"],
  ["Maroon", "#7f1d1d", "#ffffff"],
  ["Purple", "#581c87", "#ffffff"],
  ["Teal", "#115e59", "#ffffff"],
  ["Brown", "#78350f", "#ffffff"],
  ["Magenta", "#9d174d", "#ffffff"],
  ["Slate", "#334155", "#ffffff"],
  ["Olive", "#4d5d0f", "#ffffff"],
  ["Red", "#b91c1c", "#ffffff"],
  ["Indigo", "#3730a3", "#ffffff"],
  ["Rust", "#9a3412", "#ffffff"]
];
function invPal(name) {
  return INV_COLORS.filter(function (x) {
    return x[0] === name;
  })[0];
}
/* Chosen colour if saved, otherwise the first colour nobody else is using (same order every time). */
function invColorMap() {
  var vis = invVisible()
      .slice()
      .sort(function (a, b) {
        return (
          String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
          (a.sort || 0) - (b.sort || 0)
        );
      }),
    used = {},
    m = {};
  vis.forEach(function (c) {
    if (invPal(c.color) && !used[c.color]) {
      used[c.color] = 1;
      m[c.id] = invPal(c.color);
    }
  });
  vis.forEach(function (c) {
    if (m[c.id]) return;
    var f =
      INV_COLORS.filter(function (x) {
        return !used[x[0]];
      })[0] || INV_COLORS[Object.keys(m).length % INV_COLORS.length];
    used[f[0]] = 1;
    m[c.id] = f;
  });
  return m;
}
function invCol_(c) {
  return invColorMap()[c.id] || INV_COLORS[0];
}
function invTint(k, solid) {
  if (solid) return k[1];
  var a = k[2] === "#ffffff" ? 0.2 : 0.5,
    h = k[1],
    r = parseInt(h.substr(1, 2), 16),
    g = parseInt(h.substr(3, 2), 16),
    b = parseInt(h.substr(5, 2), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}
/* Muted look: a see-through tint with normal dark text, plus a thin solid edge in the full colour. Never touches the cell's own grid-line border. */
function invPaint(node, c, pill) {
  var k = invCol_(c);
  node.style.background = invTint(k);
  node.style.color = "#1f2a1f";
  if (pill) node.style.borderColor = k[1];
  else node.style.boxShadow = "inset 4px 0 0 " + k[1];
  return node;
}
/* Save the automatic colours so they never change when a category is added or deleted (needs the Stage 14 column). */
function ensureInvColors() {
  if (!invCats.length || !("color" in invCats[0])) return;
  var m = invColorMap();
  invVisible().forEach(function (c) {
    if (invPal(c.color)) return;
    var k = m[c.id];
    if (!k) return;
    c.color = k[0];
    sb.from("inventory_cats")
      .update({ color: k[0] })
      .eq("id", c.id)
      .then(function () {});
  });
}
function renderInventory() {
  var tabs = $("tabs");
  tabs.textContent = "";
  var list = $("list");
  list.textContent = "";
  $("topbtns").appendChild(btn("+ New category", "btn", openInvCatForm));
  if (invErr) {
    list.appendChild(
      el(
        "div",
        "empty",
        "Inventory isn't set up yet. Run the Stage 12 SQL in Supabase (SQL Editor), then press Refresh."
      )
    );
    return;
  }
  var vis = invVisible();
  if (!vis.length) {
    list.appendChild(
      el(
        "div",
        "empty",
        "No inventory yet. Tap New category to start a sheet, for example Equipment, Supplies, or Fuel & Oil."
      )
    );
    return;
  }
  if (invCat !== "all" && !byId(vis, invCat)) invCat = "all";
  var tb = [];
  function paintTabs() {
    var on = invToks(invq).length === 0;
    tb.forEach(function (x) {
      x[1].className =
        "tab" +
        (x[0].id === "all" ? "" : " ctab") +
        ((x[0].id === "all" ? invCat === "all" : on && x[0].id === invCat) ? " on" : "");
    });
  }
  var ab_ = el("button", "tab", "All inventory");
  ab_.type = "button";
  ab_.appendChild(
    el(
      "span",
      null,
      "(" +
        invItems.filter(function (r) {
          return vis.some(function (c) {
            return c.id === r.cat_id;
          });
        }).length +
        ")"
    )
  );
  ab_.addEventListener("click", function () {
    invCat = "all";
    render();
  });
  tabs.appendChild(ab_);
  tb.push([{ id: "all" }, ab_]);
  vis.forEach(function (c) {
    var n = invItems.filter(function (r) {
        return r.cat_id === c.id;
      }).length,
      b = el("button", "tab", c.name);
    b.type = "button";
    b.appendChild(el("span", null, "(" + n + ")"));
    invPaint(b, c, true);
    b.addEventListener("click", function () {
      invCat = c.id;
      invq = "";
      render();
    });
    tabs.appendChild(b);
    tb.push([c, b]);
  });
  ensureInvColors();
  var bar = el("div", "invbar"),
    si = document.createElement("input");
  si.type = "search";
  si.placeholder = "Search inventory: items, categories, notes...";
  si.value = invq;
  si.setAttribute("aria-label", "Search inventory");
  bar.appendChild(si);
  if (invCat !== "all")
    bar.appendChild(
      btn("Sheet settings", "btn alt sm", function () {
        var c = byId(invCats, invCat);
        if (c) openInvCat(c);
      })
    );
  var yr = new Date().getFullYear();
  bar.appendChild(invLegend(yr));
  list.appendChild(bar);
  var body = el("div");
  list.appendChild(body);
  si.addEventListener("input", function () {
    invq = si.value;
    paintTabs();
    drawInvBody(body);
  });
  paintTabs();
  drawInvBody(body);
}
function drawInvBody(body) {
  body.textContent = "";
  var t = invToks(invq);
  if (invCat === "all") {
    body.appendChild(invAllGrid(invVisible(), t));
    return;
  }
  if (t.length) {
    var any = false;
    invVisible().forEach(function (c) {
      var rows = invRows(c).filter(function (r) {
        return invHas(c, r, t);
      });
      if (!rows.length) return;
      any = true;
      var h = el(
        "div",
        null,
        c.name + " · " + rows.length + " match" + (rows.length > 1 ? "es" : "") + " (tap to open this sheet)"
      );
      h.style.cssText = "font-weight:700;margin:14px 0 4px;cursor:pointer;padding:8px 14px;border-radius:8px";
      invPaint(h, c);
      h.addEventListener("click", function () {
        invCat = c.id;
        invq = "";
        render();
      });
      body.appendChild(h);
      body.appendChild(invGrid(c, rows, true));
    });
    if (!any) body.appendChild(el("div", "empty", "Nothing in your inventory matches that."));
    return;
  }
  var c = byId(invVisible(), invCat);
  if (c) {
    var hd = el(
      "div",
      "invhead",
      c.name + " · " + invRows(c).length + " item" + (invRows(c).length === 1 ? "" : "s")
    );
    invPaint(hd, c);
    body.appendChild(hd);
    body.appendChild(invGrid(c, invRows(c), false));
  }
}
/* "All inventory": every item from every category in one sheet. Columns are matched by name; a cell is greyed out when an item's category doesn't have that column. */
/* The All sheet shows only these columns. Older names in your category sheets are matched to them (Series->Model, Paid / Purchase Price->Price, Purchased->Purchase Date, VIN->Vin #). */
var ALL_COLS = [
  ["Brand", ["brand"], "text"],
  ["Model", ["model", "series"], "text"],
  ["Model #", ["model #", "model no", "model no.", "model number"], "text"],
  ["Serial #", ["serial #", "serial no", "serial no.", "serial number"], "text"],
  ["Price", ["price", "purchase price", "paid", "cost"], "number"],
  ["Purchase Date", ["purchase date", "purchased", "purcased", "purchased on", "date purchased"], "text"],
  ["Vin #", ["vin #", "vin", "vin no", "vin number"], "text"],
  ["Plate", ["plate", "plate #", "license plate", "tag"], "text"],
  ["Year", ["year"], "text"]
];
function invNorm(n) {
  return String(n || "")
    .toLowerCase()
    .replace(/\s*#\s*/g, " # ")
    .replace(/\s+/g, " ")
    .trim();
}
function invAllCol(c, k, r) {
  var a = ALL_COLS.filter(function (x) {
      return x[0].toLowerCase() === k;
    })[0],
    cols = invCols(c),
    m = [];
  if (!a) return null;
  a[1].forEach(function (al) {
    cols.forEach(function (x) {
      if (invNorm(x.n) === al && m.indexOf(x) < 0) m.push(x);
    });
  });
  if (r) for (var i = 0; i < m.length; i++) if (invVal(r, m[i].k) !== "") return m[i];
  return m[0] || null;
}
function invAllGrid(cats, t) {
  var names = ALL_COLS.map(function (x) {
      return x[0].toLowerCase();
    }),
    info = {};
  ALL_COLS.forEach(function (x) {
    info[x[0].toLowerCase()] = { n: x[0], t: x[2] };
  });
  var rows = [];
  cats.forEach(function (c) {
    invRows(c).forEach(function (r) {
      if (!t.length || invHas(c, r, t)) rows.push([c, r]);
    });
  });
  var box = el("div"),
    wrap = el("div", "invwrap"),
    tbl = document.createElement("table");
  tbl.className = "invgrid";
  function cellOf(c, k, r) {
    return invAllCol(c, k, r);
  }
  if (invSort && invSort.cat === "all") {
    var sk = invSort.k;
    rows.sort(function (a, b) {
      var x, y, r;
      if (sk === "__cat") {
        x = a[0].name.toLowerCase();
        y = b[0].name.toLowerCase();
      } else {
        var ca = cellOf(a[0], sk, a[1]),
          cb = cellOf(b[0], sk, b[1]);
        x = ca ? invVal(a[1], ca.k) : "";
        y = cb ? invVal(b[1], cb.k) : "";
        if (info[sk].t === "number") {
          var nx = invNumber(x),
            ny = invNumber(y);
          if (nx == null || ny == null) return nx == null && ny == null ? 0 : nx == null ? 1 : -1;
          return invSort.dir * (nx - ny);
        }
        x = x.toLowerCase();
        y = y.toLowerCase();
      }
      r = x < y ? -1 : x > y ? 1 : 0;
      return invSort.dir * r;
    });
  }
  var hr = document.createElement("tr");
  hr.appendChild(el("th", "rn", "#"));
  function head(label, k, num) {
    var th = document.createElement("th");
    if (num) th.className = "num";
    var cur = invSort && invSort.cat === "all" && invSort.k === k;
    var b = btn(label + (cur ? (invSort.dir > 0 ? " ▲" : " ▼") : ""), "hcol", function () {
      invSort = cur ? (invSort.dir > 0 ? { cat: "all", k: k, dir: -1 } : null) : { cat: "all", k: k, dir: 1 };
      render();
    });
    b.title = "Click to sort";
    th.appendChild(b);
    hr.appendChild(th);
  }
  head("Category", "__cat", false);
  names.forEach(function (k) {
    head(info[k].n, k, info[k].t === "number");
  });
  hr.appendChild(el("th", "xc", ""));
  var th_ = document.createElement("thead");
  th_.appendChild(hr);
  tbl.appendChild(th_);
  var tb = document.createElement("tbody");
  rows.forEach(function (x, ri) {
    var c = x[0],
      r = x[1],
      tr = document.createElement("tr");
    tr.appendChild(el("td", "rn", String(ri + 1)));
    var cd = document.createElement("td"),
      cb = btn(c.name, "hcol", function () {
        invCat = c.id;
        invq = "";
        render();
      });
    cb.title = "Open the " + c.name + " sheet";
    cb.className = "hcol";
    cb.style.cssText =
      "display:block;width:100%;height:100%;min-height:36px;padding:8px 10px;text-align:left;background:transparent;color:inherit;border:0;border-radius:0;cursor:pointer;font:inherit;font-weight:700";
    invPaint(cd, c);
    cd.style.padding = "0";
    cd.dataset.cat = "1";
    cd.appendChild(cb);
    tr.appendChild(cd);
    var isOld = invIsOld(c, r);
    names.forEach(function (k) {
      var td = document.createElement("td"),
        col = cellOf(c, k, r);
      if (!col) {
        td.style.background = isOld ? OLD_RED : "#f1f3f0";
        td.dataset.grey = "1";
        tr.appendChild(td);
        return;
      }
      var inp = document.createElement("input");
      inp.type = "text";
      inp.value = invVal(r, col.k);
      inp.dataset.v = inp.value;
      inp.dataset.r = r.id;
      inp.dataset.k = col.k;
      inp.dataset.n = k;
      inp.setAttribute("aria-label", info[k].n);
      inp.autocomplete = "off";
      if (col.t === "number") {
        inp.inputMode = "decimal";
        inp.className = "num";
      }
      inp.addEventListener("change", function () {
        invCommit(inp);
      });
      inp.addEventListener("focus", function () {
        inp.select();
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        var all = Array.prototype.slice.call(tbl.querySelectorAll('tbody input[data-n="' + k + '"]')),
          i = all.indexOf(inp),
          n = all[e.key === "ArrowUp" ? i - 1 : i + 1];
        if (n) n.focus();
      });
      if (isOld) td.style.background = OLD_RED;
      td.appendChild(inp);
      tr.appendChild(td);
    });
    var xd = el("td", "xc"),
      xb = btn("×", "hgear", function () {
        var has = invCols(c).some(function (col) {
          return invVal(r, col.k);
        });
        if (has && !confirm("Delete this item?")) return;
        sb.from("inventory_items")
          .delete()
          .eq("id", r.id)
          .then(function (res) {
            if (res.error) {
              alert("Could not delete.");
              return;
            }
            invItems = invItems.filter(function (z) {
              return z.id !== r.id;
            });
            render();
          });
      });
    xb.setAttribute("aria-label", "Delete row");
    xb.style.color = "var(--red)";
    xd.appendChild(xb);
    if (isOld) xd.style.background = OLD_RED;
    tr.appendChild(xd);
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  var tf = document.createElement("tfoot"),
    fr = document.createElement("tr");
  fr.appendChild(el("td", "rn", "Σ"));
  var ft = el("td", "foot", "Overall total · " + rows.length + " item" + (rows.length === 1 ? "" : "s"));
  fr.appendChild(ft);
  for (var i = 0; i < names.length; i++) fr.appendChild(el("td", "foot", ""));
  fr.appendChild(el("td", "xc", ""));
  tf.appendChild(fr);
  tbl.appendChild(tf);
  wrap.appendChild(tbl);
  box.appendChild(wrap);
  if (!rows.length)
    box.appendChild(
      el(
        "div",
        "empty",
        t.length
          ? "Nothing in your inventory matches that."
          : "No items yet. Open a category tab and add a row, or add one below."
      )
    );
  var acts = el("div", "invacts"),
    sel = document.createElement("select");
  sel.style.cssText = "width:auto";
  cats.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
  acts.appendChild(el("span", "note", "Add an item to:"));
  acts.appendChild(sel);
  acts.appendChild(
    btn("+ Add row", "btn sm", function () {
      var c = byId(cats, sel.value);
      if (!c) return;
      invq = "";
      invCat = c.id;
      addInvRow(c);
    })
  );
  acts.appendChild(
    el(
      "span",
      "note",
      "Shows Brand, Model, Model #, Serial #, Price, Purchase Date, Vin #, Plate and Year. Other columns are on each category's own sheet. Greyed cells mean that category has no such column. Click a category to open its sheet."
    )
  );
  box.appendChild(acts);
  return box;
}
function invCommit(inp) {
  if (inp.value === inp.dataset.v) return Promise.resolve();
  var r = byId(invItems, inp.dataset.r),
    c = r && byId(invCats, r.cat_id),
    col =
      c &&
      invCols(c).filter(function (x) {
        return x.k === inp.dataset.k;
      })[0];
  if (!col) return Promise.resolve();
  var val = inp.value.trim(),
    d = Object.assign({}, r.data),
    n = invNumber(val);
  d[col.k] = col.t === "number" && n != null ? n : val;
  inp.dataset.v = inp.value;
  return sb
    .from("inventory_items")
    .update({ data: d, updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .then(function (res) {
      if (res.error) {
        inp.dataset.v = "\u0000";
        alert("Could not save that cell. Check your connection and try again.");
        return;
      }
      r.data = d;
      var t = inp.closest("table");
      if (t && t._foot) t._foot();
      var trr = inp.closest("tr");
      if (trr) invTintRow(trr, invIsOld(c, r));
    });
}
function addInvRow(c, fk) {
  var mx = invRows(c).reduce(function (m, r) {
    return Math.max(m, r.sort || 0);
  }, 0);
  return sb
    .from("inventory_items")
    .insert({ cat_id: c.id, data: {}, sort: mx + 1 })
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data) {
        alert("Could not add a row.");
        return;
      }
      invItems.push(r.data);
      invFocus = { id: r.data.id, k: fk || (invCols(c)[0] || {}).k };
      render();
    });
}
function invPaste(c, vr, startRow, startCol, txt) {
  var cols = invCols(c),
    lines = txt
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map(function (l) {
        return l.split("\t");
      }),
    ci = cols.indexOf(startCol),
    ri = vr.indexOf(startRow);
  var mx = invRows(c).reduce(function (m, r) {
      return Math.max(m, r.sort || 0);
    }, 0),
    ups = [],
    news = [];
  lines.forEach(function (cells, i) {
    var row = vr[ri + i],
      d = row ? Object.assign({}, row.data) : {};
    cells.forEach(function (v, j) {
      var col = cols[ci + j];
      if (!col) return;
      v = v.trim();
      var n = invNumber(v);
      d[col.k] = col.t === "number" && n != null ? n : v;
    });
    if (row) ups.push([row, d]);
    else news.push({ cat_id: c.id, data: d, sort: ++mx });
  });
  var jobs_ = ups.map(function (u) {
    return sb
      .from("inventory_items")
      .update({ data: u[1], updated_at: new Date().toISOString() })
      .eq("id", u[0].id)
      .then(function (r) {
        if (!r.error) u[0].data = u[1];
        return r.error;
      });
  });
  if (news.length)
    jobs_.push(
      sb
        .from("inventory_items")
        .insert(news)
        .select()
        .then(function (r) {
          if (!r.error && r.data)
            r.data.forEach(function (x) {
              invItems.push(x);
            });
          return r.error;
        })
    );
  Promise.all(jobs_).then(function (errs) {
    if (errs.some(Boolean)) alert("Some pasted cells could not be saved.");
    render();
  });
}
function invGrid(c, rows, searching) {
  var cols = invCols(c),
    box = el("div"),
    wrap = el("div", "invwrap"),
    t = document.createElement("table");
  t.className = "invgrid";
  var vr = rows.slice();
  if (invSort && invSort.cat === c.id) {
    var sc = cols.filter(function (x) {
      return x.k === invSort.k;
    })[0];
    if (sc)
      vr.sort(function (a, b) {
        var x = invVal(a, sc.k),
          y = invVal(b, sc.k),
          r;
        if (sc.t === "number") {
          var nx = invNumber(x),
            ny = invNumber(y);
          r = nx == null && ny == null ? 0 : nx == null ? 1 : ny == null ? -1 : nx - ny;
          if (nx == null || ny == null) return r;
        } else {
          x = x.toLowerCase();
          y = y.toLowerCase();
          r = x < y ? -1 : x > y ? 1 : 0;
        }
        return invSort.dir * r;
      });
  }
  var hr = document.createElement("tr");
  hr.appendChild(el("th", "rn", "#"));
  cols.forEach(function (col) {
    var th = document.createElement("th"),
      cur = invSort && invSort.cat === c.id && invSort.k === col.k;
    if (col.t === "number") th.className = "num";
    var sbtn = btn(col.n + (cur ? (invSort.dir > 0 ? " ▲" : " ▼") : ""), "hcol", function () {
      invSort = cur
        ? invSort.dir > 0
          ? { cat: c.id, k: col.k, dir: -1 }
          : null
        : { cat: c.id, k: col.k, dir: 1 };
      render();
    });
    sbtn.title = "Click to sort";
    th.appendChild(sbtn);
    var g = btn("⋯", "hgear", function () {
      openInvCol(c, col);
    });
    g.setAttribute("aria-label", "Column settings: " + col.n);
    g.title = "Column settings";
    th.appendChild(g);
    hr.appendChild(th);
  });
  hr.appendChild(el("th", "xc", ""));
  var th_ = document.createElement("thead");
  th_.appendChild(hr);
  t.appendChild(th_);
  var qtyCol = cols.filter(function (x) {
      return /^(qty|quantity)$/i.test(x.n);
    })[0],
    minCol = cols.filter(function (x) {
      return /^min/i.test(x.n);
    })[0];
  var tb = document.createElement("tbody");
  vr.forEach(function (r, ri) {
    var tr = document.createElement("tr");
    tr.appendChild(el("td", "rn", String(ri + 1)));
    var oldRow = invIsOld(c, r);
    cols.forEach(function (col) {
      var td = document.createElement("td"),
        inp = document.createElement("input");
      inp.type = "text";
      inp.value = invVal(r, col.k);
      inp.dataset.v = inp.value;
      inp.dataset.r = r.id;
      inp.dataset.k = col.k;
      inp.setAttribute("aria-label", col.n);
      inp.autocomplete = "off";
      if (col.t === "number") {
        inp.inputMode = "decimal";
        inp.className = "num";
      }
      if (qtyCol && minCol && col.k === qtyCol.k) {
        var q = invNumber(invVal(r, qtyCol.k)),
          m = invNumber(invVal(r, minCol.k));
        if (q != null && m != null && q <= m) {
          inp.className += " low";
          inp.title = "At or below the minimum";
        }
      }
      inp.addEventListener("change", function () {
        invCommit(inp);
      });
      inp.addEventListener("focus", function () {
        inp.select();
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        var trs = t.querySelectorAll("tbody tr"),
          idx = Array.prototype.indexOf.call(trs, tr),
          nr = trs[e.key === "ArrowUp" ? idx - 1 : idx + 1];
        if (nr) {
          var ni = nr.querySelector('input[data-k="' + col.k + '"]');
          if (ni) ni.focus();
          return;
        }
        if (e.key === "Enter" && !searching)
          Promise.resolve(invCommit(inp)).then(function () {
            addInvRow(c, col.k);
          });
      });
      inp.addEventListener("paste", function (e) {
        var txt = (e.clipboardData || window.clipboardData).getData("text") || "";
        if (!/[\t\n]/.test(txt.replace(/\r?\n$/, ""))) return;
        e.preventDefault();
        invPaste(c, vr, r, col, txt);
      });
      if (oldRow) td.style.background = OLD_RED;
      td.appendChild(inp);
      tr.appendChild(td);
    });
    var xd = el("td", "xc"),
      x = btn("×", "hgear", function () {
        var has = cols.some(function (col) {
          return invVal(r, col.k);
        });
        if (has && !confirm("Delete this row?")) return;
        sb.from("inventory_items")
          .delete()
          .eq("id", r.id)
          .then(function (res) {
            if (res.error) {
              alert("Could not delete the row.");
              return;
            }
            invItems = invItems.filter(function (z) {
              return z.id !== r.id;
            });
            render();
          });
      });
    x.setAttribute("aria-label", "Delete row");
    x.title = "Delete row";
    x.style.color = "var(--red)";
    xd.appendChild(x);
    if (oldRow) xd.style.background = OLD_RED;
    tr.appendChild(xd);
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  var tf = document.createElement("tfoot"),
    fr = document.createElement("tr"),
    fc = {};
  fr.appendChild(el("td", "rn", "Σ"));
  cols.forEach(function (col) {
    var td = document.createElement("td");
    td.className = "foot" + (col.t === "number" ? " num" : "");
    fc[col.k] = td;
    fr.appendChild(td);
  });
  fr.appendChild(el("td", "xc", ""));
  tf.appendChild(fr);
  t.appendChild(tf);
  t._foot = function () {
    cols.forEach(function (col, i) {
      var td = fc[col.k];
      if (col.t === "number") {
        var sum = 0,
          n = 0;
        vr.forEach(function (r) {
          var v = invNumber(invVal(r, col.k));
          if (v != null) {
            sum += v;
            n++;
          }
        });
        td.textContent = n ? String(Math.round(sum * 100) / 100) : "";
      } else
        td.textContent =
          i === 0 ? "Overall total · " + vr.length + " row" + (vr.length === 1 ? "" : "s") : "";
    });
  };
  t._foot();
  wrap.appendChild(t);
  box.appendChild(wrap);
  if (!searching) {
    var acts = el("div", "invacts");
    acts.appendChild(
      btn("+ Add row", "btn sm", function () {
        addInvRow(c);
      })
    );
    acts.appendChild(
      btn("+ Add column", "btn alt sm", function () {
        openInvCol(c, null);
      })
    );
    acts.appendChild(
      el(
        "span",
        "note",
        "Tip: press Enter to move down (and add a row at the bottom), or paste straight from Excel or Google Sheets."
      )
    );
    box.appendChild(acts);
  }
  if (invFocus) {
    var f = invFocus;
    invFocus = null;
    setTimeout(function () {
      var i = t.querySelector('input[data-r="' + f.id + '"][data-k="' + f.k + '"]');
      if (i) i.focus();
    }, 0);
  }
  return box;
}
function saveCols(c, cols) {
  sb.from("inventory_cats")
    .update({ columns: cols })
    .eq("id", c.id)
    .then(function (r) {
      if (r.error) {
        alert("Could not save.");
        return;
      }
      c.columns = cols;
      closeDetail();
      render();
    });
}
function openInvCol(c, col) {
  var p = panel(),
    cols = invCols(c).slice(),
    isNew = !col;
  p.appendChild(el("h2", null, isNew ? "Add a column" : "Column settings"));
  var nm = fld("Column name", "text", isNew ? "" : col.n),
    ty = fld("Type (number columns get a total at the bottom)", "select", isNew ? "text" : col.t, [
      ["text", "Text"],
      ["number", "Number"]
    ]);
  p.appendChild(nm);
  p.appendChild(ty);
  var sv = btn(isNew ? "Add column" : "Save", "btn", function () {
    var n = nm.input.value.trim();
    if (!n) {
      alert("Give the column a name.");
      return;
    }
    if (
      cols.some(function (x) {
        return x !== col && x.n.toLowerCase() === n.toLowerCase();
      })
    ) {
      alert("You already have a column with that name.");
      return;
    }
    if (isNew) cols.push({ k: invKey(), n: n, t: ty.input.value });
    else cols[cols.indexOf(col)] = { k: col.k, n: n, t: ty.input.value };
    saveCols(c, cols);
  });
  sv.style.marginTop = "10px";
  p.appendChild(sv);
  if (!isNew) {
    var i = cols.indexOf(col),
      mv = el("div", "contact");
    mv.style.marginTop = "14px";
    function move(d) {
      var a = cols.slice(),
        x = a.splice(i, 1)[0];
      a.splice(i + d, 0, x);
      saveCols(c, a);
    }
    if (i > 0)
      mv.appendChild(
        btn("← Move left", "btn alt sm", function () {
          move(-1);
        })
      );
    if (i < cols.length - 1)
      mv.appendChild(
        btn("Move right →", "btn alt sm", function () {
          move(1);
        })
      );
    p.appendChild(mv);
    if (cols.length > 1) {
      var dz = el("div", "actions");
      dz.style.marginTop = "18px";
      dz.appendChild(el("span"));
      dz.appendChild(
        btn("Delete column", "btn danger", function () {
          if (!confirm('Delete the "' + col.n + '" column? Its values are removed from view.')) return;
          saveCols(
            c,
            cols.filter(function (x) {
              return x !== col;
            })
          );
        })
      );
      p.appendChild(dz);
    }
  }
}
function makeSheet(name, pre, kind) {
  var cols = pre[1].map(function (x) {
      return { k: invKey(), n: x, t: invColType(x) };
    }),
    mx = invCats.reduce(function (m, x) {
      return Math.max(m, x.sort || 0);
    }, 0);
  return sb
    .from("inventory_cats")
    .insert(
      kind
        ? { name: name, columns: cols, sort: mx + 1, kind: kind }
        : { name: name, columns: cols, sort: mx + 1 }
    )
    .select()
    .single()
    .then(function (r) {
      if (r.error || !r.data)
        return Promise.reject(
          "Could not create it. Did you run the Stage 12" + (kind ? " and Stage 13" : "") + " SQL?"
        );
      var cat = r.data;
      invCats.push(cat);
      var rows = (pre[2] || []).map(function (vals, i) {
        var d = {};
        vals.forEach(function (v, j) {
          if (v) d[cols[j].k] = v;
        });
        return { cat_id: cat.id, data: d, sort: i + 1 };
      });
      if (!rows.length) return cat;
      return sb
        .from("inventory_items")
        .insert(rows)
        .select()
        .then(function (r2_) {
          if (r2_.error)
            return Promise.reject("The sheet was made but its starting rows could not be added.");
          (r2_.data || []).forEach(function (x) {
            invItems.push(x);
          });
          return cat;
        });
    });
}
function openInvCatForm() {
  if (invErr) {
    alert("Run the Stage 12 SQL in Supabase first, then press Refresh.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "New category"));
  p.appendChild(
    el(
      "p",
      "note",
      "A category is a sheet, like a tab in Excel. You can add, rename and reorder columns afterwards."
    )
  );
  var nm = fld("Category name (for example: Equipment, Chemicals, Fuel & Oil)", "text", ""),
    st = fld(
      "Start with",
      "select",
      "3",
      INV_PRESETS.map(function (x, i) {
        return [String(i), x[0] + " (" + x[1].join(", ") + ")"];
      })
    );
  p.appendChild(nm);
  p.appendChild(st);
  var go = btn("Create category", "btn", function () {
    var n = nm.input.value.trim();
    if (!n) {
      alert("Give the category a name.");
      return;
    }
    if (
      invCats.some(function (x) {
        return x.name.toLowerCase() === n.toLowerCase();
      })
    ) {
      alert("You already have a category with that name.");
      return;
    }
    go.disabled = true;
    makeSheet(n, INV_PRESETS[parseInt(st.input.value, 10)]).then(
      function (c) {
        invCat = c.id;
        invq = "";
        closeDetail();
        render();
      },
      function (msg) {
        go.disabled = false;
        alert(msg);
      }
    );
  });
  go.style.marginTop = "12px";
  p.appendChild(go);
}
function openInvCat(c) {
  var p = panel();
  p.appendChild(el("h2", null, c.name + " · sheet settings"));
  var nm = fld("Category name", "text", c.name);
  p.appendChild(nm);
  var sv = btn("Rename", "btn alt sm", function () {
    var n = nm.input.value.trim();
    if (!n) {
      alert("Give it a name.");
      return;
    }
    sb.from("inventory_cats")
      .update({ name: n })
      .eq("id", c.id)
      .then(function (r) {
        if (r.error) {
          alert("Could not save.");
          return;
        }
        c.name = n;
        closeDetail();
        render();
      });
  });
  sv.style.marginTop = "6px";
  p.appendChild(sv);
  var cl = el("div", null);
  cl.style.marginTop = "16px";
  cl.appendChild(el("div", "note", "Colour code (shown on the tab and in the All inventory sheet)"));
  var used = {};
  invVisible().forEach(function (z) {
    if (z.id !== c.id) used[invCol_(z)[0]] = 1;
  });
  var sw = el("div", "swatches"),
    cur = invCol_(c)[0];
  INV_COLORS.forEach(function (k) {
    var b = el("button", "sw" + (k[0] === cur ? " on" : ""), "Aa");
    b.type = "button";
    b.style.background = invTint(k);
    b.style.color = "#1f2a1f";
    b.style.boxShadow = "inset 4px 0 0 " + k[1];
    b.title = k[0] + (used[k[0]] ? " (already used by another category)" : "");
    b.setAttribute("aria-label", k[0]);
    if (used[k[0]]) b.style.opacity = ".45";
    b.addEventListener("click", function () {
      if (used[k[0]] && !confirm("Another category already uses " + k[0] + ". Use it for both?")) return;
      sb.from("inventory_cats")
        .update({ color: k[0] })
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not save the colour. Run the Stage 14 SQL in Supabase first.");
            return;
          }
          c.color = k[0];
          closeDetail();
          render();
        });
    });
    sw.appendChild(b);
  });
  cl.appendChild(sw);
  p.appendChild(cl);
  var ex = btn("Download as CSV (opens in Excel)", "btn alt", function () {
    var cols = invCols(c);
    downloadCsv(
      "inventory-" + c.name.replace(/[^\w-]+/g, "_") + ".csv",
      [
        cols.map(function (x) {
          return x.n;
        })
      ].concat(
        invRows(c).map(function (r) {
          return cols.map(function (x) {
            return invVal(r, x.k);
          });
        })
      )
    );
  });
  ex.style.cssText = "display:block;margin-top:16px";
  p.appendChild(ex);
  var n = invItems.filter(function (r) {
      return r.cat_id === c.id;
    }).length,
    dz = el("div", "actions");
  dz.style.marginTop = "22px";
  dz.appendChild(el("span"));
  dz.appendChild(
    btn("Delete category", "btn danger", function () {
      if (!confirm('Delete "' + c.name + '" and its ' + n + " row" + (n === 1 ? "" : "s") + " for good?"))
        return;
      sb.from("inventory_cats")
        .delete()
        .eq("id", c.id)
        .then(function (r) {
          if (r.error) {
            alert("Could not delete.");
            return;
          }
          invCats = invCats.filter(function (x) {
            return x.id !== c.id;
          });
          invItems = invItems.filter(function (x) {
            return x.cat_id !== c.id;
          });
          invCat = null;
          closeDetail();
          render();
        });
    })
  );
  p.appendChild(dz);
}

})();

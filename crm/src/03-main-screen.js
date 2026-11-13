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
ICONS.more =
  '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>';
var NAV_MAIN = ["schedule", "clients", "jobs", "billing"];
var NAV_LABELS = {
  leads: "Leads",
  clients: "Clients",
  jobs: "Jobs",
  schedule: "Schedule",
  todo: "To-Do",
  billing: "Billing",
  expenses: "Expenses",
  reports: "Reports",
  photos: "Photos",
  inventory: "Inventory",
  personnel: "Personnel",
  team: "Team"
};
function navLabel(v) {
  return NAV_LABELS[v] || "More";
}
function closeMoreSheet() {
  var s = document.getElementById("moresheet");
  if (s) s.remove();
}
function openMoreSheet(items) {
  if (document.getElementById("moresheet")) return closeMoreSheet();
  var sh = el("div");
  sh.id = "moresheet";
  sh.addEventListener("click", function (e) {
    if (e.target === sh) closeMoreSheet();
  });
  var box = el("div", "msbox");
  box.setAttribute("role", "menu");
  box.appendChild(el("div", "mshd", "All sections"));
  var g = el("div", "msgrid");
  items.forEach(function (v) {
    var b = el("button", v[0] === view ? "on" : "");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.innerHTML = ICONS[v[0]];
    b.appendChild(el("span", null, v[1]));
    if (v[2]) b.appendChild(el("span", "badge", String(v[2])));
    b.addEventListener("click", function () {
      view = v[0];
      render();
      window.scrollTo(0, 0);
    });
    g.appendChild(b);
  });
  box.appendChild(g);
  sh.appendChild(box);
  document.body.appendChild(sh);
}
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeMoreSheet();
});
function render() {
  var nav = $("side"),
    moreItems = [],
    moreBadge = 0;
  nav.textContent = "";
  closeMoreSheet();
  $("app").classList.toggle("wide", view === "reports" || view === "inventory" || view === "expenses");
  var tdy = today(),
    stops = visits.filter(function (v) {
      return v.status === "scheduled" && v.scheduled_date === tdy;
    }).length,
    newL = leads.filter(function (l) {
      return l.status === "new";
    }).length;
  [
    ["leads", "Leads", newL, newResponses().length],
    ["clients", "Clients", 0],
    ["jobs", "Jobs", 0],
    ["schedule", "Schedule", stops],
    ["billing", "Billing", invoices.filter(isOverdue).length],
    ["expenses", "Expenses", receiptsToEnter().length],
    ["reports", "Reports", 0],
    ["photos", "Photos", 0],
    ["inventory", "Inventory", 0],
    [
      "todo",
      "To-Do",
      todos.filter(function (t) {
        return !t.done && t.due_date && t.due_date <= tdy;
      }).length
    ]
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
      b.dataset.v = v[0];
      if (v[2]) b.appendChild(el("span", "badge", String(v[2])));
      if (v[3]) {
        var rb = el("span", "badge resp", String(v[3]));
        rb.title = v[3] + (v[3] === 1 ? " new quote response" : " new quote responses");
        b.appendChild(rb);
      }
      b.setAttribute("aria-current", v[0] === view ? "page" : "false");
      if (NAV_MAIN.indexOf(v[0]) >= 0) b.classList.add("pri");
      else {
        moreBadge += (v[2] || 0) + (v[3] || 0);
        moreItems.push(v);
      }
      nav.appendChild(b);
    });
  /* Phones: the bottom bar keeps the four everyday sections and puts the rest under More. */
  var mb = el("button", "more" + (NAV_MAIN.indexOf(view) < 0 ? " on" : ""));
  mb.type = "button";
  mb.innerHTML = ICONS.more;
  mb.appendChild(el("span", null, NAV_MAIN.indexOf(view) < 0 ? navLabel(view) : "More"));
  if (moreBadge) mb.appendChild(el("span", "badge", String(moreBadge)));
  mb.setAttribute("aria-haspopup", "true");
  mb.addEventListener("click", function () {
    openMoreSheet(moreItems);
  });
  nav.appendChild(mb);
  $("topbtns").textContent = "";
  optMark(null);
  [].forEach.call(document.querySelectorAll(".rinbox"), function (x) {
    x.parentNode.removeChild(x);
  });
  // moving to another screen closes whatever is open on the right side
  if (view !== shownView) {
    if (shownView !== null && docked() && $("detail").classList.contains("on") && !$("detail").classList.contains("full")) closeDetail();
    shownView = view;
  }
  // list screens show their cards side by side (as many per line as fit)
  $("list").classList.toggle("cards", ["clients", "jobs", "schedule"].indexOf(view) > -1);
  $("list").className = $("list").className.replace(/\bv-\w+/g, "").trim() + " v-" + view;
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

/* ---- Right-side layout (computers): the screen's list stays on the left; the tab's options (New client, Services, ...)
   are listed down the right side, and forms and details open there under their option. Phones and narrow windows use
   the full-screen panel instead. The New quote / New invoice window opens full screen because it needs the room
   for its live preview. ---- */
var DOCK_TEST = true,
  DOCK_MIN = 1200;
function docked() {
  return DOCK_TEST && window.innerWidth >= DOCK_MIN;
}
function dockLayout() {
  var on = docked(),
    rc = $("rightcol"),
    top = document.querySelector("#app .top") || (rc && rc.querySelector(".top")),
    d = $("detail");
  document.body.classList.toggle("dock", on);
  if (!rc) {
    rc = el("aside", null);
    rc.id = "rightcol";
    rc.appendChild(el("div", "rch", "Options"));
    $("layout").appendChild(rc);
  }
  if (on) {
    if (top && top.parentNode !== rc) rc.insertBefore(top, rc.children[1] || null);
    if (!d.classList.contains("full") && d.parentNode !== rc) rc.appendChild(d);
  } else {
    if (top && top.parentNode === rc) $("app").insertBefore(top, $("msg"));
    if (d.parentNode !== document.body) document.body.appendChild(d);
  }
}
// the New quote / New invoice window takes the whole screen
function detailFull(full) {
  var d = $("detail");
  d.classList.toggle("full", !!full);
  if (full && d.parentNode !== document.body) document.body.appendChild(d);
  if (!full) dockLayout();
}
window.addEventListener("resize", dockLayout);
dockLayout();
var shownView = null,
  optOpen = null;
function optMark(b) {
  if (optOpen && optOpen !== b) {
    optOpen.classList.remove("on");
    if (optOpen.dataset.lbl) optOpen.textContent = optOpen.dataset.lbl;
  }
  optOpen = b;
  // the open option's form shows right under it: options after it move below the form
  var after = false;
  [].forEach.call($("topbtns").children, function (x) {
    x.style.order = after ? "3" : "";
    if (x === b) after = true;
  });
  if (!b) return;
  b.classList.add("on");
  if (!b.dataset.lbl) b.dataset.lbl = b.textContent;
  if (/^\+\s/.test(b.dataset.lbl)) b.textContent = "\u2212 " + b.dataset.lbl.replace(/^\+\s*/, "");
}
$("topbtns").addEventListener(
  "click",
  function (e) {
    if (!docked()) return;
    var b = e.target.closest("#topbtns > *");
    if (!b) return;
    if (b === optOpen && $("detail").classList.contains("on")) {
      e.preventDefault();
      e.stopPropagation();
      closeDetail();
      return;
    }
    setTimeout(function () {
      var d = $("detail");
      if (d.classList.contains("on") && !d.classList.contains("full")) optMark(b);
    }, 0);
  },
  true
);

/* ---- panel helpers ---- */
function panel() {
  if (typeof hideReceiptViewer === "function") hideReceiptViewer();
  var p = $("panel");
  p.textContent = "";
  p.classList.remove("withprev");
  p.classList.remove("pop");
  panelDirty = false;
  detailFull(false);
  optMark(null);
  lpFrame = null;
  p.appendChild(btn("×", "close", closeDetail)).setAttribute("aria-label", "Close");
  $("detail").classList.add("on");
  p.scrollTop = 0;
  $("detail").scrollTop = 0;
  return p;
}
/* ---- gear menus: editing options (Edit, Delete, Remove...) stay tucked behind a small gear until it is pressed ---- */
var GEAR_SVG =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
var gearOpen = null;
function gearClose() {
  if (gearOpen) {
    gearOpen.classList.remove("on");
    gearOpen = null;
  }
}
function gearMenu(label) {
  var w = el("span", "gearwrap"),
    g = el("button", "gearbtn"),
    m = el("div", "gearmenu");
  g.type = "button";
  g.innerHTML = GEAR_SVG;
  g.setAttribute("aria-label", label || "Edit options");
  g.title = label || "Edit options";
  g.addEventListener("click", function (e) {
    e.stopPropagation();
    if (gearOpen === w) return gearClose();
    gearClose();
    w.classList.add("on");
    gearOpen = w;
    var r = g.getBoundingClientRect(),
      mw = m.offsetWidth,
      mh = m.offsetHeight,
      x = Math.min(Math.max(8, r.right - mw), window.innerWidth - mw - 8),
      y = r.bottom + 4;
    if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    m.style.left = x + "px";
    m.style.top = y + "px";
  });
  w.appendChild(g);
  w.appendChild(m);
  w.menu = m;
  return w;
}
document.addEventListener("click", function () {
  gearClose();
});
window.addEventListener("resize", gearClose);
document.addEventListener("scroll", gearClose, true);
var GEAR_WORDS = /^(Edit|Delete|Remove|Rename|Make main)\b/;
function gearify() {
  var groups = [];
  [].forEach.call(document.querySelectorAll("#app button.btn.sm,#panel button.btn.sm,#rightcol button.btn.sm"), function (b) {
    if (b.closest(".gearmenu") || b.closest(".actions") || b.hidden) return;
    if (!GEAR_WORDS.test((b.textContent || "").trim())) return;
    var par = b.parentNode,
      g = null;
    groups.forEach(function (x) {
      if (x.par === par) g = x;
    });
    if (!g) groups.push((g = { par: par, bs: [] }));
    g.bs.push(b);
  });
  groups.forEach(function (g) {
    var w = gearMenu(),
      card = g.par.closest ? g.par.closest(".pcard,.rcard,.row,.card") : null;
    if (card && !card.querySelector(":scope > .gearwrap.gcorner")) {
      // the gear sits in the top right corner of the card it belongs to
      w.classList.add("gcorner");
      card.classList.add("hasgear");
      card.insertBefore(w, card.firstChild);
    } else g.par.insertBefore(w, g.bs[0]);
    g.bs.forEach(function (b) {
      w.menu.appendChild(b);
    });
  });
}
/* a gear that would sit under a pop-up's X moves down just below it */
function gearUnderX() {
  var x = document.querySelector("#panel > .close");
  if (!x || !$("detail").classList.contains("on")) return;
  var xr = x.getBoundingClientRect();
  if (!xr.width) return;
  [].forEach.call(document.querySelectorAll("#panel .gearwrap"), function (w) {
    if (w.dataset.ux) w.style.top = w.style.marginTop = "";
    var r = w.getBoundingClientRect();
    if (!r.width || r.left > xr.right || r.right < xr.left || r.top > xr.bottom || r.bottom < xr.top) return;
    var push = Math.ceil(xr.bottom - r.top + 4);
    w.dataset.ux = "1";
    if (getComputedStyle(w).position === "absolute") w.style.top = parseFloat(getComputedStyle(w).top || 0) + push + "px";
    else w.style.marginTop = push + "px";
  });
}
window.addEventListener("resize", function () {
  requestAnimationFrame(gearUnderX);
});
var gearTick = 0;
new MutationObserver(function () {
  if (gearTick) return;
  gearTick = requestAnimationFrame(function () {
    gearTick = 0;
    gearify();
    gearUnderX();
  });
}).observe(document.body, { childList: true, subtree: true });
/* Pop-up layout for a client or a job: name and contact box on the left, tabs on the right. */
function popPanel() {
  var p = panel();
  detailFull(true);
  p.classList.add("pop");
  var L = el("div", "popl"),
    R = el("div", "popr");
  p.appendChild(L);
  p.appendChild(R);
  return { p: p, L: L, R: R };
}
function popLine(box, label, value, href) {
  if (!value) return;
  var r = el("div", "popln");
  r.appendChild(el("span", null, label));
  if (href) {
    var a = el("a", null, value);
    a.href = href;
    if (/^https?:/.test(href)) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    r.appendChild(a);
  } else r.appendChild(el("b", null, value));
  box.appendChild(r);
}
function popTabs(R, TABS, cur, onPick) {
  var bar = el("div", "ctabs"),
    panes = {};
  if (
    !TABS.some(function (t) {
      return t[0] === cur;
    })
  )
    cur = TABS[0][0];
  TABS.forEach(function (t) {
    var b = el("button", t[0] === cur ? "on" : "", t[1]);
    b.type = "button";
    b.addEventListener("click", function () {
      if (onPick) onPick(t[0]);
      [].forEach.call(bar.children, function (x) {
        x.classList.toggle("on", x === b);
      });
      Object.keys(panes).forEach(function (k) {
        panes[k].hidden = k !== t[0];
      });
    });
    bar.appendChild(b);
    panes[t[0]] = el("div", "ctab");
    panes[t[0]].hidden = t[0] !== cur;
  });
  R.appendChild(bar);
  var body = el("div", "popbody");
  TABS.forEach(function (t) {
    body.appendChild(panes[t[0]]);
  });
  R.appendChild(body);
  return panes;
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
  if (typeof hideReceiptViewer === "function") hideReceiptViewer();
  $("detail").classList.remove("on");
  optMark(null);
}
/* Clicking the dim area outside a pop-up closes it. If something was typed into a form, it asks first so a stray click never loses it. */
var dnDown = null;
$("detail").addEventListener("mousedown", function (e) {
  dnDown = e.target;
});
$("detail").addEventListener("click", function (e) {
  if (e.target !== $("detail") || dnDown !== $("detail")) return;
  if (panelDirty && !confirm("Close without saving what you typed?")) return;
  closeDetail();
});
/* Has anything been typed into the open form? Only then does closing by clicking outside ask first. */
var panelDirty = false;
$("panel").addEventListener("input", function (e) {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== "search") panelDirty = true;
});
/* The invoice viewer also closes when you click the empty area around the page. */
$("invview").addEventListener("click", function (e) {
  if (e.target === $("invview") || e.target === $("invpaper")) hideInvoice();
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
  var f = $("invframe");
  if (f && f.contentWindow) f.contentWindow.print();
  else window.print();
});

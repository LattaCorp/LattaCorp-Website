/* Autofill for text boxes, like a search bar:
   - a list of matches opens under the box while you type (past entries, vendors, addresses, services...)
   - Tab or Down moves down the list, Shift+Tab or Up moves up, Enter picks, Esc closes
   - a faint suggestion finishes the word in the box; Right arrow (at the end) or picking accepts it
   Job / line titles on invoices, quotes and jobs also list ready-made services as soon as the box is clicked. */

var AC_TITLES = [
  "Lawn maintenance - Basic",
  "Lawn maintenance - Plus",
  "Lawn maintenance - Premier",
  "Lawn maintenance - Elite",
  "Tree trimming",
  "Hedge trimming",
  "Shrub trimming",
  "Mulching",
  "Irrigation",
  "Irrigation repair",
  "Weed control",
  "Yard cleanup",
  "Leaf cleanup",
  "Shrub removal",
  "Sod installation",
  "Flower bed installation"
];
var AC_MAX_HIST = 40;

function acKey(inp) {
  if (inp.dataset.ac) return inp.dataset.ac;
  var lab = inp.closest("label"),
    sp = lab && lab.querySelector("span");
  var t = ((sp && sp.textContent) || inp.getAttribute("aria-label") || inp.placeholder || inp.name || "").toLowerCase();
  return t.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function acHist(key) {
  try {
    var v = JSON.parse(localStorage.getItem("lc_ac:" + key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}
function acRemember(key, val) {
  val = String(val || "").trim();
  if (!key || !val || val.length > 140) return;
  var h = acHist(key).filter(function (x) {
    return x.toLowerCase() !== val.toLowerCase();
  });
  h.unshift(val);
  try {
    localStorage.setItem("lc_ac:" + key, JSON.stringify(h.slice(0, AC_MAX_HIST)));
  } catch (e) {}
}
function acUniq(arr) {
  var seen = {},
    out = [];
  arr.forEach(function (x) {
    if (!x) return;
    var v = typeof x === "string" ? { v: x } : x;
    v.v = String(v.v || "").trim();
    var k = v.v.toLowerCase();
    if (!v.v || seen[k]) return;
    seen[k] = 1;
    out.push(v);
  });
  return out;
}
function acPluck(list, f) {
  return (typeof list !== "undefined" && Array.isArray(list) ? list : []).map(function (x) {
    return x && x[f];
  });
}
/* everything we know that fits this box, best first */
function acItems(inp) {
  var key = acKey(inp),
    out = [];
  if (key === "titles") {
    var svc = (typeof services !== "undefined" ? services : [])
      .filter(function (s) {
        return s && s.active !== false;
      })
      .map(function (s) {
        return { v: s.name, price: s.default_price };
      });
    out = out
      .concat(AC_TITLES)
      .concat(svc)
      .concat(typeof invoices !== "undefined" ? acPluck(invoices, "title") : [])
      .concat(typeof estimates !== "undefined" ? acPluck(estimates, "title") : [])
      .concat(typeof jobs !== "undefined" ? acPluck(jobs, "title") : []);
    // a catalog price beats no price for the same name
    svc.forEach(function (s) {
      out.forEach(function (o, i) {
        if (typeof o === "string" && o.toLowerCase() === String(s.v).toLowerCase()) out[i] = s;
      });
    });
  } else if (/vendor|store|supplier/.test(key)) {
    out = out.concat(typeof expenses !== "undefined" ? acPluck(expenses, "vendor") : []);
  } else if (/address/.test(key)) {
    out = out.concat(typeof props !== "undefined" ? acPluck(props, "address") : []);
  } else if (/^company/.test(key)) {
    out = out.concat(typeof clients !== "undefined" ? acPluck(clients, "company") : []);
  }
  if (inp.acList) out = out.concat(inp.acList);
  out = acHist(key === "titles" ? "titles" : key).concat(out);
  if (key === "titles") {
    // keep the ready-made services at the top in their usual order, then whatever was used before
    var pre = AC_TITLES.map(function (t) {
      var hit = null;
      out.forEach(function (o) {
        if (!hit && typeof o === "object" && o && String(o.v).toLowerCase() === t.toLowerCase()) hit = o;
      });
      return hit || t;
    });
    out = pre.concat(out);
  }
  return acUniq(out);
}
function acMatch(items, typed) {
  var q = typed.trim().toLowerCase();
  if (!q) return items.slice(0, 12);
  var starts = [],
    words = [],
    has = [];
  items.forEach(function (it) {
    var v = it.v.toLowerCase();
    if (v === q) return;
    if (v.indexOf(q) === 0) starts.push(it);
    else if (v.indexOf(" " + q) > -1) words.push(it);
    else if (v.indexOf(q) > -1) has.push(it);
  });
  return starts.concat(words, has).slice(0, 8);
}

var AC = null; // the box being helped right now
function acBox() {
  var d = $("acdrop");
  if (!d) {
    d = el("div", "acdrop");
    d.id = "acdrop";
    d.setAttribute("role", "listbox");
    d.hidden = true;
    document.body.appendChild(d);
    var g = el("div", "acghost");
    g.id = "acghost";
    g.setAttribute("aria-hidden", "true");
    g.hidden = true;
    document.body.appendChild(g);
  }
  return d;
}
function acPlace() {
  if (!AC) return;
  var r = AC.inp.getBoundingClientRect(),
    d = $("acdrop");
  if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return acClose();
  d.style.left = r.left + "px";
  d.style.width = Math.max(r.width, 200) + "px";
  var below = window.innerHeight - r.bottom;
  if (below < 220 && r.top > below) {
    d.style.top = "auto";
    d.style.bottom = window.innerHeight - r.top + 2 + "px";
  } else {
    d.style.bottom = "auto";
    d.style.top = r.bottom + 2 + "px";
  }
  acGhost();
}
function acGhost() {
  var g = $("acghost");
  if (!g) return;
  g.hidden = true;
  if (!AC) return;
  var inp = AC.inp,
    typed = inp.value,
    top = AC.sel < 0 && AC.list[0];
  if (!typed || !top || inp.selectionStart !== typed.length || top.v.toLowerCase().indexOf(typed.toLowerCase()) !== 0) {
    AC.ghost = "";
    return;
  }
  AC.ghost = top.v;
  var cs = getComputedStyle(inp),
    r = inp.getBoundingClientRect();
  g.style.cssText =
    "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;" +
    "font:" + cs.font + ";letter-spacing:" + cs.letterSpacing + ";" +
    "padding:" + cs.paddingTop + " " + cs.paddingRight + " " + cs.paddingBottom + " " + cs.paddingLeft + ";" +
    "border:" + cs.borderTopWidth + " solid transparent;line-height:" + (r.height - parseFloat(cs.borderTopWidth) * 2 - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) + "px;" +
    "text-align:" + cs.textAlign;
  g.textContent = "";
  g.appendChild(el("span", "acgt", typed));
  g.appendChild(el("span", "acgr", top.v.slice(typed.length)));
  if (inp.scrollLeft > 0) return;
  g.hidden = false;
}
function acDraw() {
  var d = acBox();
  d.textContent = "";
  if (!AC || !AC.list.length) {
    d.hidden = true;
    acGhost();
    return;
  }
  var q = AC.typed.trim().toLowerCase();
  AC.list.forEach(function (it, i) {
    var o = el("div", "acopt" + (i === AC.sel ? " on" : ""));
    o.setAttribute("role", "option");
    var v = it.v,
      at = q ? v.toLowerCase().indexOf(q) : -1,
      lb = el("span", "acl");
    if (at > -1) {
      lb.appendChild(document.createTextNode(v.slice(0, at)));
      lb.appendChild(el("b", null, v.slice(at, at + q.length)));
      lb.appendChild(document.createTextNode(v.slice(at + q.length)));
    } else lb.textContent = v;
    o.appendChild(lb);
    if (it.price != null && it.price !== "" && Number(it.price) > 0) o.appendChild(el("span", "acp", money(it.price)));
    o.addEventListener("mousedown", function (e) {
      e.preventDefault(); // keep the cursor in the box
      acPick(i);
    });
    d.appendChild(o);
  });
  d.hidden = false;
  acPlace();
}
function acOpen(inp, showAll) {
  if (!AC || AC.inp !== inp) AC = { inp: inp, sel: -1, typed: inp.value, list: [], ghost: "" };
  AC.typed = inp.value;
  AC.sel = -1;
  var items = acItems(inp);
  AC.list = inp.value.trim() || showAll ? acMatch(items, inp.value) : [];
  acDraw();
}
function acClose() {
  var d = $("acdrop"),
    g = $("acghost");
  if (d) d.hidden = true;
  if (g) g.hidden = true;
  if (AC) AC.list = [];
}
function acFire(inp, it) {
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.dispatchEvent(new Event("change", { bubbles: true }));
  if (it) inp.dispatchEvent(new CustomEvent("acpick", { bubbles: true, detail: it }));
}
function acPick(i) {
  if (!AC || !AC.list[i]) return;
  var inp = AC.inp,
    it = AC.list[i];
  inp.value = it.v;
  AC.typed = it.v;
  acClose();
  acFire(inp, it);
  try {
    inp.setSelectionRange(it.v.length, it.v.length);
  } catch (e) {}
}
function acMove(step) {
  var n = AC.list.length;
  AC.sel = AC.sel + step;
  if (AC.sel < -1) AC.sel = n - 1;
  // past the last suggestion: Tab carries on to the next box
  if (AC.sel >= n) return false;
  AC.inp.value = AC.sel < 0 ? AC.typed : AC.list[AC.sel].v;
  acDraw();
  return true;
}

function acWants(inp) {
  if (!inp || inp.tagName !== "INPUT" || inp.readOnly || inp.disabled) return false;
  if (inp.type !== "text" && inp.type !== "") return false;
  if (inp.dataset.ac === "no" || inp.id === "gs") return false;
  if (!inp.closest("#panel,#app,#rightcol")) return false;
  if (inp.closest(".fbar,.gsearch,.lpwrap")) return false;
  if (inp.dataset.ac) return true;
  if (inp.getAttribute("list")) return true;
  if (/numeric|decimal|tel|email/.test(inp.inputMode || "")) return false;
  if (inp.autocomplete === "off" || /^(mm|0|\$)/i.test(inp.placeholder || "")) return false;
  return true;
}
function acSetup(inp) {
  if (inp.acReady) return;
  inp.acReady = true;
  // a built-in suggestion list becomes ours, so the browser's own pop-up doesn't fight with it
  var lid = inp.getAttribute("list");
  if (lid) {
    var dl = document.getElementById(lid);
    if (dl)
      inp.acList = [].map.call(dl.querySelectorAll("option"), function (o) {
        return o.value;
      });
    inp.removeAttribute("list");
  }
  inp.setAttribute("autocomplete", "off");
  inp.setAttribute("aria-autocomplete", "both");
  inp.addEventListener("input", function (e) {
    if (!e.isTrusted) return;
    acOpen(inp, inp.dataset.acall === "1");
  });
  inp.addEventListener("keydown", function (e) {
    var open = AC && AC.inp === inp && AC.list.length && !$("acdrop").hidden;
    if (e.key === "ArrowDown" && !open) {
      acOpen(inp, true);
      if (AC.list.length) e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (acMove(e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1)) e.preventDefault();
      else {
        acClose();
        if (e.key !== "Tab") e.preventDefault();
      }
    } else if (e.key === "Enter") {
      if (AC.sel > -1) {
        e.preventDefault();
        acPick(AC.sel);
      } else acClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      inp.value = AC.typed;
      acClose();
    } else if (e.key === "ArrowRight" && AC.ghost && inp.selectionStart === inp.value.length) {
      e.preventDefault();
      var gi = 0;
      AC.list.forEach(function (it, i) {
        if (it.v === AC.ghost) gi = i;
      });
      acPick(gi);
    }
  });
  inp.addEventListener("blur", function () {
    setTimeout(function () {
      if (AC && AC.inp === inp && document.activeElement !== inp) acClose();
    }, 120);
  });
  inp.addEventListener("change", function () {
    acRemember(acKey(inp), inp.value);
  });
  inp.addEventListener("click", function () {
    if (inp.dataset.acall === "1" && (!AC || AC.inp !== inp || $("acdrop").hidden)) acOpen(inp, true);
  });
}
document.addEventListener(
  "focusin",
  function (e) {
    var inp = e.target;
    if (!acWants(inp)) return;
    acSetup(inp);
    if (inp.dataset.acall === "1") acOpen(inp, true);
  },
  true
);
window.addEventListener("resize", acPlace);
document.addEventListener("scroll", acPlace, true);

/* job / line title boxes: ready-made services show as soon as the box is clicked, and a catalog price fills an empty price */
function acTitles(inp, priceInp) {
  inp.dataset.ac = "titles";
  inp.dataset.acall = "1";
  if (!inp.placeholder) inp.placeholder = "Pick a service or type your own";
  if (priceInp)
    inp.addEventListener("acpick", function (e) {
      var pr = e.detail && Number(e.detail.price);
      if (pr > 0 && !String(priceInp.value || "").trim()) {
        priceInp.value = pr.toFixed(2);
        priceInp.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
}

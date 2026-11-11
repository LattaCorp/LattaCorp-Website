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
  var nm = fld("Name", "text", ""),
    st = fld(
      "Start with",
      "select",
      "3",
      INV_PRESETS.map(function (x, i) {
        return [String(i), x[0] + " (" + x[1].join(", ") + ")"];
  nm.input.placeholder = "e.g. Equipment, Chemicals, Fuel & Oil";
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
  var nm = fld("Name", "text", c.name);
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

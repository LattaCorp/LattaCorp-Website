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
  tb.appendChild(btn("Upload receipt", "btn alt", openReceiptUpload));
  tb.appendChild(document.createTextNode(" "));
  tb.appendChild(btn("Paste from Excel", "btn alt", openExpPaste));
  setTimeout(function () {
    receiptInbox($("list"));
  }, 0);
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
            : "No expenses yet. Tap + Add expense, Upload receipt, or Paste from Excel."
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

function openExpense(e, pre, scanFile, todo) {
  pre = pre || {};
  var src = e || pre,
    splitIds = pre.splitIds || {};
  var p = panel();
  p.appendChild(el("h2", null, e ? "Expense" : "Add expense"));
  if (todo && !e) {
    // the uploaded receipt, right above the form, so it can be typed in
    var rbox = el("div", "pcard rtodo");
    var rim = document.createElement("img");
    rim.alt = "Receipt photo";
    rbox.appendChild(rim);
    signPaths([todo.path]).then(function () {
      if (pcache[todo.path]) {
        rim.src = pcache[todo.path].url;
        rim.addEventListener("click", function () {
          window.open(pcache[todo.path].url, "_blank", "noopener");
        });
      }
    });
    rbox.appendChild(
      el(
        "div",
        "note",
        (todo.caption ? '"' + todo.caption + '" \u00b7 ' : "") +
          "Uploaded " +
          dshort(String(todo.created_at).slice(0, 10)) +
          (todo.created_by ? " by " + todo.created_by.split("@")[0] : "") +
          ". Tap the photo to see it full size. It's deleted once you Save (Save and add another item keeps it for the next line)."
      )
    );
    p.appendChild(rbox);
  }
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
  var code = fld("Code", "text", src.code || ""),
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
  var am = fld("Amount ($)", "number", e ? expNet(e) : pre.amount != null ? pre.amount : ""),
    tx = fld("Tax ($)", "number", e ? expTax(e) || "" : pre.tax || ""),
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
  var tn = fld("Tax notes", "textarea", e ? e.tax_note || "" : "");
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
    "Client job",
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
      rh = el("h3", null, scanFile && !e ? "Receipt photo" : "Receipt photos");
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
        if (todo && !e && !again) {
          removePhotos([todo]).then(function () {
            render();
          });
        }
        if (again) {
          var ids = Object.assign({}, splitIds);
          ids[r.data.id] = 1;
          closeDetail();
          render();
          openExpense(
            null,
            {
              date: r.data.spent_on,
              vendor: r.data.vendor,
              receipt_no: r.data.receipt_no,
              payment: r.data.payment,
              code: r.data.code,
              splitIds: ids
            },
            null,
            todo
          );
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

/* ---- Receipts to enter: anyone can snap a receipt and upload it; a staff member types it in later from the
   Expenses page, and the photo is deleted once the expense is saved. ---- */
function receiptsToEnter() {
  return (photos || []).filter(function (p) {
    return p.kind === "receipt_todo";
  });
}
function openReceiptUpload() {
  if (photoErr) {
    alert("Photos aren't set up yet. Run the Stage 10 SQL in Supabase first.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Upload a receipt"));
  p.appendChild(el("p", "note", "Snap or choose the receipt. It waits under Receipts to enter on the Expenses page until someone types it in, then the photo is deleted."));
  var nt = fld("Note", "text", "");
  nt.input.placeholder = "e.g. Mulch for the Oak Grove job";
  p.appendChild(nt);
  var st = el("div", "note");
  st.style.cssText = "font-weight:700;margin:10px 0;min-height:1.4em";
  function go(files) {
    if (!files || !files.length) return;
    st.textContent = "Uploading...";
    uploadMany(Array.prototype.slice.call(files), { kind: "receipt_todo", caption: nt.input.value.trim() }, function (i, n) {
      st.textContent = "Uploading " + i + " of " + n + "...";
    }).then(function (res) {
      var msg = uploadMsg(res);
      if (msg) alert(msg);
      st.textContent = res.ok ? "\u2713 " + res.ok + " receipt" + (res.ok > 1 ? "s" : "") + " saved to Receipts to enter." : "";
      nt.input.value = "";
      render();
    });
  }
  var row = el("div", "qacts");
  row.appendChild(
    btn("Take photo", "btn", function () {
      pickPhotos(true, go);
    })
  );
  row.appendChild(
    btn("Choose photos", "btn alt", function () {
      pickPhotos(false, go);
    })
  );
  p.appendChild(row);
  p.appendChild(st);
}
function receiptInbox(list) {
  [].forEach.call(document.querySelectorAll(".rinbox"), function (x) {
    x.parentNode.removeChild(x);
  });
  if (view !== "expenses" || !list) return;
  var todo = receiptsToEnter().sort(function (a, b) {
    return String(a.created_at) < String(b.created_at) ? -1 : 1;
  });
  if (!todo.length) return;
  var box = el("div", "rinbox");
  box.appendChild(el("h3", null, "Receipts to enter (" + todo.length + ")"));
  var g = el("div", "rgrid");
  todo.forEach(function (ph) {
    var c = el("div", "rcard"),
      im = document.createElement("img");
    im.alt = "Receipt";
    im.loading = "lazy";
    c.appendChild(im);
    signPaths([ph.thumb_path || ph.path]).then(function () {
      var k = pcache[ph.thumb_path || ph.path];
      if (k) im.src = k.url;
    });
    c.appendChild(el("b", null, ph.caption || "Receipt"));
    c.appendChild(el("div", "note", dshort(String(ph.created_at).slice(0, 10)) + (ph.created_by ? " \u00b7 " + ph.created_by.split("@")[0] : "")));
    var a = el("div", "qacts");
    a.appendChild(
      btn("Enter it", "btn sm", function () {
        openExpense(null, {}, null, ph);
      })
    );
    a.appendChild(
      btn("Delete", "btn alt sm", function () {
        deletePhotos([ph]);
      })
    );
    c.appendChild(a);
    g.appendChild(c);
  });
  box.appendChild(g);
  // computers: in the right column under the options; phones: at the top of the list
  if (docked() && $("rightcol")) $("rightcol").appendChild(box);
  else list.insertBefore(box, list.firstChild);
}

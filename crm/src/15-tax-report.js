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

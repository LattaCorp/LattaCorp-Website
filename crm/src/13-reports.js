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
    out.appendChild(salesSnapshot(d.from, d.to));
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

/* ---- Sales snapshot: how website requests and quotes turned into work, for the same period as the report ---- */
function salesSnapshot(from, to) {
  var box = el("div", "sales");
  var h = el("h3", null, "Sales");
  h.style.margin = "18px 0 6px";
  box.appendChild(h);
  function inR(x) {
    x = String(x || "").slice(0, 10);
    return x && x >= from && x <= to;
  }
  var reqs = leads.filter(function (l) {
      return inR(l.created_at);
    }),
    made = estimates.filter(function (e) {
      return inR(e.issue_date || e.created_at);
    }),
    sent = made.filter(function (e) {
      return e.status !== "draft";
    }),
    ok = estimates.filter(function (e) {
      return e.status === "accepted" && inR(e.responded_at);
    }),
    no = estimates.filter(function (e) {
      return (e.status === "declined" && inR(e.responded_at)) || ((e.status === "sent" || e.status === "draft") && e.valid_until && e.valid_until < today() && inR(e.valid_until));
    }),
    val = r2(
      ok.reduce(function (a, e) {
        return a + Number(e.total || 0);
      }, 0)
    ),
    rate = ok.length + no.length ? Math.round((ok.length / (ok.length + no.length)) * 100) : null,
    jobsMade = ok.filter(function (e) {
      return e.job_id;
    }).length;
  var st = el("div", "stats");
  [
    ["Website requests", String(reqs.length)],
    ["Quotes sent", String(sent.length)],
    ["Approved", String(ok.length), ok.length ? money(val) : ""],
    ["Approval rate", rate == null ? "\u2014" : rate + "%"]
  ].forEach(function (x) {
    var c = el("div", "stat");
    c.appendChild(el("span", null, x[0]));
    c.appendChild(el("b", null, x[1]));
    if (x[2]) c.appendChild(el("small", "ssub", x[2]));
    st.appendChild(c);
  });
  box.appendChild(st);
  box.appendChild(
    el(
      "div",
      "note",
      (no.length ? no.length + " declined or expired. " : "") +
        (ok.length ? jobsMade + " of " + ok.length + " approved quote" + (ok.length > 1 ? "s have" : " has") + " been made into a job. " : "") +
        "Approval rate = approved \u00f7 (approved + declined or expired) in this period."
    )
  );
  // month by month
  var months = {},
    order = [];
  function mk(x) {
    var k = String(x || "").slice(0, 7);
    if (!k) return null;
    if (!months[k]) {
      months[k] = { req: 0, sent: 0, ok: 0, no: 0, val: 0 };
      order.push(k);
    }
    return months[k];
  }
  reqs.forEach(function (l) {
    mk(l.created_at).req++;
  });
  sent.forEach(function (e) {
    mk(e.issue_date || e.created_at).sent++;
  });
  ok.forEach(function (e) {
    var m = mk(e.responded_at);
    m.ok++;
    m.val += Number(e.total || 0);
  });
  no.forEach(function (e) {
    mk(e.status === "declined" ? e.responded_at : e.valid_until).no++;
  });
  if (order.length > 1) {
    order.sort();
    var tb = document.createElement("table");
    tb.className = "rtable";
    var hd = document.createElement("tr");
    ["Month", "Requests", "Quotes", "Approved", "Declined", "Approved $"].forEach(function (x, i) {
      var th = document.createElement("th");
      th.textContent = x;
      if (i) th.className = "r";
      hd.appendChild(th);
    });
    tb.appendChild(hd);
    order.forEach(function (k) {
      var m = months[k],
        tr = document.createElement("tr");
      [pd(k + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }), m.req, m.sent, m.ok, m.no, money(r2(m.val))].forEach(function (x, i) {
        var td = document.createElement("td");
        td.textContent = String(x);
        if (i) td.className = "r";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var w = el("div", "tscroll");
    w.appendChild(tb);
    box.appendChild(w);
  }
  return box;
}

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

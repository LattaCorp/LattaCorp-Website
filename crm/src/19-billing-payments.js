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
                    description: invLineDesc(v),
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

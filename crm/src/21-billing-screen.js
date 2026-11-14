/* Billing tab: invoice list, invoice detail, printable invoice, estimates and billing settings. */

/* ---- Billing screen ---- */
function renderBilling() {
  var tabs = $("tabs");
  tabs.textContent = "";
  if (bfilter === "estimates") bfilter = "tobill"; // quotes and estimates now live on the Leads page
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
    ["payments", "Payments", invPays.length]
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
  // the everyday options; the one-time and rarely used ones live under Tools
  $("topbtns").appendChild(
    btn("+ New invoice", "btn", function () {
      openInvoiceForm(null);
    })
  );
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Bill the month", "btn alt", openBillMonth));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(
    btn("Email invoices", "btn alt", function () {
      openBatchDeliver(null);
    })
  );
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(
    btn("Record payment", "btn alt", function () {
      openPayment(null);
    })
  );
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Tools", "btn alt", openBillTools));
  $("topbtns").appendChild(document.createTextNode(" "));
  $("topbtns").appendChild(btn("Billing settings", "btn alt", openBizSettings));
  var list = $("list");
  list.textContent = "";
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
        l.appendChild(el("b", null, cname(v.client_id) + " \u00b7 " + vTitle(v)));
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
            vTitle(v) +
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
/* ---- One invoice in the side panel: what's owed at the top, a readable card of the lines, and only the buttons that
   fit where it stands (Record payment, Send or Send reminder, Preview). Edit, Copy link and Void are under More. ---- */
function openInvoice(id) {
  var inv = byId(invoices, id);
  if (!inv) return;
  var c = byId(clients, inv.client_id),
    p = panel();
  p.classList.add("qpanel");
  p.appendChild(el("h2", null, cname(inv.client_id)));
  var od = isOverdue(inv),
    days = od ? Math.max(1, Math.round((new Date(today() + "T12:00:00") - new Date(inv.due_date + "T12:00:00")) / 864e5)) : 0,
    paid = invPaidSum(inv),
    bal = inv.status === "open" ? Math.max(0, r2(Number(inv.total || 0) - paid)) : 0;
  var st =
    inv.status === "paid" ? ["Paid", "ok"] : inv.status === "void" ? ["Void", "no"] : od ? ["Overdue · " + days + " day" + (days > 1 ? "s" : ""), "no"] : !inv.sent_at ? ["Not sent yet", "draft"] : ["Open", "wait"];
  var hd = el("div", "qhead");
  hd.appendChild(el("span", "qnum", "Invoice " + invNum(inv.number)));
  hd.appendChild(el("span", "qst " + st[1], st[0]));
  p.appendChild(hd);
  // the money, big
  var seen = inv.viewed_at ? "client opened it " + dshort(String(inv.viewed_at).slice(0, 10)) : inv.sent_at ? "sent " + dshort(String(inv.sent_at).slice(0, 10)) + ", not opened yet" : "not sent yet";
  var ban;
  if (inv.status === "open") {
    ban = el("div", "qban " + (od ? "no" : "wait"));
    ban.appendChild(el("b", null, money(bal) + " due"));
    ban.appendChild(el("div", null, (od ? "Was due " : "Due ") + dshort(inv.due_date) + " · " + seen + (inv.reminded_at ? " · reminded " + dshort(String(inv.reminded_at).slice(0, 10)) : "")));
  } else if (inv.status === "paid") {
    ban = el("div", "qban ok");
    ban.appendChild(el("b", null, "✓ Paid" + (inv.paid_at ? " " + dshort(String(inv.paid_at).slice(0, 10)) : "")));
    if (inv.paid_method) ban.appendChild(el("div", null, "By " + inv.paid_method));
  } else {
    ban = el("div", "qban void");
    ban.appendChild(el("b", null, "Voided"));
    ban.appendChild(el("div", null, "Nothing is owed on this invoice. Its visits went back to To bill."));
  }
  p.appendChild(ban);
  var main = el("div", "qacts");
  p.appendChild(main);
  var msg = invMessage(inv, c),
    sendRow = el("div", "qsend");
  sendRow.hidden = true;
  var items = null;
  function preview() {
    if (inv.share_token) window.open(docUrl(inv.share_token, true), "_blank", "noopener");
    else if (items) showInvoice(inv, items);
  }
  if (inv.status === "open") {
    main.appendChild(
      btn("Record payment", "btn", function () {
        openPayment(inv.client_id);
      })
    );
    var remind = od || !!inv.sent_at,
      text = remind ? invRemind(inv, c) : msg;
    main.appendChild(
      btn(remind ? "Send reminder" : "Send", "btn alt", function () {
        sendRow.hidden = !sendRow.hidden;
      })
    );
    if (c && c.email) {
      var em = el("a", "btn alt", "Email");
      em.href = remind
        ? mailHref(c.email, "Payment reminder: invoice " + invNum(inv.number), text)
        : mailHref(c.email, "Invoice " + invNum(inv.number) + " from " + bizv("name", "Latta Corp"), text);
      em.addEventListener("click", function () {
        remind ? stampInv(inv) : markSent(inv);
      });
      sendRow.appendChild(em);
    }
    if (c && c.phone) {
      var tx = el("a", "btn alt", "Text");
      tx.href = smsHref(c.phone, text);
      tx.addEventListener("click", function () {
        remind ? stampInv(inv) : markSent(inv);
      });
      sendRow.appendChild(tx);
    }
    sendRow.appendChild(
      copyBtn("Copy message", text, false, function () {
        remind ? stampInv(inv) : markSent(inv);
      })
    );
  }
  main.appendChild(btn("Preview", "btn alt", preview));
  p.appendChild(sendRow);
  var card = el("div", "pcard qcard");
  card.appendChild(el("div", "note", "Loading..."));
  p.appendChild(card);
  // rarely needed
  var more = document.createElement("details");
  more.className = "qmore";
  more.appendChild(el("summary", null, "More"));
  var mr = el("div", "qacts");
  if (inv.status === "open")
    mr.appendChild(
      btn("Edit invoice", "btn alt", function () {
        openInvoiceEditor(inv);
      })
    );
  if (inv.status !== "void") {
    if (inv.sent_at && inv.status === "open")
      mr.appendChild(
        copyBtn("Copy invoice message", msg, false, function () {
          markSent(inv);
        })
      );
    if (inv.share_token)
      mr.appendChild(
        copyBtn("Copy link", docUrl(inv.share_token), false, function () {
          markSent(inv);
        })
      );
  }
  if (inv.status === "paid")
    mr.appendChild(
      btn("Mark unpaid", "btn alt", function () {
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
  if (inv.status !== "void")
    mr.appendChild(
      btn("Void invoice", "btn danger", function () {
        if (!confirm("Void this invoice? Its visits go back to 'To bill' so you can bill them again.")) return;
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
    mr.appendChild(
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
  more.appendChild(mr);
  p.appendChild(more);
  sb.from("invoice_items")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("service_date", { ascending: true })
    .limit(1000)
    .then(function (r) {
      items = r.error ? [] : r.data || [];
      card.textContent = "";
      if (inv.title) card.appendChild(el("h3", "qtitle", inv.title));
      var addrs = [];
      items.forEach(function (it) {
        if (it.address && addrs.indexOf(it.address) < 0) addrs.push(it.address);
      });
      if (!addrs.length) addrs.push(inv.property_id ? paddr(inv.property_id) : (clientProps(inv.client_id)[0] || {}).address || "");
      var facts = [
        ["Bill to", cname(inv.client_id) + (c && c.account_no ? " (" + c.account_no + ")" : "")],
        [addrs.length > 1 ? "Service addresses" : "Service address", addrs.filter(Boolean).join("; ")],
        ["Invoice date", dshort(inv.issue_date)],
        ["Payment due", dshort(inv.due_date)],
        ["Service period", inv.period_start && inv.period_end ? dshort(inv.period_start) + " – " + dshort(inv.period_end) : ""],
        ["PO / Reference", inv.reference || ""]
      ].filter(function (x) {
        return x[1];
      });
      var fl = el("div", "qfacts");
      facts.forEach(function (x) {
        var d = el("div");
        d.appendChild(el("span", null, x[0]));
        d.appendChild(el("b", null, x[1]));
        fl.appendChild(d);
      });
      card.appendChild(fl);
      var t = el("div", "qlines");
      items.forEach(function (it) {
        var ln = el("div", "ql"),
          l = el("div");
        l.appendChild(el("b", null, it.title || it.description || ""));
        var sub = [it.service_date ? dshort(it.service_date) : "", it.title ? it.description : "", addrs.length > 1 ? it.address : ""].filter(Boolean).join(" · ");
        if (sub) l.appendChild(el("div", null, sub));
        ln.appendChild(l);
        var rt = el("div", "qamt");
        rt.appendChild(el("b", null, money(it.amount)));
        if (it.qty) rt.appendChild(el("div", null, "QTY " + it.qty));
        ln.appendChild(rt);
        t.appendChild(ln);
      });
      if (!items.length) t.appendChild(el("div", "note", "No lines."));
      card.appendChild(t);
      var tot = el("div", "qtot");
      function trow(k, v, cls) {
        var d = el("div", cls || "");
        d.appendChild(el("span", null, k));
        d.appendChild(el("span", null, v));
        tot.appendChild(d);
      }
      trow("Total", money(inv.total), "big");
      if (inv.status === "open") {
        trow("Paid", money(paid));
        trow("Balance due", money(bal), "bal");
      }
      card.appendChild(tot);
      if (inv.terms) {
        card.appendChild(el("div", "qnh", "Notes & Terms"));
        card.appendChild(el("div", "qnotes", inv.terms));
      }
    });
}
// Edit opens the same window as New invoice (with the live preview), filled in with this invoice
function openInvoiceEditor(inv) {
  sb.from("invoice_items")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("service_date", { ascending: true })
    .limit(1000)
    .then(function (r) {
      if (r.error) {
        alert("Could not load the lines.");
        return;
      }
      openInvoiceForm(inv.client_id, { inv: inv, items: r.data || [] });
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
        callApi("/api/push", "client-invoice", { id: inv.id }); // pings the client's phone if they turned that on
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

/* ---- printable invoice (works as a PDF too) ----
   Invoices with a private link show the exact page the client sees (d/index.html), with the account summary, so
   staff and clients always see the same invoice. Older invoices without a link use the simple layout below. */
function showInvoice(inv, items) {
  if (inv.share_token) return showDocFrame(docUrl(inv.share_token, true) + "&embed=1&lang=en");
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
        (it.title ? "<b>" + esc(it.title) + "</b> " : "") +
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
function showDocFrame(url) {
  var paper = $("invpaper");
  paper.innerHTML = "";
  paper.classList.add("framed");
  var f = document.createElement("iframe");
  f.id = "invframe";
  f.title = "Invoice";
  f.src = url;
  // grow the frame to fit the invoice so the page scrolls as one
  var fit = function () {
    try {
      f.style.height = f.contentDocument.documentElement.scrollHeight + "px";
    } catch (e) {}
  };
  f.addEventListener("load", function () {
    fit();
    setTimeout(fit, 400);
    setTimeout(fit, 1200);
  });
  paper.appendChild(f);
  var v = $("invview");
  v.hidden = false;
  document.body.classList.add("printing");
  v.scrollTop = 0;
}
function hideInvoice() {
  var paper = $("invpaper");
  paper.classList.remove("framed");
  if ($("invframe")) paper.innerHTML = "";
  $("invview").hidden = true;
  document.body.classList.remove("printing");
}

/* ---- Estimates (clients open a private link and can accept) ---- */
function estNum(n, type) {
  var s = String(n || 0);
  while (s.length < 4) s = "0" + s;
  return (type === "estimate" ? "EST-" : "QTE-") + s;
}
// "quote" or "estimate" (older rows have no type yet: they are quotes)
function estWord(e, cap) {
  var w = e && e.doc_type === "estimate" ? "estimate" : "quote";
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
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
  if (e.status !== "sent") return el("span", "chip draft", "DRAFT");
  return el("span", "chip", e.viewed_at ? "Viewed" : "Sent");
}
function estMessage(e, c) {
  return (
    "Hi " +
    firstName(c) +
    ", this is " +
    bizv("name", "Latta Corp") +
    ". Here is your " +
    estWord(e) +
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
  var b = el("button", "row client" + (e.response_seen === false ? " fresh" : ""));
  b.type = "button";
  b.dataset.eid = e.id;
  var l = el("div");
  l.appendChild(el("b", null, estNum(e.number, e.doc_type) + " · " + cname(e.client_id)));
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
  if (e.response_seen === false) r.appendChild(el("span", "chip newresp", "New"));
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
    return [estNum(e.number, e.doc_type), cname(e.client_id), e.title].join(" ").toLowerCase().indexOf(query) > -1;
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
    h = el("h3", null, "Quotes");
  h.appendChild(
    btn("+ New quote", "btn alt sm", function () {
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
    l.appendChild(el("b", null, estNum(e.number, e.doc_type) + " · " + money(e.total)));
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

/* ---- Fill-in-the-blanks PDFs in the invoice design (made by tools/build_custom_pdfs.py), for documents made by
   hand: Custom invoice (Billing). Nothing typed into it is saved here. ---- */
function customDocLink(label, file, cls, tip) {
  var a = el("a", cls, label);
  a.href = "/forms/" + file;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = tip;
  return a;
}
function customInvoiceLink(cls) {
  return customDocLink(
    "Custom invoice",
    "custom-invoice.pdf",
    cls,
    "Fill-in-the-blanks invoice PDF. Not saved in Foreman, so it won't show in balances or the portal."
  );
}

/* ---- Bill the month: every client's completed visits become invoices in one step, then a send list ---- */
function openBillMonth() {
  if (billErr) {
    alert("Billing isn't set up yet.");
    return;
  }
  var p = panel();
  p.appendChild(el("h2", null, "Bill the month"));
  p.appendChild(el("p", "note", "Makes one invoice per client (or per property, for clients billed that way) from completed visits that aren't invoiced or paid yet."));
  var thr = fld("Bill visits done through", "date", lastMonthEnd());
  p.appendChild(thr);
  var body = el("div");
  p.appendChild(body);
  function draw() {
    body.textContent = "";
    var through = thr.input.value || lastMonthEnd(),
      vs = unbilled.filter(function (v) {
        return v.scheduled_date <= through && Number(v.price) > 0;
      }),
      noPriceN = unbilled.filter(function (v) {
        return v.scheduled_date <= through && !(Number(v.price) > 0);
      }).length,
      gv = groupVisits(vs),
      tot = r2(
        vs.reduce(function (a, v) {
          return a + Number(v.price || 0);
        }, 0)
      );
    if (!gv.order.length) {
      body.appendChild(el("div", "pcard", "Nothing to bill through " + dshort(through) + ". Every completed visit is already invoiced or paid."));
      return;
    }
    var sum = el("div", "cstats");
    [
      ["Invoices", String(gv.order.length)],
      ["Visits", String(vs.filter(function (v) { return vKind(v) !== "addon"; }).length)],
      ["Add-ons", String(vs.filter(function (v) { return vKind(v) === "addon"; }).length)],
      ["Total", money(tot)]
    ].forEach(function (x) {
      var d = el("div");
      d.appendChild(el("span", null, x[0]));
      d.appendChild(el("b", null, x[1]));
      sum.appendChild(d);
    });
    body.appendChild(sum);
    if (noPriceN) {
      var w = el("div", "note", "\u26a0 " + noPriceN + " completed visit" + (noPriceN > 1 ? "s have" : " has") + " no price and will be left out. Set prices on the To bill tab first if they should be billed.");
      w.style.cssText = "color:#f2c94c;font-weight:700;margin:6px 0";
      body.appendChild(w);
    }
    var lst = el("div", "pcard bmlist");
    gv.order.forEach(function (k) {
      var x = gv.g[k],
        r = el("div", "bmrow");
      var nv = x.vs.filter(function (v) {
          return vKind(v) !== "addon";
        }).length,
        na = x.vs.length - nv,
        ne = x.vs.filter(function (v) {
          return vKind(v) === "extra";
        }).length;
      r.appendChild(
        el(
          "span",
          null,
          groupTitle(x) +
            " \u00b7 " +
            nv +
            " visit" +
            (nv === 1 ? "" : "s") +
            (ne ? " (" + ne + " extra)" : "") +
            (na ? " + " + na + " add-on" + (na > 1 ? "s" : "") : "")
        )
      );
      r.appendChild(
        el(
          "b",
          null,
          money(
            x.vs.reduce(function (a, v) {
              return a + Number(v.price || 0);
            }, 0)
          )
        )
      );
      lst.appendChild(r);
    });
    body.appendChild(lst);
    var go = btn("Create " + gv.order.length + " invoice" + (gv.order.length > 1 ? "s" : ""), "btn", function () {
      go.disabled = true;
      thr.input.disabled = true;
      var made = [],
        fails = [],
        i = 0;
      gv.order
        .reduce(function (pr, k) {
          return pr.then(function () {
            i++;
            go.textContent = "Creating " + i + " of " + gv.order.length + "...";
            return createInvoice(gv.g[k].cid, gv.g[k].vs, through, gv.g[k].pid).then(
              function (inv) {
                made.push(inv);
              },
              function (e) {
                fails.push(groupTitle(gv.g[k]) + ": " + e);
              }
            );
          });
        }, Promise.resolve())
        .then(function () {
          return loadUnbilled();
        })
        .then(function () {
          bfilter = "open";
          render();
          sendList(made, fails);
        });
    });
    go.style.marginTop = "10px";
    body.appendChild(go);
  }
  thr.input.addEventListener("change", draw);
  draw();
  // after creating: one row per new invoice with Email / Text, so sending them all is quick
  function sendList(made, fails) {
    body.textContent = "";
    thr.hidden = true;
    body.appendChild(el("div", "qban ok")).appendChild(el("b", null, "\u2713 Created " + made.length + " invoice" + (made.length === 1 ? "" : "s")));
    if (fails.length) body.appendChild(el("div", "note", "Could not create: " + fails.join("; ")));
    var ea = btn("Email them all", "btn", function () {
      openBatchDeliver(
        made.map(function (i) {
          return i.id;
        })
      );
    });
    ea.style.margin = "4px 0 10px";
    body.appendChild(ea);
    body.appendChild(el("p", "note", "Or send each one yourself. A row turns green once it's sent."));
    made.forEach(function (inv) {
      var c = byId(clients, inv.client_id),
        msg = invMessage(inv, c),
        r = el("div", "pcard bmsend" + (inv.sent_at ? " sent" : "")),
        l = el("div");
      l.appendChild(el("b", null, cname(inv.client_id)));
      l.appendChild(el("div", "note", invNum(inv.number) + " \u00b7 " + money(inv.total)));
      r.appendChild(l);
      var a = el("div", "qacts");
      function sent() {
        markSent(inv);
        r.classList.add("sent");
      }
      if (c && c.email) {
        var em = el("a", "btn sm", "Email");
        em.href = mailHref(c.email, "Invoice " + invNum(inv.number) + " from " + bizv("name", "Latta Corp"), msg);
        em.addEventListener("click", sent);
        a.appendChild(em);
      }
      if (c && c.phone) {
        var tx = el("a", "btn alt sm", "Text");
        tx.href = smsHref(c.phone, msg);
        tx.addEventListener("click", sent);
        a.appendChild(tx);
      }
      a.appendChild(copyBtn("Copy", msg, true, sent));
      r.appendChild(a);
      body.appendChild(r);
    });
  }
}

/* ---- Billing tools: the things you only need now and then ---- */
function openBillTools() {
  var p = panel();
  p.appendChild(el("h2", null, "Billing tools"));
  p.appendChild(el("p", "note", "Things you only need now and then."));
  [
    ["Past invoice", "Add an old invoice that was already sent and paid, so it shows in the client's history.", function () {
      openPastInvoice(null);
    }],
    ["Import payments", "Bring in a list of payments from a spreadsheet (like the GroundsKeeper Pro export).", openPayImport],
    ["Import history", "Bring in a client's old invoices and payments from the old software.", function () {
      openHistImport(null);
    }]
  ].forEach(function (t) {
    var row = el("div", "toolrow");
    row.appendChild(btn(t[0], "btn alt", t[2]));
    row.appendChild(el("div", "note", t[1]));
    p.appendChild(row);
  });
  var row = el("div", "toolrow");
  row.appendChild(customInvoiceLink("btn alt"));
  row.appendChild(el("div", "note", "A blank fill-in invoice PDF to print or fill out by hand. It isn't saved in Foreman."));
  p.appendChild(row);
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

/* ---- Quote responses: when a client accepts or declines a quote online it's "new" until you open it.
   Leads gets a green badge, and while Foreman is open it checks every
   minute and pops up a note when a new answer comes in. (Approvals are also emailed to the business email.) ---- */
function newResponses() {
  return estimates.filter(function (e) {
    return e.response_seen === false && (e.status === "accepted" || e.status === "declined");
  });
}
function respBadge() {
  var b = document.querySelector('#side button[data-v="leads"]');
  if (!b) return;
  var n = newResponses().length,
    x = b.querySelector(".badge.resp");
  if (!n) {
    if (x) x.parentNode.removeChild(x);
    return;
  }
  if (!x) {
    x = el("span", "badge resp");
    b.appendChild(x);
  }
  x.textContent = String(n);
  x.title = n + (n === 1 ? " new quote response" : " new quote responses");
}
function markRespSeen(e) {
  if (!e || e.response_seen !== false) return;
  e.response_seen = true;
  sb.from("estimates")
    .update({ response_seen: true })
    .eq("id", e.id)
    .then(function () {});
  [].forEach.call(document.querySelectorAll('[data-eid="' + e.id + '"]'), function (r) {
    r.classList.remove("fresh");
    var c = r.querySelector(".chip.newresp");
    if (c) c.parentNode.removeChild(c);
  });
  respBadge();
}
var respTimer = null;
function respToast(e) {
  var box = $("resptoasts");
  if (!box) {
    box = el("div");
    box.id = "resptoasts";
    document.body.appendChild(box);
  }
  var ok = e.status === "accepted",
    t = el("div", "rtoast" + (ok ? "" : " no"));
  t.appendChild(el("b", null, (ok ? "\u2713 " : "") + cname(e.client_id) + (ok ? " approved " : " declined ") + estNum(e.number, e.doc_type)));
  t.appendChild(el("div", null, [e.title, money(e.total), e.response_name ? "signed by " + e.response_name : ""].filter(Boolean).join(" · ")));
  var open = btn("Open", "btn sm", function () {
    box.removeChild(t);
    openEstimate(e.id);
  });
  var x = btn("\u00d7", "rx", function () {
    if (t.parentNode) box.removeChild(t);
  });
  x.setAttribute("aria-label", "Dismiss");
  t.appendChild(open);
  t.appendChild(x);
  box.appendChild(t);
}
function checkResponses() {
  if (estErr || document.hidden) return;
  sb.from("estimates")
    .select("*")
    .eq("response_seen", false)
    .then(function (r) {
      if (!r || r.error || !r.data) return;
      var fresh = [];
      r.data.forEach(function (row) {
        var e = byId(estimates, row.id);
        if (e && e.response_seen === false && e.status === row.status) return;
        if (e) Object.assign(e, row);
        else estimates.unshift(row);
        fresh.push(e || row);
      });
      if (!fresh.length) return;
      fresh.forEach(respToast);
      respBadge();
      if (view === "leads" && !$("panel").querySelector("input,textarea,select")) render();
    });
}
function startRespWatch() {
  if (respTimer) return;
  respTimer = setInterval(checkResponses, 60000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkResponses();
  });
}
